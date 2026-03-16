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
        methods: ["GET", "POST"]
    }
});

// Configuración de Middlewares
app.use(cors()); // Permitir peticiones desde otros dominios (frontend)
app.use(express.json()); // Permitir el procesamiento de JSON en el cuerpo de las peticiones

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET;

// Lógica de WebSockets para Colaboradores
let colaboradoresActivos = new Map();

io.on('connection', (socket) => {
    console.log('📱 Nuevo colaborador conectado:', socket.id);

    socket.on('join-session', (userData) => {
        colaboradoresActivos.set(socket.id, {
            ...userData,
            idSocket: socket.id,
            ultimaActividad: new Date()
        });
        io.emit('colaboradores-actualizados', Array.from(colaboradoresActivos.values()));
    });

    socket.on('disconnect', () => {
        colaboradoresActivos.delete(socket.id);
        io.emit('colaboradores-actualizados', Array.from(colaboradoresActivos.values()));
        console.log('👋 Colaborador desconectado');
    });
});

// Endpoint de Salud para Electron
app.get('/api/salud', (req, res) => {
    res.json({ status: 'ok', message: 'Servidor PostgreSQL + Socket.io activo' });
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

        // Intentar encontrar la IP de la red local (LAN)
        for (const interfaceName in networkInterfaces) {
            const networkInterface = networkInterfaces[interfaceName];
            for (const details of networkInterface) {
                if (details.family === 'IPv4' && !details.internal) {
                    ip = details.address;
                    break;
                }
            }
            if (ip !== '127.0.0.1') break;
        }

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
// 'force: false' evita borrar datos existentes al reiniciar el servidor
db.sequelize.sync({ alter: true }).then(() => {
    server.listen(PORT, () => {
        console.log(`🚀 Servidor de Inventario PostgreSQL + Socket.io iniciado en el puerto ${PORT}`);
    });
}).catch(err => {
    console.error('❌ Error fatal al conectar con PostgreSQL:', err);
});

