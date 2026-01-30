const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// 🔥 BU CORS PROXY ÜZERİNDEN GİDECEĞİZ
const CORS_PROXY = 'https://corsproxy.io/?';

app.get('/', (req, res) => res.send('MARKETPLACE ENGINE - CORS PROXY'));

app.get('/gamepasses/:userId', async (req, res) => {
    const userId = Number(req.params.userId);
    console.log(`\n>>> USER: ${userId}`);
    
    if (!userId || userId < 1) {
        return res.json({ error: "Invalid userId", data: [] });
    }
    
    try {
        // DİREKT CATALOG API - EN GARANTİ YÖNTEM
        const catalogUrl = `https://catalog.roblox.com/v1/search/items?Category=11&CreatorTargetId=${userId}&CreatorType=User&SalesTypeFilter=1&Limit=100`;
        
        console.log("📡 Catalog API çağrılıyor...");
        
        // CORS Proxy üzerinden istek at
        const response = await axios.get(CORS_PROXY + encodeURIComponent(catalogUrl), {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'application/json'
            },
            timeout: 15000,
            validateStatus: (status) => status >= 200 && status < 500
        });
        
        console.log(`📥 HTTP Status: ${response.status}`);
        
        if (response.status !== 200) {
            console.log("❌ HTTP Error:", response.status);
            return res.json({ error: `HTTP ${response.status}`, data: [] });
        }
        
        const data = response.data?.data || [];
        
        console.log(`✅ ${data.length} ürün bulundu`);
        
        if (data.length === 0) {
            console.log("⚠️ Bu kullanıcının satışta GamePass'i yok");
            return res.json({ data: [] });
        }
        
        // Sadece fiyatı olan pass'leri al
        const passes = data
            .filter(p => p.price && p.price > 0)
            .map(p => ({
                id: p.id,
                price: p.price
            }))
            .sort((a, b) => a.price - b.price);
        
        console.log(`✅ ${passes.length} GamePass hazır`);
        passes.slice(0, 5).forEach(p => {
            console.log(`  → ID: ${p.id}, Price: ${p.price}R$`);
        });
        
        res.json({ data: passes });
        
    } catch (error) {
        console.error("❌ ERROR:", error.message);
        
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            console.log("⚠️ Network problemi - Render'dan Roblox'a erişilemiyor");
        }
        
        res.json({ 
            error: error.message,
            code: error.code,
            data: [] 
        });
    }
});

app.listen(PORT, () => console.log(`🚀 Server Online: ${PORT}`));
