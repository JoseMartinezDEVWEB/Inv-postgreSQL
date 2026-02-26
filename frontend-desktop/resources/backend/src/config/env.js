import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '../../.env') })

export const config = {
  // Servidor
  nodeEnv: process.env.NODE_ENV || 'development',
  // Puerto estable por defecto (J4 Pro LAN): 4500
  port: parseInt(process.env.PORT, 10) || 4500,
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',

  // Base de datos
  database: {
    path: process.env.DATABASE_PATH || './database/inventario.db',
    backupPath: process.env.DATABASE_BACKUP_PATH || './database/backups',
    options: {
      verbose: process.env.NODE_ENV === 'development' ? console.log : null,
      fileMustExist: false,
    },
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'default_secret_change_in_production',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'default_refresh_secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  // CORS
  cors: {
    allowedOrigins: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
      : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:8081'],
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || './logs/app.log',
  },

  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000, // 15 minutos
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || (process.env.NODE_ENV === 'development' ? 1000 : 100),
  },

  // QR Codes
  qr: {
    expirationHours: parseInt(process.env.QR_EXPIRATION_HOURS, 10) || 24,
  },

  // PDF
  pdf: {
    logoPath: process.env.PDF_LOGO_PATH || './assets/logo.png',
  },

  // Backup
  backup: {
    enabled: process.env.AUTO_BACKUP_ENABLED === 'true',
    intervalHours: parseInt(process.env.AUTO_BACKUP_INTERVAL_HOURS, 10) || 24,
  },
}

export default config
