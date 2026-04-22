const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { processFile } = require('../utils/importProcessor');

async function test() {
    console.log('--- TEST IMPORT ANDRES.PDF ---');
    const pdfPath = 'c:\\Users\\ASUS\\Desktop\\andres.pdf';
    
    if (!fs.existsSync(pdfPath)) {
        console.error('El archivo andres.pdf no existe en el escritorio.');
        return;
    }

    const buffer = fs.readFileSync(pdfPath);
    const fileName = 'andres.pdf';
    const apiKey = process.env.GEMINI_API_KEY;

    console.log('ApiKey detectada:', apiKey ? 'Sí (longitud: ' + apiKey.length + ')' : 'No');
    
    try {
        console.log('Procesando archivo...');
        const productos = await processFile(buffer, fileName, apiKey);
        console.log('RESULTADO EXITOSO!');
        console.log('Productos encontrados:', productos.length);
        console.log('Primeros 2 productos:', JSON.stringify(productos.slice(0, 2), null, 2));
    } catch (e) {
        console.error('ERROR EN IMPORTACIÓN:', e.message);
        if (e.stack) console.error(e.stack);
    }
}

test();
