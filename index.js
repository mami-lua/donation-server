const express = require('express');
const axios = require('axios');
const app = express();

const PORT = process.env.PORT || 3000;

// Axios ayarları
const axiosConfig = {
    validateStatus: function (status) { return status >= 200 && status < 500; },
    headers: { 'User-Agent': 'Roblox/WinInet' }
};

app.get('/', (req, res) => res.send('TERMINATOR API V5 HAZIR'));

app.get('/gamepasses/:userId', async (req, res) => {
    const userId = parseInt(req.params.userId);
    console.log(`\n>>> TERMINATOR TARAMA: ${userId}`);
    
    let universeIds = new Set(); // Tekrar edenleri engellemek için Set kullanıyoruz
    let allPasses = [];

    try {
        // --- 1. AŞAMA: OYUN (UNIVERSE) ID'LERİNİ TOPLA ---
        
        // YÖNTEM A: Public Oyunlar (Creations)
        const gamesUrl = `https://games.roproxy.com/v2/users/${userId}/games?accessFilter=Public&limit=50&sortOrder=Asc`;
        const gamesRes = await axios.get(gamesUrl, axiosConfig);
        if (gamesRes.data && gamesRes.data.data) {
            gamesRes.data.data.forEach(g => universeIds.add(g.id));
            console.log(`   > Yöntem A (Public Games): ${gamesRes.data.data.length} oyun bulundu.`);
        }

        // YÖNTEM B: Envanterdeki Mekanlar (Inventory)
        const invUrl = `https://inventory.roproxy.com/v2/users/${userId}/inventory?assetTypes=Place&limit=100&sortOrder=Asc`;
        const invRes = await axios.get(invUrl, axiosConfig);
        if (invRes.data && invRes.data.data && invRes.data.data.length > 0) {
            const placeIds = invRes.data.data.map(p => p.assetId);
            // Place ID -> Universe ID Çevir
            const chunkArray = (arr, size) => arr.length > size ? [arr.slice(0, size), ...chunkArray(arr.slice(size), size)] : [arr];
            for (const chunk of chunkArray(placeIds, 50)) {
                try {
                    const uniUrl = `https://games.roproxy.com/v1/games/multiget-place-details?placeIds=${chunk.join(',')}`;
                    const uniRes = await axios.get(uniUrl, axiosConfig);
                    if (uniRes.data) {
                        uniRes.data.forEach(u => universeIds.add(u.id));
                    }
                } catch (e) {}
            }
            console.log(`   > Yöntem B (Inventory): ${invRes.data.data.length} mekan tarandı.`);
        }

        console.log(`   > TOPLAM UNIVERSE SAYISI: ${universeIds.size}`);

        // --- 2. AŞAMA: GAMEPASSLERİ ÇEK ---

        // Universe'lerden Gamepass Çek
        const uniArray = Array.from(universeIds);
        const passPromises = uniArray.map(async (uniId) => {
            const passUrl = `https://games.roproxy.com/v1/games/${uniId}/gamepasses?limit=100&sortOrder=Asc`;
            const passRes = await axios.get(passUrl, axiosConfig);
            if (passRes.data && Array.isArray(passRes.data.data)) {
                return passRes.data.data;
            }
            return [];
        });

        // YÖNTEM C: Katalogdan Direkt Ara (Yedek Güç)
        const catalogPromise = axios.get(`https://catalog.roproxy.com/v1/search/items?category=GamePass&creatorTargetId=${userId}&creatorType=User&limit=100&sortOrder=Asc`, axiosConfig);

        // Hepsini bekle
        const [uniResults, catResult] = await Promise.all([
            Promise.all(passPromises),
            catalogPromise
        ]);

        // Listeleri Birleştir
        let rawPasses = uniResults.flat();
        if (catResult.data && catResult.data.data) {
            rawPasses = rawPasses.concat(catResult.data.data);
            console.log(`   > Yöntem C (Catalog): ${catResult.data.data.length} veri geldi.`);
        }

        // --- 3. AŞAMA: FİLTRELE VE TEMİZLE ---
        
        rawPasses.forEach(p => {
            // 1. Fiyatı var mı?
            // 2. Satıcı ID eşleşiyor mu? (ÖNEMLİ: Başkasının pass'i girmesin)
            if (p.price && p.price > 0 && p.sellerId === userId) {
                allPasses.push({
                    id: p.id,
                    price: p.price
                });
            }
        });

        // ID Tekrarını Temizle
        allPasses = [...new Map(allPasses.map(item => [item['id'], item])).values()];
        
        // Sırala
        allPasses.sort((a, b) => a.price - b.price);

        console.log("FINAL PASS COUNT:", allPasses.length);

        res.json({
            data: allPasses
        });

    } catch (error) {
        console.error("❌ ERROR:", error.message);
        res.json({ data: [] });
    }
});

app.listen(PORT, () => console.log(`Server: ${PORT}`));
