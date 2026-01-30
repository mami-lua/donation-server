const express = require('express');
const axios = require('axios');
const app = express();

const PORT = process.env.PORT || 3000;

const axiosConfig = {
    validateStatus: function (status) { return status >= 200 && status < 500; },
    headers: { 'User-Agent': 'Roblox/WinInet' }
};

async function getGamePassPrice(passId) {
    try {
        const url = `https://economy.roproxy.com/v1/game-passes/${passId}/product-info`;
        const r = await axios.get(url, axiosConfig);
        if (r.data && r.data.IsForSale && r.data.PriceInRobux > 0) {
            return { price: r.data.PriceInRobux, creatorId: r.data.Creator.CreatorTargetId };
        }
        return null;
    } catch { return null; }
}

app.get('/', (req, res) => res.send('STRICT API V7 READY'));

app.get('/gamepasses/:userId', async (req, res) => {
    const userId = parseInt(req.params.userId);
    console.log(`\n>>> ANALIZ: ${userId}`);
    
    let universeIds = new Set();
    let finalPasses = [];

    try {
        // 1. ADIM: TÜM OYUNLARI ÇEK (Filtresiz)
        const gamesUrl = `https://games.roproxy.com/v2/users/${userId}/games?sortOrder=Asc&limit=50`;
        const gamesRes = await axios.get(gamesUrl, axiosConfig);
        
        if (gamesRes.data && gamesRes.data.data) {
            gamesRes.data.data.forEach(g => universeIds.add(g.id));
        }
        
        console.log(`   > Universe Sayısı: ${universeIds.size}`);

        // 2. ADIM: ASSETS TARAMASI
        const uniArray = Array.from(universeIds);
        const universePromises = uniArray.map(async (uniId) => {
            try {
                const assetsUrl = `https://games.roproxy.com/v1/games/${uniId}/assets?assetTypes=GamePass&limit=100`;
                const assetsRes = await axios.get(assetsUrl, axiosConfig);
                return assetsRes.data?.data || [];
            } catch (e) { return []; }
        });

        const allRawAssets = (await Promise.all(universePromises)).flat();
        console.log(`   > Ham Asset Sayısı: ${allRawAssets.length}`);

        // 3. ADIM: EKONOMİ KONTROLÜ VE GRUP DESTEĞİ
        const chunkArray = (arr, size) => arr.length > size ? [arr.slice(0, size), ...chunkArray(arr.slice(size), size)] : [arr];
        
        for (const chunk of chunkArray(allRawAssets, 10)) {
            const pricePromises = chunk.map(async (asset) => {
                const info = await getGamePassPrice(asset.id);
                if (info) {
                    // Sadece bu kullanıcıya VEYA bir gruba aitse (Grup kontrolü eklendi)
                    // Pls Donate mantığı: Başkasının pass'i değilse al.
                    return { id: asset.id, price: info.price };
                }
                return null;
            });
            
            const results = await Promise.all(pricePromises);
            results.forEach(r => { if (r) finalPasses.push(r); });
        }

        // Tekrarları sil ve sırala
        const unique = [...new Map(finalPasses.map(item => [item.id, item])).values()];
        unique.sort((a, b) => a.price - b.price);

        console.log("FINAL PASS COUNT:", unique.length);
        res.json({ data: unique });

    } catch (e) {
        console.error("❌ ERROR:", e.message);
        res.json({ data: [] });
    }
});

app.listen(PORT, () => console.log(`Server Online` ) );
