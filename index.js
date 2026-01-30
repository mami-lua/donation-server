const express = require('express');
const axios = require('axios');
const app = express();

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Universe/Gamepass Tarayıcı Calisiyor!');
});

app.get('/gamepasses/:userId', async (req, res) => {
    const userId = req.params.userId;
    console.log(`>>> TARAMA BAŞLADI: ${userId}`);

    try {
        // 1. ADIM: Kullanıcının halka açık oyunlarını (Universe) bul
        // Limit 50 oyun (Çoğu kişi için yeterli)
        const gamesUrl = `https://games.roproxy.com/v2/users/${userId}/games?accessFilter=Public&limit=50&sortOrder=Asc`;
        
        const gamesResponse = await axios.get(gamesUrl);
        const games = gamesResponse.data.data || [];

        console.log(`   > ${games.length} adet oyun bulundu. İçleri taranıyor...`);

        if (games.length === 0) {
            return res.json({ success: true, data: [] });
        }

        // 2. ADIM: Her oyunun içindeki Gamepassleri paralel olarak çek
        // Promise.all kullanarak hepsine aynı anda istek atıyoruz (Çok hızlı olur)
        const passPromises = games.map(async (game) => {
            try {
                const passUrl = `https://games.roproxy.com/v1/games/${game.id}/gamepasses?limit=100&sortOrder=Asc`;
                const passResponse = await axios.get(passUrl);
                const passes = passResponse.data.data || [];
                
                // Sadece fiyatı olanları döndür
                return passes.filter(p => p.price && p.price > 0).map(p => ({
                    id: p.id,
                    price: p.price,
                    name: p.name, // İsim de ekledik, loglarda görmek için
                    gameName: game.name
                }));
            } catch (err) {
                console.error(`   ! Hata (Game ID ${game.id}): ${err.message}`);
                return [];
            }
        });

        // Tüm taramaların bitmesini bekle
        const results = await Promise.all(passPromises);

        // 3. ADIM: Sonuçları tek bir listede birleştir (Flatten)
        let allPasses = results.flat();

        // Fiyata göre sırala
        allPasses.sort((a, b) => a.price - b.price);

        console.log(`✅ TOPLAM: ${allPasses.length} adet gamepass bulundu ve gönderildi.`);
        
        res.json({
            success: true,
            data: allPasses
        });

    } catch (error) {
        console.error("❌ GENEL HATA:", error.message);
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
