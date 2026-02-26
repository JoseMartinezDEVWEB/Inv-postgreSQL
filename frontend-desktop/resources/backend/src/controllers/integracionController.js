import dbManager from '../config/database.js'
import logger from '../utils/logger.js'
import ProductoGeneral from '../models/ProductoGeneral.js'
import SesionInventario from '../models/SesionInventario.js'

class IntegracionController {
  /**
   * POST /api/inventario/integrar
   * Integra productos de colaboradores a la sesión de inventario
   * Usa transacciones SQL para garantizar atomicidad
   */
  integrarProductosColaborador = async (req, res) => {
    const { sesionId, productos, colaboradorId, solicitudId } = req.body

    // Validación de entrada
    if (!sesionId || !productos || !Array.isArray(productos)) {
      return res.status(400).json({
        exito: false,
        mensaje: 'sesionId y productos (array) son requeridos',
      })
    }

    if (productos.length === 0) {
      return res.status(400).json({
        exito: false,
        mensaje: 'El array de productos no puede estar vacío',
      })
    }

    const db = dbManager.getDatabase()
    
    // Configurar timeout para evitar bloqueos
    db.pragma('busy_timeout = 5000')

    try {
      logger.info(`🔄 Iniciando integración de ${productos.length} productos para sesión ${sesionId}`)

      // Validar que la sesión existe
      const sesion = SesionInventario.buscarPorId(sesionId)
      if (!sesion) {
        return res.status(404).json({
          exito: false,
          mensaje: `Sesión ${sesionId} no encontrada`,
        })
      }

      // Crear transacción para garantizar atomicidad
      const integrar = db.transaction((productosLista) => {
        const resultados = {
          nuevos: 0,
          actualizados: 0,
          errores: [],
          detalles: [],
        }

        for (const producto of productosLista) {
          try {
            const {
              codigoBarras,
              nombre,
              sku = null,
              cantidad = 1,
              costo = 0,
              categoria = 'General',
              unidad = 'unidad',
              origen = 'colaborador',
            } = producto

            // Validar campos obligatorios
            if (!codigoBarras && !nombre) {
              resultados.errores.push({
                producto,
                error: 'Código de barras o nombre son requeridos',
              })
              continue
            }

            let productoId = null
            let productoExistente = null

            // 1. BUSCAR si el producto existe por código de barras
            if (codigoBarras) {
              productoExistente = ProductoGeneral.buscarPorCodigoBarras(codigoBarras)
            }

            // 2. Si no existe, buscarlo por nombre exacto
            if (!productoExistente && nombre) {
              const stmt = db.prepare(`
                SELECT * FROM productos_generales 
                WHERE LOWER(nombre) = LOWER(?) AND activo = 1
                LIMIT 1
              `)
              const encontrado = stmt.get(nombre)
              if (encontrado) {
                productoExistente = ProductoGeneral.buscarPorId(encontrado.id)
              }
            }

            // 3. UPSERT: Si no existe, crearlo automáticamente
            if (!productoExistente) {
              logger.info(`📦 Creando nuevo producto: ${nombre} (${codigoBarras || 'sin CB'})`)
              
              const nuevoProducto = ProductoGeneral.crear({
                nombre,
                descripcion: `Producto creado por colaborador vía integración`,
                categoria,
                unidad,
                costoBase: Number(costo) || 0,
                codigoBarras: codigoBarras || null,
                tipoCreacion: origen,
                creadoPorId: colaboradorId || null,
                notas: `Importado desde solicitud: ${solicitudId || 'N/A'}`,
              })

              productoId = nuevoProducto.id
              resultados.nuevos++
              resultados.detalles.push({
                accion: 'creado',
                productoId,
                nombre,
                codigoBarras,
                cantidad,
              })
            } else {
              // 4. Si existe, usar su ID
              productoId = productoExistente.id
              logger.info(`✅ Producto existente encontrado: ${productoExistente.nombre} (ID: ${productoId})`)
            }

            // 5. ACTUALIZAR o CREAR registro en productos_sesion (stock contado)
            // Buscar si ya hay un registro de este producto en la sesión
            const stmtBuscarEnSesion = db.prepare(`
              SELECT * FROM productos_sesion
              WHERE sesionId = ? AND productoId = ?
            `)
            const registroEnSesion = stmtBuscarEnSesion.get(sesionId, productoId)

            if (registroEnSesion) {
              // Ya existe: SUMAR la cantidad
              const nuevaCantidad = Number(registroEnSesion.cantidadContada || 0) + Number(cantidad)
              const stmtActualizar = db.prepare(`
                UPDATE productos_sesion
                SET cantidadContada = ?,
                    valorUnitario = ?,
                    diferencia = cantidadContada - cantidadSistema,
                    updatedAt = ?
                WHERE id = ?
              `)
              stmtActualizar.run(
                nuevaCantidad,
                Number(costo) || registroEnSesion.valorUnitario || 0,
                new Date().toISOString(),
                registroEnSesion.id
              )

              resultados.actualizados++
              resultados.detalles.push({
                accion: 'actualizado',
                productoId,
                nombre: productoExistente?.nombre || nombre,
                cantidadAnterior: registroEnSesion.cantidadContada,
                cantidadNueva: nuevaCantidad,
                cantidadAgregada: cantidad,
              })

              logger.info(`➕ Stock actualizado: ${productoExistente?.nombre || nombre} | ${registroEnSesion.cantidadContada} → ${nuevaCantidad}`)
            } else {
              // No existe: CREAR nuevo registro
              const stmtInsertar = db.prepare(`
                INSERT INTO productos_sesion (
                  sesionId, productoId, cantidadSistema, cantidadContada,
                  valorUnitario, diferencia, observaciones, contadoPor, createdAt, updatedAt
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `)
              stmtInsertar.run(
                sesionId,
                productoId,
                0, // cantidadSistema (lo manejará el admin si quiere)
                Number(cantidad),
                Number(costo) || 0,
                Number(cantidad) - 0, // diferencia inicial
                `Agregado por colaborador: ${colaboradorId || 'Anónimo'}`,
                colaboradorId || 'colaborador',
                new Date().toISOString(),
                new Date().toISOString()
              )

              resultados.actualizados++
              resultados.detalles.push({
                accion: 'agregado',
                productoId,
                nombre: productoExistente?.nombre || nombre,
                cantidad,
              })

              logger.info(`🆕 Nuevo producto agregado a sesión: ${productoExistente?.nombre || nombre} | Cantidad: ${cantidad}`)
            }
          } catch (errorProducto) {
            logger.error(`❌ Error procesando producto: ${producto.nombre}`, errorProducto)
            resultados.errores.push({
              producto,
              error: errorProducto.message,
            })
          }
        }

        return resultados
      })

      // Ejecutar la transacción
      const resultados = integrar(productos)

      // Actualizar totales de la sesión
      SesionInventario.recalcularTotales(sesionId)

      logger.info(`✅ Integración completada: ${resultados.nuevos} nuevos, ${resultados.actualizados} actualizados, ${resultados.errores.length} errores`)

      return res.status(200).json({
        exito: true,
        mensaje: 'Productos integrados correctamente',
        datos: {
          sesionId,
          productosNuevos: resultados.nuevos,
          productosActualizados: resultados.actualizados,
          errores: resultados.errores,
          detalles: resultados.detalles,
        },
      })
    } catch (error) {
      logger.error('❌ Error en integración de productos:', error)
      return res.status(500).json({
        exito: false,
        mensaje: 'Error al integrar productos',
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      })
    }
  }

  /**
   * GET /api/inventario/integrar/:solicitudId/estado
   * Obtiene el estado de sincronización de una solicitud
   */
  obtenerEstadoIntegracion = async (req, res) => {
    const { solicitudId } = req.params

    try {
      const db = dbManager.getDatabase()
      
      // Contar productos pendientes vs sincronizados
      const stmt = db.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN sincronizado = 1 THEN 1 ELSE 0 END) as sincronizados,
          SUM(CASE WHEN sincronizado = 0 THEN 1 ELSE 0 END) as pendientes
        FROM productos_colaborador
        WHERE solicitudId = ?
      `)
      
      const estadisticas = stmt.get(solicitudId)

      return res.status(200).json({
        exito: true,
        datos: {
          solicitudId,
          total: estadisticas.total || 0,
          sincronizados: estadisticas.sincronizados || 0,
          pendientes: estadisticas.pendientes || 0,
          porcentaje: estadisticas.total > 0 
            ? Math.round((estadisticas.sincronizados / estadisticas.total) * 100)
            : 0,
        },
      })
    } catch (error) {
      logger.error('Error obteniendo estado de integración:', error)
      return res.status(500).json({
        exito: false,
        mensaje: 'Error al obtener estado de integración',
        error: error.message,
      })
    }
  }
}

export default new IntegracionController()










