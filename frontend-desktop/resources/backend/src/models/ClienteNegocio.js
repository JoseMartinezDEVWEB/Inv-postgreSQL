import dbManager from '../config/database.js'

// Generador UUID v4
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

class ClienteNegocio {
  // Verificar si una columna existe en la tabla
  static columnExists(tableName, columnName) {
    const db = dbManager.getDatabase()
    try {
      const info = db.prepare(`PRAGMA table_info(${tableName})`).all()
      return info.some(col => col.name === columnName)
    } catch (e) {
      return false
    }
  }

  // Crear nuevo cliente
  static crear(datos) {
    const db = dbManager.getDatabase()
    const timestamp = Date.now()

    const {
      nombre,
      telefono,
      direccion,
      contadorAsignadoId,
      configuracionInventario = {},
      proximaVisita = null,
      notas = null,
      uuid = null,
      business_id = null,
      created_by = null,
    } = datos

    // Verificar si las columnas de sincronización existen
    const hasUuid = ClienteNegocio.columnExists('clientes_negocios', 'uuid')
    const hasBusinessId = ClienteNegocio.columnExists('clientes_negocios', 'business_id')
    const hasCreatedBy = ClienteNegocio.columnExists('clientes_negocios', 'created_by')
    const hasCreatedAt = ClienteNegocio.columnExists('clientes_negocios', 'created_at')
    const hasUpdatedAt = ClienteNegocio.columnExists('clientes_negocios', 'updated_at')

    // Si viene uuid del frontend y la columna existe, verificar que no exista ya
    if (uuid && hasUuid) {
      const existeStmt = db.prepare('SELECT id FROM clientes_negocios WHERE uuid = ?')
      const existe = existeStmt.get(uuid)
      if (existe) {
        // Ya existe, actualizamos y retornamos
        return ClienteNegocio.actualizar(existe.id, datos)
      }
    }

    // Construir query dinámicamente según las columnas disponibles
    let columns = ['nombre', 'telefono', 'direccion', 'contadorAsignadoId', 'configuracionInventario', 'proximaVisita', 'notas', 'activo']
    let values = [nombre, telefono, direccion, contadorAsignadoId, JSON.stringify(configuracionInventario), proximaVisita, notas, 1]
    let placeholders = ['?', '?', '?', '?', '?', '?', '?', '?']

    // Agregar columnas opcionales si existen
    if (hasUuid) {
      const clienteUuid = uuid || generateUUID()
      columns.push('uuid')
      values.push(clienteUuid)
      placeholders.push('?')
    }
    
    if (hasBusinessId) {
      columns.push('business_id')
      values.push(business_id || contadorAsignadoId)
      placeholders.push('?')
    }
    
    if (hasCreatedBy) {
      columns.push('created_by')
      values.push(created_by || contadorAsignadoId)
      placeholders.push('?')
    }
    
    if (hasCreatedAt) {
      columns.push('created_at')
      values.push(timestamp)
      placeholders.push('?')
    }
    
    if (hasUpdatedAt) {
      columns.push('updated_at')
      values.push(timestamp)
      placeholders.push('?')
    }

    const stmt = db.prepare(`
      INSERT INTO clientes_negocios (
        ${columns.join(', ')}
      ) VALUES (${placeholders.join(', ')})
    `)

    const info = stmt.run(...values)

    return ClienteNegocio.buscarPorId(info.lastInsertRowid)
  }

  // Buscar cliente por ID o UUID
  static buscarPorId(id) {
    const db = dbManager.getDatabase()
    
    // Verificar si la columna uuid existe
    const tableInfo = db.prepare("PRAGMA table_info(clientes_negocios)").all()
    const hasUuid = tableInfo.some(col => col.name === 'uuid')
    
    // Verificar si es UUID o ID numérico
    const isUuid = hasUuid && typeof id === 'string' && id.includes('-')
    
    const stmt = db.prepare(`
      SELECT 
        cn.*,
        u.nombre as nombreContador,
        u.email as emailContador
      FROM clientes_negocios cn
      INNER JOIN usuarios u ON cn.contadorAsignadoId = u.id
      WHERE ${isUuid ? 'cn.uuid = ?' : 'cn.id = ?'}
    `)
    const cliente = stmt.get(id)

    if (cliente) {
      cliente.configuracionInventario = JSON.parse(cliente.configuracionInventario || '{}')
      cliente.estadisticas = JSON.parse(cliente.estadisticas || '{}')
      // Alias para compatibilidad con frontend que espera _id
      cliente._id = cliente.id
      cliente.id_uuid = cliente.uuid
    }

    return cliente
  }

  // Buscar clientes por business_id (filtro global para Colaboradores/Contadores)
  static buscarPorContador(contadorId, opciones = {}) {
    const db = dbManager.getDatabase()

    const {
      limite = 50,
      pagina = 1,
      buscar = null,
      soloActivos = true,
      businessId = null, // Nuevo: permite filtrar por business_id directamente
    } = opciones

    const offset = (pagina - 1) * limite

    // Determinar business_id: si el usuario es colaborador, usar el de su admin
    let effectiveBusinessId = businessId
    if (!effectiveBusinessId) {
      const usuarioStmt = db.prepare('SELECT contablePrincipalId FROM usuarios WHERE id = ?')
      const usuario = usuarioStmt.get(contadorId)
      effectiveBusinessId = usuario?.contablePrincipalId || contadorId
    }

    // Filtrar por business_id para asegurar que ven datos correctos del negocio
    let whereConditions = ['(cn.business_id = ? OR cn.contadorAsignadoId = ?)']
    let params = [effectiveBusinessId, contadorId]

    if (soloActivos) {
      whereConditions.push('cn.activo = 1')
    }

    if (buscar) {
      whereConditions.push('(cn.nombre LIKE ? OR cn.telefono LIKE ?)')
      const searchTerm = `%${buscar}%`
      params.push(searchTerm, searchTerm)
    }

    const whereClause = whereConditions.join(' AND ')

    // Contar total
    const countStmt = db.prepare(`
      SELECT COUNT(*) as total
      FROM clientes_negocios cn
      WHERE ${whereClause}
    `)
    const { total } = countStmt.get(...params)

    // Obtener clientes
    // Ordenar por fecha de creación descendente (más reciente primero), luego por nombre
    const orderBy = 'ORDER BY COALESCE(cn.created_at, cn.id) DESC, cn.nombre ASC'
    const stmt = db.prepare(`
      SELECT 
        cn.*,
        u.nombre as nombreContador
      FROM clientes_negocios cn
      INNER JOIN usuarios u ON cn.contadorAsignadoId = u.id
      WHERE ${whereClause}
      ${orderBy}
      LIMIT ? OFFSET ?
    `)

    const clientes = stmt.all(...params, limite, offset).map(cliente => {
      // Calcular estadísticas reales desde la base de datos
      const estadisticasStmt = db.prepare(`
        SELECT 
          COUNT(*) as totalInventarios,
          MAX(fecha) as ultimoInventario
        FROM sesiones_inventario
        WHERE clienteNegocioId = ? AND estado = 'completada'
      `)
      const estadisticasDb = estadisticasStmt.get(cliente.id)
      
      // Combinar estadísticas de BD con las guardadas (si existen)
      const estadisticasGuardadas = JSON.parse(cliente.estadisticas || '{}')
      const estadisticas = {
        totalInventarios: estadisticasDb?.totalInventarios || 0,
        ultimoInventario: estadisticasDb?.ultimoInventario || estadisticasGuardadas?.ultimoInventario || null,
        ...estadisticasGuardadas, // Mantener otras estadísticas guardadas
      }
      
      return {
        ...cliente,
        configuracionInventario: JSON.parse(cliente.configuracionInventario || '{}'),
        estadisticas: estadisticas,
        // Alias para compatibilidad con frontend que espera _id
        _id: cliente.id,
        id_uuid: cliente.uuid,
      }
    })

    return {
      datos: clientes,
      paginacion: {
        total,
        totalRegistros: total,
        pagina,
        limite,
        totalPaginas: Math.ceil(total / limite),
      },
    }
  }

  // Buscar clientes con inventario habilitado
  static buscarConInventarioHabilitado(contadorId) {
    const db = dbManager.getDatabase()
    const stmt = db.prepare(`
      SELECT 
        cn.*,
        u.nombre as nombreContador
      FROM clientes_negocios cn
      INNER JOIN usuarios u ON cn.contadorAsignadoId = u.id
      WHERE cn.contadorAsignadoId = ? AND cn.activo = 1
      ORDER BY cn.nombre
    `)

    const clientes = stmt.all(contadorId).map(cliente => {
      const configuracion = JSON.parse(cliente.configuracionInventario || '{}')
      cliente.configuracionInventario = configuracion
      cliente.estadisticas = JSON.parse(cliente.estadisticas || '{}')
      // Alias para compatibilidad con frontend que espera _id
      cliente._id = cliente.id
      return cliente
    }).filter(cliente => cliente.configuracionInventario.habilitado === true)

    return clientes
  }

  // Actualizar cliente
  static actualizar(id, datos) {
    const db = dbManager.getDatabase()
    const timestamp = Date.now()

    const campos = ['updated_at = ?']
    const valores = [timestamp]

    if (datos.nombre !== undefined) {
      campos.push('nombre = ?')
      valores.push(datos.nombre)
    }
    if (datos.telefono !== undefined) {
      campos.push('telefono = ?')
      valores.push(datos.telefono)
    }
    if (datos.direccion !== undefined) {
      campos.push('direccion = ?')
      valores.push(datos.direccion)
    }
    if (datos.configuracionInventario !== undefined) {
      campos.push('configuracionInventario = ?')
      valores.push(JSON.stringify(datos.configuracionInventario))
    }
    if (datos.proximaVisita !== undefined) {
      campos.push('proximaVisita = ?')
      valores.push(datos.proximaVisita)
    }
    if (datos.notas !== undefined) {
      campos.push('notas = ?')
      valores.push(datos.notas)
    }

    // Verificar si la columna uuid existe
    const tableInfo = db.prepare("PRAGMA table_info(clientes_negocios)").all()
    const hasUuid = tableInfo.some(col => col.name === 'uuid')
    
    // Verificar si es UUID o ID numérico
    const isUuid = hasUuid && typeof id === 'string' && id.includes('-')
    valores.push(id)

    const stmt = db.prepare(`
      UPDATE clientes_negocios 
      SET ${campos.join(', ')}
      WHERE ${isUuid ? 'uuid = ?' : 'id = ?'}
    `)

    stmt.run(...valores)
    
    // Buscar por ID numérico si actualizamos por UUID
    if (isUuid && hasUuid) {
      const findStmt = db.prepare('SELECT id FROM clientes_negocios WHERE uuid = ?')
      const found = findStmt.get(id)
      return found ? ClienteNegocio.buscarPorId(found.id) : null
    }
    
    return ClienteNegocio.buscarPorId(id)
  }

  // Desactivar cliente
  static desactivar(id) {
    const db = dbManager.getDatabase()
    const stmt = db.prepare('UPDATE clientes_negocios SET activo = 0 WHERE id = ?')
    stmt.run(id)
    return true
  }

  // Activar cliente
  static activar(id) {
    const db = dbManager.getDatabase()
    const stmt = db.prepare('UPDATE clientes_negocios SET activo = 1 WHERE id = ?')
    stmt.run(id)
    return ClienteNegocio.buscarPorId(id)
  }

  // Incrementar contador de inventarios
  static incrementarContadorInventario(id) {
    const db = dbManager.getDatabase()

    // Obtener cliente actual
    const cliente = ClienteNegocio.buscarPorId(id)
    if (!cliente) return null

    const estadisticas = cliente.estadisticas || {}
    estadisticas.totalInventarios = (estadisticas.totalInventarios || 0) + 1
    estadisticas.ultimoInventario = new Date().toISOString()

    const stmt = db.prepare(`
      UPDATE clientes_negocios 
      SET estadisticas = ?
      WHERE id = ?
    `)

    stmt.run(JSON.stringify(estadisticas), id)
    return ClienteNegocio.buscarPorId(id)
  }

  // Actualizar estadísticas
  static actualizarEstadisticas(id, valorInventario) {
    const db = dbManager.getDatabase()

    const cliente = ClienteNegocio.buscarPorId(id)
    if (!cliente) return null

    const estadisticas = cliente.estadisticas || {}
    estadisticas.totalInventarios = (estadisticas.totalInventarios || 0) + 1
    estadisticas.ultimoInventario = new Date().toISOString()

    // Calcular valor promedio
    const totalAnterior = estadisticas.totalInventarios - 1
    const valorPromedioAnterior = estadisticas.valorPromedioInventario || 0
    estadisticas.valorPromedioInventario =
      (valorPromedioAnterior * totalAnterior + valorInventario) / estadisticas.totalInventarios

    const stmt = db.prepare(`
      UPDATE clientes_negocios 
      SET estadisticas = ?
      WHERE id = ?
    `)

    stmt.run(JSON.stringify(estadisticas), id)
    return ClienteNegocio.buscarPorId(id)
  }

  // Obtener estadísticas del cliente
  static obtenerEstadisticas(id) {
    const db = dbManager.getDatabase()

    // Estadísticas de sesiones
    const sesionesStmt = db.prepare(`
      SELECT 
        COUNT(*) as totalSesiones,
        SUM(CASE WHEN estado = 'completada' THEN 1 ELSE 0 END) as sesionesCompletadas,
        MAX(fecha) as ultimaSesion
      FROM sesiones_inventario
      WHERE clienteNegocioId = ?
    `)
    const sesiones = sesionesStmt.get(id)

    // Estadísticas de productos
    const productosStmt = db.prepare(`
      SELECT COUNT(*) as totalProductos
      FROM productos_cliente
      WHERE clienteNegocioId = ? AND activo = 1
    `)
    const productos = productosStmt.get(id)

    return {
      ...sesiones,
      ...productos,
    }
  }
}

export default ClienteNegocio
