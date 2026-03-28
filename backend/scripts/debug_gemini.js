const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function listModels() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("No API key found");
        return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    try {
        // Unfortunately the Node SDK doesn't have a direct listModels yet in all versions
        // But we can try to use a model and see if it works, or use fetch
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("Hola");
        console.log("Gemini 1.5 Flash test ok:", result.response.text());
    } catch (e) {
        console.error("Error with gemini-1.5-flash:", e.message);
        
        try {
            const modelPro = genAI.getGenerativeModel({ model: "gemini-pro" });
            const resultPro = await modelPro.generateContent("Hola");
            console.log("Gemini Pro test ok:", resultPro.response.text());
        } catch (e2) {
            console.error("Error with gemini-pro:", e2.message);
        }
    }
}

listModels();
