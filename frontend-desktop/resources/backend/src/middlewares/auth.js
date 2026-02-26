import jwt from 'jsonwebtoken'
import config from '../config/env.js'
import Usuario from '../models/Usuario.js'
import { respuestaError } from '../utils/helpers.js'
import { AppError } from './errorHandler.js'

/**
 * Middleware para validar JWT
 * Verifica el token y adjunta el usuario al request
 */
export const validarJWT = async (req, res, next) => {
  try {
    // Obtener el token del header
    const authHeader = req.headers.authorization
    
    // Log de depuración para peticiones de importación
    if (req.path && req.path.includes('/importar')) {
      console.log('🔍 Debug auth importación:', {
        path: req.path,
        hasAuthHeader: !!authHeader,
        authHeaderStart: authHeader ? authHeader.substring(0, 20) + '...' : null,
        contentType: req.headers['content-type']
      })
    }
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Token no proporcionado o formato inválido', 401)
    }

    // Extraer y limpiar el token
    const token = authHeader.split(' ')[1]?.trim()

    if (!token) {
      throw new AppError('Token no proporcionado', 401)
    }

    // Validar formato básico de JWT (debe tener 3 partes separadas por puntos)
    const tokenParts = token.split('.')
    if (tokenParts.length !== 3) {
      throw new AppError('Token mal formado', 401)
    }

    // Verificar que ninguna parte esté vacía
    if (tokenParts.some(part => !part || part.length === 0)) {
      throw new AppError('Token mal formado', 401)
    }

    // Verificar y decodificar el token
    const decoded = jwt.verify(token, config.jwt.secret)

    // Buscar usuario en la base de datos
    const usuario = await Usuario.buscarPorId(decoded.id)

    if (!usuario) {
      throw new AppError('Usuario no encontrado', 404)
    }

    if (!usuario.activo) {
      throw new AppError('Usuario inactivo', 403)
    }

    // Adjuntar usuario al request para uso posterior
    req.usuario = {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      nombre: usuario.nombre
    }

    // Continuar al siguiente middleware
    next()
  } catch (error) {
    // No mostrar error en consola si es un error esperado de autenticación (evitar spam)
    const isExpectedAuthError = 
      error.message === 'Token no proporcionado o formato inválido' ||
      error.message === 'Token no proporcionado' ||
      error.message === 'Token mal formado' ||
      error.name === 'JsonWebTokenError' ||
      error.name === 'TokenExpiredError'
    
    if (!isExpectedAuthError) {
      console.error('Error en validarJWT:', error)
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        ok: false,
        mensaje: 'Sesión expirada. Por favor, inicia sesión nuevamente.',
        codigo: 'TOKEN_EXPIRED'
      })
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        ok: false,
        mensaje: 'Token inválido o mal formado',
        codigo: 'INVALID_TOKEN'
      })
    }

    // Manejar errores personalizados
    if (error instanceof AppError) {
      return res.status(error.statusCode || 500).json({
        ok: false,
        mensaje: error.message,
        codigo: error.code
      })
    }

    // Error inesperado
    return res.status(500).json({
      ok: false,
      mensaje: 'Error en la autenticación',
      codigo: 'AUTH_ERROR'
    })
  }
}

// Validar roles permitidos
export const validarRol = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json(respuestaError('No autenticado'))
    }

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json(
        respuestaError('No tiene permisos para realizar esta acción')
      )
    }

    next()
  }
}

// Validar que el usuario es el contable principal o el mismo usuario
export const validarPropietarioOContable = (req, res, next) => {
  const { usuario } = req
  const targetUserId = parseInt(req.params.id || req.params.usuarioId)

  // Administrador tiene acceso total
  if (usuario.rol === 'administrador') {
    return next()
  }

  // Es el mismo usuario
  if (usuario.id === targetUserId) {
    return next()
  }

  // Es el contable principal del usuario
  const targetUser = Usuario.buscarPorId(targetUserId)
  if (targetUser && targetUser.contablePrincipalId === usuario.id) {
    return next()
  }

  return res.status(403).json(
    respuestaError('No tiene permisos para acceder a este recurso')
  )
}

// Validar que el cliente pertenece al contador
export const validarClienteDelContador = (req, res, next) => {
  const { usuario } = req
  const clienteId = parseInt(req.params.id || req.params.clienteId)

  // Esto se debe implementar verificando en la base de datos
  // Por ahora, permitir si es contable o administrador
  if (['administrador', 'contable', 'contador'].includes(usuario.rol)) {
    return next()
  }

  return res.status(403).json(
    respuestaError('No tiene permisos para acceder a este cliente')
  )
}

// Validar subordinado
export const validarSubordinado = (req, res, next) => {
  const { usuario } = req
  const subordinadoId = parseInt(req.params.id || req.params.usuarioId)

  // Administrador tiene acceso
  if (usuario.rol === 'administrador') {
    return next()
  }

  // Verificar relación jerárquica
  const esSubordinado = Usuario.esSubordinado(subordinadoId, usuario.id)
  
  if (!esSubordinado) {
    return res.status(403).json(
      respuestaError('No tiene permisos sobre este usuario')
    )
  }

  next()
}

// Middleware opcional - no falla si no hay token
export const validarJWTOpcional = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')

    if (!token) {
      return next()
    }

    const decoded = jwt.verify(token, config.jwt.secret)
    const usuario = Usuario.buscarPorId(decoded.id)

    if (usuario && usuario.activo) {
      req.usuario = usuario
    }

    next()
  } catch (error) {
    // Ignorar errores y continuar sin usuario
    next()
  }
}

export default {
  validarJWT,
  validarRol,
  validarPropietarioOContable,
  validarClienteDelContador,
  validarSubordinado,
  validarJWTOpcional,
}
