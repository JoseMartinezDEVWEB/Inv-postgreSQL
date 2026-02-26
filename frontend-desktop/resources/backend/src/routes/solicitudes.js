import express from 'express'
import solicitudesController from '../controllers/solicitudesController.js'
import { validarJWT, validarRol } from '../middlewares/auth.js'
import { validar, schemaCrearSolicitud } from '../middlewares/validation.js'

const router = express.Router()

// Rutas públicas (colaboradores sin autenticación)
router.post('/solicitar', validar(schemaCrearSolicitud), solicitudesController.crearSolicitud)
router.get('/estado/:solicitudId', solicitudesController.verificarEstado)
router.post('/:solicitudId/productos-offline', solicitudesController.agregarProductoOffline)

// Rutas para colaboradores (ping y estado de conexión)
router.post('/:solicitudId/ping', solicitudesController.pingColaborador)
router.post('/:solicitudId/conectar', solicitudesController.conectarColaborador)
router.post('/:solicitudId/cerrar-sesion', solicitudesController.cerrarSesionColaborador)
router.post('/:solicitudId/enviar-productos', solicitudesController.enviarProductosComoCola)

// Rutas protegidas (admin/contable)
router.use(validarJWT)
router.use(validarRol('contable', 'contador', 'administrador'))

router.get('/pendientes', solicitudesController.listarPendientes)
router.get('/conectados', solicitudesController.listarConectados)
router.post('/:solicitudId/aceptar', solicitudesController.aceptarSolicitud)
router.post('/:solicitudId/rechazar', solicitudesController.rechazarSolicitud)
router.get('/:solicitudId/productos-offline', solicitudesController.obtenerProductosOffline)
router.post('/:solicitudId/sincronizar', solicitudesController.sincronizarProductos)
router.post('/:solicitudId/desconectar', solicitudesController.desconectarColaborador)

// Rutas de cola de productos (admin)
router.get('/colas-pendientes', solicitudesController.obtenerColasPendientes)
router.get('/colas/:colaId', solicitudesController.obtenerDetalleCola)
router.post('/colas/:colaId/revisar', solicitudesController.marcarColaEnRevision)
router.post('/colas/:colaId/aceptar', solicitudesController.aceptarProductosCola)
router.post('/colas/:colaId/aceptar-todos', solicitudesController.aceptarTodosProductosCola)
router.post('/colas/:colaId/rechazar', solicitudesController.rechazarProductosCola)
router.post('/colas/:colaId/rechazar-todos', solicitudesController.rechazarTodosProductosCola)

export default router
