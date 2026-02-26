import ProductoGeneral from '../models/ProductoGeneral.js'
import ProductoCliente from '../models/ProductoCliente.js'
import { respuestaExito } from '../utils/helpers.js'
import { AppError } from '../middlewares/errorHandler.js'

// ===== PRODUCTOS GENERALES =====

export const listarProductosGenerales = async (req, res) => {
  const { pagina = 1, limite = 50, buscar, categoria, soloActivos = 'true' } = req.query

  const resultado = ProductoGeneral.buscar({
    pagina: parseInt(pagina),
    limite: parseInt(limite),
    buscar,
    categoria,
    soloActivos: soloActivos === 'true',
  })

  res.json(respuestaExito(resultado))
}

export const obtenerProductoGeneral = async (req, res) => {
  const { id } = req.params

  const producto = ProductoGeneral.buscarPorId(id)

  if (!producto) {
    throw new AppError('Producto no encontrado', 404)
  }

  res.json(respuestaExito(producto))
}

export const crearProductoGeneral = async (req, res) => {
  const datosProducto = {
    ...req.body,
    creadoPorId: req.usuario.id,
  }

  const producto = ProductoGeneral.crear(datosProducto)

  res.status(201).json(respuestaExito(producto, 'Producto creado'))
}

export const actualizarProductoGeneral = async (req, res) => {
  const { id } = req.params

  const productoActualizado = ProductoGeneral.actualizar(id, req.body)

  if (!productoActualizado) {
    throw new AppError('Producto no encontrado', 404)
  }

  res.json(respuestaExito(productoActualizado, 'Producto actualizado'))
}

export const desactivarProductoGeneral = async (req, res) => {
  const { id } = req.params

  ProductoGeneral.desactivar(id)

  res.json(respuestaExito(null, 'Producto desactivado'))
}

export const eliminarTodosProductosGenerales = async (req, res) => {
  console.log('⚡ [API] Solicitud recibida: Eliminar TODOS los productos generales');
  try {
    const cantidadEliminada = ProductoGeneral.eliminarTodos();
    console.log(`✅ [API] Eliminación completada. Total eliminados: ${cantidadEliminada}`);
    res.json(respuestaExito({
      cantidad: cantidadEliminada,
      mensaje: `Se eliminaron ${cantidadEliminada} productos correctamente`
    }, `Se eliminaron ${cantidadEliminada} productos correctamente`));
  } catch (error) {
    console.error('❌ [API] Error al eliminar todos los productos:', error);
    res.status(500).json({ exito: false, mensaje: 'Error interno al eliminar productos: ' + error.message });
  }
}

export const obtenerCategorias = async (req, res) => {
  const categorias = ProductoGeneral.obtenerCategorias()

  res.json(respuestaExito(categorias))
}

export const buscarPorCodigoBarras = async (req, res) => {
  const { codigo } = req.params

  const producto = ProductoGeneral.buscarPorCodigoBarras(codigo)

  if (!producto) {
    throw new AppError('Producto no encontrado', 404)
  }

  res.json(respuestaExito(producto))
}

// ===== PRODUCTOS DE CLIENTE =====

export const listarProductosCliente = async (req, res) => {
  const { clienteId } = req.params
  const { pagina = 1, limite = 100, buscar, categoria, soloActivos = 'true' } = req.query

  const resultado = ProductoCliente.buscarPorCliente(clienteId, {
    pagina: parseInt(pagina),
    limite: parseInt(limite),
    buscar,
    categoria,
    soloActivos: soloActivos === 'true',
  })

  res.json(respuestaExito(resultado))
}

export const obtenerProductoCliente = async (req, res) => {
  const { id } = req.params

  const producto = ProductoCliente.buscarPorId(id)

  if (!producto) {
    throw new AppError('Producto no encontrado', 404)
  }

  res.json(respuestaExito(producto))
}

export const crearProductoCliente = async (req, res) => {
  const { clienteId } = req.params

  const datosProducto = {
    ...req.body,
    clienteNegocioId: parseInt(clienteId),
    creadoPorId: req.usuario.id,
  }

  const producto = ProductoCliente.crear(datosProducto)

  res.status(201).json(respuestaExito(producto, 'Producto creado'))
}

export const actualizarProductoCliente = async (req, res) => {
  const { id } = req.params

  const productoActualizado = ProductoCliente.actualizar(id, req.body)

  if (!productoActualizado) {
    throw new AppError('Producto no encontrado', 404)
  }

  res.json(respuestaExito(productoActualizado, 'Producto actualizado'))
}

export const eliminarProductoCliente = async (req, res) => {
  const { id } = req.params

  const eliminado = ProductoCliente.eliminar(id)

  if (!eliminado) {
    throw new AppError('Producto no encontrado', 404)
  }

  res.json(respuestaExito(null, 'Producto eliminado'))
}

export const asignarProductosGenerales = async (req, res) => {
  const { clienteId } = req.params
  const { productosIds, costoPersonalizado = {} } = req.body

  if (!productosIds || productosIds.length === 0) {
    throw new AppError('Debe proporcionar IDs de productos', 400)
  }

  const productosCreados = ProductoCliente.crearDesdeGenerales(
    parseInt(clienteId),
    productosIds,
    costoPersonalizado
  )

  res.status(201).json(
    respuestaExito(productosCreados, `${productosCreados.length} producto(s) asignado(s)`)
  )
}

export default {
  // Generales
  listarProductosGenerales,
  obtenerProductoGeneral,
  crearProductoGeneral,
  actualizarProductoGeneral,
  desactivarProductoGeneral,
  eliminarTodosProductosGenerales,
  obtenerCategorias,
  buscarPorCodigoBarras,
  // Cliente
  listarProductosCliente,
  obtenerProductoCliente,
  crearProductoCliente,
  actualizarProductoCliente,
  eliminarProductoCliente,
  asignarProductosGenerales,
}
