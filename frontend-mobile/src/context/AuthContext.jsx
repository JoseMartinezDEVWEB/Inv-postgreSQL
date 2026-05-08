import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react'
import { authApi, handleApiResponse, handleApiError } from '../services/api'
import webSocketService from '../services/websocket'
import { showMessage } from 'react-native-flash-message'
import { getInternetCredentials, setInternetCredentials, resetInternetCredentials } from '../services/secureStorage'
import { useLoader } from './LoaderContext'
import { isTokenExpired, getTokenInfo } from '../utils/jwtHelper'
import axios from 'axios'
import { config } from '../config/env'
import localDb from '../services/localDb'

// Estado inicial
const initialState = {
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
}

// Tipos de acciones
const AUTH_ACTIONS = {
  LOGIN_START: 'LOGIN_START',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_ERROR: 'LOGIN_ERROR',
  LOGOUT: 'LOGOUT',
  SET_LOADING: 'SET_LOADING',
  UPDATE_USER: 'UPDATE_USER',
  CLEAR_ERROR: 'CLEAR_ERROR',
}

// Reducer
const authReducer = (state, action) => {
  switch (action.type) {
    case AUTH_ACTIONS.LOGIN_START:
      return {
        ...state,
        isLoading: true,
        error: null,
      }

    case AUTH_ACTIONS.LOGIN_SUCCESS:
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.accessToken,
        refreshToken: action.payload.refreshToken,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      }

    case AUTH_ACTIONS.LOGIN_ERROR:
      return {
        ...state,
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload,
      }

    case AUTH_ACTIONS.LOGOUT:
      return {
        ...state,
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      }

    case AUTH_ACTIONS.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload,
      }

    case AUTH_ACTIONS.UPDATE_USER:
      return {
        ...state,
        user: { ...state.user, ...action.payload },
      }

    case AUTH_ACTIONS.CLEAR_ERROR:
      return {
        ...state,
        error: null,
      }

    default:
      return state
  }
}

// Crear contexto
const AuthContext = createContext()

// Hook personalizado para usar el contexto
export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider')
  }
  return context
}

// Provider del contexto
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState)
  const { showAnimation } = useLoader()

  // Verificar autenticación al cargar la aplicación
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const [tokenCredentials, refreshCredentials, userCredentials] = await Promise.all([
          getInternetCredentials('auth_token'),
          getInternetCredentials('refresh_token'),
          getInternetCredentials('user_data'),
        ])

        let access = tokenCredentials?.password
        const userJson = userCredentials?.password
        let refresh = refreshCredentials?.password

        if (access && userJson) {
          let userData = null
          try {
            userData = JSON.parse(userJson)
          } catch (e) {
            console.error('❌ Error parseando datos de usuario:', e)
            // Si los datos están corruptos, limpiar y forzar login
            await resetInternetCredentials('user_data')
            dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false })
            return
          }

          // Permitir sesión temporal de colaborador sin refresh token
          const isTempCollaborator = userData?.tipo === 'colaborador_temporal' || userData?.rol === 'colaborador'

          // Verificar si el token está expirado
          const tokenExpired = isTokenExpired(access)

          if (tokenExpired) {
            console.log('⚠️ Token expirado detectado al iniciar app')

            // Si es un token local (generado por la app), limpiar y permitir nuevo login
            if (access.startsWith('local-token-')) {
              console.log('🔐 Token local expirado - limpiando credenciales')
              await Promise.all([
                resetInternetCredentials('auth_token'),
                resetInternetCredentials('refresh_token'),
                resetInternetCredentials('user_data'),
              ])
              dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false })
              return
            }

            // Si es colaborador temporal, no tiene refresh token - hacer logout silencioso
            if (isTempCollaborator) {
              console.log('🔐 Colaborador temporal con token expirado - cerrando sesión')
              await Promise.all([
                resetInternetCredentials('auth_token'),
                resetInternetCredentials('user_data'),
              ])
              dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false })
              return
            }

            // Si tiene refresh token válido, intentar refrescar
            if (refresh && !refresh.startsWith('local-refresh-')) {
              console.log('🔄 Intentando refrescar token automáticamente...')
              try {
                const response = await axios.post(`${config.apiUrl}/auth/refresh`, {
                  refreshToken: refresh,
                })

                const newAccessToken = response.data.datos?.accessToken
                const newRefreshToken = response.data.datos?.refreshToken

                if (newAccessToken) {
                  console.log('✅ Token refrescado exitosamente')

                  // Guardar nuevos tokens
                  await Promise.all([
                    setInternetCredentials('auth_token', 'token', newAccessToken),
                    setInternetCredentials('refresh_token', 'refresh', newRefreshToken || refresh),
                  ])

                  // Usar el nuevo token
                  access = newAccessToken
                  refresh = newRefreshToken || refresh

                  // Actualizar estado
                  dispatch({
                    type: AUTH_ACTIONS.LOGIN_SUCCESS,
                    payload: {
                      user: userData,
                      accessToken: access,
                      refreshToken: refresh,
                    },
                  })

                  // Conectar WebSocket con token fresco
                  webSocketService.connect(access)
                  return
                } else {
                  throw new Error('No se recibió token de acceso')
                }
              } catch (refreshError) {
                // Solo mostrar error si no es 401 (token inválido esperado)
                if (refreshError.response?.status !== 401) {
                  console.error('❌ Error refrescando token:', refreshError.message)
                } else {
                  console.log('🔐 Token de refresh inválido - requiere nuevo login')
                }

                // Si falla el refresh, limpiar todo y hacer logout silencioso
                await Promise.all([
                  resetInternetCredentials('auth_token'),
                  resetInternetCredentials('refresh_token'),
                  resetInternetCredentials('user_data'),
                ])

                dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false })

                // No mostrar mensaje si es 401 (esperado al iniciar sin sesión válida)
                if (refreshError.response?.status !== 401) {
                  showMessage({
                    message: 'Sesión expirada',
                    description: 'Por favor, inicia sesión nuevamente',
                    type: 'warning',
                    duration: 3000,
                  })
                }
                return
              }
            } else {
              // No hay refresh token válido, limpiar y permitir nuevo login silenciosamente
              console.log('🔐 No hay token de refresh válido - limpiando credenciales')
              await Promise.all([
                resetInternetCredentials('auth_token'),
                resetInternetCredentials('refresh_token'),
                resetInternetCredentials('user_data'),
              ])
              dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false })
              return
            }
          }

          // Token válido - continuar normalmente
          console.log('🔍 [AuthContext] ===== INICIO VERIFICACIÓN WEBSOCKET =====')
          console.log('🔍 [AuthContext] Verificando condiciones para conectar WebSocket:', {
            isTempCollaborator,
            hasAccess: !!access,
            hasRefresh: !!refresh,
            isOffline: config.isOffline,
            userRol: userData?.rol,
            tokenLength: access?.length,
            tokenStartsWith: access?.substring(0, 20)
          })

          // Si tiene token válido, continuar (incluso sin refresh token para colaboradores)
          if (access) {
            console.log('✅ [AuthContext] Token encontrado, procediendo con conexión WebSocket')
            const tokenInfo = getTokenInfo(access)
            if (tokenInfo) {
              console.log(`✅ Token válido - expira en ${Math.floor(tokenInfo.timeToExpire / 60)} minutos`)
            }

            dispatch({
              type: AUTH_ACTIONS.LOGIN_SUCCESS,
              payload: {
                user: userData,
                accessToken: access,
                refreshToken: refresh || null,
              },
            })

            // Conectar WebSocket si el token es válido y no estamos offline
            // IMPORTANTE: Conectar siempre que haya token, especialmente para colaboradores
            console.log(`🔌 [AuthContext] Intentando conectar WebSocket. isOffline: ${config.isOffline}`)
            if (!config.isOffline) {
              console.log(`🔌 [AuthContext] Llamando a webSocketService.connect() con token de longitud: ${access?.length}`)
              console.log(`🔌 [AuthContext] Usuario rol: ${userData?.rol}, es colaborador: ${isTempCollaborator || userData?.rol === 'colaborador'}`)
              webSocketService.connect(access)
            } else {
              console.warn('⚠️ [AuthContext] Modo offline activado - no se conectará al WebSocket')
            }
          } else {
            console.warn('⚠️ [AuthContext] ===== NO HAY TOKEN DE ACCESO =====')
            console.warn('⚠️ [AuthContext] No hay token de acceso - no se puede conectar WebSocket')
            dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false })
          }
        } else {
          // No hay credenciales - estado inicial normal, no mostrar advertencia
          dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false })
        }
      } catch (error) {
        console.error('❌ [AuthContext] Error verificando autenticación:', error)
        dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false })
      }
    }

    console.log('🚀 [AuthContext] Ejecutando checkAuth() al montar componente')
    checkAuth()
  }, [])

  // Función de login
  const login = async (credentials) => {
    try {
      dispatch({ type: AUTH_ACTIONS.LOGIN_START })

      // PRIMERO: Intentar login con API remota si hay conexión
      // Esto es importante para admin/contador que necesitan tokens válidos
      if (!config.isOffline) {
        console.log('🌐 Intentando login con API remota primero...')

        try {
          const response = await authApi.login(credentials)
          const responseData = handleApiResponse(response)
          const accessToken = responseData?.accessToken || responseData?.token
          const refreshToken = responseData?.refreshToken
          const usuario = responseData?.usuario

          if (!accessToken || !usuario) {
            throw new Error('Respuesta de login inválida')
          }

          // Guardar en Keychain
          await Promise.all([
            setInternetCredentials('auth_token', 'token', accessToken),
            setInternetCredentials('refresh_token', 'refresh', refreshToken),
            setInternetCredentials('user_data', 'user', JSON.stringify(usuario)),
          ])

          // Actualizar estado
          dispatch({
            type: AUTH_ACTIONS.LOGIN_SUCCESS,
            payload: {
              user: usuario,
              accessToken,
              refreshToken,
            },
          })

          // Conectar WebSocket
          console.log(`🔌 [AuthContext Login] Conectando WebSocket después de login exitoso. isOffline: ${config.isOffline}`)
          console.log(`🔌 [AuthContext Login] Llamando a webSocketService.connect() con token de longitud: ${accessToken?.length}`)
          webSocketService.connect(accessToken)

          showMessage({
            message: '¡Bienvenido!',
            description: `Hola, ${usuario.nombre}`,
            type: 'success',
          })

          return { success: true, user: usuario }
        } catch (apiError) {
          console.log('⚠️ Login remoto falló, intentando login local como fallback...', apiError.message)
          // Continuar con login local como fallback
        }
      }

      // SEGUNDO: Intentar login local como fallback (modo offline o si API falló)
      console.log('🔐 Intentando login local...')

      const loginResult = await localDb.loginLocal(
        credentials.email,
        credentials.password
      )

      if (loginResult.success) {
        console.log('✅ Login local exitoso (modo offline)')

        const usuario = loginResult.usuario
        // Generar token local con formato reconocido por el backend
        // El backend acepta tokens que empiezan con 'colaborador-token-' o 'local-token-'
        const accessToken = 'local-token-' + Date.now()
        const refreshToken = 'local-refresh-' + Date.now()

        // Guardar en Keychain
        await Promise.all([
          setInternetCredentials('auth_token', 'token', accessToken),
          setInternetCredentials('refresh_token', 'refresh', refreshToken),
          setInternetCredentials('user_data', 'user', JSON.stringify(usuario)),
        ])

        // Actualizar estado
        dispatch({
          type: AUTH_ACTIONS.LOGIN_SUCCESS,
          payload: {
            user: usuario,
            accessToken,
            refreshToken,
          },
        })

        showMessage({
          message: '¡Bienvenido! (Modo Offline)',
          description: `Hola, ${usuario.nombre}. Algunas funciones pueden estar limitadas.`,
          type: 'success',
        })

        return { success: true, user: usuario, offline: true }
      }

      // Si ambos login fallaron
      const errorMessage = loginResult.error || 'Credenciales incorrectas'
      dispatch({
        type: AUTH_ACTIONS.LOGIN_ERROR,
        payload: errorMessage,
      })
      return { success: false, error: errorMessage }

    } catch (error) {
      console.error('❌ Error en login:', error)
      const errorMessage = error.message || 'Error al iniciar sesión'
      dispatch({
        type: AUTH_ACTIONS.LOGIN_ERROR,
        payload: errorMessage,
      })
      return { success: false, error: errorMessage }
    }
  }

  // Función de registro (deshabilitada temporalmente)
  const register = async () => {
    const msg = 'El registro está temporalmente deshabilitado'
    dispatch({ type: AUTH_ACTIONS.LOGIN_ERROR, payload: msg })
    showMessage({ message: 'Registro deshabilitado', description: msg, type: 'warning' })
    return { success: false, error: msg }
  }

  // Función de logout
  const logout = useCallback(async () => {
    try {
      showAnimation('logout', 1200)
      // Desconectar WebSocket
      webSocketService.disconnect(true)

      // Limpiar Keychain
      await Promise.all([
        resetInternetCredentials('auth_token'),
        resetInternetCredentials('refresh_token'),
        resetInternetCredentials('user_data'),
      ])

      // Actualizar estado
      dispatch({ type: AUTH_ACTIONS.LOGOUT })

      showMessage({
        message: 'Sesión cerrada',
        description: 'Hasta luego',
        type: 'info',
      })
    } catch (error) {
      console.error('Error durante logout:', error)
      // Aún así limpiar el estado local
      dispatch({ type: AUTH_ACTIONS.LOGOUT })
    }
  }, [dispatch])

  // Adoptar sesión temporal de colaborador (QR)
  const loginAsCollaborator = useCallback(async (datos) => {
    let savedToken = null
    try {
      const accessToken = datos?.sessionToken
      if (!accessToken) {
        console.error('❌ [loginAsCollaborator] sessionToken ausente. datos recibidos:', JSON.stringify(datos))
        throw new Error('Token de sesión inválido')
      }
      savedToken = accessToken

      const user = {
        nombre: datos?.nombreColaborador || 'Colaborador',
        rol: datos?.rol || 'colaborador',
        contablePrincipal: datos?.contable?.id || datos?.contable?._id || null,
        tipo: 'colaborador_temporal',
        invitacionId: datos?.invitacionId || null,
        email: datos?.contable?.email || 'colaborador@temporal',
        solicitudId: datos?.solicitudId || datos?.invitacionId || null,
        sesionInventario: datos?.sesionInventario || null,
      }

      console.log('💾 [loginAsCollaborator] Guardando credenciales en Keychain...')
      await Promise.all([
        setInternetCredentials('auth_token', 'token', accessToken),
        setInternetCredentials('user_data', 'user', JSON.stringify(user)),
      ])
      console.log('✅ [loginAsCollaborator] Credenciales guardadas correctamente')

      dispatch({
        type: AUTH_ACTIONS.LOGIN_SUCCESS,
        payload: {
          user,
          accessToken,
          refreshToken: null,
        },
      })
      console.log('✅ [loginAsCollaborator] Estado autenticado. Redirigiendo a SesionColaborador...')

      showMessage({
        message: '¡Conectado como colaborador!',
        description: `Contable: ${datos?.contable?.nombre || ''}`,
        type: 'success',
      })

      return { success: true }
    } catch (e) {
      console.error('❌ [loginAsCollaborator] Error:', e?.message, e)
      const msg = e?.message || 'No se pudo adoptar la sesión temporal'
      showMessage({ message: 'Error de sesión', description: msg, type: 'danger' })
      return { success: false, error: msg }
    } finally {
      // Conectar WebSocket FUERA del try-catch principal para que un fallo de WS
      // no cause que loginAsCollaborator devuelva { success: false }.
      if (savedToken && !config.isOffline) {
        try {
          console.log(`🔌 [loginAsCollaborator] Conectando WebSocket, token longitud: ${savedToken.length}`)
          webSocketService.connect(savedToken)
        } catch (wsErr) {
          console.warn('⚠️ [loginAsCollaborator] WebSocket connect error (no crítico):', wsErr?.message)
        }
      }
    }
  }, [])

  // Escuchar eventos de error de autenticación del WebSocket
  // Usar ref para controlar si ya estamos procesando un error de auth
  const isHandlingAuthError = React.useRef(false)
  const lastAuthErrorTime = React.useRef(0)

  useEffect(() => {
    const handleWsAuthError = async ({ message, code }) => {
      // CORRECCIÓN 9: Solo hacer logout si el SERVIDOR rechazó el token explícitamente.
      // Cortes de WiFi o red local inestable NO deben cerrar la sesión.
      const AUTH_ERROR_CODES = [4001, 4003, 4401]
      if (!code || !AUTH_ERROR_CODES.includes(code)) {
        // Error transitorio de red local — mantener sesión, el WS reconectará
        console.log('🌐 [AuthContext] Corte de WebSocket por red local, manteniendo sesión...')
        return
      }

      // Evitar múltiples ejecuciones simultáneas
      const now = Date.now()
      if (isHandlingAuthError.current || (now - lastAuthErrorTime.current) < 10000) {
        console.log('⏳ Ya se está procesando un error de auth o se procesó recientemente, ignorando...')
        return
      }

      isHandlingAuthError.current = true
      lastAuthErrorTime.current = now

      console.error('🔐 Token rechazado por el servidor PostgreSQL (código:', code, ')')

      try {
        // Verificar si hay un refresh token disponible
        const refreshCredentials = await getInternetCredentials('refresh_token')
        const refresh = refreshCredentials?.password

        // Si el refresh token es local o no existe, hacer logout silencioso
        if (!refresh || refresh.startsWith('local-refresh-')) {
          console.log('🔐 No hay refresh token válido para renovar sesión')
          webSocketService.disconnect(false)
          isHandlingAuthError.current = false
          return
        }

        if (refresh && state.token) {
          // Intentar refrescar el token una vez
          console.log('🔄 Intentando refrescar token después de rechazo del servidor...')
          try {
            const response = await axios.post(`${config.apiUrl}/auth/refresh`, {
              refreshToken: refresh,
            })

            const newAccessToken = response.data.datos?.accessToken
            const newRefreshToken = response.data.datos?.refreshToken

            if (newAccessToken) {
              console.log('✅ Token refrescado después de rechazo del servidor')

              await Promise.all([
                setInternetCredentials('auth_token', 'token', newAccessToken),
                setInternetCredentials('refresh_token', 'refresh', newRefreshToken || refresh),
              ])

              dispatch({
                type: AUTH_ACTIONS.LOGIN_SUCCESS,
                payload: {
                  user: state.user,
                  accessToken: newAccessToken,
                  refreshToken: newRefreshToken || refresh,
                },
              })

              webSocketService.resetAuthBlock()

              setTimeout(() => {
                webSocketService.connect(newAccessToken)
                isHandlingAuthError.current = false
              }, 1000)

              return
            }
          } catch (error) {
            console.error('❌ No se pudo refrescar token:', error.message)
          }
        }

        // Si no se pudo refrescar, hacer logout con mensaje
        showMessage({
          message: 'Sesión expirada',
          description: message || 'Por favor, inicia sesión nuevamente',
          type: 'danger',
          duration: 3000,
        })
        logout()
      } finally {
        setTimeout(() => {
          isHandlingAuthError.current = false
        }, 15000)
      }
    }

    webSocketService.on('auth_error', handleWsAuthError)
    return () => webSocketService.off('auth_error', handleWsAuthError)
  }, [logout, state.token, state.user])

  // Verificar y reconectar WebSocket si es necesario
  // Usar ref para evitar reconexiones excesivas
  const lastWsCheckTime = React.useRef(0)
  const wsReconnectAttempts = React.useRef(0)
  const maxWsReconnectAttempts = 3 // Máximo 3 intentos antes de pausar

  useEffect(() => {
    if (!state.isAuthenticated || !state.token || config.isOffline) return

    // Si el token es local, no intentar conectar WebSocket
    if (state.token.startsWith('local-token-')) {
      console.log('🔐 Token local detectado - WebSocket no requerido')
      return
    }

    const checkWebSocketConnection = () => {
      const now = Date.now()
      const wsStatus = webSocketService.getConnectionStatus()

      // Evitar verificaciones muy frecuentes (mínimo 10 segundos entre verificaciones)
      if ((now - lastWsCheckTime.current) < 10000) {
        return
      }

      // Si hay un error de auth reciente, no intentar reconectar
      if (wsStatus.lastError && wsStatus.lastError.toLowerCase().includes('token')) {
        console.log('⚠️ [AuthContext] Error de token detectado, no se reintentará automáticamente')
        return
      }

      lastWsCheckTime.current = now

      console.log('🔍 [AuthContext] Verificando estado WebSocket:', {
        isAuthenticated: state.isAuthenticated,
        hasToken: !!state.token,
        wsConnected: wsStatus.isConnected,
        wsConnecting: wsStatus.isConnecting
      })

      // Si no está conectado ni intentando conectar, intentar conectar
      if (!wsStatus.isConnected && !wsStatus.isConnecting && state.token) {
        // Verificar si hemos excedido los intentos de reconexión
        if (wsReconnectAttempts.current >= maxWsReconnectAttempts) {
          console.log('⚠️ [AuthContext] Máximo de intentos de reconexión alcanzado, pausando...')
          // Resetear después de 60 segundos
          setTimeout(() => {
            wsReconnectAttempts.current = 0
          }, 60000)
          return
        }

        wsReconnectAttempts.current++
        console.log(`🔌 [AuthContext] WebSocket no conectado, intento ${wsReconnectAttempts.current}/${maxWsReconnectAttempts}...`)
        webSocketService.connect(state.token)
      } else if (wsStatus.isConnected) {
        // Resetear contador si está conectado
        wsReconnectAttempts.current = 0
      }
    }

    // Verificar inmediatamente solo si no hay intentos recientes
    const wsStatus = webSocketService.getConnectionStatus()
    if (!wsStatus.isConnected && !wsStatus.isConnecting) {
      checkWebSocketConnection()
    }

    // Verificar cada 30 segundos (aumentado de 5 segundos)
    const interval = setInterval(checkWebSocketConnection, 30000)

    return () => clearInterval(interval)
  }, [state.isAuthenticated, state.token])

  // Escuchar evento de inventario recibido del admin
  useEffect(() => {
    if (!state.isAuthenticated) return

    const handleInventarioRecibido = async (data) => {
      try {
        console.log('📦 Inventario recibido del admin:', data.productos?.length || 0, 'productos')

        const productos = data.productos || []

        if (productos.length === 0) {
          console.warn('⚠️ Inventario recibido sin productos')
          return
        }

        // Formatear productos para guardarlos en SQLite local
        // El formato debe coincidir con la estructura de la tabla productos
        const productosFormateados = productos.map(producto => ({
          _id: producto.id || producto._id || `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          id_uuid: producto.id_uuid || producto.id || `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          nombre: producto.nombre || '',
          codigoBarras: producto.codigo_barra || producto.codigoBarras || '',
          precioVenta: producto.precioVenta || producto.costo || 0,
          stock: producto.cantidad || producto.stock || 0,
          costo: producto.costo || producto.precioVenta || 0,
          categoria: producto.categoria || '',
          unidad: producto.unidad || '',
          descripcion: producto.descripcion || '',
          sku: producto.sku || producto.codigoBarras || '',
          activo: 1,
          is_dirty: 0, // No necesita sincronización ya que viene del servidor
          last_updated: Date.now()
        }))

        // Guardar productos en SQLite local (usando transacción para sobrescribir)
        console.log('💾 Guardando productos en base de datos local...')
        const resultado = await localDb.guardarProductos(productosFormateados)

        console.log(`✅ Inventario guardado: ${resultado.count || productosFormateados.length} productos`)

        // Mostrar notificación al usuario
        showMessage({
          message: 'Inventario actualizado',
          description: `El admin envió ${productosFormateados.length} productos`,
          type: 'success',
          duration: 4000,
        })

        // Emitir evento local para que otros componentes puedan actualizar
        webSocketService.emitLocal('inventario_actualizado', {
          productos: productosFormateados,
          timestamp: Date.now()
        })
      } catch (error) {
        console.error('❌ Error guardando inventario recibido:', error)
        showMessage({
          message: 'Error al guardar inventario',
          description: error.message || 'No se pudo guardar el inventario recibido',
          type: 'danger',
          duration: 5000,
        })
      }
    }

    webSocketService.on('send_inventory', handleInventarioRecibido)

    return () => {
      webSocketService.off('send_inventory', handleInventarioRecibido)
    }
  }, [state.isAuthenticated])

  // Función para actualizar datos del usuario
  const updateUser = async (userData) => {
    const updatedUser = { ...state.user, ...userData }

    try {
      await setInternetCredentials('user_data', 'user', JSON.stringify(updatedUser))

      dispatch({
        type: AUTH_ACTIONS.UPDATE_USER,
        payload: userData,
      })
    } catch (error) {
      console.error('Error actualizando usuario:', error)
    }
  }

  // Función para limpiar errores
  const clearError = () => {
    dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR })
  }

  // Función para verificar si el usuario tiene un rol específico
  const hasRole = (role) => {
    return state.user?.rol === role
  }

  // Función para verificar si el usuario tiene permisos
  const hasPermission = (permission) => {
    if (!state.user) return false

    const role = state.user.rol

    // Definir permisos detallados por rol
    const permissions = {
      administrador: ['all'],
      contable: ['reports', 'costs', 'inventory', 'clients', 'products'],
      contador: ['reports', 'costs', 'inventory', 'clients', 'products'],
      colaborador: ['inventory', 'products'],
      colaborador_temporal: ['inventory', 'products'],
    }

    const userPermissions = permissions[role] || []

    // 'all' da acceso a todo
    if (userPermissions.includes('all')) return true

    return userPermissions.includes(permission)
  }

  const value = {
    ...state,
    login,
    register,
    logout,
    loginAsCollaborator,
    updateUser,
    clearError,
    hasRole,
    hasPermission,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthContext



