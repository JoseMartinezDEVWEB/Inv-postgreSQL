import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs/promises'
import { existsSync } from 'fs'
import ProductoGeneral from '../models/ProductoGeneral.js'
import { respuestaExito } from '../utils/helpers.js'
import { AppError } from '../middlewares/errorHandler.js'

const execAsync = promisify(exec)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Detecta qué comando de Python está disponible en el sistema
 * Intenta: python, python3, py (en Windows)
 */
async function detectarComandoPython() {
  const comandos = process.platform === 'win32' 
    ? ['py', 'python', 'python3'] 
    : ['python3', 'python']
  
  for (const comando of comandos) {
    try {
      await execAsync(`${comando} --version`, { timeout: 3000 })
      return comando
    } catch (error) {
      // Continuar con el siguiente comando
      continue
    }
  }
  
  return null
}

/**
 * Procesa un archivo XLSX o PDF usando el script Python
 */
export const importarProductosDesdeArchivo = async (req, res) => {
  try {
    // Validar que se recibió un archivo
    if (!req.file) {
      // Validar también si el body está vacío o es null
      if (!req.body || Object.keys(req.body).length === 0) {
        return res.status(400).json({
          exito: false,
          mensaje: 'No se recibió ningún archivo. Asegúrese de enviar el archivo en el campo "archivo" con formato multipart/form-data'
        })
      }
      
      // Si hay body pero no file, puede ser que el campo no coincida
      return res.status(400).json({
        exito: false,
        mensaje: 'No se recibió ningún archivo. Verifique que el campo del formulario se llame "archivo"'
      })
    }

    const archivo = req.file
    const extension = path.extname(archivo.originalname).toLowerCase().slice(1)
    
    // Validar extensión
    if (!['xlsx', 'xls', 'pdf'].includes(extension)) {
      throw new AppError('Formato de archivo no soportado. Use XLSX, XLS o PDF', 400)
    }

    // Obtener API key de Gemini si está disponible (opcional para PDFs)
    const apiKey = req.body.apiKey || process.env.GEMINI_API_KEY || null

    // Ruta del script Python
    const scriptPath = path.join(__dirname, '../utils/importProducts.py')
    
    // Verificar que el script existe
    if (!existsSync(scriptPath)) {
      throw new AppError('Script de importación no encontrado', 500)
    }

    // Detectar comando Python disponible
    const pythonCommand = await detectarComandoPython()
    if (!pythonCommand) {
      throw new AppError(
        'Python no está instalado o no está disponible en el PATH del sistema. ' +
        'Por favor, instala Python 3.8 o superior desde https://www.python.org/downloads/ ' +
        'y asegúrate de marcar la opción "Add Python to PATH" durante la instalación.',
        500
      )
    }

    // Ejecutar script Python
    const comando = `${pythonCommand} "${scriptPath}" ${extension} "${archivo.path}" ${apiKey ? `"${apiKey}"` : ''}`
    
    console.log('Ejecutando comando:', comando.replace(apiKey || '', '***'))
    
    let stdout
    let stderr = ''
    try {
      const result = await execAsync(comando, {
        maxBuffer: 10 * 1024 * 1024, // 10MB
        encoding: 'utf8'
      })
      stdout = result.stdout || ''
      stderr = result.stderr || ''
    } catch (execError) {
      // Limpiar archivo temporal en caso de error
      try {
        if (archivo.path && existsSync(archivo.path)) {
          await fs.unlink(archivo.path)
        }
      } catch (err) {
        console.error('Error al eliminar archivo temporal:', err)
      }
      
      // Capturar stdout y stderr del error
      const errorStdout = execError.stdout || ''
      const errorStderr = execError.stderr || ''
      const errorMessage = execError.message || ''
      
      // Detectar si el error es porque Python no se encontró
      const esErrorPythonNoEncontrado = 
        errorMessage.includes('no se encontró') ||
        errorMessage.includes('not found') ||
        errorMessage.includes('no se reconoce') ||
        errorMessage.includes('is not recognized') ||
        errorStderr.includes('no se encontró') ||
        errorStderr.includes('not found') ||
        errorStderr.includes('no se reconoce') ||
        errorStderr.includes('is not recognized')
      
      if (esErrorPythonNoEncontrado) {
        return res.status(500).json({
          exito: false,
          mensaje: 'Python no está instalado o no está disponible en el PATH del sistema. ' +
                   'Por favor, instala Python 3.8 o superior desde https://www.python.org/downloads/ ' +
                   'y asegúrate de marcar la opción "Add Python to PATH" durante la instalación. ' +
                   'Después de instalar, reinicia la aplicación.'
        })
      }
      
      // Intentar parsear stdout como JSON para obtener mensaje de error del script
      let mensajeError = 'Error al ejecutar el script de importación'
      if (errorStdout) {
        try {
          const errorData = JSON.parse(errorStdout.trim())
          if (errorData.mensaje) {
            mensajeError = errorData.mensaje
          } else if (errorData.error) {
            mensajeError = errorData.error
          }
        } catch {
          // Si no es JSON, usar el texto directo
          mensajeError = errorStdout.substring(0, 200) || mensajeError
        }
      } else if (errorStderr) {
        mensajeError = errorStderr.substring(0, 200)
      } else {
        mensajeError = errorMessage || mensajeError
      }
      
      console.error('Error ejecutando script Python:', {
        message: mensajeError,
        stdout: errorStdout.substring(0, 200),
        stderr: errorStderr.substring(0, 200),
        originalError: errorMessage
      })
      
      return res.status(500).json({
        exito: false,
        mensaje: mensajeError
      })
    }

    // Limpiar archivo temporal después de ejecutar
    try {
      if (archivo.path && existsSync(archivo.path)) {
        await fs.unlink(archivo.path)
      }
    } catch (err) {
      console.error('Error al eliminar archivo temporal:', err)
    }

    // Validar que stdout no esté vacío o sea "null"
    const stdoutTrimmed = (stdout || '').trim()
    
    // Verificar valores que indican error o respuesta inválida
    if (!stdoutTrimmed || 
        stdoutTrimmed === 'null' || 
        stdoutTrimmed.toLowerCase() === 'null' ||
        stdoutTrimmed === 'None' ||
        stdoutTrimmed.toLowerCase() === 'none') {
      console.error('Script Python devolvió respuesta vacía o inválida:', {
        stdout: stdoutTrimmed,
        stderr: stderr.substring(0, 500)
      })
      return res.status(400).json({
        exito: false,
        mensaje: 'El script de importación no devolvió datos válidos. Verifica que el archivo tenga el formato correcto y que Python esté instalado correctamente.'
      })
    }

    // Verificar que stdout parezca JSON válido (debe empezar con { o [)
    if (!stdoutTrimmed.startsWith('{') && !stdoutTrimmed.startsWith('[')) {
      console.error('Script Python devolvió respuesta que no es JSON:', {
        stdout: stdoutTrimmed.substring(0, 500),
        stderr: stderr.substring(0, 500)
      })
      return res.status(400).json({
        exito: false,
        mensaje: `El script de importación devolvió una respuesta inválida. Respuesta: ${stdoutTrimmed.substring(0, 200)}`
      })
    }

    // Parsear respuesta del script
    let resultado
    try {
      resultado = JSON.parse(stdoutTrimmed)
    } catch (parseError) {
      console.error('Error al parsear respuesta del script:', {
        error: parseError.message,
        stdout: stdoutTrimmed.substring(0, 500),
        stderr: stderr.substring(0, 500)
      })
      return res.status(500).json({
        exito: false,
        mensaje: `Error al procesar respuesta del script: ${parseError.message}. La respuesta recibida no es JSON válido.`
      })
    }

    // Verificar si hubo error en el script
    if (resultado.error) {
      return res.status(400).json({
        exito: false,
        mensaje: resultado.error
      })
    }

    // Verificar estructura de respuesta
    if (resultado.exito === false) {
      return res.status(400).json({
        exito: false,
        mensaje: resultado.mensaje || 'Error al procesar el archivo'
      })
    }

    if (!resultado.productos || !Array.isArray(resultado.productos)) {
      console.error('Formato de respuesta inválido:', resultado)
      return res.status(500).json({
        exito: false,
        mensaje: 'Formato de respuesta inválido del script. El script no devolvió la estructura esperada.'
      })
    }

    // Validar que haya productos
    if (resultado.productos.length === 0) {
      return res.status(400).json({
        exito: false,
        mensaje: 'No se encontraron productos válidos en el archivo. Verifica que el archivo tenga al menos una columna con nombres de productos y que las filas contengan datos válidos.'
      })
    }

    // Validar y crear productos en la base de datos
    const productosCreados = []
    const productosConError = []
    const usuarioId = req.usuario?.id || null

    for (const productoData of resultado.productos) {
      try {
        // Validar datos mínimos
        if (!productoData.nombre || productoData.nombre.trim() === '') {
          productosConError.push({
            producto: productoData,
            error: 'Nombre vacío'
          })
          continue
        }

        // Preparar datos del producto (mapear campos del script Python)
        const datosProducto = {
          nombre: productoData.nombre.trim(),
          codigoBarras: (productoData.codigoBarras && productoData.codigoBarras.trim() !== '') 
            ? productoData.codigoBarras.trim() 
            : null,
          costoBase: Number.parseFloat(productoData.costoBase || productoData.precio || 0) || 0,
          categoria: productoData.categoria || 'General',
          unidad: productoData.unidad || 'unidad',
          descripcion: productoData.descripcion || null,
          proveedor: productoData.proveedor || null,
          creadoPorId: usuarioId,
          tipoCreacion: 'importacion'
        }

        // Verificar si el producto ya existe (por código de barras o nombre)
        let productoExistente = null
        if (datosProducto.codigoBarras) {
          productoExistente = ProductoGeneral.buscarPorCodigoBarras(datosProducto.codigoBarras)
        }
        
        if (!productoExistente) {
          // Buscar por nombre (búsqueda aproximada)
          const productos = ProductoGeneral.buscar({
            buscar: datosProducto.nombre,
            limite: 1
          })
          
          if (productos.datos && productos.datos.length > 0) {
            const productoSimilar = productos.datos[0]
            // Si el nombre es muy similar, considerarlo duplicado
            if (productoSimilar.nombre.toLowerCase() === datosProducto.nombre.toLowerCase()) {
              productoExistente = productoSimilar
            }
          }
        }

        if (productoExistente) {
          // Actualizar producto existente
          ProductoGeneral.actualizar(productoExistente.id, {
            costoBase: datosProducto.costoBase,
            categoria: datosProducto.categoria
          })
          productosCreados.push({
            ...productoExistente,
            accion: 'actualizado'
          })
        } else {
          // Crear nuevo producto
          const nuevoProducto = ProductoGeneral.crear(datosProducto)
          productosCreados.push({
            ...nuevoProducto,
            accion: 'creado'
          })
        }

      } catch (error) {
        console.error('Error al procesar producto:', productoData, error)
        productosConError.push({
          producto: productoData,
          error: error.message || 'Error desconocido'
        })
      }
    }

    // Preparar respuesta
    const respuesta = {
      totalProcesados: resultado.productos.length,
      totalCreados: productosCreados.filter(p => p.accion === 'creado').length,
      totalActualizados: productosCreados.filter(p => p.accion === 'actualizado').length,
      totalErrores: productosConError.length,
      productos: productosCreados,
      errores: productosConError
    }

    res.json(respuestaExito(respuesta, `Importación completada: ${respuesta.totalCreados} creados, ${respuesta.totalActualizados} actualizados`))

  } catch (error) {
    // Limpiar archivo temporal en caso de error
    if (req.file?.path && existsSync(req.file.path)) {
      try {
        await fs.unlink(req.file.path)
      } catch (err) {
        console.error('Error al eliminar archivo temporal:', err)
      }
    }

    if (error instanceof AppError) {
      throw error
    }

    console.error('Error en importarProductosDesdeArchivo:', error)
    throw new AppError(`Error al importar productos: ${error.message}`, 500)
  }
}

export default {
  importarProductosDesdeArchivo
}

