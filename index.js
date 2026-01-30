const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('MARKETPLACE ENGINE - FIXED WITH NEW API'));

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
        
        // ADIM 2: YENİ API ile GamePass'leri çek
        for (const game of gamesRes.data.data) {
            try {
                const universeId = game.id;
                
                // 🔥 YENİ ROBLOX API - Bu kesin çalışır
                const newApiUrl = `https://apis.roblox.com/game-passes/v1/universes/${universeId}/game-passes?passView=Full&pageSize=100`;
                
                console.log(`  → ${game.name} (Universe: ${universeId})`);
                
                const passRes = await axios.get(newApiUrl, {
                    headers: { 
                        'User-Agent': 'Roblox/WinInet',
                        'Accept': 'application/json'
                    },
                    timeout: 8000
                });
                
                // YENİ API response formatı: { gamePasses: [...] }
                const passes = passRes.data?.gamePasses || [];
                
                if (passes.length > 0) {
                    console.log(`    ✅ ${passes.length} GamePass bulundu!`);
                    
                    for (const pass of passes) {
                        // isForSale kontrolü ve price çek
                        if (pass.price && pass.price > 0) {
                            allPasses.push({
                                id: pass.id,
                                price: pass.price,
                                name: pass.name // Debug için
                            });
                            console.log(`      → ${pass.name}: ${pass.price}R$`);
                        }
                    }
                } else {
                    console.log(`    ⚠️ GamePass yok`);
                }
                
            } catch (err) {
                console.log(`    ❌ Error: ${err.message}`);
                // Eğer yeni API çalışmazsa eski catalog API'yi dene
                try {
                    console.log(`    🔄 Catalog API deneniyor...`);
                    const catalogUrl = `https://catalog.roblox.com/v1/search/items?Category=11&CreatorTargetId=${userId}&CreatorType=User&SalesTypeFilter=1&Limit=100`;
                    const catalogRes = await axios.get(catalogUrl, {
                        headers: { 'User-Agent': 'Roblox/WinInet' },
                        timeout: 5000
                    });
                    
                    if (catalogRes.data?.data) {
                        const catalogPasses = catalogRes.data.data.map(p => ({
                            id: p.id,
                            price: p.price || 0,
                            name: p.name
                        }));
                        allPasses.push(...catalogPasses);
                        console.log(`    ✅ Catalog'dan ${catalogPasses.length} pass bulundu`);
                    }
                } catch (catalogErr) {
                    console.log(`    ❌ Catalog da başarısız: ${catalogErr.message}`);
                }
            }
            
            // Rate limit için bekleme
            await new Promise(r => setTimeout(r, 400));
        }
        
        if (allPasses.length === 0) {
            console.log("❌ HİÇBİR GAMEPASS BULUNAMADI");
            return res.json({ data: [] });
        }
        
        // Fiyata göre sırala
        allPasses.sort((a, b) => a.price - b.price);
        
        // Name'i çıkar (sadece id ve price)
        const finalPasses = allPasses.map(p => ({ id: p.id, price: p.price }));
        
        // Duplicate'leri temizle (aynı ID'ye sahip pass'ler varsa)
        const uniquePasses = [];
        const seenIds = new Set();
        for (const pass of finalPasses) {
            if (!seenIds.has(pass.id)) {
                seenIds.add(pass.id);
                uniquePasses.push(pass);
            }
        }
        
        console.log(`\n✅✅✅ TOPLAM ${uniquePasses.length} GAMEPASS BULUNDU ✅✅✅\n`);
        
        res.json({ data: uniquePasses });
        
    } catch (e) {
        console.error("❌ FATAL ERROR:", e.message);
        res.json({ error: e.message, data: [] });
    }
});

app.listen(PORT, () => console.log(`🚀 Server Port ${PORT}`));
