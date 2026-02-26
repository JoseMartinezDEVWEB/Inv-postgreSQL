import logger from '../utils/logger.js'
import { respuestaError } from '../utils/helpers.js'

// Middleware para capturar errores no manejados
export const errorHandler = (err, req, res, next) => {
  // Registrar error en logs
  if (process.env.NODE_ENV !== 'test') {
    logger.error(`Error: ${err.message}`, {
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      userId: req.usuario?.id,
    })
  }

  // Errores de validación de Joi
  if (err.isJoi) {
    return res.status(400).json(
      respuestaError(
        'Error de validación',
        err.details.map(d => d.message)
      )
    )
  }

  // Errores de SQLite de restricción única o llave foránea
  if (err.code === 'SQLITE_CONSTRAINT' || (err.message && err.message.includes('UNIQUE constraint failed'))) {
    let mensaje = 'Violación de restricción de base de datos'

    if (err.message.includes('UNIQUE') || err.message.includes('unique')) {
      mensaje = 'Ya existe un registro con ese valor único (ej. nombre o código)'
    } else if (err.message.includes('FOREIGN KEY')) {
      mensaje = 'Referencia a registro inexistente'
    }

    return res.status(400).json(respuestaError(mensaje))
  }

  // Otros errores de base de datos
  if (err.name === 'SqliteError') {
    return res.status(500).json(
      respuestaError('Error de base de datos',
        process.env.NODE_ENV === 'development' ? err.message : undefined
      )
    )
  }

  // Errores de JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json(respuestaError('Token inválido'))
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json(respuestaError('Token expirado'))
  }

  // Errores de Multer (subida de archivos)
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json(respuestaError('El archivo es demasiado grande. Tamaño máximo: 10MB'))
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json(respuestaError('Campo de archivo inesperado'))
  }

  if (err.name === 'MulterError') {
    return res.status(400).json(respuestaError(err.message || 'Error al procesar el archivo'))
  }

  // Error personalizado con código de estado
  if (err.statusCode) {
    return res.status(err.statusCode).json(respuestaError(err.message))
  }

  // Error genérico
  const mensaje = process.env.NODE_ENV === 'development'
    ? err.message
    : 'Error interno del servidor'

  res.status(500).json(respuestaError(mensaje))
}

// Middleware para rutas no encontradas
export const notFoundHandler = (req, res) => {
  res.status(404).json(
    respuestaError(`Ruta no encontrada: ${req.method} ${req.originalUrl}`)
  )
}

// Clase de error personalizado
export class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message)
    this.statusCode = statusCode
    this.name = 'AppError'
  }
}

export default {
  errorHandler,
  notFoundHandler,
  AppError,
}
