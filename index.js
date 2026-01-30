const express = require('express');
const axios = require('axios');
const app = express();

const PORT = process.env.PORT || 3000;

// Roblox Bot Korumasını Aşmak İçin User-Agent Şart
const axiosConfig = {
    validateStatus: function (status) { return status >= 200 && status < 500; },
    headers: { 'User-Agent': 'Roblox/WinInet' }
};

app.get('/', (req, res) => res.send('API HAZIR (FALLBACK MODE)'));

app.get('/gamepasses/:userId', async (req, res) => {
    const userId = parseInt(req.params.userId);
    console.log(`\n>>> SORGULANIYOR: ${userId}`);
    let passes = [];

    try {
        // --- 1. PLAN: INVENTORY API (Öncelikli) ---
        // Burası "Everyone" gizlilik ayarı olanlarda çalışır.
        const invUrl = `https://inventory.roproxy.com/v2/users/${userId}/inventory?assetTypes=GamePass&limit=100&sortOrder=Asc`;
        console.log("   [1] Inventory API deneniyor...");
        
        const invRes = await axios.get(invUrl, axiosConfig);
        passes = invRes.data?.data || [];

        // --- 2. PLAN: CREATED ITEMS API (Fallback / Yedek) ---
        // Eğer Inventory boş döndüyse (0), hemen B Planına geçiyoruz.
        if (passes.length === 0) {
            console.log("   ⚠️ Inventory boş veya gizli. Fallback (Created Items) devreye giriyor...");
            
            // Bu endpoint, envanter gizli olsa bile kullanıcının OLUŞTURDUĞU şeyleri bulabilir.
            const createdUrl = `https://users.roproxy.com/v1/users/${userId}/created-items/GamePass?limit=100&sortOrder=Asc`;
            const createdRes = await axios.get(createdUrl, axiosConfig);
            
            passes = createdRes.data?.data || [];
            console.log(`   [2] Created Items sonuc: ${passes.length} adet.`);
        } else {
            console.log(`   [1] Inventory başarılı: ${passes.length} adet.`);
        }

        // --- 3. FORMATLAMA (Roblox'un Anlayacağı Hale Getir) ---
        const result = passes
            .filter(p => p.price && p.price > 0) // Sadece fiyatı olanlar
            .map(p => ({
                // Inventory API "assetId" verir, Created API "id" verir.
                // Bu kod ikisini de yakalar.
                id: p.assetId || p.id, 
                price: p.price
            }));

        console.log("FINAL PASS COUNT:", result.length);
        
        // Yazılımcının istediği temiz format
        res.json({ data: result });

    } catch (e) {
        console.error("❌ ERROR:", e.message);
        // Hata durumunda boş dön, Roblox çökmesin
        res.json({ data: [] });
    }
});

app.listen(PORT, () => console.log(`Server: ${PORT}`));
