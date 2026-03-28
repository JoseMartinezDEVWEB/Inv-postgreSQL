const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function listModels() {
    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    
    console.log("Listing models...");
    
    try {
        const response = await axios.get(url);
        console.log("Models found:");
        response.data.models.forEach(m => console.log(`- ${m.name}`));
    } catch (e) {
        console.error("Error listing models:", e.response?.data || e.message);
    }
}

listModels();
