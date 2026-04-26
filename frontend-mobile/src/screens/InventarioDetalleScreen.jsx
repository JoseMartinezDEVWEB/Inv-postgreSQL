import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  FlatList,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  Vibration,
  Image,
  KeyboardAvoidingView,
  Platform,
  Switch, // Import Switch
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { CameraView, Camera } from 'expo-camera'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import api, { sesionesApi, productosApi, invitacionesApi, solicitudesConexionApi, handleApiError } from '../services/api'
import { showMessage } from 'react-native-flash-message'
import { LinearGradient } from 'expo-linear-gradient'
import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import NetInfo from '@react-native-community/netinfo' // Ensure NetInfo is imported
import { getInternetCredentials } from '../services/secureStorage'
import SplashScreen from '../components/SplashScreen'
import { useLoader } from '../context/LoaderContext'
import { useAuth } from '../context/AuthContext'
import localDb from '../services/localDb'
import syncService from '../services/syncService'
import { config } from '../config/env'
import webSocketService from '../services/websocket'

// Importar modales
import DistribucionModal from '../components/modals/DistribucionModal'
import ContadorModal from '../components/modals/ContadorModal'
import ConfigurationModal from '../components/modals/ConfigurationModal'
import ExportModal from '../components/modals/ExportModal'
import ReportPreviewModal from '../components/modals/ReportPreviewModal'
import InventoryReportModal from '../components/modals/InventoryReportModal'
import FinancialModal from '../components/modals/FinancialModal'
import ProductSearchModal from '../components/modals/ProductSearchModal'
import ZeroCostProductsModal from '../components/modals/ZeroCostProductsModal'
import ProductosGeneralesModal from '../components/modals/ProductosGeneralesModal'
import BarcodeProductModal from '../components/modals/BarcodeProductModal'

const { width, height } = Dimensions.get('window')

// Componente de ítem de producto memoizado para optimizar scroll
const ProductItem = memo(({ item, onPress, onDelete }) => (
  <TouchableOpacity
    style={styles.productoItem}
    onPress={() => onPress(item)}
  >
    <View style={styles.productoInfo}>
      <Text style={styles.productoNombre}>{item.nombreProducto || item.producto?.nombre}</Text>
      <Text style={styles.productoSku}>SKU: {item.skuProducto || item.producto?.sku || 'Sin SKU'}</Text>
      <View style={styles.productoStats}>
        <Text style={styles.productoCantidad}>Cant: {item.cantidadContada}</Text>
        <Text style={styles.productoCosto}>${item.costoProducto?.toLocaleString()}</Text>
        <Text style={styles.productoTotal}>
          Total: ${(item.valorTotal || (item.cantidadContada * item.costoProducto)).toLocaleString()}
        </Text>
      </View>
    </View>
    <TouchableOpacity
      style={styles.deleteButton}
      onPress={() => onDelete(item)}
    >
      <Ionicons name="trash" size={20} color="#ef4444" />
    </TouchableOpacity>
  </TouchableOpacity>
));

const InventarioDetalleScreen = ({ route, navigation }) => {
  const { sesionId } = route.params || {}
  const queryClient = useQueryClient()
  const { showAnimation, hideLoader, showLoader } = useLoader()
  const { state: authState } = useAuth()

  // Validar sesionId - Nota: Este return temprano está antes de otros hooks
  // pero después de los hooks esenciales que siempre se necesitan
  if (!sesionId) {
    return (
      <View style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Ionicons name="alert-circle" size={64} color="#ef4444" />
          <Text style={{ fontSize: 20, fontWeight: 'bold', marginTop: 20, marginBottom: 10, color: '#1e293b' }}>
            Sesión no válida
          </Text>
          <Text style={{ fontSize: 16, textAlign: 'center', color: '#64748b', marginBottom: 20 }}>
            No se encontró el ID de la sesión. Por favor, vuelve a la lista de sesiones.
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: '#3b82f6', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
            onPress={() => navigation.goBack()}
          >
            <Text style={{ color: '#ffffff', fontWeight: 'bold' }}>Volver</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  // Estados de conectividad y sincronización
  const [isConnected, setIsConnected] = useState(true)
  const [autoSend, setAutoSend] = useState(true) // Switch Envío Automático
  const [pendingSyncs, setPendingSyncs] = useState(0)
  const [localProducts, setLocalProducts] = useState([]) // Productos guardados localmente
  const [isSyncing, setIsSyncing] = useState(false)

  // Estados principales
  const [selectedProducto, setSelectedProducto] = useState(null)
  const [cantidad, setCantidad] = useState('')
  const [costo, setCosto] = useState('')

  // Estados de modales
  const [showScanner, setShowScanner] = useState(false)
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [showAddProductModal, setShowAddProductModal] = useState(false)
  const [showBarcodeProductModal, setShowBarcodeProductModal] = useState(false)
  const [scannedProduct, setScannedProduct] = useState(null)
  const [scannedBarcode, setScannedBarcode] = useState(null)
  const [cantidadAnteriorProducto, setCantidadAnteriorProducto] = useState(null)
  const [searchedProduct, setSearchedProduct] = useState(null)
  const [showSearchedProductModal, setShowSearchedProductModal] = useState(false)
  const [activeFinancialModal, setActiveFinancialModal] = useState(null)
  const [showFinancialModal, setShowFinancialModal] = useState(false)
  const [showDistribucionModal, setShowDistribucionModal] = useState(false)
  const [showContadorModal, setShowContadorModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportInitialConfig, setExportInitialConfig] = useState(null)
  const [showReportPreviewModal, setShowReportPreviewModal] = useState(false)
  const [showInventoryReportModal, setShowInventoryReportModal] = useState(false)
  const [reportType, setReportType] = useState(null)
  const [showMenuModal, setShowMenuModal] = useState(false)
  const [showExitModal, setShowExitModal] = useState(false)
  const [showConfigurationModal, setShowConfigurationModal] = useState(false)

  // Estados de permisos y escáner
  const [hasPermission, setHasPermission] = useState(null)
  const [isQuickScanMode, setIsQuickScanMode] = useState(false)

  // Estados de temporizador  // Componente de Temporizador Memoizado para evitar re-renders innecesarios en Mobile
  const TimerDisplay = useMemo(() => {
    const TimerComponent = ({ sesionData, sesionId }) => {
      const [tiempo, setTiempo] = useState(0)
      const timerRef = useRef()

      useEffect(() => {
        if (!sesionData) return
        timerRef.current = sesionData

        const tick = () => {
          const s = timerRef.current
          if (!s) return

          const acumulado = Math.max(0, Number(s.timerAcumuladoSegundos || 0))
          const enMarcha = Boolean(s.timerEnMarcha)
          let ultimoInicio = 0

          if (s.timerUltimoInicio) {
            let fechaStr = s.timerUltimoInicio
            if (fechaStr.includes(' ')) fechaStr = fechaStr.replace(' ', 'T')
            if (!fechaStr.endsWith('Z')) fechaStr = fechaStr + 'Z'
            const fechaInicio = new Date(fechaStr)
            if (!isNaN(fechaInicio.getTime())) ultimoInicio = fechaInicio.getTime()
          }

          let segundos = acumulado
          if (enMarcha && ultimoInicio > 0) {
            const ahora = Date.now()
            const diferencia = Math.floor((ahora - ultimoInicio) / 1000)
            if (diferencia > 0) segundos += diferencia
          }
          setTiempo(Math.max(0, segundos))
        }

        tick()
        const interval = setInterval(tick, 1000)
        return () => clearInterval(interval)
      }, [sesionData?.timerEnMarcha, sesionData?.timerUltimoInicio, sesionData?.timerAcumuladoSegundos])

      const format = (s) => {
        const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
      }

      return (
        <TouchableOpacity
          onPress={async () => {
            try {
              if (sesionData?.timerEnMarcha) {
                await sesionesApi.pauseTimer(sesionId)
                showMessage({ message: '⏸ Cronómetro pausado', type: 'info' })
              } else {
                await sesionesApi.resumeTimer(sesionId)
                showMessage({ message: '▶️ Cronómetro iniciado', type: 'success' })
              }
              queryClient.invalidateQueries(['sesion', sesionId])
            } catch (err) {
              console.error('Error timer mobile:', err)
            }
          }}
          style={[styles.timerContainer, sesionData?.timerEnMarcha ? styles.timerContainerActive : null]}
        >
          <Ionicons 
            name={sesionData?.timerEnMarcha ? "pause" : "time"} 
            size={16} 
            color="#ffffff" 
          />
          <Text style={styles.timerText}>{format(tiempo)}</Text>
        </TouchableOpacity>
      )
    }
    return memo(TimerComponent)
  }, [sesionId])

  const [newProductData, setNewProductData] = useState({
    nombre: '',
    sku: '',
    codigoBarras: '',
    categoria: '',
    unidad: 'unidad',
    costo: '',
    descripcion: '',
    proveedor: ''
  })

  // Valores por defecto para datos financieros
  const defaultFinancialData = {
    ventasDelMes: 0,
    gastosGenerales: [], // Array de gastos
    cuentasPorCobrar: [], // Array de cuentas por cobrar
    cuentasPorPagar: [], // Array de cuentas por pagar
    efectivoEnCajaYBanco: [], // Array de efectivo
    deudaANegocio: [], // Array de deudas de socios al negocio
    activosFijos: 0
  }

  // Estados financieros
  const [datosFinancieros, setDatosFinancieros] = useState(defaultFinancialData)

  // Estados de distribución
  const [distribucionData, setDistribucionData] = useState({
    numeroSocios: 2,
    socios: [
      { nombre: '', porcentaje: 50, utilidadAcumulada: 0, utilidadPeriodo: 0, cuentaAdeudada: 0 },
      { nombre: '', porcentaje: 50, utilidadAcumulada: 0, utilidadPeriodo: 0, cuentaAdeudada: 0 }
    ],
    fechaDesde: '',
    fechaHasta: '',
    comentarios: ''
  })

  // Estados del contador
  const [contadorData, setContadorData] = useState({
    costoServicio: 0,
    fechaInventario: new Date().toISOString().split('T')[0],
    periodicidad: 'mensual',
    proximaFecha: '',
    notas: ''
  })

  // Estados para productos con costo cero
  const [showZeroCostProductsModal, setShowZeroCostProductsModal] = useState(false)
  const [zeroCostProductsEdits, setZeroCostProductsEdits] = useState({})
  const [isUpdatingZeroCosts, setIsUpdatingZeroCosts] = useState(false)

  // Estados para confirmación de eliminación
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  // Estados para nuevas funciones
  const [showDownloadOptions, setShowDownloadOptions] = useState(false)
  const [showConnectModal, setShowConnectModal] = useState(false)
  const [showFindEditModal, setShowFindEditModal] = useState(false)
  const [findTerm, setFindTerm] = useState('')
  const [editDraft, setEditDraft] = useState({})
  const [showProductosGeneralesModal, setShowProductosGeneralesModal] = useState(false)

  // Estados para colaboración
  const [qrInvitacionData, setQrInvitacionData] = useState(null)
  const [isGeneratingQR, setIsGeneratingQR] = useState(false)
  const [colaboradoresActivos, setColaboradoresActivos] = useState([])
  const [invitaciones, setInvitaciones] = useState([])
  const [productosColaboradorPendientes, setProductosColaboradorPendientes] = useState({})

  // Estado de error
  const [errorSesion, setErrorSesion] = useState(null)

  // Obtener datos de la sesión
  const { data: sesionData, isLoading: loadingSesion, isFetching, refetch, isError: errorLoadingSesion } = useQuery(
    ['sesion', sesionId],
    () => sesionesApi.getById(sesionId),
    {
      select: (data) => {
        const sesion = data.data.datos?.sesion || data.data.sesion || data.data;
        return sesion;
      },
      enabled: !!sesionId,
      refetchInterval: 5000, // Actualizar cada 5 segundos como en la web
      onError: (error) => {
        console.error('Error cargando sesión:', error);
        setErrorSesion(error);
      },
      onSuccess: () => {
        setErrorSesion(null);
      },
    }
  )

  // Escuchar actualizaciones remotas de inventario y refrescar automáticamente
  useEffect(() => {
    const handleRemoteUpdate = (data) => {
      if (data && String(data.sesionId) === String(sesionId)) {
        refetch()
      }
    }
    webSocketService.on('update_session_inventory', handleRemoteUpdate)
    return () => webSocketService.off('update_session_inventory', handleRemoteUpdate)
  }, [sesionId, refetch])

  const loadLocalProducts = useCallback(async () => {
    if (!sesionId) return
    try {
      const prods = await localDb.obtenerConteosSesion(sesionId)
      setLocalProducts(prods)
    } catch (e) {
      console.log('Error loading local products', e)
    }
  }, [sesionId])

  const checkPendingSyncs = useCallback(async () => {
    if (!sesionId) return
    try {
      const pendientes = await localDb.obtenerConteosPendientes(sesionId)
      setPendingSyncs(pendientes.length)

      // Recargar lista local para mantener UI actualizada
      loadLocalProducts()
    } catch (e) { }
  }, [sesionId, loadLocalProducts])

  const handleSyncNow = useCallback(async () => {
    if (isSyncing || !sesionId) return
    if (!isConnected) {
      showMessage({ message: 'Sin conexión a internet', type: 'warning' })
      return
    }

    setIsSyncing(true)
    try {
      // 1. Procesar cola general
      await syncService.procesarColaPendiente()

      // 2. Procesar tabla específica de conteos (backup)
      const count = await syncService.sincronizarDesdeTabla(sesionId)

      if (count > 0) {
        showMessage({ message: `Sincronizados ${count} conteos`, type: 'success' })
      }

      // Recargar datos
      queryClient.invalidateQueries(['sesion', sesionId])
      loadLocalProducts()
      checkPendingSyncs()
    } catch (error) {
      console.log('Error syncing', error)
    } finally {
      setIsSyncing(false)
    }
  }, [isSyncing, sesionId, isConnected, queryClient, loadLocalProducts, checkPendingSyncs])

  // Efecto para monitorear conexión y cargar datos locales
  useEffect(() => {
    if (!sesionId) return

    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(!!state.isConnected)

      // Si recuperamos conexión y AutoSend está ON, sincronizar
      if (state.isConnected && autoSend) {
        handleSyncNow()
      }
    })

    // Cargar productos locales iniciales
    loadLocalProducts()

    // Intervalo para actualizar conteo de pendientes
    const interval = setInterval(() => {
      checkPendingSyncs()
    }, 5000)

    return () => {
      unsubscribe()
      clearInterval(interval)
    }
  }, [sesionId, autoSend, handleSyncNow, loadLocalProducts, checkPendingSyncs])

  // Cargar datos de colaboradores e invitaciones
  useEffect(() => {
    if (!sesionId) return

    // Solo cargar si el token NO es local (las APIs remotas requieren token real)
    const token = authState?.token || ''
    const isLocalToken = token.startsWith('local-token-')

    if (isLocalToken) {
      console.log('⚠️ Token local detectado - omitiendo carga de colaboradores/invitaciones')
      return
    }

    // Carga inicial
    cargarColaboradoresConectados()
    cargarInvitaciones()

    const interval = setInterval(() => {
      cargarColaboradoresConectados()
      cargarInvitaciones()
    }, 30000) // Cada 30 segundos

    return () => clearInterval(interval)
  }, [sesionId, authState?.token])

  const cargarInvitaciones = async () => {
    try {
      const response = await invitacionesApi.listMine()
      setInvitaciones(response.data?.datos || [])
    } catch (error) {
      console.log('Error cargando invitaciones', error)
    }
  }

  const cargarColaboradoresConectados = async () => {
    try {
      const response = await solicitudesConexionApi.listarConectados(sesionId)
      const colaboradores = response.data?.datos || []
      setColaboradoresActivos(colaboradores)

      const productosPorColaborador = {}
      for (const colab of colaboradores) {
        try {
          const colabId = colab.id || colab._id
          const prodResponse = await solicitudesConexionApi.obtenerProductosOffline(colabId)
          const productosOffline = prodResponse.data?.datos || []
          if (productosOffline.length > 0) {
            // Transformar productos del backend a estructura esperada
            const productosTransformados = productosOffline
              .filter(p => !p.sincronizado) // Solo productos no sincronizados
              .map(p => ({
                temporalId: p.id, // Usar el ID del backend como temporalId
                productoData: {
                  nombre: p.nombre || 'Sin nombre',
                  cantidad: p.cantidad || 1, // Default a 1 si no hay cantidad
                  costo: Number(p.costo || 0),
                  unidad: p.unidad || 'unidad',
                  categoria: p.categoria || 'General',
                  sku: p.sku || '',
                  codigoBarras: p.codigoBarras || ''
                }
              }))
            if (productosTransformados.length > 0) {
              productosPorColaborador[colabId] = productosTransformados
            }
          }
        } catch (e) {
          console.log('Error productos colab', e)
        }
      }
      setProductosColaboradorPendientes(productosPorColaborador)
    } catch (error) {
      console.log('Error cargando conectados', error)
    }
  }

  const handleSincronizarColaborador = async (colaboradorId) => {
    try {
      showLoader()
      const productos = productosColaboradorPendientes[colaboradorId] || []
      if (productos.length === 0) return

      // Iniciar reloj si es el primer producto
      const productosContados = sesionData?.productosContados || []
      if (productosContados.length === 0 && !sesionData?.timerEnMarcha) {
        try {
          await sesionesApi.resumeTimer(sesionId)
          console.log('✅ Reloj iniciado en sincronización de colaborador')
        } catch (error) {
          console.error('Error al iniciar reloj:', error)
        }
      }

      // Procesar en lotes de 20
      const BATCH_SIZE = 20
      const batches = []
      for (let i = 0; i < productos.length; i += BATCH_SIZE) {
        batches.push(productos.slice(i, i + BATCH_SIZE))
      }

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i]
        showMessage({
          message: `Sincronizando lote ${i + 1}/${batches.length}...`,
          type: 'info'
        })

        // Procesar cada producto del lote
        for (const pOffline of batch) {
          const pData = pOffline.productoData

          // Buscar si existe en sesión (usar datos de sesión disponibles)
          const productosExistentes = sesionData?.productosContados || []
          const existente = productosExistentes.find(p =>
            p.nombreProducto?.toLowerCase().trim() === pData.nombre?.toLowerCase().trim()
          )

          if (existente) {
            await sesionesApi.updateProduct(sesionId, existente.productoId, {
              cantidadContada: (existente.cantidadContada || 0) + Number(pData.cantidad || 1),
              costoProducto: Number(pData.costo) || 0
            })
          } else {
            // Buscar o crear el producto en ProductoCliente
            let productoClienteId
            const clienteId = sesionData?.clienteNegocio?._id

            if (!clienteId) {
              console.error('No se pudo obtener el ID del cliente')
              continue
            }

            try {
              // Buscar primero en productos del cliente
              const busqueda = await productosApi.getByCliente(clienteId, {
                buscar: pData.nombre,
                limite: 1
              })
              const encontrado = busqueda.data?.datos?.productos?.[0]
              if (encontrado && encontrado._id) {
                productoClienteId = encontrado._id
              }
            } catch (error) {
              console.log('Error buscando producto en cliente:', error)
            }

            // Si no se encontró, crear uno nuevo
            if (!productoClienteId) {
              try {
                const nuevoProducto = await productosApi.createForCliente(clienteId, {
                  nombre: pData.nombre,
                  costo: Number(pData.costo) || 0,
                  unidad: pData.unidad || 'unidad',
                  sku: pData.sku || '',
                  categoria: pData.categoria || 'General'
                })
                productoClienteId = nuevoProducto.data?.datos?.producto?._id || nuevoProducto.data?.datos?._id
              } catch (error) {
                console.error('Error creando producto:', error)
                showMessage({
                  message: `Error al crear producto ${pData.nombre}`,
                  type: 'danger'
                })
                continue
              }
            }

            // Agregar a la sesión
            if (productoClienteId) {
              try {
                await sesionesApi.addProduct(sesionId, {
                  productoClienteId: productoClienteId,
                  cantidadContada: Number(pData.cantidad || 1),
                  costoProducto: Number(pData.costo) || 0
                })
              } catch (error) {
                console.error('Error agregando producto a sesión:', error)
                showMessage({
                  message: `Error al agregar producto ${pData.nombre}`,
                  type: 'danger'
                })
              }
            } else {
              console.error('No se pudo obtener el ID del producto cliente')
              showMessage({
                message: `No se pudo procesar el producto ${pData.nombre}`,
                type: 'danger'
              })
            }
          }
        }

        // Marcar sincronizados
        const temporalIds = batch.map(p => p.temporalId)
        await solicitudesConexionApi.sincronizar(colaboradorId, temporalIds)
      }

      showMessage({ message: 'Sincronización completada', type: 'success' })
      cargarColaboradoresConectados()
      queryClient.invalidateQueries(['sesion', sesionId])
    } catch (error) {
      handleApiError(error)
    } finally {
      hideLoader()
    }
  }

  // Mutación para eliminar producto
  const deleteProductMutation = useMutation(
    (productId) => sesionesApi.removeProduct(sesionId, productId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['sesion', sesionId])
        showMessage({
          message: 'Producto eliminado exitosamente',
          type: 'success',
        })
      },
      onError: handleApiError,
    }
  )

  // Mutación para actualizar datos financieros
  const updateFinancialMutation = useMutation(
    (financialData) => sesionesApi.updateFinancial(sesionId, financialData),
    {
      onSuccess: (response, variables) => {
        // Actualizar el estado local inmediatamente
        setDatosFinancieros(variables)
        queryClient.invalidateQueries(['sesion', sesionId])
        showMessage({
          message: 'Datos financieros actualizados',
          type: 'success',
        })
      },
      onError: handleApiError,
    }
  )

  // Mutación para agregar producto
  const addProductMutation = useMutation(
    async (productData) => {
      const productosContados = sesionData?.productosContados || []
      const esElPrimerProducto = productosContados.length === 0 && !sesionData?.timerEnMarcha
      
      console.log('🔍 Verificando primer producto:', {
        productosContadosLength: productosContados.length,
        timerEnMarcha: sesionData?.timerEnMarcha,
        esElPrimerProducto
      })

      const resultado = await sesionesApi.addProduct(sesionId, productData)

      if (esElPrimerProducto) {
        try {
          console.log('⏱️ Iniciando timer...')
          const timerResponse = await sesionesApi.resumeTimer(sesionId)
          console.log('✅ Respuesta resumeTimer:', timerResponse?.data)
          console.log('✅ Reloj iniciado con el primer producto')
        } catch (error) {
          console.error('Error al iniciar reloj:', error)
        }
      }

      return resultado
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['sesion', sesionId]);
        showMessage({ message: 'Producto agregado exitosamente', type: 'success' });
        resetForm();
      },
      onError: handleApiError,
    }
  );

  // Completar sesión (guardar y salir)
  const completeSessionMutation = useMutation(
    () => sesionesApi.complete(sesionId),
    {
      onSuccess: () => {
        showMessage({ message: 'Sesión guardada exitosamente', type: 'success' })
        navigation.goBack()
      },
      onError: handleApiError,
      onSettled: () => hideLoader()
    }
  )

  // Mutación para crear producto para cliente
  const createProductMutation = useMutation(
    (productData) => {
      const clienteId = sesionData?.clienteNegocio?._id;
      if (!clienteId) {
        throw new Error('No se encontró el ID del cliente');
      }
      return productosApi.createForClient(clienteId, productData);
    },
    {
      onSuccess: (data) => {
        const newProduct = data.data.datos?.producto || data.data.producto;
        // Agregar el producto recién creado al inventario
        addProductMutation.mutate({
          productoClienteId: newProduct._id,
          cantidadContada: 1,
          costoProducto: newProduct.costo || 0,
        });
        setShowAddProductModal(false);
        resetNewProductForm();
        showMessage({ message: 'Producto creado y agregado exitosamente', type: 'success' });
      },
      onError: handleApiError,
    }
  );

  // Solicitar permisos de cámara
  useEffect(() => {
    const getCameraPermissions = async () => {
      const { status } = await Camera.requestCameraPermissionsAsync()
      setHasPermission(status === 'granted')
    }
    getCameraPermissions()
  }, [])

  // Inicializar datos financieros cuando se cargan los datos de la sesión
  useEffect(() => {
    if (sesionData?.datosFinancieros) {
      setDatosFinancieros({
        ...defaultFinancialData,
        ...sesionData.datosFinancieros,
        // Asegurar que los arrays existan, priorizando campos de detalle si existen
        gastosGenerales: Array.isArray(sesionData.datosFinancieros.gastosGeneralesDetalle)
          ? sesionData.datosFinancieros.gastosGeneralesDetalle
          : Array.isArray(sesionData.datosFinancieros.gastosGenerales)
            ? sesionData.datosFinancieros.gastosGenerales
            : (sesionData.datosFinancieros.gastosGenerales ? [{ monto: sesionData.datosFinancieros.gastosGenerales, descripcion: 'Gastos generales', categoria: 'Otros' }] : []),
        cuentasPorCobrar: Array.isArray(sesionData.datosFinancieros.cuentasPorCobrarDetalle)
          ? sesionData.datosFinancieros.cuentasPorCobrarDetalle
          : Array.isArray(sesionData.datosFinancieros.cuentasPorCobrar)
            ? sesionData.datosFinancieros.cuentasPorCobrar
            : (sesionData.datosFinancieros.cuentasPorCobrar ? [{ monto: sesionData.datosFinancieros.cuentasPorCobrar, descripcion: 'Cuenta por cobrar', cliente: 'Cliente' }] : []),
        cuentasPorPagar: Array.isArray(sesionData.datosFinancieros.cuentasPorPagarDetalle)
          ? sesionData.datosFinancieros.cuentasPorPagarDetalle
          : Array.isArray(sesionData.datosFinancieros.cuentasPorPagar)
            ? sesionData.datosFinancieros.cuentasPorPagar
            : (sesionData.datosFinancieros.cuentasPorPagar ? [{ monto: sesionData.datosFinancieros.cuentasPorPagar, descripcion: 'Cuenta por pagar', proveedor: 'Proveedor' }] : []),
        efectivoEnCajaYBanco: Array.isArray(sesionData.datosFinancieros.efectivoEnCajaYBancoDetalle)
          ? sesionData.datosFinancieros.efectivoEnCajaYBancoDetalle
          : Array.isArray(sesionData.datosFinancieros.efectivoEnCajaYBanco)
            ? sesionData.datosFinancieros.efectivoEnCajaYBanco
            : (sesionData.datosFinancieros.efectivoEnCajaYBanco ? [{ monto: sesionData.datosFinancieros.efectivoEnCajaYBanco, descripcion: 'Efectivo en caja', tipoCuenta: 'Caja' }] : []),
        deudaANegocio: Array.isArray(sesionData.datosFinancieros.deudaANegocioDetalle)
          ? sesionData.datosFinancieros.deudaANegocioDetalle
          : Array.isArray(sesionData.datosFinancieros.deudaANegocio)
            ? sesionData.datosFinancieros.deudaANegocio
            : (sesionData.datosFinancieros.deudaANegocio ? [{ monto: sesionData.datosFinancieros.deudaANegocio, descripcion: 'Deuda de socio', deudor: 'Socio' }] : [])
      })
    }
  }, [sesionData])



  // Pausar cronómetro al desmontar
  useEffect(() => {
    return () => {
      try {
        if (sesionData?.timerEnMarcha) {
          sesionesApi.pauseTimer(sesionId).catch(() => { })
        }
      } catch (_) { }
    }
  }, [sesionId, sesionData?.timerEnMarcha])



  // Manejar escaneo de código de barras
  const handleBarCodeScanned = async ({ data }) => {
    setShowScanner(false);
    try {
      // Buscar producto por código de barras (offline-first)
      const response = await productosApi.getByBarcode(data);
      const productoGeneral = response?.data?.datos;

      if (productoGeneral) {
        // Si encontramos el producto, verificar si el cliente ya lo tiene
        const clienteId = sesionData?.clienteNegocio?._id;
        let productoParaAgregar = productoGeneral;

        if (clienteId) {
          try {
            const clientProductsResponse = await productosApi.getByClient(clienteId, { buscar: productoGeneral.nombre, limite: 1 });
            const clientProducts = clientProductsResponse?.data?.datos?.productos || [];

            if (clientProducts.length > 0) {
              // El cliente ya tiene este producto - usar el del cliente
              productoParaAgregar = clientProducts[0];
            } else {
              // El cliente no tiene este producto - usar el general
              // El producto general se puede agregar directamente
            }
          } catch (clientError) {
            // Si falla la búsqueda del cliente, usar el producto general
            console.log('Error buscando productos del cliente:', clientError);
          }
        }

        // Abrir modal para agregar cantidad y costo
        setScannedProduct(productoParaAgregar);
        setScannedBarcode(data);
        setShowBarcodeProductModal(true);
      } else {
        // No se encontró el producto, ofrecer crear uno nuevo
        Alert.alert(
          'Producto no encontrado',
          `No se encontró un producto con el código ${data}. ¿Deseas crear uno nuevo?`,
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Crear Producto', onPress: () => {
                setNewProductData(prev => ({ ...prev, codigoBarras: data }))
                setShowAddProductModal(true)
              }
            }
          ]
        )
      }
    } catch (error) {
      console.log('Error buscando producto:', error);
      Alert.alert(
        'Producto no encontrado',
        `No se encontró un producto con el código ${data}. ¿Deseas crear uno nuevo?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Crear Producto', onPress: () => {
              setNewProductData(prev => ({ ...prev, codigoBarras: data }))
              setShowAddProductModal(true)
            }
          }
        ]
      )
    }
  };

  // Función para buscar cantidad anterior del producto en inventarios anteriores
  const buscarCantidadAnterior = useCallback(async (productoId, nombreProducto) => {
    try {
      const clienteId = sesionData?.clienteNegocio?._id;
      if (!clienteId) return null;

      // Buscar sesiones anteriores completadas del mismo cliente
      const sesionesResponse = await sesionesApi.getByClient(clienteId, { estado: 'completada', limite: 10 });
      const sesionesData = sesionesResponse?.data?.datos;
      const sesiones = sesionesData?.sesiones || sesionesData || [];

      // Buscar el producto en las sesiones anteriores (excluyendo la sesión actual)
      for (const sesion of Array.isArray(sesiones) ? sesiones : []) {
        if (sesion._id === sesionId || sesion.id === sesionId) continue; // Saltar sesión actual

        const productosContados = sesion.productosContados || [];
        const productoEncontrado = productosContados.find(p =>
          (p.productoId === productoId || p.productoClienteId === productoId) ||
          (nombreProducto && p.nombreProducto?.toLowerCase() === nombreProducto.toLowerCase())
        );

        if (productoEncontrado && productoEncontrado.cantidadContada) {
          return productoEncontrado.cantidadContada;
        }
      }

      return null;
    } catch (error) {
      console.log('Error buscando cantidad anterior:', error);
      return null;
    }
  }, [sesionData, sesionId]);

  // Manejar confirmación desde el modal de código de barras
  const handleBarcodeProductConfirm = async ({ cantidad, costo }) => {
    if (!scannedProduct) return;

    setShowBarcodeProductModal(false);

    // Iniciar reloj si es el primer producto
    const productosContados = sesionData?.productosContados || []
    if (productosContados.length === 0 && !sesionData?.timerEnMarcha) {
      try {
        await sesionesApi.resumeTimer(sesionId)
        console.log('✅ Reloj iniciado al escanear producto')
      } catch (error) {
        console.error('Error al iniciar reloj:', error)
      }
    }

    try {
      const clienteId = sesionData?.clienteNegocio?._id;
      let productoId = scannedProduct._id || scannedProduct.id;

      // Si el producto es general y no está asignado al cliente, asignarlo primero
      if (clienteId && !scannedProduct.costo) {
        try {
          const clientProductsResponse = await productosApi.getByClient(clienteId, { buscar: scannedProduct.nombre, limite: 1 });
          const clientProducts = clientProductsResponse?.data?.datos?.productos || [];

          if (clientProducts.length === 0) {
            // El cliente no tiene este producto, crearlo
            const nuevoProducto = await productosApi.createForClient(clienteId, {
              nombre: scannedProduct.nombre,
              costo: costo,
              unidad: scannedProduct.unidad || 'unidad',
              sku: scannedProduct.sku || scannedBarcode,
              codigoBarras: scannedBarcode,
              descripcion: scannedProduct.descripcion || '',
              categoria: scannedProduct.categoria || ''
            });
            productoId = nuevoProducto?.data?.datos?.producto?._id || nuevoProducto?.data?.producto?._id;
          } else {
            productoId = clientProducts[0]._id;
          }
        } catch (error) {
          console.log('Error creando producto para cliente:', error);
          // Continuar con el producto general si falla
        }
      }

      // Agregar producto a la sesión
      const productPayload = {
        producto: productoId,
        cantidadContada: cantidad,
        costoProducto: costo,
      };

      // Guardar en local primero (UI instantánea)
      const localId = await localDb.guardarConteoLocal({
        sesionId,
        productoId: productPayload.producto,
        nombreProducto: scannedProduct.nombre,
        skuProducto: scannedProduct.sku || scannedBarcode || '',
        cantidad: cantidad,
        costo: costo
      });

      showMessage({ message: 'Producto agregado', type: 'success' });
      loadLocalProducts(); // Actualizar UI local

      // Intentar enviar al servidor si está conectado y AutoSend está ON
      if (autoSend && isConnected) {
        try {
          await sesionesApi.addProduct(sesionId, productPayload);
          await localDb.marcarConteoSincronizado(localId);
          queryClient.invalidateQueries(['sesion', sesionId]);
        } catch (error) {
          console.log('Fallo envío inmediato, encolando...', error);
          // El producto ya está en local, se sincronizará después
        }
      }
    } catch (error) {
      handleApiError(error);
    } finally {
      setScannedProduct(null);
      setScannedBarcode(null);
    }
  };


  // Manejar confirmación desde el modal de producto buscado
  const handleSearchedProductConfirm = async ({ cantidad, costo }) => {
    if (!searchedProduct) return;

    setShowSearchedProductModal(false);

    // Iniciar reloj si es el primer producto
    const productosContados = sesionData?.productosContados || []
    if (productosContados.length === 0 && !sesionData?.timerEnMarcha) {
      try {
        await sesionesApi.resumeTimer(sesionId)
        console.log('✅ Reloj iniciado al buscar producto')
      } catch (error) {
        console.error('Error al iniciar reloj:', error)
      }
    }

    try {
      const clienteId = sesionData?.clienteNegocio?._id;
      let productoId = searchedProduct._id || searchedProduct.id;

      // Si el producto es general y no está asignado al cliente, asignarlo primero
      if (clienteId && !searchedProduct.isClientProduct && !searchedProduct.costo) {
        try {
          const clientProductsResponse = await productosApi.getByClient(clienteId, { buscar: searchedProduct.nombre, limite: 1 });
          const clientProducts = clientProductsResponse?.data?.datos?.productos || [];

          if (clientProducts.length === 0) {
            // El cliente no tiene este producto, crearlo
            const nuevoProducto = await productosApi.createForClient(clienteId, {
              nombre: searchedProduct.nombre,
              costo: costo,
              unidad: searchedProduct.unidad || 'unidad',
              sku: searchedProduct.sku || '',
              codigoBarras: searchedProduct.codigoBarras || '',
              descripcion: searchedProduct.descripcion || '',
              categoria: searchedProduct.categoria || 'General'
            });
            productoId = nuevoProducto?.data?.datos?.producto?._id || nuevoProducto?.data?.producto?._id;
          } else {
            productoId = clientProducts[0]._id;
          }
        } catch (error) {
          console.log('Error creando producto para cliente:', error);
          // Continuar con el producto general si falla
        }
      } else if (searchedProduct.isClientProduct) {
        // Ya es un producto del cliente, usar directamente
        productoId = searchedProduct._id || searchedProduct.id;
      }

      // Agregar producto a la sesión
      const productPayload = {
        producto: productoId,
        cantidadContada: cantidad,
        costoProducto: costo,
      };

      // Guardar en local primero (UI instantánea)
      const localId = await localDb.guardarConteoLocal({
        sesionId,
        productoId: productPayload.producto,
        nombreProducto: searchedProduct.nombre,
        skuProducto: searchedProduct.sku || '',
        cantidad: cantidad,
        costo: costo
      });

      showMessage({ message: 'Producto agregado', type: 'success' });
      loadLocalProducts(); // Actualizar UI local

      // Intentar enviar al servidor si está conectado y AutoSend está ON
      if (autoSend && isConnected) {
        try {
          await sesionesApi.addProduct(sesionId, productPayload);
          await localDb.marcarConteoSincronizado(localId);
          queryClient.invalidateQueries(['sesion', sesionId]);
        } catch (error) {
          console.log('Fallo envío inmediato, encolando...', error);
          // El producto ya está en local, se sincronizará después
        }
      }
    } catch (error) {
      handleApiError(error);
    } finally {
      setSearchedProduct(null);
    }
  };

  // Resetear formulario
  const resetForm = () => {
    setSelectedProducto(null);
    setCantidad('');
    setCosto('');
  };

  // Resetear formulario de nuevo producto
  const resetNewProductForm = () => {
    setNewProductData({
      nombre: '',
      sku: '',
      codigoBarras: '',
      categoria: '',
      unidad: 'unidad',
      costo: '',
      descripcion: '',
      proveedor: ''
    })
  }

  // Agregar producto seleccionado (Lógica Offline-First)
  const handleAddProduct = async () => {
    if (!selectedProducto || !cantidad || parseFloat(cantidad) <= 0) {
      showMessage({ message: 'Selecciona un producto e ingresa una cantidad válida.', type: 'warning' });
      return;
    }

    // Iniciar reloj si es el primer producto
    const productosContados = sesionData?.productosContados || []
    if (productosContados.length === 0 && !sesionData?.timerEnMarcha) {
      try {
        await sesionesApi.resumeTimer(sesionId)
        console.log('✅ Reloj iniciado al agregar producto')
      } catch (error) {
        console.error('Error al iniciar reloj:', error)
      }
    }

    const cantidadNum = parseFloat(cantidad)
    const costoNum = parseFloat(costo) || selectedProducto.costoBase || selectedProducto.costo || 0

    const productPayload = {
      producto: selectedProducto._id || selectedProducto.id,
      cantidadContada: cantidadNum,
      costoProducto: costoNum,
    }

    // 1. Guardar siempre en local primero (UI instantánea + seguridad)
    try {
      const localId = await localDb.guardarConteoLocal({
        sesionId,
        productoId: productPayload.producto,
        nombreProducto: selectedProducto.nombre,
        skuProducto: selectedProducto.sku || '',
        cantidad: cantidadNum,
        costo: costoNum
      })

      showMessage({ message: 'Producto registrado', type: 'success' }); // Mensaje optimista
      resetForm();
      loadLocalProducts(); // Actualizar UI local

      // 2. Decidir si enviar o encolar
      if (autoSend && isConnected) {
        // Intentar envío inmediato
        try {
          // Usar mutation existente o llamar api directo
          // Preferimos llamar api directo para manejar el error nosotros y encolar
          await sesionesApi.addProduct(sesionId, productPayload)
          await localDb.marcarConteoSincronizado(localId)
          queryClient.invalidateQueries(['sesion', sesionId])
        } catch (error) {
          console.log('Fallo envío inmediato, encolando...', error)
          // Fallo red o server -> Encolar
          await syncService.agregarTarea('agregar_producto_sesion', {
            sesionId,
            producto: productPayload,
            localId
          })
        }
      } else {
        // Guardar para envío posterior (Outbox)
        // Ya está en tabla productos_contados con sincronizado=0
        // También agregamos a cola para consistencia con syncService
        await syncService.agregarTarea('agregar_producto_sesion', {
          sesionId,
          producto: productPayload,
          localId
        })
      }

      checkPendingSyncs()

    } catch (error) {
      console.error('Error en flujo agregar producto', error)
      showMessage({ message: 'Error guardando producto localmente', type: 'danger' })
    }
  };

  // Crear nuevo producto
  const handleCreateProduct = () => {
    if (!newProductData.nombre || !newProductData.costo) {
      Alert.alert('Error', 'Completa al menos el nombre y el costo del producto')
      return
    }
    showAnimation('product', 4000)
    createProductMutation.mutate({
      ...newProductData,
      costo: parseFloat(newProductData.costo),
    })
  }

  // Confirmación de eliminación
  const openDeleteConfirm = (item) => {
    setDeleteTarget(item)
    setShowDeleteConfirm(true)
  }
  const confirmDelete = () => {
    // Priorizar ID de fila (rowId) para compatibilidad backend
    const rowId = deleteTarget?.id
    const productId = typeof deleteTarget?.producto === 'object' ? deleteTarget.producto?._id : deleteTarget?.producto

    if (rowId) {
      deleteProductMutation.mutate(rowId)
    } else if (productId) {
      deleteProductMutation.mutate(productId)
    }
    setShowDeleteConfirm(false)
    setDeleteTarget(null)
  }

  // Transformar datos financieros para compatibilidad con backend
  const transformFinancialDataForBackend = (data) => {
    const transformed = { ...data }

    // Convertir arrays a totales para campos que el backend espera como números
    if (Array.isArray(data.gastosGenerales)) {
      transformed.gastosGenerales = data.gastosGenerales.reduce((sum, item) => sum + (parseFloat(item.monto) || 0), 0)
      // Mantener el array en un campo separado para el frontend
      transformed.gastosGeneralesDetalle = data.gastosGenerales
    }

    if (Array.isArray(data.cuentasPorCobrar)) {
      transformed.cuentasPorCobrar = data.cuentasPorCobrar.reduce((sum, item) => sum + (parseFloat(item.monto) || 0), 0)
      transformed.cuentasPorCobrarDetalle = data.cuentasPorCobrar
    }

    if (Array.isArray(data.cuentasPorPagar)) {
      transformed.cuentasPorPagar = data.cuentasPorPagar.reduce((sum, item) => sum + (parseFloat(item.monto) || 0), 0)
      transformed.cuentasPorPagarDetalle = data.cuentasPorPagar
    }

    if (Array.isArray(data.efectivoEnCajaYBanco)) {
      transformed.efectivoEnCajaYBanco = data.efectivoEnCajaYBanco.reduce((sum, item) => sum + (parseFloat(item.monto) || 0), 0)
      transformed.efectivoEnCajaYBancoDetalle = data.efectivoEnCajaYBanco
    }

    if (Array.isArray(data.deudaANegocio)) {
      transformed.deudaANegocio = data.deudaANegocio.reduce((sum, item) => sum + (parseFloat(item.monto) || 0), 0)
      transformed.deudaANegocioDetalle = data.deudaANegocio
    }

    return transformed
  }

  // Manejar guardado de datos financieros
  const handleSaveFinancial = (financialData) => {
    showAnimation('financial', 4000)
    const transformedData = transformFinancialDataForBackend(financialData)
    updateFinancialMutation.mutate(transformedData)
  }

  // Manejar exportación
  const handleExport = async (exportData) => {
    showAnimation('export', 60000)
    try {
      showMessage({
        message: `Exportando ${exportData.fileName || exportData.nombreArchivo}...`,
        type: 'info',
      })
      // Simular proceso de exportación real
      await new Promise(resolve => setTimeout(resolve, 2000))
    } finally {
      hideLoader()
    }
  }

  // Manejar vista previa
  const handlePreview = (reportInfo) => {
    showMessage({
      message: `Abriendo vista previa de ${reportInfo.fileName}...`,
      type: 'info',
    })
  }

  // Buscar productos por nombre
  const handleSearchProducts = (searchTerm) => {
    setNombreBusqueda(searchTerm)
    if (searchTerm.length > 2) {
      setShowSearchModal(true)
    }
  }

  // Renderizar producto en lista - Usando useCallback y componente memoizado
  const handleItemPress = useCallback((item) => {
    setSelectedProducto(item.producto)
    setCantidad(item.cantidadContada.toString())
    setCosto(item.costoProducto.toString())
  }, []);

  const handleItemDelete = useCallback((item) => {
    openDeleteConfirm(item);
  }, []);

  const renderProductoItem = useCallback(({ item }) => (
    <ProductItem 
      item={item} 
      onPress={handleItemPress} 
      onDelete={handleItemDelete} 
    />
  ), [handleItemPress, handleItemDelete]);

  // Eliminado return condicional de carga para no romper el orden de hooks.

  // Procesar productos - Mezclar datos del backend con locales
  // Priorizar la visualización local si es más reciente

  // Convertir locales a formato compatible
  const localFormatted = localProducts.map(p => ({
    _id: p._id || p.id.toString(),
    productoId: p.productoId,
    nombreProducto: p.nombreProducto,
    skuProducto: p.skuProducto,
    cantidadContada: p.cantidad,
    costoProducto: p.costo,
    valorTotal: p.cantidad * p.costo,
    local: true,
    sincronizado: p.sincronizado === 1,
    fecha: p.fecha
  }))

  // Obtener productos del backend
  const backendProducts = (sesionData?.productosContados || []).map(p => ({
    ...p,
    productoId: p?.productoId || p?.id || p?._id || '',
    local: false,
    sincronizado: true
  }))

  // Unir listas (sin duplicar visualmente si ya está sincronizado)
  // Estrategia: Mostrar lista local completa + productos backend que NO estén en local
  // O más simple: Usar lista local como fuente de la verdad para lo que acabamos de contar,
  // y backend para histórico.
  // MEJOR: Si hay localProducts, usarlos. Si no, backend.
  // Pero necesitamos ver lo histórico del backend también.

  // Vamos a mostrar TODOS los locales + TODOS los del backend que NO coincidan con un local (por productoId)
  // Esto asume que si edito un producto, creo una entrada local nueva o update.

  const mergedProducts = [...localFormatted]

  // Añadir del backend si no está ya en local (por productoId)
  backendProducts.forEach(bp => {
    // Verificar si ya tenemos este producto en local (siendo editado/agregado recientemente)
    // Nota: Esta lógica puede ser compleja si permitimos múltiples entradas del mismo producto.
    // Si la lógica de negocio permite múltiples filas del mismo producto, simplemente concatenamos.
    // Si agrupa por producto, filtramos.
    // Asumiremos concatenación por seguridad de datos, ordenado por fecha.

    // Para evitar duplicados EXACTOS (mismo ID de conteo si viniera del backend con ID),
    // pero aquí los locales tienen ID numérico temporal.

    // Simplemente concatenamos todo y ordenamos por fecha/creación.
    // Pero si ya sincronicé un local, aparecerá en backend?
    // Si sincronicé, `localDb` marca `sincronizado=1`.
    // Podríamos filtrar los locales que ya están sincronizados SI ya vinieron en el `sesionData`.
    // Pero `sesionData` puede tener delay.

    // Simplificación visual: Mostrar todo lo local (pendiente o sync) y todo lo backend.
    // Riesgo: Duplicados visuales momentáneos tras sync hasta que refetch backend y limpie local?
    // No limpiamos local automáticamente en `loadLocalProducts`...

    // Mejor estrategia para UI limpia:
    // 1. Mostrar todos los Pendientes Locales (sincronizado=0).
    // 2. Mostrar todos los de Backend (sesionData).
    mergedProducts.length = 0 // Limpiar array

    // Agregar pendientes locales
    const pendientes = localFormatted.filter(p => !p.sincronizado)
    mergedProducts.push(...pendientes)

    // Agregar backend
    mergedProducts.push(...backendProducts)
  })

  // Ordenar por fecha desc (más reciente arriba)
  // Backend suele venir ordenado, pero al mezclar necesitamos reordenar
  const productosOrdenados = mergedProducts.sort((a, b) => {
    // Priorizar updatedAt (edición), luego fecha/createdAt (creación)
    const dateA = new Date(a.updatedAt || a.fecha || a.createdAt || 0)
    const dateB = new Date(b.updatedAt || b.fecha || b.createdAt || 0)
    return dateB - dateA
  })

  // Alias para compatibilidad con código existente
  const productosContados = productosOrdenados

  // Productos con costo 0
  const productosConCostoCero = productosContados.filter(p => (Number(p.costoProducto) || 0) === 0)
  const cantidadProductosCostoCero = productosConCostoCero.length

  const openFinancialModal = (modalType) => {
    setActiveFinancialModal(modalType);
    setShowFinancialModal(true);
  };

  const financialOptions = [
    { title: 'Ventas', icon: 'cart-outline', color: '#3b82f6', type: 'ventas' },
    { title: 'Gastos', icon: 'trending-down-outline', color: '#ef4444', type: 'gastos' },
    { title: 'Cuentas por Cobrar', icon: 'people-outline', color: '#22c55e', type: 'cuentasPorCobrar' },
    { title: 'Cuentas por Pagar', icon: 'card-outline', color: '#f97316', type: 'cuentasPorPagar' },
    { title: 'Efectivo', icon: 'wallet-outline', color: '#8b5cf6', type: 'efectivo' },
    { title: 'Deuda a Negocio', icon: 'person-remove-outline', color: '#f59e0b', type: 'deudaANegocio' },
    { title: 'Activos Fijos', icon: 'briefcase-outline', color: '#6366f1', type: 'activosFijos' },
    { title: 'Capital', icon: 'server-outline', color: '#64748b', type: 'capital' },
  ];

  const inventoryOptions = [
    {
      title: 'Productos Generales',
      icon: 'cube-outline',
      color: '#2563eb',
      onPress: () => setShowProductosGeneralesModal(true),
    },
    {
      title: 'Descargar Listado',
      icon: 'download-outline',
      color: '#0ea5e9',
      onPress: () => setShowDownloadOptions(true),
    },
    {
      title: 'Conectar',
      icon: 'phone-portrait-outline',
      color: '#8b5cf6',
      onPress: () => setShowConnectModal(true),
    },
    {
      title: 'Buscar Producto',
      icon: 'search-outline',
      color: '#10b981',
      onPress: () => setShowFindEditModal(true),
    },

    {
      title: 'Ver Reporte',
      icon: 'document-text-outline',
      color: '#14b8a6',
      onPress: () => {
        setShowInventoryReportModal(true)
      }
    },
    {
      title: 'Configuración',
      icon: 'settings-outline',
      color: '#6b7280',
      onPress: () => {
        setShowMenuModal(false)
        setShowConfigurationModal(true)
      }
    },
  ];


  // Descarga Excel (CSV)
  const handleDownloadExcel = async () => {
    try {
      const header = ['Nombre', 'Código', 'Cantidad', 'Costo', 'Total']
      const rows = productosContados.map(p => [
        p.nombreProducto || '',
        p.skuProducto || '',
        String(p.cantidadContada ?? ''),
        String(p.costoProducto ?? ''),
        String(((Number(p.cantidadContada) || 0) * (Number(p.costoProducto) || 0)).toFixed(2))
      ])
      const csv = [header, ...rows].map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n')
      const fileUri = FileSystem.documentDirectory + `Listado_${sesionData?.numeroSesion || 'inventario'}.csv`
      await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 })
      await Sharing.shareAsync(fileUri)
      setShowDownloadOptions(false)
    } catch (e) {
      handleApiError(e)
    }
  }

  // Descarga PDF (si sesión completada usa backend)
  const handleDownloadPDF = async () => {
    if (!isConnected) {
      Alert.alert('Conexión Requerida', 'La descarga de reportes PDF profesionales requiere conexión al servidor. Por favor, conéctate a internet.')
      return
    }
    try {
      const baseURL = api.defaults.baseURL
      const url = `${baseURL}/reportes/inventario/${sesionId}/pdf`
      const credentials = await getInternetCredentials('auth_token')
      const headers = credentials?.password ? { Authorization: `Bearer ${credentials.password}` } : {}

      const target = FileSystem.documentDirectory + `Inventario_${sesionData?.numeroSesion || 'inventario'}.pdf`
      const { uri, status } = await FileSystem.downloadAsync(url, target, { headers })
      if (status >= 200 && status < 300) {
        await Sharing.shareAsync(uri)
      } else {
        showMessage({ message: 'No se pudo descargar el PDF', type: 'danger' })
      }
      setShowDownloadOptions(false)
    } catch (e) {
      handleApiError(e)
    }
  }

  // Generar código QR para invitación de colaborador
  const handleGenerarQRInvitacion = async () => {
    try {
      setIsGeneratingQR(true)

      const response = await invitacionesApi.createQR({
        rol: 'colaborador',
        email: '',
        nombre: '',
        expiraEnMinutos: 1440 // 24 horas
      })

      if (response.data.exito) {
        setQrInvitacionData(response.data.datos)
        Vibration.vibrate(100)
        showMessage({
          message: 'Código QR generado',
          description: 'Compártelo con tus colaboradores',
          type: 'success',
        })
      }
    } catch (error) {
      handleApiError(error)
    } finally {
      setIsGeneratingQR(false)
    }
  }

  // Compartir QR de invitación
  const handleCompartirQR = async () => {
    try {
      if (!qrInvitacionData?.qrDataUrl) return

      const dataUrl = qrInvitacionData.qrDataUrl
      const base64 = dataUrl.replace(/^data:image\/(png|jpeg);base64,/, '')
      const fileUri = FileSystem.cacheDirectory + `invitacion-colaborador-${Date.now()}.png`

      await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: FileSystem.EncodingType.Base64
      })

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'image/png',
          dialogTitle: 'Compartir código QR de invitación'
        })
      } else {
        showMessage({
          message: 'QR guardado en caché',
          type: 'info'
        })
      }
    } catch (error) {
      handleApiError(error)
    }
  }

  // Cerrar modal de QR
  const handleCerrarModalQR = () => {
    setShowConnectModal(false)
    setQrInvitacionData(null)
  }

  // Ver QR de una invitación existente
  const handleVerQRInvitacion = async (inv) => {
    try {
      setIsGeneratingQR(true)
      // Usar el UUID para obtener los datos del QR
      const response = await invitacionesApi.getQR(inv.uuid || inv.id || inv._id)
      if (response.data?.exito) {
        setQrInvitacionData(response.data.datos)
      }
    } catch (error) {
      handleApiError(error)
    } finally {
      setIsGeneratingQR(false)
    }
  }

  // Imprimir/descargar páginas específicas del PDF
  const handlePrintPages = async (pageSpec) => {
    if (!isConnected) {
      Alert.alert('Conexión Requerida', 'La impresión remota y generación de PDF requiere conexión al servidor.')
      return
    }
    try {
      const sanitized = String(pageSpec || '').replace(/\s+/g, '')
      const pattern = /^\d+(-\d+)?(,\d+(-\d+)?)*$/
      if (!sanitized) {
        showMessage({ message: 'Ingresa las páginas a imprimir, por ejemplo: 3-5 o 3,4,5', type: 'warning' })
        return
      }
      if (!pattern.test(sanitized)) {
        showMessage({ message: 'Formato de páginas inválido', type: 'warning' })
        return
      }

      const baseURL = api.defaults.baseURL
      const downloadUrl = `${baseURL}/reportes/inventario/${sesionId}/pdf?pages=${encodeURIComponent(sanitized)}`
      const credentials = await getInternetCredentials('auth_token')
      const headers = credentials?.password ? { Authorization: `Bearer ${credentials.password}` } : {}

      const fileUri = FileSystem.documentDirectory + `Inventario_${sesionData?.numeroSesion || 'inventario'}_pags_${sanitized}.pdf`
      const { uri, status } = await FileSystem.downloadAsync(downloadUrl, fileUri, { headers })
      if (status >= 200 && status < 300) {
        await Sharing.shareAsync(uri)
        showMessage({ message: 'Archivo listo', type: 'success' })
      } else if (status === 400) {
        showMessage({ message: 'Rango de páginas inválido en el servidor', type: 'warning' })
      } else if (status === 404) {
        showMessage({ message: 'Sesión no encontrada o sin finalizar', type: 'warning' })
      } else {
        showMessage({ message: 'No se pudo generar el PDF con las páginas solicitadas', type: 'danger' })
      }
    } catch (e) {
      handleApiError(e)
    }
  }

  // Guardar edición de producto
  const handleSaveEdit = async (item) => {
    try {
      const key = typeof item?.producto === 'object' ? item.producto?._id : item?.producto
      const cantidad = parseFloat(editDraft[key]?.cantidad ?? item.cantidadContada) || 0
      const costo = parseFloat(editDraft[key]?.costo ?? item.costoProducto) || 0
      await sesionesApi.updateProduct(sesionId, key, { cantidadContada: cantidad, costoProducto: costo })
      setEditDraft(prev => { const p = { ...prev }; delete p[key]; return p })
      queryClient.invalidateQueries(['sesion', sesionId])
      showMessage({ message: 'Producto actualizado', type: 'success' })
    } catch (e) {
      handleApiError(e)
    }
  }



  // Manejar error de sesión
  if (errorLoadingSesion && !loadingSesion && !sesionData) {
    return (
      <View style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Ionicons name="alert-circle" size={64} color="#ef4444" />
          <Text style={{ fontSize: 20, fontWeight: 'bold', marginTop: 20, marginBottom: 10, color: '#1e293b' }}>
            Error al cargar la sesión
          </Text>
          <Text style={{ fontSize: 16, textAlign: 'center', color: '#64748b', marginBottom: 20 }}>
            No se pudo cargar la sesión de inventario. Por favor, verifica tu conexión e intenta nuevamente.
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: '#3b82f6', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
            onPress={() => {
              setErrorSesion(null);
              refetch();
            }}
          >
            <Text style={{ color: '#ffffff', fontWeight: 'bold' }}>Reintentar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ marginTop: 12, paddingHorizontal: 24, paddingVertical: 12 }}
            onPress={() => navigation.goBack()}
          >
            <Text style={{ color: '#3b82f6', fontWeight: '600' }}>Volver</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Modal visible={loadingSesion} animationType="fade">
        <SplashScreen onComplete={() => { }} />
      </Modal>
      {/* Header */}
      <LinearGradient colors={['#3b82f6', '#2563eb']} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={async () => {
              try {
                if (sesionData?.timerEnMarcha) {
                  await sesionesApi.pauseTimer(sesionId)
                }
              } catch (_) { }
              setShowExitModal(true)
            }}
          >
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>
              Sesión {sesionData?.numeroSesion}
            </Text>
            <Text style={styles.headerSubtitle}>
              {sesionData?.clienteNegocio?.nombre}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <View style={[styles.statusBadge, { backgroundColor: isConnected ? '#10b981' : '#f59e0b' }]}>
              <Ionicons name={isConnected ? "wifi" : "wifi-outline"} size={14} color="#fff" />
              <Text style={styles.statusText}>{isConnected ? 'ON' : 'OFF'}</Text>
            </View>

            <TimerDisplay sesionData={sesionData} sesionId={sesionId} />

            <TouchableOpacity
              style={styles.menuButton}
              onPress={() => setShowMenuModal(true)}
            >
              <Ionicons name="ellipsis-vertical" size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Barra de Control Offline/Sync */}
        <View style={styles.syncBar}>
          <View style={styles.switchContainer}>
            <Text style={styles.switchLabel}>Envío Auto</Text>
            <Switch
              value={autoSend}
              onValueChange={setAutoSend}
              trackColor={{ false: "#767577", true: "#81b0ff" }}
              thumbColor={autoSend ? "#2563eb" : "#f4f3f4"}
              style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
            />
          </View>

          {(!autoSend || pendingSyncs > 0) && (
            <TouchableOpacity
              style={[styles.syncButton, pendingSyncs > 0 ? styles.syncButtonActive : styles.syncButtonInactive]}
              onPress={handleSyncNow}
              disabled={isSyncing || pendingSyncs === 0}
            >
              {isSyncing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={16} color="#fff" style={{ marginRight: 4 }} />
                  <Text style={styles.syncButtonText}>
                    {pendingSyncs > 0 ? `Sincronizar (${pendingSyncs})` : 'Sincronizado'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {/* Exit Confirmation Modal */}
      <Modal
        visible={showExitModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowExitModal(false)}
      >
        <View style={styles.exitModalOverlay}>
          <View style={styles.exitModalContainer}>
            <View style={styles.exitModalHeader}>
              <Ionicons name="alert-circle" size={24} color="#f59e0b" />
              <Text style={styles.exitModalTitle}>Salir de la sesión</Text>
            </View>
            <Text style={styles.exitModalMessage}>
              ¿Deseas salir sin guardar o guardar y salir? Puedes finalizar la sesión para conservar los cambios.
            </Text>
            <View style={styles.exitModalActions}>
              <TouchableOpacity
                style={[styles.exitButton, styles.exitCancel]}
                onPress={() => setShowExitModal(false)}
              >
                <Text style={styles.exitCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.exitButton, styles.exitWithoutSave]}
                onPress={() => {
                  setShowExitModal(false)
                  navigation.goBack()
                }}
              >
                <Text style={styles.exitWithoutSaveText}>Salir sin guardar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.exitButton, styles.exitSave]}
                onPress={() => {
                  setShowExitModal(false)
                  showAnimation('config', 2000, 'Guardando sesión...')
                  completeSessionMutation.mutate()
                }}
              >
                <Text style={styles.exitSaveText}>Guardar y salir</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Botones de acción principales */}
      <View style={styles.actionButtonsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.scanButton]}
          onPress={() => setShowScanner(true)}
        >
          <Ionicons name="barcode" size={24} color="#ffffff" />
          <Text style={styles.actionButtonText}>Código</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.searchButton]}
          onPress={() => setShowSearchModal(true)}
        >
          <Ionicons name="search" size={24} color="#ffffff" />
          <Text style={styles.actionButtonText}>Buscar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.addButton]}
          onPress={() => setShowAddProductModal(true)}
        >
          <Ionicons name="add" size={24} color="#ffffff" />
          <Text style={styles.actionButtonText}>Nuevo</Text>
        </TouchableOpacity>
      </View>


      {/* Formulario para agregar producto */}
      {selectedProducto && (
        <View style={styles.addFormContainer}>
          <Text style={styles.selectedProductTitle}>Agregando:</Text>
          <Text style={styles.selectedProductName}>{selectedProducto.nombre}</Text>
          <View style={styles.formRow}>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Cantidad</Text>
              <TextInput
                style={styles.input}
                placeholder="1"
                keyboardType="numeric"
                value={cantidad}
                onChangeText={setCantidad}
                autoFocus
              />

            </View>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Costo (c/u)</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                keyboardType="numeric"
                value={costo}
                onChangeText={setCosto}
              />
            </View>
          </View>
          <TouchableOpacity style={styles.submitButton} onPress={handleAddProduct}>
            <Ionicons name="add-circle" size={24} color="#ffffff" />
            <Text style={styles.submitButtonText}>Agregar al Inventario</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Estadísticas rápidas */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {sesionData?.productosContados?.length || 0}
          </Text>
          <Text style={styles.statLabel}>Productos</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            ${sesionData?.totales?.valorTotalInventario?.toLocaleString() || '0'}
          </Text>
          <Text style={styles.statLabel}>Valor Total</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {sesionData?.totales?.totalProductosContados || 0}
          </Text>
          <Text style={styles.statLabel}>Contados</Text>
        </View>
      </View>

      {/* Lista de productos */}
      <FlatList
        data={productosOrdenados}
        renderItem={renderProductoItem}
        keyExtractor={(item, index) => item._id || item.id || `detalle-${index}`}
        contentContainerStyle={styles.productsList}
        showsVerticalScrollIndicator={false}
        refreshing={isFetching}
        onRefresh={() => { showLoader(800); refetch(); }}
        // Props de optimización
        initialNumToRender={15}
        windowSize={11}
        maxToRenderPerBatch={10}
        removeClippedSubviews={true}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="cube-outline" size={64} color="#cbd5e1" />
            <Text style={styles.emptyText}>No hay productos agregados</Text>
            <Text style={styles.emptySubtext}>
              Usa el escáner o búsqueda para agregar productos
            </Text>
          </View>
        }
      />

      {/* Modal del escáner */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={showScanner}
        onRequestClose={() => setShowScanner(false)}
      >
        <View style={styles.scannerContainer}>
          {hasPermission === null && (
            <Text>Solicitando permisos de cámara...</Text>
          )}
          {hasPermission === false && (
            <Text>Sin acceso a la cámara</Text>
          )}
          {hasPermission && (
            <CameraView
              onBarcodeScanned={handleBarCodeScanned}
              barcodeScannerSettings={{
                barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39', 'upc_a', 'upc_e'],
              }}
              style={StyleSheet.absoluteFillObject}
            />
          )}
          <View style={styles.scannerOverlay}>
            <View style={styles.scannerHeader}>
              <TouchableOpacity
                style={styles.scannerCloseButton}
                onPress={() => setShowScanner(false)}
              >
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
              <Text style={styles.scannerTitle}>Escanear Código de Barras</Text>
            </View>
            <View style={styles.scannerFrame} />
            <Text style={styles.scannerInstructions}>
              Apunta la cámara hacia el código de barras
            </Text>
          </View>
        </View>
      </Modal>

      <ProductSearchModal
        visible={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        clienteId={sesionData?.clienteNegocio?._id}
        onSelectProduct={async (product) => {
          // Buscar cantidad anterior del producto en inventarios anteriores
          const cantidadAnterior = await buscarCantidadAnterior(
            product._id || product.id,
            product.nombre
          );

          // Abrir modal de confirmación antes de agregar
          setSearchedProduct(product);
          setCantidadAnteriorProducto(cantidadAnterior);
          setShowSearchedProductModal(true);
        }}
      />

      {/* Modal para agregar cantidad/costo después de escanear código de barras */}
      <BarcodeProductModal
        visible={showBarcodeProductModal}
        onClose={() => {
          setShowBarcodeProductModal(false);
          setScannedProduct(null);
          setScannedBarcode(null);
          setCantidadAnteriorProducto(null);
        }}
        producto={scannedProduct}
        codigoBarras={scannedBarcode}
        onConfirm={handleBarcodeProductConfirm}
        costoInicial={scannedProduct?.costo || scannedProduct?.costoBase || ''}
        cantidadInicial={cantidadAnteriorProducto ? String(cantidadAnteriorProducto) : "1"}
        cantidadAnterior={cantidadAnteriorProducto}
      />

      {/* Modal para producto buscado por nombre */}
      <BarcodeProductModal
        visible={showSearchedProductModal}
        onClose={() => {
          setShowSearchedProductModal(false);
          setSearchedProduct(null);
        }}
        producto={searchedProduct}
        codigoBarras={searchedProduct?.codigoBarras || ''}
        onConfirm={handleSearchedProductConfirm}
        costoInicial={searchedProduct?.isClientProduct ? (searchedProduct?.costo || '') : (searchedProduct?.costoBase || '')}
        cantidadInicial="1"
      />

      {/* Modal de Nuevo Producto */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showAddProductModal}
        onRequestClose={() => setShowAddProductModal(false)}
      >
        <View style={styles.addProductModalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.addProductModalWrapper}>
            <View style={styles.addProductModalContainer}>
              <View style={styles.addProductModalHeader}>
                <Text style={styles.addProductModalTitle}>Nuevo Producto</Text>
                <TouchableOpacity onPress={() => setShowAddProductModal(false)}>
                  <Ionicons name="close" size={24} color="#374151" />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.addProductModalContent} contentContainerStyle={{ paddingBottom: 20 }}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Nombre *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Nombre del producto"
                    value={newProductData.nombre}
                    onChangeText={(text) => setNewProductData(prev => ({ ...prev, nombre: text }))}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>SKU</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Código SKU"
                    value={newProductData.sku}
                    onChangeText={(text) => setNewProductData(prev => ({ ...prev, sku: text }))}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Código de Barras</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Código de barras"
                    value={newProductData.codigoBarras}
                    onChangeText={(text) => setNewProductData(prev => ({ ...prev, codigoBarras: text }))}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Costo *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0.00"
                    keyboardType="numeric"
                    value={newProductData.costo}
                    onChangeText={(text) => setNewProductData(prev => ({ ...prev, costo: text }))}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Categoría</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Categoría del producto"
                    value={newProductData.categoria}
                    onChangeText={(text) => setNewProductData(prev => ({ ...prev, categoria: text }))}
                  />
                </View>
              </ScrollView>
              <View style={styles.addProductModalFooter}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowAddProductModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.createButton}
                  onPress={handleCreateProduct}
                >
                  <Text style={styles.createButtonText}>Crear Producto</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Modales Financieros */}
      <FinancialModal
        visible={showFinancialModal}
        onClose={() => {
          setShowFinancialModal(false)
          setActiveFinancialModal(null)
        }}
        onSave={handleSaveFinancial}
        modalType={activeFinancialModal}
        initialData={datosFinancieros || defaultFinancialData}
        sesionData={sesionData}
      />

      <DistribucionModal
        visible={showDistribucionModal}
        onClose={() => setShowDistribucionModal(false)}
        onSave={(data) => {
          setDistribucionData(data)
          setShowDistribucionModal(false)
          showMessage({
            message: 'Distribución guardada exitosamente',
            type: 'success',
          })
        }}
        initialData={distribucionData}
      />

      <ContadorModal
        visible={showContadorModal}
        onClose={() => setShowContadorModal(false)}
        onSave={(data) => {
          setContadorData(data)
          showMessage({
            message: 'Datos del contador guardados',
            type: 'success',
          })
        }}
        initialData={contadorData}
      />

      <ExportModal
        visible={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
        sesionData={sesionData}
        initialConfig={exportInitialConfig}
      />

      <ReportPreviewModal
        visible={showReportPreviewModal}
        onClose={() => {
          setShowReportPreviewModal(false)
          setReportType(null)
        }}
        sesionData={sesionData}
        reportType={reportType}
        onExport={handleExport}
        onPreview={handlePreview}
        onPrintPages={handlePrintPages}
      />

      <InventoryReportModal
        visible={showInventoryReportModal}
        onClose={() => setShowInventoryReportModal(false)}
        sesionData={sesionData}
        productosContados={productosContados}
        datosFinancieros={datosFinancieros || defaultFinancialData}
        contadorData={contadorData}
        user={sesionData?.contador || {}}
      />

      <ZeroCostProductsModal
        visible={showZeroCostProductsModal}
        onClose={() => setShowZeroCostProductsModal(false)}
        productos={productosConCostoCero}
        sesionId={sesionId}
        zeroCostProductsEdits={zeroCostProductsEdits}
        setZeroCostProductsEdits={setZeroCostProductsEdits}
      />

      {/* Productos Generales Modal */}
      <ProductosGeneralesModal
        visible={showProductosGeneralesModal}
        onClose={() => setShowProductosGeneralesModal(false)}
        sesionId={sesionId}
        clienteId={sesionData?.clienteNegocio?._id}
      />

      {/* Configuration Modal */}
      <ConfigurationModal
        visible={showConfigurationModal}
        onClose={() => setShowConfigurationModal(false)}
        onOpenDownloadOptions={() => setShowDownloadOptions(true)}
        onOpenConnect={() => setShowConnectModal(true)}
        onOpenSearch={() => setShowFindEditModal(true)}
      />

      {/* Menu Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showMenuModal}
        onRequestClose={() => setShowMenuModal(false)}
      >
        <TouchableOpacity
          style={styles.menuModalOverlay}
          activeOpacity={1}
          onPressOut={() => setShowMenuModal(false)}
        >
          <View style={styles.menuModalContainer}>
            <ScrollView>
              <Text style={styles.menuTitle}>Gestión Financiera</Text>
              {financialOptions.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.menuItem, { backgroundColor: item.color }]}
                  onPress={() => {
                    setShowMenuModal(false);
                    openFinancialModal(item.type);
                  }}
                >
                  <Ionicons name={item.icon} size={22} color="#ffffff" />
                  <Text style={styles.menuItemText}>{item.title}</Text>
                </TouchableOpacity>
              ))}

              <View style={styles.menuSeparator} />

              <Text style={styles.menuTitle}>Gestión de Inventario</Text>
              {inventoryOptions.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.menuItem, { backgroundColor: item.color }]}
                  onPress={() => {
                    setShowMenuModal(false);
                    // Usar setTimeout para asegurar que el modal se cierre antes de abrir otro
                    setTimeout(() => {
                      item.onPress();
                    }, 100);
                  }}
                >
                  <Ionicons name={item.icon} size={22} color="#ffffff" />
                  <Text style={styles.menuItemText}>{item.title}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal de confirmación de eliminación */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showDeleteConfirm}
        onRequestClose={() => setShowDeleteConfirm(false)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmContainer}>
            <Text style={styles.confirmTitle}>Eliminar producto</Text>
            <Text style={styles.confirmMessage}>¿Seguro que deseas eliminar "{deleteTarget?.nombreProducto || deleteTarget?.producto?.nombre}" de la lista?</Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={[styles.confirmButton, styles.cancelButton]} onPress={() => setShowDeleteConfirm(false)}>
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmButton, styles.deleteConfirmButton]} onPress={confirmDelete}>
                <Text style={styles.deleteConfirmText}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Download Options Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showDownloadOptions}
        onRequestClose={() => setShowDownloadOptions(false)}
      >
        <TouchableOpacity style={styles.menuModalOverlay} activeOpacity={1} onPressOut={() => setShowDownloadOptions(false)}>
          <View style={styles.menuModalContainer}>
            <Text style={styles.menuTitle}>Descargar listado</Text>
            <TouchableOpacity style={[styles.menuItem, { backgroundColor: '#0ea5e9' }]} onPress={handleDownloadPDF}>
              <Ionicons name="document-text-outline" size={22} color="#fff" />
              <Text style={styles.menuItemText}>PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuItem, { backgroundColor: '#22c55e' }]} onPress={handleDownloadExcel}>
              <Ionicons name="grid-outline" size={22} color="#fff" />
              <Text style={styles.menuItemText}>Excel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Connect Modal - Gestión de Colaboradores */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={showConnectModal}
        onRequestClose={handleCerrarModalQR}
      >
        <LinearGradient
          colors={['#8b5cf6', '#7c3aed', '#6d28d9']}
          style={{ flex: 1 }}
        >
          {/* Header */}
          <View style={{ paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 20, paddingBottom: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <TouchableOpacity onPress={handleCerrarModalQR} style={{ padding: 8 }}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#fff' }}>
                {qrInvitacionData ? 'Código de Invitación' : 'Colaboración'}
              </Text>
              <View style={{ width: 44 }} />
            </View>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
            {qrInvitacionData ? (
              /* VISTA DE CÓDIGO QR */
              <View style={{ alignItems: 'center', padding: 30 }}>
                <View style={{ backgroundColor: '#fff', padding: 20, borderRadius: 20, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 10 }}>
                  <Image 
                    source={{ uri: qrInvitacionData.qrDataUrl }} 
                    style={{ width: width * 0.7, height: width * 0.7 }} 
                    resizeMode="contain"
                  />
                </View>
                
                <Text style={{ color: '#fff', fontSize: 24, fontWeight: 'bold', marginTop: 30 }}>
                  {qrInvitacionData.codigoNumerico}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 16, marginTop: 10, textAlign: 'center' }}>
                  El colaborador debe escanear este código o ingresarlo manualmente.
                </Text>

                <TouchableOpacity 
                  onPress={handleCompartirQR}
                  style={{ backgroundColor: '#fff', paddingHorizontal: 30, paddingVertical: 15, borderRadius: 12, marginTop: 40, flexDirection: 'row', alignItems: 'center' }}
                >
                  <Ionicons name="share-outline" size={24} color="#7c3aed" />
                  <Text style={{ color: '#7c3aed', fontWeight: 'bold', marginLeft: 10, fontSize: 16 }}>Compartir Invitación</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={() => setQrInvitacionData(null)}
                  style={{ marginTop: 25 }}
                >
                  <Text style={{ color: '#fff', fontWeight: 'bold', textDecorationLine: 'underline' }}>Volver al listado</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* VISTA DE GESTIÓN */
              <View style={{ paddingHorizontal: 20 }}>
                {/* Generar Nueva */}
                <View style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 15, padding: 20, marginBottom: 25 }}>
                  <Text style={{ color: '#fff', fontWeight: 'bold', marginBottom: 15 }}>Nueva Invitación</Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TextInput
                      placeholder="Nombre del colaborador..."
                      placeholderTextColor="rgba(255,255,255,0.6)"
                      value={newProductData.nombreInput || ''}
                      onChangeText={(t) => setNewProductData(v => ({ ...v, nombreInput: t }))}
                      style={{ flex: 1, backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 12, height: 45 }}
                    />
                    <TouchableOpacity 
                      onPress={() => {
                        const nombre = newProductData.nombreInput;
                        handleGenerarQR(nombre);
                        setNewProductData(v => ({ ...v, nombreInput: '' }));
                      }}
                      disabled={isGeneratingQR}
                      style={{ backgroundColor: '#22c55e', paddingHorizontal: 15, borderRadius: 8, justifyContent: 'center' }}
                    >
                      {isGeneratingQR ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Ionicons name="qr-code" size={24} color="#fff" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Invitaciones Activas */}
                <Text style={{ color: '#fff', fontWeight: 'bold', marginBottom: 10, fontSize: 16 }}>Invitaciones Pendientes</Text>
                {invitaciones.length === 0 ? (
                  <View style={{ padding: 20, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 10, alignItems: 'center' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)' }}>No hay invitaciones activas</Text>
                  </View>
                ) : (
                  invitaciones.map((inv, idx) => (
                    <View key={inv._id || idx} style={{ backgroundColor: '#fff', borderRadius: 12, padding: 15, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View>
                        <Text style={{ fontWeight: 'bold', color: '#1e293b' }}>{inv.nombre || 'Colaborador'}</Text>
                        <Text style={{ color: '#8b5cf6', fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>{inv.codigoNumerico}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 15 }}>
                        <TouchableOpacity onPress={() => handleVerQRInvitacion(inv)}>
                          <Ionicons name="qr-code-outline" size={24} color="#7c3aed" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={async () => {
                          Alert.alert('Eliminar', '¿Deseas cancelar esta invitación?', [
                            { text: 'No' },
                            { text: 'Sí', onPress: async () => {
                                await invitacionesApi.cancel(inv._id || inv.id)
                                cargarInvitaciones()
                            }}
                          ])
                        }}>
                          <Ionicons name="trash-outline" size={24} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}

                {/* Colaboradores Activos */}
                <Text style={{ color: '#fff', fontWeight: 'bold', marginBottom: 10, marginTop: 25, fontSize: 16 }}>Colaboradores en Sesión</Text>
                {colaboradoresActivos.length === 0 ? (
                  <View style={{ padding: 20, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 10, alignItems: 'center' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)' }}>No hay colaboradores conectados</Text>
                  </View>
                ) : (
                  colaboradoresActivos.map((colab, idx) => {
                    const cantPendientes = (productosColaboradorPendientes[colab._id] || []).length;
                    return (
                      <View key={colab._id || idx} style={{ backgroundColor: '#fff', borderRadius: 12, padding: 15, marginBottom: 10 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View>
                            <Text style={{ fontWeight: 'bold', color: '#1e293b' }}>{colab.nombreColaborador || colab.colaborador?.nombre || 'Desconocido'}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e', marginRight: 5 }} />
                              <Text style={{ fontSize: 12, color: '#64748b' }}>Activo ahora</Text>
                            </View>
                          </View>
                          {cantPendientes > 0 && (
                            <TouchableOpacity 
                              onPress={() => handleSincronizarColaborador(colab._id)}
                              style={{ backgroundColor: '#f59e0b', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}
                            >
                              <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>Sincronizar ({cantPendientes})</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    )
                  })
                )}
              </View>
            )}
          </ScrollView>
        </LinearGradient>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#64748b',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 15,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  timerText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  syncBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginTop: 10,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  switchLabel: {
    color: '#fff',
    fontSize: 12,
    marginRight: 5,
    fontWeight: '600',
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  syncButtonActive: {
    backgroundColor: '#f59e0b',
  },
  syncButtonInactive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  menuButton: {
    marginLeft: 15,
    padding: 5,
  },
  menuModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuModalContainer: {
    backgroundColor: '#1e293b',
    borderRadius: 15,
    padding: 20,
    width: width * 0.85,
    maxHeight: height * 0.8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 10,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    textAlign: 'center',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginBottom: 10,
  },
  menuItemText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 15,
  },
  menuSeparator: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 15,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 12,
    marginHorizontal: 5,
  },
  scanButton: {
    backgroundColor: '#22c55e',
  },
  searchButton: {
    backgroundColor: '#3b82f6',
  },
  addButton: {
    backgroundColor: '#f59e0b',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  configButtonsContainer: {
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  configButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
  },
  addFormContainer: {
    padding: 20,
    backgroundColor: '#eef2ff',
    margin: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  selectedProductTitle: {
    fontSize: 14,
    color: '#4338ca',
    marginBottom: 4,
  },
  selectedProductName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#312e81',
    marginBottom: 15,
  },
  formRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  inputWrapper: {
    flex: 1,
    marginHorizontal: 5,
  },
  inputLabel: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1e293b',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16a34a',
    paddingVertical: 15,
    borderRadius: 12,
    marginTop: 10,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,

  },
  financialButton: {
    backgroundColor: '#8b5cf6',
  },
  distribucionButton: {
    backgroundColor: '#22c55e',
  },
  contadorButton: {
    backgroundColor: '#f59e0b',
  },
  exportButton: {
    backgroundColor: '#06b6d4',
  },
  configButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 5,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  productsList: {
    paddingHorizontal: 20,
  },
  productoItem: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  productoInfo: {
    flex: 1,
  },
  productoNombre: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 5,
  },
  productoSku: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 8,
  },
  productoStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  productoCantidad: {
    fontSize: 12,
    color: '#22c55e',
    fontWeight: '600',
  },
  productoCosto: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: '600',
  },
  productoTotal: {
    fontSize: 12,
    color: '#1e293b',
    fontWeight: 'bold',
  },
  deleteButton: {
    padding: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    color: '#64748b',
    marginTop: 15,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 5,
    textAlign: 'center',
  },
  scannerContainer: {
    flex: 1,
  },
  scannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
    width: '100%',
  },
  scannerCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginRight: 40,
  },
  scannerFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#ffffff',
    borderRadius: 12,
  },
  scannerInstructions: {
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'center',
    paddingHorizontal: 40,
    paddingBottom: 100,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingVertical: 20,
    width: '100%',
  },
  // Estilos para modales adicionales
  searchModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchModalContainer: {
    width: width * 0.9,
    maxHeight: height * 0.7,
    backgroundColor: '#ffffff',
    borderRadius: 15,
    padding: 20,
  },
  searchModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  searchModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  searchModalInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 15,
  },
  searchResultItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  searchResultSku: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  searchResultPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  searchEmptyText: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 16,
    paddingVertical: 40,
  },
  addProductModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addProductModalWrapper: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addProductModalContainer: {
    width: Math.min(width * 0.95, 720),
    maxHeight: height * 0.85,
    minHeight: Math.min(height * 0.5, 520),
    backgroundColor: '#ffffff',
    borderRadius: 15,
  },
  addProductModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  addProductModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  addProductModalContent: {
    flex: 1,
    padding: 20,
  },
  inputGroup: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  addProductModalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    marginRight: 10,
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  createButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#22c55e',
    alignItems: 'center',
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Estilos para botón de productos con valor 0
  zeroCostButtonContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  zeroCostButton: {
    backgroundColor: '#f97316',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  zeroCostButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zeroCostButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
    marginRight: 8,
  },
  zeroCostBadge: {
    backgroundColor: '#ea580c',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 24,
    alignItems: 'center',
  },
  zeroCostBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  // Exit modal styles
  exitModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  exitModalContainer: {
    width: Math.min(width * 0.95, 600),
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
  },
  exitModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  exitModalTitle: {
    marginLeft: 8,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  exitModalMessage: {
    marginTop: 12,
    fontSize: 14,
    color: '#374151',
  },
  exitModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 18,
  },
  exitButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginLeft: 8,
  },
  exitCancel: {
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  exitCancelText: {
    color: '#374151',
    fontWeight: '600',
  },
  exitWithoutSave: {
    backgroundColor: '#f3f4f6',
  },
  exitWithoutSaveText: {
    color: '#374151',
    fontWeight: '600',
  },
  exitSave: {
    backgroundColor: '#10b981',
  },
  exitSaveText: {
    color: '#ffffff',
    fontWeight: '700',
  },
})

export default InventarioDetalleScreen
