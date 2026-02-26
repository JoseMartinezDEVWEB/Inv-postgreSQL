import express from 'express'
import syncController from '../controllers/syncController.js'
import { validarJWT } from '../middlewares/auth.js'

const router = express.Router()

// Todas las rutas de sincronización requieren autenticación
router.use(validarJWT)

/**
 * POST /sync/batch
 * Sincronización por lotes - Recibe múltiples operaciones del cliente
 * Body: { changes: { clientes: [], productos: [], sesiones: [] }, deviceId, timestamp }
 */
router.post('/batch', syncController.syncBatch)

/**
 * GET /sync/pull
 * Descargar cambios del servidor desde un timestamp dado
 * Query: ?lastSync=timestamp&tables=clientes,productos,sesiones
 */
router.get('/pull', syncController.pullUpdates)

/**
 * GET /sync/status
 * Obtener estado de sincronización del usuario
 */
router.get('/status', syncController.getSyncStatus)

/**
 * POST /sync/push (alias de batch para compatibilidad)
 */
router.post('/push', syncController.syncBatch)

export default router



