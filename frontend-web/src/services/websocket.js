import { io } from 'socket.io-client'
import toast from 'react-hot-toast'
import { config as appConfig } from '../config/env'

class WebSocketService {
  constructor() {
    this.socket = null
    this.isConnected = false
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 5
    this.reconnectInterval = 5000
    this.listeners = new Map()
    this.currentToken = null
    this.lastErrorMessage = null
  }

  // Conectar al servidor WebSocket
  connect(token) {
    if (!token || typeof token !== 'string' || !token.trim()) {
      console.warn('[WebSocket] Token inexistente; se omite la conexión.')
      return null
    }

    const sanitizedToken = token.trim()

    if (this.socket && this.isConnected && this.currentToken === sanitizedToken) {
      return this.socket
    }

    this.currentToken = sanitizedToken

    const WS_URL = appConfig.wsUrl

    if (!WS_URL) {
      if (!this._warnedNoWs) {
        console.warn('[WebSocket] VITE_WS_URL no definido; se omite la conexión en tiempo real.')
        this._warnedNoWs = true
      }
      return null
    }

    if (this.socket) {
      this.disconnect()
    }

    this.socket = io(WS_URL, {
      auth: {
        token: sanitizedToken,
        clientType: 'web',
      },
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true,
    })

    this.setupEventListeners()
    return this.socket
  }

  // Configurar listeners de eventos
  setupEventListeners() {
    if (!this.socket) return

    // Remover todos los listeners anteriores antes de agregar nuevos
    this.socket.removeAllListeners()

    this.socket.on('connect', () => {
      console.log('🔌 Conectado al servidor WebSocket, ID:', this.socket.id)
      this.isConnected = true
      this.reconnectAttempts = 0
      this.emitLocal('connected', { socketId: this.socket.id })
    })

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Desconectado del servidor WebSocket:', reason)
      this.isConnected = false
      this.emitLocal('disconnected', { reason })
      
      if (reason === 'io server disconnect') {
        // El servidor desconectó, intentar reconectar
        this.handleReconnect()
      }
    })

    this.socket.on('connect_error', (error) => {
      console.error('❌ Error de conexión WebSocket:', error)
      this.isConnected = false

      const message = this.extractErrorMessage(error)
      this.lastErrorMessage = message

      if (this.isAuthError(message)) {
        toast.error(message || 'Sesión inválida. Inicia sesión nuevamente.')
        this.emitLocal('auth_error', { message: message || 'Token inválido o expirado' })
        this.disconnect()
        return
      }

      this.handleReconnect()
    })

    this.socket.on('sesion_actualizada', (data) => {
      console.log('📊 Sesión actualizada:', data)
      this.emitLocal('sesion_actualizada', data)
    })

    this.socket.on('producto_agregado', (data) => {
      console.log('📦 Producto agregado:', data)
      this.emitLocal('producto_agregado', data)
    })

    this.socket.on('producto_removido', (data) => {
      console.log('🗑️ Producto removido:', data)
      toast.info(`Producto removido: ${data.producto.nombre}`)
      this.emitLocal('producto_removido', data)
    })

    this.socket.on('sesion_completada', (data) => {
      console.log('✅ Sesión completada:', data)
      toast.success(`Sesión completada: ${data.sesion.numeroSesion}`)
      this.emitLocal('sesion_completada', data)
    })

    this.socket.on('usuario_conectado', (data) => {
      console.log('👤 Usuario conectado:', data)
      this.emitLocal('usuario_conectado', data)
    })

    this.socket.on('usuario_desconectado', (data) => {
      console.log('👤 Usuario desconectado:', data)
      this.emitLocal('usuario_desconectado', data)
    })

    // Eventos de colaboradores en línea
    this.socket.on('online_colaboradores_count', (data) => {
      console.log('👥 [WebSocket Web] Colaboradores en línea recibido:', data.count, data)
      this.emitLocal('online_colaboradores_count', data)
    })

    this.socket.on('colaborador_conectado', (data) => {
      console.log('👥 [WebSocket Web] Colaborador conectado recibido:', data)
      console.log(`👥 [WebSocket Web] Total colaboradores ahora: ${data.totalColaboradores}`)
      this.emitLocal('colaborador_conectado', data)
    })

    this.socket.on('colaborador_desconectado', (data) => {
      console.log('👥 [WebSocket Web] Colaborador desconectado recibido:', data)
      console.log(`👥 [WebSocket Web] Total colaboradores ahora: ${data.totalColaboradores}`)
      this.emitLocal('colaborador_desconectado', data)
    })

    // Resultado de envío de inventario
    this.socket.on('sync_finished_ok', (data) => {
      console.log('📦 Resultado de envío de inventario:', data)
      this.emitLocal('sync_finished_ok', data)
    })

    this.socket.on('error', (error) => {
      console.error('❌ Error WebSocket:', error)
    })
  }

  // Manejar reconexión automática
  handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Máximo de intentos de reconexión alcanzado')
      return
    }

    this.reconnectAttempts++
    console.log(`🔄 Intentando reconectar... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
    
    setTimeout(() => {
      if (this.socket && this.currentToken) {
        this.socket.auth = {
          ...(this.socket.auth || {}),
          token: this.currentToken,
        }
        this.socket.connect()
      }
    }, this.reconnectInterval)
  }

  // Unirse a una sala (sesión de inventario)
  joinSession(sessionId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('join_session', { sessionId })
      console.log(`📊 Unido a la sesión: ${sessionId}`)
    }
  }

  // Salir de una sala
  leaveSession(sessionId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('leave_session', { sessionId })
      console.log(`📊 Salió de la sesión: ${sessionId}`)
    }
  }

  // Emitir evento personalizado
  emit(event, data) {
    if (this.socket && this.isConnected) {
      this.socket.emit(event, data)
    }
  }

  // Suscribirse a eventos
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event).push(callback)
  }

  // Desuscribirse de eventos
  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event)
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    }
  }

  // Emitir evento a listeners locales
  emitLocal(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error(`Error en listener de ${event}:`, error)
        }
      })
    }
  }

  // Desconectar
  disconnect(clearListeners = false) {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.isConnected = false
      if (clearListeners) {
        this.listeners.clear()
      }
      console.log('🔌 Desconectado del servidor WebSocket')
    }
    this.currentToken = null
  }

  // Obtener estado de conexión
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      socketId: this.socket?.id,
      lastError: this.lastErrorMessage,
    }
  }

  extractErrorMessage(error) {
    if (!error) return ''
    if (typeof error === 'string') return error
    return error.message || error?.data?.message || ''
  }

  isAuthError(message) {
    if (!message) return false
    const normalized = message.toLowerCase()
    return (
      normalized.includes('token') ||
      normalized.includes('autenticación') ||
      normalized.includes('auth')
    )
  }
}

// Crear instancia singleton
const webSocketService = new WebSocketService()

export default webSocketService



