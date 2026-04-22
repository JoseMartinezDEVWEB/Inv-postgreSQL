/**
 * Script de prueba para validar la lógica de procesamiento de Gemini
 * sin necesidad de subir archivos reales.
 */
const { processFile } = require('../utils/importProcessor');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function testGeminiParsing() {
    console.log('--- TEST DE PROCESAMIENTO GEMINI ---');
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
        console.error('❌ Error: GEMINI_API_KEY no encontrada en .env');
        return;
    }

    // Simulamos texto extraído de un PDF falso
    const fakePDFText = `
    INVENTARIO GENERAL DE TIENDA
    FECHA: 10/10/2026
    
    Producto: Jabón Líquido Dove 500ml
    Código: 7501001122334
    Precio: 150.00
    Categoría: Cuidado Personal
    Unidad: Botella
    
    Producto: Detergente Ariel Power 1kg
    SKU: ARIEL-001
    Precio: 320.50
    Envase: Bolsa
    `;

    // Mock buffer
    const mockBuffer = Buffer.from(fakePDFText);
    const mockFileName = 'inventario_test.pdf';

    console.log('Enviando texto simulado a Gemini Flash 1.5...');
    
    try {
        // Nota: en el entorno real processFile usa pdf-parse. 
        // Aquí mockearemos la respuesta si pdf-parse fallara en el entorno de pruebas,
        // pero vamos a intentar correrlo real.
        const productos = await processFile(mockBuffer, mockFileName, apiKey);
        
        console.log('✅ PROCESAMIENTO EXITOSO');
        console.log('Productos extraídos:', JSON.stringify(productos, null, 2));
        
        if (productos.length > 0) {
            console.log('✨ Test superado: Se extrajeron', productos.length, 'productos.');
        } else {
            console.warn('⚠️ Advertencia: No se extrajeron productos pero no hubo error.');
        }
    } catch (error) {
        console.error('❌ ERROR EN EL TEST:', error.message);
        if (error.stack) console.error(error.stack);
    }
}

testGeminiParsing();
