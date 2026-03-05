import { useQuery } from 'react-query'
import { clientesApi, handleApiError, handleApiResponse } from '../services/api'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

/**
 * Hook personalizado para manejar la carga de clientes
 * Incluye manejo de errores, reintentos y cache
 */
export const useClientes = (options = {}) => {
  const { isAuthenticated, user } = useAuth()

  const {
    enabled = true,
    refetchOnWindowFocus = false,
    retry = 3,
    retryDelay = 1000,
    staleTime = 5 * 60 * 1000, // 5 minutos
    cacheTime = 10 * 60 * 1000, // 10 minutos
    ...queryOptions
  } = options

  const query = useQuery(
    ['clientes', user?.id], // Incluir user.id en la key para invalidar cache por usuario
    async () => {
      console.log('🔄 Cargando clientes...')
      const response = await clientesApi.getAll({
        limite: 100,
        pagina: 1,
        ordenar: 'nombre:asc', // Ordenar por nombre
      })

      console.log('📦 Respuesta completa:', response)

      // El backend devuelve: { exito: true, datos: { datos: [...], paginacion: {...} } }
      // handleApiResponse devuelve: { datos: [...], paginacion: {...} }
      const data = handleApiResponse(response)

      // Extraer el array de clientes
      const clientes = data?.datos || []

      if (!Array.isArray(clientes)) {
        console.warn('⚠️ Respuesta inesperada al cargar clientes:', response)
        return []
      }

      console.log('✅ Clientes cargados:', clientes.length)
      return clientes
    },
    {
      enabled: enabled && isAuthenticated,
      refetchOnWindowFocus,
      retry: (failureCount, error) => {
        if (error?.response?.status === 401) {
          console.log('❌ Error de autenticación, no reintentar')
          return false
        }
        return failureCount < retry
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime,
      cacheTime,
      onError: (error) => {
        console.error('❌ Error cargando clientes:', error)
        handleApiError(error)
      },
      onSuccess: (data) => {
        console.log('✅ Clientes cargados exitosamente:', data.length)
        if (data.length === 0) {
          toast.info('No hay clientes disponibles. Crea un cliente primero.')
        }
      },
      ...queryOptions
    }
  )

  // Transformar datos para el SelectSearch
  const clientesOptions = query.data?.map(cliente => {
    // El backend PostgreSQL devuelve 'id', MongoDB usaba '_id'
    const clienteId = String(cliente.id || cliente._id).trim()
    console.log('🔍 Cliente:', cliente.nombre, '| ID:', clienteId, '| Longitud:', clienteId.length)

    return {
      value: clienteId,
      label: `${cliente.nombre} - ${cliente.telefono || 'Sin teléfono'}`,
      nombre: cliente.nombre,
      telefono: cliente.telefono,
      direccion: cliente.direccion
    }
  }) || []

  return {
    ...query,
    clientes: query.data || [],
    clientesOptions,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch
  }
}

/**
 * Hook para buscar clientes específicos
 */
export const useBuscarClientes = (terminoBusqueda = '') => {
  const { isAuthenticated } = useAuth()

  return useQuery(
    ['clientes', 'buscar', terminoBusqueda],
    async () => {
      const response = await clientesApi.getAll({
        buscar: terminoBusqueda,
        limite: 50,
        pagina: 1,
      })

      // Manejar diferentes estructuras de respuesta
      let clientes = []

      if (response?.data?.exito) {
        clientes = response.data.datos?.clientes || []
      } else if (response?.data?.clientes) {
        clientes = response.data.clientes
      } else if (Array.isArray(response?.data)) {
        clientes = response.data
      }

      if (!Array.isArray(clientes)) {
        console.warn('⚠️ Respuesta inesperada al buscar clientes:', response)
        clientes = []
      }

      return clientes
    },
    {
      enabled: isAuthenticated && terminoBusqueda.length > 0,
      staleTime: 2 * 60 * 1000, // 2 minutos
      onError: handleApiError
    }
  )
}

export default useClientes



