import dbManager from '../config/database.js'

class ProductoGeneral {
  // Crear nuevo producto general
  static crear(datos) {
    const db = dbManager.getDatabase()

    const {
      nombre,
      descripcion = null,
      categoria = 'General',
      unidad = 'unidad',
      costoBase = 0,
      tipoContenedor = 'ninguno',
      tieneUnidadesInternas = false,
      unidadesInternas = {},
      tipoPeso = 'ninguno',
      esProductoSecundario = false,
      productoPadreId = null,
      productoHijoId = null,
      proveedor = null,
      codigoBarras = null,
      notas = null,
      creadoPorId = null,
      tipoCreacion = 'usuario',
    } = datos

    const stmt = db.prepare(`
      INSERT INTO productos_generales (
        nombre, descripcion, categoria, unidad, costoBase,
        tipoContenedor, tieneUnidadesInternas, unidadesInternas,
        tipoPeso, esProductoSecundario, productoPadreId, productoHijoId,
        proveedor, codigoBarras, notas, creadoPorId, tipoCreacion, activo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const info = stmt.run(
      nombre,
      descripcion,
      categoria,
      unidad,
      costoBase,
      tipoContenedor,
      tieneUnidadesInternas ? 1 : 0,
      JSON.stringify(unidadesInternas),
      tipoPeso,
      esProductoSecundario ? 1 : 0,
      productoPadreId,
      productoHijoId,
      proveedor,
      codigoBarras,
      notas,
      creadoPorId,
      tipoCreacion,
      1
    )

    return ProductoGeneral.buscarPorId(info.lastInsertRowid)
  }

  // Buscar producto por ID
  static buscarPorId(id) {
    const db = dbManager.getDatabase()
    const stmt = db.prepare('SELECT * FROM productos_generales WHERE id = ?')
    const producto = stmt.get(id)

    if (producto) {
      producto.unidadesInternas = JSON.parse(producto.unidadesInternas || '{}')
      producto.estadisticas = JSON.parse(producto.estadisticas || '{}')
      producto.tieneUnidadesInternas = Boolean(producto.tieneUnidadesInternas)
      producto.esProductoSecundario = Boolean(producto.esProductoSecundario)
      producto.activo = Boolean(producto.activo)
      // Alias para compatibilidad con frontend que espera _id
      producto._id = producto.id
    }

    return producto
  }

  // Buscar todos con filtros y paginación
  static buscar(opciones = {}) {
    const db = dbManager.getDatabase()

    const {
      limite = 50,
      pagina = 1,
      buscar = null,
      categoria = null,
      soloActivos = true,
      ordenarPor = 'nombre',
      ordenDir = 'ASC',
    } = opciones

    const offset = (pagina - 1) * limite

    let whereConditions = []
    let params = []

    if (soloActivos) {
      whereConditions.push('activo = 1')
    }

    if (buscar) {
      whereConditions.push('(nombre LIKE ? OR descripcion LIKE ? OR codigoBarras LIKE ?)')
      const searchTerm = `%${buscar}%`
      params.push(searchTerm, searchTerm, searchTerm)
    }

    if (categoria) {
      whereConditions.push('categoria = ?')
      params.push(categoria)
    }

    const whereClause = whereConditions.length > 0
      ? 'WHERE ' + whereConditions.join(' AND ')
      : ''

    // Contar total
    const countStmt = db.prepare(`
      SELECT COUNT(*) as total
      FROM productos_generales
      ${whereClause}
    `)
    const { total } = countStmt.get(...params)

    // Obtener productos
    const ordenValido = ['nombre', 'categoria', 'costoBase', 'createdAt'].includes(ordenarPor)
      ? ordenarPor
      : 'nombre'
    const dirValida = ordenDir.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'

    const stmt = db.prepare(`
      SELECT * FROM productos_generales
      ${whereClause}
      ORDER BY ${ordenValido} ${dirValida}
      LIMIT ? OFFSET ?
    `)

    const productos = stmt.all(...params, limite, offset).map(producto => ({
      ...producto,
      unidadesInternas: JSON.parse(producto.unidadesInternas || '{}'),
      estadisticas: JSON.parse(producto.estadisticas || '{}'),
      tieneUnidadesInternas: Boolean(producto.tieneUnidadesInternas),
      esProductoSecundario: Boolean(producto.esProductoSecundario),
      activo: Boolean(producto.activo),
      // Alias para compatibilidad con frontend que espera _id
      _id: producto.id,
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
  static buscarPorCategoria(categoria, soloActivos = true) {
    const db = dbManager.getDatabase()

    let query = 'SELECT * FROM productos_generales WHERE categoria = ?'
    const params = [categoria]

    if (soloActivos) {
      query += ' AND activo = 1'
    }

    query += ' ORDER BY nombre'

    const stmt = db.prepare(query)
    const productos = stmt.all(...params)

    return productos.map(producto => ({
      ...producto,
      unidadesInternas: JSON.parse(producto.unidadesInternas || '{}'),
      estadisticas: JSON.parse(producto.estadisticas || '{}'),
      tieneUnidadesInternas: Boolean(producto.tieneUnidadesInternas),
      esProductoSecundario: Boolean(producto.esProductoSecundario),
      activo: Boolean(producto.activo),
      // Alias para compatibilidad con frontend que espera _id
      _id: producto.id,
    }))
  }

  // Buscar por código de barras
  static buscarPorCodigoBarras(codigoBarras) {
    const db = dbManager.getDatabase()
    const stmt = db.prepare(`
      SELECT * FROM productos_generales 
      WHERE codigoBarras = ? AND activo = 1
    `)
    const producto = stmt.get(codigoBarras)

    if (producto) {
      producto.unidadesInternas = JSON.parse(producto.unidadesInternas || '{}')
      producto.estadisticas = JSON.parse(producto.estadisticas || '{}')
      producto.tieneUnidadesInternas = Boolean(producto.tieneUnidadesInternas)
      producto.esProductoSecundario = Boolean(producto.esProductoSecundario)
      producto.activo = Boolean(producto.activo)
      // Alias para compatibilidad con frontend que espera _id
      producto._id = producto.id
    }

    return producto
  }

  // Búsqueda de texto completo
  static buscarTexto(texto, soloActivos = true) {
    const db = dbManager.getDatabase()

    let query = `
      SELECT * FROM productos_generales 
      WHERE (nombre LIKE ? OR descripcion LIKE ? OR codigoBarras LIKE ?)
    `
    const searchTerm = `%${texto}%`
    const params = [searchTerm, searchTerm, searchTerm]

    if (soloActivos) {
      query += ' AND activo = 1'
    }

    query += ' ORDER BY nombre LIMIT 50'

    const stmt = db.prepare(query)
    const productos = stmt.all(...params)

    return productos.map(producto => ({
      ...producto,
      unidadesInternas: JSON.parse(producto.unidadesInternas || '{}'),
      estadisticas: JSON.parse(producto.estadisticas || '{}'),
      tieneUnidadesInternas: Boolean(producto.tieneUnidadesInternas),
      esProductoSecundario: Boolean(producto.esProductoSecundario),
      activo: Boolean(producto.activo),
      // Alias para compatibilidad con frontend que espera _id
      _id: producto.id,
    }))
  }

  // Actualizar producto
  static actualizar(id, datos) {
    const db = dbManager.getDatabase()

    const campos = []
    const valores = []

    if (datos.nombre !== undefined) {
      campos.push('nombre = ?')
      valores.push(datos.nombre)
    }
    if (datos.descripcion !== undefined) {
      campos.push('descripcion = ?')
      valores.push(datos.descripcion)
    }
    if (datos.categoria !== undefined) {
      campos.push('categoria = ?')
      valores.push(datos.categoria)
    }
    if (datos.unidad !== undefined) {
      campos.push('unidad = ?')
      valores.push(datos.unidad)
    }
    if (datos.costoBase !== undefined) {
      campos.push('costoBase = ?')
      valores.push(datos.costoBase)
    }
    if (datos.tipoContenedor !== undefined) {
      campos.push('tipoContenedor = ?')
      valores.push(datos.tipoContenedor)
    }
    if (datos.tieneUnidadesInternas !== undefined) {
      campos.push('tieneUnidadesInternas = ?')
      valores.push(datos.tieneUnidadesInternas ? 1 : 0)
    }
    if (datos.unidadesInternas !== undefined) {
      campos.push('unidadesInternas = ?')
      valores.push(JSON.stringify(datos.unidadesInternas))
    }
    if (datos.tipoPeso !== undefined) {
      campos.push('tipoPeso = ?')
      valores.push(datos.tipoPeso)
    }
    if (datos.codigoBarras !== undefined) {
      campos.push('codigoBarras = ?')
      valores.push(datos.codigoBarras)
    }
    if (datos.proveedor !== undefined) {
      campos.push('proveedor = ?')
      valores.push(datos.proveedor)
    }
    if (datos.notas !== undefined) {
      campos.push('notas = ?')
      valores.push(datos.notas)
    }

    if (campos.length === 0) {
      return ProductoGeneral.buscarPorId(id)
    }

    valores.push(id)

    const stmt = db.prepare(`
      UPDATE productos_generales 
      SET ${campos.join(', ')}
      WHERE id = ?
    `)

    stmt.run(...valores)
    return ProductoGeneral.buscarPorId(id)
  }

  // Desactivar producto
  static desactivar(id) {
    const db = dbManager.getDatabase()
    const stmt = db.prepare('UPDATE productos_generales SET activo = 0 WHERE id = ?')
    stmt.run(id)
    return true
  }

  // Eliminar TODOS los productos (Para renovación de BD)
  static eliminarTodos() {
    const db = dbManager.getDatabase()

    // Iniciar transacción
    const borrarTodo = db.transaction(() => {
      // 1. Borrar todos los productos generales
      const stmt = db.prepare('DELETE FROM productos_generales')
      const info = stmt.run()
      return info.changes
    })

    return borrarTodo()
  }

  // Actualizar estadísticas
  static actualizarEstadisticas(id) {
    const db = dbManager.getDatabase()

    const producto = ProductoGeneral.buscarPorId(id)
    if (!producto) return null

    const estadisticas = producto.estadisticas || {}
    estadisticas.ultimoUso = new Date().toISOString()

    const stmt = db.prepare(`
      UPDATE productos_generales 
      SET estadisticas = ?
      WHERE id = ?
    `)

    stmt.run(JSON.stringify(estadisticas), id)
    return ProductoGeneral.buscarPorId(id)
  }

  // Obtener categorías disponibles
  static obtenerCategorias() {
    return [
      'General',
      'Alimentos General',
      'Enlatados',
      'Mercado',
      'Embutidos',
      'Carnes',
      'Bebidas',
      'Desechables',
      'Electricidad',
      'Dulce',
    ]
  }

  // Obtener estadísticas generales
  static obtenerEstadisticas() {
    const db = dbManager.getDatabase()
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN activo = 1 THEN 1 ELSE 0 END) as activos,
        COUNT(DISTINCT categoria) as totalCategorias
      FROM productos_generales
    `)
    return stmt.get()
  }
}

export default ProductoGeneral
