import express from 'express'
import integracionController from '../controllers/integracionController.js'
import { validarJWT, validarRol } from '../middlewares/auth.js'

const router = express.Router()

// Endpoint principal de integración (requiere autenticación)
router.post(
  '/integrar',
  validarJWT,
  validarRol('contable', 'contador', 'administrador'),
  integracionController.integrarProductosColaborador
)

// Obtener estado de sincronización (público para colaboradores)
router.get(
  '/:solicitudId/estado',
  integracionController.obtenerEstadoIntegracion
)

export default router










