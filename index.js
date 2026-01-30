const express = require('express');
const axios = require('axios');
const app = express();

const PORT = process.env.PORT || 3000;

// Axios ayarları
const axiosConfig = {
    validateStatus: function (status) { return status >= 200 && status < 500; },
    headers: { 'User-Agent': 'Roblox/WinInet' }
};

// FİYAT SORGULAYICI (Economy API)
async function getGamePassPrice(passId) {
    try {
        const url = `https://economy.roproxy.com/v1/game-passes/${passId}/product-info`;
        const r = await axios.get(url, axiosConfig);
        // PriceInRobux varsa ve satışta ise (IsForSale)
        if (r.data && r.data.IsForSale && r.data.PriceInRobux > 0) {
            return r.data.PriceInRobux;
        }
        return 0;
    } catch {
        return 0;
    }
}

app.get('/', (req, res) => res.send('UNIVERSE ASSETS API HAZIR'));

app.get('/gamepasses/:userId', async (req, res) => {
    const userId = parseInt(req.params.userId);
    console.log(`\n>>> SORGULANIYOR: ${userId}`);
    
    let allPasses = [];

    try {
        // --- 1. ADIM: OYUNLARI (UNIVERSE) BUL ---
        // Hem "Public" oyunları hem de "Created" oyunları bulmak için geniş tarama.
        // Public oyunları bulmak kolaydır, ama bazen oyun public olsa bile listede çıkmaz.
        // O yüzden önce "games" endpointini kullanıyoruz.
        
        let universeIds = new Set();
        
        const gamesUrl = `https://games.roproxy.com/v2/users/${userId}/games?accessFilter=Public&limit=50&sortOrder=Asc`;
        const gamesRes = await axios.get(gamesUrl, axiosConfig);
        
        if (gamesRes.data && gamesRes.data.data) {
            gamesRes.data.data.forEach(g => universeIds.add(g.id));
        }
        
        console.log(`   > Bulunan Universe Sayısı: ${universeIds.size}`);

        if (universeIds.size === 0) {
             console.log("   ⚠️ Hiç oyun bulunamadı. GamePass olması imkansız.");
             return res.json({ data: [] });
        }

        // --- 2. ADIM: ASSETS ENDPOINT (KRİTİK NOKTA) ---
        // Her universe için "assets" endpointini kullanacağız.
        const uniArray = Array.from(universeIds);
        
        // Her Universe için tarama başlat
        const universePromises = uniArray.map(async (uniId) => {
            try {
                // YAZILIMCININ İSTEDİĞİ ENDPOINT: games/{id}/assets?assetTypes=GamePass
                const assetsUrl = `https://games.roproxy.com/v1/games/${uniId}/assets?assetTypes=GamePass&limit=100&sortOrder=Asc`;
                const assetsRes = await axios.get(assetsUrl, axiosConfig);
                
                const assets = assetsRes.data?.data || [];
                return assets; // Ham asset listesini dön
            } catch (e) {
                return [];
            }
        });

        const results = await Promise.all(universePromises);
        const rawAssets = results.flat();

        console.log(`   > Toplam Asset Bulundu: ${rawAssets.length} (Filtreleniyor...)`);

        // --- 3. ADIM: FİLTRELEME VE FİYAT KONTROLÜ ---
        // Asset listesinde başkasının passleri olabilir veya fiyatı olmayabilir.
        
        const validPasses = [];
        
        // Assetlerin detaylarını kontrol et (Parallel değil seri yapalım, rate limit yemeyelim veya chunk yapalım)
        // 10'arlı gruplar halinde fiyat soralım
        const chunkArray = (arr, size) => arr.length > size ? [arr.slice(0, size), ...chunkArray(arr.slice(size), size)] : [arr];
        
        for (const chunk of chunkArray(rawAssets, 10)) {
            const pricePromises = chunk.map(async (asset) => {
                // Sadece pass ID'si asset.id dir.
                // Creator kontrolü: Bu pass gerçekten bizim adamın mı?
                // asset.creator alanı bazen null gelebilir, o yüzden dikkat.
                
                // NOT: Asset endpointinde bazen creator bilgisi eksik olabilir.
                // En güvenlisi Price Check yaparken gelen veriden creator kontrolü yapmaktır.
                
                try {
                    const infoUrl = `https://economy.roproxy.com/v1/game-passes/${asset.id}/product-info`;
                    const r = await axios.get(infoUrl, axiosConfig);
                    const info = r.data;

                    if (info && info.PriceInRobux > 0 && info.IsForSale) {
                        // BURASI KRİTİK: Creator kontrolünü burada yapıyoruz (Kesin Bilgi)
                        if (info.Creator.CreatorTargetId === userId) {
                            return {
                                id: asset.id,
                                price: info.PriceInRobux
                            };
                        }
                    }
                } catch (e) {}
                return null;
            });
            
            const chunkResults = await Promise.all(pricePromises);
            chunkResults.forEach(r => {
                if (r) validPasses.push(r);
            });
        }

        // --- SONUÇ ---
        // ID tekrarını önle
        const uniquePasses = [...new Map(validPasses.map(item => [item['id'], item])).values()];
        uniquePasses.sort((a, b) => a.price - b.price);

        console.log("FINAL PASS COUNT:", uniquePasses.length);
        
        res.json({ data: uniquePasses });

    } catch (e) {
        console.error("❌ ERROR:", e.message);
        res.json({ data: [] });
    }
});

app.listen(PORT, () => console.log(`Server: ${PORT}`));
