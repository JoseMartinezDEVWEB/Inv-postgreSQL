import jwt from 'jsonwebtoken'
import config from '../config/env.js'
import Usuario from '../models/Usuario.js'
import { respuestaExito, respuestaError } from '../utils/helpers.js'
import { AppError } from '../middlewares/errorHandler.js'

// Generar tokens
const generarTokens = (usuario) => {
  const payload = {
    id: usuario.id,
    email: usuario.email,
    rol: usuario.rol,
  }

  const accessToken = jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  })

  const refreshToken = jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
  })

  return { accessToken, refreshToken }
}

// Login
export const login = async (req, res) => {
  const { email, password } = req.body
  // 'email' puede ser email o nombre de usuario

  // Buscar usuario (por email o nombre de usuario)
  const usuario = Usuario.buscarPorCredencial(email)

  if (!usuario) {
    throw new AppError('Credenciales inválidas', 401)
  }

  // Verificar contraseña
  const passwordValido = Usuario.compararPassword(password, usuario.password)

  if (!passwordValido) {
    throw new AppError('Credenciales inválidas', 401)
  }

  // Generar tokens
  const { accessToken, refreshToken } = generarTokens(usuario)

  // Guardar refresh token
  const expiraEn = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 días
  Usuario.agregarRefreshToken(usuario.id, refreshToken, expiraEn.toISOString())

  // Actualizar último acceso
  Usuario.actualizarUltimoAcceso(usuario.id)

  // Remover password de la respuesta
  delete usuario.password

  res.json(
    respuestaExito({
      usuario,
      accessToken,
      refreshToken,
    }, 'Login exitoso')
  )
}

// Registro
export const registro = async (req, res) => {
  const datosUsuario = req.body

  // Verificar si el email ya existe
  const usuarioExistente = Usuario.buscarPorEmail(datosUsuario.email)
  if (usuarioExistente) {
    throw new AppError('El email ya está registrado', 400)
  }

  // Si se registra como colaborador con contablePrincipalId, verificar límite del contador
  if (datosUsuario.rol === 'colaborador' && datosUsuario.contablePrincipalId) {
    const Invitacion = (await import('../models/Invitacion.js')).default
    const owner = Usuario.buscarPorId(datosUsuario.contablePrincipalId)
    const limite = owner?.limiteColaboradores
    if (owner?.rol === 'contador' && limite != null) {
      const actual = Usuario.contarColaboradores(datosUsuario.contablePrincipalId)
      const pendientes = Invitacion.contarActivasColaborador(datosUsuario.contablePrincipalId)
      if (actual + pendientes >= limite) {
        throw new AppError(
          `El contador ha alcanzado el límite de ${limite} colaborador(es). Contacta al administrador.`,
          400
        )
      }
    }
  }

  // Crear usuario
  const usuario = Usuario.crear(datosUsuario)

  // Generar tokens
  const { accessToken, refreshToken } = generarTokens(usuario)

  // Guardar refresh token
  const expiraEn = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  Usuario.agregarRefreshToken(usuario.id, refreshToken, expiraEn.toISOString())

  res.status(201).json(
    respuestaExito({
      usuario,
      accessToken,
      refreshToken,
    }, 'Usuario registrado exitosamente')
  )
}

// Refresh token
export const refresh = async (req, res) => {
  const { refreshToken } = req.body

  if (!refreshToken) {
    throw new AppError('Refresh token requerido', 400)
  }

  // Verificar refresh token
  const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret)

  // Buscar el token en la base de datos
  const tokenDB = Usuario.buscarRefreshToken(refreshToken)

  if (!tokenDB) {
    throw new AppError('Refresh token inválido', 401)
  }

  // Verificar si ha expirado
  if (new Date(tokenDB.expiraEn) < new Date()) {
    Usuario.removerRefreshToken(refreshToken)
    throw new AppError('Refresh token expirado', 401)
  }

  // Generar nuevos tokens
  const usuario = Usuario.buscarPorId(decoded.id)
  const { accessToken, refreshToken: newRefreshToken } = generarTokens(usuario)

  // Remover token antiguo y guardar nuevo
  Usuario.removerRefreshToken(refreshToken)
  const expiraEn = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  Usuario.agregarRefreshToken(usuario.id, newRefreshToken, expiraEn.toISOString())

  res.json(
    respuestaExito({
      accessToken,
      refreshToken: newRefreshToken,
    }, 'Tokens renovados')
  )
}

// Logout
export const logout = async (req, res) => {
  const { refreshToken } = req.body

  if (refreshToken) {
    Usuario.removerRefreshToken(refreshToken)
  }

  res.json(respuestaExito(null, 'Logout exitoso'))
}

// Obtener perfil del usuario autenticado
export const obtenerPerfil = async (req, res) => {
  const usuario = Usuario.buscarPorId(req.usuario.id)

  if (!usuario) {
    throw new AppError('Usuario no encontrado', 404)
  }

  res.json(respuestaExito(usuario))
}

// Actualizar perfil
export const actualizarPerfil = async (req, res) => {
  const usuarioActualizado = Usuario.actualizar(req.usuario.id, req.body)

  res.json(respuestaExito(usuarioActualizado, 'Perfil actualizado'))
}

// Cambiar contraseña
export const cambiarPassword = async (req, res) => {
  const { passwordActual, passwordNuevo } = req.body

  const usuario = Usuario.buscarPorEmail(req.usuario.email)

  // Verificar contraseña actual
  const passwordValido = Usuario.compararPassword(passwordActual, usuario.password)

  if (!passwordValido) {
    throw new AppError('Contraseña actual incorrecta', 400)
  }

  // Actualizar contraseña
  Usuario.actualizarPassword(usuario.id, passwordNuevo)

  // Invalidar todos los refresh tokens
  Usuario.removerTodosRefreshTokens(usuario.id)

  res.json(respuestaExito(null, 'Contraseña actualizada exitosamente'))
}

export default {
  login,
  registro,
  refresh,
  logout,
  obtenerPerfil,
  actualizarPerfil,
  cambiarPassword,
}
