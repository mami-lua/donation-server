const express = require('express');
const axios = require('axios');
const app = express();

const PORT = process.env.PORT || 3000;

const axiosConfig = {
    validateStatus: function (status) { return status >= 200 && status < 500; },
    headers: { 'User-Agent': 'Roblox/WinInet' }
};

app.get('/', (req, res) => res.send('API HAZIR v4 (STRICT MODE)'));

app.get('/gamepasses/:userId', async (req, res) => {
    const userId = parseInt(req.params.userId); // ID'yi sayıya çevir (Filter için şart)
    console.log(`\n>>> IST: ${userId}`);
    
    let allPasses = [];

    try {
        // 1. ADIM: ENVANTERDEN MEKANLARI ÇEK
        const invUrl = `https://inventory.roproxy.com/v2/users/${userId}/inventory?assetTypes=Place&limit=100&sortOrder=Asc`;
        const invRes = await axios.get(invUrl, axiosConfig);
        
        const places = (invRes.data && invRes.data.data) ? invRes.data.data : [];
        
        if (places.length === 0) {
            console.log("FINAL PASS COUNT: 0 (No Places)");
            return res.json({ data: [] });
        }

        // 2. ADIM: UNIVERSE ID BUL
        const placeIds = places.map(p => p.assetId);
        let universeIds = [];
        
        const chunkArray = (arr, size) => arr.length > size ? [arr.slice(0, size), ...chunkArray(arr.slice(size), size)] : [arr];
        
        for (const chunk of chunkArray(placeIds, 50)) {
            try {
                const uniUrl = `https://games.roproxy.com/v1/games/multiget-place-details?placeIds=${chunk.join(',')}`;
                const uniRes = await axios.get(uniUrl, axiosConfig);
                if (uniRes.data) {
                    uniRes.data.forEach(u => universeIds.push(u.id));
                }
            } catch (e) {}
        }

        // 3. ADIM: GAMEPASS ÇEK VE FİLTRELE (KRİTİK KISIM)
        const passPromises = universeIds.map(async (uniId) => {
            const passUrl = `https://games.roproxy.com/v1/games/${uniId}/gamepasses?limit=100&sortOrder=Asc`;
            const passRes = await axios.get(passUrl, axiosConfig);
            
            if (passRes.data && Array.isArray(passRes.data.data)) {
                return passRes.data.data
                    .filter(p => {
                        // 1. Fiyatı var mı?
                        // 2. Satıcı bu kullanıcı mı? (BAŞKASININ PASS'İ GELMESİN)
                        return (p.price && p.price > 0 && p.sellerId === userId);
                    })
                    .map(p => ({
                        id: p.id,
                        price: p.price 
                        // name vs. sildik, sadece core data
                    }));
            }
            return [];
        });

        const results = await Promise.all(passPromises);
        allPasses = results.flat();
        
        // ID tekrarını temizle
        allPasses = [...new Map(allPasses.map(item => [item['id'], item])).values()];
        // Sırala
        allPasses.sort((a, b) => a.price - b.price);

        console.log("FINAL PASS COUNT:", allPasses.length);

        res.json({
            data: allPasses
        });

    } catch (error) {
        console.error("❌ ERROR:", error.message);
        console.log("FINAL PASS COUNT: 0 (Error)");
        res.json({ data: [] });
    }
});

app.listen(PORT, () => console.log(`Server: ${PORT}`));
