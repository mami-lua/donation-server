const express = require('express');
const axios = require('axios');
const app = express();

const PORT = process.env.PORT || 3000;

// Axios ayarları: Hata alsa bile sunucuyu çökertme (403/500 gibi)
const axiosConfig = {
    validateStatus: function (status) {
        return status >= 200 && status < 500; 
    },
    headers: { 'User-Agent': 'Roblox/WinInet' }
};

app.get('/', (req, res) => res.send('API HAZIR'));

app.get('/gamepasses/:userId', async (req, res) => {
    const userId = req.params.userId;
    console.log(`\n>>> IST: ${userId}`);
    
    let allPasses = [];

    try {
        // 1. ADIM: ENVANTERDEN MEKANLARI (PLACES) ÇEK
        // Gizli envanter ise burası boş veya hata dönebilir, sorun yok.
        const invUrl = `https://inventory.roproxy.com/v2/users/${userId}/inventory?assetTypes=Place&limit=100&sortOrder=Asc`;
        const invRes = await axios.get(invUrl, axiosConfig);
        
        // Eğer veri yoksa veya hata varsa direkt boş dön (Patlama yok)
        if (!invRes.data || !invRes.data.data) {
            console.log("   ! Envanter gizli veya boş.");
            return res.json({ data: [] });
        }

        const places = invRes.data.data;
        console.log(`   > ${places.length} place bulundu.`);

        if (places.length === 0) return res.json({ data: [] });

        // 2. ADIM: PLACE ID -> UNIVERSE ID
        const placeIds = places.map(p => p.assetId);
        let universeIds = [];
        
        // 50'şerli gruplar halinde sor
        const chunkArray = (arr, size) => arr.length > size ? [arr.slice(0, size), ...chunkArray(arr.slice(size), size)] : [arr];
        
        for (const chunk of chunkArray(placeIds, 50)) {
            try {
                const uniUrl = `https://games.roproxy.com/v1/games/multiget-place-details?placeIds=${chunk.join(',')}`;
                const uniRes = await axios.get(uniUrl, axiosConfig);
                if (uniRes.data) {
                    uniRes.data.forEach(u => universeIds.push(u.id));
                }
            } catch (e) { console.log("   ! UniID Hata"); }
        }

        // 3. ADIM: GAMEPASS ÇEK
        const passPromises = universeIds.map(async (uniId) => {
            const passUrl = `https://games.roproxy.com/v1/games/${uniId}/gamepasses?limit=100&sortOrder=Asc`;
            const passRes = await axios.get(passUrl, axiosConfig);
            if (passRes.data && passRes.data.data) {
                return passRes.data.data
                    .filter(p => p.price && p.price > 0)
                    .map(p => ({ id: p.id, price: p.price, name: p.name }));
            }
            return [];
        });

        const results = await Promise.all(passPromises);
        allPasses = results.flat();
        
        // Sırala
        allPasses.sort((a, b) => a.price - b.price);
        
        console.log(`✅ SONUC: ${allPasses.length} pass.`);

        // JSON formatı tam olarak yazılımcının istediği gibi:
        // { "data": [ ... ] }
        res.json({
            data: allPasses
        });

    } catch (error) {
        console.error("❌ SUNUCU HATASI:", error.message);
        // Hata olsa bile { data: [] } dön ki Roblox şaşırmasın
        res.json({ data: [] }); 
    }
});

app.listen(PORT, () => console.log(`Server: ${PORT}`));
