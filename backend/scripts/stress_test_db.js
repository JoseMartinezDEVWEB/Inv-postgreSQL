/**
 * STRESS TEST - Prueba de Estrés en Base de Datos (Concurrencia)
 * ---------------------------------------------------------------
 * Simula decenas de colaboradores enviando productos simultáneamente
 * para detectar Deadlocks, SequelizeTimeoutError y fugas de conexión.
 * 
 * USO: node backend/scripts/stress_test_db.js
 */
const axios = require('axios');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const JWT_SECRET = process.env.JWT_SECRET;
const API_URL = 'http://localhost:4500/api';
const CLIENTE_ID_PRUEBA = 1;
const SESION_ID_PRUEBA = null; // null = crear nuevas sesiones

// =============================================
// CONFIGURACIÓN DEL TEST
// =============================================
const CONFIG = {
    totalRequests: 50,      // Número total de peticiones concurrentes
    productsPorRequest: 10, // Productos por petición
    timeout: 30000          // Timeout de 30s por petición
};

// =============================================
// GENERADOR DE DATOS DE PRUEBA
// =============================================
function generarPayloadSincronizacion(indice) {
    const timestamp = Date.now();
    const sesionId = `ses-stress-${indice}-${timestamp}`;
    const productos = [];
    
    for (let i = 0; i < CONFIG.productsPorRequest; i++) {
        productos.push({
            _id: `prod-${indice}-${i}-${timestamp}`,
            nombre: `Producto Estrés ${indice}-${i}`,
            descripcion: 'Generado por stress test',
            costo: Math.random() * 1000,
            unidad: 'unidad',
            sku: `SKU-STRESS-${indice}-${i}`
        });
    }

    return {
        clientes: [{
            _id: `cliente-stress-${indice}`,
            nombre: `Cliente Stress ${indice}`
        }],
        sesiones: [{
            _id: sesionId,
            numeroSesion: `STRESS-${indice}-${timestamp}`,
            clienteNegocioId: `cliente-stress-${indice}`,
            estado: 'completada',
            fecha: new Date().toISOString()
        }],
        productos: productos,
        productos_contados: productos.map(p => ({
            sesionId: sesionId,
            productoId: p._id,
            nombreProducto: p.nombre,
            skuProducto: p.sku,
            cantidad: Math.floor(Math.random() * 50) + 1,
            costo: p.costo
        }))
    };
}

// =============================================
// EJECUTOR DEL TEST
// =============================================
async function runStressTest() {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║   STRESS TEST - Base de Datos PostgreSQL + Sequelize  ║');
    console.log('╚═══════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`📋 Configuración:`);
    console.log(`   Peticiones concurrentes : ${CONFIG.totalRequests}`);
    console.log(`   Productos por petición  : ${CONFIG.productsPorRequest}`);
    console.log(`   Total de operaciones DB : ~${CONFIG.totalRequests * CONFIG.productsPorRequest * 4}`);
    console.log(`   Endpoint               : ${API_URL}/sincronizar`);
    console.log('');

    // 1. Verificar conexión al servidor
    try {
        await axios.get(`${API_URL}/salud`, { timeout: 3000 });
        console.log('✅ Servidor disponible en puerto 4500.');
    } catch (_) {
        console.error('❌ No se puede conectar al servidor. Asegúrate de que esté corriendo.');
        process.exit(1);
    }

    // 2. Generar token JWT de administrador
    const token = jwt.sign(
        { id: 1, rol: 'administrador', nombre: 'Stress Tester' },
        JWT_SECRET,
        { expiresIn: '1h' }
    );
    console.log('✅ Token JWT generado.\n');

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    // 3. Lanzar TODAS las peticiones concurrentemente
    console.log(`🚀 Lanzando ${CONFIG.totalRequests} peticiones concurrentes ahora mismo...`);
    const startTime = Date.now();
    
    const promesas = Array.from({ length: CONFIG.totalRequests }, (_, i) => {
        const payload = generarPayloadSincronizacion(i);
        return axios.post(`${API_URL}/sincronizar`, payload, { headers, timeout: CONFIG.timeout })
            .then(res => ({ ok: true, indice: i, status: res.status, procesados: res.data?.datos?.procesados }))
            .catch(err => ({ 
                ok: false, 
                indice: i, 
                status: err.response?.status || 0, 
                error: err.response?.data?.mensaje || err.message,
                isDeadlock: (err.response?.data?.mensaje || err.message).includes('deadlock') || 
                            (err.response?.data?.mensaje || err.message).includes('Deadlock')
            }));
    });

    const resultados = await Promise.allSettled(promesas);
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);

    // 4. Analizar resultados
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 RESULTADOS DEL STRESS TEST');
    console.log('═══════════════════════════════════════════════════════');

    let exitosas = 0;
    let fallidas = 0;
    let deadlocks = 0;
    let timeouts = 0;
    const erroresUnicos = new Set();

    resultados.forEach(result => {
        const data = result.status === 'fulfilled' ? result.value : result.reason;
        if (data.ok) {
            exitosas++;
        } else {
            fallidas++;
            if (data.isDeadlock) deadlocks++;
            if (data.error?.includes('timeout')) timeouts++;
            erroresUnicos.add(data.error);
        }
    });

    console.log(`\n⏱️  Tiempo total: ${totalTime}s`);
    console.log(`✅ Exitosas      : ${exitosas}/${CONFIG.totalRequests} (${((exitosas/CONFIG.totalRequests)*100).toFixed(1)}%)`);
    console.log(`❌ Fallidas      : ${fallidas}/${CONFIG.totalRequests}`);
    console.log(`🔴 Deadlocks     : ${deadlocks}`);
    console.log(`⏰ Timeouts      : ${timeouts}`);

    if (erroresUnicos.size > 0) {
        console.log('\n📋 Errores únicos detectados:');
        erroresUnicos.forEach(err => console.log(`   - ${err}`));
    }

    console.log('\n═══════════════════════════════════════════════════════');
    if (deadlocks === 0 && exitosas > CONFIG.totalRequests * 0.95) {
        console.log('🏆 RESULTADO: BASE DE DATOS ESTABLE - Sin deadlocks detectados.');
        console.log('   Las managed transactions de Sequelize funcionan correctamente.');
    } else if (deadlocks > 0) {
        console.log('⚠️  RESULTADO: SE DETECTARON DEADLOCKS - Requiere revisión del código.');
    } else {
        console.log('⚠️  RESULTADO: INESTABILIDAD DETECTADA - Revisar pool de conexiones.');
    }
    console.log('═══════════════════════════════════════════════════════\n');

    process.exit(0);
}

runStressTest().catch(err => {
    console.error('Error fatal en stress test:', err);
    process.exit(1);
});
