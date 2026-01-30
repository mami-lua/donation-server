const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('MARKETPLACE ENGINE - ROPROXY'));

app.get('/gamepasses/:userId', async (req, res) => {
    const userId = Number(req.params.userId);
    console.log(`\n>>> KULLANICI: ${userId}`);
    
    try {
        // ADIM 1: Kullanıcının oyunlarını bul
        const gamesUrl = `https://games.roblox.com/v2/users/${userId}/games?accessFilter=All&sortOrder=Desc&limit=50`;
        const gamesRes = await axios.get(gamesUrl, {
            headers: { 'User-Agent': 'Roblox/WinInet' },
            timeout: 10000
        });
        
        if (!gamesRes.data?.data || gamesRes.data.data.length === 0) {
            console.log("❌ Oyun bulunamadı");
            return res.json({ data: [] });
        }
        
        console.log(`✅ ${gamesRes.data.data.length} oyun bulundu`);
        
        let allPasses = [];
        
        // ADIM 2: YENİ API'yi ROPROXY üzerinden çağır
        for (const game of gamesRes.data.data) {
            try {
                const universeId = game.id;
                
                // 🔥 ROPROXY ÜZERİNDEN YENİ API
                const proxyUrl = `https://apis.roproxy.com/game-passes/v1/universes/${universeId}/game-passes?passView=Full&pageSize=100`;
                
                console.log(`  → ${game.name} (Universe: ${universeId})`);
                
                const passRes = await axios.get(proxyUrl, {
                    headers: { 
                        'User-Agent': 'Roblox/WinInet',
                        'Accept': 'application/json'
                    },
                    timeout: 8000,
                    validateStatus: (status) => status >= 200 && status < 500
                });
                
                if (passRes.status !== 200) {
                    console.log(`    ⚠️ HTTP ${passRes.status}`);
                    continue;
                }
                
                // YENİ API response formatı
                const passes = passRes.data?.gamePasses || [];
                
                if (passes.length > 0) {
                    console.log(`    ✅ ${passes.length} GamePass bulundu!`);
                    
                    for (const pass of passes) {
                        if (pass.price && pass.price > 0) {
                            allPasses.push({
                                id: pass.id,
                                price: pass.price,
                                name: pass.name
                            });
                            console.log(`      → ${pass.name}: ${pass.price}R$`);
                        }
                    }
                } else {
                    console.log(`    ⚠️ GamePass yok veya hiçbiri satışta değil`);
                }
                
            } catch (err) {
                console.log(`    ❌ RoProxy Error: ${err.message}`);
                
                // FALLBACK: Catalog API dene (bu kesin çalışır)
                try {
                    console.log(`    🔄 Catalog API deneniyor...`);
                    const catalogUrl = `https://catalog.roproxy.com/v1/search/items?Category=11&CreatorTargetId=${userId}&CreatorType=User&SalesTypeFilter=1&Limit=100`;
                    const catalogRes = await axios.get(catalogUrl, {
                        headers: { 'User-Agent': 'Roblox/WinInet' },
                        timeout: 5000
                    });
                    
                    if (catalogRes.data?.data && catalogRes.data.data.length > 0) {
                        const catalogPasses = catalogRes.data.data
                            .filter(p => p.price > 0)
                            .map(p => ({
                                id: p.id,
                                price: p.price,
                                name: p.name
                            }));
                        allPasses.push(...catalogPasses);
                        console.log(`    ✅ Catalog'dan ${catalogPasses.length} pass bulundu`);
                    }
                } catch (catalogErr) {
                    console.log(`    ❌ Catalog da başarısız: ${catalogErr.message}`);
                }
            }
            
            // Rate limit
            await new Promise(r => setTimeout(r, 300));
        }
        
        if (allPasses.length === 0) {
            console.log("❌ HİÇBİR GAMEPASS BULUNAMADI");
            
            // SON ÇARE: Direkt kullanıcının tüm GamePass'lerini Catalog'dan çek
            try {
                console.log("🔄 Son çare: Direkt Catalog sorgusu...");
                const lastResortUrl = `https://catalog.roproxy.com/v1/search/items?Category=11&CreatorTargetId=${userId}&CreatorType=User&SalesTypeFilter=1&Limit=100`;
                const lastRes = await axios.get(lastResortUrl, {
                    headers: { 'User-Agent': 'Roblox/WinInet' },
                    timeout: 8000
                });
                
                if (lastRes.data?.data && lastRes.data.data.length > 0) {
                    allPasses = lastRes.data.data
                        .filter(p => p.price > 0)
                        .map(p => ({ id: p.id, price: p.price }));
                    console.log(`✅ Son çare başarılı: ${allPasses.length} pass`);
                }
            } catch (lastErr) {
                console.log("❌ Son çare de başarısız");
            }
            
            if (allPasses.length === 0) {
                return res.json({ data: [] });
            }
        }
        
        // Fiyata göre sırala
        allPasses.sort((a, b) => a.price - b.price);
        
        // Duplicate temizle
        const uniquePasses = [];
        const seenIds = new Set();
        for (const pass of allPasses) {
            if (!seenIds.has(pass.id)) {
                seenIds.add(pass.id);
                uniquePasses.push({ id: pass.id, price: pass.price });
            }
        }
        
        console.log(`\n✅✅✅ TOPLAM ${uniquePasses.length} GAMEPASS ✅✅✅\n`);
        
        res.json({ data: uniquePasses });
        
    } catch (e) {
        console.error("❌ FATAL:", e.message);
        res.json({ error: e.message, data: [] });
    }
});

app.listen(PORT, () => console.log(`🚀 Port ${PORT}`));
