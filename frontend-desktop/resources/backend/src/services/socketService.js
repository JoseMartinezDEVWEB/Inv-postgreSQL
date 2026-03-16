import { Server } from 'socket.io'
import jwt from 'jsonwebtoken'
import config from '../config/env.js'
import Usuario from '../models/Usuario.js'
import logger from '../utils/logger.js'

let io = null
// Estado en memoria para colaboradores conectados
const colaboradoresConectados = new Map() // socketId -> { usuarioId, nombre, timestamp }

const isLocalNetworkOrigin = (origin) => {
  if (!origin || typeof origin !== 'string') return false
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return true
  if (/^(file|app|devtools|chrome-extension|vscode-webview):\/\//i.test(origin)) return true
  if (/^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/i.test(origin)) return true
  if (/^https?:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/i.test(origin)) return true
  if (/^https?:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}(:\d+)?$/i.test(origin)) return true
  return false
}

// Inicializar Socket.IO con configuración mejorada
export const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        // En desarrollo: permitir todo
        if (config.isDevelopment) return callback(null, true)

        // Permitir sin Origin (React Native / Postman)
        if (!origin) return callback(null, true)

        if (config.cors.allowedOrigins.includes(origin) || isLocalNetworkOrigin(origin)) {
          return callback(null, true)
        }

        logger.warn(`🛑 WebSocket bloqueado por CORS. Origen: ${origin || 'SIN ORIGEN'}`)
        return callback(new Error('No permitido por CORS (socket)'))
      },
      methods: ['GET', 'POST', 'OPTIONS'],
      credentials: true,
    },
    pingTimeout: 60000, // 60 segundos
    pingInterval: 25000, // 25 segundos
    upgradeTimeout: 30000, // 30 segundos
    maxHttpBufferSize: 1e6, // 1MB
    transports: ['websocket', 'polling'],
    allowUpgrades: true,
  })

  // Middleware de autenticación con logging mejorado
  io.use((socket, next) => {
    const token = socket.handshake.auth.token
    const clientType = socket.handshake.auth.clientType || 'unknown'
    const ip = socket.handshake.address

    logger.info(`🔐 Intento de conexión WebSocket desde ${clientType} (IP: ${ip})`)

    if (!token) {
      logger.warn(`❌ Intento de conexión sin token desde ${clientType}`)
      return next(new Error('Token requerido'))
    }

    try {
      // Si es un token local de colaborador (empieza con "colaborador-token-")
      if (token.startsWith('colaborador-token-')) {
        logger.info(`🔐 Token local de colaborador detectado`)

        // Extraer solicitudId del token (formato: colaborador-token-{solicitudId}-{timestamp})
        const parts = token.split('-')
        const solicitudId = parts.length >= 3 ? parts[2] : null

        if (!solicitudId) {
          logger.warn(`❌ Token de colaborador sin solicitudId válido`)
          return next(new Error('Token de colaborador inválido'))
        }

        // Crear usuario temporal para el colaborador
        const usuarioTemporal = {
          id: `colaborador_${solicitudId}`,
          nombre: 'Colaborador',
          rol: 'colaborador',
          activo: true,
          contablePrincipalId: null,
          configuracion: {
            tipo: 'colaborador_sesion',
            solicitudId: solicitudId
          }
        }

        logger.info(`✅ Colaborador temporal autenticado: ${usuarioTemporal.nombre} (Solicitud: ${solicitudId})`)
        socket.usuario = usuarioTemporal
        socket.clientType = clientType
        next()
        return
      }

      // Token JWT normal
      const decoded = jwt.verify(token, config.jwt.secret)

      // Verificar si el token ha expirado
      if (decoded.exp && decoded.exp * 1000 < Date.now()) {
        logger.warn(`❌ Token expirado para usuario ID: ${decoded.id}`)
        return next(new Error('Token expirado'))
      }

      const usuario = Usuario.buscarPorId(decoded.id)

      if (!usuario) {
        logger.warn(`❌ Usuario no encontrado con ID: ${decoded.id}`)
        return next(new Error('Usuario no encontrado'))
      }

      if (!usuario.activo) {
        logger.warn(`❌ Usuario inactivo intentó conectar: ${usuario.nombre} (${usuario.id})`)
        return next(new Error('Usuario inactivo'))
      }

      logger.info(`✅ Autenticación exitosa: ${usuario.nombre} (ID: ${usuario.id}, Rol: ${usuario.rol}, ClientType: ${clientType})`)
      socket.usuario = usuario
      socket.clientType = clientType
      next()
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        logger.warn('❌ Token expirado en WebSocket')
        return next(new Error('Token expirado'))
      } else if (error.name === 'JsonWebTokenError') {
        logger.warn('❌ Token JWT inválido en WebSocket:', error.message)
        return next(new Error('Token inválido'))
      } else {
        logger.error('❌ Error verificando token en WebSocket:', error)
        return next(new Error('Error de autenticación'))
      }
    }
  })

  // Manejo de conexiones
  io.on('connection', (socket) => {
    logger.info(`✅ WebSocket conectado: ${socket.usuario.nombre} (${socket.usuario.id}) [${socket.clientType}] Rol: ${socket.usuario.rol}`)

    // Unirse a sala del contable con manejo de errores
    try {
      if (socket.usuario.contablePrincipalId) {
        socket.join(`contable_${socket.usuario.contablePrincipalId}`)
      } else {
        socket.join(`contable_${socket.usuario.id}`)
      }
    } catch (error) {
      logger.error('Error al unirse a sala de contable:', error)
    }

    // Determinar si es colaborador (por rol o por tipo de cliente)
    // IMPORTANTE: Si es mobile o tiene rol colaborador, tratar como tal
    const esColaborador = socket.clientType === 'mobile' ||
      socket.usuario.rol === 'colaborador' ||
      (socket.usuario.configuracion && socket.usuario.configuracion.tipo === 'colaborador_sesion')

    logger.info(`🔍 [Socket] Verificando tipo cliente:`, {
      socketId: socket.id,
      nombre: socket.usuario.nombre,
      rol: socket.usuario.rol,
      clientType: socket.clientType,
      esColaborador
    })

    // Log detallado para debugging
    if (socket.clientType === 'mobile') {
      logger.info(`📱 Cliente mobile detectado - será tratado como colaborador: ${socket.usuario.nombre}`)
    }

    // Si es colaborador, unirse a la sala de colaboradores (usando nombre estándar)
    if (esColaborador) {
      socket.join('sala_colaboradores')
      socket.join('colaboradores_room') // Mantener compatibilidad
      colaboradoresConectados.set(socket.id, {
        usuarioId: socket.usuario.id,
        nombre: socket.usuario.nombre,
        rol: socket.usuario.rol,
        clientType: socket.clientType,
        timestamp: Date.now()
      })
      const totalColaboradores = colaboradoresConectados.size
      const roomSize = io.sockets.adapter.rooms.get('colaboradores_room')?.size || 0
      logger.info(`👥 Colaborador ${socket.usuario.nombre} (${socket.usuario.rol}) se unió a sala_colaboradores.`)
      logger.info(`📊 Total colaboradores en Map: ${totalColaboradores}, Total en sala_colaboradores: ${io.sockets.adapter.rooms.get('sala_colaboradores')?.size || 0}`)
      logger.info(`🆔 Socket ID: ${socket.id}, Usuario ID: ${socket.usuario.id}`)

      // Notificar a TODOS los administradores en sala_admins sobre el nuevo colaborador
      const adminRoomSize = io.sockets.adapter.rooms.get('sala_admins')?.size ||
        io.sockets.adapter.rooms.get('admin_room')?.size || 0
      logger.info(`📢 Notificando a ${adminRoomSize} admin(s) en sala_admins sobre nuevo colaborador`)

      // Enviar a ambas salas por compatibilidad
      io.to('sala_admins').emit('colaborador_conectado', {
        totalColaboradores,
        colaborador: {
          id: socket.usuario.id,
          nombre: socket.usuario.nombre,
          rol: socket.usuario.rol
        },
        timestamp: new Date().toISOString()
      })
      io.to('admin_room').emit('colaborador_conectado', {
        totalColaboradores,
        colaborador: {
          id: socket.usuario.id,
          nombre: socket.usuario.nombre,
          rol: socket.usuario.rol
        },
        timestamp: new Date().toISOString()
      })

      // También enviar el contador actualizado a todos los admins
      const adminRoom = io.sockets.adapter.rooms.get('sala_admins') ||
        io.sockets.adapter.rooms.get('admin_room')
      const adminSockets = adminRoom ? Array.from(adminRoom) : []
      logger.info(`📤 Enviando eventos a ${adminSockets.length} admin(s) en sala_admins:`, adminSockets)

      io.to('sala_admins').emit('online_colaboradores_count', {
        count: totalColaboradores,
        timestamp: new Date().toISOString()
      })
      io.to('admin_room').emit('online_colaboradores_count', {
        count: totalColaboradores,
        timestamp: new Date().toISOString()
      })

      logger.info(`✅ Eventos enviados a admin_room. Total colaboradores: ${totalColaboradores}`)

      // Verificar que los eventos se enviaron correctamente
      setTimeout(() => {
        const currentRoomSize = io.sockets.adapter.rooms.get('colaboradores_room')?.size || 0
        const currentMapSize = colaboradoresConectados.size
        logger.info(`🔍 Verificación post-envío - Room size: ${currentRoomSize}, Map size: ${currentMapSize}`)
      }, 100)
    }

    // Si es admin o contable, unirse a la sala de admin para recibir notificaciones
    const esAdminRelacionado = socket.usuario.rol === 'administrador' ||
      socket.usuario.rol === 'contable' ||
      socket.usuario.rol === 'contable'

    if (esAdminRelacionado) {
      socket.join('sala_admins')
      socket.join('admin_room') // Mantener compatibilidad
      const adminRoomSize = io.sockets.adapter.rooms.get('sala_admins')?.size ||
        io.sockets.adapter.rooms.get('admin_room')?.size || 0
      logger.info(`👑 Admin/Contable ${socket.usuario.nombre} (${socket.usuario.rol}) se unió a sala_admins. Total admins: ${adminRoomSize}`)

      // Enviar el conteo actual de colaboradores al admin inmediatamente con un pequeño delay
      // para asegurar que el socket esté completamente configurado
      setTimeout(() => {
        const count = colaboradoresConectados.size
        const colaboradoresList = Array.from(colaboradoresConectados.values()).map(c => `${c.nombre} (${c.rol})`)
        logger.info(`📊 Enviando contador inicial a admin/contable: ${count} colaboradores`)
        logger.info(`📋 Lista de colaboradores conectados:`, colaboradoresList)
        socket.emit('online_colaboradores_count', {
          count,
          detalles: Array.from(colaboradoresConectados.values()),
          timestamp: new Date().toISOString()
        })
        logger.info(`✅ Contador inicial enviado al admin/contable ${socket.usuario.nombre} (${count} colaboradores)`)
      }, 500) // Delay de 500ms para asegurar que todo esté configurado
    }

    // Unirse a sesión de inventario
    socket.on('join_session', (data) => {
      const { sessionId } = data
      socket.join(`session_${sessionId}`)
      logger.info(`Usuario ${socket.usuario.nombre} se unió a sesión ${sessionId}`)

      // Notificar a otros usuarios en la sesión
      socket.to(`session_${sessionId}`).emit('usuario_conectado', {
        usuario: {
          id: socket.usuario.id,
          nombre: socket.usuario.nombre,
          rol: socket.usuario.rol,
        },
        timestamp: new Date().toISOString(),
      })
    })

    // Salir de sesión
    socket.on('leave_session', (data) => {
      const { sessionId } = data
      socket.leave(`session_${sessionId}`)
      logger.info(`Usuario ${socket.usuario.nombre} salió de sesión ${sessionId}`)

      // Notificar a otros usuarios
      socket.to(`session_${sessionId}`).emit('usuario_desconectado', {
        usuario: {
          id: socket.usuario.id,
          nombre: socket.usuario.nombre,
        },
        timestamp: new Date().toISOString(),
      })
    })

    // Producto actualizado en sesión
    socket.on('producto_actualizado', (data) => {
      const { sessionId, producto } = data

      // Emitir a todos los usuarios en la sesión excepto al remitente
      socket.to(`session_${sessionId}`).emit('producto_actualizado', {
        producto,
        usuario: {
          id: socket.usuario.id,
          nombre: socket.usuario.nombre,
        },
        timestamp: new Date().toISOString(),
      })

      logger.info(`Producto actualizado en sesión ${sessionId} por ${socket.usuario.nombre}`)
    })

    // Datos financieros actualizados
    socket.on('financieros_actualizados', (data) => {
      const { sessionId, datosFinancieros } = data

      socket.to(`session_${sessionId}`).emit('financieros_actualizados', {
        datosFinancieros,
        usuario: {
          id: socket.usuario.id,
          nombre: socket.usuario.nombre,
        },
        timestamp: new Date().toISOString(),
      })
    })

    // Sesión completada
    socket.on('sesion_completada', (data) => {
      const { sessionId } = data

      io.to(`session_${sessionId}`).emit('sesion_completada', {
        sessionId,
        usuario: {
          id: socket.usuario.id,
          nombre: socket.usuario.nombre,
        },
        timestamp: new Date().toISOString(),
      })
    })

    // Obtener cantidad de colaboradores en línea (para admins/contables)
    socket.on('get_online_users', () => {
      if (esAdminRelacionado) {
        const count = colaboradoresConectados.size
        const detalles = Array.from(colaboradoresConectados.entries()).map(([socketId, info]) => ({
          socketId,
          ...info
        }))

        logger.info(`📊 Admin/Contable ${socket.usuario.nombre} consultó colaboradores en línea: ${count}`)
        logger.info(`📋 Detalle de colaboradores conectados:`, JSON.stringify(detalles, null, 2))
        logger.info(`🏠 Admin/Contable está en sala_admins: ${socket.rooms.has('sala_admins')}`)
        logger.info(`👥 Colaboradores en sala_colaboradores: ${io.sockets.adapter.rooms.get('sala_colaboradores')?.size || 0}`)

        socket.emit('online_colaboradores_count', {
          count,
          detalles: detalles, // Enviar detalles para debug
          timestamp: new Date().toISOString()
        })
      } else {
        logger.warn(`⚠️ Usuario no admin intentó consultar colaboradores: ${socket.usuario.nombre} (${socket.usuario.rol})`)
      }
    })

    // Evento get_online_colaborators (alias para compatibilidad)
    socket.on('get_online_colaborators', () => {
      if (esAdminRelacionado) {
        const count = colaboradoresConectados.size
        logger.info(`📊 Admin/Contable ${socket.usuario.nombre} consultó colaboradores (get_online_colaborators): ${count}`)
        socket.emit('online_colaboradores_count', {
          count,
          timestamp: new Date().toISOString()
        })
      }
    })

    // Enviar inventario a colaboradores (solo admins/contables) - Evento send_inventory
    socket.on('send_inventory', (data) => {
      if (!esAdminRelacionado) {
        logger.warn(`⚠️ Usuario no autorizado intentó enviar inventario: ${socket.usuario.nombre}`)
        socket.emit('error', { message: 'Solo administradores o contables pueden enviar inventario' })
        return
      }

      const { productos } = data
      const colaboradoresRoom = io.sockets.adapter.rooms.get('sala_colaboradores') ||
        io.sockets.adapter.rooms.get('colaboradores_room')
      const count = colaboradoresRoom?.size || 0

      if (count === 0) {
        socket.emit('sync_finished_ok', {
          success: false,
          message: 'No hay colaboradores en línea',
          count: 0
        })
        logger.warn(`⚠️ Admin ${socket.usuario.nombre} intentó enviar inventario pero no hay colaboradores conectados`)
        return
      }

      logger.info(`📦 Admin/Contable ${socket.usuario.nombre} enviando inventario a ${count} colaborador(es) en sala_colaboradores`)

      // Enviar inventario a todos los colaboradores en la sala
      io.to('sala_colaboradores').emit('send_inventory', {
        productos,
        enviadoPor: {
          id: socket.usuario.id,
          nombre: socket.usuario.nombre
        },
        timestamp: new Date().toISOString()
      })

      // También enviar a colaboradores_room por compatibilidad
      io.to('colaboradores_room').emit('send_inventory', {
        productos,
        enviadoPor: {
          id: socket.usuario.id,
          nombre: socket.usuario.nombre
        },
        timestamp: new Date().toISOString()
      })

      // Enviar confirmación de éxito al admin después de un pequeño delay
      setTimeout(() => {
        socket.emit('sync_finished_ok', {
          success: true,
          message: `Inventario enviado a ${count} colaborador(es)`,
          count
        })
      }, 100)

      logger.info(`✅ Inventario enviado a ${count} colaborador(es), confirmación enviada al admin`)
    })

    // Mantener compatibilidad con dispatch_inventory (deprecated)
    socket.on('dispatch_inventory', (data) => {
      logger.warn(`⚠️ Uso de evento deprecated 'dispatch_inventory', usar 'send_inventory' en su lugar`)
      // Reenviar a send_inventory
      socket.emit('send_inventory', data)
    })

    // Desconexión
    socket.on('disconnect', (reason) => {
      logger.info(`❌ WebSocket desconectado: ${socket.usuario.nombre} (${socket.usuario.id}) - Razón: ${reason}`)

      // Si era un colaborador, removerlo del estado
      if (colaboradoresConectados.has(socket.id)) {
        const colaboradorInfo = colaboradoresConectados.get(socket.id)
        colaboradoresConectados.delete(socket.id)
        const newCount = colaboradoresConectados.size
        logger.info(`👥 Colaborador ${socket.usuario.nombre} salió. Total conectados: ${newCount}`)

        // Notificar a los administradores
        io.to('sala_admins').emit('colaborador_desconectado', {
          totalColaboradores: newCount,
          colaborador: {
            id: socket.usuario.id,
            nombre: socket.usuario.nombre
          },
          timestamp: new Date().toISOString()
        })
        io.to('admin_room').emit('colaborador_desconectado', {
          totalColaboradores: newCount,
          colaborador: {
            id: socket.usuario.id,
            nombre: socket.usuario.nombre
          },
          timestamp: new Date().toISOString()
        })
      }

      // Si era un admin/contable, salir de la sala de admin
      if (esAdminRelacionado) {
        socket.leave('sala_admins')
        socket.leave('admin_room')
        logger.info(`👑 Admin/Contable ${socket.usuario.nombre} salió de sala_admins`)
      }
    })

    // Manejo de errores
    socket.on('error', (error) => {
      logger.error(`💥 Error en socket ${socket.usuario.nombre}:`, error.message || error)
    })

    // Timeout de ping/pong para detectar conexiones muertas
    socket.on('ping', () => {
      socket.emit('pong')
    })
  })

  logger.info('Socket.IO inicializado')

  return io
}

// Obtener instancia de Socket.IO
export const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO no ha sido inicializado')
  }
  return io
}

// Emitir evento a una sala específica
export const emitToRoom = (room, event, data) => {
  if (io) {
    io.to(room).emit(event, data)
  }
}

// Emitir evento a un usuario específico
export const emitToUser = (userId, event, data) => {
  if (io) {
    io.to(`user_${userId}`).emit(event, data)
  }
}

export default {
  initializeSocket,
  getIO,
  emitToRoom,
  emitToUser,
}
