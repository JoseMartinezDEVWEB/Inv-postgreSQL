const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./models');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
        allowedHeaders: "*",
        credentials: true
    },
    maxHttpBufferSize: 100e6
});

// Configuración de Middlewares
app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: "*", // Permitir todos los headers para evitar bloqueos
    credentials: true
})); 
app.use(express.json());

// --- MIDDLEWARES DE DIAGNÓSTICO (INICIO) ---
app.use((req, res, next) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const logPath = process.env.USER_DATA_PATH 
            ? path.join(process.env.USER_DATA_PATH, 'request_debug.log')
            : path.join(__dirname, './request_debug.log');
        
        const msg = `[${new Date().toISOString()}] ${req.method} ${req.url}\n`;
        fs.appendFileSync(logPath, msg);
    } catch (e) {}
    next();
});
// --- MIDDLEWARES DE DIAGNÓSTICO (FIN) ---

const PORT = process.env.PORT || 4501;
const JWT_SECRET = process.env.JWT_SECRET;

const { setupSockets, getColaboradoresActivos } = require('./utils/socketHandlers');

// Configuración de WebSockets
setupSockets(io);

// Endpoint de Salud para Electron - Ahora valida conexión a BD
app.get('/api/salud', async (req, res) => {
    try {
        await db.sequelize.authenticate();
        res.json({ 
            status: 'ok', 
            database: 'connected',
            message: 'Servidor PostgreSQL + Socket.io activo y conectado a BD' 
        });
    } catch (error) {
        console.error('🩺 Fallo en Health Check (DB):', error.message);
        res.status(503).json({ 
            status: 'error', 
            database: 'disconnected',
            message: 'Servidor activo pero SIN conexión a base de datos',
            error: error.message 
        });
    }
});

// Endpoint de depuración para verificar colaboradores activos
app.get('/api/debug-sockets', (req, res) => {
    const activos = getColaboradoresActivos();
    res.json({
        ok: true,
        count: activos.size,
        colaboradores: Array.from(activos.values()),
        socketClients: io.engine.clientsCount
    });
});

/**
 * Endpoint de información de red para el móvil - PÚBLICO
 * El móvil llama a este endpoint SIN TOKEN para verificar que el servidor
 * escaneado es un servidor J4 Pro válido. Por eso NO requiere autenticación.
 */
app.get('/api/red/info', async (req, res) => {
    try {
        const os = require('os');
        const networkInterfaces = os.networkInterfaces();
        let ip = '127.0.0.1';

        // Filtrar adaptadores virtuales o VPN comunes en Windows
        const ignoreTerms = ['virtual', 'wsl', 'veth', 'vpn', 'tailscale', 'zerotier', 'hyper-v', 'loopback', 'vmware'];

        // 1. Primero intentar encontrar adaptadores "físicos" preferenciales (Wi-Fi o Ethernet)
        let bestIp = null;
        let fallbackIp = null;

        for (const interfaceName in networkInterfaces) {
            const lowerName = interfaceName.toLowerCase();
            const isIgnored = ignoreTerms.some(term => lowerName.includes(term));
            
            const networkInterface = networkInterfaces[interfaceName];
            for (const details of networkInterface) {
                if (details.family === 'IPv4' && !details.internal) {
                    if (!isIgnored) {
                        // Si es Wi-Fi o Ethernet explícitamente, darle máxima prioridad
                        if (lowerName.includes('wi-fi') || lowerName.includes('wireless') || lowerName.includes('wlan') || lowerName.includes('wifi')) {
                            bestIp = details.address;
                        } else if (!bestIp && (lowerName.includes('ethernet') || lowerName.includes('eth'))) {
                            bestIp = details.address;
                        } else if (!bestIp && !fallbackIp) {
                            fallbackIp = details.address; // Guardar como plan B
                        }
                    }
                }
            }
        }

        ip = bestIp || fallbackIp || '127.0.0.1';


        const port = PORT;
        // Payload compacto para evitar problemas de tamaño/codificación en QR
        const qrPayload = JSON.stringify({
            t: 'cfg', // tipo: config
            url: `http://${ip}:${port}`,
            apiUrl: `http://${ip}:${port}/api`,
            j4pro_url: `http://${ip}:${port}` // Mantener por compatibilidad con app actual
        });

        res.json({
            ok: true,
            ip,
            port,
            apiUrl: `http://${ip}:${port}/api`,
            qrPayload,
            qrDataUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrPayload)}&charset-source=UTF-8`
        });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener info de red', error: error.message });
    }
});



const { authRoutes, authenticateToken } = require('./routes/authRoutes');
const usuariosRoutes = require('./routes/usuariosRoutes');
const productosRoutes = require('./routes/productosRoutes');
const clientesRoutes = require('./routes/clientesRoutes');
const sesionesRoutes = require('./routes/sesionesRoutes');
const invitacionesRoutes = require('./routes/invitacionesRoutes');
const syncRoutes = require('./routes/syncRoutes');

invitacionesRoutes.setIo(io); // Inyectar socket.io para WebSockets
productosRoutes.setIo(io);
sesionesRoutes.setIo(io);
syncRoutes.setIo(io);

// Registrar rutas
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/clientes-negocios', clientesRoutes);
app.use('/api/clientes_negocios', clientesRoutes); // Alias
app.use('/api/sesiones-inventario', sesionesRoutes);
app.use('/api/sesiones_inventario', sesionesRoutes); // Alias
app.use('/api/invitaciones', invitacionesRoutes);
app.use('/api/solicitudes-conexion', invitacionesRoutes); // Las solicitudes están dentro del router de invitaciones
app.use('/api', syncRoutes);

app.get('/api/reportes/estadisticas', authenticateToken, async (req, res) => {
    try {
        const totalClientes = await db.ClienteNegocio.count({ where: { activo: true } });
        const totalSesiones = await db.SesionInventario.count();

        const sesiones = await db.SesionInventario.findAll({
            attributes: ['totales']
        });

        let valorTotalInventarios = 0;
        sesiones.forEach(s => {
            if (s.totales && s.totales.valorTotalInventario) {
                valorTotalInventarios += parseFloat(s.totales.valorTotalInventario);
            }
        });

        res.json({
            estadisticasGenerales: {
                totalClientes,
                totalSesiones,
                valorTotalInventarios
            }
        });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener estadísticas: ' + error.message });
    }
});

// Alias antiguo
app.get('/api/mi-perfil', authenticateToken, (req, res) => {
    res.json({ mensaje: 'Perfil recuperado con éxito', usuario: req.user });
});

// Sincronizar modelos con la base de datos PostgreSQL y arrancar el servidor
const { ensureDatabaseExists } = require('./utils/dbInit');

/**
 * Seed automático de datos iniciales.
 * Solo se ejecuta si la base de datos está completamente vacía (sin usuarios).
 */
async function seedInitialData() {
    try {
        const totalUsuarios = await db.Usuario.count();
        if (totalUsuarios > 0) {
            console.log('✅ Datos ya existen, omitiendo seed inicial');
            return;
        }

        console.log('🌱 Base de datos vacía. Creando datos iniciales...');

        // Crear usuario administrador
        const hash = await bcrypt.hash('Jose.1919', 12);
        await db.Usuario.create({
            nombre:       'Administrador J4 Pro',
            email:        'admin@j4pro.com',
            nombreUsuario: 'admin',
            password:     hash,
            rol:          'administrador',
            activo:       true,
        });

        // Crear contador de prueba
        const hashContador = await bcrypt.hash('123456', 12);
        const contador = await db.Usuario.create({
            nombre:       'Juan Pérez',
            email:        'contador@j4pro.com',
            nombreUsuario: 'contador1',
            password:     hashContador,
            rol:          'contable',
            activo:       true,
        });

        console.log('');
        console.log('='.repeat(60));
        console.log('📊 DATOS INICIALES CREADOS');
        console.log('='.repeat(60));
        console.log('👤 Usuarios:');
        console.log('   Administrador → usuario: admin       | pass: Jose.1919');
        console.log('   Contador      → usuario: contador1   | pass: 123456');
        console.log('');
        console.log('   También puedes usar el email:');
        console.log('   admin@j4pro.com    / Jose.1919');
        console.log('   contador@j4pro.com / 123456');
        console.log('='.repeat(60));
        console.log('');

    } catch (err) {
        console.error('⚠️ Error en seed inicial (no fatal):', err.message);
    }
}

async function startServer() {
    try {
        // 1. Asegurar que la DB existe
        await ensureDatabaseExists();

        // 2. Sincronizar tablas (alter: true actualiza el esquema sin borrar datos)
        await db.sequelize.sync({ alter: true });
        console.log('✅ Conexión y sincronización con PostgreSQL completadas');

        // 3. Seed automático si la BD está vacía
        await seedInitialData();

        // 4. Iniciar escucha
        server.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Servidor de Inventario PostgreSQL + Socket.io iniciado en el puerto ${PORT}`);
        });

        // Manejador de Errores Global (debe ir después de las rutas)
        app.use((err, req, res, next) => {
            try {
                const fs = require('fs');
                const path = require('path');
                const logPath = process.env.USER_DATA_PATH 
                    ? path.join(process.env.USER_DATA_PATH, 'error_debug.log')
                    : path.join(__dirname, './error_debug.log');
                
                const msg = `[${new Date().toISOString()}] GLOBAL ERROR: ${err.message}\nStack: ${err.stack}\n`;
                fs.appendFileSync(logPath, msg);
            } catch (e) {}
            
            console.error('❌ Error no manejado:', err);
            res.status(500).json({ mensaje: 'Error interno del servidor', error: err.message });
        });
    } catch (err) {
        console.error('❌ Error fatal al iniciar el servidor PostgreSQL:', err);
    }
}

startServer();
/*
db.sequelize.sync({ alter: true }).then(() => {
    console.log('✅ Conexión y sincronización con PostgreSQL completadas');
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Servidor de Inventario PostgreSQL + Socket.io iniciado en el puerto ${PORT} (todas las interfaces)`);
    });
}).catch(err => {
    console.error('❌ Error fatal al sincronizar o conectar con PostgreSQL:', err);
});
*/

