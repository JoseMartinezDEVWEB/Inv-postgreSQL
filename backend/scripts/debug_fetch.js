const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function testFetch() {
    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    console.log("Testing Gemini v1 with axios...");
    
    try {
        const response = await axios.post(url, {
            contents: [{ parts: [{ text: "Hola" }] }]
        });
        console.log("Response v1:", response.data.candidates[0].content.parts[0].text);
    } catch (e) {
        console.error("Error v1:", e.response?.data || e.message);
        
        const urlBeta = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        console.log("Testing Gemini v1beta with axios...");
        try {
            const responseBeta = await axios.post(urlBeta, {
                contents: [{ parts: [{ text: "Hola" }] }]
            });
            console.log("Response v1beta:", responseBeta.data.candidates[0].content.parts[0].text);
        } catch (e2) {
            console.error("Error v1beta:", e2.response?.data || e2.message);
        }
    }
}

testFetch();
