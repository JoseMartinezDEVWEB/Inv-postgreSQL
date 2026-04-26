import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  TextInput,
  Modal,
  Switch,
  ScrollView,
  Animated,
  Easing,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { CameraView, Camera } from 'expo-camera'
import { productosApi, solicitudesConexionApi } from '../services/api'
import localDb from '../services/localDb'
import NetInfo from '@react-native-community/netinfo'
import { showMessage } from 'react-native-flash-message'
import AsyncStorage from '@react-native-async-storage/async-storage'
import ModalSincronizacionBLE from '../components/ModalSincronizacionBLE'
import ModalSincronizacionInventario from '../components/ModalSincronizacionInventario'
import BLEService from '../services/BLEService'
import SincronizacionRedModal from '../components/modals/SincronizacionRedModal'
import BarcodeProductModal from '../components/modals/BarcodeProductModal'
import ZeroCostProductsColaboradorModal from '../components/modals/ZeroCostProductsColaboradorModal'
import syncService from '../services/syncService'
import { useAuth } from '../context/AuthContext'
import webSocketService from '../services/websocket'
import { getInternetCredentials, setInternetCredentials } from '../services/secureStorage'
import { config } from '../config/env'

const SesionColaboradorScreen = ({ route, navigation }) => {
  const { solicitudId, sesionInventario } = route.params || {}
  const { loginAsCollaborator } = useAuth()

  const [productos, setProductos] = useState([])
  const [productosOffline, setProductosOffline] = useState([])
  const [isConnected, setIsConnected] = useState(true)
  const [hasPermission, setHasPermission] = useState(null)
  const [envioTiempoReal, setEnvioTiempoReal] = useState(true) // Checkbox para envío en tiempo real

  const [showScanner, setShowScanner] = useState(false)
  const [flashOn, setFlashOn] = useState(false)
  const [modalBuscar, setModalBuscar] = useState(false)
  const [modalManual, setModalManual] = useState(false)
  const [modalEditar, setModalEditar] = useState(false)
  const [modalBLE, setModalBLE] = useState(false)
  const [modalRedLocal, setModalRedLocal] = useState(false)
  const [showBarcodeProductModal, setShowBarcodeProductModal] = useState(false)
  const [modalSincronizar, setModalSincronizar] = useState(false)
  const [modalZeroCost, setModalZeroCost] = useState(false)
  const [modalAgendaDetalle, setModalAgendaDetalle] = useState(false)
  const [envioSeleccionado, setEnvioSeleccionado] = useState(null)
  const [modalConfirmarEnvio, setModalConfirmarEnvio] = useState(false)
  const [modalAnimacionEnvio, setModalAnimacionEnvio] = useState(false)
  
  // Animaciones para el modal de envío
  const sendAnimation = useRef(new Animated.Value(0)).current
  const scaleAnimation = useRef(new Animated.Value(1)).current
  const checkmarkAnimation = useRef(new Animated.Value(0)).current
  const [productoParaAgregar, setProductoParaAgregar] = useState(null)
  const [codigoBarrasEscaneado, setCodigoBarrasEscaneado] = useState(null)
  const [estadisticasSync, setEstadisticasSync] = useState({ pendientes: 0, completadas: 0, errores: 0 })
  const [isSincronizandoInventario, setIsSincronizandoInventario] = useState(false)
  
  // Ref para evitar procesamiento múltiple de inventario
  const processingInventoryRef = useRef({ isProcessing: false, lastTimestamp: null })

  const [barcode, setBarcode] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [resultadosBusqueda, setResultadosBusqueda] = useState([])

  const [nombreProducto, setNombreProducto] = useState('')
  const [skuProducto, setSkuProducto] = useState('')
  const [cantidad, setCantidad] = useState('1')
  const [costo, setCosto] = useState('')
  const [editandoProducto, setEditandoProducto] = useState(null)

  const [modalHistorial, setModalHistorial] = useState(false)
  const [historialEnvios, setHistorialEnvios] = useState([])
  const [clienteNombre, setClienteNombre] = useState('')

  const cargarHistorialLocal = async () => {
    try {
      const historial = await AsyncStorage.getItem('historial_envios_colaborador')
      if (historial) {
        setHistorialEnvios(JSON.parse(historial))
      }
    } catch (e) {
      console.error('Error cargando historial', e)
    }
  }

  const guardarEnHistorial = async (conteoProductos, productosEnviados) => {
    const nuevoEnvio = {
      id: Date.now().toString(),
      fecha: new Date().toISOString(),
      cliente: clienteNombre || 'Cliente General',
      cantidadProductos: conteoProductos,
      productos: productosEnviados || [], // Guardar lista de productos
      status: 'Enviado'
    }
    const nuevoHistorial = [nuevoEnvio, ...historialEnvios]
    setHistorialEnvios(nuevoHistorial)
    await AsyncStorage.setItem('historial_envios_colaborador', JSON.stringify(nuevoHistorial))
  }

  // Agrupar historial por día
  const agruparHistorialPorDia = () => {
    const grupos = {}
    historialEnvios.forEach(envio => {
      const fecha = new Date(envio.fecha).toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
      if (!grupos[fecha]) {
        grupos[fecha] = []
      }
      grupos[fecha].push(envio)
    })
    return grupos
  }

  useEffect(() => {
    cargarProductosOffline()
    cargarHistorialLocal()

    syncService.start()

    // Listener para eventos de sincronización
    const unsubscribeSync = syncService.addListener((evento) => {
      if (evento.tipo === 'tarea_completada') {
        cargarProductosOffline()
        actualizarEstadisticasSync()
      }
    })

    // Actualizar estadísticas iniciales
    actualizarEstadisticasSync()

    // Conectar colaborador cuando se monta el componente
    const conectarColaborador = async () => {
      try {
        await solicitudesConexionApi.conectar(solicitudId)
        
        // Generar token local para WebSocket si no existe
        console.log('🔐 [SesionColaborador] Verificando credenciales para WebSocket...')
        const tokenCredentials = await getInternetCredentials('auth_token')
        const userCredentials = await getInternetCredentials('user_data')
        
        if (!tokenCredentials?.password || !userCredentials?.password) {
          console.log('🔐 [SesionColaborador] No hay credenciales, generando token local para colaborador...')
          const localToken = `colaborador-token-${solicitudId}-${Date.now()}`
          const colaboradorUser = {
            nombre: 'Colaborador',
            rol: 'colaborador',
            tipo: 'colaborador_sesion',
            solicitudId: solicitudId
          }
          
          await Promise.all([
            setInternetCredentials('auth_token', 'token', localToken),
            setInternetCredentials('user_data', 'user', JSON.stringify(colaboradorUser))
          ])
          
          console.log('✅ [SesionColaborador] Credenciales guardadas, conectando WebSocket...')
          
          // Conectar WebSocket con el token local
          if (!config.isOffline) {
            webSocketService.connect(localToken)
          }
        } else {
          console.log('✅ [SesionColaborador] Credenciales existentes, verificando conexión WebSocket...')
          const token = tokenCredentials.password
          
          // Verificar si el WebSocket está conectado
          const wsStatus = webSocketService.getConnectionStatus()
          if (!wsStatus.isConnected && !wsStatus.isConnecting && !config.isOffline) {
            console.log('🔌 [SesionColaborador] WebSocket no conectado, intentando conectar...')
            webSocketService.connect(token)
          }
        }
      } catch (error) {
        console.error('❌ [SesionColaborador] Error al conectar colaborador:', error)
        // Silencioso - puede fallar si ya está conectado
      }
    }
    conectarColaborador()

    // Sistema de ping periódico para mantener conexión activa (cada 20 segundos)
    const pingInterval = setInterval(async () => {
      if (isConnected) {
        try {
          await solicitudesConexionApi.ping(solicitudId)
        } catch (error) {
          // Silencioso - si falla el ping, no es crítico
        }
      }
    }, 20000) // 20 segundos

    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(Boolean(state.isConnected))

      if (state.isConnected) {
        showMessage({ message: '✅ Conectado - Sincronizando...', type: 'success' })
        // Conectar cuando se detecta conexión
        conectarColaborador()
        // Forzar sincronización cuando se detecta conexión
        syncService.forzarSincronizacion()
      } else {
        showMessage({ message: '⚠️ Sin conexión - Modo offline activado', type: 'warning' })
      }
    })

    const getCameraPermissions = async () => {
      const { status } = await Camera.requestCameraPermissionsAsync()
      setHasPermission(status === 'granted')
    }
    getCameraPermissions()

    // Escuchar evento de sincronización de inventario desde el admin
    const handleSendInventory = async (data) => {
      console.log('📦 [SesionColaboradorScreen] Recibido send_inventory:', data.productos?.length || 0, 'productos', 'timestamp:', data.timestamp)
      
      if (!data.productos || data.productos.length === 0) {
        console.warn('⚠️ [SesionColaboradorScreen] No hay productos para sincronizar')
        return
      }

      // Evitar procesar el mismo inventario múltiples veces
      if (processingInventoryRef.current.isProcessing) {
        console.log('⏸️ [SesionColaboradorScreen] Ya se está procesando un inventario, ignorando duplicado')
        return
      }

      // Si es el mismo timestamp, ignorarlo
      if (data.timestamp && processingInventoryRef.current.lastTimestamp === data.timestamp) {
        console.log('⏸️ [SesionColaboradorScreen] Inventario con mismo timestamp, ignorando duplicado')
        return
      }

      processingInventoryRef.current.isProcessing = true
      processingInventoryRef.current.lastTimestamp = data.timestamp
      setIsSincronizandoInventario(true)

      try {
        console.log('🔄 [SesionColaboradorScreen] Iniciando sincronización de productos...')
        // Usar el método de sincronización masiva de localDb (actualiza SQLite)
        await localDb.sincronizarProductosMasivo(data.productos)
        console.log('✅ [SesionColaboradorScreen] Sincronización completada exitosamente')
        
        // Mostrar mensaje de éxito
        Alert.alert(
          '¡Inventario actualizado!',
          `Se sincronizaron ${data.productos.length} productos correctamente. Los productos ahora están disponibles para buscar y escanear.`,
          [{ 
            text: 'OK',
            onPress: () => {
              // Recargar productos offline para refrescar cualquier caché
              cargarProductosOffline()
            }
          }]
        )
      } catch (error) {
        console.error('❌ [SesionColaboradorScreen] Error sincronizando productos:', error)
        Alert.alert(
          'Error',
          'No se pudo sincronizar el inventario. Por favor, intente nuevamente.',
          [{ text: 'OK' }]
        )
      } finally {
        processingInventoryRef.current.isProcessing = false
        setIsSincronizandoInventario(false)
      }
    }

    webSocketService.on('send_inventory', handleSendInventory)

    // Cleanup al desmontar
    return () => {
      webSocketService.off('send_inventory', handleSendInventory)
      clearInterval(pingInterval)
      unsubscribe()
      unsubscribeSync()
      syncService.stop()
      
      // Desconectar colaborador al salir
      solicitudesConexionApi.cerrarSesion(solicitudId).catch(() => {
        // Silencioso
      })
      
      // Limpiar recursos de BLE si estaban en uso
      if (BLEService.isInitialized && !BLEService.isDestroyed) {
        try {
          BLEService.stopScan()
        } catch (error) {
          console.warn('⚠️ Error al limpiar BLE en unmount:', error.message)
        }
      }
    }
  }, [solicitudId])

  // Lógica de agrupación visual para cumplir con el requerimiento de "sumar cantidades" y "mover al principio"
  const productosVisuales = useMemo(() => {
    const grupos = {};
    
    // Solo procesamos si hay productos
    if (!productos || productos.length === 0) return [];

    productos.forEach(p => {
      // Clave única por nombre y código de barras/sku (normalizada)
      const nombreNorm = (p.nombre || '').toLowerCase().trim();
      const codigoNorm = (p.codigoBarras || p.sku || '').trim();
      const key = `${nombreNorm}-${codigoNorm}`;
      
      if (!grupos[key]) {
        grupos[key] = { 
          ...p, 
          cantidad: 0, 
          _ids: [], 
          maxTimestamp: p.timestamp 
        };
      }
      
      grupos[key].cantidad += Number(p.cantidad) || 0;
      grupos[key]._ids.push(p.temporalId);
      
      // Mantener el timestamp más reciente para el ordenamiento
      if (new Date(p.timestamp) > new Date(grupos[key].maxTimestamp)) {
        grupos[key].maxTimestamp = p.timestamp;
        grupos[key].timestamp = p.timestamp; // Actualizar también el campo que usa la UI
        // También actualizamos otros datos del registro más reciente (como el costo)
        grupos[key].costo = p.costo;
      }
    });

    // Convertir a array y ordenar por el timestamp más reciente (DESC)
    return Object.values(grupos).sort((a, b) => 
      new Date(b.maxTimestamp).getTime() - new Date(a.maxTimestamp).getTime()
    );
  }, [productos]);

  const cargarProductosOffline = async () => {
    try {
      let lista = await localDb.obtenerProductosColaborador(solicitudId)
      // Ordenar por timestamp (más reciente primero)
      lista = lista.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      setProductosOffline(lista)
      setProductos(lista)
    } catch (error) {
      console.error('Error al cargar productos offline:', error)
    }
  }

  const actualizarEstadisticasSync = async () => {
    try {
      const stats = await syncService.obtenerEstadisticas()
      setEstadisticasSync(stats)
    } catch (error) {
      console.error('Error actualizando estadísticas:', error)
    }
  }

  const guardarItemOffline = async (item) => {
    try {
      // Buscar si ya existe un producto con el mismo código de barras o nombre
      const productoExistente = productosOffline.find(p => 
        (item.codigoBarras && p.codigoBarras && p.codigoBarras === item.codigoBarras) ||
        (p.nombre.toLowerCase() === item.nombre.toLowerCase())
      )

      if (productoExistente) {
        // Sumar cantidad al producto existente y moverlo al inicio
        const productoActualizado = {
          ...productoExistente,
          cantidad: Number(productoExistente.cantidad) + Number(item.cantidad),
          costo: Number(item.costo) || Number(productoExistente.costo), // Usar el nuevo costo si se proporciona
          timestamp: new Date().toISOString(), // Actualizar timestamp para que aparezca primero
          offline: !isConnected,
        }
        
        // Eliminar el producto existente y guardar el actualizado
        await localDb.eliminarProductoColaborador(productoExistente.temporalId)
        await localDb.guardarProductoColaborador(productoActualizado, solicitudId)
        
        showMessage({
          message: `Cantidad sumada a ${item.nombre}`,
          description: `Nueva cantidad: ${productoActualizado.cantidad}`,
          type: 'info',
        })
      } else {
        // Guardar nuevo producto
        await localDb.guardarProductoColaborador(item, solicitudId)
      }
      
      // Recargar lista y ordenar por timestamp (más reciente primero)
      let lista = await localDb.obtenerProductosColaborador(solicitudId)
      lista = lista.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      setProductosOffline(lista)
      setProductos(lista)
    } catch (error) {
      console.error('Error al guardar offline:', error)
    }
  }

  const crearItemColaborador = (base) => {
    return {
      temporalId: base.temporalId || `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      nombre: base.nombre,
      sku: base.sku || '',
      codigoBarras: base.codigoBarras || '',
      cantidad: Number(base.cantidad) || 1,
      costo: Number(base.costo) || 0,
      timestamp: base.timestamp || new Date().toISOString(),
      offline: !isConnected,
    }
  }

  const enviarProductoServidor = async (item) => {
    const payload = {
      temporalId: item.temporalId,
      nombre: item.nombre,
      sku: item.sku,
      codigoBarras: item.codigoBarras,
      cantidad: item.cantidad,
      costo: item.costo,
      timestamp: item.timestamp,
      origen: 'colaborador',
    }

    // Si envío en tiempo real está activado y hay conexión, enviar inmediatamente
    if (envioTiempoReal && isConnected) {
      try {
        await solicitudesConexionApi.agregarProductoOffline(solicitudId, payload)
        showMessage({ message: '✅ Producto enviado', type: 'success' })
        cargarProductosOffline()
      } catch (error) {
        console.error('Error al enviar producto:', error)
        // Si falla, agregar a cola de sincronización
        await syncService.agregarTarea('enviar_producto', { solicitudId, producto: payload })
        showMessage({ message: '📦 Guardado en cola de sincronización', type: 'info' })
        await guardarItemOffline({ ...item, offline: true })
        cargarProductosOffline()
      }
    } else {
      // Si envío en tiempo real está desactivado o no hay conexión: agregar a cola
      await syncService.agregarTarea('enviar_producto', { solicitudId, producto: payload })
      showMessage({
        message: '📦 Producto guardado',
        description: envioTiempoReal 
          ? 'Se enviará cuando haya conexión' 
          : 'Se enviará cuando sincronices manualmente',
        type: 'info',
      })
      await guardarItemOffline({ ...item, offline: true })
      cargarProductosOffline()
    }
    
    await actualizarEstadisticasSync()
  }

  const agregarOActualizarEnListas = async (item) => {
    // Guardar siempre en local primero como respaldo
    await guardarItemOffline({ ...item, offline: !isConnected })
  }

  // Manejar confirmación del modal de producto
  const handleBarcodeProductConfirm = async ({ cantidad: cantidadConfirmada, costo: costoConfirmado }) => {
    if (!productoParaAgregar) return

    setShowBarcodeProductModal(false)

    const item = crearItemColaborador({
      nombre: productoParaAgregar.nombre,
      sku: productoParaAgregar.sku,
      codigoBarras: codigoBarrasEscaneado || productoParaAgregar.codigoBarras || productoParaAgregar.codigo,
      cantidad: cantidadConfirmada,
      costo: costoConfirmado,
    })

    agregarOActualizarEnListas(item)

    // Si envío en tiempo real está activado, enviar inmediatamente
    if (envioTiempoReal && isConnected) {
      await enviarProductoServidor(item)
    } else {
      showMessage({
        message: '📦 Producto guardado',
        description: envioTiempoReal 
          ? 'Se enviará cuando haya conexión' 
          : 'Se enviará cuando sincronices manualmente',
        type: 'success',
      })
    }

    setProductoParaAgregar(null)
    setCodigoBarrasEscaneado(null)
  }

  const handleAgregarDesdeBase = async (baseProducto, cantidadInicial = 1, costoInicial = 0) => {
    // Abrir modal para confirmar cantidad y costo
    setProductoParaAgregar(baseProducto)
    setCodigoBarrasEscaneado(null)
    setShowBarcodeProductModal(true)
  }

  const handleAgregarManual = async () => {
    if (!nombreProducto || !cantidad) {
      Alert.alert('Error', 'Ingresa al menos nombre y cantidad')
      return
    }

    const item = crearItemColaborador({
      nombre: nombreProducto,
      sku: skuProducto,
      codigoBarras: barcode,
      cantidad,
      costo,
    })

    // Guardar también en el catálogo general local para que sea buscable después
    try {
      await localDb.crearProductoLocal({
        nombre: nombreProducto,
        sku: skuProducto,
        codigoBarras: barcode,
        costo: Number(costo) || 0,
        precioVenta: (Number(costo) || 0) * 1.2 // Margen sugerido
      });
    } catch (e) {
      console.log('El producto ya existe en el catálogo o hubo error al guardar');
    }

    agregarOActualizarEnListas(item)

    // Si envío en tiempo real está activado, enviar inmediatamente
    if (envioTiempoReal && isConnected) {
      await enviarProductoServidor(item)
    } else {
      showMessage({
        message: '📦 Producto guardado',
        description: envioTiempoReal 
          ? 'Se enviará cuando haya conexión' 
          : 'Se enviará cuando sincronices manualmente',
        type: 'success',
      })
    }

    setNombreProducto('')
    setSkuProducto('')
    setBarcode('')
    setCantidad('1')
    setCosto('')
    setModalManual(false)
  }

  const handleEditarGuardar = async () => {
    if (!editandoProducto) return

    const actualizado = {
      ...editandoProducto,
      cantidad: Number(cantidad) || 1,
      costo: Number(costo) || 0,
      timestamp: new Date().toISOString(),
      offline: !isConnected,
    }

    agregarOActualizarEnListas(actualizado)

    if (isConnected) {
      await enviarProductoServidor(actualizado)
    }

    setEditandoProducto(null)
    setCantidad('1')
    setCosto('')
    setModalEditar(false)
  }

  const handleEliminar = async (item) => {
    const esGrupo = item._ids && item._ids.length > 1;
    const mensaje = esGrupo 
      ? `¿Quitar todas las unidades (${item.cantidad}) de "${item.nombre}"?`
      : '¿Quitar este producto de tu lista?';

    Alert.alert('Eliminar', mensaje, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          if (item._ids) {
            // Eliminar todos los registros que componen el grupo
            for (const id of item._ids) {
              await localDb.eliminarProductoColaborador(id)
            }
          } else {
            await localDb.eliminarProductoColaborador(item.temporalId)
          }
          cargarProductosOffline()
        },
      },
    ])
  }

  const handleBarCodeScanned = async ({ data }) => {
    setShowScanner(false)
    try {
      // Intentar buscar primero en el servidor si hay conexión
      let producto = null
      
      if (isConnected) {
        try {
          const response = await productosApi.getByBarcode(data)
          producto = response.data.datos?.producto || response.data.producto
        } catch (e) {
          console.log('No encontrado en servidor, buscando localmente...')
        }
      }
      
      // Si no se encontró o no hay conexión, buscar en SQLite local
      if (!producto) {
        try {
          console.log('🔍 [SesionColaborador] Buscando en SQLite local...')
          producto = await localDb.buscarProductoPorCodigo(data)
          if (producto) {
            console.log('✅ [SesionColaborador] Producto encontrado en SQLite local')
          }
        } catch (error) {
          console.warn('⚠️ [SesionColaborador] Error buscando en SQLite:', error.message)
        }
      }
      
      if (!producto) {
        Alert.alert(
          'Producto no encontrado',
          `No se encontró un producto con el código ${data}. Puedes crearlo manualmente.`,
          [
            {
              text: 'Crear Manual',
              onPress: () => {
                setBarcode(data)
                setNombreProducto('')
                setSkuProducto('')
                setCantidad('1')
                setCosto('')
                setModalManual(true)
              },
            },
            { text: 'Cerrar', style: 'cancel' },
          ]
        )
        return
      }

      // Abrir modal para confirmar cantidad y costo
      setProductoParaAgregar(producto)
      setCodigoBarrasEscaneado(data)
      setShowBarcodeProductModal(true)
    } catch (error) {
      console.error('Error al buscar por código de barras:', error)
      Alert.alert('Error', 'No se pudo buscar el producto por código de barras')
    }
  }

  const buscarProductos = async () => {
    if (!busqueda || busqueda.trim().length < 2) {
      setResultadosBusqueda([])
      return
    }

    try {
      const clienteId = sesionInventario?.clienteNegocio?._id
      let resultados = []

      // 1. Intentar buscar en productos del cliente (si hay clienteId)
      if (clienteId) {
        try {
          const response = await productosApi.getByClient(clienteId, { buscar: busqueda.trim(), limite: 20 })
          const lista = response.data.datos?.productos || []
          resultados.push(...lista)
        } catch (error) {
          console.warn('⚠️ No se pudo buscar en productos del cliente:', error.message)
        }
      }

      // 2. Buscar en catálogo general (accesible para todos)
      try {
        // En modo colaborador, intentamos obtener productos generales desde el servidor
        // si hay conexión, o usamos SQLite local si no
        if (isConnected) {
          const response = await productosApi.buscarPorNombre(busqueda.trim())
          const lista = response.data.datos?.productos || []

          // Agregar productos generales que no estén ya en resultados
          lista.forEach(prod => {
            if (!resultados.find(r => r._id === prod._id)) {
              resultados.push(prod)
            }
          })
        } else {
          // Si no hay conexión, buscar en SQLite local
          console.log('📴 [SesionColaborador] Modo offline - Buscando en SQLite local...')
          const productosLocales = await localDb.obtenerProductos({ buscar: busqueda.trim() })
          productosLocales.forEach(prod => {
            if (!resultados.find(r => r._id === prod._id || r.id === prod._id)) {
              resultados.push(prod)
            }
          })
        }
      } catch (error) {
        console.warn('⚠️ No se pudo buscar en catálogo general, intentando local:', error.message)
        // Si falla la API, intentar buscar en SQLite local como fallback
        try {
          const productosLocales = await localDb.obtenerProductos({ buscar: busqueda.trim() })
          productosLocales.forEach(prod => {
            if (!resultados.find(r => r._id === prod._id || r.id === prod._id)) {
              resultados.push(prod)
            }
          })
        } catch (localError) {
          console.warn('⚠️ Error buscando en SQLite local:', localError.message)
        }
      }

      setResultadosBusqueda(resultados.slice(0, 20)) // Limitar a 20 resultados

      if (resultados.length === 0) {
        showMessage({
          message: 'Sin resultados',
          description: 'No se encontraron productos con ese nombre',
          type: 'info'
        })
      }
    } catch (error) {
      console.error('Error al buscar productos:', error)
      Alert.alert('Error', 'No se pudo realizar la búsqueda')
    }
  }

  const sincronizarProductos = async () => {
    if (productosOffline.length === 0) {
      Alert.alert('Sin productos', 'No hay productos pendientes de sincronización')
      return
    }

    // Mostrar modal de sincronización
    setModalSincronizar(true)
  }

  // Verificar si hay productos con costo 0
  const productosConCostoZero = productos.filter(p => {
    const costo = Number(p.costo) || 0
    return costo === 0
  })

  // Función para actualizar productos con costo 0
  const handleUpdateZeroCostProducts = async (productosActualizados) => {
    try {
      for (const productoActualizado of productosActualizados) {
        await localDb.eliminarProductoColaborador(productoActualizado.temporalId)
        await localDb.guardarProductoColaborador({
          ...productoActualizado,
          timestamp: new Date().toISOString()
        }, solicitudId)
      }
      await cargarProductosOffline()
    } catch (error) {
      console.error('Error actualizando productos:', error)
    }
  }

  const sincronizarViaInternet = async () => {
    if (!isConnected) {
      Alert.alert('Sin conexión', 'Necesitas conexión a internet para esta opción')
      return
    }

    try {
      const cantidadTotal = productosOffline.length
      const productosParaHistorial = [...productosOffline] // Copia para el historial
      
      for (const item of productosOffline) {
        await enviarProductoServidor(item)
      }

      // Limpiar y guardar historial con los productos
      await localDb.limpiarProductosColaborador(solicitudId)
      await cargarProductosOffline()
      await guardarEnHistorial(cantidadTotal, productosParaHistorial)

      setModalSincronizar(false)
      showMessage({
        message: '✅ Sincronización completada',
        type: 'success',
      })
    } catch (error) {
      console.error('Error al sincronizar:', error)
      Alert.alert('Error', 'No se pudieron sincronizar todos los productos')
    }
  }

  const handleBLESuccess = async () => {
    const cantidadTotal = productosOffline.length
    const productosParaHistorial = [...productosOffline]
    await localDb.limpiarProductosColaborador(solicitudId)
    cargarProductosOffline()
    setModalBLE(false)
    await guardarEnHistorial(cantidadTotal, productosParaHistorial)
    await actualizarEstadisticasSync()
  }

  const handleRedLocalSuccess = async () => {
    const cantidadTotal = productosOffline.length
    const productosParaHistorial = [...productosOffline]
    await localDb.limpiarProductosColaborador(solicitudId)
    cargarProductosOffline()
    setModalRedLocal(false)
    await guardarEnHistorial(cantidadTotal, productosParaHistorial)
    await actualizarEstadisticasSync()
  }

  // Función para ejecutar la animación de envío
  const ejecutarAnimacionEnvio = () => {
    // Resetear animaciones
    sendAnimation.setValue(0)
    scaleAnimation.setValue(1)
    checkmarkAnimation.setValue(0)
    
    setModalAnimacionEnvio(true)
    
    // Secuencia de animaciones
    Animated.sequence([
      // Animación de envío (paquete moviéndose)
      Animated.timing(sendAnimation, {
        toValue: 1,
        duration: 1500,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: true,
      }),
      // Pequeña pausa
      Animated.delay(200),
      // Animación de escala del checkmark
      Animated.parallel([
        Animated.spring(scaleAnimation, {
          toValue: 1.2,
          friction: 3,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(checkmarkAnimation, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
      // Volver a escala normal
      Animated.spring(scaleAnimation, {
        toValue: 1,
        friction: 3,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Cerrar modal después de la animación
      setTimeout(() => {
        setModalAnimacionEnvio(false)
        showMessage({
          message: '✅ Productos enviados correctamente',
          description: `${productos.length} producto(s) sincronizado(s)`,
          type: 'success',
        })
      }, 800)
    })
  }

  // Función para confirmar envío desde el modal
  const handleConfirmarEnvio = async () => {
    setModalConfirmarEnvio(false)
    setEnvioTiempoReal(true)
    
    // Ejecutar animación de envío
    ejecutarAnimacionEnvio()
    
    // Enviar productos al servidor
    if (isConnected && productos.length > 0) {
      try {
        for (const item of productos) {
          await enviarProductoServidor(item)
        }
      } catch (error) {
        console.error('Error enviando productos:', error)
      }
    }
  }

  const handleProductosImportados = async (productosImportados) => {
    try {
      for (const producto of productosImportados) {
        let productoGuardado = null;
        
        // 1. Guardar en el catálogo general local para futuras búsquedas
        try {
          productoGuardado = await localDb.crearProductoLocal({
            nombre: producto.nombre,
            sku: producto.sku || producto.codigo || '',
            codigoBarras: producto.codigoBarras || producto.codigo || '',
            costo: producto.costo || producto.costoBase || 0,
            precioVenta: (producto.costo || producto.costoBase || 0) * 1.3
          });
        } catch (e) {
          // El producto ya podría existir, intentar buscarlo
          console.log('Producto ya existe, buscándolo...', e);
          try {
            const codigoBuscado = producto.codigoBarras || producto.codigo || '';
            if (codigoBuscado) {
              productoGuardado = await localDb.buscarProductoPorCodigo(codigoBuscado);
            }
          } catch (searchError) {
            console.log('Error buscando producto existente:', searchError);
          }
          // Si no se encontró, usar los datos del producto importado
          if (!productoGuardado) {
            productoGuardado = {
              _id: `temp_${Date.now()}`,
              nombre: producto.nombre,
              sku: producto.sku || producto.codigo || '',
              codigoBarras: producto.codigoBarras || producto.codigo || '',
              costo: producto.costo || producto.costoBase || 0,
            };
          }
        }

        // 2. Crear item para la sesión actual usando el producto guardado o los datos del importado
        const item = crearItemColaborador({
          nombre: productoGuardado?.nombre || producto.nombre,
          sku: productoGuardado?.sku || producto.sku || producto.codigo || '',
          codigoBarras: productoGuardado?.codigoBarras || producto.codigoBarras || producto.codigo || '',
          cantidad: producto.cantidad || 1,
          costo: productoGuardado?.costo || producto.costo || producto.costoBase || 0,
        })

        await agregarOActualizarEnListas(item)

        if (isConnected) {
          await enviarProductoServidor(item)
        }
      }

      if (!isConnected) {
        showMessage({
          message: '📦 Productos guardados offline',
          description: 'Se sincronizarán automáticamente cuando haya conexión',
          type: 'success',
        })
      }

      showMessage({
        message: '✅ Importación completada',
        description: `${productosImportados.length} producto(s) importado(s) y agregados al catálogo`,
        type: 'success',
        duration: 4000,
      })
    } catch (error) {
      console.error('Error importando productos:', error)
      Alert.alert('Error', 'No se pudieron importar todos los productos')
    }
  }

  const handleSalir = async () => {
    // Si hay productos sin sincronizar
    if (productosOffline.length > 0) {
      // Verificar si tiene nombre de cliente
      if (!clienteNombre || clienteNombre.trim() === '') {
        Alert.alert(
          '⚠️ Nombre de Cliente Requerido',
          'Debes agregar el nombre del cliente antes de salir para guardar el listado en el historial.',
          [
            { text: 'Agregar Nombre', style: 'default' },
          ]
        )
        return
      }

      Alert.alert(
        'Guardar y Salir',
        `Se guardará el listado de ${productosOffline.length} producto(s) para el cliente "${clienteNombre}" en tu historial de envíos.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { 
            text: 'Guardar y Salir', 
            style: 'default', 
            onPress: async () => {
              // Guardar en historial antes de salir
              await guardarEnHistorial(productosOffline.length, [...productosOffline])
              showMessage({
                message: '✅ Listado guardado en historial',
                description: `Cliente: ${clienteNombre}`,
                type: 'success',
              })
              navigation.navigate('Login')
            }
          },
          { 
            text: 'Salir sin guardar', 
            style: 'destructive', 
            onPress: () => navigation.navigate('Login') 
          },
        ]
      )
    } else {
      // Si no hay productos, mostrar mensaje de confirmación
      Alert.alert(
        'Salir de Sesión',
        '¿Estás seguro que deseas salir?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Salir', onPress: () => navigation.navigate('Login') },
        ]
      )
    }
  }

  const renderProductoItem = ({ item }) => {
    const total = (Number(item.cantidad) || 0) * (Number(item.costo) || 0)

    // Determinar estado de sincronización
    let estadoSync = 'sincronizado' // por defecto
    let colorEstado = '#22c55e' // Verde
    let iconoEstado = 'checkmark-circle'
    let textoEstado = 'Sincronizado'

    if (item.offline) {
      estadoSync = 'pendiente'
      colorEstado = '#f59e0b' // Naranja
      iconoEstado = 'cloud-upload-outline'
      textoEstado = 'Pendiente'
    }

    if (item.error) {
      estadoSync = 'error'
      colorEstado = '#ef4444' // Rojo
      iconoEstado = 'alert-circle'
      textoEstado = 'Error'
    }

    return (
      <View style={styles.productoCard}>
        {/* Indicador de estado visual en el borde izquierdo */}
        <View style={[styles.estadoBorde, { backgroundColor: colorEstado }]} />
        
        <View style={styles.productoInfo}>
          <Text style={styles.productoNombre}>{item.nombre}</Text>
          <Text style={styles.productoSku}>
            SKU: {item.sku || 'Sin SKU'}{item.codigoBarras ? `  ·  CB: ${item.codigoBarras}` : ''}
          </Text>
          <View style={styles.productoStats}>
            <Text style={styles.productoCantidad}>Cant: {item.cantidad}</Text>
            <Text style={styles.productoCosto}>${(Number(item.costo) || 0).toFixed(2)}</Text>
            <Text style={styles.productoTotal}>Total: ${total.toFixed(2)}</Text>
          </View>
          <Text style={styles.productoTimestamp}>{new Date(item.timestamp).toLocaleString()}</Text>
        </View>
        <View style={styles.productoActions}>
          {/* Badge de estado con colores */}
          <View style={[styles.estadoBadge, { backgroundColor: `${colorEstado}20` }]}>
            <Ionicons name={iconoEstado} size={14} color={colorEstado} />
            <Text style={[styles.estadoBadgeText, { color: colorEstado }]}>{textoEstado}</Text>
          </View>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => {
                setEditandoProducto(item)
                setCantidad(String(item.cantidad))
                setCosto(String(item.costo))
                setModalEditar(true)
              }}
            >
              <Ionicons name="create-outline" size={20} color="#3b82f6" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={() => handleEliminar(item)}>
              <Ionicons name="trash-outline" size={20} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    )
  }

  const totalProductos = productos.length
  const totalConteo = productos.reduce((sum, p) => sum + (Number(p.cantidad) || 0), 0)
  const totalValor = productos.reduce(
    (sum, p) => sum + (Number(p.cantidad) || 0) * (Number(p.costo) || 0),
    0
  )

  if (hasPermission === null) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text>Solicitando permisos de cámara...</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1d4ed8', '#3b82f6']} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={handleSalir}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.sesionLabel}>Sesión</Text>
            {/* Input para nombre de cliente */}
            <TextInput
              style={styles.clienteInput}
              placeholder="Nombre Cliente / Ref"
              placeholderTextColor="rgba(255,255,255,0.6)"
              value={clienteNombre}
              onChangeText={setClienteNombre}
            />
            {/* Switch para envío en tiempo real */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <Switch
                value={envioTiempoReal}
                onValueChange={(value) => {
                  if (value && productos.length > 0) {
                    // Si activa el switch y hay productos, mostrar modal de confirmación
                    setModalConfirmarEnvio(true)
                  } else {
                    setEnvioTiempoReal(value)
                  }
                }}
                trackColor={{ false: '#767577', true: '#81b5ff' }}
                thumbColor={envioTiempoReal ? '#fff' : '#f4f3f4'}
                style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
              />
              <Text style={{ color: '#e0f2fe', fontSize: 11, marginLeft: 6 }}>
                Envío en tiempo real
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={() => setModalHistorial(true)} style={{ marginRight: 8 }}>
               <Ionicons name="calendar-outline" size={22} color="#fff" />
            </TouchableOpacity>
            
            <View style={styles.estadoPill}>
              <View
                style={[styles.estadoDot, { backgroundColor: isConnected ? '#22c55e' : '#f59e0b' }]}
              />
              <Text style={styles.estadoText}>{isConnected ? 'En línea' : 'Offline'}</Text>
            </View>
            {productosOffline.length > 0 && (
              <TouchableOpacity style={styles.syncPill} onPress={sincronizarProductos}>
                <Ionicons name="sync" size={16} color="#fff" />
                <Text style={styles.syncPillText}>{productosOffline.length}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </LinearGradient>

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#22c55e' }]}
          onPress={() => setShowScanner(true)}
        >
          <Ionicons name="scan-outline" size={24} color="#fff" />
          <Text style={styles.actionButtonText}>Escanear</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#0ea5e9' }]}
          onPress={() => {
            setBusqueda('')
            setResultadosBusqueda([])
            setModalBuscar(true)
          }}
        >
          <Ionicons name="search-outline" size={24} color="#fff" />
          <Text style={styles.actionButtonText}>Buscar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#f59e0b' }]}
          onPress={() => {
            setNombreProducto('')
            setSkuProducto('')
            setBarcode('')
            setCantidad('1')
            setCosto('')
            setModalManual(true)
          }}
        >
          <Ionicons name="add-circle-outline" size={24} color="#fff" />
          <Text style={styles.actionButtonText}>Nuevo</Text>
        </TouchableOpacity>
      </View>

      {/* Botón de Importar con IA eliminado de la sesión de colaborador */}

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Productos</Text>
          <Text style={styles.summaryValue}>{totalProductos}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Cant.</Text>
          <Text style={styles.summaryValue}>{totalConteo}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Valor Total</Text>
          <Text style={styles.summaryValue}>${totalValor.toFixed(2)}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <FlatList
          data={productosVisuales}
          keyExtractor={(item, index) => item.temporalId || `grupo-${index}`}
          renderItem={renderProductoItem}
          extraData={productosVisuales}
          contentContainerStyle={
            productos.length === 0 ? styles.emptyContainer : styles.listContent
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="cube-outline" size={64} color="#cbd5e1" />
              <Text style={styles.emptyText}>Sin productos en tu lista</Text>
              <Text style={styles.emptySubtext}>
                Usa los botones de arriba para escanear o buscar productos
              </Text>
            </View>
          }
        />
      </View>

      {/* Modal Escáner */}
      {showScanner && hasPermission && (
        <Modal visible={showScanner} animationType="slide">
          <View style={styles.scannerContainer}>
            <CameraView
              onBarcodeScanned={handleBarCodeScanned}
              style={StyleSheet.absoluteFillObject}
              enableTorch={flashOn}
            />
            <View style={styles.scannerOverlay}>
              <TouchableOpacity
                style={styles.scannerClose}
                onPress={() => { setShowScanner(false); setFlashOn(false); }}
              >
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
              {/* Botón de Flash */}
              <TouchableOpacity
                style={[styles.flashToggleBtn, flashOn && styles.flashToggleBtnActive]}
                onPress={() => setFlashOn(prev => !prev)}
              >
                <Ionicons name={flashOn ? 'flash' : 'flash-off'} size={24} color={flashOn ? '#fbbf24' : '#fff'} />
                <Text style={[styles.flashToggleText, flashOn && { color: '#fbbf24' }]}>
                  {flashOn ? 'Flash ON' : 'Flash OFF'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Modal Buscar */}
      <Modal visible={modalBuscar} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Buscar Producto</Text>
            <View style={styles.searchBarContainer}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="Nombre o código"
                value={busqueda}
                onChangeText={setBusqueda}
                onSubmitEditing={buscarProductos}
              />
              <TouchableOpacity 
                style={styles.scannerInSearch} 
                onPress={() => {
                  setModalBuscar(false);
                  setShowScanner(true);
                }}
              >
                <Ionicons name="barcode-outline" size={24} color="#3b82f6" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[styles.buscarButton, { marginTop: 10 }]} onPress={buscarProductos}>
              <Ionicons name="search-outline" size={18} color="#fff" />
              <Text style={styles.buscarButtonText}>Buscar</Text>
            </TouchableOpacity>

            <FlatList
              data={resultadosBusqueda}
              keyExtractor={(item, index) => item._id || item.id || `busqueda-${index}`}
              style={{ marginTop: 12, maxHeight: 260 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.resultItem}
                  onPress={() => {
                    setProductoParaAgregar(item)
                    setCodigoBarrasEscaneado(null)
                    setModalBuscar(false)
                    setShowBarcodeProductModal(true)
                  }}
                >
                  <Text style={styles.resultNombre}>{item.nombre}</Text>
                  <Text style={styles.resultSku}>
                    SKU: {item.sku || 'Sin SKU'} · CB:{' '}
                    {item.codigoBarras || item.codigo || 'N/A'}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={{ paddingVertical: 12 }}>
                  <Text style={{ textAlign: 'center', color: '#94a3b8' }}>
                    Escribe al menos 2 caracteres y presiona Buscar
                  </Text>
                </View>
              }
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalBuscar(false)}
              >
                <Text style={styles.cancelButtonText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Manual */}
      <Modal visible={modalManual} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Agregar Manual</Text>
            <TextInput
              style={styles.input}
              placeholder="Nombre del producto"
              value={nombreProducto}
              onChangeText={setNombreProducto}
            />
            <TextInput
              style={styles.input}
              placeholder="SKU (opcional)"
              value={skuProducto}
              onChangeText={setSkuProducto}
            />
            <TextInput
              style={styles.input}
              placeholder="Código de barras (opcional)"
              value={barcode}
              onChangeText={setBarcode}
            />
            <TextInput
              style={styles.input}
              placeholder="Cantidad"
              value={cantidad}
              onChangeText={setCantidad}
              keyboardType="number-pad"
            />
            <TextInput
              style={styles.input}
              placeholder="Costo por unidad (opcional)"
              value={costo}
              onChangeText={setCosto}
              keyboardType="decimal-pad"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalManual(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.addButton]}
                onPress={handleAgregarManual}
              >
                <Text style={styles.addButtonText}>Agregar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Editar */}
      <Modal visible={modalEditar} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Editar Producto</Text>
            <Text style={{ marginBottom: 8, color: '#475569' }}>{editandoProducto?.nombre}</Text>
            <TextInput
              style={styles.input}
              placeholder="Cantidad"
              value={cantidad}
              onChangeText={setCantidad}
              keyboardType="number-pad"
            />
            <TextInput
              style={styles.input}
              placeholder="Costo por unidad"
              value={costo}
              onChangeText={setCosto}
              keyboardType="decimal-pad"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalEditar(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.addButton]}
                onPress={handleEditarGuardar}
              >
                <Text style={styles.addButtonText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Sincronización BLE */}
      <ModalSincronizacionBLE
        visible={modalBLE}
        onClose={() => setModalBLE(false)}
        productos={productosOffline}
        onSuccess={handleBLESuccess}
        mode="send"
      />

      {/* Modal Sincronización Red Local */}
      <SincronizacionRedModal
        visible={modalRedLocal}
        onClose={() => setModalRedLocal(false)}
        productos={productosOffline}
        onSuccess={handleRedLocalSuccess}
        solicitudId={solicitudId}
      />

      {/* Modal de Sincronización con opciones */}
      <Modal visible={modalSincronizar} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sincronizar Productos</Text>
            <Text style={{ color: '#64748b', marginBottom: 16 }}>
              {productosOffline.length} producto(s) pendiente(s)
            </Text>
            <Text style={{ color: '#475569', marginBottom: 20 }}>
              ¿Cómo quieres sincronizar?
            </Text>

            {/* Botón Productos Valor 0 */}
            {productosConCostoZero.length > 0 && (
              <TouchableOpacity
                style={[styles.syncOptionButton, { backgroundColor: '#fef3c7', borderColor: '#f59e0b' }]}
                onPress={() => {
                  setModalSincronizar(false)
                  setModalZeroCost(true)
                }}
              >
                <Ionicons name="alert-circle" size={22} color="#f59e0b" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.syncOptionText, { color: '#92400e' }]}>
                    Productos Valor $0
                  </Text>
                  <Text style={{ fontSize: 12, color: '#b45309' }}>
                    {productosConCostoZero.length} producto(s) sin costo
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#f59e0b" />
              </TouchableOpacity>
            )}

            {/* Botón Enviar por Internet */}
            <TouchableOpacity
              style={[styles.syncOptionButton, { backgroundColor: '#ecfdf5', borderColor: '#10b981' }]}
              onPress={() => {
                setModalSincronizar(false)
                if (isConnected) {
                  setModalConfirmarEnvio(true)
                } else {
                  Alert.alert('Sin conexión', 'Necesitas conexión a internet para enviar los productos')
                }
              }}
            >
              <Ionicons name="cloud-upload" size={22} color="#10b981" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.syncOptionText, { color: '#065f46' }]}>
                  Enviar al Servidor
                </Text>
                <Text style={{ fontSize: 12, color: '#047857' }}>
                  Sincronizar {productosOffline.length} producto(s)
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#10b981" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton, { marginTop: 20 }]}
              onPress={() => setModalSincronizar(false)}
            >
              <Text style={styles.cancelButtonText}>CANCELAR</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Productos con Costo 0 */}
      <ZeroCostProductsColaboradorModal
        visible={modalZeroCost}
        onClose={() => setModalZeroCost(false)}
        productos={productos}
        onUpdateProducts={handleUpdateZeroCostProducts}
      />

      {/* Modal de confirmación de producto */}
      <BarcodeProductModal
        visible={showBarcodeProductModal}
        onClose={() => {
          setShowBarcodeProductModal(false)
          setProductoParaAgregar(null)
          setCodigoBarrasEscaneado(null)
        }}
        producto={productoParaAgregar}
        codigoBarras={codigoBarrasEscaneado}
        onConfirm={handleBarcodeProductConfirm}
        costoInicial={productoParaAgregar?.costo || productoParaAgregar?.costoBase || ''}
        cantidadInicial="1"
      />

      {/* Modal de sincronización de inventario */}
      <ModalSincronizacionInventario visible={isSincronizandoInventario} />

      {/* Modal de Confirmación de Envío */}
      <Modal visible={modalConfirmarEnvio} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.confirmEnvioModal}>
            <View style={styles.confirmEnvioHeader}>
              <View style={styles.confirmEnvioIconContainer}>
                <Ionicons name="paper-plane" size={40} color="#3b82f6" />
              </View>
              <Text style={styles.confirmEnvioTitle}>Enviar Productos</Text>
            </View>
            
            <Text style={styles.confirmEnvioMessage}>
              ¿Deseas enviar los productos al servidor?
            </Text>
            
            <View style={styles.confirmEnvioStats}>
              <View style={styles.confirmEnvioStatItem}>
                <Ionicons name="cube-outline" size={24} color="#3b82f6" />
                <Text style={styles.confirmEnvioStatNumber}>{productos.length}</Text>
                <Text style={styles.confirmEnvioStatLabel}>Productos</Text>
              </View>
              <View style={styles.confirmEnvioStatDivider} />
              <View style={styles.confirmEnvioStatItem}>
                <Ionicons name="calculator-outline" size={24} color="#10b981" />
                <Text style={styles.confirmEnvioStatNumber}>{totalConteo}</Text>
                <Text style={styles.confirmEnvioStatLabel}>Unidades</Text>
              </View>
            </View>

            <View style={styles.confirmEnvioButtons}>
              <TouchableOpacity
                style={styles.confirmEnvioCancelButton}
                onPress={() => setModalConfirmarEnvio(false)}
              >
                <Text style={styles.confirmEnvioCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmEnvioSendButton}
                onPress={handleConfirmarEnvio}
              >
                <Ionicons name="send" size={18} color="#fff" />
                <Text style={styles.confirmEnvioSendText}>Enviar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Animación de Envío */}
      <Modal visible={modalAnimacionEnvio} animationType="fade" transparent>
        <View style={styles.animacionEnvioOverlay}>
          <View style={styles.animacionEnvioContainer}>
            {/* Animación del paquete enviándose */}
            <Animated.View
              style={[
                styles.animacionPaquete,
                {
                  transform: [
                    {
                      translateY: sendAnimation.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [0, -50, -150],
                      }),
                    },
                    {
                      scale: sendAnimation.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [1, 1.1, 0.3],
                      }),
                    },
                  ],
                  opacity: sendAnimation.interpolate({
                    inputRange: [0, 0.8, 1],
                    outputRange: [1, 1, 0],
                  }),
                },
              ]}
            >
              <Ionicons name="cube" size={60} color="#3b82f6" />
            </Animated.View>

            {/* Nube de destino */}
            <Animated.View
              style={[
                styles.animacionNube,
                {
                  opacity: sendAnimation.interpolate({
                    inputRange: [0, 0.3, 0.7, 1],
                    outputRange: [0.3, 0.5, 0.8, 1],
                  }),
                  transform: [{ scale: scaleAnimation }],
                },
              ]}
            >
              <Ionicons name="cloud" size={80} color="#10b981" />
              {/* Checkmark que aparece al final */}
              <Animated.View
                style={[
                  styles.animacionCheckmark,
                  {
                    opacity: checkmarkAnimation,
                    transform: [
                      {
                        scale: checkmarkAnimation.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.5, 1],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Ionicons name="checkmark-circle" size={40} color="#fff" />
              </Animated.View>
            </Animated.View>

            <Text style={styles.animacionTexto}>Enviando productos...</Text>
            <Text style={styles.animacionSubtexto}>
              {productos.length} producto(s)
            </Text>
          </View>
        </View>
      </Modal>

      {/* Modal Historial / Agenda */}
      <Modal visible={modalHistorial} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={styles.historialHeader}>
              <Ionicons name="calendar" size={24} color="#3b82f6" />
              <Text style={styles.modalTitle}>Historial de Envíos</Text>
            </View>
            
            {historialEnvios.length === 0 ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <Ionicons name="document-text-outline" size={48} color="#cbd5e1" />
                <Text style={{ color: '#64748b', marginTop: 12, textAlign: 'center' }}>
                  No hay historial de envíos aún
                </Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 450 }} showsVerticalScrollIndicator={false}>
                {Object.entries(agruparHistorialPorDia()).map(([fecha, envios]) => (
                  <View key={fecha} style={styles.historialDiaContainer}>
                    <View style={styles.historialDiaHeader}>
                      <Ionicons name="calendar-outline" size={16} color="#64748b" />
                      <Text style={styles.historialDiaFecha}>{fecha}</Text>
                      <View style={styles.historialDiaBadge}>
                        <Text style={styles.historialDiaBadgeText}>{envios.length} cliente(s)</Text>
                      </View>
                    </View>
                    
                    {envios.map((envio) => (
                      <TouchableOpacity
                        key={envio.id}
                        style={styles.historialEnvioItem}
                        onPress={() => {
                          setEnvioSeleccionado(envio)
                          setModalHistorial(false)
                          setModalAgendaDetalle(true)
                        }}
                      >
                        <View style={styles.historialEnvioInfo}>
                          <Text style={styles.historialClienteNombre}>{envio.cliente}</Text>
                          <Text style={styles.historialEnvioHora}>
                            {new Date(envio.fecha).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </View>
                        <View style={styles.historialEnvioStats}>
                          <Text style={styles.historialCantidad}>{envio.cantidadProductos}</Text>
                          <Text style={styles.historialCantidadLabel}>productos</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton, { marginTop: 16 }]}
              onPress={() => setModalHistorial(false)}
            >
              <Text style={styles.cancelButtonText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Detalle de Envío (Solo Lectura) */}
      <Modal visible={modalAgendaDetalle} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '85%' }]}>
            <View style={styles.detalleHeader}>
              <TouchableOpacity 
                onPress={() => {
                  setModalAgendaDetalle(false)
                  setModalHistorial(true)
                }}
                style={{ padding: 4 }}
              >
                <Ionicons name="arrow-back" size={24} color="#64748b" />
              </TouchableOpacity>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.detalleClienteNombre}>
                  {envioSeleccionado?.cliente || 'Cliente'}
                </Text>
                <Text style={styles.detalleFecha}>
                  {envioSeleccionado ? new Date(envioSeleccionado.fecha).toLocaleString('es-ES') : ''}
                </Text>
              </View>
              <View style={styles.detalleBadge}>
                <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
                <Text style={styles.detalleBadgeText}>Enviado</Text>
              </View>
            </View>

            <View style={styles.detalleSubheader}>
              <Text style={styles.detalleSubtitle}>
                Productos enviados ({envioSeleccionado?.cantidadProductos || 0})
              </Text>
              <View style={styles.soloLecturaBadge}>
                <Ionicons name="lock-closed" size={12} color="#64748b" />
                <Text style={styles.soloLecturaText}>Solo lectura</Text>
              </View>
            </View>

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {envioSeleccionado?.productos && envioSeleccionado.productos.length > 0 ? (
                envioSeleccionado.productos.map((producto, index) => {
                  const total = (Number(producto.cantidad) || 0) * (Number(producto.costo) || 0)
                  return (
                    <View key={producto.temporalId || index} style={styles.detalleProductoItem}>
                      <View style={styles.detalleProductoInfo}>
                        <Text style={styles.detalleProductoNombre}>{producto.nombre}</Text>
                        <Text style={styles.detalleProductoSku}>
                          {producto.sku ? `SKU: ${producto.sku}` : ''}
                          {producto.codigoBarras ? ` · CB: ${producto.codigoBarras}` : ''}
                        </Text>
                      </View>
                      <View style={styles.detalleProductoStats}>
                        <Text style={styles.detalleProductoCantidad}>
                          Cant: {producto.cantidad}
                        </Text>
                        <Text style={styles.detalleProductoCosto}>
                          ${(Number(producto.costo) || 0).toFixed(2)}
                        </Text>
                        <Text style={styles.detalleProductoTotal}>
                          Total: ${total.toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  )
                })
              ) : (
                <View style={{ padding: 30, alignItems: 'center' }}>
                  <Ionicons name="cube-outline" size={40} color="#cbd5e1" />
                  <Text style={{ color: '#94a3b8', marginTop: 8 }}>
                    No hay detalles de productos disponibles
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Resumen del envío */}
            {envioSeleccionado?.productos && envioSeleccionado.productos.length > 0 && (
              <View style={styles.detalleResumen}>
                <View style={styles.detalleResumenRow}>
                  <Text style={styles.detalleResumenLabel}>Total productos:</Text>
                  <Text style={styles.detalleResumenValue}>{envioSeleccionado.cantidadProductos}</Text>
                </View>
                <View style={styles.detalleResumenRow}>
                  <Text style={styles.detalleResumenLabel}>Valor total:</Text>
                  <Text style={styles.detalleResumenTotal}>
                    ${envioSeleccionado.productos.reduce((sum, p) => 
                      sum + (Number(p.cantidad) || 0) * (Number(p.costo) || 0), 0
                    ).toFixed(2)}
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton, { marginTop: 12 }]}
              onPress={() => {
                setModalAgendaDetalle(false)
                setEnvioSeleccionado(null)
              }}
            >
              <Text style={styles.cancelButtonText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 18,
    paddingHorizontal: 16,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerCenter: {
    flex: 1,
    marginLeft: 12,
  },
  clienteInput: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.3)',
    paddingBottom: 2,
    width: '100%',
    zIndex: 10,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  sesionLabel: {
    color: '#bfdbfe',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  sesionNumero: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  sesionSubtitulo: {
    color: '#e0f2fe',
    fontSize: 12,
  },
  estadoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15,23,42,0.35)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 6,
  },
  estadoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  estadoText: {
    color: '#e5e7eb',
    fontSize: 12,
    fontWeight: '600',
  },
  syncPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34,197,94,0.85)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
  },
  syncPillText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 12,
  },
  actionsRow2: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 10,
    marginHorizontal: 4,
    gap: 6,
  },
  actionButton2: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 10,
    gap: 6,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 12,
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  content: {
    flex: 1,
    marginTop: 8,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyState: {
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
    textAlign: 'center',
  },
  productoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    position: 'relative',
    overflow: 'hidden',
  },
  estadoBorde: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  estadoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  estadoBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  productoInfo: {
    flex: 1,
    paddingRight: 8,
    paddingLeft: 8,
  },
  productoNombre: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 2,
  },
  productoSku: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 6,
  },
  productoStats: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4,
  },
  productoCantidad: {
    fontSize: 12,
    color: '#0f766e',
    fontWeight: '600',
  },
  productoCosto: {
    fontSize: 12,
    color: '#4b5563',
  },
  productoTotal: {
    fontSize: 12,
    color: '#7c2d12',
    fontWeight: '700',
  },
  productoTimestamp: {
    fontSize: 11,
    color: '#9ca3af',
  },
  productoActions: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  iconButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    gap: 4,
  },
  offlineBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#b45309',
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  scannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    padding: 16,
  },
  scannerClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 430,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  scannerInSearch: {
    padding: 8,
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 10,
  },
  buscarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    paddingVertical: 10,
    gap: 6,
  },
  buscarButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  resultItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  resultNombre: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  resultSku: {
    fontSize: 12,
    color: '#6b7280',
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 10,
  },
  modalButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#e5e7eb',
  },
  cancelButtonText: {
    color: '#4b5563',
    fontSize: 15,
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#3b82f6',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  // Estilos para modal de sincronización
  syncOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  syncOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginLeft: 12,
    flex: 1,
  },
  // Estilos para historial mejorado
  historialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  historialDiaContainer: {
    marginBottom: 16,
  },
  historialDiaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 8,
    gap: 8,
  },
  historialDiaFecha: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    flex: 1,
    textTransform: 'capitalize',
  },
  historialDiaBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  historialDiaBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1d4ed8',
  },
  historialEnvioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    marginLeft: 8,
  },
  historialEnvioInfo: {
    flex: 1,
  },
  historialClienteNombre: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  historialEnvioHora: {
    fontSize: 12,
    color: '#64748b',
  },
  historialEnvioStats: {
    alignItems: 'center',
    marginRight: 8,
  },
  historialCantidad: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  historialCantidadLabel: {
    fontSize: 10,
    color: '#64748b',
  },
  // Estilos para detalle de envío
  detalleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    marginBottom: 12,
  },
  detalleClienteNombre: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  detalleFecha: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  detalleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  detalleBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16a34a',
  },
  detalleSubheader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detalleSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  soloLecturaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  soloLecturaText: {
    fontSize: 11,
    color: '#64748b',
  },
  detalleProductoItem: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  detalleProductoInfo: {
    marginBottom: 8,
  },
  detalleProductoNombre: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  detalleProductoSku: {
    fontSize: 11,
    color: '#64748b',
  },
  detalleProductoStats: {
    flexDirection: 'row',
    gap: 16,
  },
  detalleProductoCantidad: {
    fontSize: 12,
    color: '#0f766e',
    fontWeight: '600',
  },
  detalleProductoCosto: {
    fontSize: 12,
    color: '#475569',
  },
  detalleProductoTotal: {
    fontSize: 12,
    color: '#7c2d12',
    fontWeight: '700',
  },
  detalleResumen: {
    backgroundColor: '#f0f9ff',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  detalleResumenRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  detalleResumenLabel: {
    fontSize: 13,
    color: '#475569',
  },
  detalleResumenValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
  },
  detalleResumenTotal: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0369a1',
  },
  // Estilos para modal de confirmación de envío
  confirmEnvioModal: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    width: '90%',
    maxWidth: 380,
    alignItems: 'center',
  },
  confirmEnvioHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmEnvioIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  confirmEnvioTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  confirmEnvioMessage: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 20,
  },
  confirmEnvioStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    width: '100%',
  },
  confirmEnvioStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  confirmEnvioStatNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e293b',
    marginTop: 4,
  },
  confirmEnvioStatLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  confirmEnvioStatDivider: {
    width: 1,
    height: 50,
    backgroundColor: '#e2e8f0',
  },
  confirmEnvioButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmEnvioCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  confirmEnvioCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748b',
  },
  confirmEnvioSendButton: {
    flex: 1.5,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmEnvioSendText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  // Estilos para modal de animación de envío
  animacionEnvioOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  animacionEnvioContainer: {
    alignItems: 'center',
    padding: 40,
  },
  animacionPaquete: {
    marginBottom: 20,
  },
  animacionNube: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  animacionCheckmark: {
    position: 'absolute',
  },
  animacionTexto: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 24,
  },
  animacionSubtexto: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 8,
  },
  // Estilos para botón de flash en escáner
  flashToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1.5,
    borderColor: '#94a3b8',
    borderRadius: 25,
    paddingVertical: 10,
    paddingHorizontal: 22,
    marginTop: 20,
    gap: 8,
  },
  flashToggleBtnActive: {
    backgroundColor: 'rgba(251,191,36,0.15)',
    borderColor: '#fbbf24',
  },
  flashToggleText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
})

export default SesionColaboradorScreen
