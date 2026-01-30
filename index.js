const express = require('express');
const axios = require('axios');
const app = express();

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Donation API Calisiyor! /gamepasses/:userId ile kullan.');
});

app.get('/gamepasses/:userId', async (req, res) => {
    const userId = req.params.userId;
    console.log(`İstek geldi: ${userId}`);

    try {
        const url = `https://catalog.roproxy.com/v1/search/items?category=GamePass&creatorTargetId=${userId}&creatorType=User&limit=100&sortOrder=Asc`;
        
        // Render bazen RoProxy'ye bağlanırken timeout yiyebilir, user-agent ekleyelim
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'RobloxGameServer/1.0' }
        });
        
        const rawData = response.data.data || [];
        const cleanData = rawData
            .filter(item => item.price && item.price > 0)
            .map(item => ({
                id: item.id,
                price: item.price,
                name: item.name
            }))
            .sort((a, b) => a.price - b.price);

        res.json({ success: true, data: cleanData });

    } catch (error) {
        console.error("Hata:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server baslatildi! Port: ${PORT}`);
});