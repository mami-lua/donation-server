const express = require('express');
const axios = require('axios');
const app = express();

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Deep Scan API Calisiyor!');
});

app.get('/gamepasses/:userId', async (req, res) => {
    const userId = req.params.userId;
    console.log(`\n>>> DERİN TARAMA BAŞLADI: ${userId}`);

    try {
        // 1. ADIM: ENVANTERDEN "PLACE" (MEKAN) LİSTESİNİ ÇEK
        // Bu yöntem oyunun public listesinde görünmese bile, senin envanterinde olduğu için onu bulur.
        const inventoryUrl = `https://inventory.roproxy.com/v2/users/${userId}/inventory?assetTypes=Place&limit=100&sortOrder=Asc`;
        const invResponse = await axios.get(inventoryUrl);
        const places = invResponse.data.data || [];

        if (places.length === 0) {
            console.log("   ! Kullanıcının envanterinde hiç oyun (Place) bulunamadı.");
            return res.json({ success: true, data: [] });
        }

        console.log(`   > Envanterde ${places.length} adet Place (Mekan) bulundu.`);

        // 2. ADIM: PLACE ID'LERİNİ UNIVERSE ID'YE ÇEVİR
        // Gamepass'ler Universe'e bağlıdır, Place ID ile gamepass çekilemez.
        const placeIds = places.map(p => p.assetId);
        let universeIds = [];

        // Roblox API'si en fazla 50 ID'yi aynı anda çevirebilir, o yüzden bölerek soruyoruz
        const chunkArray = (arr, size) => arr.length > size ? [arr.slice(0, size), ...chunkArray(arr.slice(size), size)] : [arr];
        const chunks = chunkArray(placeIds, 50);

        for (const chunk of chunks) {
            try {
                const universeUrl = `https://games.roproxy.com/v1/games/multiget-place-details?placeIds=${chunk.join(',')}`;
                const uniResponse = await axios.get(universeUrl);
                const universes = uniResponse.data || [];
                universes.forEach(u => universeIds.push(u.id));
            } catch (err) {
                console.error("   ! Universe ID çevirme hatası:", err.message);
            }
        }

        console.log(`   > ${universeIds.length} adet Universe ID tespit edildi. Gamepassler taranıyor...`);

        // 3. ADIM: HER UNIVERSE İÇİN GAMEPASSLERİ ÇEK
        const passPromises = universeIds.map(async (uniId) => {
            try {
                const passUrl = `https://games.roproxy.com/v1/games/${uniId}/gamepasses?limit=100&sortOrder=Asc`;
                const passResponse = await axios.get(passUrl);
                const passes = passResponse.data.data || [];
                
                return passes.filter(p => p.price && p.price > 0).map(p => ({
                    id: p.id,
                    price: p.price,
                    name: p.name
                }));
            } catch (err) {
                return [];
            }
        });

        const results = await Promise.all(passPromises);
        let allPasses = results.flat();

        // Aynı gamepass'ten birden fazla varsa temizle (Nadir olur ama olsun)
        allPasses = [...new Map(allPasses.map(item => [item['id'], item])).values()];

        // Fiyata göre sırala
        allPasses.sort((a, b) => a.price - b.price);

        console.log(`✅ İŞLEM TAMAM: Toplam ${allPasses.length} adet gamepass bulundu.`);
        
        res.json({
            success: true,
            data: allPasses
        });

    } catch (error) {
        console.error("❌ KRİTİK HATA:", error.message);
        res.status(500).json({
            success: false,
            message: "API Hatası",
            error: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server baslatildi! Port: ${PORT}`);
});
