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

const fs = require('fs');
const path = require('path');

// Función de trazado para depuración de sockets
const traceSocket = (msg) => {
    const timestamp = new Date().toISOString();
    const logMsg = `[${timestamp}] ${msg}\n`;
    try {
        fs.appendFileSync(path.join(__dirname, 'socket_trace.log'), logMsg);
    } catch (err) {
        console.error('Error writing to trace log:', err);
    }
};

// Middlewares de Socket.io para Autenticación
io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    const clientType = socket.handshake.auth?.clientType;

    if (!token) {
        traceSocket(`⚠️ Intento de conexión sin token de: ${socket.id}`);
        return next(new Error('Autenticación fallida: Token no proporcionado'));
    }

    // Caso 1: Token Local de Colaborador (Móvil)
    if (token.startsWith('colaborador-token-')) {
        try {
            const parts = token.split('-');
            const solicitudId = parts[2]; // colaborador-token-ID-TIMESTAMP
            
            traceSocket(`🔍 Verificando token local para solicitud: ${solicitudId}`);
            
            const solicitud = await db.SolicitudConexion.findByPk(solicitudId, {
                include: [{ model: db.Invitacion, as: 'Invitacion' }]
            });

            if (solicitud && solicitud.estado === 'aceptada') {
                socket.user = {
                    id: `sol_${solicitudId}`,
                    nombre: solicitud.Invitacion?.nombre || 'Colaborador',
                    rol: 'colaborador',
                    isLocal: true,
                    solicitudId: solicitudId
                };
                traceSocket(`✅ Colaborador autenticado por token local: ${socket.user.nombre}`);
                return next();
            } else {
                traceSocket(`❌ Solicitud no encontrada o no aceptada: ${solicitudId}`);
                return next(new Error('Sesión de colaborador no válida o expirada'));
            }
        } catch (err) {
            traceSocket(`❌ Error procesando token local: ${err.message}`);
            return next(new Error('Error interno de autenticación'));
        }
    }

    // Caso 2: Token JWT (Admin, Contable, Web, Desktop)
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        socket.user = decoded;
        traceSocket(`✅ Usuario autenticado por JWT: ${socket.user.nombre} (${socket.user.rol})`);
        return next();
    } catch (err) {
        traceSocket(`❌ Token JWT inválido: ${err.message}`);
        return next(new Error('Token inválido o expirado'));
    }
});

// Lógica de WebSockets para Colaboradores
let colaboradoresActivos = new Map();

// Función auxiliar para emitir el conteo actualizado a todos
const emitirConteoColaboradores = () => {
    const count = colaboradoresActivos.size;
    const detalles = Array.from(colaboradoresActivos.values());
    
    traceSocket(`📊 Emitiendo conteo: ${count} colaboradores conectados. Detalles: ${JSON.stringify(detalles)}`);
    
    // Evento esperado por frontend-desktop (useSocket.js)
    io.emit('online_colaboradores_count', { 
        count, 
        detalles,
        timestamp: new Date()
    });
    
    // Evento para compatibilidad con otras versiones
    io.emit('colaboradores-actualizados', detalles);
};

io.on('connection', (socket) => {
    traceSocket(`📱 Nueva conexión socket: ${socket.id} (Usuario: ${socket.user?.nombre || 'Anónimo'})`);

    // Si el usuario es un colaborador, registrarlo automáticamente
    if (socket.user && socket.user.rol === 'colaborador') {
        traceSocket(`👥 Registro automático de colaborador: ${socket.user.nombre}`);
        colaboradoresActivos.set(socket.id, {
            ...socket.user,
            idSocket: socket.id,
            ultimaActividad: new Date()
        });
        emitirConteoColaboradores();
        
        io.emit('colaborador_conectado', { 
            totalColaboradores: colaboradoresActivos.size,
            colaborador: socket.user 
        });
    }

    // Cuando un colaborador se une a una sesión (redundante por el auto-join pero queda para compatibilidad)
    const handleJoin = (userData) => {
        traceSocket(`🤝 Intento de unión manual (join): ${socket.id} - Datos: ${JSON.stringify(userData)}`);
        
        // Evitar duplicados si ya fue auto-registrado
        const existing = colaboradoresActivos.get(socket.id);
        const finalData = {
            ...(existing || socket.user || {}),
            ...userData,
            idSocket: socket.id,
            ultimaActividad: new Date()
        };

        colaboradoresActivos.set(socket.id, finalData);
        emitirConteoColaboradores();
        
        // Solo notificar si no estaba registrado o si los datos cambiaron
        io.emit('colaborador_conectado', { 
            totalColaboradores: colaboradoresActivos.size,
            colaborador: finalData 
        });
    };

    socket.on('join-session', handleJoin);
    socket.on('join_session', handleJoin);

    // Petición manual del conteo (usada por Admin en ProductosGenerales)
    socket.on('get_online_colaborators', () => {
        traceSocket(`📡 Petición manual de conteo recibida de: ${socket.id}`);
        emitirConteoColaboradores();
    });

    socket.on('disconnect', () => {
        const userData = colaboradoresActivos.get(socket.id);
        if (userData) {
            traceSocket(`👋 Colaborador desconectado: ${userData.nombre || socket.id}`);
            colaboradoresActivos.delete(socket.id);
            
            emitirConteoColaboradores();
            
            io.emit('colaborador_desconectado', { 
                totalColaboradores: colaboradoresActivos.size,
                colaborador: userData 
            });
        } else {
            traceSocket(`👋 Conexión cerrada (no era colaborador activo): ${socket.id}`);
        }
    });
});

// Endpoint de Salud para Electron
app.get('/api/salud', (req, res) => {
    res.json({ status: 'ok', message: 'Servidor PostgreSQL + Socket.io activo' });
});

// Endpoint de depuración para verificar colaboradores activos
app.get('/api/debug-sockets', (req, res) => {
    res.json({
        ok: true,
        count: colaboradoresActivos.size,
        colaboradores: Array.from(colaboradoresActivos.values()),
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

