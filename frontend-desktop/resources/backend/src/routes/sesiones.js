import express from 'express'
import sesionesController from '../controllers/sesionesController.js'
import { validarJWT, validarRol } from '../middlewares/auth.js'
import {
  validar,
  schemaCrearSesion,
  schemaAgregarProducto,
} from '../middlewares/validation.js'

const router = express.Router()

// Todas las rutas requieren autenticación
router.use(validarJWT)

// Rutas de agenda
router.get('/agenda/resumen', sesionesController.obtenerAgendaResumen)
router.get('/agenda/dia', sesionesController.obtenerAgendaDia)

// CRUD de sesiones
router.get('/', sesionesController.listarSesiones)
router.post('/', validarRol('contable', 'contador', 'administrador'), validar(schemaCrearSesion), sesionesController.crearSesion)
router.get('/cliente/:clienteId', sesionesController.obtenerSesionesPorCliente)
router.get('/:id', sesionesController.obtenerSesion)

// Gestión de productos en sesión
router.post('/:id/productos', validar(schemaAgregarProducto), sesionesController.agregarProducto)
router.put('/:id/productos/:productoId', sesionesController.actualizarProducto)
router.delete('/:id/productos/:productoId', sesionesController.removerProducto)

// Datos financieros - sin validación estricta para permitir campos flexibles
router.put('/:id/financieros', sesionesController.actualizarDatosFinancieros)

// Acciones de sesión
router.patch('/:id/completar', sesionesController.completarSesion)
router.patch('/:id/cancelar', sesionesController.cancelarSesion)
router.patch('/:id/timer/pause', sesionesController.pausarTimer)
router.patch('/:id/timer/resume', sesionesController.reanudarTimer)

export default router
