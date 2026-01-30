const express = require('express');
const axios = require('axios');
const app = express();

const PORT = process.env.PORT || 3000;

const axiosConfig = {
    validateStatus: (status) => status >= 200 && status < 500,
    headers: { 'User-Agent': 'Roblox/WinInet' }
};

app.get('/', (req, res) => res.send('MARKETPLACE ENGINE V9 READY'));

app.get('/gamepasses/:userId', async (req, res) => {
    const userId = Number(req.params.userId);
    console.log(`\n>>> MARKETPLACE TARAMASI: ${userId}`);

    try {
        // 🔥 YAZILIMCININ VERDİĞİ TEK DOĞRU YOL: Catalog Search
        // Bu API envanter gizliliğine bakmaz, direkt "Mağazada ne var?" diye sorar.
        const url = `https://catalog.roproxy.com/v1/search/items?Category=11&Subcategory=11&CreatorTargetId=${userId}&CreatorType=User&SalesTypeFilter=1&Limit=50`;
        
        // NOT: Category=GamePasses bazen Query olarak kabul edilmezse Category=11 (GamePass) kullanılır.
        const r = await axios.get(url, axiosConfig);

        const rawData = r.data?.data || [];
        console.log(`   > Bulunan Ürün Sayısı: ${rawData.length}`);

        // Saf ve hızlı eşleme
        const passes = rawData.map(p => ({
            id: p.id,
            price: p.price
        }));

        // Fiyata göre sırala (Artan)
        passes.sort((a, b) => (a.price || 0) - (b.price || 0));

        console.log("FINAL PASS COUNT:", passes.length);
        res.json({ data: passes });

    } catch (e) {
        console.error("❌ CATALOG ERROR:", e.message);
        res.json({ data: [] });
    }
});

app.listen(PORT, () => console.log(`Server Online`));
