import Usuario from '../models/Usuario.js'
import Invitacion from '../models/Invitacion.js'
import { respuestaExito } from '../utils/helpers.js'
import { AppError } from '../middlewares/errorHandler.js'

export const obtenerSubordinados = async (req, res) => {
  const rows = Usuario.buscarSubordinados(req.usuario.id)
  const subordinados = rows.map((u) => ({ ...u, _id: u.id }))

  res.json(respuestaExito(subordinados))
}

export const crearUsuario = async (req, res) => {
  // Verificar email duplicado antes de crear
  const existente = Usuario.buscarPorEmail(req.body.email)
  if (existente) {
    throw new AppError('Ya existe un usuario con ese correo electrónico.', 400)
  }

  const datosUsuario = {
    ...req.body,
    contablePrincipalId: req.usuario.id,
  }

  // Solo el admin puede asignar limiteColaboradores al crear un contador
  if (req.usuario.rol !== 'administrador' || req.body.rol !== 'contador') {
    delete datosUsuario.limiteColaboradores
  } else if (req.body.limiteColaboradores != null && req.body.limiteColaboradores !== '') {
    datosUsuario.limiteColaboradores = Number(req.body.limiteColaboradores)
  } else {
    delete datosUsuario.limiteColaboradores
  }

  // Si un contador crea un colaborador, verificar límite
  if (req.body.rol === 'colaborador') {
    const creador = Usuario.buscarPorId(req.usuario.id)
    const limite = creador?.limiteColaboradores
    if (limite != null) {
      const actual = Usuario.contarColaboradores(req.usuario.id)
      const pendientes = Invitacion.contarActivasColaborador(req.usuario.id)
      if (actual + pendientes >= limite) {
        throw new AppError(
          `Has alcanzado el límite de ${limite} colaborador(es) para tu equipo. Contacta al administrador para ampliarlo.`,
          400
        )
      }
    }
  }

  const usuario = Usuario.crear(datosUsuario)

  res.status(201).json(respuestaExito(usuario, 'Usuario creado'))
}

export const obtenerUsuario = async (req, res) => {
  const { id } = req.params

  const usuario = Usuario.buscarPorId(id)

  if (!usuario) {
    throw new AppError('Usuario no encontrado', 404)
  }

  res.json(respuestaExito(usuario))
}

export const actualizarUsuario = async (req, res) => {
  const { id } = req.params
  const body = { ...req.body }

  // Solo el admin puede modificar limiteColaboradores de un contador
  const target = Usuario.buscarPorId(id)
  if (!target || target.rol !== 'contador' || req.usuario.rol !== 'administrador') {
    delete body.limiteColaboradores
  }

  const usuarioActualizado = Usuario.actualizar(id, body)

  res.json(respuestaExito(usuarioActualizado, 'Usuario actualizado'))
}

export const cambiarPasswordUsuario = async (req, res) => {
  const { id } = req.params
  const { password } = req.body

  Usuario.actualizarPassword(id, password)

  res.json(respuestaExito(null, 'Contraseña actualizada'))
}

export const desactivarUsuario = async (req, res) => {
  const { id } = req.params

  Usuario.desactivar(id)

  res.json(respuestaExito(null, 'Usuario desactivado'))
}

export default {
  obtenerSubordinados,
  crearUsuario,
  obtenerUsuario,
  actualizarUsuario,
  cambiarPasswordUsuario,
  desactivarUsuario,
}
