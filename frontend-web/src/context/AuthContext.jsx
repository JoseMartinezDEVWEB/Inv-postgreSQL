import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react'
import { authApi, handleApiResponse, handleApiError } from '../services/api'
import webSocketService from '../services/websocket'
import toast from 'react-hot-toast'

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

  // Verificar autenticación al cargar la aplicación
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('accessToken')
        const refreshToken = localStorage.getItem('refreshToken')
        const user = localStorage.getItem('user')

        // Validar que los datos no sean "undefined" o null
        if (token && refreshToken && user && 
            token !== 'undefined' && refreshToken !== 'undefined' && user !== 'undefined') {
          const userData = JSON.parse(user)
          
          dispatch({
            type: AUTH_ACTIONS.LOGIN_SUCCESS,
            payload: {
              user: userData,
              accessToken: token,
              refreshToken: refreshToken,
            },
          })

          // Conectar WebSocket
          webSocketService.connect(token)
        } else {
          // Limpiar datos inválidos del localStorage
          if (token === 'undefined' || refreshToken === 'undefined' || user === 'undefined') {
            localStorage.removeItem('accessToken')
            localStorage.removeItem('refreshToken')
            localStorage.removeItem('user')
          }
          dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false })
        }
      } catch (error) {
        console.error('Error verificando autenticación:', error)
        // Limpiar datos corruptos del localStorage
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        localStorage.removeItem('user')
        dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false })
      }
    }

    checkAuth()
  }, [])

  // Función de login
  const login = async (credentials) => {
    try {
      dispatch({ type: AUTH_ACTIONS.LOGIN_START })
      
      const response = await authApi.login(credentials)
      const { usuario, accessToken, refreshToken } = handleApiResponse(response)

      // Guardar en localStorage
      localStorage.setItem('accessToken', accessToken)
      localStorage.setItem('refreshToken', refreshToken)
      localStorage.setItem('user', JSON.stringify(usuario))

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
      webSocketService.connect(accessToken)

      toast.success(`¡Bienvenido, ${usuario?.nombre || usuario?.email || 'Usuario'}!`)
      
      return { success: true, user: usuario }
    } catch (error) {
      const errorMessage = handleApiError(error)
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
    toast.error(msg)
    return { success: false, error: msg }
  }

  // Función de logout
  const logout = useCallback(async () => {
    try {
      // Desconectar WebSocket
      webSocketService.disconnect(true)

      // Limpiar localStorage
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      localStorage.removeItem('user')

      // Actualizar estado
      dispatch({ type: AUTH_ACTIONS.LOGOUT })

      toast.success('Sesión cerrada exitosamente')
    } catch (error) {
      console.error('Error durante logout:', error)
      // Aún así limpiar el estado local
      dispatch({ type: AUTH_ACTIONS.LOGOUT })
    }
  }, [dispatch])

  // Escuchar errores de autenticación del WebSocket
  useEffect(() => {
    const handleWsAuthError = ({ message }) => {
      toast.error(message || 'Tu sesión expiró. Inicia sesión nuevamente.')
      logout()
    }

    webSocketService.on('auth_error', handleWsAuthError)
    return () => webSocketService.off('auth_error', handleWsAuthError)
  }, [logout])

  // Función para actualizar datos del usuario
  const updateUser = (userData) => {
    const updatedUser = { ...state.user, ...userData }
    localStorage.setItem('user', JSON.stringify(updatedUser))
    
    dispatch({
      type: AUTH_ACTIONS.UPDATE_USER,
      payload: userData,
    })
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
    
    // Definir permisos por rol
    const permissions = {
      administrador: ['all'],
      contable: ['inventarios', 'reportes', 'clientes'],
      contador: ['inventarios', 'clientes'],
    }
    
    const userPermissions = permissions[role] || []
    return userPermissions.includes('all') || userPermissions.includes(permission)
  }

  const value = {
    ...state,
    login,
    register,
    logout,
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



