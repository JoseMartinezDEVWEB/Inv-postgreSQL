/**
 * Test: analiza Andres.pdf y Andres 1.pdf del escritorio
 * Ejecutar desde backend/: node scripts/test_pdfs.js
 */
const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const { processFile } = require('../utils/importProcessor');

const ESCRITORIO = 'C:\\Users\\ASUS\\Desktop';

async function analizarPDF(archivo) {
    const ruta = path.join(ESCRITORIO, archivo);
    if (!fs.existsSync(ruta)) {
        console.log(`\n❌ No encontrado: ${ruta}`);
        return;
    }

    const buffer = fs.readFileSync(ruta);
    const data = await pdf(buffer);
    const text = data.text;
    const lines = text.split('\n').filter(l => l.trim());

    console.log(`\n${'='.repeat(60)}`);
    console.log(`ARCHIVO: ${archivo}`);
    console.log(`Páginas: ${data.numpages} | Chars: ${text.length} | Líneas: ${lines.length}`);
    console.log('─'.repeat(60));

    // Detectar tipo
    const esInventario   = /ARTICULOUNIDAD/i.test(text);
    const esBalance      = /BALANCE GENERAL/i.test(text);
    const esDistribucion = /DISTRIBUCION DE SALDO/i.test(text);

    if (esInventario)   console.log('>>> TIPO DETECTADO: INVENTARIO DE PRODUCTOS');
    if (esBalance)      console.log('>>> TIPO DETECTADO: BALANCE GENERAL');
    if (esDistribucion) console.log('>>> TIPO DETECTADO: DISTRIBUCION DE SALDO');
    if (!esInventario && !esBalance && !esDistribucion) console.log('>>> TIPO: NO RECONOCIDO');

    const maxLineas = lines.length <= 120 ? lines.length : 25;
    console.log(`\nMostrando ${maxLineas} de ${lines.length} líneas:`);
    lines.slice(0, maxLineas).forEach((l, i) => {
        console.log(`[${String(i).padStart(3,'0')}] ${JSON.stringify(l.trim())}`);
    });

    // Si tiene productos, contar cuántos extrae el parser
    if (esInventario) {
        console.log('\n--- Probando parser de productos ---');
        try {
            const result = await processFile(buffer, archivo, null, 'productos');
            console.log(`Productos extraídos: ${result.productos.length}`);
            if (result.productos.length > 0) {
                console.log('Primeros 5 productos:');
                result.productos.slice(0, 5).forEach(p =>
                    console.log(`  ${p.nombre} | cant=${p.cantidadContada} | costo=${p.costoBase} | total=${p.valorTotal}`)
                );
                const ultimo = result.productos[result.productos.length - 1];
                console.log(`Último producto: ${ultimo.nombre}`);
            }
        } catch (e) {
            console.log('Error en parser productos:', e.message);
        }
    }

    // Si tiene balance
    if (esBalance) {
        console.log('\n--- Probando parser de balance ---');
        try {
            const result = await processFile(buffer, archivo, null, 'balance');
            if (result.balance) {
                console.log('Balance extraído:', JSON.stringify(result.balance, null, 2));
            } else {
                console.log('Balance: null (no se extrajo nada)');
                // Buscar líneas con $ para ver el formato real
                const dollarLines = lines.filter(l => l.includes('$') || /\d{1,3}(,\d{3})+\.\d{2}/.test(l));
                console.log('\nLíneas con $ o montos (primeras 20):');
                dollarLines.slice(0, 20).forEach(l => console.log('  ', JSON.stringify(l.trim())));
            }
        } catch (e) {
            console.log('Error en parser balance:', e.message);
        }
    }

    // Si tiene distribución
    if (esDistribucion) {
        console.log('\n--- Probando parser de distribución ---');
        try {
            const result = await processFile(buffer, archivo, null, 'distribucion');
            if (result.distribucion) {
                console.log('Distribución extraída:', JSON.stringify(result.distribucion, null, 2));
            } else {
                console.log('Distribución: null (no se extrajo nada)');
            }
        } catch (e) {
            console.log('Error en parser distribución:', e.message);
        }
    }
}

async function main() {
    await analizarPDF('Andres.pdf');
    await analizarPDF('Andres 1.pdf');
}

main().catch(console.error);
