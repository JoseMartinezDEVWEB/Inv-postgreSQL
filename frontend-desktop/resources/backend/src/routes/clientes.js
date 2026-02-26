import express from 'express'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import clientesController from '../controllers/clientesController.js'
import { validarJWT, validarRol } from '../middlewares/auth.js'
import { validar, schemaCrearCliente, schemaActualizarCliente } from '../middlewares/validation.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

// Configurar multer para archivos temporales (múltiples archivos)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../temp')
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true })
    }
    cb(null, uploadPath)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, `import-pdf-${uniqueSuffix}${path.extname(file.originalname)}`)
  }
})

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB por archivo
    files: 10 // Máximo 10 archivos
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (ext === '.pdf' || ext === '.xlsx' || ext === '.xls') {
      cb(null, true)
    } else {
      cb(new Error('Solo se permiten archivos PDF, XLSX o XLS'))
    }
  }
})

// Todas las rutas requieren autenticación y rol de contable/contador/administrador
router.use(validarJWT)
router.use(validarRol('contable', 'contador', 'administrador'))

// Ruta para verificar estado del procesador de PDF (debe ir antes de las rutas con :id)
router.get('/importar-pdf/estado', (req, res, next) => {
  console.log('🔍 Ruta /importar-pdf/estado registrada y llamada')
  clientesController.verificarEstadoProcesadorPDF(req, res, next)
})

router.get('/', clientesController.listarClientes)
router.post('/', validar(schemaCrearCliente), clientesController.crearCliente)
router.get('/:id', clientesController.obtenerCliente)
router.put('/:id', validar(schemaActualizarCliente), clientesController.actualizarCliente)
router.delete('/:id', clientesController.desactivarCliente)
router.patch('/:id/activar', clientesController.activarCliente)
router.get('/:id/estadisticas', clientesController.obtenerEstadisticas)
router.patch('/:id/configuracion', clientesController.actualizarConfiguracion)

// Ruta para importar PDF desde cliente (múltiples archivos)
router.post('/:id/importar-pdf', upload.array('files', 10), clientesController.importarPDFDesdeCliente)

export default router
