const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio'); // npm install cheerio
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('MARKETPLACE V12 - HTML SCRAPING'));

// HTML'den GamePass bilgilerini çıkar
function parseGamePassHTML(html) {
    const $ = cheerio.load(html);
    const passes = [];
    
    // Roblox'un HTML yapısını parse et
    $('.list-item').each((i, elem) => {
        try {
            const passId = $(elem).attr('data-item-id');
            const priceText = $(elem).find('.text-robux').text().trim();
            const price = parseInt(priceText.replace(/,/g, ''));
            
            if (passId && price && price > 0) {
                passes.push({
                    id: parseInt(passId),
                    price: price
                });
            }
        } catch (e) {
            // Skip invalid items
        }
    });
    
    return passes;
}

app.get('/gamepasses/:userId', async (req, res) => {
    const userId = Number(req.params.userId);
    console.log(`\n>>> USER: ${userId}`);
    
    if (!userId || userId < 1) {
        return res.json({ error: "Invalid userId", data: [] });
    }
    
    try {
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.roblox.com/',
            'Cookie': '.ROBLOSECURITY=_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items.|_' // Fake cookie
        };
        
        // ADIM 1: Kullanıcının oyunlarını bul
        console.log("📡 Oyunlar çekiliyor...");
        const gamesUrl = `https://games.roblox.com/v2/users/${userId}/games?accessFilter=All&limit=50`;
        const gamesRes = await axios.get(gamesUrl, { headers, timeout: 10000 });
        
        if (!gamesRes.data?.data || gamesRes.data.data.length === 0) {
            console.log("❌ Oyun bulunamadı");
            return res.json({ data: [] });
        }
        
        console.log(`✅ ${gamesRes.data.data.length} oyun bulundu`);
        
        let allPasses = [];
        
        // ADIM 2: Her oyunun GamePass sayfasını HTML olarak çek
        for (const game of gamesRes.data.data) {
            try {
                const placeId = game.rootPlaceId || game.rootPlace?.id;
                
                if (!placeId) {
                    console.log(`  ⚠️ ${game.name}: PlaceId yok`);
                    continue;
                }
                
                console.log(`  → ${game.name} (Place: ${placeId})`);
                
                // 🔥 FORUM'DAKİ ENDPOINT - HTML DÖNDÜRÜR
                const htmlUrl = `https://www.roblox.com/games/getgamepassesinnerpartial?startIndex=0&maxRows=100&placeId=${placeId}`;
                
                const htmlRes = await axios.get(htmlUrl, {
                    headers: headers,
                    timeout: 8000,
                    validateStatus: (status) => status >= 200 && status < 500
                });
                
                if (htmlRes.status === 200 && htmlRes.data) {
                    const passes = parseGamePassHTML(htmlRes.data);
                    
                    if (passes.length > 0) {
                        console.log(`    ✅ ${passes.length} GamePass bulundu!`);
                        passes.forEach(p => {
                            console.log(`      → ID: ${p.id}, Fiyat: ${p.price}R$`);
                        });
                        allPasses.push(...passes);
                    } else {
                        console.log(`    ⚠️ GamePass yok veya parse edilemedi`);
                    }
                } else {
                    console.log(`    ❌ HTTP ${htmlRes.status}`);
                }
                
            } catch (err) {
                console.log(`    ❌ Error: ${err.message}`);
            }
            
            // Rate limit
            await new Promise(r => setTimeout(r, 500));
        }
        
        if (allPasses.length === 0) {
            console.log("❌ HİÇBİR GAMEPASS BULUNAMADI");
            return res.json({ data: [] });
        }
        
        // Duplicate temizle ve sırala
        const uniquePasses = [];
        const seenIds = new Set();
        
        for (const pass of allPasses) {
            if (!seenIds.has(pass.id)) {
                seenIds.add(pass.id);
                uniquePasses.push(pass);
            }
        }
        
        uniquePasses.sort((a, b) => a.price - b.price);
        
        console.log(`\n✅✅✅ TOPLAM ${uniquePasses.length} GAMEPASS ✅✅✅\n`);
        
        res.json({ data: uniquePasses });
        
    } catch (error) {
        console.error("❌ FATAL:", error.message);
        res.json({ error: error.message, data: [] });
    }
});

app.listen(PORT, () => console.log(`🚀 Server: ${PORT}`));
