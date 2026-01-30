const express = require('express');
const axios = require('axios');
const app = express();

const PORT = process.env.PORT || 3000;

const axiosConfig = {
    validateStatus: (status) => status >= 200 && status < 500,
    headers: { 'User-Agent': 'Roblox/WinInet' }
};

// ECONOMY CHECKER (Fiyat ve Sahiplik Doğrulama)
async function getValidatedPass(passId, targetUserId) {
    try {
        const url = `https://economy.roproxy.com/v1/game-passes/${passId}/product-info`;
        const r = await axios.get(url, axiosConfig);
        const info = r.data;

        if (info && info.IsForSale && info.PriceInRobux > 0) {
            // Sahiplik Kontrolü: Kullanıcı mı yoksa Grup mu?
            const isOwner = info.Creator.CreatorTargetId === targetUserId;
            const isGroup = info.Creator.CreatorType === "Group"; // Grup pass'lerini de kabul ediyoruz

            if (isOwner || isGroup) {
                return { id: passId, price: info.PriceInRobux };
            }
        }
        return null;
    } catch { return null; }
}

app.get('/', (req, res) => res.send('CREATOR SCAN API V8 READY'));

app.get('/gamepasses/:userId', async (req, res) => {
    const userId = parseInt(req.params.userId);
    console.log(`\n>>> DERIN SORGULAMA: ${userId}`);
    
    try {
        // 1. ADIM: KULLANICININ OLUŞTURDUĞU TÜM GAMEPASSLERİ ÇEK
        // Bu endpoint envanter gizli olsa bile çalışır (Created Items != Inventory)
        const createdUrl = `https://users.roproxy.com/v1/users/${userId}/created-items/GamePass?limit=100`;
        const createdRes = await axios.get(createdUrl, axiosConfig);
        
        const rawItems = createdRes.data?.data || [];
        console.log(`   > Bulunan Ham Eşya: ${rawItems.length}`);

        if (rawItems.length === 0) {
            console.log("FINAL PASS COUNT: 0 (No Created Items)");
            return res.json({ data: [] });
        }

        // 2. ADIM: HER BİRİ İÇİN EKONOMİ DOĞRULAMASI (Price Check)
        // 10'arlı gruplar halinde sorgulayarak rate-limit'i engelliyoruz
        let validatedPasses = [];
        const chunkArray = (arr, size) => arr.length > size ? [arr.slice(0, size), ...chunkArray(arr.slice(size), size)] : [arr];
        
        for (const chunk of chunkArray(rawItems, 10)) {
            const promises = chunk.map(item => getValidatedPass(item.id, userId));
            const results = await Promise.all(promises);
            results.forEach(res => { if (res) validatedPasses.push(res); });
        }

        // 3. ADIM: SIRALAMA VE ÇIKTI
        validatedPasses.sort((a, b) => a.price - b.price);
        
        console.log("FINAL PASS COUNT:", validatedPasses.length);
        res.json({ data: validatedPasses });

    } catch (error) {
        console.error("❌ API ERROR:", error.message);
        res.json({ data: [] });
    }
});

app.listen(PORT, () => console.log(`Server Online`));
