// Force reload 1
import express from 'express'
import http from 'http'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import 'express-async-errors'

// Config
import config from './config/env.js'
import dbManager from './config/database.js'
import logger from './utils/logger.js'

// Middlewares
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js'

// Routes
import authRoutes from './routes/auth.js'
import clientesRoutes from './routes/clientes.js'
import productosRoutes from './routes/productos.js'
import sesionesRoutes from './routes/sesiones.js'
import invitacionesRoutes from './routes/invitaciones.js'
import solicitudesRoutes from './routes/solicitudes.js'
import usuariosRoutes from './routes/usuarios.js'
import saludRoutes from './routes/salud.js'
import integracionRoutes from './routes/integracion.js'
import reportesRoutes from './routes/reportes.js'
import syncRoutes from './routes/sync.js'

// Services
import { initializeSocket } from './services/socketService.js'
import os from 'os'
import QRCode from 'qrcode'

// Migraciones
import { runMigrations } from './migrations/runMigrations.js'

// Crear aplicación Express
const app = express()
const server = http.createServer(app)

// ===== FUNCIÓN UTILITARIA: Obtener IP local =====
// Definida aquí arriba para que esté disponible en todo el archivo
const getLocalIpAddress = () => {
  const interfaces = os.networkInterfaces()
  const candidates = []

  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family !== 'IPv4' || net.internal) continue

      const ip = net.address
      // Evitar APIPA (sin DHCP)
      if (ip.startsWith('169.254.')) continue

      candidates.push({ name, ip })
    }
  }

  const scoreIp = (ip) => {
    // Preferir 192.168.x.x, luego 10.x.x.x, luego 172.16-31.x.x
    if (ip.startsWith('192.168.')) return 30
    if (ip.startsWith('10.')) return 20
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return 10
    return 1
  }

  candidates.sort((a, b) => scoreIp(b.ip) - scoreIp(a.ip))
  return candidates[0]?.ip || '0.0.0.0'
}

// ===== INICIALIZACIÓN =====

// Inicializar base de datos
logger.info('🔧 Inicializando base de datos...')
dbManager.initialize()

// Ejecutar migraciones
// Ejecutar migraciones
logger.info('📦 Ejecutando migraciones...')
runMigrations()

// Ejecutar seeds (datos iniciales si es DB nueva)
logger.info('🌱 Verificando datos iniciales...')
import seedInitialData from './seeds/initialData.js'
seedInitialData()

// Inicializar Socket.IO
logger.info('🔌 Inicializando WebSockets...')
const io = initializeSocket(server)

// ===== MIDDLEWARES GLOBALES =====

// Seguridad
app.use(helmet())

// CORS
const isLocalNetworkOrigin = (origin) => {
  if (!origin || typeof origin !== 'string') return false

  // Permitir localhost y loopback
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return true

  // Permitir esquemas de Electron y extensiones (Producción/Dev)
  if (/^(file|app|devtools|chrome-extension|vscode-webview):\/\//i.test(origin)) return true

  // Permitir redes privadas típicas (LAN)
  if (/^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/i.test(origin)) return true
  if (/^https?:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/i.test(origin)) return true
  if (/^https?:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}(:\d+)?$/i.test(origin)) return true

  return false
}

const corsOptions = {
  origin: (origin, callback) => {
    // En desarrollo: permitir TODO (incluye apps móviles y orígenes variables)
    if (config.isDevelopment) return callback(null, true)

    // Permitir requests sin origin (mobile apps, postman, etc)
    if (!origin) return callback(null, true)

    // Producción: permitir lista explícita + LAN
    if (config.cors.allowedOrigins.includes(origin) || isLocalNetworkOrigin(origin)) {
      return callback(null, true)
    }

    return callback(new Error('No permitido por CORS'))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-Type', 'X-App-Version'],
}

app.use(cors(corsOptions))
// Preflight (importante para algunos clientes / proxies)
app.options('*', cors(corsOptions))

// Compresión
app.use(compression())

// Body parser
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Logging
if (config.isDevelopment) {
  app.use(morgan('dev'))
} else {
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim())
    }
  }))
}

// Rate limiting - Configuración mejorada
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: config.isDevelopment ? 10000 : 2000, // Mucho más alto en desarrollo, alto en producción
  message: "Demasiadas solicitudes, intenta más tarde",
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Saltar rate limiting para rutas de salud en desarrollo
    return config.isDevelopment && req.path.includes('/salud')
  }
});

// Aplicar rate limiting solo si no estamos en desarrollo o con límites más altos
if (!config.isDevelopment) {
  app.use('/api/', limiter)
} else {
  // En desarrollo, usar límites muy altos pero mantener la protección básica
  app.use('/api/', limiter)
}

// ===== RUTAS =====

// Ruta de bienvenida
app.get('/', (req, res) => {
  res.json({
    mensaje: 'Backend de Inventario J4 Pro - SQLite',
    version: '1.0.0',
    estado: 'Activo',
    documentacion: '/api/salud',
  })
})

// ===== ENDPOINT PÚBLICO DE INFO DE CONEXIÓN (LAN) =====
// Devuelve IP local detectada + puerto REAL (por si Electron cambió el puerto)
app.get('/api/info-conexion', (req, res) => {
  const addr = server.address()
  const activePort = addr && typeof addr === 'object' ? addr.port : config.port
  const localIp = getLocalIpAddress()

  return res.status(200).json({
    ok: true,
    ipLocal: localIp,
    puerto: activePort,
    apiUrl: `http://${localIp}:${activePort}/api`,
    wsUrl: `http://${localIp}:${activePort}`,
    hostname: os.hostname(),
    nodeEnv: config.nodeEnv,
    timestamp: new Date().toISOString(),
  })
})

// ===== INFO DE RED PARA CONEXIÓN AUTOMÁTICA (QR) =====
// Devuelve IP local + URL completa (sin /api) para apps móviles.
// Incluye un QR con el JSON exacto esperado por el cliente:
//   {"j4pro_url":"http://IP:4500"}
app.get('/api/red/info', async (req, res) => {
  const addr = server.address()
  const activePort = addr && typeof addr === 'object' ? addr.port : config.port
  const localIp = getLocalIpAddress()

  const baseUrl = `http://${localIp}:${activePort}`
  const qrPayloadObj = { j4pro_url: baseUrl }
  const qrPayload = JSON.stringify(qrPayloadObj)

  let qrDataUrl = null
  try {
    qrDataUrl = await QRCode.toDataURL(qrPayload)
  } catch (e) {
    // No es crítico: devolver info sin QR si falla la generación
    qrDataUrl = null
  }

  return res.status(200).json({
    ok: true,
    ipLocal: localIp,
    puerto: activePort,
    url: baseUrl,
    apiUrl: `${baseUrl}/api`,
    wsUrl: baseUrl,
    qrPayload,
    qrDataUrl,
    hostname: os.hostname(),
    nodeEnv: config.nodeEnv,
    timestamp: new Date().toISOString(),
  })
})

// API Routes
app.use('/api/auth', authRoutes)
app.use('/api/clientes-negocios', clientesRoutes)
app.use('/api/clientes', clientesRoutes) // Alias
app.use('/api/productos', productosRoutes)
app.use('/api/sesiones-inventario', sesionesRoutes)
app.use('/api/invitaciones', invitacionesRoutes)
app.use('/api/solicitudes-conexion', solicitudesRoutes)
app.use('/api/usuarios', usuariosRoutes)
app.use('/api/salud', saludRoutes)
app.use('/api/inventario', integracionRoutes)
app.use('/api/reportes', reportesRoutes)
app.use('/api/sync', syncRoutes)

// ===== MANEJO DE ERRORES =====

// Ruta no encontrada
app.use(notFoundHandler)

// Manejador de errores global
app.use(errorHandler)

// ===== INICIAR SERVIDOR =====

// Puerto estable por defecto (LAN): 4500
const PORT = Number(process.env.PORT) || 4500

// Escuchar en 0.0.0.0 para ser visible desde dispositivos en la misma red Wi‑Fi
server.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIpAddress()
  logger.info(`✅ Servidor iniciado en puerto ${PORT}`)
  logger.info(`🌍 Entorno: ${config.nodeEnv}`)
  logger.info(`📁 Base de datos: ${config.database.path}`)
  logger.info(`🚀 API disponible en: http://${localIp}:${PORT}/api`)
  logger.info(`🔌 WebSocket disponible en: http://${localIp}:${PORT}`)

  console.log('\n' + '='.repeat(60))
  console.log(`✅ Backend SQLite - Gestor de Inventario J4 Pro`)
  console.log('='.repeat(60))
  console.log('Servidor escuchando en: 0.0.0.0 (LAN habilitada)')
  console.log(`\nPara conectar desde un dispositivo en la misma red, usa esta IP:`)
  console.log(`\n\x1b[1m\x1b[32m➡️  http://${localIp}:${PORT}  ⬅️\x1b[0m\n`)
  console.log('='.repeat(60))
  console.log(`🌐 Servidor Local: http://localhost:${PORT}`)
  console.log(`📡 API Local:      http://localhost:${PORT}/api`)
  console.log(`📊 Salud:          http://localhost:${PORT}/api/salud`)
  console.log(`📶 Red:            http://localhost:${PORT}/api/red/info`)
  console.log(`💾 Base de datos:  ${config.database.path}`)
  console.log('='.repeat(60) + '\n')
})

// Manejar errores de listen (puerto ocupado, permisos, etc.)
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    logger.error(`❌ El puerto ${PORT} ya está en uso. Por favor, usa otro puerto o cierra la aplicación que lo está usando.`)
    logger.error(`💡 Puedes cambiar el puerto estableciendo la variable de entorno PORT`)
    console.error(`\n❌ Error: El puerto ${PORT} ya está en uso`)
    console.error(`💡 Solución: Establece PORT en el entorno o cierra la aplicación que usa el puerto\n`)
    process.exit(1)
  } else {
    logger.error('Error al iniciar el servidor:', error)
    console.error('\n❌ Error al iniciar el servidor:', error.message, '\n')
    process.exit(1)
  }
})

// Manejo de señales de terminación
const gracefulShutdown = (signal) => {
  logger.info(`\n${signal} recibido, cerrando servidor...`)

  server.close(() => {
    logger.info('Servidor HTTP cerrado')

    // Cerrar conexión a base de datos
    dbManager.close()

    logger.info('Apagado completo')
    process.exit(0)
  })

  // Forzar cierre después de 10 segundos
  setTimeout(() => {
    logger.error('Forzando cierre después de timeout')
    process.exit(1)
  }, 10000)
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

// Manejo de excepciones no capturadas
process.on('uncaughtException', (error) => {
  logger.error('Excepción no capturada:', error)
  gracefulShutdown('uncaughtException')
})

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Promesa rechazada no manejada:', { reason, promise })
})

export default app
