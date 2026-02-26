import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import webSocketService from '../services/websocket'

/**
 * Hook personalizado para manejar Socket.io
 * Proporciona estado de conexión y funcionalidades para colaboradores en línea
 */
export const useSocket = () => {
  const { token, user, isAuthenticated } = useAuth()
  const [onlineColaboradores, setOnlineColaboradores] = useState(0)
  const [isConnected, setIsConnected] = useState(false)
  const listenersSetupRef = useRef(false)

  // Obtener contador de colaboradores en línea
  const obtenerColaboradoresEnLinea = useCallback(() => {
    if (isConnected && user?.rol === 'administrador') {
      console.log('📡 [useSocket] Solicitando contador de colaboradores...')
      webSocketService.emit('get_online_colaborators')
    } else {
      console.log('⚠️ [useSocket] No se puede solicitar contador:', { isConnected, userRol: user?.rol })
    }
  }, [isConnected, user?.rol])

  // Efecto para suscribirse a eventos de Socket.io (solo una vez)
  useEffect(() => {
    if (!user || listenersSetupRef.current) return

    console.log('🔧 [useSocket] Configurando listeners de eventos...')

    // Escuchar actualizaciones de contador de colaboradores
    const handleOnlineCount = (data) => {
      console.log('📊 [useSocket] Recibido contador de colaboradores:', data.count, data)
      if (data.detalles) {
        console.log('📋 [useSocket] Detalles de colaboradores recibidos:', data.detalles)
      }
      setOnlineColaboradores(data.count || 0)
    }

    // Escuchar cuando un colaborador se conecta
    const handleColaboradorConectado = (data) => {
      console.log('👥 [useSocket] Colaborador conectado, total:', data.totalColaboradores, data)
      setOnlineColaboradores(data.totalColaboradores || 0)
    }

    // Escuchar cuando un colaborador se desconecta
    const handleColaboradorDesconectado = (data) => {
      console.log('👥 [useSocket] Colaborador desconectado, total:', data.totalColaboradores, data)
      setOnlineColaboradores(data.totalColaboradores || 0)
    }

    // Escuchar cambios de conexión
    const handleConnected = () => {
      console.log('✅ [useSocket] WebSocket conectado, usuario:', user?.rol)
      setIsConnected(true)
      // Si es admin, obtener el contador inicial después de un pequeño delay
      if (user?.rol === 'administrador') {
        console.log('👑 [useSocket] Usuario es admin, solicitando contador en 1 segundo...')
        setTimeout(() => {
          obtenerColaboradoresEnLinea()
        }, 1000)
      }
    }

    const handleDisconnected = () => {
      console.log('❌ [useSocket] WebSocket desconectado')
      setIsConnected(false)
      setOnlineColaboradores(0)
    }

    // Suscribirse a eventos
    webSocketService.on('connected', handleConnected)
    webSocketService.on('disconnected', handleDisconnected)
    webSocketService.on('online_colaboradores_count', handleOnlineCount)
    webSocketService.on('colaborador_conectado', handleColaboradorConectado)
    webSocketService.on('colaborador_desconectado', handleColaboradorDesconectado)

    listenersSetupRef.current = true

    // Verificar estado inicial
    const status = webSocketService.getConnectionStatus()
    console.log('🔍 [useSocket] Estado inicial:', { 
      isConnected: status.isConnected, 
      userRol: user?.rol,
      socketId: status.socketId 
    })
    
    setIsConnected(status.isConnected)
    if (status.isConnected && user?.rol === 'administrador') {
      // Solicitar contador inicial inmediatamente y luego periódicamente
      console.log('👑 [useSocket] Admin ya conectado, solicitando contador inicial...')
      // Solicitar inmediatamente
      obtenerColaboradoresEnLinea()
      // Y también después de un pequeño delay para asegurar que el servidor responda
      setTimeout(() => {
        obtenerColaboradoresEnLinea()
      }, 1000)
    }

    // Polling periódico para actualizar contador si es admin (cada 3 segundos)
    let intervalId = null
    if (user?.rol === 'administrador' && status.isConnected) {
      console.log('⏰ [useSocket] Iniciando polling cada 3 segundos...')
      intervalId = setInterval(() => {
        console.log('🔄 [useSocket] Polling: solicitando contador...')
        obtenerColaboradoresEnLinea()
      }, 3000) // Actualizar cada 3 segundos
    }

    // Cleanup
    return () => {
      console.log('🧹 [useSocket] Limpiando listeners...')
      listenersSetupRef.current = false
      webSocketService.off('connected', handleConnected)
      webSocketService.off('disconnected', handleDisconnected)
      webSocketService.off('online_colaboradores_count', handleOnlineCount)
      webSocketService.off('colaborador_conectado', handleColaboradorConectado)
      webSocketService.off('colaborador_desconectado', handleColaboradorDesconectado)
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [user, user?.rol, obtenerColaboradoresEnLinea])

  // Efecto para verificar estado de conexión periódicamente
  useEffect(() => {
    if (!isAuthenticated || !token) {
      setIsConnected(false)
      setOnlineColaboradores(0)
      return
    }

    const checkConnection = () => {
      const status = webSocketService.getConnectionStatus()
      setIsConnected(status.isConnected)
    }

    // Verificar inmediatamente
    checkConnection()

    // Verificar cada 2 segundos
    const interval = setInterval(checkConnection, 2000)

    return () => clearInterval(interval)
  }, [isAuthenticated, token])

  // Función para enviar inventario a colaboradores
  const enviarInventarioAColaboradores = useCallback((productos) => {
    if (!isConnected) {
      throw new Error('No hay conexión con el servidor')
    }

    if (user?.rol !== 'administrador') {
      throw new Error('Solo los administradores pueden enviar inventario')
    }

    // Emitir evento de envío de inventario (nuevo evento send_inventory)
    webSocketService.emit('send_inventory', { productos })
  }, [isConnected, user?.rol])

  return {
    isConnected,
    onlineColaboradores,
    obtenerColaboradoresEnLinea,
    enviarInventarioAColaboradores,
    emit: webSocketService.emit.bind(webSocketService),
    on: webSocketService.on.bind(webSocketService),
    off: webSocketService.off.bind(webSocketService)
  }
}

