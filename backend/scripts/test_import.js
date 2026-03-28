const fs = require('fs');
const path = require('path');
const { processFile } = require('../utils/importProcessor');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function runTest() {
    console.log("🚀 Iniciando prueba de importación...");

    const files = [
        'C:/Users/ASUS/Desktop/convertidor/Parte_1_Productos.xlsx',
        'C:/Users/ASUS/Desktop/convertidor/Parte_1_Productos.pdf'
    ];

    const apiKey = process.env.GEMINI_API_KEY;

    for (const filePath of files) {
        console.log(`\n📄 Probando con: ${path.basename(filePath)}`);
        
        try {
            if (!fs.existsSync(filePath)) {
                console.error(`❌ Archivo no encontrado: ${filePath}`);
                continue;
            }

            const buffer = fs.readFileSync(filePath);
            const productos = await processFile(buffer, path.basename(filePath), apiKey);

            console.log(`✅ Éxito: Se encontraron ${productos.length} productos.`);
            console.log("Muestra (primeros 2):");
            console.log(JSON.stringify(productos.slice(0, 2), null, 2));

        } catch (error) {
            console.error(`❌ Error procesando ${path.basename(filePath)}:`, error.message);
        }
    }
}

runTest();
