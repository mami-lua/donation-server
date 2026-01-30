const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

const axiosConfig = {
    validateStatus: (status) => status >= 200 && status < 500,
    headers: { 'User-Agent': 'Roblox/WinInet' },
    timeout: 10000
};

app.get('/', (req, res) => res.send('MARKETPLACE ENGINE V10 READY'));

// 🔥 YÖNTEM 1: Catalog API (Senin kullandığın)
async function method1_CatalogAPI(userId) {
    console.log("   [METHOD 1] Catalog API deneniyor...");
    try {
        const url = `https://catalog.roblox.com/v1/search/items?Category=11&CreatorTargetId=${userId}&CreatorType=User&SalesTypeFilter=1&Limit=120`;
        const r = await axios.get(url, axiosConfig);
        
        if (r.data?.data && r.data.data.length > 0) {
            console.log(`   ✅ METHOD 1 BAŞARILI: ${r.data.data.length} pass bulundu`);
            return r.data.data.map(p => ({ id: p.id, price: p.price || 0 }));
        }
    } catch (e) {
        console.log("   ❌ METHOD 1 BAŞARISIZ:", e.message);
    }
    return null;
}

// 🔥 YÖNTEM 2: Oyunları bul -> Her oyunun GamePass'lerini çek
async function method2_GamesPasses(userId) {
    console.log("   [METHOD 2] Games -> GamePasses deneniyor...");
    try {
        // Önce kullanıcının oyunlarını bul
        const gamesUrl = `https://games.roblox.com/v2/users/${userId}/games?accessFilter=All&limit=50&sortOrder=Desc`;
        const gamesRes = await axios.get(gamesUrl, axiosConfig);
        
        if (!gamesRes.data?.data || gamesRes.data.data.length === 0) {
            console.log("   ⚠️ METHOD 2: Oyun bulunamadı");
            return null;
        }

        console.log(`   🎮 ${gamesRes.data.data.length} oyun bulundu, pass'ler taranıyor...`);
        
        let allPasses = [];
        
        // Her oyun için GamePass'leri çek
        for (const game of gamesRes.data.data) {
            try {
                // UniverseId kullan (rootPlaceId değil!)
                const passUrl = `https://games.roblox.com/v1/games/${game.id}/game-passes?limit=100&sortOrder=Asc`;
                const passRes = await axios.get(passUrl, axiosConfig);
                
                if (passRes.data?.data) {
                    const passes = passRes.data.data
                        .filter(p => p.isForSale) // Sadece satışta olanlar
                        .map(p => ({ id: p.id, price: p.price || 0 }));
                    
                    allPasses.push(...passes);
                    console.log(`      → ${game.name}: ${passes.length} pass`);
                }
            } catch (err) {
                console.log(`      ⚠️ ${game.name} için pass çekilemedi`);
            }
            
            await new Promise(r => setTimeout(r, 100)); // Rate limit için bekleme
        }
        
        if (allPasses.length > 0) {
            console.log(`   ✅ METHOD 2 BAŞARILI: Toplam ${allPasses.length} pass`);
            return allPasses;
        }
        
    } catch (e) {
        console.log("   ❌ METHOD 2 BAŞARISIZ:", e.message);
    }
    return null;
}

// 🔥 YÖNTEM 3: Inventory API (Son şans - bazen çalışır)
async function method3_InventoryAPI(userId) {
    console.log("   [METHOD 3] Inventory API deneniyor...");
    try {
        const url = `https://inventory.roblox.com/v1/users/${userId}/items/GamePass?limit=100&sortOrder=Desc`;
        const r = await axios.get(url, axiosConfig);
        
        if (r.data?.data && r.data.data.length > 0) {
            console.log(`   ✅ METHOD 3 BAŞARILI: ${r.data.data.length} pass bulundu`);
            
            // Bu API'de price bilgisi yok, ayrıca çekmemiz lazım
            const passes = [];
            for (const item of r.data.data.slice(0, 20)) { // İlk 20'sini dene
                try {
                    const infoUrl = `https://apis.roblox.com/game-passes/v1/game-passes/${item.assetId}/product-info`;
                    const infoRes = await axios.get(infoUrl, axiosConfig);
                    
                    if (infoRes.data?.IsForSale && infoRes.data?.PriceInRobux) {
                        passes.push({
                            id: item.assetId,
                            price: infoRes.data.PriceInRobux
                        });
                    }
                } catch (err) {
                    // Sessizce geç
                }
                await new Promise(r => setTimeout(r, 50));
            }
            
            if (passes.length > 0) {
                console.log(`   ✅ METHOD 3 FİYATLAR ÇEKİLDİ: ${passes.length} pass`);
                return passes;
            }
        }
    } catch (e) {
        console.log("   ❌ METHOD 3 BAŞARISIZ:", e.message);
    }
    return null;
}

app.get('/gamepasses/:userId', async (req, res) => {
    const userId = Number(req.params.userId);
    console.log(`\n>>> MARKETPLACE TARAMASI: ${userId}`);
    
    if (!userId || userId < 1) {
        return res.json({ error: "Invalid userId", data: [] });
    }
    
    try {
        // SIRASIYLA DENEYELİM
        let passes = await method1_CatalogAPI(userId);
        
        if (!passes || passes.length === 0) {
            passes = await method2_GamesPasses(userId);
        }
        
        if (!passes || passes.length === 0) {
            passes = await method3_InventoryAPI(userId);
        }
        
        if (!passes || passes.length === 0) {
            console.log("❌ HİÇBİR YÖNTEM ÇALIŞMADI - 0 PASS");
            return res.json({ data: [] });
        }
        
        // Fiyata göre sırala
        passes.sort((a, b) => a.price - b.price);
        
        console.log(`✅ SONUÇ: ${passes.length} GamePass bulundu`);
        console.log("İlk 3 pass:", passes.slice(0, 3));
        
        res.json({ data: passes });
        
    } catch (e) {
        console.error("❌ GENEL HATA:", e.message);
        res.json({ error: e.message, data: [] });
    }
});

app.listen(PORT, () => console.log(`🚀 Server Online: Port ${PORT}`));
