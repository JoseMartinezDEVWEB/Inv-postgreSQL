import dbManager from '../config/database.js'
import { respuestaExito, respuestaError } from '../utils/helpers.js'
import { AppError } from '../middlewares/errorHandler.js'
import logger from '../utils/logger.js'

/**
 * Controlador de Sincronización Bidireccional
 * Maneja la sincronización Offline-First entre clientes y el servidor
 */

// Generar UUID v4
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * POST /sync/batch
 * Procesa múltiples operaciones pendientes del cliente en una sola transacción
 * Acepta: { changes: { clientes: [...], productos: [...], sesiones: [...] }, deviceId, timestamp }
 */
export const syncBatch = async (req, res) => {
  const db = dbManager.getDatabase()
  const usuarioId = req.usuario.id
  const businessId = req.usuario.contablePrincipalId || req.usuario.id // Admin es su propio business

  const { changes, deviceId, timestamp } = req.body

  if (!changes || typeof changes !== 'object') {
    throw new AppError('El campo "changes" es requerido y debe ser un objeto', 400)
  }

  logger.info(`📥 Sync Batch recibido de dispositivo: ${deviceId}`)
  
  const results = {
    processed: {},
    errors: [],
    serverTimestamp: Date.now()
  }

  // Usar transacción para atomicidad
  const transaction = db.transaction(() => {
    // Procesar Clientes
    if (changes.clientes && Array.isArray(changes.clientes)) {
      results.processed.clientes = procesarClientes(db, changes.clientes, usuarioId, businessId)
    }

    // Procesar Productos
    if (changes.productos && Array.isArray(changes.productos)) {
      results.processed.productos = procesarProductos(db, changes.productos, usuarioId, businessId)
    }

    // Procesar Sesiones
    if (changes.sesiones && Array.isArray(changes.sesiones)) {
      results.processed.sesiones = procesarSesiones(db, changes.sesiones, usuarioId, businessId)
    }

    // Procesar Productos Contados
    if (changes.productos_contados && Array.isArray(changes.productos_contados)) {
      results.processed.productos_contados = procesarProductosContados(db, changes.productos_contados, usuarioId)
    }
  })

  try {
    transaction()
    logger.info(`✅ Sync Batch completado exitosamente`)
    res.json(respuestaExito(results, 'Sincronización completada'))
  } catch (error) {
    logger.error(`❌ Error en Sync Batch: ${error.message}`)
    throw new AppError(`Error en sincronización: ${error.message}`, 500)
  }
}

/**
 * GET /sync/pull
 * Descarga cambios desde el servidor posteriores a un timestamp dado
 * Query params: lastSync (timestamp), tables (comma-separated)
 */
export const pullUpdates = async (req, res) => {
  const db = dbManager.getDatabase()
  const usuarioId = req.usuario.id
  const businessId = req.usuario.contablePrincipalId || req.usuario.id

  const { lastSync = 0, tables = 'clientes,productos,sesiones' } = req.query
  const tablesArray = tables.split(',').map(t => t.trim())

  logger.info(`📤 Pull Updates solicitado desde timestamp: ${lastSync}`)

  const updates = {}
  const serverTimestamp = Date.now()

  // Obtener clientes modificados
  if (tablesArray.includes('clientes')) {
    const clientesStmt = db.prepare(`
      SELECT * FROM clientes_negocios 
      WHERE business_id = ? AND updated_at > ?
      ORDER BY updated_at ASC
    `)
    updates.clientes = clientesStmt.all(businessId, parseInt(lastSync)).map(c => ({
      ...c,
      _id: c.id,
      configuracionInventario: JSON.parse(c.configuracionInventario || '{}'),
      estadisticas: JSON.parse(c.estadisticas || '{}')
    }))
  }

  // Obtener productos modificados
  if (tablesArray.includes('productos')) {
    const productosStmt = db.prepare(`
      SELECT * FROM productos_cliente 
      WHERE business_id = ? AND updated_at > ?
      ORDER BY updated_at ASC
    `)
    updates.productos = productosStmt.all(businessId, parseInt(lastSync)).map(p => ({
      ...p,
      _id: p.id
    }))
  }

  // Obtener sesiones modificadas
  if (tablesArray.includes('sesiones')) {
    const sesionesStmt = db.prepare(`
      SELECT si.*, cn.nombre as nombreCliente
      FROM sesiones_inventario si
      LEFT JOIN clientes_negocios cn ON si.clienteNegocioId = cn.id
      WHERE si.business_id = ? AND si.updated_at > ?
      ORDER BY si.updated_at ASC
    `)
    updates.sesiones = sesionesStmt.all(businessId, parseInt(lastSync)).map(s => ({
      ...s,
      _id: s.id,
      datosFinancieros: JSON.parse(s.datosFinancieros || '{}'),
      totales: JSON.parse(s.totales || '{}'),
      configuracion: JSON.parse(s.configuracion || '{}')
    }))
  }

  res.json(respuestaExito({
    updates,
    serverTimestamp,
    businessId
  }))
}

/**
 * GET /sync/status
 * Obtiene el estado de sincronización del usuario
 */
export const getSyncStatus = async (req, res) => {
  const db = dbManager.getDatabase()
  const businessId = req.usuario.contablePrincipalId || req.usuario.id

  const stats = {
    clientes: db.prepare('SELECT COUNT(*) as count FROM clientes_negocios WHERE business_id = ?').get(businessId).count,
    productos: db.prepare('SELECT COUNT(*) as count FROM productos_cliente WHERE business_id = ?').get(businessId).count,
    sesiones: db.prepare('SELECT COUNT(*) as count FROM sesiones_inventario WHERE business_id = ?').get(businessId).count,
    serverTimestamp: Date.now()
  }

  res.json(respuestaExito(stats))
}

// ============ FUNCIONES HELPER PARA PROCESAR CADA TABLA ============

function procesarClientes(db, clientes, usuarioId, businessId) {
  const processed = { created: 0, updated: 0, deleted: 0 }
  const timestamp = Date.now()

  for (const cliente of clientes) {
    const uuid = cliente.id_uuid || cliente.uuid || generateUUID()

    // Si está marcado como eliminado
    if (cliente.deleted === 1) {
      const deleteStmt = db.prepare('UPDATE clientes_negocios SET activo = 0, updated_at = ? WHERE uuid = ?')
      const result = deleteStmt.run(timestamp, uuid)
      if (result.changes > 0) processed.deleted++
      continue
    }

    // Verificar si existe por UUID
    const existeStmt = db.prepare('SELECT id FROM clientes_negocios WHERE uuid = ?')
    const existe = existeStmt.get(uuid)

    if (existe) {
      // Actualizar
      const updateStmt = db.prepare(`
        UPDATE clientes_negocios SET
          nombre = COALESCE(?, nombre),
          telefono = COALESCE(?, telefono),
          direccion = COALESCE(?, direccion),
          configuracionInventario = COALESCE(?, configuracionInventario),
          notas = COALESCE(?, notas),
          updated_at = ?
        WHERE uuid = ?
      `)
      updateStmt.run(
        cliente.nombre,
        cliente.telefono,
        cliente.direccion,
        cliente.configuracionInventario ? JSON.stringify(cliente.configuracionInventario) : null,
        cliente.notas,
        timestamp,
        uuid
      )
      processed.updated++
    } else {
      // Insertar nuevo
      const insertStmt = db.prepare(`
        INSERT INTO clientes_negocios (
          uuid, nombre, telefono, direccion, contadorAsignadoId,
          configuracionInventario, notas, activo, business_id, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
      `)
      insertStmt.run(
        uuid,
        cliente.nombre,
        cliente.telefono || '',
        cliente.direccion || '',
        usuarioId,
        JSON.stringify(cliente.configuracionInventario || {}),
        cliente.notas || '',
        businessId,
        usuarioId,
        timestamp,
        timestamp
      )
      processed.created++
    }
  }

  return processed
}

function procesarProductos(db, productos, usuarioId, businessId) {
  const processed = { created: 0, updated: 0, deleted: 0 }
  const timestamp = Date.now()

  for (const producto of productos) {
    const uuid = producto.id_uuid || producto.uuid || generateUUID()

    if (producto.deleted === 1) {
      const deleteStmt = db.prepare('UPDATE productos_cliente SET activo = 0, updated_at = ? WHERE uuid = ?')
      const result = deleteStmt.run(timestamp, uuid)
      if (result.changes > 0) processed.deleted++
      continue
    }

    const existeStmt = db.prepare('SELECT id FROM productos_cliente WHERE uuid = ?')
    const existe = existeStmt.get(uuid)

    if (existe) {
      const updateStmt = db.prepare(`
        UPDATE productos_cliente SET
          nombre = COALESCE(?, nombre),
          codigoBarras = COALESCE(?, codigoBarras),
          sku = COALESCE(?, sku),
          costo = COALESCE(?, costo),
          precioVenta = COALESCE(?, precioVenta),
          stock = COALESCE(?, stock),
          categoria = COALESCE(?, categoria),
          unidad = COALESCE(?, unidad),
          descripcion = COALESCE(?, descripcion),
          updated_at = ?
        WHERE uuid = ?
      `)
      updateStmt.run(
        producto.nombre,
        producto.codigoBarras,
        producto.sku,
        producto.costo,
        producto.precioVenta,
        producto.stock,
        producto.categoria,
        producto.unidad,
        producto.descripcion,
        timestamp,
        uuid
      )
      processed.updated++
    } else {
      const insertStmt = db.prepare(`
        INSERT INTO productos_cliente (
          uuid, nombre, codigoBarras, sku, costo, precioVenta, stock,
          categoria, unidad, descripcion, activo, business_id, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
      `)
      insertStmt.run(
        uuid,
        producto.nombre,
        producto.codigoBarras || '',
        producto.sku || '',
        producto.costo || 0,
        producto.precioVenta || 0,
        producto.stock || 0,
        producto.categoria || '',
        producto.unidad || 'unidad',
        producto.descripcion || '',
        businessId,
        usuarioId,
        timestamp,
        timestamp
      )
      processed.created++
    }
  }

  return processed
}

function procesarSesiones(db, sesiones, usuarioId, businessId) {
  const processed = { created: 0, updated: 0, deleted: 0 }
  const timestamp = Date.now()

  for (const sesion of sesiones) {
    const uuid = sesion.id_uuid || sesion.uuid || generateUUID()

    if (sesion.deleted === 1) {
      const deleteStmt = db.prepare('UPDATE sesiones_inventario SET estado = "cancelada", updated_at = ? WHERE uuid = ?')
      const result = deleteStmt.run(timestamp, uuid)
      if (result.changes > 0) processed.deleted++
      continue
    }

    const existeStmt = db.prepare('SELECT id FROM sesiones_inventario WHERE uuid = ?')
    const existe = existeStmt.get(uuid)

    if (existe) {
      const updateStmt = db.prepare(`
        UPDATE sesiones_inventario SET
          estado = COALESCE(?, estado),
          totales = COALESCE(?, totales),
          datosFinancieros = COALESCE(?, datosFinancieros),
          updated_at = ?
        WHERE uuid = ?
      `)
      updateStmt.run(
        sesion.estado,
        sesion.totales ? JSON.stringify(sesion.totales) : null,
        sesion.datosFinancieros ? JSON.stringify(sesion.datosFinancieros) : null,
        timestamp,
        uuid
      )
      processed.updated++
    } else {
      // Generar número de sesión
      const ahora = new Date()
      const fecha = ahora.toISOString().slice(0, 10).replace(/-/g, '')
      const countStmt = db.prepare('SELECT COUNT(*) as count FROM sesiones_inventario WHERE DATE(createdAt) = DATE("now")')
      const { count } = countStmt.get()
      const numeroSesion = `INV-${fecha}-${(count + 1).toString().padStart(3, '0')}`

      const insertStmt = db.prepare(`
        INSERT INTO sesiones_inventario (
          uuid, clienteNegocioId, contadorId, fecha, numeroSesion, estado,
          configuracion, business_id, created_by, createdAt, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      insertStmt.run(
        uuid,
        sesion.clienteNegocioId || null,
        usuarioId,
        sesion.fecha || new Date().toISOString(),
        numeroSesion,
        sesion.estado || 'en_progreso',
        JSON.stringify(sesion.configuracion || {}),
        businessId,
        usuarioId,
        timestamp,
        timestamp
      )
      processed.created++
    }
  }

  return processed
}

function procesarProductosContados(db, productosContados, usuarioId) {
  const processed = { created: 0, updated: 0, deleted: 0 }
  const timestamp = Date.now()

  for (const pc of productosContados) {
    const uuid = pc.id_uuid || pc.uuid || generateUUID()

    if (pc.deleted === 1) {
      const deleteStmt = db.prepare('DELETE FROM productos_contados WHERE uuid = ?')
      const result = deleteStmt.run(uuid)
      if (result.changes > 0) processed.deleted++
      continue
    }

    const existeStmt = db.prepare('SELECT id FROM productos_contados WHERE uuid = ?')
    const existe = existeStmt.get(uuid)

    if (existe) {
      const updateStmt = db.prepare(`
        UPDATE productos_contados SET
          cantidadContada = COALESCE(?, cantidadContada),
          valorTotal = COALESCE(?, valorTotal),
          costoProducto = COALESCE(?, costoProducto),
          notas = COALESCE(?, notas),
          updatedAt = CURRENT_TIMESTAMP
        WHERE uuid = ?
      `)
      updateStmt.run(
        pc.cantidadContada || pc.cantidad,
        pc.valorTotal,
        pc.costoProducto || pc.costo,
        pc.notas,
        uuid
      )
      processed.updated++
    } else {
      // Obtener sesionInventarioId desde uuid de sesión si viene
      let sesionId = pc.sesionInventarioId || pc.sesionId
      if (pc.sesion_uuid) {
        const sesionStmt = db.prepare('SELECT id FROM sesiones_inventario WHERE uuid = ?')
        const sesion = sesionStmt.get(pc.sesion_uuid)
        if (sesion) sesionId = sesion.id
      }

      if (!sesionId) continue // No podemos insertar sin sesión

      const insertStmt = db.prepare(`
        INSERT INTO productos_contados (
          uuid, sesionInventarioId, productoClienteId, nombreProducto,
          unidadProducto, costoProducto, skuProducto, cantidadContada,
          valorTotal, notas, agregadoPorId, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `)
      insertStmt.run(
        uuid,
        sesionId,
        pc.productoClienteId || pc.productoId,
        pc.nombreProducto,
        pc.unidadProducto || 'unidad',
        pc.costoProducto || pc.costo || 0,
        pc.skuProducto || pc.sku || '',
        pc.cantidadContada || pc.cantidad,
        pc.valorTotal || ((pc.cantidadContada || pc.cantidad) * (pc.costoProducto || pc.costo || 0)),
        pc.notas || '',
        usuarioId
      )
      processed.created++
    }
  }

  return processed
}

export default {
  syncBatch,
  pullUpdates,
  getSyncStatus
}



