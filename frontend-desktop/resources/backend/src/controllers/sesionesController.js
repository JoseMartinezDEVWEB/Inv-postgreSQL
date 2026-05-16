import SesionInventario from '../models/SesionInventario.js'
import HistorialSesion from '../models/HistorialSesion.js'
import { respuestaExito } from '../utils/helpers.js'
import { AppError } from '../middlewares/errorHandler.js'
import dbManager from '../config/database.js'

// Listar sesiones
export const listarSesiones = async (req, res) => {
  const {
    pagina = 1,
    limite = 20,
    estado,
    fechaDesde,
    fechaHasta,
    clienteId,
  } = req.query

  const resultado = SesionInventario.buscar({
    pagina: parseInt(pagina),
    limite: parseInt(limite),
    contadorId: req.usuario.id,
    estado,
    fechaDesde,
    fechaHasta,
    clienteId: clienteId ? parseInt(clienteId) : null,
  })

  res.json(respuestaExito(resultado))
}

// Obtener sesión por ID
export const obtenerSesion = async (req, res) => {
  const { id } = req.params

  const sesion = SesionInventario.buscarPorId(id)

  if (!sesion) {
    throw new AppError('Sesión no encontrada', 404)
  }

  // Verificar permisos
  if (sesion.contadorId !== req.usuario.id && req.usuario.rol !== 'administrador') {
    throw new AppError('No tiene permisos para ver esta sesión', 403)
  }

  res.json(respuestaExito(sesion))
}

// Crear nueva sesión
export const crearSesion = async (req, res) => {
  const datosSesion = {
    ...req.body,
    contadorId: req.usuario.id,
  }

  const sesion = SesionInventario.crear(datosSesion)

  // Registrar en historial
  HistorialSesion.registrar({
    sesionId: sesion.id,
    usuarioId: req.usuario.id,
    accion: 'sesion_creada',
    descripcion: 'Sesión de inventario creada',
  })

  res.status(201).json(respuestaExito(sesion, 'Sesión creada'))
}

// Agregar producto a sesión
export const agregarProducto = async (req, res) => {
  const { id } = req.params
  const datosProducto = {
    ...req.body,
    agregadoPorId: req.usuario.id,
  }

  const sesion = SesionInventario.buscarPorId(id)

  if (!sesion) {
    throw new AppError('Sesión no encontrada', 404)
  }

  if (sesion.estado === 'completada' || sesion.estado === 'cancelada') {
    throw new AppError('No se puede modificar una sesión completada o cancelada', 400)
  }

  const productoId = SesionInventario.agregarProductoContado(id, datosProducto)

  // Registrar en historial
  HistorialSesion.registrar({
    sesionId: id,
    usuarioId: req.usuario.id,
    accion: 'producto_agregado',
    descripcion: `Producto agregado a la sesión`,
    metadata: { productoId },
  })

  const sesionActualizada = SesionInventario.buscarPorId(id)

  res.json(respuestaExito(sesionActualizada, 'Producto agregado'))
}

// Actualizar producto en sesión
export const actualizarProducto = async (req, res) => {
  const { id, productoId } = req.params

  const sesion = SesionInventario.buscarPorId(id)

  if (!sesion) {
    throw new AppError('Sesión no encontrada', 404)
  }

  if (sesion.estado === 'completada' || sesion.estado === 'cancelada') {
    throw new AppError('No se puede modificar una sesión completada o cancelada', 400)
  }

  // El productoId en la URL es el ID del producto contado (productos_contados.id)
  // Verificar si el producto contado existe
  const db = dbManager.getDatabase()
  const productoContadoStmt = db.prepare(`
    SELECT * FROM productos_contados 
    WHERE id = ? AND sesionInventarioId = ?
  `)
  const productoContado = productoContadoStmt.get(parseInt(productoId), parseInt(id))

  if (!productoContado) {
    throw new AppError('Producto no encontrado en la sesión (puede haber sido eliminado)', 404)
  }

  try {
    // Preparar datos para actualización
    const datosProducto = {
      ...req.body,
      // Si viene productoClienteId, usarlo, de lo contrario mantener el existente
      productoClienteId: req.body.productoClienteId || productoContado.productoClienteId,
      agregadoPorId: req.usuario.id,
      id: parseInt(productoId), // Pasamos ID explícito para actualizar por ID
    }

    // Si estamos actualizando nombre/costo, asegurarnos de que se pasen explícitamente si cambiaron
    // O si no vienen en el body, usar los del producto contado para no perderlos
    if (datosProducto.nombreProducto === undefined) {
      datosProducto.nombreProducto = productoContado.nombreProducto
    }

    if (datosProducto.costoProducto === undefined) {
      datosProducto.costoProducto = productoContado.costoProducto
    }

    // Si solo estamos actualizando datos informativos y no cantidades, podemos optimizar
    // pero por seguridad usamos la lógica centralizada
    SesionInventario.agregarProductoContado(id, datosProducto)

    // Registrar en historial (solo si es un cambio significativo para no llenar el log)
    // Opcional: Podríamos filtrar updates muy frecuentes
    HistorialSesion.registrar({
      sesionId: id,
      usuarioId: req.usuario.id,
      accion: 'producto_actualizado',
      descripcion: `Producto actualizado: ${productoContado.nombreProducto}`,
      metadata: { productoId, cambios: Object.keys(req.body) },
    })

    // Retorno optimizado: No devolver toda la sesión si no es necesario,
    // pero el frontend actual espera la sesión completa.
    // TODO: Para mayor fluidez, el frontend debería actualizar su estado localmente
    // y aquí podríamos devolver solo el producto actualizado o un OK.
    const sesionActualizada = SesionInventario.buscarPorId(id)

    res.json(respuestaExito(sesionActualizada, 'Producto actualizado'))
  } catch (error) {
    console.error('❌ Error al actualizar producto:', error)
    if (error.code === 'SQLITE_CONSTRAINT') {
      throw new AppError('Error de restricción en base de datos al actualizar producto', 400)
    }
    throw new AppError(`Error al actualizar producto: ${error.message}`, 500)
  }
}

// Remover producto de sesión
export const removerProducto = async (req, res) => {
  const { id, productoId } = req.params

  const sesion = SesionInventario.buscarPorId(id)

  if (!sesion) {
    throw new AppError('Sesión no encontrada', 404)
  }

  if (sesion.estado === 'completada' || sesion.estado === 'cancelada') {
    throw new AppError('No se puede modificar una sesión completada o cancelada', 400)
  }

  const eliminado = SesionInventario.removerProductoContado(id, productoId)

  if (!eliminado) {
    throw new AppError('Producto no encontrado en la sesión', 404)
  }

  // Registrar en historial
  HistorialSesion.registrar({
    sesionId: id,
    usuarioId: req.usuario.id,
    accion: 'producto_removido',
    descripcion: `Producto removido de la sesión`,
    metadata: { productoId },
  })

  const sesionActualizada = SesionInventario.buscarPorId(id)

  res.json(respuestaExito(sesionActualizada, 'Producto removido'))
}

// Actualizar datos financieros
export const actualizarDatosFinancieros = async (req, res) => {
  const { id } = req.params

  // Log para depuración - ver qué datos llegan
  console.log('📊 [FINANCIEROS] ================================')
  console.log('📊 [FINANCIEROS] Sesión ID:', id)
  console.log('📊 [FINANCIEROS] Datos recibidos:')
  console.log('   - deudaANegocio:', req.body.deudaANegocio)
  console.log('   - deudaANegocioDetalle:', JSON.stringify(req.body.deudaANegocioDetalle))
  console.log('   - Todos los campos:', Object.keys(req.body))

  const sesion = SesionInventario.buscarPorId(id)

  if (!sesion) {
    throw new AppError('Sesión no encontrada', 404)
  }

  if (sesion.estado === 'completada') {
    throw new AppError('No se puede modificar una sesión completada', 400)
  }

  const sesionActualizada = SesionInventario.actualizarDatosFinancieros(id, req.body)

  // Log para ver qué se guardó
  console.log('📊 [FINANCIEROS] Datos guardados:')
  console.log('   - deudaANegocio:', sesionActualizada?.datosFinancieros?.deudaANegocio)
  console.log('   - deudaANegocioDetalle:', JSON.stringify(sesionActualizada?.datosFinancieros?.deudaANegocioDetalle))
  console.log('📊 [FINANCIEROS] ================================')

  // Registrar en historial
  HistorialSesion.registrar({
    sesionId: id,
    usuarioId: req.usuario.id,
    accion: 'datos_financieros_actualizados',
    descripcion: 'Datos financieros actualizados',
  })

  res.json(respuestaExito(sesionActualizada, 'Datos financieros actualizados'))
}

// Completar sesión
export const completarSesion = async (req, res) => {
  const { id } = req.params

  const sesion = SesionInventario.buscarPorId(id)

  if (!sesion) {
    throw new AppError('Sesión no encontrada', 404)
  }

  if (sesion.estado === 'completada') {
    throw new AppError('La sesión ya está completada', 400)
  }

  const sesionCompletada = SesionInventario.completarSesion(id)

  // Registrar en historial
  HistorialSesion.registrar({
    sesionId: id,
    usuarioId: req.usuario.id,
    accion: 'sesion_completada',
    descripcion: 'Sesión completada',
  })

  res.json(respuestaExito(sesionCompletada, 'Sesión completada'))
}

// Cancelar sesión
export const cancelarSesion = async (req, res) => {
  const { id } = req.params

  const sesion = SesionInventario.buscarPorId(id)

  if (!sesion) {
    throw new AppError('Sesión no encontrada', 404)
  }

  if (sesion.estado === 'completada' || sesion.estado === 'cancelada') {
    throw new AppError('La sesión ya está finalizada', 400)
  }

  const sesionCancelada = SesionInventario.cancelarSesion(id)

  // Registrar en historial
  HistorialSesion.registrar({
    sesionId: id,
    usuarioId: req.usuario.id,
    accion: 'sesion_cancelada',
    descripcion: 'Sesión cancelada',
  })

  res.json(respuestaExito(sesionCancelada, 'Sesión cancelada'))
}

// Pausar timer
export const pausarTimer = async (req, res) => {
  const { id } = req.params

  const sesion = SesionInventario.buscarPorId(id)

  if (!sesion) {
    throw new AppError('Sesión no encontrada', 404)
  }

  SesionInventario.pausarTimer(id)

  const sesionActualizada = SesionInventario.buscarPorId(id)

  res.json(respuestaExito(sesionActualizada, 'Timer pausado'))
}

// Reanudar timer
export const reanudarTimer = async (req, res) => {
  const { id } = req.params

  const sesion = SesionInventario.buscarPorId(id)

  if (!sesion) {
    throw new AppError('Sesión no encontrada', 404)
  }

  SesionInventario.reanudarTimer(id)

  const sesionActualizada = SesionInventario.buscarPorId(id)

  res.json(respuestaExito(sesionActualizada, 'Timer reanudado'))
}

// Obtener sesiones de un cliente
export const obtenerSesionesPorCliente = async (req, res) => {
  const { clienteId } = req.params
  const { limite = 10 } = req.query

  const sesiones = SesionInventario.buscarPorCliente(clienteId, parseInt(limite))

  res.json(respuestaExito(sesiones))
}

// Obtener resumen de agenda
export const obtenerAgendaResumen = async (req, res) => {
  const contadorId = req.usuario.id
  const mesActual = new Date().toISOString().slice(0, 7) // YYYY-MM
  const { mes = mesActual } = req.query

  try {
    const [year, month] = mes.split('-').map(Number)
    const fechaDesde = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const fechaHasta = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    const db = dbManager.getDatabase()

    // Obtener conteo de sesiones por día del mes
    const query = `
      SELECT 
        DATE(fecha) as fecha,
        COUNT(*) as total
      FROM sesiones_inventario
      WHERE contadorId = ? 
        AND DATE(fecha) >= ? 
        AND DATE(fecha) <= ?
      GROUP BY DATE(fecha)
      ORDER BY fecha ASC
    `

    const resumen = db.prepare(query).all(contadorId, fechaDesde, fechaHasta)

    res.json(respuestaExito({ resumen }))
  } catch (error) {
    console.error('❌ Error en obtenerAgendaResumen:', error.message)
    throw new AppError('Error al obtener resumen de agenda', 500)
  }
}

// Obtener sesiones del día
export const obtenerAgendaDia = async (req, res) => {
  const contadorId = req.usuario.id
  const { fecha = new Date().toISOString().split('T')[0] } = req.query

  const db = dbManager.getDatabase()

  // Obtener sesiones del día específico con información del cliente
  const query = `
    SELECT 
      s.*,
      c.id as cliente_id,
      c.nombre as cliente_nombre
    FROM sesiones_inventario s
    LEFT JOIN clientes_negocios c ON s.clienteNegocioId = c.id
    WHERE s.contadorId = ? 
      AND DATE(s.fecha) = ?
    ORDER BY s.createdAt DESC
  `

  try {
    const sesionesRaw = db.prepare(query).all(contadorId, fecha)

    // Formatear las sesiones
    const sesiones = sesionesRaw.map(s => ({
      _id: s.id,
      id: s.id,
      numeroSesion: s.numeroSesion,
      nombre: s.nombre,
      descripcion: s.descripcion,
      fecha: s.fecha,
      estado: s.estado,
      contadorId: s.contadorId,
      clienteNegocioId: s.clienteNegocioId,
      clienteNegocio: s.cliente_id ? {
        _id: s.cliente_id,
        id: s.cliente_id,
        nombre: s.cliente_nombre,
      } : null,
      totales: JSON.parse(s.totales || '{}'),
      configuracion: JSON.parse(s.configuracion || '{}'),
      duracionSegundos: s.duracionSegundos,
      pausas: JSON.parse(s.pausas || '[]'),
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }))

    res.json(respuestaExito({ sesiones }))
  } catch (error) {
    console.error('❌ Error en obtenerAgendaDia:', error.message)
    throw new AppError('Error al obtener sesiones del día', 500)
  }
}

// Obtener la última sesión previa de un cliente (para comparación histórica)
export const obtenerUltimaPrevia = async (req, res) => {
  const { clienteId, sesionIdActual } = req.params
  const db = dbManager.getDatabase()

  const stmt = db.prepare(`
    SELECT si.*, cn.nombre as nombreCliente
    FROM sesiones_inventario si
    INNER JOIN clientes_negocios cn ON si.clienteNegocioId = cn.id
    WHERE si.clienteNegocioId = ?
      AND si.id != ?
      AND si.estado = 'completada'
    ORDER BY si.fecha DESC, si.createdAt DESC
    LIMIT 1
  `)

  const sesionPrevia = stmt.get(parseInt(clienteId), parseInt(sesionIdActual))

  if (!sesionPrevia) {
    return res.json(respuestaExito(null, 'No hay sesión previa'))
  }

  const sesionCompleta = SesionInventario.buscarPorId(sesionPrevia.id)
  res.json(respuestaExito(sesionCompleta))
}

export default {
  listarSesiones,
  obtenerSesion,
  crearSesion,
  agregarProducto,
  actualizarProducto,
  removerProducto,
  actualizarDatosFinancieros,
  completarSesion,
  cancelarSesion,
  pausarTimer,
  reanudarTimer,
  obtenerSesionesPorCliente,
  obtenerUltimaPrevia,
  obtenerAgendaResumen,
  obtenerAgendaDia,
}
