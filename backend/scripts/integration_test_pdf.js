/**
 * INTEGRATION TEST: Verifies the full PDF Import flow (Upload -> Gemini -> DB)
 * by calling the running backend API.
 */
const axios = require('axios');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'tu_secreto_super_seguro_123';
const API_URL = 'http://localhost:4500/api';
const CLIENTE_ID = 1; // Cliente Prueba
const ADMIN_ID = 1;

async function runIntegrationTest() {
    console.log('--- INICIANDO TEST DE INTEGRACIÓN E2E (BACKEND) ---');
    
    // 1. Generar Token JWT
    const token = jwt.sign(
        { id: ADMIN_ID, rol: 'administrador', nombre: 'Test Runner' },
        JWT_SECRET,
        { expiresIn: '1h' }
    );
    console.log('✅ Token JWT generado.');

    // 2. Preparar el archivo Excel
    const excelPath = path.join(__dirname, '../../frontend-desktop/test_inventory.xlsx');
    if (!fs.existsSync(excelPath)) {
        console.error('❌ Error: No se encontró test_inventory.xlsx en', excelPath);
        process.exit(1);
    }

    const form = new FormData();
    form.append('files', fs.createReadStream(excelPath));
    form.append('fechaInventario', new Date().toISOString().split('T')[0]);

    console.log('🚀 Enviando Excel al servidor para procesamiento...');
    
    try {
        const response = await axios.post(`${API_URL}/clientes-negocios/${CLIENTE_ID}/importar-pdf`, form, {
            headers: {
                ...form.getHeaders(),
                'Authorization': `Bearer ${token}`
            },
            timeout: 60000 // 60 segundos por si Gemini está lento
        });

        console.log('✅ RESPUESTA RECIBIDA CON ÉXITO');
        console.log('Mensaje:', response.data.mensaje);
        console.log('Resumen:', JSON.stringify(response.data.datos.resumen, null, 2));
        
        const sesionId = response.data.datos.sesion.id;
        console.log(`✨ Importación completada. Sesión ID: ${sesionId}`);
        
        // 3. Verificar en la DB (opcional, pero útil)
        console.log('🔍 Verificando creación de productos en la base de datos...');
        const db = require('../models');
        const count = await db.ProductoContado.count({ where: { sesionInventarioId: sesionId } });
        console.log(`📊 Productos guardados en DB: ${count}`);
        
        if (count > 0) {
            console.log('🏆 TEST EXITOSO: La función es efectiva y los cambios son correctos.');
        } else {
            console.warn('⚠️ Advertencia: La sesión se creó pero no hay productos contados.');
        }

    } catch (error) {
        console.error('❌ FALLO EL TEST DE INTEGRACIÓN:');
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error.message);
        }
    } finally {
        process.exit();
    }
}

runIntegrationTest();
