/**
 * Script de diagnóstico: muestra el texto RAW que extrae pdf-parse
 * Correr desde: backend/
 *   node scripts/debug_pdf_text.js
 */
const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

async function main() {
    const pdfPath = 'C:\\Users\\ASUS\\Desktop\\Andres.pdf';

    if (!fs.existsSync(pdfPath)) {
        console.error('❌ No se encontró:', pdfPath);
        return;
    }

    const buffer = fs.readFileSync(pdfPath);
    const data = await pdf(buffer);

    console.log(`\n=== METADATA ===`);
    console.log(`Páginas: ${data.numpages}`);
    console.log(`Caracteres totales: ${data.text.length}`);

    console.log(`\n=== PRIMEROS 3000 CARACTERES (RAW) ===`);
    console.log(JSON.stringify(data.text.substring(0, 3000)));

    console.log(`\n=== LÍNEAS (primeras 80) ===`);
    const lines = data.text.split('\n');
    lines.slice(0, 80).forEach((line, i) => {
        console.log(`[${String(i).padStart(3,'0')}] "${line}"`);
    });

    console.log(`\n=== TOTAL LÍNEAS: ${lines.length} ===`);

    // Buscar líneas que contengan $ para ver formato real
    console.log(`\n=== LÍNEAS CON $ (primeras 20) ===`);
    const dollarLines = lines.filter(l => l.includes('$'));
    dollarLines.slice(0, 20).forEach((line, i) => {
        console.log(`[${i}] "${line.trim()}"`);
    });
}

main().catch(console.error);
