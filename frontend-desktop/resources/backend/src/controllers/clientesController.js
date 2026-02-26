import ClienteNegocio from '../models/ClienteNegocio.js'
import SesionInventario from '../models/SesionInventario.js'
import ProductoCliente from '../models/ProductoCliente.js'
import { respuestaExito, respuestaError } from '../utils/helpers.js'
import { AppError } from '../middlewares/errorHandler.js'
import dbManager from '../config/database.js'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs/promises'
import { existsSync } from 'fs'

const execAsync = promisify(exec)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Listar clientes del contador
export const listarClientes = async (req, res) => {
  const contadorId = req.usuario.id
  const { pagina = 1, limite = 50, buscar, soloActivos = 'true' } = req.query

  const resultado = ClienteNegocio.buscarPorContador(contadorId, {
    pagina: parseInt(pagina),
    limite: parseInt(limite),
    buscar,
    soloActivos: soloActivos === 'true',
  })

  res.json(respuestaExito(resultado))
}

// Obtener cliente por ID
export const obtenerCliente = async (req, res) => {
  const { id } = req.params

  const cliente = ClienteNegocio.buscarPorId(id)

  if (!cliente) {
    throw new AppError('Cliente no encontrado', 404)
  }

  // Verificar que el cliente pertenezca al contador
  if (cliente.contadorAsignadoId !== req.usuario.id && req.usuario.rol !== 'administrador') {
    throw new AppError('No tiene permisos para ver este cliente', 403)
  }

  res.json(respuestaExito(cliente))
}

// Crear nuevo cliente
export const crearCliente = async (req, res) => {
  try {
    // Calcular business_id (el admin principal del negocio)
    const businessId = req.usuario.contablePrincipalId || req.usuario.id

    const datosCliente = {
      ...req.body,
      contadorAsignadoId: req.usuario.id,
      business_id: businessId,
      created_by: req.usuario.id,
      // Si el frontend envía uuid, lo usamos; si no, se genera en el modelo
      uuid: req.body.uuid || req.body.id_uuid || null,
    }

    const cliente = ClienteNegocio.crear(datosCliente)

    if (!cliente) {
      throw new AppError('Error al crear el cliente', 500)
    }

    res.status(201).json(respuestaExito(cliente, 'Cliente creado exitosamente'))
  } catch (error) {
    console.error('❌ Error al crear cliente:', error)
    if (error instanceof AppError) {
      throw error
    }
    throw new AppError('Error interno al crear cliente: ' + error.message, 500)
  }
}

// Actualizar cliente
export const actualizarCliente = async (req, res) => {
  const { id } = req.params

  const clienteExistente = ClienteNegocio.buscarPorId(id)

  if (!clienteExistente) {
    throw new AppError('Cliente no encontrado', 404)
  }

  // Verificar permisos
  if (clienteExistente.contadorAsignadoId !== req.usuario.id && req.usuario.rol !== 'administrador') {
    throw new AppError('No tiene permisos para actualizar este cliente', 403)
  }

  const clienteActualizado = ClienteNegocio.actualizar(id, req.body)

  res.json(respuestaExito(clienteActualizado, 'Cliente actualizado'))
}

// Desactivar cliente
export const desactivarCliente = async (req, res) => {
  const { id } = req.params

  const cliente = ClienteNegocio.buscarPorId(id)

  if (!cliente) {
    throw new AppError('Cliente no encontrado', 404)
  }

  // Verificar permisos
  if (cliente.contadorAsignadoId !== req.usuario.id && req.usuario.rol !== 'administrador') {
    throw new AppError('No tiene permisos para desactivar este cliente', 403)
  }

  ClienteNegocio.desactivar(id)

  res.json(respuestaExito(null, 'Cliente desactivado'))
}

// Activar cliente
export const activarCliente = async (req, res) => {
  const { id } = req.params

  const clienteActivado = ClienteNegocio.activar(id)

  if (!clienteActivado) {
    throw new AppError('Cliente no encontrado', 404)
  }

  res.json(respuestaExito(clienteActivado, 'Cliente activado'))
}

// Obtener estadísticas del cliente
export const obtenerEstadisticas = async (req, res) => {
  const { id } = req.params

  const cliente = ClienteNegocio.buscarPorId(id)

  if (!cliente) {
    throw new AppError('Cliente no encontrado', 404)
  }

  const estadisticas = ClienteNegocio.obtenerEstadisticas(id)

  res.json(respuestaExito(estadisticas))
}

// Actualizar configuración de inventario
export const actualizarConfiguracion = async (req, res) => {
  const { id } = req.params

  const cliente = ClienteNegocio.buscarPorId(id)

  if (!cliente) {
    throw new AppError('Cliente no encontrado', 404)
  }

  const configuracion = {
    ...cliente.configuracionInventario,
    ...req.body,
  }

  const clienteActualizado = ClienteNegocio.actualizar(id, {
    configuracionInventario: configuracion,
  })

  res.json(respuestaExito(clienteActualizado, 'Configuración actualizada'))
}

// Verificar estado del procesador de PDF
export const verificarEstadoProcesadorPDF = async (req, res) => {
  console.log('✅ Endpoint verificarEstadoProcesadorPDF llamado')
  try {
    // Verificar si pdfplumber está instalado
    let pdfplumberInstalado = false
    let cooldownMs = 0

    try {
      const result = await execAsync('python -c "import pdfplumber; print(\'ok\')"', {
        timeout: 3000,
        maxBuffer: 1024 * 1024
      })
      if (result.stdout && result.stdout.trim() === 'ok') {
        pdfplumberInstalado = true
      }
    } catch (error) {
      // pdfplumber no está instalado o hay un error
      pdfplumberInstalado = false
      // Si es un error de importación, sugerir cooldown
      if (error.message && error.message.includes('No module named')) {
        cooldownMs = 5000 // Esperar 5 segundos antes de reintentar
      }
    }

    // Verificar si el script Python existe
    const scriptPath = path.join(__dirname, '../utils/importProducts.py')
    const scriptExiste = existsSync(scriptPath)

    const ready = pdfplumberInstalado && scriptExiste

    res.json(respuestaExito({
      ready,
      pdfplumberInstalado,
      scriptExiste,
      cooldownMs: ready ? 0 : cooldownMs,
      mensaje: ready 
        ? 'Procesador de PDF listo' 
        : 'El procesador de PDF se está preparando en el servidor. Intente de nuevo en unos segundos.'
    }))
  } catch (error) {
    console.error('Error al verificar estado del procesador PDF:', error)
    res.json(respuestaExito({
      ready: false,
      pdfplumberInstalado: false,
      scriptExiste: false,
      cooldownMs: 3000,
      mensaje: 'Error al verificar el estado del procesador de PDF'
    }))
  }
}

// Importar inventario desde PDF para un cliente
export const importarPDFDesdeCliente = async (req, res) => {
  try {
    const { id } = req.params
    const cliente = ClienteNegocio.buscarPorId(id)

    if (!cliente) {
      throw new AppError('Cliente no encontrado', 404)
    }

    // Verificar permisos
    if (cliente.contadorAsignadoId !== req.usuario.id && req.usuario.rol !== 'administrador') {
      throw new AppError('No tiene permisos para importar PDFs para este cliente', 403)
    }

    // Validar que se recibieron archivos
    if (!req.files || req.files.length === 0) {
      throw new AppError('No se recibieron archivos PDF', 400)
    }

    // Validar que sean PDFs o Excel
    const archivosValidos = req.files.filter(file => {
      const ext = path.extname(file.originalname).toLowerCase()
      return ext === '.pdf' || ext === '.xlsx' || ext === '.xls'
    })

    if (archivosValidos.length !== req.files.length) {
      throw new AppError('Todos los archivos deben ser PDFs, XLSX o XLS', 400)
    }

    // Obtener API key de Gemini si está disponible
    const apiKey = req.body.apiKey || process.env.GEMINI_API_KEY || null
    const scriptPath = path.join(__dirname, '../utils/importProducts.py')

    if (!existsSync(scriptPath)) {
      throw new AppError('Script de importación no encontrado', 500)
    }

    // Procesar cada archivo (PDF o Excel)
    const todosProductos = []
    const archivosProcesados = []
    const erroresArchivos = []
    // Datos financieros extraídos de PDFs (Balance General y Distribución de Saldo)
    let datosFinancierosExtraidos = { balanceGeneral: {}, distribucionSaldo: {} }

    for (const archivo of archivosValidos) {
      try {
        const ext = path.extname(archivo.originalname).toLowerCase().slice(1)
        const tipoArchivo = ext === 'xlsx' || ext === 'xls' ? 'xlsx' : 'pdf'
        const comando = `python "${scriptPath}" ${tipoArchivo} "${archivo.path}" ${apiKey ? `"${apiKey}"` : ''}`
        
        console.log(`🔧 Ejecutando comando para ${archivo.originalname}:`, comando.replace(apiKey || '', '***'))
        console.log(`📋 Tipo de archivo detectado: ${tipoArchivo}, extensión: ${ext}`)
        console.log(`📁 Ruta del archivo: ${archivo.path}`)
        console.log(`🔑 API Key presente: ${!!apiKey}`)
        console.log(`📅 Fecha del inventario recibida: ${req.body.fechaInventario || 'No especificada'}`)

        let stdout
        let stderr = ''
        try {
          console.log(`🔄 Procesando archivo: ${archivo.originalname} con comando: ${comando.replace(apiKey || '', '***')}`)
          const result = await execAsync(comando, {
            maxBuffer: 50 * 1024 * 1024, // 50MB
            encoding: 'utf8',
            timeout: 120000 // 2 minutos de timeout
          })
          stdout = result.stdout || ''
          stderr = result.stderr || ''
          console.log(`📤 stdout recibido (${stdout.length} caracteres)`)
          if (stderr) {
            console.log(`⚠️ stderr recibido:`, stderr.substring(0, 500))
          }
        } catch (execError) {
          // Limpiar archivo temporal
          try {
            if (archivo.path && existsSync(archivo.path)) {
              await fs.unlink(archivo.path)
            }
          } catch (err) {
            console.error('Error al eliminar archivo temporal:', err)
          }

          const errorStdout = execError.stdout || ''
          const errorStderr = execError.stderr || ''
          let errorMessage = 'Error al procesar el archivo PDF'
          
          console.error(`❌ Error ejecutando script para ${archivo.originalname}:`, {
            code: execError.code,
            signal: execError.signal,
            stdout: errorStdout.substring(0, 500),
            stderr: errorStderr.substring(0, 500)
          })
          
          // Intentar parsear stdout como JSON (el script puede devolver errores en JSON)
          if (errorStdout) {
            try {
              const errorData = JSON.parse(errorStdout.trim())
              errorMessage = errorData.mensaje || errorData.error || errorMessage
              console.log(`📋 Error parseado del script:`, errorMessage)
            } catch {
              // Si no es JSON, usar el texto directo
              errorMessage = errorStdout.substring(0, 500) || errorMessage
            }
          } else if (errorStderr) {
            errorMessage = errorStderr.substring(0, 500)
          } else {
            errorMessage = execError.message || errorMessage
          }

          erroresArchivos.push({
            archivo: archivo.originalname,
            error: errorMessage
          })
          continue
        }

        // Limpiar archivo temporal
        try {
          if (archivo.path && existsSync(archivo.path)) {
            await fs.unlink(archivo.path)
          }
        } catch (err) {
          console.error('Error al eliminar archivo temporal:', err)
        }

        // Parsear respuesta
        const stdoutTrimmed = (stdout || '').trim()
        const stderrTrimmed = (stderr || '').trim()
        console.log(`📄 Respuesta del script para ${archivo.originalname}:`, stdoutTrimmed.substring(0, 500))
        if (stderrTrimmed) {
          console.log(`⚠️ Mensajes de depuración (stderr) para ${archivo.originalname}:`, stderrTrimmed.substring(0, 1000))
        }
        
        if (!stdoutTrimmed || stdoutTrimmed === 'null' || stdoutTrimmed.toLowerCase() === 'null') {
          console.error(`❌ Script no devolvió datos para ${archivo.originalname}`)
          erroresArchivos.push({
            archivo: archivo.originalname,
            error: 'El script no devolvió datos válidos'
          })
          continue
        }

        let resultado
        try {
          resultado = JSON.parse(stdoutTrimmed)
          console.log(`✅ JSON parseado correctamente para ${archivo.originalname}:`, {
            tieneExito: resultado.exito !== undefined,
            tieneProductos: !!resultado.productos,
            esArray: Array.isArray(resultado),
            tieneError: !!resultado.error,
            mensaje: resultado.mensaje
          })
        } catch (parseError) {
          console.error(`❌ Error al parsear JSON para ${archivo.originalname}:`, parseError.message)
          console.error(`📄 Contenido recibido:`, stdoutTrimmed.substring(0, 1000))
          erroresArchivos.push({
            archivo: archivo.originalname,
            error: `Error al parsear respuesta: ${parseError.message}. Respuesta: ${stdoutTrimmed.substring(0, 200)}`
          })
          continue
        }

        // Verificar si hay error en el resultado
        if (resultado.error) {
          console.error(`❌ Error en resultado para ${archivo.originalname}:`, resultado.error)
          erroresArchivos.push({
            archivo: archivo.originalname,
            error: resultado.error
          })
          continue
        }

        // Verificar si exito es false
        if (resultado.exito === false) {
          console.error(`❌ Script reportó error para ${archivo.originalname}:`, resultado.mensaje || resultado.error)
          erroresArchivos.push({
            archivo: archivo.originalname,
            error: resultado.mensaje || resultado.error || 'Error al procesar el archivo'
          })
          continue
        }

        // Extraer productos del resultado
        let productos = []
        if (Array.isArray(resultado)) {
          productos = resultado
        } else if (resultado.productos && Array.isArray(resultado.productos)) {
          productos = resultado.productos
        } else if (resultado.exito && resultado.productos && Array.isArray(resultado.productos)) {
          productos = resultado.productos
        } else {
          console.error(`❌ Formato de respuesta inesperado para ${archivo.originalname}:`, resultado)
          erroresArchivos.push({
            archivo: archivo.originalname,
            error: 'Formato de respuesta inesperado del script'
          })
          continue
        }

        // Si el script extrajo Balance General o Distribución de Saldo, guardarlos (incluso si el archivo no tiene productos)
        if (resultado.balanceGeneral && Object.keys(resultado.balanceGeneral).length > 0) {
          datosFinancierosExtraidos.balanceGeneral = { ...datosFinancierosExtraidos.balanceGeneral, ...resultado.balanceGeneral }
        }
        if (resultado.distribucionSaldo && Object.keys(resultado.distribucionSaldo).length > 0) {
          datosFinancierosExtraidos.distribucionSaldo = { ...datosFinancierosExtraidos.distribucionSaldo, ...resultado.distribucionSaldo }
        }

        if (productos.length === 0) {
          const tieneFinancieros = (resultado.balanceGeneral && Object.keys(resultado.balanceGeneral).length > 0) ||
            (resultado.distribucionSaldo && Object.keys(resultado.distribucionSaldo).length > 0)
          if (!tieneFinancieros) {
            console.warn(`⚠️ No se extrajeron productos de ${archivo.originalname}`)
            erroresArchivos.push({
              archivo: archivo.originalname,
              error: 'No se pudieron extraer productos del PDF'
            })
          } else {
            console.log(`📊 ${archivo.originalname}: sin productos pero con datos financieros (Balance/Distribución)`)
            archivosProcesados.push(archivo.originalname)
          }
          continue
        }

        console.log(`✅ ${productos.length} productos extraídos de ${archivo.originalname}`)
        todosProductos.push(...productos)
        archivosProcesados.push(archivo.originalname)

      } catch (error) {
        console.error(`Error procesando archivo ${archivo.originalname}:`, error)
        erroresArchivos.push({
          archivo: archivo.originalname,
          error: error.message || 'Error desconocido'
        })
      }
    }

    if (todosProductos.length === 0) {
      const mensajeError = erroresArchivos.length > 0
        ? `No se pudieron extraer productos de los archivos PDF. Errores: ${erroresArchivos.map(e => `${e.archivo}: ${e.error}`).join('; ')}`
        : 'No se pudieron extraer productos de los archivos PDF'
      console.error('❌ No se extrajeron productos:', {
        archivosProcesados: archivosProcesados.length,
        erroresArchivos: erroresArchivos.length,
        errores: erroresArchivos
      })
      throw new AppError(mensajeError, 400)
    }

    // Crear o actualizar productos del cliente
    const productosCreados = []
    const productosActualizados = []

    for (const productoData of todosProductos) {
      try {
        if (!productoData.nombre || productoData.nombre.trim() === '') {
          continue
        }

        const datosProducto = {
          clienteNegocioId: cliente.id,
          nombre: productoData.nombre.trim(),
          codigoBarras: (productoData.codigoBarras && productoData.codigoBarras.trim() !== '') 
            ? productoData.codigoBarras.trim() 
            : null,
          costoProducto: Number.parseFloat(productoData.costoBase || productoData.precio || productoData.costo || 0) || 0,
          categoria: productoData.categoria || 'General',
          unidad: productoData.unidad || 'unidad',
          creadoPorId: req.usuario.id,
        }

        // Buscar producto existente
        let productoExistente = null
        if (datosProducto.codigoBarras) {
          productoExistente = ProductoCliente.buscarPorCodigoBarras(cliente.id, datosProducto.codigoBarras)
        }

        if (!productoExistente) {
          // Buscar por nombre
          const productos = ProductoCliente.buscarPorCliente(cliente.id, {
            buscar: datosProducto.nombre,
            limite: 1
          })
          
          if (productos && productos.length > 0) {
            const productoSimilar = productos[0]
            if (productoSimilar.nombre.toLowerCase() === datosProducto.nombre.toLowerCase()) {
              productoExistente = productoSimilar
            }
          }
        }

        if (productoExistente) {
          // Actualizar producto existente
          ProductoCliente.actualizar(productoExistente.id, {
            costoProducto: datosProducto.costoProducto,
            categoria: datosProducto.categoria
          })
          productosActualizados.push({
            ...productoExistente,
            accion: 'actualizado'
          })
        } else {
          // Crear nuevo producto
          const nuevoProducto = ProductoCliente.crear(datosProducto)
          productosCreados.push({
            ...nuevoProducto,
            accion: 'creado'
          })
        }
      } catch (error) {
        console.error('Error al procesar producto:', productoData, error)
      }
    }

    // Crear sesión de inventario completada
    // Usar fecha del body si existe (fecha del inventario original), sino fecha actual
    console.log('📅 Fecha recibida en body:', req.body.fechaInventario)
    const fechaInventario = req.body.fechaInventario 
      ? new Date(req.body.fechaInventario).toISOString()
      : new Date().toISOString()
    console.log('📅 Fecha que se usará para la sesión:', fechaInventario)
    
    const datosSesion = {
      clienteNegocioId: cliente.id,
      contadorId: req.usuario.id,
      fecha: fechaInventario,
      estado: 'completada',
      configuracion: {}
    }

    const sesion = SesionInventario.crear(datosSesion)

    // Agregar productos contados a la sesión con sus cantidades del inventario importado
    const productosContadosIds = []
    const productosConCantidad = new Map() // Para almacenar cantidad anterior por producto
    
    // Primero, mapear productos con sus cantidades del inventario importado
    for (const productoData of todosProductos) {
      if (!productoData.nombre || productoData.nombre.trim() === '') {
        continue
      }
      
      const nombreNormalizado = productoData.nombre.trim().toLowerCase()
      const cantidadImportada = Number.parseInt(productoData.cantidad || 1) || 1
      const costoImportado = Number.parseFloat(productoData.costoBase || productoData.precio || productoData.costo || 0) || 0
      
      // Buscar el producto creado/actualizado correspondiente
      const productoEncontrado = productosCreados.concat(productosActualizados).find(p => 
        p.nombre.toLowerCase() === nombreNormalizado
      )
      
      if (productoEncontrado) {
        productosConCantidad.set(productoEncontrado.id, {
          cantidad: cantidadImportada,
          costo: costoImportado,
          nombre: productoEncontrado.nombre
        })
      }
    }
    
    // Agregar productos contados a la sesión
    for (const producto of productosCreados.concat(productosActualizados)) {
      try {
        const infoCantidad = productosConCantidad.get(producto.id)
        const cantidadContada = infoCantidad ? infoCantidad.cantidad : 1
        const costoProducto = infoCantidad ? infoCantidad.costo : (producto.costoProducto || producto.costoBase || 0)
        
        const productoContadoId = SesionInventario.agregarProductoContado(sesion.id, {
          productoClienteId: producto.id,
          cantidadContada: cantidadContada,
          costoProducto: costoProducto,
          agregadoPorId: req.usuario.id,
          nombreProducto: producto.nombre,
          notas: `Importado desde archivo. Cantidad anterior: ${cantidadContada}`
        })
        
        productosContadosIds.push(productoContadoId)
      } catch (error) {
        console.error('Error al agregar producto contado:', error)
      }
    }

    // Actualizar datos financieros y totales de la sesión (combinar body con datos extraídos de PDFs)
    const datosFinancierosBody = req.body.datosFinancieros || {}
    const datosFinancieros = {
      ...datosFinancierosBody,
      balanceGeneral: Object.keys(datosFinancierosExtraidos.balanceGeneral).length > 0
        ? { ...datosFinancierosBody.balanceGeneral, ...datosFinancierosExtraidos.balanceGeneral }
        : (datosFinancierosBody.balanceGeneral || {}),
      distribucionSaldo: Object.keys(datosFinancierosExtraidos.distribucionSaldo).length > 0
        ? { ...datosFinancierosBody.distribucionSaldo, ...datosFinancierosExtraidos.distribucionSaldo }
        : (datosFinancierosBody.distribucionSaldo || {})
    }
    if (Object.keys(datosFinancieros.balanceGeneral).length > 0 || Object.keys(datosFinancieros.distribucionSaldo).length > 0) {
      SesionInventario.actualizarDatosFinancieros(sesion.id, datosFinancieros)
    }
    
    // Marcar sesión como completada
    const db = dbManager.getDatabase()
    const updateStmt = db.prepare(`
      UPDATE sesiones_inventario
      SET estado = 'completada'
      WHERE id = ?
    `)
    updateStmt.run(sesion.id)

    // Obtener sesión completa con productos contados
    const sesionCompleta = SesionInventario.buscarPorId(sesion.id)

    // Calcular totales - usar productos contados de la sesión o los productos importados
    const productosContados = sesionCompleta.productosContados || []
    const totalProductos = productosContados.length > 0 
      ? productosContados.length 
      : (productosCreados.length + productosActualizados.length)
    
    // Calcular valor total desde productos contados o desde productos importados
    let valorTotal = 0
    if (productosContados.length > 0) {
      valorTotal = productosContados.reduce((sum, p) => {
        const cantidad = p.cantidadContada || 0
        const costo = p.costoProducto || 0
        return sum + (cantidad * costo)
      }, 0)
    } else if (todosProductos.length > 0) {
      // Si no hay productos contados aún, calcular desde los productos importados
      valorTotal = todosProductos.reduce((sum, p) => {
        const cantidad = p.cantidad || 1
        const costo = p.precio || p.costoBase || 0
        return sum + (cantidad * costo)
      }, 0)
    }
    
    console.log('📊 Totales calculados:', {
      totalProductos,
      valorTotal,
      productosContados: productosContados.length,
      productosImportados: todosProductos.length
    })

    // Preparar respuesta
    const respuesta = {
      sesion: {
        _id: sesionCompleta.id,
        numeroSesion: sesionCompleta.numeroSesion,
        fecha: sesionCompleta.fecha,
        estado: sesionCompleta.estado
      },
      resumen: {
        cliente: cliente.nombre,
        fecha: fechaInventario,
        totalProductos: totalProductos,
        totalGeneral: valorTotal,
        archivosProcesados: archivosProcesados.length,
        productosCreados: productosCreados.length,
        productosActualizados: productosActualizados.length,
        errores: erroresArchivos.length,
        balanceGeneral: datosFinancieros.balanceGeneral || {},
        distribucionSaldo: datosFinancieros.distribucionSaldo || {},
        productosConCantidad: Array.from(productosConCantidad.entries()).map(([id, info]) => ({
          productoId: id,
          cantidad: info.cantidad,
          costo: info.costo,
          nombre: info.nombre
        })) // Para mostrar cantidad anterior en frontend
      },
      productos: productosCreados.concat(productosActualizados),
      errores: erroresArchivos
    }

    res.json(respuestaExito(respuesta, 'Importación completada exitosamente'))
  } catch (error) {
    // Limpiar archivos temporales en caso de error
    if (req.files) {
      for (const archivo of req.files) {
        try {
          if (archivo.path && existsSync(archivo.path)) {
            await fs.unlink(archivo.path)
          }
        } catch (err) {
          console.error('Error al eliminar archivo temporal:', err)
        }
      }
    }

    if (error instanceof AppError) {
      throw error
    }

    console.error('Error en importarPDFDesdeCliente:', error)
    throw new AppError(`Error al importar PDFs: ${error.message}`, 500)
  }
}

export default {
  listarClientes,
  obtenerCliente,
  crearCliente,
  actualizarCliente,
  desactivarCliente,
  activarCliente,
  obtenerEstadisticas,
  actualizarConfiguracion,
  verificarEstadoProcesadorPDF,
  importarPDFDesdeCliente,
}
