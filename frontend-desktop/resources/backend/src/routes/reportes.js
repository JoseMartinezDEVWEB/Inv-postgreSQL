import express from 'express'
import reportesController from '../controllers/reportesController.js'
import { validarJWT, validarRol } from '../middlewares/auth.js'

const router = express.Router()

// Todas las rutas de reportes requieren autenticación
router.use(validarJWT)
router.use(validarRol('contable', 'contador', 'administrador'))

router.get('/estadisticas', reportesController.obtenerEstadisticas)
router.get('/balance/:sesionId', reportesController.obtenerBalance)
router.get('/inventario/:sesionId', reportesController.obtenerInventario)
router.get('/balance/:sesionId/pdf', reportesController.descargarBalancePDF)
router.post('/inventario/:sesionId/pdf', reportesController.descargarInventarioPDF)

export default router

