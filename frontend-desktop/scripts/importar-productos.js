
import fs from 'fs';
import path from 'path';
import { read, utils } from 'xlsx';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import { fileURLToPath } from 'url';

// Polyfills y configuración
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_URL = 'http://localhost:4000/api'; // Ajustar puerto si es necesario

async function main() {
    const args = process.argv.slice(2);

    if (args.length < 3) {
        console.log(`
      Uso: node scripts/importar-productos.js <archivo_excel_pdf> <email> <password> [api_key_gemini]
      
      Ejemplo:
      node scripts/importar-productos.js "C:/ruta/archivo.xlsx" admin@test.com 123456 AIz...
    `);
        process.exit(1);
    }

    const [filePath, email, password, apiKey] = args;

    if (!fs.existsSync(filePath)) {
        console.error(`Error: El archivo ${filePath} no existe.`);
        process.exit(1);
    }

    try {
        // 1. Login
        console.log('Autenticando...');
        const authRes = await axios.post(`${API_URL}/auth/login`, { email, password });
        const token = authRes.data.body.accessToken;
        console.log('Login exitoso.');

        // 2. Leer archivo
        console.log('Leyendo archivo...');
        const fileBuffer = fs.readFileSync(filePath);
        const ext = path.extname(filePath).toLowerCase();

        let products = [];
        let rawData = null;

        if (ext === '.xlsx' || ext === '.xls') {
            const workbook = read(fileBuffer, { type: 'buffer' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            rawData = utils.sheet_to_json(sheet, { header: 1 });
        } else if (ext === '.pdf') {
            console.error("La importación de PDF desde terminal requiere librerías adicionales no incluidas en este script simple.");
            console.error("Por favor usa la interfaz gráfica para PDFs o convierte a Excel.");
            process.exit(1);
        } else {
            console.error("Formato no soportado.");
            process.exit(1);
        }

        // 3. Procesar
        if (apiKey) {
            console.log('Procesando con IA (Gemini)...');
            products = await processWithAI(rawData, apiKey);
        } else {
            console.log('Procesando modo simple (Mapeo automático)...');
            // Intento de mapeo "bobo"
            if (Array.isArray(rawData)) {
                // Asumimos fila 0 = headers
                const headers = rawData[0].map(h => String(h).toLowerCase());
                const nameIdx = headers.findIndex(h => h.includes('nombre') || h.includes('producto'));
                const costIdx = headers.findIndex(h => h.includes('costo') || h.includes('precio'));
                const codeIdx = headers.findIndex(h => h.includes('codigo') || h.includes('ean'));

                if (nameIdx === -1) {
                    throw new Error("No se pudo identificar la columna 'Nombre' automáticamente. Usa la API Key para IA.");
                }

                products = rawData.slice(1).map(row => ({
                    nombre: row[nameIdx],
                    costoBase: costIdx > -1 ? parseFloat(String(row[costIdx]).replace(/[^0-9.]/g, '')) || 0 : 0,
                    codigoBarras: codeIdx > -1 ? row[codeIdx] : null,
                    categoria: 'Productos Generales'
                })).filter(p => p.nombre);
            }
        }

        console.log(`Se encontraron ${products.length} productos. Subiendo...`);

        // 4. Subir
        let success = 0;
        let fails = 0;

        for (const p of products) {
            try {
                await axios.post(`${API_URL}/productos-generales`, p, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                success++;
                process.stdout.write('.');
            } catch (e) {
                fails++;
                // console.error(`Fallo al subir ${p.nombre}:`, e.message);
            }
        }

        console.log(`\n\nProceso finalizado.`);
        console.log(`Importados: ${success}`);
        console.log(`Fallidos: ${fails}`);

    } catch (error) {
        console.error("\nError Fatal:", error.message);
        if (error.response) {
            console.error("Detalle Servidor:", error.response.data);
        }
    }
}

// Reutilizamos la logica de IA si se provee key
async function processWithAI(rawData, apiKey) {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Sample
    const sample = rawData.slice(0, 15);

    const prompt = `
        Analiza esta muestra de Excel JSON array:
        ${JSON.stringify(sample)}
        
        Devuelve un JSON array con los productos extraídos (mapeando columnas correctamente).
        Campos: nombre, costoBase, codigoBarras, categoria="Productos Generales".
        
        Si no puedes extraer, devuelve array vacío.
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonString);
}


main();
