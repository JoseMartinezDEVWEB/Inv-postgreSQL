const db = require('../models');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

let colaboradoresActivos = new Map();
const inventorySessions = new Map();

const traceSocket = (msg) => {
    const timestamp = new Date().toISOString();
    const logMsg = `[${timestamp}] ${msg}\n`;
    try {
        const logPath = process.env.USER_DATA_PATH 
            ? path.join(process.env.USER_DATA_PATH, 'socket_trace.log')
            : path.join(__dirname, '../socket_trace.log');
        fs.appendFileSync(logPath, logMsg);
    } catch (err) {
        console.error('Error writing to trace log:', err);
    }
};

const setupSockets = (io) => {
    const JWT_SECRET = process.env.JWT_SECRET;
    
    // Middlewares de Socket.io para Autenticación
    io.use(async (socket, next) => {
        const token = socket.handshake.auth?.token;

        if (!token) {
            traceSocket(`⚠️ Intento de conexión sin token de: ${socket.id}`);
            return next(new Error('Autenticación fallida: Token no proporcionado'));
        }

        // Caso 1: Token Local de Colaborador (Móvil) - varios formatos soportados
        if (token.startsWith('colaborador-token-') || token.startsWith('local-token-')) {
            try {
                let solicitudId = null
                
                if (token.startsWith('colaborador-token-')) {
                    const parts = token.split('-')
                    solicitudId = parts[2]
                } else if (token.startsWith('local-token-')) {
                    const parts = token.split('-')
                    solicitudId = parts[2]
                }
                
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

        // Caso 2: Token JWT
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

        // Logger universal para depuración - Registrar CUALQUIER evento que llegue
        socket.onAny((eventName, ...args) => {
            const user = socket.user?.nombre || 'Anónimo';
            traceSocket(`🔔 [DEBUG] Evento recibido: '${eventName}' de ${user} (${socket.id})`);
        });

        if (socket.user && socket.user.rol === 'colaborador') {
            traceSocket(`👥 Registro automático de colaborador: ${socket.user.nombre}`);
            
            // Unirse a salas de colaboradores
            socket.join('sala_colaboradores');
            socket.join('colaboradores_room');
            
            colaboradoresActivos.set(socket.id, {
                ...socket.user,
                idSocket: socket.id,
                ultimaActividad: new Date()
            });

            // Actualizar base de datos
            if (socket.user.solicitudId) {
                db.SolicitudConexion.update(
                    { estadoConexion: 'conectado', ultimoPing: new Date() },
                    { where: { id: socket.user.solicitudId } }
                ).catch(err => traceSocket(`❌ Error actualizando BD (auto-connect): ${err.message}`));
            }

            emitirConteoColaboradores();
            
            io.emit('colaborador_conectado', { 
                totalColaboradores: colaboradoresActivos.size,
                colaborador: socket.user 
            });
        }

        const handleJoin = (userData) => {
            traceSocket(`🤝 Intento de unión manual (join): ${socket.id} - Datos: ${JSON.stringify(userData)}`);
            const existing = colaboradoresActivos.get(socket.id);
            const finalData = {
                ...(existing || socket.user || {}),
                ...userData,
                idSocket: socket.id,
                ultimaActividad: new Date()
            };

            colaboradoresActivos.set(socket.id, finalData);

            // Si es colaborador, unirse a las salas
            if (finalData.rol === 'colaborador') {
                socket.join('sala_colaboradores');
                socket.join('colaboradores_room');
            }

            // Actualizar base de datos si hay solicitudId
            if (finalData.solicitudId) {
                db.SolicitudConexion.update(
                    { estadoConexion: 'conectado', ultimoPing: new Date() },
                    { where: { id: finalData.solicitudId } }
                ).catch(err => traceSocket(`❌ Error actualizando BD (join): ${err.message}`));
            }

            emitirConteoColaboradores();
            
            io.emit('colaborador_conectado', { 
                totalColaboradores: colaboradoresActivos.size,
                colaborador: finalData 
            });
        };

        socket.on('join-session', handleJoin);
        socket.on('join_session', handleJoin);

        socket.on('get_online_colaborators', () => {
            traceSocket(`📡 Petición de conteo de: ${socket.user?.nombre} (${socket.user?.rol})`);
            emitirConteoColaboradores();
        });

        socket.on('disconnect', async () => {
            const userData = colaboradoresActivos.get(socket.id);
            if (userData) {
                traceSocket(`👋 Colaborador desconectado: ${userData.nombre || socket.id}`);
                colaboradoresActivos.delete(socket.id);
                
                // Actualizar base de datos
                if (userData.solicitudId) {
                    try {
                        await db.SolicitudConexion.update(
                            { estadoConexion: 'desconectado' },
                            { where: { id: userData.solicitudId } }
                        );
                        traceSocket(`💾 BD Actualizada: Solicitud ${userData.solicitudId} -> desconectado`);
                    } catch (err) {
                        traceSocket(`❌ Error actualizando BD (disconnect): ${err.message}`);
                    }
                }

                emitirConteoColaboradores();
                io.emit('colaborador_desconectado', { 
                    totalColaboradores: colaboradoresActivos.size,
                    colaborador: userData 
                });
            } else {
                traceSocket(`👋 Conexión cerrada (no era colaborador activo): ${socket.id}`);
            }
        });

        // Manejador para enviar inventario a colaboradores (desde Desktop)
        socket.on('send_inventory', (data) => {
            traceSocket(`📥 Evento 'send_inventory' recibido de: ${socket.user?.nombre} (${socket.user?.rol})`);
            
            const rolesAutorizados = ['administrador', 'contable', 'contador'];
            if (!socket.user || !rolesAutorizados.includes(socket.user.rol)) {
                traceSocket(`🚫 Intento no autorizado de send_inventory: ${socket.user?.nombre} (Rol: ${socket.user?.rol})`);
                return;
            }

            if (!data || !data.productos) {
                traceSocket(`⚠️ 'send_inventory' recibido sin productos o mal formado`);
                return;
            }

            const countNum = data.productos.length;
            const countColabs = colaboradoresActivos.size;
            
            traceSocket(`📦 Procesando envío de ${countNum} productos a ${countColabs} colaboradores registrados.`);
            
            // Payload para el móvil - timestamp fijo para evitar doble procesamiento
            const payload = {
                productos: data.productos,
                enviadoPor: {
                    id: socket.user.id,
                    nombre: socket.user.nombre || 'Administrador'
                },
                timestamp: new Date().toISOString()
            };

            const room1 = io.sockets.adapter.rooms.get('sala_colaboradores');
            traceSocket(`📊 Colaboradores en 'sala_colaboradores': ${room1?.size || 0}`);

            // Una sola emisión a sala_colaboradores (evita doble evento en mobile)
            io.to('sala_colaboradores').emit('send_inventory', payload);
            traceSocket(`🚀 Inventario emitido a sala_colaboradores.`);

            // Confirmar al emisor (Dashboard Desktop)
            socket.emit('sync_finished_ok', {
                success: true,
                count: countColabs,
                message: `Inventario de ${countNum} productos enviado a ${countColabs} colaborador(es)`
            });
        });

        // --- Protocolo de envío por chunks ---

        socket.on('send_inventory_start', (data) => {
            const rolesAutorizados = ['administrador', 'contable', 'contador'];
            if (!socket.user || !rolesAutorizados.includes(socket.user.rol)) return;

            const { sessionId, total, totalChunks } = data;
            const countColabs = colaboradoresActivos.size;

            if (countColabs === 0) {
                socket.emit('sync_finished_ok', { success: false, count: 0, message: 'No hay colaboradores en línea' });
                return;
            }

            inventorySessions.set(sessionId, { total, totalChunks, received: 0 });
            io.to('sala_colaboradores').emit('send_inventory_start', { sessionId, total, totalChunks });
            traceSocket(`📦 [Chunk] Inicio sesión ${sessionId}: ${total} productos en ${totalChunks} chunks → ${countColabs} colabs`);
        });

        socket.on('send_inventory_chunk', (data) => {
            const rolesAutorizados = ['administrador', 'contable', 'contador'];
            if (!socket.user || !rolesAutorizados.includes(socket.user.rol)) return;

            const { sessionId, chunkIndex, totalChunks, productos } = data;
            const session = inventorySessions.get(sessionId);
            if (session) session.received++;

            io.to('sala_colaboradores').emit('send_inventory_chunk', { sessionId, chunkIndex, totalChunks, productos });
            traceSocket(`📦 [Chunk] Reenviado ${chunkIndex + 1}/${totalChunks} (sesión ${sessionId})`);
        });

        socket.on('send_inventory_end', (data) => {
            const rolesAutorizados = ['administrador', 'contable', 'contador'];
            if (!socket.user || !rolesAutorizados.includes(socket.user.rol)) return;

            const { sessionId, total } = data;
            inventorySessions.delete(sessionId);
            const countColabs = colaboradoresActivos.size;

            io.to('sala_colaboradores').emit('send_inventory_complete', {
                sessionId,
                total,
                timestamp: new Date().toISOString()
            });

            socket.emit('sync_finished_ok', {
                success: true,
                count: countColabs,
                message: `Inventario de ${total} productos enviado a ${countColabs} colaborador(es)`
            });
            traceSocket(`✅ [Chunk] Completo sesión ${sessionId}: ${total} productos → ${countColabs} colabs`);
        });
    });
};

const getColaboradoresActivos = () => colaboradoresActivos;

/**
 * Emitir una notificación de negocio a todos los clientes conectados
 */
const emitNotification = (io, { titulo, mensaje, tipo = 'info', metadata = {} }) => {
    if (!io) return;
    
    traceSocket(`📢 Emitiendo notificación global: ${titulo} - ${mensaje}`);
    io.emit('business_notification', {
        titulo,
        mensaje,
        tipo, // 'info', 'success', 'warning', 'danger'
        metadata,
        timestamp: new Date()
    });
};

module.exports = { setupSockets, getColaboradoresActivos, emitNotification };
