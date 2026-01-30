const express = require('express');
const axios = require('axios');
const app = express();

const PORT = process.env.PORT || 3000;

// Axios ayarları: Hata alsa bile sunucuyu çökertme
const axiosConfig = {
    validateStatus: function (status) {
        return status >= 200 && status < 500; // Sadece 500+ hatalarda patla
    },
    headers: {
        'User-Agent': 'Roblox/WinInet' // Roblox tarayıcısı gibi davran
    }
};

app.get('/', (req, res) => {
    res.send('Hybrid Scanner API Calisiyor v3!');
});

app.get('/gamepasses/:userId', async (req, res) => {
    const userId = req.params.userId;
    console.log(`\n>>> TARAMA BAŞLADI: ${userId}`);
    let allPasses = [];

    try {
        // --- YÖNTEM 1: KATALOG TARAMASI (En Temiz Yöntem) ---
        console.log("   [1/2] Katalog taranıyor...");
        const catalogUrl = `https://catalog.roproxy.com/v1/search/items?category=GamePass&creatorTargetId=${userId}&creatorType=User&limit=100&sortOrder=Asc`;
        
        const catResponse = await axios.get(catalogUrl, axiosConfig);
        
        if (catResponse.data && catResponse.data.data) {
            const catPasses = catResponse.data.data;
            console.log(`      > Katalogdan ${catPasses.length} sonuç geldi.`);
            
            catPasses.forEach(p => {
                if (p.price && p.price > 0) {
                    allPasses.push({ id: p.id, price: p.price, name: p.name });
                }
            });
        }

        // --- YÖNTEM 2: OYUN İÇİ TARAMA (Yedek Yöntem) ---
        // Eğer katalogdan veri gelmediyse veya az geldiyse oyunlara da bak.
        console.log("   [2/2] Public Oyunlar taranıyor...");
        const gamesUrl = `https://games.roproxy.com/v2/users/${userId}/games?accessFilter=Public&limit=50&sortOrder=Asc`;
        const gamesResponse = await axios.get(gamesUrl, axiosConfig);
        
        if (gamesResponse.data && gamesResponse.data.data) {
            const games = gamesResponse.data.data;
            console.log(`      > ${games.length} adet oyun bulundu.`);

            const gamePromises = games.map(async (game) => {
                const passUrl = `https://games.roproxy.com/v1/games/${game.id}/gamepasses?limit=100&sortOrder=Asc`;
                const passRes = await axios.get(passUrl, axiosConfig);
                if (passRes.data && passRes.data.data) {
                    return passRes.data.data.filter(p => p.price > 0).map(p => ({
                        id: p.id, price: p.price, name: p.name
                    }));
                }
                return [];
            });

            const gameResults = await Promise.all(gamePromises);
            const gamePasses = gameResults.flat();
            console.log(`      > Oyunlardan ${gamePasses.length} pass bulundu.`);
            
            // Bulunanları ana listeye ekle
            allPasses = allPasses.concat(gamePasses);
        }

        // --- TEMİZLİK VE FİNAL ---
        
        // Çift kayıtları temizle (Hem katalogda hem oyunda bulmuş olabilir)
        const uniquePasses = [];
        const map = new Map();
        for (const item of allPasses) {
            if(!map.has(item.id)){
                map.set(item.id, true);
                uniquePasses.push(item);
            }
        }

        // Sırala
        uniquePasses.sort((a, b) => a.price - b.price);

        console.log(`✅ SONUÇ: Toplam ${uniquePasses.length} eşsiz gamepass gönderiliyor.`);
        
        res.json({
            success: true,
            data: uniquePasses
        });

    } catch (error) {
        console.error("❌ BEKLENMEYEN HATA:", error.message);
        // Hata olsa bile JSON dön ki Roblox Lua scripti HTTP 500 yemesin
        res.json({
            success: false,
            data: [], // Boş liste dön, oyun çökmesin
            error: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server baslatildi! Port: ${PORT}`);
});
