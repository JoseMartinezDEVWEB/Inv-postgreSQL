import express from 'express'
import invitacionesController from '../controllers/invitacionesController.js'
import { validarJWT, validarRol } from '../middlewares/auth.js'
import { validar, schemaCrearInvitacion } from '../middlewares/validation.js'

const router = express.Router()

// Rutas públicas
router.post('/validar', invitacionesController.validarCodigo)
router.post('/usar', invitacionesController.usarInvitacion)

// Rutas protegidas
router.use(validarJWT)
router.use(validarRol('contable', 'contador', 'administrador'))

// Compatibilidad con frontend desktop
router.post('/qr', invitacionesController.generarInvitacionQR)
router.get('/mis-invitaciones', invitacionesController.listarMisInvitaciones)
router.get('/colaboradores', invitacionesController.listarColaboradores)
router.patch('/colaboradores/:id/toggle', invitacionesController.toggleColaborador)
router.get('/colaboradores/:id/qr', invitacionesController.qrColaborador)
router.get('/qr/:id', invitacionesController.generarQR)

// Endpoints originales
router.post('/generar', validar(schemaCrearInvitacion), invitacionesController.generarInvitacion)
router.get('/activas', invitacionesController.listarActivas)
router.get('/:id/qr', invitacionesController.generarQR)
router.delete('/:id', invitacionesController.cancelarInvitacion)

export default router
