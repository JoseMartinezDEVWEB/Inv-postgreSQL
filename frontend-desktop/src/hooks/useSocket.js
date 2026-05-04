import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import webSocketService from '../services/websocket'

/**
 * Hook personalizado para manejar Socket.io
 * Proporciona estado de conexión y funcionalidades para colaboradores en línea
 */
export const useSocket = () => {
  const { token, user, isAuthenticated } = useAuth()
  const [onlineColaboradores, setOnlineColaboradores] = useState(0)
  const [onlineColaboradoresDetalles, setOnlineColaboradoresDetalles] = useState([])
  const [isConnected, setIsConnected] = useState(false)
  const listenersSetupRef = useRef(false)

  // Obtener contador de colaboradores en línea
  const obtenerColaboradoresEnLinea = useCallback(() => {
    const rolesAutorizados = ['administrador', 'contable', 'contable']
    if (isConnected && rolesAutorizados.includes(user?.rol)) {
      console.log('📡 [useSocket] Solicitando contador de colaboradores...')
      webSocketService.emit('get_online_colaborators')
    }
  }, [isConnected, user?.rol])

  // Efecto para suscribirse a eventos de Socket.io (solo una vez)
  useEffect(() => {
    if (!user || listenersSetupRef.current) return

    console.log('🔧 [useSocket] Configurando listeners de eventos...')

    // Escuchar actualizaciones de contador de colaboradores
    const handleOnlineCount = (data) => {
      console.log('📊 [useSocket] Recibido contador de colaboradores:', data.count, data)
      if (data.detalles && data.detalles.length > 0) {
        console.log('📋 [useSocket] Detalles de colaboradores:', data.detalles)
      } else {
        console.log('⚠️ [useSocket] No hay detalles de colaboradores en la respuesta')
      }
      setOnlineColaboradores(data.count || 0)
      setOnlineColaboradoresDetalles(data.detalles || [])
    }

    // Escuchar cuando un colaborador se conecta
    const handleColaboradorConectado = (data) => {
      console.log('👥 [useSocket] Colaborador conectado, total:', data.totalColaboradores, data)
      setOnlineColaboradores(data.totalColaboradores || 0)
      obtenerColaboradoresEnLinea() // Refrescar detalles completos
    }

    // Escuchar cuando un colaborador se desconecta
    const handleColaboradorDesconectado = (data) => {
      console.log('👥 [useSocket] Colaborador desconectado, total:', data.totalColaboradores, data)
      setOnlineColaboradores(data.totalColaboradores || 0)
      obtenerColaboradoresEnLinea() // Refrescar detalles completos
    }

    // Escuchar cambios de conexión
    const handleConnected = () => {
      console.log('✅ [useSocket] WebSocket conectado, usuario:', user?.rol)
      setIsConnected(true)

      const rolesAutorizados = ['administrador', 'contable', 'contable']
      if (rolesAutorizados.includes(user?.rol)) {
        console.log('👑 [useSocket] Usuario autorizado, solicitando sincronización inicial...')
        // Solicitar inmediatamente
        obtenerColaboradoresEnLinea()
        // Y después de un pequeño delay para asegurar estabilidad
        setTimeout(obtenerColaboradoresEnLinea, 500)
        setTimeout(obtenerColaboradoresEnLinea, 1500)
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

    // Verificar estado inicial y forzar sincronización si ya está conectado
    const status = webSocketService.getConnectionStatus()
    setIsConnected(status.isConnected)

    const rolesAutorizados = ['administrador', 'contable', 'contable']
    if (status.isConnected && rolesAutorizados.includes(user?.rol)) {
      obtenerColaboradoresEnLinea()
      setTimeout(obtenerColaboradoresEnLinea, 1000)
    }

    // Polling periódico (Safety net) cada 5 segundos
    let intervalId = null
    if (rolesAutorizados.includes(user?.rol)) {
      intervalId = setInterval(() => {
        if (webSocketService.isConnected) {
          obtenerColaboradoresEnLinea()
        }
      }, 5000)
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
  }, [user?.id, user?.rol]) // Solo re-registrar si cambia el usuario o su rol

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

    const rolesAutorizados = ['administrador', 'contable']
    if (!rolesAutorizados.includes(user?.rol)) {
      throw new Error('No tienes permisos para enviar inventario')
    }

    // Emitir evento de envío de inventario (nuevo evento send_inventory)
    webSocketService.emit('send_inventory', { productos })
  }, [isConnected, user?.rol])

  // Memoizar el objeto retornado para evitar re-renders innecesarios en componentes que usan el hook
  return useMemo(() => ({
    isConnected,
    onlineColaboradores,
    onlineColaboradoresDetalles,
    obtenerColaboradoresEnLinea,
    enviarInventarioAColaboradores,
    emit: webSocketService.emit.bind(webSocketService),
    on: webSocketService.on.bind(webSocketService),
    off: webSocketService.off.bind(webSocketService)
  }), [
    isConnected, 
    onlineColaboradores, 
    onlineColaboradoresDetalles, 
    obtenerColaboradoresEnLinea, 
    enviarInventarioAColaboradores
  ])
}
