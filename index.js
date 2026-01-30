const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('MARKETPLACE V11 - FIXED HEADERS'));

app.get('/gamepasses/:userId', async (req, res) => {
    const userId = Number(req.params.userId);
    console.log(`\n>>> USER: ${userId}`);
    
    if (!userId || userId < 1) {
        return res.json({ error: "Invalid userId", data: [] });
    }
    
    try {
        // 🔥 ROBLOX'UN SEVDİĞİ HEADERS
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Referer': 'https://www.roblox.com/',
            'Origin': 'https://www.roblox.com'
        };
        
        // Catalog API - En stabil endpoint
        const url = `https://catalog.roblox.com/v1/search/items?Category=11&CreatorTargetId=${userId}&CreatorType=User&SalesTypeFilter=1&Limit=100`;
        
        console.log("📡 İstek gönderiliyor...");
        
        const response = await axios.get(url, {
            headers: headers,
            timeout: 15000,
            validateStatus: (status) => status >= 200 && status < 500,
            maxRedirects: 5
        });
        
        console.log(`📥 HTTP ${response.status}`);
        
        if (response.status === 403) {
            console.log("❌ 403 - Rate limit veya blocked");
            // 1-2 saniye bekleyip tekrar dene
            await new Promise(r => setTimeout(r, 2000));
            
            const retry = await axios.get(url, {
                headers: headers,
                timeout: 15000,
                validateStatus: (status) => status >= 200 && status < 500
            });
            
            console.log(`🔄 Retry: HTTP ${retry.status}`);
            
            if (retry.status !== 200) {
                return res.json({ 
                    error: `HTTP ${retry.status}`,
                    message: "Roblox API geçici olarak erişilemiyor. 30 saniye sonra tekrar deneyin.",
                    data: [] 
                });
            }
            
            const retryData = retry.data?.data || [];
            const passes = retryData
                .filter(p => p.price > 0)
                .map(p => ({ id: p.id, price: p.price }))
                .sort((a, b) => a.price - b.price);
            
            console.log(`✅ Retry başarılı: ${passes.length} pass`);
            return res.json({ data: passes });
        }
        
        if (response.status !== 200) {
            return res.json({ 
                error: `HTTP ${response.status}`,
                data: [] 
            });
        }
        
        const data = response.data?.data || [];
        
        console.log(`✅ ${data.length} ürün bulundu`);
        
        const passes = data
            .filter(p => p.price > 0)
            .map(p => ({ id: p.id, price: p.price }))
            .sort((a, b) => a.price - b.price);
        
        console.log(`✅ ${passes.length} GamePass hazır`);
        
        if (passes.length > 0) {
            console.log("İlk 3 pass:");
            passes.slice(0, 3).forEach(p => {
                console.log(`  → ID: ${p.id}, Fiyat: ${p.price}R$`);
            });
        }
        
        res.json({ data: passes });
        
    } catch (error) {
        console.error("❌ ERROR:", error.message);
        res.json({ 
            error: error.message,
            data: [] 
        });
    }
});

app.listen(PORT, () => console.log(`🚀 Server: ${PORT}`));
