import dbManager from '../config/database.js'
import ProductoCliente from './ProductoCliente.js'
import ClienteNegocio from './ClienteNegocio.js'

class SesionInventario {
  // Generar número único de sesión
  static generarNumeroSesion() {
    const db = dbManager.getDatabase()
    const ahora = new Date()
    const fecha = ahora.toISOString().slice(0, 10).replace(/-/g, '')

    // Obtener contador del día
    const stmt = db.prepare(`
      SELECT COUNT(*) as count
      FROM sesiones_inventario
      WHERE DATE(createdAt) = DATE('now')
    `)
    const { count } = stmt.get()

    const numero = (count + 1).toString().padStart(3, '0')
    return `INV-${fecha}-${numero}`
  }

  // Crear nueva sesión
  static crear(datos) {
    const db = dbManager.getDatabase()

    const {
      clienteNegocioId,
      contadorId,
      fecha = new Date().toISOString(),
      configuracion = {},
    } = datos

    const numeroSesion = SesionInventario.generarNumeroSesion()

    const stmt = db.prepare(`
      INSERT INTO sesiones_inventario (
        clienteNegocioId, contadorId, fecha, numeroSesion, configuracion
      ) VALUES (?, ?, ?, ?, ?)
    `)

    const info = stmt.run(
      clienteNegocioId,
      contadorId,
      fecha,
      numeroSesion,
      JSON.stringify(configuracion)
    )

    return SesionInventario.buscarPorId(info.lastInsertRowid)
  }

  // Buscar sesión por ID
  static buscarPorId(id) {
    const db = dbManager.getDatabase()
    const stmt = db.prepare(`
      SELECT 
        si.*,
        cn.nombre as nombreCliente,
        cn.telefono as telefonoCliente,
        cn.direccion as direccionCliente,
        u.nombre as nombreContador,
        u.email as emailContador
      FROM sesiones_inventario si
      INNER JOIN clientes_negocios cn ON si.clienteNegocioId = cn.id
      INNER JOIN usuarios u ON si.contadorId = u.id
      WHERE si.id = ?
    `)
    const sesion = stmt.get(id)

    if (sesion) {
      sesion.datosFinancieros = JSON.parse(sesion.datosFinancieros || '{}')
      sesion.totales = JSON.parse(sesion.totales || '{}')
      sesion.configuracion = JSON.parse(sesion.configuracion || '{}')
      sesion.timerEnMarcha = Boolean(sesion.timerEnMarcha)
      // Alias para compatibilidad con frontend que espera _id
      sesion._id = sesion.id

      // Obtener objeto clienteNegocio completo
      if (sesion.clienteNegocioId) {
        try {
          const clienteNegocio = ClienteNegocio.buscarPorId(sesion.clienteNegocioId)
          if (clienteNegocio) {
            sesion.clienteNegocio = clienteNegocio
            console.log('✅ ClienteNegocio agregado a sesión:', {
              id: clienteNegocio.id,
              _id: clienteNegocio._id,
              nombre: clienteNegocio.nombre
            })
          } else {
            console.warn('⚠️ ClienteNegocio no encontrado para ID:', sesion.clienteNegocioId)
          }
        } catch (error) {
          console.error('❌ Error obteniendo ClienteNegocio:', error)
          // Continuar sin clienteNegocio, pero mantener clienteNegocioId
        }
      } else {
        console.warn('⚠️ Sesión no tiene clienteNegocioId')
      }

      // Obtener colaboradores
      sesion.colaboradores = SesionInventario.obtenerColaboradores(id)

      // Obtener productos contados
      sesion.productosContados = SesionInventario.obtenerProductosContados(id)
    }

    return sesion
  }

  // Obtener colaboradores de una sesión
  static obtenerColaboradores(sesionId) {
    const db = dbManager.getDatabase()
    const stmt = db.prepare(`
      SELECT 
        sc.*,
        u.nombre as nombreUsuario,
        u.email as emailUsuario
      FROM sesiones_colaboradores sc
      INNER JOIN usuarios u ON sc.usuarioId = u.id
      WHERE sc.sesionInventarioId = ? AND sc.activo = 1
    `)
    return stmt.all(sesionId)
  }

  // Obtener productos contados
  static obtenerProductosContados(sesionId) {
    const db = dbManager.getDatabase()
    const stmt = db.prepare(`
      SELECT 
        pc.*,
        u.nombre as nombreAgregadoPor
      FROM productos_contados pc
      LEFT JOIN usuarios u ON pc.agregadoPorId = u.id
      WHERE pc.sesionInventarioId = ?
      ORDER BY COALESCE(pc.updatedAt, pc.createdAt) DESC, pc.createdAt DESC
    `)

    const productos = stmt.all(sesionId)

    return productos.map(producto => ({
      ...producto,
      productoId: producto.id, // Alias para compatibilidad con frontend
      _id: producto.id, // Alias para compatibilidad con frontend que espera _id
      discrepancia: JSON.parse(producto.discrepancia || '{}'),
      requiereAprobacion: Boolean(producto.requiereAprobacion),
      aprobado: Boolean(producto.aprobado),
    }))
  }

  // Buscar sesiones con filtros
  static buscar(opciones = {}) {
    const db = dbManager.getDatabase()

    const {
      limite = 20,
      pagina = 1,
      contadorId = null,
      clienteId = null,
      estado = null,
      fechaDesde = null,
      fechaHasta = null,
    } = opciones

    const offset = (pagina - 1) * limite

    let whereConditions = []
    let params = []

    if (contadorId) {
      whereConditions.push('si.contadorId = ?')
      params.push(contadorId)
    }

    if (clienteId) {
      whereConditions.push('si.clienteNegocioId = ?')
      params.push(clienteId)
    }

    if (estado) {
      whereConditions.push('si.estado = ?')
      params.push(estado)
    }

    if (fechaDesde) {
      whereConditions.push('si.fecha >= ?')
      params.push(fechaDesde)
    }

    if (fechaHasta) {
      whereConditions.push('si.fecha <= ?')
      params.push(fechaHasta)
    }

    const whereClause = whereConditions.length > 0
      ? 'WHERE ' + whereConditions.join(' AND ')
      : ''

    // Contar total
    const countStmt = db.prepare(`
      SELECT COUNT(*) as total
      FROM sesiones_inventario si
      LEFT JOIN clientes_negocios cn ON si.clienteNegocioId = cn.id
      ${whereClause}
    `)
    const { total } = countStmt.get(...params)

    // Obtener sesiones
    const stmt = db.prepare(`
      SELECT 
        si.*,
        cn.id as cliente_id,
        cn.nombre as cliente_nombre,
        cn.telefono as cliente_telefono,
        cn.direccion as cliente_direccion,
        u.nombre as nombreContador
      FROM sesiones_inventario si
      LEFT JOIN clientes_negocios cn ON si.clienteNegocioId = cn.id
      INNER JOIN usuarios u ON si.contadorId = u.id
      ${whereClause}
      ORDER BY si.fecha DESC, si.createdAt DESC
      LIMIT ? OFFSET ?
    `)

    const sesiones = stmt.all(...params, limite, offset).map(sesion => {
      // Extraer datos del cliente antes del spread
      const clienteNegocio = sesion.cliente_id ? {
        _id: sesion.cliente_id,
        id: sesion.cliente_id,
        nombre: sesion.cliente_nombre || null,
        telefono: sesion.cliente_telefono || null,
        direccion: sesion.cliente_direccion || null,
      } : null

      // Construir objeto de sesión sin los campos del cliente que vienen del JOIN
      const {
        cliente_id,
        cliente_nombre,
        cliente_telefono,
        cliente_direccion,
        nombreContador,
        ...sesionData
      } = sesion

      return {
        ...sesionData,
        datosFinancieros: JSON.parse(sesion.datosFinancieros || '{}'),
        totales: JSON.parse(sesion.totales || '{}'),
        configuracion: JSON.parse(sesion.configuracion || '{}'),
        timerEnMarcha: Boolean(sesion.timerEnMarcha),
        // Incluir objeto clienteNegocio completo
        clienteNegocio: clienteNegocio,
        // Alias para compatibilidad con frontend que espera _id
        _id: sesion.id,
      }
    })

    return {
      sesiones: sesiones,
      paginacion: {
        total,
        pagina,
        limite,
        totalPaginas: Math.ceil(total / limite),
      },
    }
  }

  // Buscar sesiones de un cliente
  static buscarPorCliente(clienteId, limite = 10) {
    const db = dbManager.getDatabase()
    const stmt = db.prepare(`
      SELECT 
        si.*,
        u.nombre as nombreContador
      FROM sesiones_inventario si
      INNER JOIN usuarios u ON si.contadorId = u.id
      WHERE si.clienteNegocioId = ?
      ORDER BY si.fecha DESC
      LIMIT ?
    `)

    const sesiones = stmt.all(clienteId, limite)

    return sesiones.map(sesion => ({
      ...sesion,
      datosFinancieros: JSON.parse(sesion.datosFinancieros || '{}'),
      totales: JSON.parse(sesion.totales || '{}'),
      configuracion: JSON.parse(sesion.configuracion || '{}'),
      timerEnMarcha: Boolean(sesion.timerEnMarcha),
      // Alias para compatibilidad con frontend que espera _id
      _id: sesion.id,
    }))
  }

  // Agregar o actualizar producto contado
  static agregarProductoContado(sesionId, datosProducto) {
    const db = dbManager.getDatabase()

    const {
      productoClienteId,
      cantidadContada,
      agregadoPorId,
      notas = null,
      nombreProducto = null,
      costoProducto = null,
      // Permitir pasar el ID del producto contado si lo conocemos (para updates explícitos)
      id = null
    }
      = datosProducto

    // Validar datos mínimos
    if (!productoClienteId && !id) {
      throw new Error('Se requiere productoClienteId o el ID del producto contado')
    }

    // Obtener datos del producto original (si existe) para defaults
    let productoOriginal = null
    if (productoClienteId) {
      productoOriginal = ProductoCliente.buscarPorId(productoClienteId)
    }

    // Determinar si existe el registro en la sesión
    let existe = null

    // Si nos pasan el ID explícitamente (update desde frontend)
    if (id) {
      const existeStmt = db.prepare(`SELECT * FROM productos_contados WHERE id = ? AND sesionInventarioId = ?`)
      existe = existeStmt.get(id, sesionId)
    }
    // Si no, intentar buscar por productoClienteId y sesionId
    else if (productoClienteId) {
      const existeStmt = db.prepare(`
        SELECT * FROM productos_contados
        WHERE sesionInventarioId = ? AND productoClienteId = ?
      `)
      existe = existeStmt.get(sesionId, productoClienteId)
    }

    // Valores finales a usar
    // Si nombreProducto viene null, usar el existente o el del original
    let nombreFinal = nombreProducto
    if (nombreFinal === null) {
      nombreFinal = existe ? existe.nombreProducto : (productoOriginal ? productoOriginal.nombre : 'Producto Desconocido')
    }

    // Si costoProducto viene null, usar el existente o el del original
    let costoFinal = costoProducto
    if (costoFinal === null) {
      costoFinal = existe ? existe.costoProducto : (productoOriginal ? productoOriginal.costo : 0)
    }

    // SKU y Unidad (normalmente no cambian en conteo, pero los traemos del original si es nuevo)
    const skuFinal = productoOriginal ? productoOriginal.sku : (existe ? existe.skuProducto : null)
    const unidadFinal = productoOriginal ? productoOriginal.unidad : (existe ? existe.unidadProducto : 'unidad')

    if (existe) {
      // --- ACTUALIZACIÓN ---

      // Si cantidadContada viene definida, calcular nueva cantidad. 
      // Si es un update de solo nombre/costo, cantidadContada podría venir undefined o 0 dependiendo del frontend.
      // Asumiremos: si viene en datosProducto, se usa (sumando o reemplazando). 
      // PERO, la lógica original era "SUMAR" si se escaneaba de nuevo.
      // Para fluidez de edición manual (inputs), deberíamos REEMPLAZAR si es una edición manual.
      // Como este método se usa para ambos, necesitamos saber la intención. 
      // Por ahora, mantendremos la lógica: si viene undefined, no cambiar cantidad. 
      // Si viene número, sumar (comportamiento original de escáner).
      // TODO: Refactorizar para separar "escanear" (sumar) de "editar" (reemplazar).

      // Para evitar romper el escáner, se mantiene SUMA. 
      // El frontend de edición debería enviar la diferencia o manejar esto.
      // Sin embargo, el frontend actual envía `value` directo en `handleUpdateProductField`.
      // Si el frontend envía `cantidadContada` como campo a editar, aquí se sumaría, lo cual es BUG para edición.
      // FIX TEMPORAL: Detectar si es edición por el campo `id` presente o flags.
      // Si el frontend usa el endpoint `PUT /:id/productos/:productoId`, llega aquí con `datosProducto`.

      let cantidadNueva = existe.cantidadContada
      let valorTotalNuevo = existe.valorTotal

      if (cantidadContada !== undefined && cantidadContada !== null) {
        // HACK: Si estamos editando campos específicos (nombre, costo) y la cantidad viene 0 o igual, ignorar?
        // La lógica de `sesionesController.actualizarProducto` pasa `...req.body`.
        // Si el body trae `cantidadContada`, se sumará. 
        // Si el usuario edita la cantidad en la UI, espera reemplazo.

        // Si el metodo se llama desde "actualizarProducto" (PUT), deberíamos reemplazar.
        // Si se llama desde "agregarProducto" (POST), deberíamos sumar.
        // Podemos distinguir por la presencia de `id` en `datosProducto` (que acabamos de extraer arriba si venía).
        // Pero `actualizarProducto` no pasa `id` (del producto contado) dentro de `datosProducto` explícitamente en el código anterior,
        // (lo corregí en el controller para que pase todo el body, pero no inyecté el ID en el body).

        // Asumiremos: Si `cantidadContada` está presente, SIEMPRE REEMPLAZA si es una actualización de campo,
        // pero la lógica heredada es SUMAR. 
        // CAMBIO CRÍTICO: Para soportar edición fluida, si se está editando (existe),
        // y se pasa una cantidad explícita, deberíamos reemplazar.
        // ¿Pero el escáner llama a 'agregarProducto' (POST) y espera sumar?
        // Sí. El POST llama a `agregarProducto`. El PUT llama a `actualizarProducto`.

        // El controller `actualizarProducto` llama a `agregarProductoContado`.
        // El controller `agregarProducto` TAMBIÉN llama a `agregarProductoContado`.

        // Vamos a diferenciar por el ID. Si se pasó ID explícito del row, es un UPDATE directo -> Reemplazar valor.
        // Si se buscó por productoClienteId (escaneo), es un AGREGADO -> Sumar valor.

        if (id) {
          cantidadNueva = Number(cantidadContada) // Reemplazo directo
        } else {
          cantidadNueva = (existe.cantidadContada || 0) + Number(cantidadContada) // Suma (escáner)
        }
      }

      valorTotalNuevo = cantidadNueva * Number(costoFinal)

      const updateStmt = db.prepare(`
        UPDATE productos_contados
        SET cantidadContada = ?, valorTotal = ?, notas = COALESCE(?, notas), 
            agregadoPorId = ?, nombreProducto = ?, costoProducto = ?, updatedAt = CURRENT_TIMESTAMP
        WHERE id = ?
      `)

      updateStmt.run(
        cantidadNueva,
        valorTotalNuevo,
        notas,
        agregadoPorId,
        nombreFinal,
        Number(costoFinal),
        existe.id
      )

      // Actualizar estadísticas solo si cambió la cantidad
      if (productoClienteId && cantidadNueva !== existe.cantidadContada) {
        ProductoCliente.actualizarEstadisticas(productoClienteId, cantidadNueva)
      }

      SesionInventario.calcularTotales(sesionId)
      return existe.id

    } else {
      // --- INSERCIÓN ---
      if (!productoOriginal) {
        throw new Error('No se puede crear producto contado: Producto cliente no encontrado y no existe registro previo.')
      }

      const cantidad = Number(cantidadContada || 0)
      const valor = cantidad * Number(costoFinal)

      const insertStmt = db.prepare(`
        INSERT INTO productos_contados (
          sesionInventarioId, productoClienteId, nombreProducto, unidadProducto,
          costoProducto, skuProducto, cantidadContada, valorTotal, notas, agregadoPorId
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      const info = insertStmt.run(
        sesionId,
        productoClienteId,
        nombreFinal,
        unidadFinal,
        Number(costoFinal),
        skuFinal,
        cantidad,
        valor,
        notas,
        agregadoPorId
      )

      if (productoClienteId) {
        ProductoCliente.actualizarEstadisticas(productoClienteId, cantidad)
      }

      SesionInventario.calcularTotales(sesionId)
      return info.lastInsertRowid
    }
  }

  // Remover producto contado
  static removerProductoContado(sesionId, productoContadoId) {
    const db = dbManager.getDatabase()
    const stmt = db.prepare(`
      DELETE FROM productos_contados 
      WHERE id = ? AND sesionInventarioId = ?
    `)
    const info = stmt.run(productoContadoId, sesionId)

    if (info.changes > 0) {
      SesionInventario.calcularTotales(sesionId)
    }

    return info.changes > 0
  }

  // Calcular totales de la sesión
  static calcularTotales(sesionId) {
    const db = dbManager.getDatabase()

    const sesion = SesionInventario.buscarPorId(sesionId)
    if (!sesion) return

    const stmt = db.prepare(`
      SELECT 
        SUM(valorTotal) as valorTotalInventario,
        COUNT(*) as totalProductosContados
      FROM productos_contados
      WHERE sesionInventarioId = ?
    `)

    const { valorTotalInventario, totalProductosContados } = stmt.get(sesionId)

    const datosFinancieros = sesion.datosFinancieros || {}

    const totalActivos = (valorTotalInventario || 0) +
      (datosFinancieros.efectivoEnCajaYBanco || 0) +
      (datosFinancieros.cuentasPorCobrar || 0) +
      (datosFinancieros.activosFijos || 0)

    const totalPasivos = datosFinancieros.cuentasPorPagar || 0
    const capitalContable = totalActivos - totalPasivos

    const totales = {
      valorTotalInventario: valorTotalInventario || 0,
      totalProductosContados: totalProductosContados || 0,
      totalActivos,
      totalPasivos,
      capitalContable,
    }

    const updateStmt = db.prepare(`
      UPDATE sesiones_inventario
      SET totales = ?
      WHERE id = ?
    `)

    updateStmt.run(JSON.stringify(totales), sesionId)
  }

  // Actualizar datos financieros
  static actualizarDatosFinancieros(sesionId, nuevosDatos) {
    const db = dbManager.getDatabase()

    const sesion = SesionInventario.buscarPorId(sesionId)
    if (!sesion) return null

    const datosActuales = sesion.datosFinancieros || {}
    const datosActualizados = { ...datosActuales, ...nuevosDatos }

    const stmt = db.prepare(`
      UPDATE sesiones_inventario
      SET datosFinancieros = ?
      WHERE id = ?
    `)

    stmt.run(JSON.stringify(datosActualizados), sesionId)

    // Recalcular totales
    SesionInventario.calcularTotales(sesionId)

    return SesionInventario.buscarPorId(sesionId)
  }

  // Reanudar timer
  static reanudarTimer(sesionId) {
    const db = dbManager.getDatabase()
    const stmt = db.prepare(`
      UPDATE sesiones_inventario
      SET timerEnMarcha = 1, timerUltimoInicio = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
    stmt.run(sesionId)
  }

  // Pausar timer
  static pausarTimer(sesionId) {
    const db = dbManager.getDatabase()

    const sesion = SesionInventario.buscarPorId(sesionId)
    if (!sesion || !sesion.timerEnMarcha) return

    // Calcular segundos transcurridos
    const inicio = new Date(sesion.timerUltimoInicio)
    const ahora = new Date()
    const segundosTranscurridos = Math.floor((ahora - inicio) / 1000)

    const nuevoAcumulado = sesion.timerAcumuladoSegundos + segundosTranscurridos

    const stmt = db.prepare(`
      UPDATE sesiones_inventario
      SET timerEnMarcha = 0, 
          timerAcumuladoSegundos = ?,
          timerUltimoInicio = NULL
      WHERE id = ?
    `)
    stmt.run(nuevoAcumulado, sesionId)
  }

  // Completar sesión
  static completarSesion(sesionId) {
    const db = dbManager.getDatabase()

    // Pausar timer si está en marcha
    SesionInventario.pausarTimer(sesionId)

    // Calcular duración en minutos
    const sesion = SesionInventario.buscarPorId(sesionId)
    const duracionMinutos = Math.floor(sesion.timerAcumuladoSegundos / 60)

    const stmt = db.prepare(`
      UPDATE sesiones_inventario
      SET estado = 'completada', duracionMinutos = ?
      WHERE id = ?
    `)
    stmt.run(duracionMinutos, sesionId)

    return SesionInventario.buscarPorId(sesionId)
  }

  // Cancelar sesión
  static cancelarSesion(sesionId) {
    const db = dbManager.getDatabase()
    const stmt = db.prepare(`
      UPDATE sesiones_inventario
      SET estado = 'cancelada'
      WHERE id = ?
    `)
    stmt.run(sesionId)

    return SesionInventario.buscarPorId(sesionId)
  }

  // Obtener estadísticas del contador
  static obtenerEstadisticasContador(contadorId, fechaInicio = null, fechaFin = null) {
    const db = dbManager.getDatabase()

    let whereClause = 'WHERE contadorId = ?'
    let params = [contadorId]

    if (fechaInicio) {
      whereClause += ' AND fecha >= ?'
      params.push(fechaInicio)
    }

    if (fechaFin) {
      whereClause += ' AND fecha <= ?'
      params.push(fechaFin)
    }

    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as totalSesiones,
        SUM(CASE WHEN estado = 'completada' THEN 1 ELSE 0 END) as sesionesCompletadas,
        AVG(duracionMinutos) as duracionPromedio
      FROM sesiones_inventario
      ${whereClause}
    `)

    return stmt.get(...params)
  }
}

export default SesionInventario
