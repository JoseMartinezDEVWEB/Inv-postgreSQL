import dbManager from '../config/database.js'

class ProductoCliente {
  // Crear nuevo producto de cliente
  static crear(datos) {
    const db = dbManager.getDatabase()

    const {
      nombre,
      descripcion = null,
      costo,
      unidad,
      sku = null,
      clienteNegocioId,
      categoria = 'General',
      tipoContenedor = 'ninguno',
      tieneUnidadesInternas = false,
      unidadesInternas = {},
      tipoPeso = 'ninguno',
      esProductoSecundario = false,
      productoPadreId = null,
      productoHijoId = null,
      codigoBarras = null,
      proveedor = null,
      creadoPorId = null,
      tipoCreacion = 'usuario',
      configuracion = {},
    } = datos

    const stmt = db.prepare(`
      INSERT INTO productos_cliente (
        nombre, descripcion, costo, unidad, sku, clienteNegocioId,
        categoria, tipoContenedor, tieneUnidadesInternas, unidadesInternas,
        tipoPeso, esProductoSecundario, productoPadreId, productoHijoId,
        codigoBarras, proveedor, creadoPorId, tipoCreacion, configuracion, activo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const info = stmt.run(
      nombre,
      descripcion,
      costo,
      unidad,
      sku,
      clienteNegocioId,
      categoria,
      tipoContenedor,
      tieneUnidadesInternas ? 1 : 0,
      JSON.stringify(unidadesInternas),
      tipoPeso,
      esProductoSecundario ? 1 : 0,
      productoPadreId,
      productoHijoId,
      codigoBarras,
      proveedor,
      creadoPorId,
      tipoCreacion,
      JSON.stringify(configuracion),
      1
    )

    return ProductoCliente.buscarPorId(info.lastInsertRowid)
  }

  // Buscar producto por ID
  static buscarPorId(id) {
    const db = dbManager.getDatabase()
    const stmt = db.prepare('SELECT * FROM productos_cliente WHERE id = ?')
    const producto = stmt.get(id)

    if (producto) {
      producto.unidadesInternas = JSON.parse(producto.unidadesInternas || '{}')
      producto.estadisticas = JSON.parse(producto.estadisticas || '{}')
      producto.configuracion = JSON.parse(producto.configuracion || '{}')
      producto.tieneUnidadesInternas = Boolean(producto.tieneUnidadesInternas)
      producto.esProductoSecundario = Boolean(producto.esProductoSecundario)
      producto.activo = Boolean(producto.activo)
    }

    return producto
  }

  // Buscar productos de un cliente
  static buscarPorCliente(clienteId, opciones = {}) {
    const db = dbManager.getDatabase()

    const {
      limite = 100,
      pagina = 1,
      buscar = null,
      categoria = null,
      soloActivos = true,
    } = opciones

    const offset = (pagina - 1) * limite

    let whereConditions = ['clienteNegocioId = ?']
    let params = [clienteId]

    if (soloActivos) {
      whereConditions.push('activo = 1')
    }

    if (buscar) {
      whereConditions.push('(nombre LIKE ? OR descripcion LIKE ? OR sku LIKE ? OR codigoBarras LIKE ?)')
      const searchTerm = `%${buscar}%`
      params.push(searchTerm, searchTerm, searchTerm, searchTerm)
    }

    if (categoria) {
      whereConditions.push('categoria = ?')
      params.push(categoria)
    }

    const whereClause = whereConditions.join(' AND ')

    // Contar total
    const countStmt = db.prepare(`
      SELECT COUNT(*) as total
      FROM productos_cliente
      WHERE ${whereClause}
    `)
    const { total } = countStmt.get(...params)

    // Obtener productos
    const stmt = db.prepare(`
      SELECT * FROM productos_cliente
      WHERE ${whereClause}
      ORDER BY nombre
      LIMIT ? OFFSET ?
    `)

    const productos = stmt.all(...params, limite, offset).map(producto => ({
      ...producto,
      unidadesInternas: JSON.parse(producto.unidadesInternas || '{}'),
      estadisticas: JSON.parse(producto.estadisticas || '{}'),
      configuracion: JSON.parse(producto.configuracion || '{}'),
      tieneUnidadesInternas: Boolean(producto.tieneUnidadesInternas),
      esProductoSecundario: Boolean(producto.esProductoSecundario),
      activo: Boolean(producto.activo),
    }))

    return {
      productos: productos,
      paginacion: {
        total,
        totalRegistros: total, // Alias para compatibilidad con frontend
        pagina,
        limite,
        totalPaginas: Math.ceil(total / limite),
      },
    }
  }

  // Buscar por categoría
  static buscarPorCategoria(clienteId, categoria) {
    const db = dbManager.getDatabase()
    const stmt = db.prepare(`
      SELECT * FROM productos_cliente 
      WHERE clienteNegocioId = ? AND categoria = ? AND activo = 1
      ORDER BY nombre
    `)

    const productos = stmt.all(clienteId, categoria)

    return productos.map(producto => ({
      ...producto,
      unidadesInternas: JSON.parse(producto.unidadesInternas || '{}'),
      estadisticas: JSON.parse(producto.estadisticas || '{}'),
      configuracion: JSON.parse(producto.configuracion || '{}'),
      tieneUnidadesInternas: Boolean(producto.tieneUnidadesInternas),
      esProductoSecundario: Boolean(producto.esProductoSecundario),
      activo: Boolean(producto.activo),
    }))
  }

  // Búsqueda de texto
  static buscarTexto(clienteId, texto) {
    const db = dbManager.getDatabase()
    const searchTerm = `%${texto}%`

    const stmt = db.prepare(`
      SELECT * FROM productos_cliente 
      WHERE clienteNegocioId = ? 
        AND (nombre LIKE ? OR descripcion LIKE ? OR sku LIKE ? OR codigoBarras LIKE ?)
        AND activo = 1
      ORDER BY nombre
      LIMIT 50
    `)

    const productos = stmt.all(clienteId, searchTerm, searchTerm, searchTerm, searchTerm)

    return productos.map(producto => ({
      ...producto,
      unidadesInternas: JSON.parse(producto.unidadesInternas || '{}'),
      estadisticas: JSON.parse(producto.estadisticas || '{}'),
      configuracion: JSON.parse(producto.configuracion || '{}'),
      tieneUnidadesInternas: Boolean(producto.tieneUnidadesInternas),
      esProductoSecundario: Boolean(producto.esProductoSecundario),
      activo: Boolean(producto.activo),
    }))
  }

  // Actualizar producto
  static actualizar(id, datos) {
    const db = dbManager.getDatabase()

    const campos = []
    const valores = []

    const camposPermitidos = {
      nombre: 'nombre',
      descripcion: 'descripcion',
      costo: 'costo',
      unidad: 'unidad',
      sku: 'sku',
      categoria: 'categoria',
      tipoContenedor: 'tipoContenedor',
      tipoPeso: 'tipoPeso',
      codigoBarras: 'codigoBarras',
      proveedor: 'proveedor',
    }

    Object.keys(camposPermitidos).forEach(key => {
      if (datos[key] !== undefined) {
        campos.push(`${camposPermitidos[key]} = ?`)
        valores.push(datos[key])
      }
    })

    if (datos.tieneUnidadesInternas !== undefined) {
      campos.push('tieneUnidadesInternas = ?')
      valores.push(datos.tieneUnidadesInternas ? 1 : 0)
    }

    if (datos.unidadesInternas !== undefined) {
      campos.push('unidadesInternas = ?')
      valores.push(JSON.stringify(datos.unidadesInternas))
    }

    if (datos.configuracion !== undefined) {
      campos.push('configuracion = ?')
      valores.push(JSON.stringify(datos.configuracion))
    }

    if (campos.length === 0) {
      return ProductoCliente.buscarPorId(id)
    }

    valores.push(id)

    const stmt = db.prepare(`
      UPDATE productos_cliente 
      SET ${campos.join(', ')}
      WHERE id = ?
    `)

    stmt.run(...valores)
    return ProductoCliente.buscarPorId(id)
  }

  // Eliminar producto
  static eliminar(id) {
    const db = dbManager.getDatabase()
    const stmt = db.prepare('DELETE FROM productos_cliente WHERE id = ?')
    const info = stmt.run(id)
    return info.changes > 0
  }

  // Desactivar producto
  static desactivar(id) {
    const db = dbManager.getDatabase()
    const stmt = db.prepare('UPDATE productos_cliente SET activo = 0 WHERE id = ?')
    stmt.run(id)
    return true
  }

  // Actualizar estadísticas
  static actualizarEstadisticas(id, cantidadContada) {
    const db = dbManager.getDatabase()

    const producto = ProductoCliente.buscarPorId(id)
    if (!producto) return null

    const estadisticas = producto.estadisticas || {}
    estadisticas.vecesContado = (estadisticas.vecesContado || 0) + 1
    estadisticas.ultimoConteo = new Date().toISOString()

    // Calcular cantidad promedio
    const totalAnterior = estadisticas.vecesContado - 1
    const cantidadPromedioAnterior = estadisticas.cantidadPromedio || 0
    estadisticas.cantidadPromedio =
      (cantidadPromedioAnterior * totalAnterior + cantidadContada) / estadisticas.vecesContado

    // Calcular valor promedio total
    const valorTotal = cantidadContada * producto.costo
    const valorPromedioAnterior = estadisticas.valorPromedioTotal || 0
    estadisticas.valorPromedioTotal =
      (valorPromedioAnterior * totalAnterior + valorTotal) / estadisticas.vecesContado

    const stmt = db.prepare(`
      UPDATE productos_cliente 
      SET estadisticas = ?
      WHERE id = ?
    `)

    stmt.run(JSON.stringify(estadisticas), id)
    return ProductoCliente.buscarPorId(id)
  }

  // Obtener estadísticas del cliente
  static obtenerEstadisticasCliente(clienteId) {
    const db = dbManager.getDatabase()
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as totalProductos,
        SUM(CASE WHEN activo = 1 THEN 1 ELSE 0 END) as productosActivos,
        COUNT(DISTINCT categoria) as totalCategorias,
        AVG(costo) as costoPromedio
      FROM productos_cliente
      WHERE clienteNegocioId = ?
    `)
    return stmt.get(clienteId)
  }

  // Crear múltiples productos desde productos generales
  static crearDesdeGenerales(clienteId, productosIds, costosPersonalizados = {}) {
    const db = dbManager.getDatabase()
    const productosCreados = []

    for (const productoGeneralId of productosIds) {
      // Obtener producto general
      const pgStmt = db.prepare('SELECT * FROM productos_generales WHERE id = ? AND activo = 1')
      const productoGeneral = pgStmt.get(productoGeneralId)

      if (!productoGeneral) continue

      // Usar costo personalizado o el costo base
      const costo = costosPersonalizados[productoGeneralId] || productoGeneral.costoBase || 0

      // Crear producto de cliente
      const producto = ProductoCliente.crear({
        nombre: productoGeneral.nombre,
        descripcion: productoGeneral.descripcion,
        costo,
        unidad: productoGeneral.unidad,
        clienteNegocioId: clienteId,
        categoria: productoGeneral.categoria,
        tipoContenedor: productoGeneral.tipoContenedor,
        tieneUnidadesInternas: Boolean(productoGeneral.tieneUnidadesInternas),
        unidadesInternas: JSON.parse(productoGeneral.unidadesInternas || '{}'),
        tipoPeso: productoGeneral.tipoPeso,
        esProductoSecundario: Boolean(productoGeneral.esProductoSecundario),
        codigoBarras: productoGeneral.codigoBarras,
        proveedor: productoGeneral.proveedor,
        tipoCreacion: 'sistema',
      })

      productosCreados.push(producto)
    }

    return productosCreados
  }
}

export default ProductoCliente
