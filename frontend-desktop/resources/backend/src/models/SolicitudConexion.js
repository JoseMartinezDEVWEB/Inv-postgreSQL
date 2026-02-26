import { randomBytes } from 'crypto'
import dbManager from '../config/database.js'

// Estados de conexión posibles
const ESTADOS_CONEXION = {
  CONECTADO: 'conectado',
  ESPERANDO_RECONEXION: 'esperando_reconexion',
  DESCONECTADO: 'desconectado'
}

// Timeout para considerar desconectado (en segundos)
const TIMEOUT_CONEXION = 60 // 60 segundos sin ping = esperando reconexión
const TIMEOUT_DESCONEXION = 300 // 5 minutos sin ping = desconectado

class SolicitudConexion {
  // Generar código de conexión único
  static generarCodigoConexion() {
    return randomBytes(12).toString('hex').toUpperCase()
  }

  // Crear nueva solicitud
  static crear(datos) {
    const db = dbManager.getDatabase()

    const {
      contableId,
      nombreColaborador,
      metadata = {},
    } = datos

    const codigoConexion = SolicitudConexion.generarCodigoConexion()
    const expiraEn = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString() // 72 horas

    const stmt = db.prepare(`
      INSERT INTO solicitudes_conexion (contableId, nombreColaborador, codigoConexion, expiraEn, metadata, estadoConexion)
      VALUES (?, ?, ?, ?, ?, 'desconectado')
    `)

    const info = stmt.run(contableId, nombreColaborador, codigoConexion, expiraEn, JSON.stringify(metadata))

    return SolicitudConexion.buscarPorId(info.lastInsertRowid)
  }

  // Buscar por ID
  static buscarPorId(id) {
    const db = dbManager.getDatabase()
    const stmt = db.prepare('SELECT * FROM solicitudes_conexion WHERE id = ?')
    const solicitud = stmt.get(id)

    if (solicitud) {
      solicitud.metadata = JSON.parse(solicitud.metadata || '{}')

      // Obtener productos offline
      solicitud.productosOffline = SolicitudConexion.obtenerProductosOffline(id)
      // Alias para compatibilidad con frontend que espera _id
      solicitud._id = solicitud.id
    }

    return solicitud
  }

  // Buscar por código
  static buscarPorCodigo(codigo) {
    const db = dbManager.getDatabase()
    const stmt = db.prepare('SELECT * FROM solicitudes_conexion WHERE codigoConexion = ?')
    const solicitud = stmt.get(codigo)

    if (solicitud) {
      solicitud.metadata = JSON.parse(solicitud.metadata || '{}')
      solicitud.productosOffline = SolicitudConexion.obtenerProductosOffline(solicitud.id)
      // Alias para compatibilidad con frontend que espera _id
      solicitud._id = solicitud.id
    }

    return solicitud
  }

  // Buscar solicitudes pendientes de un contable
  static buscarPendientes(contableId) {
    const db = dbManager.getDatabase()
    const stmt = db.prepare(`
      SELECT * FROM solicitudes_conexion
      WHERE contableId = ? AND estado = 'pendiente'
      ORDER BY createdAt DESC
    `)

    const solicitudes = stmt.all(contableId)

    return solicitudes.map(sol => ({
      ...sol,

      metadata: JSON.parse(sol.metadata || '{}'),
      // Alias para compatibilidad con frontend que espera _id
      _id: sol.id,
    }))
  }

  // Buscar solicitudes conectadas de un contable
  static buscarConectados(contableId) {
    const db = dbManager.getDatabase()
    
    // Primero actualizar estados basados en timeout
    SolicitudConexion.actualizarEstadosConexion()
    
    const stmt = db.prepare(`
      SELECT * FROM solicitudes_conexion
      WHERE contableId = ? AND estado = 'aceptada'
      ORDER BY aceptadaEn DESC
    `)

    const solicitudes = stmt.all(contableId)

    return solicitudes.map(sol => ({
      ...sol,
      metadata: JSON.parse(sol.metadata || '{}'),
      // Alias para compatibilidad con frontend que espera _id
      _id: sol.id,
      // Incluir estado de conexión (puede ser 'conectado', 'esperando_reconexion', 'desconectado')
      estadoConexion: sol.estadoConexion || 'desconectado',
    }))
  }

  // Aceptar solicitud
  static aceptar(id) {
    const db = dbManager.getDatabase()
    const stmt = db.prepare(`
      UPDATE solicitudes_conexion
      SET estado = 'aceptada', aceptadaEn = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
    stmt.run(id)

    return SolicitudConexion.buscarPorId(id)
  }

  // Rechazar solicitud
  static rechazar(id) {
    const db = dbManager.getDatabase()
    const stmt = db.prepare(`
      UPDATE solicitudes_conexion
      SET estado = 'rechazada', rechazadaEn = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
    stmt.run(id)

    return SolicitudConexion.buscarPorId(id)
  }

  // Desconectar
  static desconectar(id) {
    const db = dbManager.getDatabase()
    const stmt = db.prepare(`
      UPDATE solicitudes_conexion
      SET estado = 'desconectada', desconectadaEn = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
    stmt.run(id)

    return SolicitudConexion.buscarPorId(id)
  }

  // Agregar producto offline
  static agregarProductoOffline(solicitudId, productoData) {
    const db = dbManager.getDatabase()

    const {
      nombre,
      costo = 0,
      cantidad = 1,
      unidad = 'unidad',
      categoria = 'General',
      sku = null,
      codigoBarras = null,
    } = productoData

    // Verificar si las columnas existen (para compatibilidad con migraciones)
    const tableInfo = db.prepare("PRAGMA table_info(productos_offline)").all()
    const hasCantidad = tableInfo.some(col => col.name === 'cantidad')
    const hasSku = tableInfo.some(col => col.name === 'sku')
    const hasCodigoBarras = tableInfo.some(col => col.name === 'codigoBarras')

    let stmt
    if (hasCantidad && hasSku && hasCodigoBarras) {
      stmt = db.prepare(`
        INSERT INTO productos_offline (solicitudConexionId, nombre, costo, cantidad, unidad, categoria, sku, codigoBarras)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      const info = stmt.run(solicitudId, nombre, costo, cantidad, unidad, categoria, sku, codigoBarras)
      return info.lastInsertRowid
    } else if (hasCantidad) {
      stmt = db.prepare(`
        INSERT INTO productos_offline (solicitudConexionId, nombre, costo, cantidad, unidad, categoria)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      const info = stmt.run(solicitudId, nombre, costo, cantidad, unidad, categoria)
      return info.lastInsertRowid
    } else {
      // Fallback para tablas antiguas sin cantidad
      stmt = db.prepare(`
        INSERT INTO productos_offline (solicitudConexionId, nombre, costo, unidad, categoria)
        VALUES (?, ?, ?, ?, ?)
      `)
      const info = stmt.run(solicitudId, nombre, costo, unidad, categoria)
      return info.lastInsertRowid
    }
  }

  // Obtener productos offline
  static obtenerProductosOffline(solicitudId) {
    const db = dbManager.getDatabase()
    const stmt = db.prepare(`
      SELECT * FROM productos_offline
      WHERE solicitudConexionId = ?
      ORDER BY createdAt
    `)

    const productos = stmt.all(solicitudId)

    return productos.map(prod => ({
      ...prod,
      sincronizado: Boolean(prod.sincronizado),
    }))
  }

  // Sincronizar productos offline
  static sincronizarProductos(solicitudId, temporalIds) {
    const db = dbManager.getDatabase()

    // Aceptar tanto array como objeto
    const ids = Array.isArray(temporalIds) ? temporalIds : Object.keys(temporalIds)
    
    if (ids.length === 0) {
      return true
    }

    const stmt = db.prepare(`
      UPDATE productos_offline
      SET sincronizado = 1
      WHERE id = ? AND solicitudConexionId = ?
    `)

    for (const id of ids) {
      stmt.run(id, solicitudId)
    }

    return true
  }

  // ============================================
  // GESTIÓN DE ESTADOS DE CONEXIÓN
  // ============================================

  // Actualizar ping del colaborador (llamado periódicamente)
  static actualizarPing(solicitudId) {
    const db = dbManager.getDatabase()
    const ahora = new Date().toISOString()
    
    const stmt = db.prepare(`
      UPDATE solicitudes_conexion
      SET ultimoPing = ?, estadoConexion = 'conectado', ultimaConexion = ?
      WHERE id = ?
    `)
    stmt.run(ahora, ahora, solicitudId)
    
    return SolicitudConexion.buscarPorId(solicitudId)
  }

  // Marcar como conectado
  static marcarConectado(solicitudId) {
    const db = dbManager.getDatabase()
    const ahora = new Date().toISOString()
    
    const stmt = db.prepare(`
      UPDATE solicitudes_conexion
      SET estadoConexion = 'conectado', ultimoPing = ?, ultimaConexion = ?
      WHERE id = ?
    `)
    stmt.run(ahora, ahora, solicitudId)
    
    return SolicitudConexion.buscarPorId(solicitudId)
  }

  // Marcar como desconectado (cierre de sesión voluntario)
  static marcarDesconectado(solicitudId) {
    const db = dbManager.getDatabase()
    
    const stmt = db.prepare(`
      UPDATE solicitudes_conexion
      SET estadoConexion = 'desconectado'
      WHERE id = ?
    `)
    stmt.run(solicitudId)
    
    return SolicitudConexion.buscarPorId(solicitudId)
  }

  // Actualizar estados basados en timeout (llamar periódicamente)
  static actualizarEstadosConexion() {
    const db = dbManager.getDatabase()
    const ahora = Date.now()
    
    // Obtener todas las solicitudes aceptadas
    const solicitudes = db.prepare(`
      SELECT id, ultimoPing, estadoConexion FROM solicitudes_conexion
      WHERE estado = 'aceptada'
    `).all()
    
    for (const sol of solicitudes) {
      if (!sol.ultimoPing) continue
      
      const ultimoPing = new Date(sol.ultimoPing).getTime()
      const segundosSinPing = (ahora - ultimoPing) / 1000
      
      let nuevoEstado = sol.estadoConexion
      
      if (segundosSinPing > TIMEOUT_DESCONEXION) {
        nuevoEstado = ESTADOS_CONEXION.DESCONECTADO
      } else if (segundosSinPing > TIMEOUT_CONEXION) {
        nuevoEstado = ESTADOS_CONEXION.ESPERANDO_RECONEXION
      } else {
        nuevoEstado = ESTADOS_CONEXION.CONECTADO
      }
      
      if (nuevoEstado !== sol.estadoConexion) {
        db.prepare(`
          UPDATE solicitudes_conexion SET estadoConexion = ? WHERE id = ?
        `).run(nuevoEstado, sol.id)
      }
    }
  }

  // ============================================
  // GESTIÓN DE COLA DE PRODUCTOS
  // ============================================

  // Crear una nueva cola de productos para un colaborador
  static crearColaProductos(solicitudId, sesionInventarioId, productos = []) {
    const db = dbManager.getDatabase()
    
    const stmt = db.prepare(`
      INSERT INTO cola_productos_colaborador (solicitudConexionId, sesionInventarioId, totalProductos, estado)
      VALUES (?, ?, ?, 'pendiente')
    `)
    
    const info = stmt.run(solicitudId, sesionInventarioId, productos.length)
    const colaId = info.lastInsertRowid
    
    // Asociar los productos a esta cola
    if (productos.length > 0) {
      const updateStmt = db.prepare(`
        UPDATE productos_offline SET colaId = ? WHERE id = ?
      `)
      
      for (const prod of productos) {
        updateStmt.run(colaId, prod.id)
      }
    }
    
    return SolicitudConexion.obtenerCola(colaId)
  }

  // Obtener cola por ID
  static obtenerCola(colaId) {
    const db = dbManager.getDatabase()
    const cola = db.prepare(`SELECT * FROM cola_productos_colaborador WHERE id = ?`).get(colaId)
    
    if (cola) {
      cola.productos = db.prepare(`
        SELECT * FROM productos_offline WHERE colaId = ?
      `).all(colaId)
    }
    
    return cola
  }

  // Obtener colas pendientes de un contable
  static obtenerColasPendientes(contableId) {
    const db = dbManager.getDatabase()
    
    const colas = db.prepare(`
      SELECT cpc.*, sc.nombreColaborador, sc.metadata
      FROM cola_productos_colaborador cpc
      INNER JOIN solicitudes_conexion sc ON cpc.solicitudConexionId = sc.id
      WHERE sc.contableId = ? AND cpc.estado IN ('pendiente', 'en_revision')
      ORDER BY cpc.enviadoEn DESC
    `).all(contableId)
    
    // Agregar productos a cada cola
    for (const cola of colas) {
      cola.metadata = JSON.parse(cola.metadata || '{}')
      cola.productos = db.prepare(`
        SELECT * FROM productos_offline WHERE colaId = ?
      `).all(cola.id)
    }
    
    return colas
  }

  // Marcar cola en revisión
  static marcarColaEnRevision(colaId) {
    const db = dbManager.getDatabase()
    
    db.prepare(`
      UPDATE cola_productos_colaborador 
      SET estado = 'en_revision', revisadoEn = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(colaId)
    
    return SolicitudConexion.obtenerCola(colaId)
  }

  // Aceptar productos de una cola (puede ser parcial)
  static aceptarProductosCola(colaId, productosIds, notas = '') {
    const db = dbManager.getDatabase()
    
    // Marcar productos como aceptados
    const stmt = db.prepare(`
      UPDATE productos_offline 
      SET estadoRevision = 'aceptado', sincronizado = 1
      WHERE id = ? AND colaId = ?
    `)
    
    for (const prodId of productosIds) {
      stmt.run(prodId, colaId)
    }
    
    // Actualizar contadores de la cola
    const cola = db.prepare(`SELECT * FROM cola_productos_colaborador WHERE id = ?`).get(colaId)
    const aceptados = db.prepare(`
      SELECT COUNT(*) as count FROM productos_offline WHERE colaId = ? AND estadoRevision = 'aceptado'
    `).get(colaId).count
    const rechazados = db.prepare(`
      SELECT COUNT(*) as count FROM productos_offline WHERE colaId = ? AND estadoRevision = 'rechazado'
    `).get(colaId).count
    
    let nuevoEstado = 'parcial'
    if (aceptados === cola.totalProductos) {
      nuevoEstado = 'aceptado'
    } else if (rechazados === cola.totalProductos) {
      nuevoEstado = 'rechazado'
    } else if (aceptados + rechazados === cola.totalProductos) {
      nuevoEstado = 'parcial'
    }
    
    db.prepare(`
      UPDATE cola_productos_colaborador 
      SET productosAceptados = ?, productosRechazados = ?, estado = ?, notas = ?, aceptadoEn = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(aceptados, rechazados, nuevoEstado, notas, colaId)
    
    return SolicitudConexion.obtenerCola(colaId)
  }

  // Rechazar productos de una cola
  static rechazarProductosCola(colaId, productosIds, notas = '') {
    const db = dbManager.getDatabase()
    
    const stmt = db.prepare(`
      UPDATE productos_offline 
      SET estadoRevision = 'rechazado'
      WHERE id = ? AND colaId = ?
    `)
    
    for (const prodId of productosIds) {
      stmt.run(prodId, colaId)
    }
    
    // Actualizar contadores
    const cola = db.prepare(`SELECT * FROM cola_productos_colaborador WHERE id = ?`).get(colaId)
    const aceptados = db.prepare(`
      SELECT COUNT(*) as count FROM productos_offline WHERE colaId = ? AND estadoRevision = 'aceptado'
    `).get(colaId).count
    const rechazados = db.prepare(`
      SELECT COUNT(*) as count FROM productos_offline WHERE colaId = ? AND estadoRevision = 'rechazado'
    `).get(colaId).count
    
    let nuevoEstado = 'parcial'
    if (rechazados === cola.totalProductos) {
      nuevoEstado = 'rechazado'
    } else if (aceptados + rechazados === cola.totalProductos) {
      nuevoEstado = aceptados > 0 ? 'parcial' : 'rechazado'
    }
    
    db.prepare(`
      UPDATE cola_productos_colaborador 
      SET productosAceptados = ?, productosRechazados = ?, estado = ?, notas = ?, rechazadoEn = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(aceptados, rechazados, nuevoEstado, notas, colaId)
    
    return SolicitudConexion.obtenerCola(colaId)
  }

  // Enviar productos como cola (desde colaborador)
  static enviarProductosComoCola(solicitudId, sesionInventarioId) {
    const db = dbManager.getDatabase()
    
    // Obtener productos no enviados a cola
    const productosNoEnCola = db.prepare(`
      SELECT * FROM productos_offline 
      WHERE solicitudConexionId = ? AND colaId IS NULL AND sincronizado = 0
    `).all(solicitudId)
    
    if (productosNoEnCola.length === 0) {
      return null
    }
    
    return SolicitudConexion.crearColaProductos(solicitudId, sesionInventarioId, productosNoEnCola)
  }
}

// Exportar constantes también
export { ESTADOS_CONEXION, TIMEOUT_CONEXION, TIMEOUT_DESCONEXION }
export default SolicitudConexion
