import React, { createContext, useContext, useReducer, useEffect } from 'react'
import { showMessage } from 'react-native-flash-message'
import webSocketService from '../services/websocket'

// Estado inicial
const initialState = {
  notifications: [],
  isConnected: false,
  unreadCount: 0,
}

// Tipos de acciones
const NOTIFICATION_ACTIONS = {
  ADD_NOTIFICATION: 'ADD_NOTIFICATION',
  REMOVE_NOTIFICATION: 'REMOVE_NOTIFICATION',
  CLEAR_ALL: 'CLEAR_ALL',
  MARK_AS_READ: 'MARK_AS_READ',
  SET_CONNECTION_STATUS: 'SET_CONNECTION_STATUS',
  UPDATE_UNREAD_COUNT: 'UPDATE_UNREAD_COUNT',
}

// Reducer
const notificationReducer = (state, action) => {
  switch (action.type) {
    case NOTIFICATION_ACTIONS.ADD_NOTIFICATION:
      const newNotification = {
        id: Date.now() + Math.random(),
        timestamp: new Date(),
        read: false,
        ...action.payload,
      }
      
      return {
        ...state,
        notifications: [newNotification, ...state.notifications].slice(0, 50), // Máximo 50 notificaciones
        unreadCount: state.unreadCount + 1,
      }
    
    case NOTIFICATION_ACTIONS.REMOVE_NOTIFICATION:
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload),
      }
    
    case NOTIFICATION_ACTIONS.CLEAR_ALL:
      return {
        ...state,
        notifications: [],
        unreadCount: 0,
      }
    
    case NOTIFICATION_ACTIONS.MARK_AS_READ:
      return {
        ...state,
        notifications: state.notifications.map(n =>
          n.id === action.payload ? { ...n, read: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }
    
    case NOTIFICATION_ACTIONS.SET_CONNECTION_STATUS:
      return {
        ...state,
        isConnected: action.payload,
      }
    
    case NOTIFICATION_ACTIONS.UPDATE_UNREAD_COUNT:
      return {
        ...state,
        unreadCount: state.notifications.filter(n => !n.read).length,
      }
    
    default:
      return state
  }
}

// Crear contexto
const NotificationContext = createContext()

// Hook personalizado para usar el contexto
export const useNotification = () => {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotification debe ser usado dentro de un NotificationProvider')
  }
  return context
}

// Provider del contexto
export const NotificationProvider = ({ children }) => {
  const [state, dispatch] = useReducer(notificationReducer, initialState)

  // Configurar listeners de WebSocket
  useEffect(() => {
    const handleProductoAgregado = (data) => {
      addNotification({
        type: 'success',
        title: 'Producto Agregado',
        message: `${data.producto.nombre} agregado a la sesión ${data.sesion.numeroSesion}`,
        data,
      })
    }

    const handleProductoRemovido = (data) => {
      addNotification({
        type: 'info',
        title: 'Producto Removido',
        message: `${data.producto.nombre} removido de la sesión ${data.sesion.numeroSesion}`,
        data,
      })
    }

    const handleSesionCompletada = (data) => {
      addNotification({
        type: 'success',
        title: 'Sesión Completada',
        message: `La sesión ${data.sesion.numeroSesion} ha sido completada`,
        data,
      })
    }

    const handleUsuarioConectado = (data) => {
      addNotification({
        type: 'info',
        title: 'Usuario Conectado',
        message: `${data.usuario.nombre} se conectó al sistema`,
        data,
      })
    }

    const handleUsuarioDesconectado = (data) => {
      addNotification({
        type: 'warning',
        title: 'Usuario Desconectado',
        message: `${data.usuario.nombre} se desconectó del sistema`,
        data,
      })
    }

    // Suscribirse a eventos
    webSocketService.on('producto_agregado', handleProductoAgregado)
    webSocketService.on('producto_removido', handleProductoRemovido)
    webSocketService.on('sesion_completada', handleSesionCompletada)
    webSocketService.on('usuario_conectado', handleUsuarioConectado)
    webSocketService.on('usuario_desconectado', handleUsuarioDesconectado)

    // Limpiar listeners al desmontar
    return () => {
      webSocketService.off('producto_agregado', handleProductoAgregado)
      webSocketService.off('producto_removido', handleProductoRemovido)
      webSocketService.off('sesion_completada', handleSesionCompletada)
      webSocketService.off('usuario_conectado', handleUsuarioConectado)
      webSocketService.off('usuario_desconectado', handleUsuarioDesconectado)
    }
  }, [])

  // Función para agregar notificación
  const addNotification = (notification) => {
    dispatch({
      type: NOTIFICATION_ACTIONS.ADD_NOTIFICATION,
      payload: notification,
    })
  }

  // Función para remover notificación
  const removeNotification = (id) => {
    dispatch({
      type: NOTIFICATION_ACTIONS.REMOVE_NOTIFICATION,
      payload: id,
    })
  }

  // Función para limpiar todas las notificaciones
  const clearAll = () => {
    dispatch({ type: NOTIFICATION_ACTIONS.CLEAR_ALL })
  }

  // Función para marcar como leída
  const markAsRead = (id) => {
    dispatch({
      type: NOTIFICATION_ACTIONS.MARK_AS_READ,
      payload: id,
    })
  }

  // Función para marcar todas como leídas
  const markAllAsRead = () => {
    state.notifications.forEach(notification => {
      if (!notification.read) {
        markAsRead(notification.id)
      }
    })
  }

  // Función para obtener notificaciones no leídas
  const getUnreadNotifications = () => {
    return state.notifications.filter(n => !n.read)
  }

  // Función para obtener notificaciones por tipo
  const getNotificationsByType = (type) => {
    return state.notifications.filter(n => n.type === type)
  }

  const value = {
    ...state,
    addNotification,
    removeNotification,
    clearAll,
    markAsRead,
    markAllAsRead,
    getUnreadNotifications,
    getNotificationsByType,
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}

export default NotificationContext



