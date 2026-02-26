import React, { createContext, useContext, useReducer, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'
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

// Componente de notificación individual
const NotificationItem = ({ notification, onRemove, onMarkAsRead }) => {
  const getIcon = (type) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-success-500" />
      case 'error':
        return <AlertCircle className="w-5 h-5 text-danger-500" />
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-warning-500" />
      case 'info':
      default:
        return <Info className="w-5 h-5 text-primary-500" />
    }
  }

  const getBgColor = (type) => {
    switch (type) {
      case 'success':
        return 'bg-success-50 border-success-200'
      case 'error':
        return 'bg-danger-50 border-danger-200'
      case 'warning':
        return 'bg-warning-50 border-warning-200'
      case 'info':
      default:
        return 'bg-primary-50 border-primary-200'
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -50, scale: 0.95 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`relative p-4 rounded-lg border shadow-medium ${getBgColor(notification.type)} ${
        !notification.read ? 'ring-2 ring-primary-200' : ''
      }`}
      onClick={() => !notification.read && onMarkAsRead(notification.id)}
    >
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          {getIcon(notification.type)}
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-gray-900">
            {notification.title}
          </h4>
          {notification.message && (
            <p className="mt-1 text-sm text-gray-600">
              {notification.message}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            {new Date(notification.timestamp).toLocaleTimeString()}
          </p>
        </div>
        
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove(notification.id)
          }}
          className="flex-shrink-0 p-1 rounded-full hover:bg-gray-200 transition-colors"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>
      
      {!notification.read && (
        <div className="absolute top-2 right-2 w-2 h-2 bg-primary-500 rounded-full" />
      )}
    </motion.div>
  )
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
      
      {/* Panel de notificaciones - DESHABILITADO */}
      {/* <NotificationPanel /> */}
    </NotificationContext.Provider>
  )
}

// Componente del panel de notificaciones
const NotificationPanel = () => {
  const { notifications, unreadCount, removeNotification, markAsRead, clearAll, markAllAsRead } = useNotification()
  const [isOpen, setIsOpen] = React.useState(false)

  return (
    <>
      {/* Botón de notificaciones */}
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative p-3 bg-white rounded-full shadow-medium hover:shadow-strong transition-all duration-200 hover-lift"
        >
          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM4.5 19.5L9 15l4.5 4.5L18 15l4.5 4.5" />
          </svg>
          
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-danger-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Panel de notificaciones */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="fixed top-4 right-20 z-40 w-80 max-h-96 bg-white rounded-lg shadow-strong border border-gray-200 overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Notificaciones
                  {unreadCount > 0 && (
                    <span className="ml-2 text-sm text-primary-600">
                      ({unreadCount} nuevas)
                    </span>
                  )}
                </h3>
                
                <div className="flex space-x-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                    >
                      Marcar todas como leídas
                    </button>
                  )}
                  
                  {notifications.length > 0 && (
                    <button
                      onClick={clearAll}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Limpiar
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Lista de notificaciones */}
            <div className="max-h-80 overflow-y-auto custom-scrollbar">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM4.5 19.5L9 15l4.5 4.5L18 15l4.5 4.5" />
                  </svg>
                  <p>No hay notificaciones</p>
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  <AnimatePresence>
                    {notifications.map((notification) => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onRemove={removeNotification}
                        onMarkAsRead={markAsRead}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlay para cerrar el panel */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  )
}

export default NotificationContext



