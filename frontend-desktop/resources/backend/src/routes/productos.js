import express from 'express'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import productosController from '../controllers/productosController.js'
import importController from '../controllers/importController.js'
import { validarJWT, validarRol } from '../middlewares/auth.js'
import { validar, schemaCrearProductoGeneral, schemaCrearProductoCliente } from '../middlewares/validation.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

// Configurar multer para archivos temporales
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Crear directorio temporal si no existe
    const uploadPath = path.join(__dirname, '../../temp')
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true })
    }
    cb(null, uploadPath)
  },
  filename: (req, file, cb) => {
    // Generar nombre único
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, `import-${uniqueSuffix}${path.extname(file.originalname)}`)
  }
})

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.xlsx', '.xls', '.pdf']
    const ext = path.extname(file.originalname).toLowerCase()
    if (allowedTypes.includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error('Tipo de archivo no permitido. Use XLSX, XLS o PDF'))
    }
  }
})

// Todas las rutas requieren autenticación
router.use(validarJWT)

// ===== PRODUCTOS GENERALES =====
router.get('/generales', productosController.listarProductosGenerales)
router.get('/generales/categorias', productosController.obtenerCategorias)
router.get('/generales/buscar/codigo-barras/:codigo', productosController.buscarPorCodigoBarras)
router.get('/generales/:id', productosController.obtenerProductoGeneral)
router.post(
  '/generales',
  validarRol('contable', 'contador', 'administrador'),
  validar(schemaCrearProductoGeneral),
  productosController.crearProductoGeneral
)
router.put(
  '/generales/:id',
  validarRol('contable', 'contador', 'administrador'),
  productosController.actualizarProductoGeneral
)
router.delete(
  '/generales/:id',
  validarRol('contable', 'contador', 'administrador'),
  productosController.desactivarProductoGeneral
)

router.delete(
  '/generales/eliminar-todos',
  validarRol('administrador'),
  productosController.eliminarTodosProductosGenerales
)

// ===== IMPORTACIÓN DE PRODUCTOS =====
// Middleware wrapper para manejar errores de Multer
const handleFileUpload = (req, res, next) => {
  upload.single('archivo')(req, res, (err) => {
    if (err) {
      // Multer error
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          exito: false,
          mensaje: 'El archivo es demasiado grande. Tamaño máximo: 10MB'
        })
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          exito: false,
          mensaje: 'Campo de archivo inesperado. Use el campo "archivo"'
        })
      }
      if (err.message) {
        return res.status(400).json({
          exito: false,
          mensaje: err.message
        })
      }
      return res.status(400).json({
        exito: false,
        mensaje: 'Error al procesar el archivo'
      })
    }
    next()
  })
}

router.post(
  '/generales/importar',
  validarRol('contable', 'contador', 'administrador'),
  handleFileUpload,
  importController.importarProductosDesdeArchivo
)

// ===== PRODUCTOS DE CLIENTE =====
router.get('/cliente/:clienteId', productosController.listarProductosCliente)
router.post(
  '/cliente/:clienteId',
  validar(schemaCrearProductoCliente),
  productosController.crearProductoCliente
)
router.post('/cliente/:clienteId/asignar', productosController.asignarProductosGenerales)
router.get('/:id', productosController.obtenerProductoCliente)
router.put('/:id', productosController.actualizarProductoCliente)
router.delete('/:id', productosController.eliminarProductoCliente)

export default router
