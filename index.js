const express = require('express');
const axios = require('axios');
const app = express();

const PORT = process.env.PORT || 3000;

// Axios ayarları
const axiosConfig = {
    validateStatus: function (status) { return status >= 200 && status < 500; },
    headers: { 'User-Agent': 'Roblox/WinInet' }
};

// YARDIMCI FONKSİYON: Fiyat Sorgulayıcı
// Pls Donate mantığı: ID ver, Fiyat al.
async function getGamePassPrice(passId) {
    try {
        const url = `https://economy.roproxy.com/v1/game-passes/${passId}/product-info`;
        const r = await axios.get(url, axiosConfig);
        // PriceInRobux varsa döndür, yoksa 0
        return r.data?.PriceInRobux || 0;
    } catch {
        return 0; // Hata varsa (silinmiş vs.) 0 dön
    }
}

app.get('/', (req, res) => res.send('PRICE CHECKER API V6 HAZIR'));

app.get('/gamepasses/:userId', async (req, res) => {
    const userId = parseInt(req.params.userId);
    console.log(`\n>>> SORGULANIYOR: ${userId}`);
    
    let finalPasses = [];

    try {
        // --- 1. PLAN: INVENTORY API (Hızlı Yöntem) ---
        // Burası fiyatı direkt verir, ekstra sorguya gerek kalmaz.
        const invUrl = `https://inventory.roproxy.com/v2/users/${userId}/inventory?assetTypes=GamePass&limit=100&sortOrder=Asc`;
        const invRes = await axios.get(invUrl, axiosConfig);
        
        let rawPasses = invRes.data?.data || [];
        
        // Eğer Inventory'den veri geldiyse, formatlayıp kullanalım
        if (rawPasses.length > 0) {
            console.log(`   [1] Inventory API'den ${rawPasses.length} pass geldi.`);
            finalPasses = rawPasses
                .filter(p => p.price && p.price > 0)
                .map(p => ({
                    id: p.assetId, // Inventory API "assetId" kullanır
                    price: p.price
                }));
        }

        // --- 2. PLAN: FALLBACK (Created Items + Price Check) ---
        // Eğer Inventory boşsa (gizliyse), buraya gir.
        if (finalPasses.length === 0) {
            console.log("   ⚠️ Inventory boş veya gizli. Fallback (Created Items) + Fiyat Sorgulama başlıyor...");
            
            const createdUrl = `https://users.roproxy.com/v1/users/${userId}/created-items/GamePass?limit=100&sortOrder=Asc`;
            const createdRes = await axios.get(createdUrl, axiosConfig);
            const createdItems = createdRes.data?.data || [];
            
            console.log(`   > Bulunan Ham Pass Sayısı: ${createdItems.length} (Fiyatları kontrol ediliyor...)`);

            // Tek tek fiyatlarını sor (Paralel yapıyoruz, hızlı olsun)
            const pricePromises = createdItems.map(async (item) => {
                const price = await getGamePassPrice(item.id);
                if (price > 0) {
                    return { id: item.id, price: price };
                }
                return null; // Fiyatı yoksa veya satışta değilse null
            });

            // Hepsini bekle
            const checkedPasses = await Promise.all(pricePromises);
            
            // Null olanları temizle
            finalPasses = checkedPasses.filter(p => p !== null);
        }

        // --- SONUÇ ---
        // Sırala
        finalPasses.sort((a, b) => a.price - b.price);

        console.log("FINAL PASS COUNT:", finalPasses.length);
        
        res.json({ data: finalPasses });

    } catch (e) {
        console.error("❌ ERROR:", e.message);
        res.json({ data: [] });
    }
});

app.listen(PORT, () => console.log(`Server: ${PORT}`));
