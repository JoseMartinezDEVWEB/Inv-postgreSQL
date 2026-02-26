import axios from 'axios'
import toast from 'react-hot-toast'
import { config } from '../config/env'

// Usar la configuración centralizada
const API_BASE_URL = config.apiUrl

// Crear instancia de Axios
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 segundos
  headers: {
    'Content-Type': 'application/json',
    'X-Client-Type': 'web',
  },
})

// Interceptor para requests
api.interceptors.request.use(
  (config) => {
    // Agregar token de autenticación si existe
    const token = localStorage.getItem('accessToken')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    // Agregar timestamp para evitar cache
    config.params = {
      ...config.params,
      _t: Date.now(),
    }

    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Interceptor para responses
api.interceptors.response.use(
  (response) => {
    return response
  },
  async (error) => {
    const originalRequest = error.config

    // Si el error es 401 y no hemos intentado refrescar el token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        const refreshToken = localStorage.getItem('refreshToken')
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken: refreshToken,
          })

          const { datos } = response.data
          const { accessToken, refreshToken: newRefreshToken } = datos

          localStorage.setItem('accessToken', accessToken)
          localStorage.setItem('refreshToken', newRefreshToken)

          // Reintentar la petición original
          originalRequest.headers.Authorization = `Bearer ${accessToken}`
          return api(originalRequest)
        }
      } catch (refreshError) {
        // Si falla el refresh, limpiar tokens y redirigir al login
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        localStorage.removeItem('user')

        if (window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
      }
    }

    // Manejar otros errores (solo si no es 400 - Bad Request que se maneja en handleApiError)
    if (error.response?.status >= 500) {
      toast.error('Error del servidor. Por favor, intente más tarde.')
    } else if (error.response?.status === 404) {
      // No mostrar toast para 404, se maneja en cada llamada específica
      console.log('Recurso no encontrado:', error.config?.url)
    } else if (error.response?.status === 403) {
      toast.error('No tiene permisos para realizar esta acción.')
    } else if (error.code === 'ECONNABORTED') {
      toast.error('Tiempo de espera agotado. Verifique su conexión.')
    } else if (!error.response) {
      toast.error('Error de conexión. Verifique su internet.')
    }

    return Promise.reject(error)
  }
)

// Funciones de utilidad para manejo de respuestas
export const handleApiResponse = (response) => {
  if (!response || !response.data) {
    throw new Error('Respuesta inválida del servidor')
  }

  const { data } = response

  // Si tiene estructura de respuesta específica del backend SQLite
  if (data.exito !== undefined) {
    if (!data.exito) {
      throw new Error(data.mensaje || 'Error en la operación')
    }
    return data.datos || data
  }

  // Si la respuesta tiene datos, devolverlos directamente
  if (Array.isArray(data) || typeof data === 'object') {
    return data
  }

  // Respuesta simple
  return data
}

export const handleApiError = (error) => {
  console.error('❌ Error de API:', error)

  // Si hay errores de validación específicos (formato del backend Node.js)
  if (error.response?.data?.mensaje) {
    const message = error.response.data.mensaje
    toast.error(message)
    return message
  }

  // Error general
  const message = error.response?.data?.mensaje || error.message || 'Error desconocido'
  toast.error(message)
  return message
}

// Endpoints de la API
export const authApi = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/registro', userData),
  refresh: (refreshToken) => api.post('/auth/refresh', { refreshToken }),
  logout: () => api.post('/auth/logout'),
  profile: () => api.get('/auth/perfil'),
  updateProfile: (userData) => api.put('/auth/perfil', userData),
  changePassword: (passwords) => api.put('/auth/cambiar-password', passwords),
}

export const clientesApi = {
  getAll: (params = {}) => api.get('/clientes-negocios', { params }),
  getById: (id) => api.get(`/clientes-negocios/${id}`),
  create: (clienteData) => api.post('/clientes-negocios', clienteData),
  update: (id, clienteData) => api.put(`/clientes-negocios/${id}`, clienteData),
  delete: (id) => api.delete(`/clientes-negocios/${id}`),
  activate: (id) => api.patch(`/clientes-negocios/${id}/activar`),
  getStats: (id) => api.get(`/clientes-negocios/${id}/estadisticas`),
}

export const sesionesApi = {
  getAll: (params = {}) => api.get('/sesiones-inventario', { params }),
  getById: (id) => api.get(`/sesiones-inventario/${id}`),
  create: (sesionData) => api.post('/sesiones-inventario', sesionData),
  addProduct: (sesionId, productData) => api.post(`/sesiones-inventario/${sesionId}/productos`, productData),
  removeProduct: (sesionId, productId) => api.delete(`/sesiones-inventario/${sesionId}/productos/${productId}`),
  updateProduct: (sesionId, productId, productData) => api.put(`/sesiones-inventario/${sesionId}/productos/${productId}`, productData),
  updateFinancial: (sesionId, financialData) => api.put(`/sesiones-inventario/${sesionId}/financieros`, financialData),
  complete: (sesionId) => api.patch(`/sesiones-inventario/${sesionId}/completar`),
  cancel: (sesionId) => api.patch(`/sesiones-inventario/${sesionId}/cancelar`),
  pauseTimer: (sesionId) => api.patch(`/sesiones-inventario/${sesionId}/timer/pause`),
  resumeTimer: (sesionId) => api.patch(`/sesiones-inventario/${sesionId}/timer/resume`),
  getByClient: (clienteId, params = {}) => api.get(`/sesiones-inventario/cliente/${clienteId}`, { params }),
  // Agenda endpoints
  getAgendaResumen: (params = {}) => api.get('/sesiones-inventario/agenda/resumen', { params }),
  getAgendaDia: (params = {}) => api.get('/sesiones-inventario/agenda/dia', { params }),
}

export const productosApi = {
  // Productos generales
  getAllGenerales: (params = {}) => api.get('/productos/generales', { params }),
  getGeneralById: (id) => api.get(`/productos/generales/${id}`),
  createGeneral: (productoData) => api.post('/productos/generales', productoData),
  updateGeneral: (id, productoData) => api.put(`/productos/generales/${id}`, productoData),
  updateGeneral: (id, productoData) => api.put(`/productos/generales/${id}`, productoData),
  deleteGeneral: (id) => api.delete(`/productos/generales/${id}`),
  deleteAllGenerales: () => api.delete('/productos/generales/eliminar-todos'),
  getCategorias: () => api.get('/productos/generales/categorias'),
  buscarPorCodigoBarras: (codigo) => api.get(`/productos/generales/buscar/codigo-barras/${codigo}`),
  buscarPorNombre: (nombre) => api.get('/productos/generales', { params: { buscar: nombre, limite: 20 } }),
  importarDesdeArchivo: (archivo, apiKey = null) => {
    const formData = new FormData()
    formData.append('archivo', archivo)
    if (apiKey) {
      formData.append('apiKey', apiKey)
    }
    return api.post('/productos/generales/importar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 120000, // 2 minutos para archivos grandes
    })
  },

  // Productos de clientes
  getByCliente: (clienteId, params = {}) => api.get(`/productos/cliente/${clienteId}`, { params }),
  createForCliente: (clienteId, productoData) => api.post(`/productos/cliente/${clienteId}`, productoData),
  asignarGenerales: (clienteId, productosIds, costoPersonalizado = {}) =>
    api.post(`/productos/cliente/${clienteId}/asignar`, { productosIds, costoPersonalizado }),
  getById: (id) => api.get(`/productos/${id}`),
  update: (id, productoData) => api.put(`/productos/${id}`, productoData),
  delete: (id) => api.delete(`/productos/${id}`),
}

export const invitacionesApi = {
  listMine: () => api.get('/invitaciones/mis-invitaciones'),
  createQR: (payload) => api.post('/invitaciones/qr', payload),
  getQR: (invitacionId) => api.get(`/invitaciones/qr/${invitacionId}`),
  cancel: (id) => api.delete(`/invitaciones/${id}`),
  consumirSinCuenta: (token) => api.post('/invitaciones/consumir-sin-cuenta', { token }),
  consumirCodigo: (codigo) => api.post('/invitaciones/consumir-codigo', { codigo }),
  listarColaboradores: (todos = false) => api.get('/invitaciones/colaboradores', { params: { todos } }),
  toggleColaborador: (id) => api.patch(`/invitaciones/colaboradores/${id}/toggle`),
  obtenerQRColaborador: (id) => api.get(`/invitaciones/colaboradores/${id}/qr`),
}

export const solicitudesConexionApi = {
  // Públicas (sin auth) - Colaboradores
  solicitar: (data) => api.post('/solicitudes-conexion/solicitar', data),
  verificarEstado: (solicitudId) => api.get(`/solicitudes-conexion/estado/${solicitudId}`),
  agregarProductoOffline: (solicitudId, productoData) => api.post(`/solicitudes-conexion/${solicitudId}/productos-offline`, { productoData }),

  // Estados de conexión (colaboradores)
  ping: (solicitudId) => api.post(`/solicitudes-conexion/${solicitudId}/ping`),
  conectar: (solicitudId) => api.post(`/solicitudes-conexion/${solicitudId}/conectar`),
  cerrarSesion: (solicitudId) => api.post(`/solicitudes-conexion/${solicitudId}/cerrar-sesion`),
  enviarProductos: (solicitudId, sesionInventarioId) => api.post(`/solicitudes-conexion/${solicitudId}/enviar-productos`, { sesionInventarioId }),

  // Protegidas (requieren auth) - Admin
  listarPendientes: () => api.get('/solicitudes-conexion/pendientes'),
  listarConectados: (sesionId) => api.get('/solicitudes-conexion/conectados', { params: { sesionId } }),
  aceptar: (solicitudId, sesionInventarioId) => api.post(`/solicitudes-conexion/${solicitudId}/aceptar`, { sesionInventarioId }),
  rechazar: (solicitudId) => api.post(`/solicitudes-conexion/${solicitudId}/rechazar`),
  obtenerProductosOffline: (solicitudId) => api.get(`/solicitudes-conexion/${solicitudId}/productos-offline`),
  sincronizar: (solicitudId, temporalIds) => api.post(`/solicitudes-conexion/${solicitudId}/sincronizar`, { temporalIds }),
  desconectar: (solicitudId) => api.post(`/solicitudes-conexion/${solicitudId}/desconectar`),

  // Cola de productos (Admin)
  obtenerColasPendientes: () => api.get('/solicitudes-conexion/colas-pendientes'),
  obtenerDetalleCola: (colaId) => api.get(`/solicitudes-conexion/colas/${colaId}`),
  marcarColaEnRevision: (colaId) => api.post(`/solicitudes-conexion/colas/${colaId}/revisar`),
  aceptarProductosCola: (colaId, productosIds, notas = '') => api.post(`/solicitudes-conexion/colas/${colaId}/aceptar`, { productosIds, notas }),
  aceptarTodosCola: (colaId, notas = '') => api.post(`/solicitudes-conexion/colas/${colaId}/aceptar-todos`, { notas }),
  rechazarProductosCola: (colaId, productosIds, notas = '') => api.post(`/solicitudes-conexion/colas/${colaId}/rechazar`, { productosIds, notas }),
  rechazarTodosCola: (colaId, notas = '') => api.post(`/solicitudes-conexion/colas/${colaId}/rechazar-todos`, { notas }),
}

export const reportesApi = {
  getBalance: (sesionId) => api.get(`/reportes/balance/${sesionId}`),
  getInventory: (sesionId) => api.get(`/reportes/inventario/${sesionId}`),
  downloadBalancePDF: (sesionId) => api.get(`/reportes/balance/${sesionId}/pdf`, { responseType: 'blob' }),
  downloadInventoryPDF: (sesionId, options = {}) => api.post(`/reportes/inventario/${sesionId}/pdf`, options, { responseType: 'blob' }),
  getStats: (params = {}) => api.get('/reportes/estadisticas', { params }),
}

export const saludApi = {
  check: () => api.get('/salud'),
  checkDB: () => api.get('/salud/db'),
  getSystemInfo: () => api.get('/salud/sistema'),
}

/**
 * API de Sincronización Bidireccional
 */
export const syncApi = {
  // Enviar cambios locales al servidor (PUSH)
  pushBatch: (changes, deviceId) => api.post('/sync/batch', {
    changes,
    deviceId,
    timestamp: Date.now()
  }),

  // Descargar cambios del servidor (PULL)
  pullUpdates: (lastSync, tables = 'clientes,productos,sesiones') =>
    api.get('/sync/pull', { params: { lastSync, tables } }),

  // Obtener estado de sincronización
  getStatus: () => api.get('/sync/status'),
}

export default api
