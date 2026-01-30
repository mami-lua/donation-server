const express = require('express');
const axios = require('axios');
const app = express();

const PORT = process.env.PORT || 3000;

// Axios ayarları (Korumalı)
const axiosConfig = {
    validateStatus: function (status) { return status >= 200 && status < 500; },
    headers: { 'User-Agent': 'Roblox/WinInet' }
};

app.get('/', (req, res) => res.send('INVENTORY API CALISIYOR'));

app.get('/gamepasses/:userId', async (req, res) => {
    // ID'yi sayıya çevir
    const userId = parseInt(req.params.userId);
    console.log(`\n>>> SORGULANIYOR: ${userId}`);

    try {
        // 🔥 YAZILIMCININ VERDİĞİ TEK DOĞRU ENDPOINT
        // Bu endpoint direkt kullanıcının envanterindeki GamePass'leri döner.
        // Universe, Place vs. hiçbiriyle uğraşmaz.
        const url = `https://inventory.roproxy.com/v2/users/${userId}/inventory?assetTypes=GamePass&limit=100&sortOrder=Asc`;
        
        const r = await axios.get(url, axiosConfig);

        // Gelen veriyi işle
        const passes = (r.data?.data || [])
            .filter(p => {
                // Sadece fiyatı olanları al (Satışta olanlar)
                return p.price && p.price > 0;
            })
            .map(p => ({
                // DİKKAT: Inventory API'sinde gamepass ID'si "assetId" olarak gelir.
                id: p.assetId,
                price: p.price
            }));

        console.log("FINAL PASS COUNT:", passes.length);
        
        // Yazılımcının istediği standart format: { data: [...] }
        res.json({ data: passes });

    } catch (e) {
        console.error("ERROR:", e.message);
        // Hata olsa bile boş liste dön, Lua çökmesin
        res.json({ data: [] });
    }
});

app.listen(PORT, () => console.log(`Server: ${PORT}`));
