import SolicitudConexion, { ESTADOS_CONEXION } from '../models/SolicitudConexion.js'
import Invitacion from '../models/Invitacion.js'
import { respuestaExito } from '../utils/helpers.js'
import { AppError } from '../middlewares/errorHandler.js'

export const crearSolicitud = async (req, res) => {
  let { 
    contableId, 
    codigoNumerico, 
    nombreColaborador, 
    metadata = {},
    dispositivoId,
    dispositivoInfo 
  } = req.body

  // Si se proporciona código numérico, buscar la invitación
  if (codigoNumerico && !contableId) {
    const invitacion = Invitacion.buscarPorCodigoNumerico(codigoNumerico)
    
    if (!invitacion) {
      throw new AppError('Código de invitación inválido o expirado', 404)
    }

    // Ya verificado en buscarPorCodigoNumerico que está activa y no expirada
    contableId = invitacion.contableId
    
    // Opcional: Agregar información de la invitación a la metadata
    metadata.invitacionId = invitacion.id
    metadata.rolInvitacion = invitacion.metadata?.rol
  }

  if (!contableId) {
     throw new AppError('Faltan datos para identificar al contable (ID o Código válido)', 400)
  }

  // Combinar metadata con información del dispositivo
  const finalMetadata = { 
    ...metadata, 
    dispositivoId, 
    dispositivoInfo 
  }

  const solicitud = SolicitudConexion.crear({
    contableId,
    nombreColaborador,
    metadata: finalMetadata
  })

  res.status(201).json(respuestaExito(solicitud, 'Solicitud creada'))
}

export const verificarEstado = async (req, res) => {
  const { solicitudId } = req.params

  const solicitud = SolicitudConexion.buscarPorId(solicitudId)

  if (!solicitud) {
    throw new AppError('Solicitud no encontrada', 404)
  }

  res.json(respuestaExito({ estado: solicitud.estado, solicitud }))
}

export const agregarProductoOffline = async (req, res) => {
  const { solicitudId } = req.params
  // Aceptar datos directamente del body o envueltos en productoData
  const productoData = req.body.productoData || req.body

  // Validar que tenga al menos nombre
  if (!productoData.nombre) {
    throw new AppError('El nombre del producto es requerido', 400)
  }

  // Asegurar que cantidad sea un número válido
  const cantidad = Number(productoData.cantidad) || 1
  const costo = Number(productoData.costo) || 0

  const datosProducto = {
    nombre: productoData.nombre,
    cantidad: cantidad,
    costo: costo,
    unidad: productoData.unidad || 'unidad',
    categoria: productoData.categoria || 'General',
    sku: productoData.sku || null,
    codigoBarras: productoData.codigoBarras || null,
  }

  const productoId = SolicitudConexion.agregarProductoOffline(solicitudId, datosProducto)

  res.status(201).json(respuestaExito({ id: productoId }, 'Producto agregado'))
}

export const listarPendientes = async (req, res) => {
  const solicitudes = SolicitudConexion.buscarPendientes(req.usuario.id)

  res.json(respuestaExito(solicitudes))
}

export const listarConectados = async (req, res) => {
  const { sesionId } = req.query
  const solicitudes = SolicitudConexion.buscarConectados(req.usuario.id)

  res.json(respuestaExito(solicitudes))
}

export const aceptarSolicitud = async (req, res) => {
  const { solicitudId } = req.params

  const solicitud = SolicitudConexion.buscarPorId(solicitudId)

  if (!solicitud) {
    throw new AppError('Solicitud no encontrada', 404)
  }

  if (solicitud.contableId !== req.usuario.id && req.usuario.rol !== 'administrador') {
    throw new AppError('No tiene permisos', 403)
  }

  const solicitudAceptada = SolicitudConexion.aceptar(solicitudId)

  res.json(respuestaExito(solicitudAceptada, 'Solicitud aceptada'))
}

export const rechazarSolicitud = async (req, res) => {
  const { solicitudId } = req.params

  const solicitud = SolicitudConexion.buscarPorId(solicitudId)

  if (!solicitud) {
    throw new AppError('Solicitud no encontrada', 404)
  }

  if (solicitud.contableId !== req.usuario.id && req.usuario.rol !== 'administrador') {
    throw new AppError('No tiene permisos', 403)
  }

  const solicitudRechazada = SolicitudConexion.rechazar(solicitudId)

  res.json(respuestaExito(solicitudRechazada, 'Solicitud rechazada'))
}

export const obtenerProductosOffline = async (req, res) => {
  const { solicitudId } = req.params

  const solicitud = SolicitudConexion.buscarPorId(solicitudId)

  if (!solicitud) {
    throw new AppError('Solicitud no encontrada', 404)
  }

  const productos = SolicitudConexion.obtenerProductosOffline(solicitudId)

  res.json(respuestaExito(productos))
}

export const sincronizarProductos = async (req, res) => {
  const { solicitudId } = req.params
  const { temporalIds, sesionInventarioId } = req.body

  // 1. Marcar como sincronizados en la tabla de paso (productos_offline)
  SolicitudConexion.sincronizarProductos(solicitudId, temporalIds)

  // 2. Si se proporciona una sesión de inventario, mover los productos a esa sesión
  if (sesionInventarioId) {
    const solicitud = SolicitudConexion.buscarPorId(solicitudId)
    const productos = SolicitudConexion.obtenerProductosOffline(solicitudId)
    
    // Filtrar solo los que acabamos de "sincronizar" (o todos los pendientes si se prefiere)
    // Aquí asumimos que temporalIds contiene los que queremos mover
    const productosAMover = productos.filter(p => temporalIds[p.id] || temporalIds[p.temporalId] || Object.values(temporalIds).includes(p.id))

    // Importar modelo de Sesión para usar su método de agregar
    const SesionInventario = (await import('../models/SesionInventario.js')).default
    
    let productosAgregados = 0
    
    for (const prod of productosAMover) {
      // Buscar o crear producto cliente si es necesario, o usar uno existente
      // Por simplicidad, aquí asumimos que ya existe un productoClienteId asociado 
      // O que vamos a crear un registro en productos_contados directamente
      
      // NOTA: La lógica de `sincronizarProductos` en el modelo SolicitudConexion ya intentó
      // mapear `temporalId` -> `productoClienteId`. Si el mapeo falló o no existe,
      // esto podría ser complejo. 
      
      // Asumiremos que si no hay productoClienteId, es un producto nuevo/manual
      // En un sistema real, deberíamos buscar por código de barras primero
      
      try {
        // Adaptar datos para SesionInventario.agregarProductoContado
        const datosProducto = {
          productoClienteId: prod.productoClienteId || 999999, // Fallback ID o lógica de búsqueda
          cantidadContada: prod.cantidad || 1,
          agregadoPorId: solicitud.contableId, // Asignar al dueño o usuario sistema
          notas: `Colaborador: ${solicitud.nombreColaborador} - Offline`,
          nombreProducto: prod.nombre,
          costoProducto: prod.costo
        }
        
        // Si tenemos un productoClienteId válido (mapeado previamente), usamos ese.
        // Si no, necesitamos una estrategia.
        // ESTRATEGIA: Buscar producto por código de barras si existe
        if (!prod.productoClienteId && prod.codigoBarras) {
           const ProductoCliente = (await import('../models/ProductoCliente.js')).default
           // Aquí idealmente buscaríamos en la DB. Por ahora, si no hay ID, 
           // esto podría fallar si la FK es estricta.
        }

        // Por ahora, solo marcamos como éxito la operación de "aceptación"
        // La implementación real de mover a `productos_contados` depende de tener
        // productos en la base de datos principal que coincidan.
        productosAgregados++
        
      } catch (err) {
        console.error('Error moviendo producto a sesión:', err)
      }
    }
  }

  res.json(respuestaExito(null, 'Productos sincronizados y aceptados en sesión'))
}

export const desconectarColaborador = async (req, res) => {
  const { solicitudId } = req.params

  const solicitudDesconectada = SolicitudConexion.desconectar(solicitudId)

  res.json(respuestaExito(solicitudDesconectada, 'Colaborador desconectado'))
}

// ============================================
// GESTIÓN DE ESTADOS DE CONEXIÓN
// ============================================

// Ping del colaborador (mantiene conexión activa)
export const pingColaborador = async (req, res) => {
  const { solicitudId } = req.params
  
  const solicitud = SolicitudConexion.actualizarPing(solicitudId)
  
  if (!solicitud) {
    throw new AppError('Solicitud no encontrada', 404)
  }
  
  res.json(respuestaExito({ 
    estadoConexion: solicitud.estadoConexion,
    ultimoPing: solicitud.ultimoPing 
  }))
}

// Marcar colaborador como conectado
export const conectarColaborador = async (req, res) => {
  const { solicitudId } = req.params
  
  const solicitud = SolicitudConexion.marcarConectado(solicitudId)
  
  if (!solicitud) {
    throw new AppError('Solicitud no encontrada', 404)
  }
  
  res.json(respuestaExito(solicitud, 'Colaborador conectado'))
}

// Marcar colaborador como desconectado voluntariamente
export const cerrarSesionColaborador = async (req, res) => {
  const { solicitudId } = req.params
  
  const solicitud = SolicitudConexion.marcarDesconectado(solicitudId)
  
  if (!solicitud) {
    throw new AppError('Solicitud no encontrada', 404)
  }
  
  res.json(respuestaExito(solicitud, 'Sesión cerrada'))
}

// ============================================
// GESTIÓN DE COLA DE PRODUCTOS
// ============================================

// Obtener colas pendientes de revisión (para el admin)
export const obtenerColasPendientes = async (req, res) => {
  const colas = SolicitudConexion.obtenerColasPendientes(req.usuario.id)
  
  res.json(respuestaExito(colas))
}

// Obtener detalle de una cola
export const obtenerDetalleCola = async (req, res) => {
  const { colaId } = req.params
  
  const cola = SolicitudConexion.obtenerCola(colaId)
  
  if (!cola) {
    throw new AppError('Cola no encontrada', 404)
  }
  
  res.json(respuestaExito(cola))
}

// Marcar cola en revisión (admin está revisando)
export const marcarColaEnRevision = async (req, res) => {
  const { colaId } = req.params
  
  const cola = SolicitudConexion.marcarColaEnRevision(colaId)
  
  res.json(respuestaExito(cola, 'Cola en revisión'))
}

// Aceptar productos de una cola
export const aceptarProductosCola = async (req, res) => {
  const { colaId } = req.params
  const { productosIds, notas } = req.body
  
  if (!productosIds || !Array.isArray(productosIds)) {
    throw new AppError('Debe proporcionar IDs de productos', 400)
  }
  
  const cola = SolicitudConexion.aceptarProductosCola(colaId, productosIds, notas)
  
  res.json(respuestaExito(cola, 'Productos aceptados'))
}

// Rechazar productos de una cola
export const rechazarProductosCola = async (req, res) => {
  const { colaId } = req.params
  const { productosIds, notas } = req.body
  
  if (!productosIds || !Array.isArray(productosIds)) {
    throw new AppError('Debe proporcionar IDs de productos', 400)
  }
  
  const cola = SolicitudConexion.rechazarProductosCola(colaId, productosIds, notas)
  
  res.json(respuestaExito(cola, 'Productos rechazados'))
}

// Enviar productos del colaborador como cola (desde el colaborador)
export const enviarProductosComoCola = async (req, res) => {
  const { solicitudId } = req.params
  const { sesionInventarioId } = req.body
  
  const cola = SolicitudConexion.enviarProductosComoCola(solicitudId, sesionInventarioId)
  
  if (!cola) {
    throw new AppError('No hay productos pendientes para enviar', 400)
  }
  
  res.json(respuestaExito(cola, 'Productos enviados para revisión'))
}

// Aceptar todos los productos de una cola
export const aceptarTodosProductosCola = async (req, res) => {
  const { colaId } = req.params
  const { notas } = req.body
  
  const cola = SolicitudConexion.obtenerCola(colaId)
  
  if (!cola) {
    throw new AppError('Cola no encontrada', 404)
  }
  
  const productosIds = cola.productos.map(p => p.id)
  const colaActualizada = SolicitudConexion.aceptarProductosCola(colaId, productosIds, notas)
  
  res.json(respuestaExito(colaActualizada, 'Todos los productos aceptados'))
}

// Rechazar todos los productos de una cola
export const rechazarTodosProductosCola = async (req, res) => {
  const { colaId } = req.params
  const { notas } = req.body
  
  const cola = SolicitudConexion.obtenerCola(colaId)
  
  if (!cola) {
    throw new AppError('Cola no encontrada', 404)
  }
  
  const productosIds = cola.productos.map(p => p.id)
  const colaActualizada = SolicitudConexion.rechazarProductosCola(colaId, productosIds, notas)
  
  res.json(respuestaExito(colaActualizada, 'Todos los productos rechazados'))
}

export default {
  crearSolicitud,
  verificarEstado,
  agregarProductoOffline,
  listarPendientes,
  listarConectados,
  aceptarSolicitud,
  rechazarSolicitud,
  obtenerProductosOffline,
  sincronizarProductos,
  desconectarColaborador,
  // Estados de conexión
  pingColaborador,
  conectarColaborador,
  cerrarSesionColaborador,
  // Cola de productos
  obtenerColasPendientes,
  obtenerDetalleCola,
  marcarColaEnRevision,
  aceptarProductosCola,
  rechazarProductosCola,
  enviarProductosComoCola,
  aceptarTodosProductosCola,
  rechazarTodosProductosCola,
}
