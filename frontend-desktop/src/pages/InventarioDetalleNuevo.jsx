// Archivo: InventarioDetalleNuevo.jsx
// Descripción: Componente principal para la gestión detallada de inventarios.
// Incluye funcionalidades para agregar productos, modales financieros, reportes y más.
// Autor: [Tu nombre o equipo]
// Fecha: [Fecha actual]
import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { sesionesApi, productosApi, reportesApi, invitacionesApi, solicitudesConexionApi, handleApiError } from '../services/api'
import logoInfocolmados from '../img/logo_transparent.png'
import { ArrowLeft, Search, Trash2, Clock, TrendingUp, Users, CreditCard, Briefcase, PiggyBank, DollarSign, ShoppingCart, Barcode, X, Printer, FileText, Settings, TrendingDown, Wallet, Calculator, Calendar, Download, Share2, FileSpreadsheet, FileImage, UserMinus, Menu, Smartphone, QrCode, RefreshCw, Wifi, WifiOff, PieChart, Eye, CheckCircle, XCircle, Package, Edit3 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../hooks/useSocket'
import ProductoForm from '../components/ProductoForm'
import ReporteInventarioModal from '../components/ReporteInventarioModal'

const PRODUCTOS_POR_PAGINA = 45

// Helper para obtener el ID del cliente de la sesión
const obtenerClienteId = (sesion) => {
  if (!sesion) {
    console.warn('⚠️ obtenerClienteId: sesion es null o undefined')
    return null
  }

  const clienteId = sesion?.clienteNegocio?.id || sesion?.clienteNegocio?._id || sesion?.clienteNegocioId

  if (!clienteId) {
    console.warn('⚠️ obtenerClienteId: No se encontró clienteId')
    console.warn('⚠️ sesion.clienteNegocio:', sesion.clienteNegocio)
    console.warn('⚠️ sesion.clienteNegocioId:', sesion.clienteNegocioId)
  }

  return clienteId
}

// Helper to highlight search terms
const highlightMatch = (text, term) => {
  if (!text || !term || term.length < 2) return text
  const safeText = String(text)
  const safeTerm = String(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape regex chars
  const parts = safeText.split(new RegExp(`(${safeTerm})`, 'gi'))
  return parts.map((part, i) =>
    part.toLowerCase() === term.toLowerCase() ? <span key={i} className="bg-yellow-200 text-black font-bold px-0.5 rounded">{part}</span> : part
  )
}

const InventarioDetalleNuevo = () => {
  // Obtener parámetros de la URL (ID de la sesión de inventario)
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, hasRole } = useAuth()
  const { onlineColaboradoresDetalles } = useSocket()
  // Referencias para inputs de búsqueda y formularios
  const searchInputRef = useRef(null)
  const cantidadInputRef = useRef(null)
  const costoInputRef = useRef(null)

  // Estados para la gestión de productos y búsqueda
  const [codigoBarras, setCodigoBarras] = useState('')
  const [nombreBusqueda, setNombreBusqueda] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [selectedProducto, setSelectedProducto] = useState(null)
  const [cantidad, setCantidad] = useState('')
  const [costo, setCosto] = useState('')
  // Estados para modales de salida y búsqueda
  const [showExitModal, setShowExitModal] = useState(false)
  const [showExitOptionsModal, setShowExitOptionsModal] = useState(false)
  const [showExitDropdown, setShowExitDropdown] = useState(false)
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [showProductNotFoundModal, setShowProductNotFoundModal] = useState(false)
  const [showAddProductModal, setShowAddProductModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [showZeroCostModal, setShowZeroCostModal] = useState(false)
  // Estados adicionales para productos con costo cero y actualizaciones
  const [zeroCostEdits, setZeroCostEdits] = useState({})
  const [showZeroCostProductsModal, setShowZeroCostProductsModal] = useState(false)
  const [zeroCostProductsEdits, setZeroCostProductsEdits] = useState({})
  const [isUpdatingZeroCosts, setIsUpdatingZeroCosts] = useState(false)
  // Estados para modales activos y datos
  const [activeModal, setActiveModal] = useState(null)
  const [modalData, setModalData] = useState({})
  const [showMenuModal, setShowMenuModal] = useState(false)
  const [showDownloadModal, setShowDownloadModal] = useState(false)
  const [showConnectModal, setShowConnectModal] = useState(false)
  const [nombreColaborador, setNombreColaborador] = useState('')
  const [qrInvitacion, setQrInvitacion] = useState(null)
  const [generandoQR, setGenerandoQR] = useState(false)
  const [colaboradoresConectados, setColaboradoresConectados] = useState([])
  const [invitaciones, setInvitaciones] = useState([])
  const [productosColaboradorPendientes, setProductosColaboradorPendientes] = useState({})

  // Ordenar colaboradores para que los ACTIVOS aparezcan primero
  const colaboradoresOrdenados = useMemo(() => {
    if (!Array.isArray(colaboradoresConectados)) return [];
    
    return [...colaboradoresConectados].sort((a, b) => {
      const aId = String(a.id || a._id);
      const bId = String(b.id || b._id);
      
      const isAOnline = onlineColaboradoresDetalles?.some(o => String(o.solicitudId) === aId);
      const isBOnline = onlineColaboradoresDetalles?.some(o => String(o.solicitudId) === bId);
      
      if (isAOnline && !isBOnline) return -1;
      if (!isAOnline && isBOnline) return 1;
      
      const aTime = new Date(a.ultimoPing || a.updatedAt || 0).getTime();
      const bTime = new Date(b.ultimoPing || b.updatedAt || 0).getTime();
      return bTime - aTime;
    });
  }, [colaboradoresConectados, onlineColaboradoresDetalles]);
  const [showColaboradoresModal, setShowColaboradoresModal] = useState(false)
  const [showRevisarProductosModal, setShowRevisarProductosModal] = useState(false)
  const [colaboradorSeleccionado, setColaboradorSeleccionado] = useState(null)
  const [productosParaRevisar, setProductosParaRevisar] = useState([])
  const [cantidadesEditadas, setCantidadesEditadas] = useState({})
  const [showQRColaboradorModal, setShowQRColaboradorModal] = useState(false)
  const [qrColaboradorData, setQrColaboradorData] = useState(null)
  const [cargandoQR, setCargandoQR] = useState(false)
  const [showSearchEditModal, setShowSearchEditModal] = useState(false)
  const [invSearchTerm, setInvSearchTerm] = useState('')
  const [editValues, setEditValues] = useState({})
  const [productNotFoundCode, setProductNotFoundCode] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  // Estados para temporizador y modos de escaneo
  const [tiempoTranscurrido, setTiempoTranscurrido] = useState(0)
  const sesionTimerRef = useRef(null)
  const timerIniciadoRef = useRef(false)
  const [isQuickScanMode, setIsQuickScanMode] = useState(false)
  const [quickScanProduct, setQuickScanProduct] = useState(null)
  const [multipleProductsModal, setMultipleProductsModal] = useState(false)
  const [pendingProducts, setPendingProducts] = useState([])
  const [lastScannedTime, setLastScannedTime] = useState(0)
  const [lastScannedProduct, setLastScannedProduct] = useState(null)
  // Estados para atajos de teclado
  const [shortcutsActive, setShortcutsActive] = useState(false)
  const [activeSection, setActiveSection] = useState(null) // 'financiera' | 'inventario' | null
  const [showReportModal, setShowReportModal] = useState(false)

  // Mapeo de atajos de teclado
  const shortcutsMap = {
    financiera: {
      'F1': () => openFinancialModal('ventas'),
      'F2': () => openFinancialModal('gastos'),
      'F3': () => openFinancialModal('cuentasPorCobrar'),
      'F4': () => openFinancialModal('cuentasPorPagar'),
      'F5': () => openFinancialModal('efectivo'),
      'F6': () => openFinancialModal('deudaANegocio'),
      'F7': () => openFinancialModal('activosFijos'),
      'F8': () => openFinancialModal('capital'),
    },
    inventario: {
      'F1': () => {
        // Atajo F1 removido para impresión directa según requerimiento
        toast.info('Usa el botón Configuración para imprimir');
      },
      'F2': () => setShowReportModal(true),
      'F3': () => openFinancialModal('configuracion'),
    },
    global: {
      'F9': () => {
        if (productosContados.length === 0) {
          toast.error('Agrega al menos un producto para guardar')
          return
        }
        const zeroCost = productosContados.filter(p => (Number(p.costoProducto) || 0) === 0)
        if (zeroCost.length > 0) {
          const initial = {}
          zeroCost.forEach(p => { initial[p.producto] = 0 })
          setZeroCostEdits(initial)
          setShowZeroCostModal(true)
          return
        }
        completeMutation.mutate()
      },
      'F10': () => {
        // Mostrar opciones de salir en lugar de salir directamente
        setShowExitDropdown(true)
      },
      'F11': () => setShowMenuModal(!showMenuModal),
      'Escape': () => {
        if (selectedProducto) {
          setSelectedProducto(null)
          setNombreBusqueda('')
          setCantidad('')
          setCosto('')
          toast.success('Producto quitado')
        } else if (activeModal) {
          closeFinancialModal()
        } else if (showSearchModal) {
          setShowSearchModal(false)
        }
      }
    }
  }

  // Manejar atajos de teclado
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignorar si está escribiendo en un input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        // Permitir ESC siempre
        if (e.key === 'Escape') {
          const handler = shortcutsMap.global['Escape']
          if (handler) {
            e.preventDefault()
            handler()
          }
        }
        return
      }

      const key = e.key
      const keyName = key.startsWith('F') ? key : key === 'Escape' ? 'Escape' : null

      if (!keyName) return

      // Verificar atajos globales primero
      if (shortcutsMap.global[keyName]) {
        e.preventDefault()
        shortcutsMap.global[keyName]()
        return
      }

      // Verificar atajos de sección activa
      if (activeSection && shortcutsMap[activeSection] && shortcutsMap[activeSection][keyName]) {
        e.preventDefault()
        shortcutsMap[activeSection][keyName]()
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeSection, selectedProducto, activeModal, showSearchModal, showMenuModal])
  // Estado para datos de nuevos productos
  const [newProductData, setNewProductData] = useState({
    nombre: '',
    codigoBarras: '',
    categoria: 'General',
    unidad: 'unidad',
    costoBase: 0,
    descripcion: '',
    proveedor: '',
    notas: '',
    tipoContenedor: 'ninguno',
    tieneUnidadesInternas: false,
    unidadesInternas: {
      cantidad: 0,
      codigoBarras: '',
      nombre: '',
      costoPorUnidad: 0
    },
    tipoPeso: 'ninguno'
  })

  // Estados para datos financieros
  const [datosFinancieros, setDatosFinancieros] = useState({
    ventasDelMes: 0,
    gastosGenerales: [],
    cuentasPorCobrar: [],
    cuentasPorPagar: [],
    efectivoEnCajaYBanco: [],
    deudaANegocio: [],
    activosFijos: 0
  })
  const [showFinancialModal, setShowFinancialModal] = useState(false)
  const [editingField, setEditingField] = useState(null)
  const [modoMultipleGastos, setModoMultipleGastos] = useState(false)
  const [gastosDetalle, setGastosDetalle] = useState([])

  // Estados para distribución de saldo
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

  // Estados para datos del contador
  const [contadorData, setContadorData] = useState({
    costoServicio: 0,
    fechaInventario: new Date().toISOString().split('T')[0],
    periodicidad: 'mensual',
    proximaFecha: '',
    notasAdicionales: ''
  })

  // Estados para descarga/impresión
  const [downloadData, setDownloadData] = useState({
    formato: 'PDF',
    tipoDocumento: 'completo',
    incluirPrecios: true,
    incluirTotales: true,
    incluirBalance: true,
    fechaPersonalizada: false,
    fechaDocumento: new Date().toISOString().split('T')[0]
  })

  // Estados para gestión de empleados
  const [empleadosData, setEmpleadosData] = useState({
    empleados: [],
    incluirEnReporte: true  // Por defecto se incluye en el reporte
  })

  // Estado para controlar las pestañas del modal de configuración
  const [activeConfigTab, setActiveConfigTab] = useState('general')

  // Cargar colaboradores conectados y sus productos offline
  useEffect(() => {
    if (id) {
      cargarColaboradoresConectados()
      cargarInvitaciones()

      const interval = setInterval(() => {
        cargarColaboradoresConectados()
        cargarInvitaciones()
      }, 30000) // Aumentado de 10s a 30s para reducir solicitudes

      return () => clearInterval(interval)
    }
  }, [id])

  const cargarInvitaciones = async () => {
    // Verificar si hay token antes de hacer la llamada
    const token = localStorage.getItem('accessToken')
    if (!token) {
      return // No hacer la llamada si no hay token
    }

    try {
      const response = await invitacionesApi.listMine()
      setInvitaciones(response.data?.datos || [])
    } catch (error) {
      // Solo mostrar error si no es 401 (no autenticado)
      if (error.response?.status !== 401) {
        console.error('Error al cargar invitaciones:', error)
      }
      // Silenciar errores 401 (no autenticado)
    }
  }

  const cargarColaboradoresConectados = async () => {
    // Verificar si hay token antes de hacer la llamada
    const token = localStorage.getItem('accessToken')
    if (!token) {
      return // No hacer la llamada si no hay token
    }

    try {
      const response = await solicitudesConexionApi.listarConectados(id)
      const colaboradores = response.data?.datos || []
      setColaboradoresConectados(colaboradores)

      // Cargar productos offline de cada colaborador
      const productosPorColaborador = {}
      let totalPendientes = 0

      for (const colab of colaboradores) {
        try {
          // Asegurar extracción correcta del ID del colaborador (inconsistencia SQLite vs backend)
          const colabId = colab.id || colab._id || (colab.colaborador && (colab.colaborador.id || colab.colaborador._id))

          if (!colabId) {
            console.error('⚠️ [SYNC] No se pudo obtener el ID del colaborador:', colab)
            continue
          }

          const prodResponse = await solicitudesConexionApi.obtenerProductosOffline(colabId)
          const productosOffline = prodResponse.data?.datos || []
          if (productosOffline.length > 0) {
            const productosTransformados = productosOffline
              .filter(p => !p.sincronizado)
              .map(p => ({
                temporalId: p.id || p._id,
                productoData: {
                  nombre: p.nombre || 'Sin nombre',
                  cantidad: p.cantidad || 1,
                  costo: Number(p.costo || 0),
                  unidad: p.unidad || 'unidad',
                  categoria: p.categoria || 'General',
                  sku: p.sku || '',
                  codigoBarras: p.sku || p.codigoBarras || ''
                }
              }))
            if (productosTransformados.length > 0) {
              productosPorColaborador[colabId] = productosTransformados
              totalPendientes += productosTransformados.length
            }
          }
        } catch (error) {
          if (error.response?.status !== 401) {
            console.error(`Error al cargar productos del colaborador:`, error)
          }
        }
      }

      setProductosColaboradorPendientes(productosPorColaborador)

      // Mostrar notificación si hay productos pendientes
      if (totalPendientes > 0) {
        toast(`${totalPendientes} producto(s) pendiente(s) de revisión`, {
          icon: '🔔',
          duration: 5000,
        })
      }
    } catch (error) {
      // Solo mostrar error si no es 401 (no autenticado)
      if (error.response?.status !== 401) {
        console.error('Error al cargar colaboradores:', error)
      }
      // Silenciar errores 401 (no autenticado)
    }
  }

  // Obtener sesión de inventario desde la API
  const { data: sesion, isLoading, refetch } = useQuery(
    ['sesion-inventario', id],
    () => sesionesApi.getById(id).then((res) => {
      // Backend SQLite devuelve: { exito: true, datos: sesion }
      const sesionData = res.data.datos || res.data.sesion || res.data
      console.log('📦 Sesión recibida:', sesionData)
      console.log('📦 Timer datos:', {
        timerEnMarcha: sesionData?.timerEnMarcha,
        timerAcumuladoSegundos: sesionData?.timerAcumuladoSegundos,
        timerUltimoInicio: sesionData?.timerUltimoInicio
      })
      console.log('📦 clienteNegocio:', sesionData?.clienteNegocio)
      console.log('📦 clienteNegocioId:', sesionData?.clienteNegocioId)
      return sesionData
    }),
    {
      enabled: Boolean(id),
      onError: handleApiError,
      refetchInterval: false, // Desactivar auto-refetch para evitar 429
      onSuccess: (data) => {
        // Log para depuración - ver qué datos vienen del backend
        console.log('📥 [CARGA] Datos financieros del backend:', JSON.stringify(data?.datosFinancieros, null, 2))

        if (data?.datosFinancieros) {
          const df = data.datosFinancieros
          const nuevosDatosFinancieros = {
            ventasDelMes: df.ventasDelMes || 0,
            // Priorizar campos de detalle si existen, sino usar arrays o valores únicos
            gastosGenerales: Array.isArray(df.gastosGeneralesDetalle)
              ? df.gastosGeneralesDetalle
              : Array.isArray(df.gastosGenerales)
                ? df.gastosGenerales
                : (df.gastosGenerales ? [{ monto: df.gastosGenerales, descripcion: 'Gastos generales', categoria: 'Otros', nombre: `Gasto: ${formatearMoneda(df.gastosGenerales)}` }] : []),
            cuentasPorCobrar: Array.isArray(df.cuentasPorCobrarDetalle)
              ? df.cuentasPorCobrarDetalle
              : Array.isArray(df.cuentasPorCobrar)
                ? df.cuentasPorCobrar
                : (df.cuentasPorCobrar ? [{ monto: df.cuentasPorCobrar, descripcion: 'Cuenta por cobrar', cliente: 'Cliente', nombre: `Cobro: ${formatearMoneda(df.cuentasPorCobrar)}` }] : []),
            cuentasPorPagar: Array.isArray(df.cuentasPorPagarDetalle)
              ? df.cuentasPorPagarDetalle
              : Array.isArray(df.cuentasPorPagar)
                ? df.cuentasPorPagar
                : (df.cuentasPorPagar ? [{ monto: df.cuentasPorPagar, descripcion: 'Cuenta por pagar', proveedor: 'Proveedor', nombre: `Pago: ${formatearMoneda(df.cuentasPorPagar)}` }] : []),
            efectivoEnCajaYBanco: Array.isArray(df.efectivoEnCajaYBancoDetalle)
              ? df.efectivoEnCajaYBancoDetalle
              : Array.isArray(df.efectivoEnCajaYBanco)
                ? df.efectivoEnCajaYBanco
                : (df.efectivoEnCajaYBanco ? [{ monto: df.efectivoEnCajaYBanco, descripcion: 'Efectivo en caja', tipoCuenta: 'Caja', nombre: `Caja: ${formatearMoneda(df.efectivoEnCajaYBanco)}` }] : []),
            deudaANegocio: Array.isArray(df.deudaANegocioDetalle)
              ? df.deudaANegocioDetalle
              : Array.isArray(df.deudaANegocio)
                ? df.deudaANegocio
                : (df.deudaANegocio ? [{ monto: df.deudaANegocio, descripcion: 'Deuda de socio', deudor: 'Socio', nombre: `Deuda: ${formatearMoneda(df.deudaANegocio)}` }] : []),
            activosFijos: df.activosFijos || 0,
            capitalAnterior: df.capitalAnterior || 0
          }

          console.log('📥 [CARGA] Datos financieros procesados:', JSON.stringify(nuevosDatosFinancieros, null, 2))
          setDatosFinancieros(nuevosDatosFinancieros)
        }
      }
    }
  )

  const updateProductBulkMutation = useMutation(
    ({ productoId, data }) => sesionesApi.updateProduct(id, productoId, data),
    {
      onSuccess: () => {
        refetch()
        toast.success('Producto actualizado')
      },
      onError: handleApiError
    }
  )

  // Temporizador basado en cronómetro del backend
  useEffect(() => {
    if (!sesion) return
    
    // Actualizar la ref con los datos actuales de la sesión
    sesionTimerRef.current = sesion
    
    console.log('⏱️ Timer useEffect - sesion actualizada:', {
      timerEnMarcha: sesion?.timerEnMarcha,
      timerAcumuladoSegundos: sesion?.timerAcumuladoSegundos,
      timerUltimoInicio: sesion?.timerUltimoInicio
    })
    
    const tick = () => {
      const s = sesionTimerRef.current
      if (!s) return
      
      const acumulado = Math.max(0, Number(s.timerAcumuladoSegundos || 0))
      const enMarcha = Boolean(s.timerEnMarcha)
      let ultimoInicio = 0
      
      // Validar y parsear la fecha de inicio
      if (s.timerUltimoInicio) {
        // Convertir formato SQLite 'YYYY-MM-DD HH:MM:SS' a ISO UTC 'YYYY-MM-DDTHH:MM:SSZ'
        let fechaStr = s.timerUltimoInicio
        if (fechaStr.includes(' ')) {
          fechaStr = fechaStr.replace(' ', 'T')
        }
        // Agregar 'Z' para indicar que es UTC (SQLite CURRENT_TIMESTAMP es UTC)
        if (!fechaStr.endsWith('Z')) {
          fechaStr = fechaStr + 'Z'
        }
        const fechaInicio = new Date(fechaStr)
        if (!isNaN(fechaInicio.getTime())) {
          ultimoInicio = fechaInicio.getTime()
        }
      }
      
      let segundos = acumulado
      if (enMarcha && ultimoInicio > 0) {
        const ahora = Date.now()
        const diferencia = Math.floor((ahora - ultimoInicio) / 1000)
        console.log('⏱️ Tick - diferencia:', diferencia, 'ultimoInicio:', ultimoInicio, 'ahora:', ahora)
        // Solo sumar si la diferencia es positiva (evitar problemas de reloj desincronizado)
        if (diferencia > 0) {
          segundos += diferencia
        }
      }
      
      // Asegurar que nunca sea negativo
      segundos = Math.max(0, segundos)
      setTiempoTranscurrido(segundos)
    }
    
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [sesion, sesion?.timerEnMarcha, sesion?.timerUltimoInicio, sesion?.timerAcumuladoSegundos])

  // Función para formatear tiempo en HH:MM:SS
  const formatearTiempo = (segundos) => {
    // Asegurar que sea un número válido y no negativo
    const segs = Math.max(0, Math.floor(Number(segundos) || 0))
    const horas = Math.floor(segs / 3600)
    const minutos = Math.floor((segs % 3600) / 60)
    const segundosFinal = segs % 60
    return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}:${String(segundosFinal).padStart(2, '0')}`
  }

  // Mutaciones para agregar productos
  const addProductMutation = useMutation(
    async (data) => {
      // Verificar si es el primer producto ANTES de agregarlo
      const esElPrimerProducto = productosContados.length === 0 && !sesion?.timerEnMarcha
      
      console.log('🔍 Verificando primer producto:', {
        productosContadosLength: productosContados.length,
        timerEnMarcha: sesion?.timerEnMarcha,
        esElPrimerProducto
      })

      // Agregar el producto
      const resultado = await sesionesApi.addProduct(id, data)

      // Iniciar reloj inmediatamente si es el primer producto
      if (esElPrimerProducto) {
        try {
          console.log('⏱️ Iniciando timer...')
          const timerResponse = await sesionesApi.resumeTimer(id)
          console.log('✅ Respuesta resumeTimer:', timerResponse?.data)
          console.log('✅ Reloj iniciado con el primer producto')
        } catch (error) {
          console.error('Error al iniciar reloj:', error)
        }
      }

      await refetch()
      return resultado
    },
    {
      onSuccess: async () => {
        // Invalidar queries y refrescar datos
        queryClient.invalidateQueries(['sesion-inventario', id])
        await refetch()
        queryClient.refetchQueries(['sesion-inventario', id])
        toast.success('Producto agregado')
        setSelectedProducto(null)
        setCantidad('')
        setCosto('')
        setCodigoBarras('')
        setNombreBusqueda('')
        setSearchResults([])
        setIsQuickScanMode(false)
        setQuickScanProduct(null)
        setLastScannedTime(0)
        setLastScannedProduct(null)
        searchInputRef.current?.focus()
      },
      onError: (error) => {
        console.error('❌ Error agregando producto:', error)
        console.error('❌ Detalles del error:', error.response?.data)
        console.error('❌ Datos enviados:', error.config?.data)

        // Mensaje de error más específico
        if (error.response?.status === 400) {
          const mensaje = error.response?.data?.mensaje || 'Error al agregar producto'
          toast.error(mensaje)
        } else if (error.response?.status === 404) {
          toast.error('Sesión o producto no encontrado')
        } else {
          handleApiError(error)
        }
      }
    }
  )

  const removeProductMutation = useMutation(
    (productoId) => sesionesApi.removeProduct(id, productoId),
    {
      onSuccess: () => {
        refetch() // Refrescar datos de la sesión
        toast.success('Producto removido')
      },
      onError: handleApiError
    }
  )

  const updateFinancialMutation = useMutation(
    (data) => sesionesApi.updateFinancial(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['sesion-inventario', id])
        toast.success('Datos financieros actualizados')
      },
      onError: handleApiError
    }
  )

  const completeMutation = useMutation(
    () => sesionesApi.complete(id),
    {
      onSuccess: () => {
        toast.success('Sesión completada')
        navigate('/inventarios')
      },
      onError: handleApiError
    }
  )

  const cancelMutation = useMutation(
    () => sesionesApi.cancel(id),
    {
      onSuccess: () => {
        toast.success('Sesión cancelada')
        navigate('/inventarios')
      },
      onError: handleApiError
    }
  )

  // Función para generar código QR de invitación para colaboradores
  const handleGenerarQR = async () => {
    setGenerandoQR(true)
    try {
      // Generar invitación por defecto (Colaborador, 24h)
      const response = await invitacionesApi.createQR({
        rol: 'colaborador',
        nombre: nombreColaborador || 'Nuevo Colaborador',
        expiraEnMinutos: 1440
      })

      setQrInvitacion(response.data?.datos)
      toast.success('Invitación generada')
      cargarInvitaciones() // Recargar lista
      setNombreColaborador('')
    } catch (error) {
      console.error('Error generando QR:', error)
      toast.error('Error al generar invitación')
    } finally {
      setGenerandoQR(false)
    }
  }

  // Función para descargar el QR
  const handleDescargarQR = () => {
    if (!qrInvitacion?.qrDataUrl) return

    const link = document.createElement('a')
    link.href = qrInvitacion.qrDataUrl
    link.download = `qr-colaborador-${nombreColaborador || 'invitacion'}-${Date.now()}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('QR descargado exitosamente')
  }

  // Función para generar nuevo QR (resetear)
  const handleNuevoQR = () => {
    setQrInvitacion(null)
    setNombreColaborador('')
  }

  // Función para cerrar modal de conectar
  const handleCerrarModalConectar = () => {
    setShowConnectModal(false)
    setQrInvitacion(null)
    setNombreColaborador('')
  }

  // Función para abrir modal de revisión de productos de un colaborador
  const handleAbrirRevisarProductos = (colaborador) => {
    const productos = productosColaboradorPendientes[colaborador._id] || []
    setColaboradorSeleccionado(colaborador)
    setProductosParaRevisar(productos)

    // Inicializar cantidades editadas con los valores correctos del backend
    const cantidades = {}
    productos.forEach(p => {
      // Asegurar que la cantidad sea numérica y use el valor del backend
      const cantidadBackend = Number(p.productoData?.cantidad) || 1
      cantidades[p.temporalId] = cantidadBackend > 0 ? cantidadBackend : 1
    })
    setCantidadesEditadas(cantidades)

    setShowRevisarProductosModal(true)
  }

  // Función para mostrar QR de un colaborador conectado
  const handleMostrarQRColaborador = async (colaborador) => {
    try {
      setCargandoQR(true)
      const invitacionId = colaborador.colaborador?.invitacionId?._id

      if (!invitacionId) {
        toast.error('No se encontró la invitación del colaborador')
        return
      }

      const response = await invitacionesApi.getQR(invitacionId)

      if (response.data && response.data.datos) {
        setQrColaboradorData(response.data.datos)
        setColaboradorSeleccionado(colaborador)
        setShowQRColaboradorModal(true)
      }
    } catch (error) {
      console.error('Error al obtener QR:', error)
      toast.error('Error al obtener el código QR del colaborador')
    } finally {
      setCargandoQR(false)
    }
  }

  // Función para obtener y mostrar el QR de una invitación específica
  const handleVerQRInvitacion = async (invitacion) => {
    try {
      setCargandoQR(true)
      const response = await invitacionesApi.getQR(invitacion.uuid || invitacion.id || invitacion._id)
      
      if (response.data && response.data.datos) {
        setQrColaboradorData(response.data.datos)
        // Simulamos un objeto colaborador mínimo para el visor de QR
        setColaboradorSeleccionado({
          nombreColaborador: invitacion.nombre || 'Invitación',
          colaborador: { nombre: invitacion.nombre || 'Colaborador' }
        })
        setShowQRColaboradorModal(true)
      }
    } catch (error) {
      console.error('Error al obtener QR de invitación:', error)
      toast.error('No se pudo cargar el código QR')
    } finally {
      setCargandoQR(false)
    }
  }

  // Función para cerrar modal de QR de colaborador
  const handleCerrarQRColaborador = () => {
    setShowQRColaboradorModal(false)
    setQrColaboradorData(null)
    setColaboradorSeleccionado(null)
  }

  // Función para descargar QR de colaborador
  const handleDescargarQRColaborador = () => {
    if (!qrColaboradorData?.qrDataUrl) return

    const link = document.createElement('a')
    link.href = qrColaboradorData.qrDataUrl
    const nombreColab = colaboradorSeleccionado?.colaborador?.nombre || 'colaborador'
    link.download = `qr-${nombreColab}-${Date.now()}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('QR descargado exitosamente')
  }

  // Función para aceptar y sincronizar productos del colaborador (REFACTORIZADA - Batch Sync)
  const handleAceptarProductos = async (productosSeleccionados) => {
    if (!colaboradorSeleccionado || !productosSeleccionados?.length) return

    const toastId = toast.loading(`Sincronizando ${productosSeleccionados.length} producto(s)...`)

    try {
      // Construir el payload aplicando las cantidades editadas por el usuario
      const productosConCantidadEditada = productosSeleccionados
        .filter(p => p && p.productoData)
        .map(productoOffline => ({
          temporalId: productoOffline.temporalId,
          productoData: {
            ...productoOffline.productoData,
            // Usar la cantidad que el usuario haya editado en el modal
            cantidad: cantidadesEditadas[productoOffline.temporalId] ?? productoOffline.productoData.cantidad ?? 1
          }
        }))

      // Obtener el ID de la solicitud (puede ser _id numérico o UUID)
      const solicitudId = colaboradorSeleccionado._id || colaboradorSeleccionado.id || colaboradorSeleccionado.uuid

      if (!solicitudId) {
        toast.error('No se pudo identificar la solicitud del colaborador', { id: toastId })
        return
      }

      if (!id) {
        toast.error('No se pudo identificar la sesión de inventario', { id: toastId })
        return
      }

      // Iniciar reloj si es el primer producto y el timer no está en marcha
      if (productosContados.length === 0 && !sesion?.timerEnMarcha) {
        try {
          await sesionesApi.resumeTimer(id)
        } catch (timerErr) {
          console.warn('No se pudo iniciar el timer:', timerErr.message)
        }
      }

      // ─── LLAMADA ÚNICA AL BACKEND (batch sync) ───────────────────────────────
      const response = await solicitudesConexionApi.batchSyncProductos(solicitudId, {
        sesionInventarioId: id,
        productos: productosConCantidadEditada
      })
      // ────────────────────────────────────────────────────────────────────────

      const { count = productosConCantidadEditada.length } = response.data

      toast.success(`✅ ${count} producto(s) sincronizados exitosamente`, { id: toastId })

      // Refrescar datos de la sesión
      queryClient.invalidateQueries(['sesion-inventario', id])
      await refetch()

      // Cerrar modal y limpiar estado
      setShowRevisarProductosModal(false)
      setColaboradorSeleccionado(null)
      setProductosParaRevisar([])
      setCantidadesEditadas({})

      // Recargar colaboradores para actualizar estado de productos pendientes
      await cargarColaboradoresConectados()

    } catch (error) {
      console.error('❌ Error en batch sync de productos:', error)
      const mensaje = error.response?.data?.mensaje || error.message || 'Error al sincronizar productos'
      toast.error(`Error: ${mensaje}`, { id: toastId })
    }
  }

  // Función para sincronizar productos de un colaborador por lotes
  const handleSincronizarColaborador = async (colaboradorId) => {
    try {
      const toastId = toast.loading('Iniciando sincronización...')

      // 1. Obtener productos pendientes
      const response = await solicitudesConexionApi.obtenerProductosOffline(colaboradorId)
      const productosOffline = response.data?.datos || []

      if (productosOffline.length === 0) {
        toast.dismiss(toastId)
        toast.success('No hay productos pendientes')
        return
      }

      // Iniciar reloj si es el primer producto
      if (productosContados.length === 0 && !sesion?.timerEnMarcha) {
        try {
          await sesionesApi.resumeTimer(id)
          console.log('✅ Reloj iniciado en sincronización por lotes')
          await refetch()
        } catch (error) {
          console.error('Error al iniciar reloj:', error)
        }
      }

      // 2. Procesar en lotes de 20
      const BATCH_SIZE = 20
      const totalBatches = Math.ceil(productosOffline.length / BATCH_SIZE)

      for (let i = 0; i < totalBatches; i++) {
        const start = i * BATCH_SIZE
        const end = start + BATCH_SIZE
        const batch = productosOffline.slice(start, end)

        toast.loading(`Sincronizando lote ${i + 1} de ${totalBatches}...`, { id: toastId })

        // Procesar cada producto del lote
        for (const item of batch) {
          const productoData = item.productoData

          // Lógica similar a handleAceptarProductos pero simplificada para auto-aceptación
          // Buscar si existe
          const productoExistente = productosContados.find(p =>
            p.nombreProducto?.toLowerCase().trim() === productoData.nombre?.toLowerCase().trim()
          )

          if (productoExistente) {
            const productoIdToUpdate = productoExistente.productoId || productoExistente.id || productoExistente._id
            if (!productoIdToUpdate) {
              throw new Error('No se pudo obtener el ID del producto contado')
            }
            await sesionesApi.updateProduct(id, productoIdToUpdate, {
              cantidadContada: (productoExistente.cantidadContada || 0) + Number(productoData.cantidad || 1),
              costoProducto: Number(productoData.costo) || 0
            })
          } else {
            // Crear/Buscar y agregar
            let productoClienteId
            try {
              const busqueda = await productosApi.buscarPorNombre(productoData.nombre)
              const encontrado = busqueda.data?.datos?.productos?.[0]
              if (encontrado) productoClienteId = encontrado._id
            } catch (e) { }

            if (!productoClienteId) {
              const nuevo = await productosApi.createForCliente(obtenerClienteId(sesion), {
                nombre: productoData.nombre,
                costo: Number(productoData.costo) || 0,
                unidad: 'unidad',
                sku: productoData.sku || ''
              })
              // El backend devuelve el producto directamente en datos, con campo id (no _id)
              productoClienteId = nuevo.data?.datos?.id || nuevo.data?.datos?._id
            }

            if (productoClienteId) {
              await sesionesApi.addProduct(id, {
                productoClienteId: productoClienteId,
                cantidadContada: Number(productoData.cantidad || 1),
                costoProducto: Number(productoData.costo) || 0
              })
            }
          }
        }

        // Marcar lote como sincronizado
        const temporalIds = batch.map(p => p.temporalId)
        await solicitudesConexionApi.sincronizar(colaboradorId, temporalIds)
      }

      toast.success('Sincronización completada exitosamente', { id: toastId })

      // Recargar datos
      await refetch()
      const respColabs = await solicitudesConexionApi.listarConectados(id)
      setColaboradoresConectados(respColabs.data?.datos || [])

    } catch (error) {
      console.error('Error en sincronización por lotes:', error)
      toast.error('Error al sincronizar productos')
    }
  }

  // Función para rechazar productos del colaborador
  const handleRechazarProductos = async (productosRechazados) => {
    if (!colaboradorSeleccionado || !productosRechazados?.length) return

    const toastId = toast.loading('Rechazando productos...')
    try {
      const temporalIds = productosRechazados.map(p => p.temporalId)
      // Usar ID robusto (soporta numérico y UUID)
      const solicitudId = colaboradorSeleccionado._id || colaboradorSeleccionado.id || colaboradorSeleccionado.uuid
      await solicitudesConexionApi.sincronizar(solicitudId, temporalIds)

      toast.success(`${productosRechazados.length} producto(s) rechazado(s)`, { id: toastId })

      // Cerrar modal y limpiar estado
      setShowRevisarProductosModal(false)
      setColaboradorSeleccionado(null)
      setProductosParaRevisar([])
      setCantidadesEditadas({})

      // Recargar colaboradores
      await cargarColaboradoresConectados()
    } catch (error) {
      console.error('Error al rechazar productos:', error)
      toast.error('Error al procesar rechazo', { id: toastId })
    }
  }

  // Efecto para abrir modal múltiple automáticamente cuando haya productos pendientes
  useEffect(() => {
    if (pendingProducts.length > 0) {
      // Abrir modal múltiple después de un breve delay para permitir más escaneos
      const timer = setTimeout(() => {
        if (pendingProducts.length > 0) {
          setMultipleProductsModal(true)
        }
      }, 1500) // 1.5 segundos para permitir más escaneos

      return () => clearTimeout(timer)
    }
  }, [pendingProducts])

  // Buscar por código de barras
  useEffect(() => {
    const searchByBarcode = async () => {
      if (codigoBarras.length < 3) return

      setIsSearching(true)
      try {
        // Buscar directamente en productos generales
        console.log('🔍 Buscando por código de barras:', codigoBarras)
        const generalResponse = await productosApi.buscarPorCodigoBarras(codigoBarras)
        console.log('✅ Respuesta búsqueda código:', generalResponse.data)

        // Backend SQLite devuelve: { exito: true, datos: producto } o { exito: true, datos: { producto } }
        let productoGeneral = generalResponse.data?.datos

        // Si datos es un objeto con propiedad producto, extraerlo
        if (productoGeneral && productoGeneral.producto) {
          productoGeneral = productoGeneral.producto
        }

        // Asegurar que tenga _id para compatibilidad
        if (productoGeneral && !productoGeneral._id && productoGeneral.id) {
          productoGeneral._id = productoGeneral.id
        }

        if (productoGeneral) {
          const now = Date.now()

          // Verificar si es escaneo rápido del mismo producto
          const isQuickScan = lastScannedProduct &&
            lastScannedProduct.nombre === productoGeneral.nombre &&
            (now - lastScannedTime) < 2000 // 2 segundos

          if (isQuickScan) {
            // Escaneo rápido: usar como cantidad
            console.log('🔄 Escaneo rápido detectado, estableciendo cantidad:', codigoBarras)
            setCantidad(codigoBarras)
            setCodigoBarras('')
            setIsQuickScanMode(true)
            setQuickScanProduct(productoGeneral)

            // Enfocar automáticamente el campo de costo
            setTimeout(() => costoInputRef.current?.focus(), 100)

            toast.success(`Cantidad rápida: ${codigoBarras}`)
          } else {
            // Verificar si hay productos pendientes recientes
            const hasRecentPendingProducts = pendingProducts.length > 0 &&
              (now - lastScannedTime) < 3000 // 3 segundos para productos múltiples

            if (hasRecentPendingProducts) {
              // Agregar a productos pendientes para mostrar en modal múltiple
              console.log('📦 Agregando producto a lista pendiente:', productoGeneral.nombre)
              setPendingProducts(prev => [...prev, {
                producto: productoGeneral,
                cantidad: '1',
                costo: productoGeneral.costoBase || productoGeneral.costo || '',
                id: Date.now() + Math.random()
              }])
              setCodigoBarras('')
              toast.info(`Producto agregado a lista: ${productoGeneral.nombre}`)
            } else {
              // Primer escaneo o producto diferente: seleccionar producto normalmente
              console.log('📱 Primer escaneo, seleccionando producto:', productoGeneral.nombre)
              handleSelectProduct(productoGeneral)
              setLastScannedTime(now)
              setLastScannedProduct(productoGeneral)
              setIsQuickScanMode(false)
              setQuickScanProduct(null)
            }
          }
        } else {
          // Producto no encontrado
          setProductNotFoundCode(codigoBarras)
          setShowProductNotFoundModal(true)
        }
      } catch (error) {
        if (error.response?.status === 404) {
          // Producto no encontrado
          setProductNotFoundCode(codigoBarras)
          setShowProductNotFoundModal(true)
        } else {
          console.error('Error buscando por código:', error)
          toast.error('Error al buscar producto')
        }
      } finally {
        setIsSearching(false)
      }
    }

    const debounce = setTimeout(searchByBarcode, 800)
    return () => clearTimeout(debounce)
  }, [codigoBarras, lastScannedProduct, lastScannedTime, pendingProducts])

  // Cargar productos generales cuando se abre el modal (sin búsqueda o con menos de 3 caracteres)
  useEffect(() => {
    const loadGeneralProducts = async () => {
      if (!showSearchModal) return

      // Si hay búsqueda con 3 o más caracteres, no cargar productos generales aquí
      if (nombreBusqueda.length >= 3) return

      setIsSearching(true)
      try {
        // Cargar productos generales sin filtro de búsqueda
        const generalesResponse = await productosApi.getAllGenerales({
          limite: 20,
          pagina: 1,
          soloActivos: true
        })

        // Backend SQLite devuelve: { exito: true, datos: { productos: [...], paginacion: {...} } }
        const productosGenerales = generalesResponse.data?.datos?.productos ||
          generalesResponse.data?.productos ||
          []

        setSearchResults(productosGenerales)
      } catch (error) {
        console.error('Error cargando productos generales:', error)
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }

    loadGeneralProducts()
  }, [showSearchModal])

  // Buscar por nombre (modal) - cuando hay 3 o más caracteres
  useEffect(() => {
    const searchByName = async () => {
      if (!showSearchModal || nombreBusqueda.length < 3) {
        if (showSearchModal && nombreBusqueda.length < 3 && nombreBusqueda.length > 0) {
          // Si hay texto pero menos de 3 caracteres, mantener productos generales
          return
        }
        return
      }

      setIsSearching(true)
      try {
        // Buscar en productos generales con las primeras 3 letras
        const searchTerm = nombreBusqueda.trim().substring(0, 3)
        console.log('🔍 Buscando por nombre (primeras 3 letras):', searchTerm)

        const generalesResponse = await productosApi.getAllGenerales({
          buscar: searchTerm,
          limite: 20,
          pagina: 1,
          soloActivos: true
        })

        // Backend SQLite devuelve: { exito: true, datos: { productos: [...], paginacion: {...} } }
        const productosGenerales = generalesResponse.data?.datos?.productos ||
          generalesResponse.data?.productos ||
          []

        // Filtrar productos que empiecen con las primeras 3 letras (case insensitive)
        const productosFiltrados = productosGenerales.filter(producto => {
          const nombreProducto = (producto.nombre || '').toLowerCase()
          const busqueda = nombreBusqueda.trim().toLowerCase()
          return nombreProducto.startsWith(busqueda.substring(0, 3))
        })

        // También buscar en productos del cliente para productos ya agregados
        let productosCliente = []
        const clienteId = obtenerClienteId(sesion)
        if (clienteId) {
          try {
            const clienteResponse = await productosApi.getByCliente(clienteId, {
              buscar: searchTerm,
              limite: 10,
              pagina: 1,
              soloActivos: true
            })

            // Backend SQLite devuelve: { exito: true, datos: { productos: [...], paginacion: {...} } }
            productosCliente = clienteResponse.data?.datos?.productos ||
              clienteResponse.data?.productos ||
              []

            // Filtrar también productos del cliente
            const productosClienteFiltrados = productosCliente.filter(producto => {
              const nombreProducto = (producto.nombre || '').toLowerCase()
              const busqueda = nombreBusqueda.trim().toLowerCase()
              return nombreProducto.startsWith(busqueda.substring(0, 3))
            })
            productosCliente = productosClienteFiltrados
          } catch (clienteError) {
            // Si falla, solo usar productos generales
            console.log('No se pudieron cargar productos del cliente:', clienteError)
          }
        }

        // Combinar resultados, priorizando productos del cliente
        const todosProductos = [...productosCliente, ...productosFiltrados]
        // Eliminar duplicados por nombre o ID
        const productosUnicos = todosProductos.filter((producto, index, self) =>
          index === self.findIndex((p) =>
            (p.nombre === producto.nombre) ||
            (p.id !== undefined && p.id === producto.id) ||
            (p._id !== undefined && p._id === producto._id)
          )
        )

        // Asegurar que todos tengan un ID consistente para el frontend
        const productosProcesados = productosUnicos.map(p => ({
          ...p,
          _id: p.id || p._id || p.productoId // Asegurar un ID para la key de React
        }))

        setSearchResults(productosProcesados.slice(0, 20))
      } catch (error) {
        console.error('Error buscando productos:', error)
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }

    const debounce = setTimeout(searchByName, 300)
    return () => clearTimeout(debounce)
  }, [nombreBusqueda, showSearchModal, sesion?.clienteNegocio?.id, sesion?.clienteNegocio?._id, sesion?.clienteNegocioId])

  const handleSelectProduct = (producto) => {
    // Asegurar que tenemos un ID (SQLite id vs MongoDB _id)
    const prodId = producto.id || producto._id || producto.productoId
    if (!prodId) {
      console.error('❌ Error: El producto seleccionado no tiene ID', producto)
      toast.error('Error al seleccionar producto: ID faltante')
      return
    }

    setSelectedProducto({
      ...producto,
      _id: prodId // Usar _id internamente para compatibilidad con el resto de la lógica
    })

    // Usar costoBase para productos generales o costo para productos de cliente
    const costoProducto = producto.costoBase !== undefined ? producto.costoBase : producto.costo
    setCosto(costoProducto?.toString() || '')
    setCodigoBarras('')
    setNombreBusqueda('')
    setSearchResults([])
    setShowSearchModal(false)
    setTimeout(() => cantidadInputRef.current?.focus(), 100)
  }

  const handleOpenSearchModal = () => {
    // Si hay un producto seleccionado, limpiarlo primero
    if (selectedProducto) {
      setSelectedProducto(null)
      setNombreBusqueda('')
      setCantidad('')
      setCosto('')
    }
    setShowSearchModal(true)
    setNombreBusqueda('')
    setSearchResults([])
  }

  const handleAddProduct = async () => {
    if (!selectedProducto) {
      toast.error('Selecciona un producto')
      return
    }

    if (!cantidad || parseFloat(cantidad) <= 0) {
      toast.error('Ingresa una cantidad válida')
      cantidadInputRef.current?.focus()
      return
    }

    const costoFinal = parseFloat(costo || '0') || 0
    const cantidadNueva = parseFloat(cantidad)

    // Buscar producto existente por nombre (comparación exacta)
    const productoExistente = productosContados.find(p =>
      p.nombreProducto?.toLowerCase().trim() === selectedProducto.nombre?.toLowerCase().trim()
    )

    if (productoExistente) {
      // Si el producto ya existe, actualizar la cantidad sumando la nueva
      const nuevaCantidad = (productoExistente.cantidadContada || 0) + cantidadNueva

      console.log('🔄 Producto existente encontrado:', productoExistente.nombreProducto)
      console.log('📊 Cantidad actual:', productoExistente.cantidadContada)
      console.log('➕ Cantidad a sumar:', cantidadNueva)
      console.log('🎯 Nueva cantidad total:', nuevaCantidad)

      try {
        // Actualizar la cantidad del producto existente
        // Usar id o productoId (el backend ahora incluye ambos)
        const productoIdToUpdate = productoExistente.productoId || productoExistente.id || productoExistente._id
        if (!productoIdToUpdate) {
          throw new Error('No se pudo obtener el ID del producto contado')
        }

        console.log('🔄 Actualizando producto con ID:', productoIdToUpdate)
        await sesionesApi.updateProduct(id, productoIdToUpdate, {
          cantidadContada: nuevaCantidad,
          costoProducto: costoFinal // También actualizar el costo si es diferente
        })

        console.log('🔄 Refrescando datos de la sesión...')

        // Refrescar datos de la sesión inmediatamente
        await refetch()

        // Limpiar formulario
        setSelectedProducto(null)
        setCantidad('')
        setCosto('')
        setCodigoBarras('')
        setNombreBusqueda('')
        setSearchResults([])
        setIsQuickScanMode(false)
        setQuickScanProduct(null)
        setLastScannedTime(0)
        setLastScannedProduct(null)

        toast.success(`Cantidad actualizada: ${productoExistente.nombreProducto} (${nuevaCantidad} ${selectedProducto.unidad || 'unidades'})`)

        // Enfocar el input de búsqueda
        searchInputRef.current?.focus()

      } catch (error) {
        console.error('❌ Error actualizando cantidad del producto:', error)
        console.error('❌ Detalles del error:', error.response?.data)
        handleApiError(error)
      }

      return
    }

    // Si el producto no existe, proceder con la lógica normal de agregar
    console.log('➕ Agregando nuevo producto:', selectedProducto.nombre)

    // Verificar que la sesión esté cargada
    if (!sesion) {
      toast.error('Error: La sesión aún no está cargada. Por favor, espere un momento.')
      console.error('❌ Sesión no disponible')
      return
    }

    // Obtener ID del cliente usando helper
    const clienteId = obtenerClienteId(sesion)

    if (!clienteId) {
      toast.error('Error: No se pudo obtener el ID del cliente')
      console.error('❌ Sesión completa:', JSON.stringify(sesion, null, 2))
      console.error('❌ clienteNegocio:', sesion?.clienteNegocio)
      console.error('❌ clienteNegocioId:', sesion?.clienteNegocioId)
      console.error('❌ Estructura de sesion:', Object.keys(sesion || {}))

      // Intentar refrescar la sesión
      console.log('🔄 Intentando refrescar la sesión...')
      refetch()
      return
    }

    // Convertir clienteId a número entero
    const clienteIdNumero = parseInt(clienteId, 10)
    if (isNaN(clienteIdNumero) || clienteIdNumero <= 0) {
      toast.error(`Error: ID de cliente inválido: ${clienteId}`)
      return
    }

    // Si el producto es de ProductoGeneral, primero crear en ProductoCliente
    if (selectedProducto.costoBase !== undefined) {
      try {
        console.log('🔄 Creando producto cliente para cliente:', clienteIdNumero)
        console.log('📦 Datos del producto:', {
          nombre: selectedProducto.nombre,
          costo: costoFinal,
          unidad: selectedProducto.unidad
        })

        // Intentar crear producto en ProductoCliente
        const nuevoProductoCliente = await productosApi.createForCliente(clienteIdNumero, {
          nombre: selectedProducto.nombre,
          descripcion: selectedProducto.descripcion,
          costo: costoFinal,
          unidad: selectedProducto.unidad,
          categoria: selectedProducto.categoria,
          proveedor: selectedProducto.proveedor,
          sku: selectedProducto.codigoBarras || ''
        })

        console.log('✅ Respuesta crear producto cliente:', nuevoProductoCliente.data)

        // Backend SQLite devuelve: { exito: true, datos: producto }
        const productoClienteCreado = nuevoProductoCliente.data?.datos || nuevoProductoCliente.data?.producto || nuevoProductoCliente.data

        // Backend SQLite usa 'id' no '_id', asegurar compatibilidad
        const productoClienteId = productoClienteCreado?.id || productoClienteCreado?._id

        console.log('🔍 ID del producto creado:', productoClienteId)

        if (!productoClienteId) {
          console.error('❌ Estructura de respuesta:', nuevoProductoCliente.data)
          throw new Error('No se pudo obtener el ID del producto creado')
        }

        // Convertir a número entero para el backend SQLite
        const productoIdNumero = parseInt(productoClienteId, 10)

        if (isNaN(productoIdNumero) || productoIdNumero <= 0) {
          throw new Error(`ID de producto inválido: ${productoClienteId}`)
        }

        console.log('✅ Agregando producto a sesión con ID:', productoIdNumero)

        // Ahora agregar a la sesión con el ID del ProductoCliente
        addProductMutation.mutate({
          productoClienteId: productoIdNumero,
          cantidadContada: cantidadNueva
        })
      } catch (error) {
        console.error('❌ Error completo:', error)
        console.error('❌ Response data:', error.response?.data)
        console.error('❌ Response status:', error.response?.status)

        // Si el producto ya existe, el backend debería devolver el producto existente
        // o podemos simplemente mostrar un error más amigable
        if (error.response?.status === 400 && error.response?.data?.mensaje?.includes('Ya existe')) {
          toast.error('Este producto ya fue agregado a este cliente. Intenta buscarlo por nombre.')
        } else {
          const mensajeError = error.response?.data?.mensaje || error.message || 'Error al crear producto'
          toast.error(`Error: ${mensajeError}`)
          handleApiError(error)
        }
      }
    } else {
      // El producto ya es de ProductoCliente
      // Backend SQLite usa 'id' no '_id', asegurar compatibilidad
      const productoClienteId = selectedProducto?.id || selectedProducto?._id

      console.log('🔄 Producto ya es de cliente, ID:', productoClienteId)

      if (!productoClienteId) {
        console.error('❌ Producto seleccionado:', selectedProducto)
        toast.error('Error: No se pudo obtener el ID del producto')
        return
      }

      // Convertir a número entero para el backend SQLite
      const productoIdNumero = parseInt(productoClienteId, 10)

      if (isNaN(productoIdNumero) || productoIdNumero <= 0) {
        toast.error(`Error: ID de producto inválido: ${productoClienteId}`)
        return
      }

      console.log('✅ Agregando producto existente a sesión con ID:', productoIdNumero)

      addProductMutation.mutate({
        productoClienteId: productoIdNumero,
        cantidadContada: cantidadNueva
      })
    }
  }

  const handleCantidadKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      costoInputRef.current?.focus()
      costoInputRef.current?.select()
    }
  }

  const handleCostoKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddProduct()
    }
  }

  const handleUpdateFinancial = (field, value) => {
    const newData = { ...datosFinancieros, [field]: parseFloat(value) || 0 }
    setDatosFinancieros(newData)
    updateFinancialMutation.mutate(newData)
  }

  // Abrir modal financiero
  const openFinancialModal = (type) => {
    setActiveModal(type)

    // Configurar datos iniciales según el tipo
    switch (type) {
      case 'ventas':
        setModalData({
          title: 'Ventas del Mes',
          icon: <ShoppingCart className="w-6 h-6" />,
          color: 'blue',
          fields: [
            { key: 'monto', label: 'Monto Total', type: 'number', placeholder: '0.00' },
            { key: 'fecha', label: 'Fecha', type: 'date' },
            { key: 'descripcion', label: 'Descripción', type: 'text', placeholder: 'Descripción de las ventas' }
          ]
        })
        break
      case 'gastos':
        setGastosDetalle(Array.isArray(datosFinancieros.gastosGenerales) ? [...datosFinancieros.gastosGenerales] : [])
        setModoMultipleGastos(Array.isArray(datosFinancieros.gastosGenerales) && datosFinancieros.gastosGenerales.length > 0)
        setModalData({
          title: 'Gastos Generales',
          icon: <TrendingDown className="w-6 h-6" />,
          color: 'red',
          fields: [
            { key: 'agregarMultiple', label: 'Agregar varios gastos', type: 'checkbox' },
            { key: 'monto', label: 'Monto Total', type: 'number', placeholder: '0.00' },
            { key: 'fecha', label: 'Fecha', type: 'date' },
            { key: 'categoria', label: 'Categoría', type: 'select', options: ['Operativos', 'Administrativos', 'Ventas', 'Otros'] },
            { key: 'descripcion', label: 'Descripción', type: 'text', placeholder: 'Descripción del gasto' }
          ]
        })
        break
      case 'cuentasPorCobrar':
        setModalData({
          title: 'Cuentas por Cobrar',
          icon: <Users className="w-6 h-6" />,
          color: 'green',
          fields: [
            { key: 'cliente', label: 'Cliente', type: 'text', placeholder: 'Nombre del cliente' },
            { key: 'monto', label: 'Monto', type: 'number', placeholder: '0.00' },
            { key: 'fechaVencimiento', label: 'Fecha de Vencimiento', type: 'date' },
            { key: 'descripcion', label: 'Descripción', type: 'text', placeholder: 'Concepto de la cuenta' }
          ]
        })
        break
      case 'cuentasPorPagar':
        setModalData({
          title: 'Cuentas por Pagar',
          icon: <CreditCard className="w-6 h-6" />,
          color: 'orange',
          fields: [
            { key: 'proveedor', label: 'Proveedor', type: 'text', placeholder: 'Nombre del proveedor' },
            { key: 'monto', label: 'Monto', type: 'number', placeholder: '0.00' },
            { key: 'fechaVencimiento', label: 'Fecha de Vencimiento', type: 'date' },
            { key: 'descripcion', label: 'Descripción', type: 'text', placeholder: 'Concepto de la cuenta' }
          ]
        })
        break
      case 'efectivo':
        setModalData({
          title: 'Efectivo en Caja o Banco',
          icon: <Wallet className="w-6 h-6" />,
          color: 'purple',
          fields: [
            { key: 'tipoCuenta', label: 'Tipo de Cuenta', type: 'select', options: ['Caja', 'Banco', 'Cuenta de Ahorros', 'Cuenta Corriente'] },
            { key: 'monto', label: 'Monto Disponible', type: 'number', placeholder: '0.00' },
            { key: 'fecha', label: 'Fecha de Corte', type: 'date' },
            { key: 'descripcion', label: 'Descripción', type: 'text', placeholder: 'Detalles adicionales' }
          ]
        })
        break
      case 'deudaANegocio':
        setModalData({
          title: 'Deuda a Negocio',
          icon: <UserMinus className="w-6 h-6" />,
          color: 'orange',
          fields: [
            { key: 'esSocio', label: '¿Es Socio del Negocio?', type: 'select', options: ['true', 'false'], required: true },
            { key: 'deudor', label: 'Deudor', type: 'conditional', placeholder: 'Nombre del deudor', required: true },
            { key: 'monto', label: 'Monto de la Deuda', type: 'number', placeholder: '0.00', required: true },
            { key: 'tipoDeuda', label: 'Tipo de Deuda', type: 'select', options: ['Dinero', 'Mercancía', 'Servicios', 'Otros'], required: true },
            { key: 'fechaDeuda', label: 'Fecha de la Deuda', type: 'date', required: false },
            { key: 'descripcion', label: 'Descripción', type: 'text', placeholder: 'Detalles de la deuda', required: false }
          ]
        })
        break
      case 'activosFijos':
        setModalData({
          title: 'Activos Fijos',
          icon: <Briefcase className="w-6 h-6" />,
          color: 'indigo',
          fields: [
            { key: 'nombreActivo', label: 'Nombre del Activo', type: 'text', placeholder: 'Ej: Maquinaria, Equipo, etc.' },
            { key: 'valorActual', label: 'Valor Actual', type: 'number', placeholder: '0.00' },
            { key: 'fechaAdquisicion', label: 'Fecha de Adquisición', type: 'date' },
            { key: 'descripcion', label: 'Descripción', type: 'text', placeholder: 'Detalles del activo' }
          ]
        })
        break
      case 'capital':
        setModalData({
          title: 'Capital Anterior',
          icon: <PiggyBank className="w-6 h-6" />,
          color: 'yellow',
          fields: [
            { key: 'monto', label: 'Monto de Capital Anterior', type: 'number', placeholder: '0.00' },
            { key: 'descripcion', label: 'Descripción/Notas', type: 'text', placeholder: 'Opcional' }
          ]
        })
        break
      case 'imprimir':
        setModalData({
          title: 'Imprimir Inventario',
          icon: <Printer className="w-6 h-6" />,
          color: 'gray',
          fields: [
            { key: 'formato', label: 'Formato', type: 'select', options: ['PDF', 'Excel', 'Word'] },
            { key: 'incluirPrecios', label: 'Incluir Precios', type: 'checkbox' },
            { key: 'incluirTotales', label: 'Incluir Totales', type: 'checkbox' },
            { key: 'observaciones', label: 'Observaciones', type: 'text', placeholder: 'Notas adicionales para el reporte' }
          ]
        })
        break
      case 'configuracion':
        setModalData({
          title: 'Configuración de Inventario',
          icon: <Settings className="w-6 h-6" />,
          color: 'slate',
          isCustomModal: true
        })
        break
      default:
        setModalData({})
    }
  }
  
  // Cerrar modal financiero
  const closeFinancialModal = () => {
    setActiveModal(null)
    setModalData({})
    setCurrentReportPage(1)
    setModoMultipleGastos(false)
    setGastosDetalle([])
  }

  // Manejar envío del formulario financiero
  const handleFinancialSubmit = (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const data = Object.fromEntries(formData.entries())

    // Actualizar los datos financieros según el tipo de modal
    const newFinancialData = { ...datosFinancieros }

    // Asegurar que los arrays existan
    if (!Array.isArray(newFinancialData.gastosGenerales)) {
      newFinancialData.gastosGenerales = []
    }
    if (!Array.isArray(newFinancialData.cuentasPorCobrar)) {
      newFinancialData.cuentasPorCobrar = []
    }
    if (!Array.isArray(newFinancialData.efectivoEnCajaYBanco)) {
      newFinancialData.efectivoEnCajaYBanco = []
    }
    if (!Array.isArray(newFinancialData.cuentasPorPagar)) {
      newFinancialData.cuentasPorPagar = []
    }
    if (!Array.isArray(newFinancialData.deudaANegocio)) {
      newFinancialData.deudaANegocio = []
    }

    // Crear nueva entrada con ID único
    const newEntry = {
      id: Date.now(),
      monto: parseFloat(data.monto) || 0,
      fecha: data.fecha || new Date().toISOString().split('T')[0],
      descripcion: data.descripcion || ''
    }

    switch (activeModal) {
      case 'ventas':
        newFinancialData.ventasDelMes = parseFloat(data.monto) || 0
        break
      case 'gastos':
        if (modoMultipleGastos && gastosDetalle.length > 0) {
          const gastosConNombre = gastosDetalle.map(g => ({
            ...g,
            nombre: `${g.categoria || 'Otros'}${g.descripcion ? ': ' + g.descripcion : ''}`
          }))
          newFinancialData.gastosGenerales = [...newFinancialData.gastosGenerales, ...gastosConNombre]
        } else {
          newEntry.categoria = data.categoria || 'Otros'
          newEntry.nombre = `${newEntry.categoria}${newEntry.descripcion ? ': ' + newEntry.descripcion : ''}`
          newFinancialData.gastosGenerales.push(newEntry)
        }
        break
      case 'cuentasPorCobrar':
        newEntry.cliente = data.cliente || 'Cliente'
        newEntry.fechaVencimiento = data.fechaVencimiento || ''
        newEntry.nombre = `${newEntry.cliente}${newEntry.descripcion ? ' (' + newEntry.descripcion + ')' : ''}`
        newFinancialData.cuentasPorCobrar.push(newEntry)
        break
      case 'cuentasPorPagar':
        newEntry.proveedor = data.proveedor || 'Proveedor'
        newEntry.fechaVencimiento = data.fechaVencimiento || ''
        newEntry.nombre = `${newEntry.proveedor}${newEntry.descripcion ? ' (' + newEntry.descripcion + ')' : ''}`
        newFinancialData.cuentasPorPagar.push(newEntry)
        break
      case 'efectivo':
        newEntry.tipoCuenta = data.tipoCuenta || 'Caja'
        newEntry.nombre = `${newEntry.tipoCuenta}${newEntry.descripcion ? ': ' + newEntry.descripcion : ''}`
        newFinancialData.efectivoEnCajaYBanco.push(newEntry)
        break
      case 'deudaANegocio':
        // Obtener el valor correcto del deudor según si es socio o no
        const esSocio = data.esSocio === 'true' || data.esSocio === true
        let deudorValue = data.deudor || 'Deudor'
        let socioIndex = null

        // Si es socio, obtener el valor del selector de socios
        if (esSocio) {
          const socioSelect = document.getElementById('deudor-socio-select')
          if (socioSelect && socioSelect.value) {
            try {
              // El valor es un JSON con { index, nombre }
              const socioData = JSON.parse(socioSelect.value)
              deudorValue = socioData.nombre
              socioIndex = socioData.index
            } catch (e) {
              // Si no es JSON, usar el valor directamente
              deudorValue = socioSelect.value
            }
          }
        }

        newEntry.deudor = deudorValue
        newEntry.tipoDeuda = data.tipoDeuda || 'Dinero'
        newEntry.esSocio = esSocio
        newEntry.socioIndex = socioIndex // Guardar el índice del socio para la distribución
        newEntry.fechaDeuda = data.fechaDeuda || ''
        newEntry.nombre = `${newEntry.deudor}${newEntry.tipoDeuda ? ' (' + newEntry.tipoDeuda + ')' : ''}`
        newFinancialData.deudaANegocio.push(newEntry)
        break
      case 'activosFijos':
        newFinancialData.activosFijos = parseFloat(data.valorActual) || 0
        break
      case 'capital':
        newFinancialData.capitalAnterior = parseFloat(data.monto) || 0
        newFinancialData.capitalAnteriorDescripcion = data.descripcion || ''
        break
    }

    // Transformar datos para backend (mantener compatibilidad)
    const transformedData = transformFinancialDataForBackend(newFinancialData)

    // Logs de depuración
    console.log('📊 [FRONTEND] Modal activo:', activeModal)
    console.log('📊 [FRONTEND] Datos del formulario:', data)
    console.log('📊 [FRONTEND] Datos financieros locales:', newFinancialData)
    console.log('📊 [FRONTEND] Datos transformados para backend:', transformedData)

    // Actualizar el estado y enviar al backend
    setDatosFinancieros(newFinancialData)
    updateFinancialMutation.mutate(transformedData)

    toast.success(`${modalData.title} guardado exitosamente`)
    closeFinancialModal()
  }

  // Funciones para el reporte
  const getTotalPaginasProductos = () => {
    if (productosContados.length === 0) return 0
    return Math.ceil(productosContados.length / PRODUCTOS_POR_PAGINA)
  }


  const formatearFecha = (fecha) => {
    if (!fecha) return new Date().toLocaleDateString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
    return new Date(fecha).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
  }

  const formatearMoneda = (valor) => {
    const numero = Number(valor) || 0
    if (isNaN(numero) || !isFinite(numero)) {
      return 'RD$ 0.00'
    }
    return `RD$ ${numero.toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`
  }

  // Función para generar nombres de archivo seguros
  const generarNombreArchivoSeguro = (baseName) => {
    return baseName
      .replace(/[<>:"/\\|?*]/g, '') // Remover caracteres no válidos para nombres de archivo
      .replace(/\s+/g, '_') // Reemplazar espacios con guiones bajos
      .substring(0, 100) // Limitar longitud
  }

  // Funciones para calcular totales de arrays financieros
  const calculateTotalNominaEmpleados = () => {
    return empleadosData.empleados
      .filter(emp => emp.activo)
      .reduce((sum, emp) => sum + (parseFloat(emp.salario) || 0), 0)
  }

  const calculateTotalGastos = () => {
    const gastosGenerales = Array.isArray(datosFinancieros.gastosGenerales)
      ? datosFinancieros.gastosGenerales.reduce((sum, gasto) => sum + (parseFloat(gasto.monto) || 0), 0)
      : (parseFloat(datosFinancieros.gastosGenerales) || 0)

    // Sumar salarios de empleados activos a los gastos
    const nominaEmpleados = calculateTotalNominaEmpleados()

    return gastosGenerales + nominaEmpleados
  }

  const calculateTotalCuentasPorCobrar = () => {
    return Array.isArray(datosFinancieros.cuentasPorCobrar)
      ? datosFinancieros.cuentasPorCobrar.reduce((sum, cuenta) => sum + (parseFloat(cuenta.monto) || 0), 0)
      : (parseFloat(datosFinancieros.cuentasPorCobrar) || 0)
  }

  const calculateTotalEfectivo = () => {
    return Array.isArray(datosFinancieros.efectivoEnCajaYBanco)
      ? datosFinancieros.efectivoEnCajaYBanco.reduce((sum, efectivo) => sum + (parseFloat(efectivo.monto) || 0), 0)
      : (parseFloat(datosFinancieros.efectivoEnCajaYBanco) || 0)
  }

  const calculateTotalCuentasPorPagar = () => {
    return Array.isArray(datosFinancieros.cuentasPorPagar)
      ? datosFinancieros.cuentasPorPagar.reduce((sum, cuenta) => sum + (parseFloat(cuenta.monto) || 0), 0)
      : (parseFloat(datosFinancieros.cuentasPorPagar) || 0)
  }

  const calculateTotalDeudaANegocio = () => {
    return Array.isArray(datosFinancieros.deudaANegocio)
      ? datosFinancieros.deudaANegocio.reduce((sum, deuda) => sum + (parseFloat(deuda.monto) || 0), 0)
      : (parseFloat(datosFinancieros.deudaANegocio) || 0)
  }

  // Calcular la deuda total de un socio específico (para la distribución de saldo)
  const calculateDeudaSocio = (socioIndex) => {
    if (!Array.isArray(datosFinancieros.deudaANegocio)) return 0

    return datosFinancieros.deudaANegocio
      .filter(deuda => deuda.esSocio && deuda.socioIndex === socioIndex)
      .reduce((sum, deuda) => sum + (parseFloat(deuda.monto) || 0), 0)
  }

  // Obtener las deudas de un socio para mostrar detalles
  const getDeudasSocio = (socioIndex) => {
    if (!Array.isArray(datosFinancieros.deudaANegocio)) return []

    return datosFinancieros.deudaANegocio.filter(deuda => deuda.esSocio && deuda.socioIndex === socioIndex)
  }

  // Sincronizar deudas de socios con distribucionData
  const syncSociosDebts = () => {
    setDistribucionData(prev => {
      const newSocios = prev.socios.map((socio, idx) => ({
        ...socio,
        cuentaAdeudada: calculateDeudaSocio(idx)
      }))
      return { ...prev, socios: newSocios }
    })
  }

  // Sincronizar deudas cuando cambian los datos financieros
  useEffect(() => {
    if (datosFinancieros.deudaANegocio) {
      syncSociosDebts()
    }
  }, [datosFinancieros.deudaANegocio])

  // Funciones para modo edición del balance
  const getBalanceValue = (field, index = null) => {
    if (index !== null && Array.isArray(datosFinancieros[field])) {
      return datosFinancieros[field][index]?.monto || 0
    }
    return datosFinancieros[field] || 0
  }

  const getBalanceArray = (field) => {
    return datosFinancieros[field] || []
  }

  const updateBalanceValue = (field, value, index = null) => {
    const newData = { ...datosFinancieros }
    if (index !== null && Array.isArray(newData[field])) {
      newData[field] = [...newData[field]]
      newData[field][index] = { ...newData[field][index], monto: parseFloat(value) || 0 }
    } else {
      newData[field] = parseFloat(value) || 0
    }
    setDatosFinancieros(newData)
  }

  const updateBalanceArrayItem = (field, index, key, value) => {
    const newData = { ...datosFinancieros }
    if (Array.isArray(newData[field])) {
      newData[field] = [...newData[field]]
      newData[field][index] = { ...newData[field][index], [key]: value }
    }
    setDatosFinancieros(newData)
  }

  const deleteBalanceArrayItem = (field, index) => {
    const newData = { ...datosFinancieros }
    if (Array.isArray(newData[field])) {
      newData[field] = newData[field].filter((_, i) => i !== index)
    }
    setDatosFinancieros(newData)
  }

  // Calcular totales para el modo edición
  const getEditableTotal = (field) => {
    const data = datosFinancieros
    if (Array.isArray(data[field])) {
      return data[field].reduce((sum, item) => sum + (parseFloat(item.monto) || 0), 0)
    }
    return parseFloat(data[field]) || 0
  }

  // Transformar datos financieros para compatibilidad con backend
  const transformFinancialDataForBackend = (data) => {
    const transformed = { ...data }

    // Calcular total de nómina de empleados
    const nominaEmpleados = calculateTotalNominaEmpleados()

    // Convertir arrays a totales para campos que el backend espera como números
    if (Array.isArray(data.gastosGenerales)) {
      // Sumar nómina de empleados a los gastos generales
      transformed.gastosGenerales = data.gastosGenerales.reduce((sum, item) => sum + (parseFloat(item.monto) || 0), 0) + nominaEmpleados
      transformed.gastosGeneralesDetalle = data.gastosGenerales
    } else {
      // Si no hay array, solo sumar la nómina a los gastos
      transformed.gastosGenerales = (parseFloat(data.gastosGenerales) || 0) + nominaEmpleados
    }

    // Incluir datos de empleados
    transformed.empleados = empleadosData.empleados
    transformed.nominaEmpleados = nominaEmpleados

    // Incluir datos de configuración para persistencia
    transformed.distribucionData = distribucionData
    transformed.contadorData = contadorData
    transformed.descargaData = downloadData

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

  // Función para guardar cambios del balance en el backend
  const saveBalanceChanges = () => {
    if (!balanceEditData) return

    // Actualizar estado local de datosFinancieros
    setDatosFinancieros(balanceEditData)

    // Transformar y enviar al backend
    const transformedData = transformFinancialDataForBackend(balanceEditData)
    updateFinancialMutation.mutate(transformedData)

    toast.success('Cambios guardados correctamente')
  }

  // Función para calcular utilidades netas usando el método del Balance:
  // Utilidad Neta = (Activos - Pasivos) - Capital Anterior
  const calculateUtilidadesNetas = () => {
    const valorInventario = valorTotal || 0
    const totalActivos = valorInventario + getEditableTotal('cuentasPorCobrar') + getEditableTotal('efectivoEnCajaYBanco') + getEditableTotal('deudaANegocio') + (parseFloat(datosFinancieros.activosFijos) || 0)
    const totalPasivos = getEditableTotal('cuentasPorPagar')
    const capitalActual = totalActivos - totalPasivos
    const capitalAnterior = parseFloat(datosFinancieros.capitalAnterior) || 0

    return capitalActual - capitalAnterior
  }

  // Función para calcular utilidad bruta (Neta + Gastos)
  const calculateUtilidadesBrutas = () => {
    return calculateUtilidadesNetas() + calculateTotalGastos()
  }

  // Función para generar páginas con paginación de 45 productos cada una
  const generarPaginasProductos = (productos = []) => {
    const productosPorPagina = 45
    const paginas = []

    for (let i = 0; i < productos.length; i += productosPorPagina) {
      const productosPagina = productos.slice(i, i + productosPorPagina)
      const totalPagina = productosPagina.reduce((sum, p) => sum + (p.total || 0), 0)

      paginas.push({
        productos: productosPagina,
        numeroPagina: Math.floor(i / productosPorPagina) + 1,
        totalProductos: productosPagina.length,
        totalPagina: totalPagina,
        esUltimaPagina: (i + productosPorPagina) >= productos.length
      })
    }

    return paginas
  }

  // Función para generar contenido del inventario con paginación
  const generarContenidoInventario = () => {
    if (!sesion) {
      console.error('No hay sesión disponible')
      return null
    }

    const fecha = downloadData.fechaPersonalizada ? downloadData.fechaDocumento : new Date().toISOString().split('T')[0]
    const nombreCliente = sesion?.clienteNegocio?.nombre || 'Cliente'

    let contenido = {
      titulo: `Inventario - ${nombreCliente}`,
      fecha: formatearFecha(fecha),
      productos: [],
      paginas: [],
      resumen: {},
      balance: {},
      distribucion: {}
    }

    // Agregar productos si se requiere
    if (downloadData.tipoDocumento === 'completo' || downloadData.tipoDocumento === 'productos') {
      if (!productosContados || productosContados.length === 0) {
        console.warn('No hay productos para procesar')
        return contenido
      }

      contenido.productos = productosContados.map(p => ({
        nombre: p.nombreProducto || 'Sin nombre',
        unidad: p.producto?.unidad || 'unidad',
        cantidad: p.cantidadContada || 0,
        costo: downloadData.incluirPrecios ? (Number(p.costoProducto) || 0) : null,
        total: downloadData.incluirPrecios ? ((Number(p.cantidadContada) || 0) * (Number(p.costoProducto) || 0)) : null
      }))

      // Generar páginas con paginación
      contenido.paginas = generarPaginasProductos(contenido.productos)
    }

    // Agregar resumen financiero si se requiere
    if ((downloadData.tipoDocumento === 'completo' || downloadData.tipoDocumento === 'reporte') && downloadData.incluirTotales) {
      contenido.resumen = {
        totalProductos: productosContados.length,
        totalUnidades: productosContados.reduce((sum, p) => sum + (Number(p.cantidadContada) || 0), 0),
        valorTotal: productosContados.reduce((sum, p) => sum + ((Number(p.cantidadContada) || 0) * (Number(p.costoProducto) || 0)), 0),
        ventasDelMes: datosFinancieros.ventasDelMes || 0,
        gastosGenerales: datosFinancieros.gastosGenerales || 0,
        utilidadesNetas: calculateUtilidadesNetas()
      }
    }

    // Agregar balance general si se requiere
    if ((downloadData.tipoDocumento === 'completo' || downloadData.tipoDocumento === 'balance') && downloadData.incluirBalance) {
      const valorInventario = productosContados.reduce((sum, p) => sum + ((Number(p.cantidadContada) || 0) * (Number(p.costoProducto) || 0)), 0)
      const totalActivos = valorInventario + datosFinancieros.cuentasPorCobrar + datosFinancieros.efectivoEnCajaYBanco + datosFinancieros.activosFijos
      const totalPasivos = datosFinancieros.cuentasPorPagar
      const capitalContable = totalActivos - totalPasivos

      contenido.balance = {
        activos: {
          inventario: valorInventario,
          cuentasPorCobrar: datosFinancieros.cuentasPorCobrar || 0,
          efectivo: datosFinancieros.efectivoEnCajaYBanco || 0,
          activosFijos: datosFinancieros.activosFijos || 0,
          total: totalActivos
        },
        pasivos: {
          cuentasPorPagar: datosFinancieros.cuentasPorPagar || 0,
          total: totalPasivos
        },
        capital: capitalContable,
        // Información adicional para el reporte detallado
        fechaReporte: new Date().toLocaleDateString('es-ES'),
        empresa: nombreCliente,
        totalProductos: productosContados.length,
        valorTotalInventario: valorInventario
      }
    }

    return contenido
  }

  // Función para descargar en formato CSV
  const descargarCSV = () => {
    const contenido = generarContenidoInventario()
    if (!contenido) {
      toast.error('No se pudo generar el contenido del inventario')
      return
    }

    let csv = `Inventario - ${contenido.titulo}\nFecha: ${contenido.fecha}\n\n`

    if (contenido.productos.length > 0) {
      csv += 'PRODUCTOS\n'
      csv += 'Nombre,Unidad,Cantidad'
      if (downloadData.incluirPrecios) csv += ',Costo Unitario,Total'
      csv += '\n'

      contenido.productos.forEach(p => {
        csv += `"${p.nombre}","${p.unidad}",${p.cantidad}`
        if (downloadData.incluirPrecios) csv += `,${p.costo},${p.total}`
        csv += '\n'
      })
      csv += '\n'
    }

    if (contenido.resumen && Object.keys(contenido.resumen).length > 0) {
      csv += 'RESUMEN FINANCIERO\n'
      csv += `Total Productos,${contenido.resumen.totalProductos}\n`
      csv += `Total Unidades,${contenido.resumen.totalUnidades}\n`
      if (downloadData.incluirPrecios) {
        csv += `Valor Total Inventario,${formatearMoneda(contenido.resumen.valorTotal)}\n`
        csv += `Ventas del Mes,${formatearMoneda(contenido.resumen.ventasDelMes)}\n`
        csv += `Gastos Generales,${formatearMoneda(contenido.resumen.gastosGenerales)}\n`

        // Agregar detalle de nómina de empleados si existen y está activado
        if (empleadosData.empleados.filter(e => e.activo).length > 0 && empleadosData.incluirEnReporte) {
          csv += `\nNÓMINA DE EMPLEADOS\n`
          empleadosData.empleados.filter(e => e.activo).forEach((emp, idx) => {
            const salarioNeto = (parseFloat(emp.salario) || 0) - (parseFloat(emp.deuda) || 0)
            csv += `${emp.nombre || `Empleado ${idx + 1}`},${formatearMoneda(parseFloat(emp.salario) || 0)}`
            if (emp.deuda > 0) {
              csv += ` (Deuda: ${formatearMoneda(parseFloat(emp.deuda))} - Neto: ${formatearMoneda(salarioNeto)})`
            }
            csv += '\n'
          })
          csv += `Total Nómina,${formatearMoneda(calculateTotalNominaEmpleados())}\n`
        }

        csv += `Utilidades Netas,${formatearMoneda(contenido.resumen.utilidadesNetas)}\n`
      }
      csv += '\n'
    }

    if (contenido.balance && Object.keys(contenido.balance).length > 0) {
      csv += 'BALANCE GENERAL\n'
      csv += `Empresa:,${contenido.balance.empresa}\n`
      csv += `Fecha de Reporte:,${contenido.balance.fechaReporte}\n\n`

      csv += 'ACTIVOS\n'
      csv += `Inventario (${contenido.balance.totalProductos} productos),${contenido.balance.activos.inventario}\n`
      csv += `Cuentas por Cobrar,${contenido.balance.activos.cuentasPorCobrar}\n`
      csv += `Efectivo en Caja y Banco,${contenido.balance.activos.efectivo}\n`
      csv += `Activos Fijos,${contenido.balance.activos.activosFijos}\n`
      csv += `TOTAL ACTIVOS,${contenido.balance.activos.total}\n\n`

      csv += 'PASIVOS\n'
      csv += `Cuentas por Pagar,${contenido.balance.pasivos.cuentasPorPagar}\n`
      csv += `TOTAL PASIVOS,${contenido.balance.pasivos.total}\n\n`

      csv += `CAPITAL CONTABLE,${contenido.balance.capital}\n\n`

      csv += `INFORMACIÓN DEL REPORTE\n`
      csv += `Fecha de generación:,${new Date().toLocaleString('es-ES')}\n`
      csv += `Valor total del inventario:,${contenido.balance.valorTotalInventario}\n`
      csv += `Total de productos diferentes:,${contenido.balance.totalProductos}\n`
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    const nombreArchivo = `${sesion?.clienteNegocio?.nombre || 'Cliente'}_Inventario_${downloadData.fechaPersonalizada ? downloadData.fechaDocumento : new Date().toISOString().split('T')[0]}.csv`

    link.setAttribute('href', url)
    link.setAttribute('download', generarNombreArchivoSeguro(nombreArchivo))
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Función para descargar en formato Excel (HTML table que Excel puede abrir)
  const descargarExcel = () => {
    const contenido = generarContenidoInventario()
    if (!contenido) {
      toast.error('No se pudo generar el contenido del inventario')
      return
    }

    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head>
        <meta charset="utf-8">
        <style>
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #9ca3af; color: white; font-weight: bold; }
          .titulo { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
          .seccion { font-size: 14px; font-weight: bold; margin-top: 20px; margin-bottom: 10px; background-color: #f0f0f0; padding: 5px; }
          .numero { text-align: right; }
        </style>
      </head>
      <body>
        <div class="titulo">${contenido.titulo}</div>
        <div>Fecha: ${contenido.fecha}</div>
        <br>
    `

    if (contenido.productos.length > 0) {
      html += '<div class="seccion">PRODUCTOS</div>'
      html += '<table><thead><tr><th>Nombre</th><th>Unidad</th><th>Cantidad</th>'
      if (downloadData.incluirPrecios) html += '<th>Costo Unitario</th><th>Total</th>'
      html += '</tr></thead><tbody>'

      contenido.productos.forEach(p => {
        html += `<tr><td>${p.nombre}</td><td>${p.unidad}</td><td class="numero">${p.cantidad}</td>`
        if (downloadData.incluirPrecios) html += `<td class="numero">${formatearMoneda(p.costo)}</td><td class="numero">${formatearMoneda(p.total)}</td>`
        html += '</tr>'
      })
      html += '</tbody></table><br>'
    }

    if (contenido.resumen && Object.keys(contenido.resumen).length > 0) {
      html += '<div class="seccion">RESUMEN FINANCIERO</div>'
      html += '<table><tbody>'
      html += `<tr><td>Total Productos</td><td class="numero">${contenido.resumen.totalProductos}</td></tr>`
      html += `<tr><td>Total Unidades</td><td class="numero">${contenido.resumen.totalUnidades}</td></tr>`
      if (downloadData.incluirPrecios) {
        html += `<tr><td>Valor Total Inventario</td><td class="numero">${formatearMoneda(contenido.resumen.valorTotal)}</td></tr>`
        html += `<tr><td>Ventas del Mes</td><td class="numero">${formatearMoneda(contenido.resumen.ventasDelMes)}</td></tr>`
        html += `<tr><td>Gastos Generales</td><td class="numero">${formatearMoneda(contenido.resumen.gastosGenerales)}</td></tr>`

        // Agregar detalle de nómina de empleados si está activado
        if (empleadosData.empleados.filter(e => e.activo).length > 0 && empleadosData.incluirEnReporte) {
          html += '<tr><td colspan="2" style="padding-top: 10px; font-weight: bold; font-size: 12px; color: #c53030;">NÓMINA DE EMPLEADOS</td></tr>'
          empleadosData.empleados.filter(e => e.activo).forEach((emp, idx) => {
            const salarioNeto = (parseFloat(emp.salario) || 0) - (parseFloat(emp.deuda) || 0)
            let empleadoInfo = `${emp.nombre || `Empleado ${idx + 1}`}: ${formatearMoneda(parseFloat(emp.salario) || 0)}`
            if (emp.deuda > 0) {
              empleadoInfo += ` (Deuda: ${formatearMoneda(parseFloat(emp.deuda))} - Neto: ${formatearMoneda(salarioNeto)})`
            }
            html += `<tr><td style="padding-left: 20px; font-size: 11px; font-style: italic; color: #666;">${empleadoInfo}</td><td class="numero" style="font-size: 11px; color: #666;">${formatearMoneda(parseFloat(emp.salario) || 0)}</td></tr>`
          })
          html += `<tr><td style="font-weight: bold; padding-left: 20px;">Total Nómina</td><td class="numero" style="font-weight: bold;">${formatearMoneda(calculateTotalNominaEmpleados())}</td></tr>`
        }

        html += `<tr><td>Utilidades Netas</td><td class="numero">${formatearMoneda(contenido.resumen.utilidadesNetas)}</td></tr>`
      }
      html += '</tbody></table><br>'
    }

    if (contenido.balance && Object.keys(contenido.balance).length > 0) {
      html += '<div class="seccion">BALANCE GENERAL</div>'
      html += '<div style="text-align: center; margin-bottom: 15px; font-size: 12px; color: #666;">'
      html += `Empresa: ${contenido.balance.empresa} | Fecha: ${contenido.balance.fechaReporte}`
      html += '</div>'

      // ACTIVOS
      html += '<table style="margin-bottom: 15px;">'
      html += '<tr style="background-color: #e0e0e0; font-weight: bold;"><td colspan="2" style="font-size: 14px; text-align: center;">ACTIVOS</td></tr>'
      html += `<tr><td>Inventario (${contenido.balance.totalProductos} productos)</td><td class="numero">${formatearMoneda(contenido.balance.activos.inventario)}</td></tr>`
      html += `<tr><td>Cuentas por Cobrar</td><td class="numero">${formatearMoneda(contenido.balance.activos.cuentasPorCobrar)}</td></tr>`
      html += `<tr><td>Efectivo en Caja y Banco</td><td class="numero">${formatearMoneda(contenido.balance.activos.efectivo)}</td></tr>`
      html += `<tr><td>Activos Fijos</td><td class="numero">${formatearMoneda(contenido.balance.activos.activosFijos)}</td></tr>`
      html += `<tr style="font-weight: bold; border-top: 2px solid #333;"><td><strong>TOTAL ACTIVOS</strong></td><td class="numero" style="font-weight: bold; font-size: 13px;">${formatearMoneda(contenido.balance.activos.total)}</td></tr>`
      html += '</table>'

      // PASIVOS
      html += '<table style="margin-bottom: 15px;">'
      html += '<tr style="background-color: #e0e0e0; font-weight: bold;"><td colspan="2" style="font-size: 14px; text-align: center;">PASIVOS</td></tr>'
      html += `<tr><td>Cuentas por Pagar</td><td class="numero">${formatearMoneda(contenido.balance.pasivos.cuentasPorPagar)}</td></tr>`
      html += `<tr style="font-weight: bold; border-top: 2px solid #333;"><td><strong>TOTAL PASIVOS</strong></td><td class="numero" style="font-weight: bold; font-size: 13px;">${formatearMoneda(contenido.balance.pasivos.total)}</td></tr>`
      html += '</table>'

      // CAPITAL
      html += '<table style="margin-bottom: 20px;">'
      html += '<tr style="background-color: #e0e0e0; font-weight: bold;"><td colspan="2" style="font-size: 14px; text-align: center;">CAPITAL</td></tr>'
      html += `<tr style="font-weight: bold; background-color: #f0f8ff; border-top: 2px solid #333;"><td><strong>CAPITAL CONTABLE</strong></td><td class="numero" style="font-weight: bold; font-size: 15px; color: #1e40af;">${formatearMoneda(contenido.balance.capital)}</td></tr>`
      html += '</table>'

      // Información adicional
      html += '<div style="margin-top: 20px; padding: 10px; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 5px; font-size: 11px;">'
      html += `<strong>Información del Reporte:</strong><br>`
      html += `• Fecha de generación: ${new Date().toLocaleString('es-ES')}<br>`
      html += `• Valor total del inventario: ${formatearMoneda(contenido.balance.valorTotalInventario)}<br>`
      html += `• Total de productos diferentes: ${contenido.balance.totalProductos}<br>`
      html += '</div>'
    }

    html += '</body></html>'

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    const nombreArchivo = `${sesion?.clienteNegocio?.nombre || 'Cliente'}_Inventario_${downloadData.fechaPersonalizada ? downloadData.fechaDocumento : new Date().toISOString().split('T')[0]}.xls`

    link.setAttribute('href', url)
    link.setAttribute('download', generarNombreArchivoSeguro(nombreArchivo))
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Función para descargar en formato PDF proveniente del backend
  const descargarPDF = async () => {
    if (!sesion?._id) {
      toast.error('No se encontró la sesión de inventario')
      return
    }

    try {
      // Preparar opciones para el PDF
      const payload = {
        contadorData: {
          costoServicio: contadorData.costoServicio || 0,
          nombre: user?.nombre || '',
          cedula: user?.cedula || '',
          telefono: user?.telefono || '',
          email: user?.email || ''
        },
        distribucionData: {
          utilidadesNetas: calculateUtilidadesNetas(),
          numeroSocios: distribucionData.numeroSocios,
          socios: distribucionData.socios,
          fechaDesde: distribucionData.fechaDesde,
          fechaHasta: distribucionData.fechaHasta,
          comentarios: distribucionData.comentarios
        },
        tipoDocumento: downloadData.tipoDocumento,
        incluirPrecios: downloadData.incluirPrecios,
        incluirTotales: downloadData.incluirTotales,
        incluirBalance: downloadData.incluirBalance,
        incluirDistribucion: true,
        formato: downloadData.formato
      }

      const respuesta = await reportesApi.downloadInventoryPDF(sesion._id, payload)
      const blob = new Blob([respuesta.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)

      const enlace = document.createElement('a')
      enlace.href = url
      enlace.download = generarNombreArchivoSeguro(`Reporte_${sesion?.nombreCliente}_${sesion?.numeroSesion}.pdf`)
      document.body.appendChild(enlace)
      enlace.click()
      enlace.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error descargando PDF desde el backend:', error)
      toast.error('No se pudo descargar el PDF de inventario')
      throw error
    }
  }

  // Función principal de descarga
  const handleDownloadInventario = () => {
    if (!sesion || productosContados.length === 0) {
      toast.error('No hay productos en el inventario para descargar')
      return
    }
    setShowReportModal(true)
  }

  // Función para imprimir directamente
  const handlePrintInventario = () => {
    if (!sesion || productosContados.length === 0) {
      toast.error('No hay productos en el inventario para imprimir')
      return
    }
    setShowReportModal(true)
  }

  const handleExit = () => {
    if (productosContados.length === 0) {
      toast.error('Agrega al menos un producto para guardar')
      return
    }
    const zeroCost = productosContados.filter(p => (Number(p.costoProducto) || 0) === 0)
    if (zeroCost.length > 0) {
      const initial = {}
      zeroCost.forEach(p => { initial[p.producto] = 0 })
      setZeroCostEdits(initial)
      setShowZeroCostModal(true)
      return
    }
    completeMutation.mutate()
  }

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showExitDropdown && !event.target.closest('.relative')) {
        setShowExitDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showExitDropdown])

  // Pausar cronómetro al desmontar si está en marcha
  useEffect(() => {
    return () => {
      try {
        if (sesion?.timerEnMarcha) {
          sesionesApi.pauseTimer(id).catch(() => { })
        }
      } catch (_) { }
    }
  }, [id, sesion?.timerEnMarcha])

  // Debounce para evitar llamadas excesivas a la API
  const [pendingUpdates, setPendingUpdates] = useState({})

  // Referencia actualizada para evitar problemas de closure en el debounce
  const updateProductRef = useRef()

  const updateProductMutation = useMutation(
    async ({ productoId, field, value }) => {
      // Si es nombreProducto, también necesitamos el productoClienteId para actualizar correctamente
      const updateData = { [field]: value }

      // Si estamos actualizando el nombre, también necesitamos el productoClienteId
      // Buscar en el estado actual (que puede tener actualizaciones optimistas)
      const producto = productosContados.find(p => p.productoId === productoId)
      if (producto && producto.productoClienteId) {
        updateData.productoClienteId = producto.productoClienteId
      }

      return sesionesApi.updateProduct(id, productoId, updateData)
    },
    {
      onMutate: async ({ productoId, field, value }) => {
        // Cancelar refetches salientes
        await queryClient.cancelQueries(['sesion', id])

        // Snapshot del valor anterior
        const previousSesion = queryClient.getQueryData(['sesion', id])

        // Actualización optimista
        queryClient.setQueryData(['sesion', id], old => {
          if (!old || !old.productosContados) return old

          const newProductos = old.productosContados.map(p => {
            // El backend usa 'id' pero frontend mapea a 'productoId'. 
            // Aquí manipulamos el raw data del backend
            const pId = p.id || p._id || p.productoId
            if (String(pId) === String(productoId)) {
              const newP = { ...p, [field]: value }
              // Recalculo ROBUSTO del total
              if (field === 'costoProducto' || field === 'cantidadContada') {
                // Parseo seguro que maneja strings vacíos como 0 y evita NaN
                const val = parseFloat(value);
                const safeVal = isNaN(val) ? 0 : val;

                const currentCant = field === 'cantidadContada' ? safeVal : (parseFloat(p.cantidadContada) || 0);
                const currentCost = field === 'costoProducto' ? safeVal : (parseFloat(p.costoProducto) || 0);
                const safeCant = isNaN(currentCant) ? 0 : currentCant;
                const safeCost = isNaN(currentCost) ? 0 : currentCost;

                newP.valorTotal = safeCant * safeCost;
              }
              return newP
            }
            return p
          })

          // Recalcular total global del inventario
          // Aseguramos que sume solo números válidos
          const nuevoTotalInventario = newProductos.reduce((sum, p) => {
            const val = parseFloat(p.valorTotal);
            return sum + (isNaN(val) ? 0 : val);
          }, 0);

          return {
            ...old,
            productosContados: newProductos,
            totales: {
              ...old.totales,
              valorTotalInventario: nuevoTotalInventario
            }
          }
        })

        return { previousSesion }
      },
      onSuccess: (response) => {
        // ACTUALIZAR CACHE CON RESPUESTA DEL SERVER
        // Esto asegura que si el frontend calculó mal o falta algo, el server lo corrige INMEDIATAMENTE
        if (response?.data?.datos) {
          queryClient.setQueryData(['sesion', id], response.data.datos)
        } else {
          queryClient.invalidateQueries(['sesion', id])
        }

        // Quitar de pendientes
        setPendingUpdates(prev => {
          const next = { ...prev }
          // Limpiar flags si es necesario
          return next
        })
      },
      onError: (err, newTodo, context) => {
        // Revertir a estado anterior si falla
        if (context?.previousSesion) {
          queryClient.setQueryData(['sesion', id], context.previousSesion)
        }
        handleApiError(err)
      }
    }
  )

  updateProductRef.current = updateProductMutation.mutate

  // Función debounced creada con useCallbackpara no recrearse en cada render
  // Usamos un Map para debounce independiente por producto+campo
  const debounceMap = useRef(new Map())

  const handleUpdateProductField = (productoId, field, value) => {
    // Si el campo es nombreProducto, mantener como string, de lo contrario convertir a número
    const processedValue = field === 'nombreProducto' ? String(value || '') : (parseFloat(value) || 0)

    // Actualización local inmediata para inputs (feedback visual instantáneo)
    // Esto requiere que el input value venga del estado local o query cache. 
    // Como 'productosContados' viene de query cache, onMutate optimista maneja esto.

    const key = `${productoId}-${field}`

    // Limpiar timeout anterior
    if (debounceMap.current.has(key)) {
      clearTimeout(debounceMap.current.get(key))
    }

    // Actualizar cache optimista INMEDIATAMENTE para que el input no "salte"
    // Hacemos esto disparando la mutación pero con debounce solo para la llamada de red?
    // No, react-query no soporta debounce nativo fácil sin custom hooks.
    // Haremos debounce de la LLAMADA a mutate, pero necesitamos actualizar el estado local visual.
    // Como no tenemos estado local por fila aquí (es una lista grande), 
    // dependemos de que el parent o el input tenga su estado o actualicemos cache.
    // Vamos a actualizar cache queryClient directamente sin llamar API aun.

    queryClient.setQueryData(['sesion', id], old => {
      if (!old || !old.productosContados) return old

      const newProductos = old.productosContados.map(p => {
        const pId = p.id || p._id || p.productoId
        // Comparar como strings para evitar problemas de tipos
        if (String(pId) === String(productoId)) {
          // Asegurar que el nuevo valor sea del tipo correcto para cálculos
          const val = field === 'nombreProducto' ? processedValue : (parseFloat(processedValue) || 0)
          const newP = { ...p, [field]: val }

          // Recalculo ROBUSTO del total
          if (field === 'costoProducto' || field === 'cantidadContada') {
            // Parseo seguro que maneja strings vacíos como 0 y evita NaN
            const val = parseFloat(processedValue);
            const safeVal = isNaN(val) ? 0 : val;

            const currentCant = field === 'cantidadContada' ? safeVal : (parseFloat(p.cantidadContada) || 0);
            const currentCost = field === 'costoProducto' ? safeVal : (parseFloat(p.costoProducto) || 0);
            const safeCant = isNaN(currentCant) ? 0 : currentCant;
            const safeCost = isNaN(currentCost) ? 0 : currentCost;

            newP.valorTotal = safeCant * safeCost;
          }
          return newP
        }
        return p
      })

      // Recalcular total global del inventario
      // Aseguramos que sume solo números válidos
      const nuevoTotalInventario = newProductos.reduce((sum, p) => {
        const val = parseFloat(p.valorTotal);
        return sum + (isNaN(val) ? 0 : val);
      }, 0);

      return {
        ...old,
        productosContados: newProductos,
        totales: {
          ...old.totales,
          valorTotalInventario: nuevoTotalInventario
        }
      }
    })

    // Programar la llamada a la API
    const timeoutId = setTimeout(() => {
      if (updateProductRef.current) {
        updateProductRef.current({ productoId, field, value: processedValue })
      }
      debounceMap.current.delete(key)
    }, 800) // 800ms de espera para "fluidez"

    debounceMap.current.set(key, timeoutId)
  }

  // Mutación para crear producto general
  const createProductMutation = useMutation(
    (productData) => {
      // Transformar los datos del formulario al formato que espera el backend
      const dataParaBackend = {
        nombre: productData.nombre,
        descripcion: productData.descripcion || '',
        categoria: productData.categoria,
        unidad: productData.unidad,
        costoBase: parseFloat(productData.costoBase) || 0,
        proveedor: productData.proveedor || '',
        codigoBarras: productData.codigoBarras || '',
        notas: productData.notas || '',
        tipoContenedor: productData.tipoContenedor || 'ninguno',
        tieneUnidadesInternas: productData.tieneUnidadesInternas || false,
        unidadesInternas: productData.unidadesInternas || null,
        tipoPeso: productData.tipoPeso || 'ninguno'
      }
      return productosApi.createGeneral(dataParaBackend)
    },
    {
      onSuccess: (response) => {
        toast.success('Producto creado exitosamente')
        const nuevoProducto = response.data.datos?.producto || response.data.producto
        setShowAddProductModal(false)
        setShowProductNotFoundModal(false)

        // Seleccionar el producto recién creado
        if (nuevoProducto) {
          handleSelectProduct(nuevoProducto)
        }

        // Resetear formulario
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
      },
      onError: handleApiError
    }
  )

  // Manejar el envío del formulario desde ProductoForm
  const handleCreateProduct = (formData) => {
    // El formulario ya viene validado desde ProductoForm
    createProductMutation.mutate(formData)
  }

  // Funciones helper para manejar valores seguros
  const safeNumber = (value, decimals = 2) => {
    const num = Number(value)
    return isNaN(num) || !isFinite(num) ? 0 : Number(num.toFixed(decimals))
  }

  const safeToFixed = (value, decimals = 2) => {
    return safeNumber(value, decimals).toFixed(decimals)
  }

  const productosContados = Array.isArray(sesion?.productosContados)
    ? sesion.productosContados
      .filter(p => p && typeof p === 'object') // Filtrar productos inválidos
      .map(p => ({
        ...p,
        cantidadContada: safeNumber(p?.cantidadContada, 1),
        costoProducto: safeNumber(p?.costoProducto, 2),
        valorTotal: safeNumber(p?.valorTotal, 2),
        nombreProducto: p?.nombreProducto || 'Sin nombre',
        // El productoId ya viene del backend como el ID del producto contado
        productoId: p?.productoId || p?.id || p?._id || '',
        producto: p?.producto // mantener referencia original por si se necesita mostrar
      }))
    // NO hacer reverse() porque el backend ya ordena DESC (últimos primero)
    : []

  const valorTotal = safeNumber(sesion?.totales?.valorTotalInventario, 2)
  const totalLineas = productosContados.length
  const capitalContable = safeNumber(
    (calculateTotalEfectivo() + calculateTotalCuentasPorCobrar() + valorTotal + calculateTotalDeudaANegocio() + datosFinancieros.activosFijos) - calculateTotalCuentasPorPagar(),
    2
  )

  // Productos con costo 0
  const productosConCostoCero = productosContados.filter(p => (Number(p.costoProducto) || 0) === 0)
  const cantidadProductosCostoCero = productosConCostoCero.length

  const productosFiltrados = useMemo(() => {
    const term = invSearchTerm.trim().toLowerCase()
    if (!term) return productosContados.slice(0, 50)
    return productosContados
      .filter(p => (p.nombreProducto || '').toLowerCase().includes(term) || (p.skuProducto || '').toLowerCase().includes(term))
      .slice(0, 100)
  }, [invSearchTerm, productosContados])

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center z-50">
        <div className="text-center">
          {/* Animación de círculos modernos */}
          <div className="relative w-32 h-32 mx-auto mb-8">
            {/* Círculo exterior pulsante */}
            <div className="absolute inset-0 rounded-full border-4 border-emerald-400 opacity-20 animate-ping"></div>

            {/* Círculos rotatorios */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-24 h-24">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="absolute inset-0 rounded-full border-4 border-transparent border-t-emerald-400 animate-spin"
                    style={{
                      animationDuration: `${1.5 + i * 0.5}s`,
                      animationDelay: `${i * 0.2}s`,
                      transform: `rotate(${i * 120}deg)`
                    }}
                  ></div>
                ))}
              </div>
            </div>

            {/* Círculo central */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full shadow-lg shadow-emerald-500/50 animate-pulse"></div>
            </div>

            {/* Puntos flotantes */}
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={`dot-${i}`}
                className="absolute w-2 h-2 bg-emerald-400 rounded-full animate-bounce"
                style={{
                  top: `${50 + 40 * Math.sin((i * Math.PI) / 3)}%`,
                  left: `${50 + 40 * Math.cos((i * Math.PI) / 3)}%`,
                  animationDelay: `${i * 0.15}s`,
                  animationDuration: '1s'
                }}
              ></div>
            ))}
          </div>

          {/* Texto con efecto de typing */}
          <div className="space-y-2">
            <p className="text-white text-2xl font-semibold animate-pulse">
              Cargando sesión
              <span className="inline-block animate-bounce">.</span>
              <span className="inline-block animate-bounce" style={{ animationDelay: '0.2s' }}>.</span>
              <span className="inline-block animate-bounce" style={{ animationDelay: '0.4s' }}>.</span>
            </p>
            <p className="text-emerald-400 text-sm animate-fade-in">
              Preparando tu espacio de trabajo
            </p>
          </div>

          {/* Barra de progreso animada */}
          <div className="mt-8 w-64 mx-auto">
            <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 animate-pulse rounded-full"
                style={{
                  width: '100%',
                  animation: 'shimmer 2s infinite'
                }}
              ></div>
            </div>
          </div>
        </div>

        {/* Estilos CSS adicionales */}
        <style jsx>{`
          @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
          @keyframes fade-in {
            0%, 100% { opacity: 0.5; }
            50% { opacity: 1; }
          }
          .animate-fade-in {
            animation: fade-in 2s ease-in-out infinite;
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-700 text-white overflow-y-auto">
      {/* Top Bar */}
      <div className="bg-slate-800 border-b border-slate-600 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => {
              if (productosContados.length === 0) {
                toast.error('Agrega al menos un producto para guardar')
                return
              }
              const zeroCost = productosContados.filter(p => (Number(p.costoProducto) || 0) === 0)
              if (zeroCost.length > 0) {
                const initial = {}
                zeroCost.forEach(p => { initial[p.producto] = 0 })
                setZeroCostEdits(initial)
                setShowZeroCostModal(true)
                return
              }
              completeMutation.mutate()
            }}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded font-medium transition-colors"
            title="Guardar sesión (F9)"
          >
            Guardar <span className="text-xs opacity-75">(F9)</span>
          </button>

          {/* Selector de Salir */}
          <div className="relative">
            <button
              onClick={() => setShowExitDropdown(!showExitDropdown)}
              className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded font-medium transition-colors flex items-center space-x-2"
              title="Salir (F10)"
            >
              <span>Salir</span>
              <span className="text-xs opacity-75">(F10)</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showExitDropdown && (
              <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                <button
                  onClick={() => {
                    setShowExitDropdown(false)
                    setShowExitModal(true)
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-red-50 text-red-600 font-medium transition-colors rounded-t-lg border-b border-gray-200"
                >
                  Salir sin Guardar
                </button>
                <button
                  onClick={() => {
                    setShowExitDropdown(false)
                    if (productosContados.length > 0) {
                      completeMutation.mutate()
                    } else {
                      toast.error('Agrega al menos un producto')
                    }
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-green-50 text-green-600 font-medium transition-colors rounded-b-lg"
                >
                  Salir y Guardar
                </button>
              </div>
            )}

            {/* Modal de Confirmación - Eliminar Producto */}
            {showDeleteConfirm && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl">
                  <h3 className="text-xl font-bold text-gray-800 mb-2">Eliminar producto</h3>
                  <p className="text-gray-600 mb-6">¿Seguro que deseas eliminar "{deleteTarget?.nombreProducto}" de la lista?</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowDeleteConfirm(false)
                        setDeleteTarget(null)
                      }}
                      className="flex-1 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded font-medium transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => {
                        const productoIdToDelete = deleteTarget?.productoId || deleteTarget?.id || deleteTarget?._id
                        if (productoIdToDelete) {
                          removeProductMutation.mutate(productoIdToDelete)
                        } else {
                          toast.error('No se pudo obtener el ID del producto a eliminar')
                        }
                        setShowDeleteConfirm(false)
                        setDeleteTarget(null)
                      }}
                      className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded font-medium transition-colors"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 bg-teal-500 px-4 py-2 rounded text-white font-mono text-lg">
            <Clock className="w-5 h-5" />
            <span>{formatearTiempo(tiempoTranscurrido)}</span>
          </div>
          <button
            onClick={() => setShowMenuModal(true)}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            title="Menú (F11)"
          >
            <Menu className="w-5 h-5 text-white" />
            <span className="text-xs absolute -bottom-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap opacity-75">F11</span>
          </button>
        </div>
      </div>

      {showMenuModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-sm p-4">
            <div className="space-y-3">
              <button onClick={() => { setShowMenuModal(false); setShowDownloadModal(true) }} className="w-full flex items-center justify-between px-4 py-3 bg-slate-100 hover:bg-slate-200 rounded">
                <span className="font-medium text-gray-900">Descargar listado</span>
                <Download className="w-5 h-5 text-gray-900" />
              </button>
              <button onClick={() => { setShowMenuModal(false); setShowConnectModal(true) }} className="w-full flex items-center justify-between px-4 py-3 bg-slate-100 hover:bg-slate-200 rounded">
                <span className="font-medium text-gray-900">Conectar</span>
                <Smartphone className="w-5 h-5 text-gray-900" />
              </button>
              <button onClick={() => { setShowMenuModal(false); setShowSearchEditModal(true) }} className="w-full flex items-center justify-between px-4 py-3 bg-slate-100 hover:bg-slate-200 rounded">
                <span className="font-medium text-gray-900">Buscar producto</span>
                <Search className="w-5 h-5 text-gray-900" />
              </button>
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={() => setShowMenuModal(false)} className="px-4 py-2 text-gray-900 hover:text-gray-700 font-medium">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {showDownloadModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-sm p-4">
            <h3 className="text-lg font-semibold mb-4">Descargar listado</h3>
            <div className="space-y-3">
              <button onClick={() => { setShowDownloadModal(false); descargarPDF() }} className="w-full flex items-center justify-between px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded">
                <span>PDF</span>
                <FileText className="w-5 h-5" />
              </button>
              <button onClick={() => { setShowDownloadModal(false); descargarExcel() }} className="w-full flex items-center justify-between px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded">
                <span>Excel</span>
                <FileSpreadsheet className="w-5 h-5" />
              </button>
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={() => setShowDownloadModal(false)} className="px-4 py-2 text-slate-700 hover:text-slate-900">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {showConnectModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[95vh] overflow-y-auto shadow-2xl">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                    <QrCode className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Conectar Colaboradores</h3>
                </div>
                <button
                  onClick={handleCerrarModalConectar}
                  className="text-white/80 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Instrucciones */}
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                <div className="flex items-start space-x-3">
                  <Users className="w-5 h-5 text-purple-600 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">¿Cómo funciona?</h4>
                    <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                      <li>Ingresa el nombre del colaborador</li>
                      <li>Genera el código QR</li>
                      <li>Compártelo o muéstralo en pantalla</li>
                      <li>El colaborador lo escanea desde su dispositivo</li>
                      <li>¡Comienza a contar productos de inmediato!</li>
                    </ol>
                  </div>
                </div>
              </div>

              {/* Tabla de Invitaciones Activas */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-semibold text-gray-900 flex items-center space-x-2">
                    <QrCode className="w-5 h-5 text-purple-600" />
                    <span>Invitaciones Activas</span>
                  </h4>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Nombre (opcional)"
                      value={nombreColaborador}
                      onChange={(e) => setNombreColaborador(e.target.value)}
                      className="px-3 py-1 border rounded text-sm"
                    />
                    <button
                      onClick={handleGenerarQR}
                      disabled={generandoQR}
                      className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 transition-colors"
                    >
                      {generandoQR ? 'Generando...' : 'Nueva Invitación'}
                    </button>
                  </div>
                </div>

                {invitaciones.length === 0 ? (
                  <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                    <p className="text-sm text-gray-500">No hay invitaciones activas</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {invitaciones.map((inv, index) => (
                          <tr key={inv.id || inv._id || `inv-${index}`}>
                            <td className="px-4 py-2 text-sm text-gray-900">{inv.nombre || '-'}</td>
                            <td className="px-4 py-2">
                              <span className="font-mono font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded">
                                {inv.codigoNumerico}
                              </span>
                            </td>
                            <td className="px-4 py-2">
                              <span className={`text-xs px-2 py-1 rounded-full ${inv.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-800' :
                                inv.estado === 'consumida' ? 'bg-green-100 text-green-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                {inv.estado}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-right">
                              <div className="flex justify-end gap-2">
                                {inv.estado === 'pendiente' && (
                                  <>
                                    <button
                                      onClick={() => handleVerQRInvitacion(inv)}
                                      className="text-purple-600 hover:text-purple-800"
                                      title="Ver Código QR"
                                    >
                                      <QrCode className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={async () => {
                                        if (confirm('¿Cancelar invitación?')) {
                                          await invitacionesApi.cancel(inv.id || inv._id)
                                          cargarInvitaciones()
                                        }
                                      }}
                                      className="text-red-600 hover:text-red-800"
                                      title="Eliminar"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Colaboradores Conectados - Tabla */}
              <div className="border-t pt-4">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                  <Wifi className="w-5 h-5 text-green-600" />
                  <span>Colaboradores Conectados ({
                    colaboradoresConectados.filter(c => 
                      onlineColaboradoresDetalles?.some(online => String(online.solicitudId) === String(c.id || c._id))
                    ).length
                  })</span>
                </h4>

                {colaboradoresConectados.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-xl">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">
                      No hay colaboradores conectados aún
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Genera un QR para invitar colaboradores
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Colaborador
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Estado
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Última Conexión
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Productos Offline
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {colaboradoresOrdenados.map((colab, index) => {
                          const productosPendientes = productosColaboradorPendientes[colab.id || colab._id] || []
                          const cantidadPendientes = productosPendientes.length

                          // Verificar conectividad real usando WebSocket
                          const isOnline = onlineColaboradoresDetalles?.some(online => 
                            String(online.solicitudId) === String(colab.id || colab._id)
                          );
                          const currentConnectionState = isOnline ? 'conectado' : 'desconectado';

                          return (
                            <tr key={colab.id || colab._id || `colab-${index}`} className="hover:bg-gray-50">
                              <td className="px-4 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">
                                  {colab.nombreColaborador || colab.colaborador?.nombre || 'Desconocido'}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {colab.metadata?.dispositivoInfo?.modelo || colab.colaborador?.dispositivoInfo?.modelo || 'Desconocido'}
                                </div>
                                {/* Mostrar código de invitación si existe */}
                                {colab.metadata?.rolInvitacion && (
                                  <div className="mt-1 text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded inline-block font-mono tracking-wider">
                                    Código Inv: {colab.metadata.invitacionId ? '****' : 'Manual'}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${currentConnectionState === 'conectado'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                                  }`}>
                                  {currentConnectionState === 'conectado' ? (
                                    <><Wifi className="w-3 h-3 mr-1 inline" /> activo</>
                                  ) : (
                                    <><WifiOff className="w-3 h-3 mr-1 inline" /> desconectado</>
                                  )}
                                </span>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                {colab.ultimaConexion || currentConnectionState === 'conectado'
                                  ? new Date(colab.ultimaConexion || Date.now()).toLocaleString('es-MX', {

                                    dateStyle: 'short',
                                    timeStyle: 'short'
                                  })
                                  : 'Nunca'}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                {cantidadPendientes > 0 ? (
                                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full font-semibold">
                                    {cantidadPendientes} pendientes
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-500">Sin productos</span>
                                )}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex justify-end gap-2">
                                  {cantidadPendientes > 0 && (
                                    <button
                                      onClick={() => {
                                        setColaboradorSeleccionado(colab)
                                        setProductosParaRevisar(productosPendientes)
                                        setShowRevisarProductosModal(true)
                                      }}
                                      className="text-orange-600 hover:text-orange-900 flex items-center gap-1 font-medium"
                                      title="Revisar productos antes de agregar"
                                    >
                                      <Eye className="w-4 h-4" />
                                      Revisar ({cantidadPendientes})
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleMostrarQRColaborador(colab)}
                                    className="text-gray-400 hover:text-gray-600"
                                    title="Ver QR"
                                  >
                                    <QrCode className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Footer con info */}
              <div className="flex items-center justify-center space-x-6 text-sm pt-2 border-t">
                <div className="flex items-center space-x-2 text-green-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Conexión segura</span>
                </div>
                <div className="flex items-center space-x-2 text-amber-600">
                  <Clock className="w-4 h-4" />
                  <span>Válido 24h</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Revisión de Productos del Colaborador */}
      {showRevisarProductosModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-600 to-orange-700 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                    <ShoppingCart className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Revisar Productos del Colaborador</h3>
                    <p className="text-sm text-white/80">
                      {colaboradorSeleccionado?.nombreColaborador || colaboradorSeleccionado?.colaborador?.nombre || 'Colaborador'}
                      {' - '}{productosParaRevisar.length} producto(s)
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowRevisarProductosModal(false)
                    setColaboradorSeleccionado(null)
                    setProductosParaRevisar([])
                    setCantidadesEditadas({})
                  }}
                  className="text-white/80 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 180px)' }}>
              {productosParaRevisar.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No hay productos para revisar</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-orange-800">
                      <strong>Instrucciones:</strong> Revisa cada producto, ajusta las cantidades si es necesario,
                      y selecciona los que deseas agregar a tu inventario.
                    </p>
                  </div>

                  {productosParaRevisar
                    .filter(productoOffline => productoOffline && productoOffline.productoData)
                    .map((productoOffline, index) => {
                      const productoData = productoOffline.productoData || {}
                      const temporalId = productoOffline.temporalId || `temp-${index}`
                      // Usar cantidad del estado editado o la cantidad original del backend
                      const cantidadOriginal = Number(productoData.cantidad) || 1
                      const cantidadActual = Number(cantidadesEditadas[temporalId]) || cantidadOriginal

                      // Validar que productoData tenga los campos necesarios
                      if (!productoData.nombre) {
                        return null
                      }

                      return (
                        <div
                          key={`producto-revisar-${temporalId}-${index}`}
                          className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-900 text-lg">{productoData.nombre || 'Sin nombre'}</h4>
                              {productoData.sku && (
                                <p className="text-sm text-gray-500 mt-1">SKU: {productoData.sku}</p>
                              )}
                              <div className="flex items-center space-x-4 mt-2">
                                <div className="text-sm">
                                  <span className="text-gray-600">Costo unitario:</span>
                                  <span className="ml-2 font-semibold text-gray-900">
                                    RD$ {Number(productoData.costo || 0).toFixed(2)}
                                  </span>
                                </div>
                                <div className="text-sm">
                                  <span className="text-gray-600">Cantidad original:</span>
                                  <span className="ml-2 font-semibold text-gray-900">
                                    {cantidadOriginal}
                                  </span>
                                </div>
                                <div className="text-sm">
                                  <span className="text-gray-600">Total:</span>
                                  <span className="ml-2 font-semibold text-green-600">
                                    RD$ {Number((productoData.cantidad || 1) * (productoData.costo || 0)).toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center space-x-3">
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">Cantidad a agregar</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={cantidadActual}
                                  onChange={(e) => {
                                    const nuevaCantidad = parseFloat(e.target.value) || 0
                                    setCantidadesEditadas(prev => ({
                                      ...prev,
                                      [temporalId]: nuevaCantidad
                                    }))
                                  }}
                                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-center font-semibold text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}
            </div>

            {/* Footer */}
            {productosParaRevisar.length > 0 && (
              <div className="border-t p-6 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    <span className="font-semibold text-gray-900">{productosParaRevisar.length}</span> producto(s) en total
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => handleRechazarProductos(productosParaRevisar)}
                      className="px-6 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all font-medium"
                    >
                      Rechazar Todos
                    </button>
                    <button
                      onClick={() => handleAceptarProductos(productosParaRevisar)}
                      className="px-6 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all font-medium shadow-md"
                    >
                      Aceptar y Sincronizar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal QR Colaborador */}
      {showQRColaboradorModal && qrColaboradorData && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                    <QrCode className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Código QR</h3>
                </div>
                <button
                  onClick={handleCerrarQRColaborador}
                  className="text-white/80 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* QR Code Display */}
              <div className="bg-gradient-to-br from-blue-50 to-white border-2 border-blue-200 rounded-2xl p-6">
                <div className="flex flex-col items-center space-y-4">
                  {/* QR Image */}
                  <div className="bg-white p-4 rounded-xl shadow-lg">
                    <img
                      src={qrColaboradorData.qrDataUrl}
                      alt="Código QR"
                      className="w-48 h-48"
                    />
                  </div>

                  {/* Código de 6 dígitos */}
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-1">Código de 6 dígitos:</p>
                    <div className="text-3xl font-bold text-blue-600 tracking-widest">
                      {qrColaboradorData.codigoNumerico}
                    </div>
                  </div>

                  {/* Info del colaborador */}
                  <div className="w-full space-y-2">
                    <div className="flex items-center justify-between px-4 py-2 bg-white rounded-lg">
                      <span className="text-sm font-medium text-gray-600">Colaborador:</span>
                      <span className="text-sm font-bold text-gray-900">
                        {colaboradorSeleccionado?.colaborador?.nombre || qrColaboradorData.nombre}
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-2 bg-white rounded-lg">
                      <span className="text-sm font-medium text-gray-600">Estado:</span>
                      <span className={`text-sm font-semibold ${colaboradorSeleccionado?.estadoConexion === 'conectado'
                        ? 'text-green-600'
                        : 'text-gray-600'
                        }`}>
                        {colaboradorSeleccionado?.estadoConexion === 'conectado' ? 'Conectado' : 'Desconectado'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleDescargarQRColaborador}
                  className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-medium"
                >
                  <Download className="w-5 h-5" />
                  <span>Descargar QR</span>
                </button>
                <button
                  onClick={handleCerrarQRColaborador}
                  className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-all font-medium"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSearchEditModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-2xl p-4">
            <div className="flex items-center space-x-3 mb-3">
              <Search className="w-5 h-5 text-gray-900" />
              <input value={invSearchTerm} onChange={(e) => setInvSearchTerm(e.target.value)} placeholder="Buscar por nombre o código..." className="flex-1 border rounded px-3 py-2 text-gray-900 placeholder-gray-400" />
            </div>
            <div className="max-h-96 overflow-auto divide-y">
              {productosFiltrados.map((p) => {
                const ev = editValues[p.productoId] || { cantidadContada: p.cantidadContada, costoProducto: p.costoProducto }
                return (
                  <div key={p.productoId} className="py-2 flex items-center gap-3">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{p.nombreProducto}</div>
                      <div className="text-xs text-gray-600">{p.skuProducto || '-'}</div>
                    </div>
                    <input type="number" defaultValue={ev.cantidadContada} onChange={(e) => setEditValues(prev => ({ ...prev, [p.productoId]: { ...(prev[p.productoId] || {}), cantidadContada: parseFloat(e.target.value) || 0 } }))} className="w-24 border rounded px-2 py-1 text-right text-gray-900" />
                    <input type="number" step="0.01" defaultValue={ev.costoProducto} onChange={(e) => setEditValues(prev => ({ ...prev, [p.productoId]: { ...(prev[p.productoId] || {}), costoProducto: parseFloat(e.target.value) || 0 } }))} className="w-28 border rounded px-2 py-1 text-right text-gray-900" />
                    <button onClick={() => { const data = editValues[p.productoId] || { cantidadContada: p.cantidadContada, costoProducto: p.costoProducto }; updateProductBulkMutation.mutate({ productoId: p.productoId, data }) }} className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Guardar</button>
                  </div>
                )
              })}
              {productosFiltrados.length === 0 && (
                <div className="py-6 text-center text-gray-600">No hay resultados</div>
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowSearchEditModal(false)} className="px-4 py-2 bg-slate-200 rounded hover:bg-slate-300 text-gray-900 font-medium">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex h-[calc(100vh-140px)]">
        {/* Left Sidebar */}
        <div className="w-80 bg-slate-800 border-r border-slate-600 p-4 space-y-4 overflow-y-auto">
          {/* Financial Buttons (Hidden for Colaboradores) */}
          {!hasRole('colaborador') && (
            <>
              <h3 className="text-white font-semibold text-sm mb-4 text-center border-b border-slate-600 pb-2">
                Gestión Financiera
              </h3>
              <button
                onClick={() => openFinancialModal('ventas')}
                className="w-full flex items-center space-x-3 px-5 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg transition-all duration-200 text-base font-semibold shadow-md hover:shadow-lg transform hover:scale-105"
              >
                <ShoppingCart className="w-6 h-6" />
                <span>Ventas</span>
              </button>

              <button
                onClick={() => openFinancialModal('gastos')}
                className="w-full flex items-center space-x-3 px-5 py-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-lg transition-all duration-200 text-base font-semibold shadow-md hover:shadow-lg transform hover:scale-105"
              >
                <TrendingDown className="w-6 h-6" />
                <span>Gastos</span>
              </button>

              <button
                onClick={() => openFinancialModal('cuentasPorCobrar')}
                className="w-full flex items-center space-x-3 px-5 py-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-lg transition-all duration-200 text-base font-semibold shadow-md hover:shadow-lg transform hover:scale-105"
              >
                <Users className="w-6 h-6" />
                <span>Cuentas por Cobrar</span>
              </button>

              <button
                onClick={() => openFinancialModal('cuentasPorPagar')}
                className="w-full flex items-center space-x-3 px-5 py-4 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white rounded-lg transition-all duration-200 text-base font-semibold shadow-md hover:shadow-lg transform hover:scale-105"
              >
                <CreditCard className="w-6 h-6" />
                <span>Cuentas por Pagar</span>
              </button>

              <button
                onClick={() => openFinancialModal('efectivo')}
                className="w-full flex items-center space-x-3 px-5 py-4 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-lg transition-all duration-200 text-base font-semibold shadow-md hover:shadow-lg transform hover:scale-105"
              >
                <Wallet className="w-6 h-6" />
                <span>Efectivo en Caja o Banco</span>
              </button>

              <button
                onClick={() => openFinancialModal('deudaANegocio')}
                className="w-full flex items-center space-x-3 px-5 py-4 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-lg transition-all duration-200 text-base font-semibold shadow-md hover:shadow-lg transform hover:scale-105"
              >
                <UserMinus className="w-6 h-6" />
                <span>Deuda a Negocio</span>
              </button>

              <button
                onClick={() => openFinancialModal('activosFijos')}
                className="w-full flex items-center space-x-3 px-5 py-4 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-lg transition-all duration-200 text-base font-semibold shadow-md hover:shadow-lg transform hover:scale-105"
              >
                <Briefcase className="w-6 h-6" />
                <span>Activos Fijos</span>
              </button>

              <button
                onClick={() => openFinancialModal('capital')}
                className="w-full flex items-center space-x-3 px-5 py-4 bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-700 hover:to-yellow-800 text-white rounded-lg transition-all duration-200 text-base font-semibold shadow-md hover:shadow-lg transform hover:scale-105"
              >
                <PiggyBank className="w-6 h-6" />
                <span>Capital Anterior</span>
              </button>

              {/* Separador */}
              <div className="border-t border-slate-600 my-4"></div>
            </>
          )}

          <h3
            className={`text-white font-semibold text-sm mb-4 text-center border-b border-slate-600 pb-2 cursor-pointer transition-all ${activeSection === 'inventario' ? 'bg-blue-600 rounded px-2 py-1' : 'hover:bg-slate-700 rounded px-2 py-1'
              }`}
            onClick={() => {
              setActiveSection(activeSection === 'inventario' ? null : 'inventario')
              toast.success(activeSection === 'inventario' ? 'Atajos de Gestión de Inventario desactivados' : 'Atajos de Gestión de Inventario activados (F1-F3)', { duration: 2000 })
            }}
            title="Click para activar atajos de teclado (F1-F3)"
          >
            Gestión de Inventario {activeSection === 'inventario' && '✓'}
          </h3>

          {/* Nuevos botones de gestión */}
          <button
            onClick={() => setShowReportModal(true)}
            className="w-full flex items-center space-x-3 px-5 py-4 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white rounded-lg transition-all duration-200 text-base font-semibold shadow-md hover:shadow-lg transform hover:scale-105"
          >
            <FileText className="w-6 h-6" />
            <span>Ver Reporte</span>
          </button>

          <button
            onClick={() => openFinancialModal('configuracion')}
            className="w-full flex items-center space-x-3 px-5 py-4 bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white rounded-lg transition-all duration-200 text-base font-semibold shadow-md hover:shadow-lg transform hover:scale-105"
          >
            <Settings className="w-6 h-6" />
            <span>Configuración</span>
          </button>
        </div>

        {/* Center - Product Input */}
        <div
          className="flex-1 flex flex-col"
          onClick={(e) => {
            // Si el click no es en un input, botón o elemento interactivo, enfocar el input de código de barras
            const target = e.target
            if (target.tagName !== 'INPUT' && target.tagName !== 'BUTTON' && target.tagName !== 'A' && !target.closest('button') && !target.closest('input') && !target.closest('a') && !target.closest('[role="button"]')) {
              setTimeout(() => {
                searchInputRef.current?.focus()
              }, 100)
            }
          }}
        >
          {/* Input Section */}
          <div className="bg-slate-800 border-b border-slate-600 p-4">
            <div className="grid grid-cols-4 gap-3">
              {/* Input Código de Barras */}
              <div>
                <label className="block text-white text-sm mb-1">Código de Barras</label>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={codigoBarras}
                  onChange={(e) => setCodigoBarras(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && codigoBarras.length >= 3) {
                      // El código ya se buscará automáticamente por el useEffect
                      e.preventDefault()
                    }
                  }}
                  placeholder="Escanee o ingrese código de barras"
                  className="w-full px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
                  style={{ textShadow: '0 0 1px rgba(255,255,255,0.5)' }}
                />
              </div>

              {/* Input Buscar por Nombre */}
              <div>
                <label className="block text-white text-sm mb-1">Buscar por Nombre</label>
                <div className="relative">
                  <button
                    onClick={handleOpenSearchModal}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape' && selectedProducto) {
                        e.preventDefault()
                        setSelectedProducto(null)
                        setNombreBusqueda('')
                        setCantidad('')
                        setCosto('')
                        toast.success('Producto quitado')
                      }
                    }}
                    className="w-full px-4 py-3 bg-slate-700 rounded border border-slate-600 hover:border-blue-400 focus:outline-none focus:border-blue-400 text-lg text-left flex items-center justify-between transition-colors"
                  >
                    <span className={`truncate font-semibold ${selectedProducto ? 'text-white' : 'text-slate-400'
                      }`}>
                      {selectedProducto ? selectedProducto.nombre : 'Click para buscar...'}
                    </span>
                    <div className="flex items-center gap-2">
                      {selectedProducto && (
                        <span className="text-xs text-slate-400">ESC para quitar</span>
                      )}
                      <Search className="w-5 h-5 flex-shrink-0 text-slate-400" />
                    </div>
                  </button>
                </div>
              </div>

              {/* Input Cantidad */}
              <div>
                <label className="block text-white text-sm mb-1">
                  Cantidad
                  {isQuickScanMode && (
                    <span className="ml-2 px-2 py-1 bg-orange-500 text-white text-xs rounded-full animate-pulse">
                      Modo Rápido
                    </span>
                  )}
                </label>
                <input
                  ref={cantidadInputRef}
                  type="number"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  onKeyPress={handleCantidadKeyPress}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  disabled={!selectedProducto}
                  className={`w-full px-3 py-3 bg-slate-700 text-white placeholder-slate-400 rounded border border-slate-600 focus:outline-none focus:border-blue-400 text-lg text-center disabled:opacity-50 disabled:cursor-not-allowed ${isQuickScanMode ? 'border-orange-400 bg-orange-900/20' : ''
                    }`}
                />
              </div>

              {/* Input Costo */}
              <div>
                <label className="block text-white text-sm mb-1">Costo</label>
                <input
                  ref={costoInputRef}
                  type="number"
                  value={costo}
                  onChange={(e) => setCosto(e.target.value)}
                  onKeyPress={handleCostoKeyPress}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  disabled={!selectedProducto}
                  className="w-full px-3 py-3 bg-slate-700 text-white placeholder-slate-400 rounded border border-slate-600 focus:outline-none focus:border-blue-400 text-lg text-center disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* Table - Estilo Excel */}
          <div className="flex-1 overflow-auto bg-white">
            <table className="w-full" style={{ fontFamily: 'Arial, sans-serif', borderCollapse: 'collapse' }}>
              <thead className="sticky top-0">
                <tr>
                  {/* Columna Artículo */}
                  <th
                    rowSpan={2}
                    className="px-3 py-2 text-left bg-gray-200 text-gray-800 font-semibold text-sm"
                    style={{ minWidth: '250px', borderBottom: '2px solid #9ca3af' }}
                  >
                    Artículo
                  </th>

                  {/* Columna Cantidad */}
                  <th
                    colSpan={3}
                    className="px-3 py-2 text-center bg-green-100 text-gray-800 font-semibold text-sm"
                    style={{ borderBottom: '1px solid #9ca3af' }}
                  >
                    Cantidad
                  </th>

                  {/* Columna Costo (Hidden for Colaboradores) */}
                  {!hasRole('colaborador') && (
                    <th
                      colSpan={3}
                      className="px-3 py-2 text-center bg-blue-100 text-gray-800 font-semibold text-sm"
                      style={{ borderBottom: '1px solid #9ca3af' }}
                    >
                      Costo
                    </th>
                  )}

                  {/* Columna Total (Hidden for Colaboradores) */}
                  {!hasRole('colaborador') && (
                    <th
                      rowSpan={2}
                      className="px-3 py-2 text-center bg-yellow-100 text-gray-800 font-semibold text-sm"
                      style={{ minWidth: '120px', borderBottom: '2px solid #9ca3af' }}
                    >
                      Total
                    </th>
                  )}

                  {/* Columna Acciones */}
                  <th
                    rowSpan={2}
                    className="px-3 py-2 text-center bg-gray-200 text-gray-800 font-semibold text-sm"
                    style={{ width: '60px', borderBottom: '2px solid #9ca3af' }}
                  >
                  </th>
                </tr>
                <tr>
                  {/* Sub-columnas Cantidad */}
                  <th className="px-2 py-1 text-center bg-green-50 text-gray-700 text-xs font-medium" style={{ width: '80px', borderBottom: '2px solid #9ca3af' }}>
                    Anterior
                  </th>
                  <th className="px-2 py-1 text-center bg-green-50 text-gray-700 text-xs font-medium" style={{ width: '80px', borderBottom: '2px solid #9ca3af' }}>
                    Actual
                  </th>
                  <th className="px-2 py-1 text-center bg-green-50 text-gray-700 text-xs font-medium" style={{ width: '80px', borderBottom: '2px solid #9ca3af' }}>
                    Diferencia
                  </th>

                  {/* Sub-columnas Costo (Hidden for Colaboradores) */}
                  {!hasRole('colaborador') && (
                    <>
                      <th className="px-2 py-1 text-center bg-blue-50 text-gray-700 text-xs font-medium" style={{ width: '80px', borderBottom: '2px solid #9ca3af' }}>
                        Anterior
                      </th>
                      <th className="px-2 py-1 text-center bg-blue-50 text-gray-700 text-xs font-medium" style={{ width: '80px', borderBottom: '2px solid #9ca3af' }}>
                        Actual
                      </th>
                      <th className="px-2 py-1 text-center bg-blue-50 text-gray-700 text-xs font-medium" style={{ width: '80px', borderBottom: '2px solid #9ca3af' }}>
                        Diferencia
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {productosContados.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center space-y-2">
                        <Barcode className="w-12 h-12 text-gray-300" />
                        <p>Aún no hay productos en esta sesión</p>
                        <p className="text-sm">Usa el buscador para agregar productos</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  productosContados.map((producto, index) => (
                    <tr key={producto._id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      {/* Artículo */}
                      <td className="px-3 py-2 text-gray-800 text-sm">
                        <input
                          type="text"
                          defaultValue={producto.nombreProducto || ''}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleUpdateProductField(producto.productoId, 'nombreProducto', e.target.value);
                              e.currentTarget.blur()
                            }
                          }}
                          onBlur={(e) => handleUpdateProductField(producto.productoId, 'nombreProducto', e.target.value)}
                          className="w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 font-medium"
                          style={{ minWidth: '200px' }}
                        />
                      </td>

                      {/* Cantidad - Anterior */}
                      <td className="px-2 py-2 text-center bg-green-50 text-gray-600 text-sm">
                        <input
                          type="number"
                          value={safeToFixed(producto.cantidadAnterior || 0, 1)}
                          readOnly
                          className="w-full text-center bg-transparent border-none cursor-default"
                          step="0.1"
                        />
                      </td>

                      {/* Cantidad - Actual */}
                      <td className="px-2 py-2 text-center bg-white text-gray-900 font-semibold text-sm">
                        <input
                          type="number"
                          defaultValue={producto.cantidadContada}
                          onKeyDown={(e) => { if (e.key === 'Enter') { handleUpdateProductField(producto.productoId, 'cantidadContada', e.target.value); e.currentTarget.blur() } }}
                          onBlur={(e) => handleUpdateProductField(producto.productoId, 'cantidadContada', e.target.value)}
                          className="w-full text-center bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 font-semibold"
                          step="0.1"
                        />
                      </td>

                      {/* Cantidad - Diferencia */}
                      <td className="px-2 py-2 text-center bg-green-200 text-green-800 font-semibold text-sm">
                        <input
                          type="number"
                          value={safeToFixed(producto.cantidadDiferencia || (producto.cantidadContada - (producto.cantidadAnterior || 0)) || 0, 1)}
                          readOnly
                          className="w-full text-center bg-transparent border-none cursor-default font-semibold"
                          step="0.1"
                        />
                      </td>

                      {/* Costo (Hidden for Colaboradores) */}
                      {!hasRole('colaborador') && (
                        <>
                          {/* Costo - Anterior */}
                          <td className="px-2 py-2 text-center bg-blue-50 text-gray-600 text-sm">
                            <input
                              type="number"
                              value={safeToFixed(producto.costoAnterior || 0, 2)}
                              readOnly
                              className="w-full text-center bg-transparent border-none cursor-default"
                              step="0.01"
                            />
                          </td>

                          {/* Costo - Actual */}
                          <td className="px-2 py-2 text-center bg-white text-gray-900 font-semibold text-sm">
                            <input
                              type="number"
                              defaultValue={producto.costoProducto}
                              onKeyDown={(e) => { if (e.key === 'Enter') { handleUpdateProductField(producto.productoId, 'costoProducto', e.target.value); e.currentTarget.blur() } }}
                              onBlur={(e) => handleUpdateProductField(producto.productoId, 'costoProducto', e.target.value)}
                              className="w-full text-center bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 font-semibold"
                              step="0.01"
                            />
                          </td>

                          {/* Costo - Diferencia */}
                          <td className="px-2 py-2 text-center bg-yellow-200 text-yellow-800 font-semibold text-sm">
                            <input
                              type="number"
                              value={safeToFixed(producto.costoDiferencia || (producto.costoProducto - (producto.costoAnterior || 0)) || 0, 2)}
                              readOnly
                              className="w-full text-center bg-transparent border-none cursor-default font-semibold"
                              step="0.01"
                            />
                          </td>
                        </>
                      )}

                      {/* Total (Hidden for Colaboradores) */}
                      {!hasRole('colaborador') && (
                        <td className="px-3 py-2 text-right bg-yellow-50 text-gray-900 font-bold text-sm">
                          {safeNumber(producto.valorTotal, 2).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </td>
                      )}

                      {/* Acciones */}
                      <td className="px-2 py-2 text-center">
                        <button
                          onClick={() => { setDeleteTarget(producto); setShowDeleteConfirm(true); }}
                          className="text-red-600 hover:text-red-800 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="bg-slate-800 border-t border-slate-600 px-4 py-3 flex items-center justify-between text-white">
            <div className="flex items-center space-x-8">
              <div>
                <span className="text-slate-400">Líneas: </span>
                <span className="font-bold text-lg">{totalLineas}</span>
              </div>
              <div>
                <span className="text-slate-400">Cantidad: </span>
                <span className="font-bold text-lg">
                  {safeToFixed(productosContados.reduce((sum, p) => sum + p.cantidadContada, 0), 2)}
                </span>
              </div>
              {cantidadProductosCostoCero > 0 && (
                <div>
                  <button
                    onClick={() => {
                      const initial = {}
                      productosConCostoCero.forEach(p => {
                        initial[p.productoId] = p.costoProducto || 0
                      })
                      setZeroCostProductsEdits(initial)
                      setShowZeroCostProductsModal(true)
                    }}
                    className="px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded font-medium transition-colors flex items-center space-x-2"
                  >
                    <span>PROD. VALOR 0</span>
                    <span className="bg-orange-800 px-2 py-1 rounded-full text-xs font-bold">
                      {cantidadProductosCostoCero}
                    </span>
                  </button>
                </div>
              )}
              {pendingProducts.length > 0 && (
                <div>
                  <button
                    onClick={() => setMultipleProductsModal(true)}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors flex items-center space-x-2 animate-pulse"
                  >
                    <span>Productos Pendientes</span>
                    <span className="bg-blue-800 px-2 py-1 rounded-full text-xs font-bold">
                      {pendingProducts.length}
                    </span>
                  </button>
                </div>
              )}
            </div>

            {!hasRole('colaborador') && (
              <div className="text-right">
                <div className="text-slate-400 text-sm">Total</div>
                <div className="text-3xl font-bold">{valorTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search Modal */}
      {showSearchModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">Buscar Producto por Nombre</h3>
              <button
                onClick={() => setShowSearchModal(false)}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Input de búsqueda */}
            <div className="mb-4">
              <input
                type="text"
                value={nombreBusqueda}
                onChange={(e) => setNombreBusqueda(e.target.value)}
                placeholder="Escribe el nombre del producto..."
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-lg text-gray-900 bg-white"
                autoFocus
              />
            </div>

            {/* Lista de resultados */}
            <div className="border border-gray-300 rounded-lg overflow-hidden" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {isSearching ? (
                <div className="p-8 text-center text-gray-500">
                  <div className="loading-spinner w-8 h-8 mx-auto mb-2"></div>
                  <p>Buscando productos...</p>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Search className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>
                    {nombreBusqueda.length === 0
                      ? 'Listado de productos generales'
                      : nombreBusqueda.length < 3
                        ? 'Escribe al menos 3 caracteres para buscar'
                        : 'No se encontraron productos'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {/* Mostrar mensaje según el tipo de búsqueda */}
                  {nombreBusqueda.length === 0 ? (
                    <div className="px-4 py-2 bg-blue-50 text-blue-800 text-sm font-medium">
                      📦 Productos Generales ({searchResults.length})
                    </div>
                  ) : nombreBusqueda.length < 3 ? (
                    <div className="px-4 py-2 bg-yellow-50 text-yellow-800 text-sm">
                      Escribe al menos 3 caracteres para filtrar los productos
                    </div>
                  ) : (
                    <div className="px-4 py-2 bg-green-50 text-green-800 text-sm font-medium">
                      🔍 Resultados de búsqueda: "{nombreBusqueda}" ({searchResults.length})
                    </div>
                  )}

                  {/* Opción para crear producto si no tiene código de barras */}
                  {nombreBusqueda.length > 0 && (
                    <div className="px-4 py-2 bg-yellow-50 text-yellow-800 text-sm">
                      ¿No encuentra el producto? Puedes crearlo ahora.
                      <button
                        onClick={() => {
                          setShowSearchModal(false)
                          setShowAddProductModal(true)
                          setNewProductData({ nombre: nombreBusqueda, codigoBarras: '', sku: '', categoria: '', unidad: 'unidad', costo: '', descripcion: '', proveedor: '' })
                        }}
                        className="ml-2 px-2 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded"
                      >
                        Crear producto
                      </button>
                    </div>
                  )}

                  {searchResults.map((producto) => (
                    <button
                      key={producto._id || producto.id}
                      onClick={() => handleSelectProduct(producto)}
                      className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors flex items-center justify-between"
                    >
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">
                          {nombreBusqueda.length >= 3
                            ? highlightMatch(producto.nombre, nombreBusqueda)
                            : producto.nombre}
                        </div>
                        <div className="text-sm text-gray-600">
                          {producto.categoria || 'Sin categoría'} • {producto.unidad || 'unidad'}
                          {producto.codigoBarras && ` • Código: ${producto.codigoBarras}`}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-blue-600">
                          ${safeToFixed(producto.costo || producto.costoBase || 0, 2)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {producto.sku || producto.codigoBarras || 'Sin SKU'}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-between">
              <button
                onClick={() => {
                  setShowSearchModal(false)
                  setShowAddProductModal(true)
                  setNewProductData({
                    nombre: nombreBusqueda || '',
                    codigoBarras: '',
                    sku: '',
                    categoria: '',
                    unidad: 'unidad',
                    costo: '',
                    descripcion: '',
                    proveedor: ''
                  })
                }}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium transition-colors flex items-center space-x-2"
              >
                <span>+</span>
                <span>Crear Producto</span>
              </button>
              <button
                onClick={() => setShowSearchModal(false)}
                className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded font-medium transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación - Salir sin Guardar */}
      {showExitModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-xl font-bold text-gray-800 mb-4">⚠️ Salir sin Guardar</h3>
            <p className="text-gray-600 mb-6">
              ¿Estás seguro de que deseas salir sin guardar? Se perderán todos los cambios realizados en esta sesión.
            </p>

            <div className="flex space-x-3">
              <button
                onClick={async () => {
                  try {
                    await sesionesApi.pauseTimer(id)
                  } catch (_) { }
                  setShowExitModal(false)
                  navigate('/inventarios')
                }}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded font-medium transition-colors"
              >
                Salir de Todos Modos
              </button>

              <button
                onClick={() => setShowExitModal(false)}
                className="flex-1 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded font-medium transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal - Producto No Encontrado */}
      {showProductNotFoundModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center mb-4">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Barcode className="w-8 h-8 text-yellow-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Producto No Encontrado</h3>
              <p className="text-gray-600 mb-2">
                El código de barras <span className="font-mono font-bold text-blue-600">{productNotFoundCode}</span> no está registrado en la base de datos.
              </p>
              <p className="text-sm text-gray-500">
                ¿Deseas agregar este producto?
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => {
                  setShowProductNotFoundModal(false)
                  setShowAddProductModal(true)
                  setNewProductData({
                    ...newProductData,
                    codigoBarras: productNotFoundCode
                  })
                }}
                className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors"
              >
                Agregar Producto
              </button>

              <button
                onClick={() => {
                  setShowProductNotFoundModal(false)
                  setCodigoBarras('')
                  setProductNotFoundCode('')
                }}
                className="w-full px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded font-medium transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal - Agregar Producto */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 my-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-800">Agregar Nuevo Producto</h3>
              <button
                onClick={() => {
                  setShowAddProductModal(false)
                  setNewProductData({
                    nombre: '',
                    codigoBarras: '',
                    categoria: 'General',
                    unidad: 'unidad',
                    costoBase: 0,
                    descripcion: '',
                    proveedor: '',
                    tipoContenedor: 'ninguno',
                    tieneUnidadesInternas: false,
                    tipoPeso: 'ninguno'
                  })
                }}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <ProductoForm
              producto={{
                nombre: newProductData.nombre || '',
                codigoBarras: newProductData.codigoBarras || productNotFoundCode || '',
                categoria: newProductData.categoria || 'General',
                unidad: newProductData.unidad || 'unidad',
                costoBase: newProductData.costoBase || 0,
                descripcion: newProductData.descripcion || '',
                proveedor: newProductData.proveedor || '',
                tipoContenedor: newProductData.tipoContenedor || 'ninguno',
                tieneUnidadesInternas: newProductData.tieneUnidadesInternas || false,
                unidadesInternas: newProductData.unidadesInternas || {
                  cantidad: 0,
                  codigoBarras: '',
                  nombre: '',
                  costoPorUnidad: 0
                },
                tipoPeso: newProductData.tipoPeso || 'ninguno',
                notas: newProductData.notas || ''
              }}
              onSubmit={handleCreateProduct}
              onCancel={() => {
                setShowAddProductModal(false)
                setNewProductData({
                  nombre: '',
                  codigoBarras: '',
                  categoria: 'General',
                  unidad: 'unidad',
                  costoBase: 0,
                  descripcion: '',
                  proveedor: '',
                  tipoContenedor: 'ninguno',
                  tieneUnidadesInternas: false,
                  tipoPeso: 'ninguno'
                })
              }}
              isLoading={createProductMutation.isLoading}
            />
          </div>
        </div>
      )}

      {/* Modal - Completar costos en 0 */}
      {showZeroCostModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">Productos con costo 0</h3>
              <button onClick={() => setShowZeroCostModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>

            <p className="text-gray-600 mb-3">Antes de guardar, ingresa el costo para estos productos:</p>

            <div className="max-h-80 overflow-y-auto border rounded">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-100 text-left text-sm text-gray-700">
                    <th className="px-3 py-2">Producto</th>
                    <th className="px-3 py-2 w-40 text-center">Costo</th>
                  </tr>
                </thead>
                <tbody>
                  {productosContados
                    .filter(p => (Number(p.costoProducto) || 0) === 0)
                    .map(p => (
                      <tr key={p.producto} className="border-t">
                        <td className="px-3 py-2 text-sm text-gray-800">{p.nombreProducto}</td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={zeroCostEdits[p.producto] ?? 0}
                            onChange={(e) => setZeroCostEdits({ ...zeroCostEdits, [p.producto]: e.target.value })}
                            className="w-32 px-2 py-1 border rounded text-center"
                          />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end space-x-3 mt-4">
              <button
                onClick={() => setShowZeroCostModal(false)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  try {
                    const updates = Object.entries(zeroCostEdits)
                      .filter(([, v]) => Number(v) > 0)
                    for (const [productoId, value] of updates) {
                      await sesionesApi.updateProduct(id, productoId, { costoProducto: Number(value) })
                    }
                    setShowZeroCostModal(false)
                    await refetch()
                    completeMutation.mutate()
                  } catch (err) {
                    handleApiError(err)
                  }
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
              >
                Guardar costos y finalizar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal - Editar Productos con Valor 0 */}
      {showZeroCostProductsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">Productos con Valor 0</h3>
              <button
                onClick={() => setShowZeroCostProductsModal(false)}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <p className="text-gray-600 mb-4">Modifica el costo de los productos que tienen valor 0:</p>

            <div className="max-h-96 overflow-y-auto border rounded-lg">
              <table className="w-full">
                <thead className="sticky top-0 bg-gray-100">
                  <tr className="text-left text-sm text-gray-700">
                    <th className="px-4 py-3 font-semibold">Producto</th>
                    <th className="px-4 py-3 font-semibold text-center w-32">Cantidad</th>
                    <th className="px-4 py-3 font-semibold text-center w-40">Costo Actual</th>
                    <th className="px-4 py-3 font-semibold text-center w-40">Nuevo Costo</th>
                    <th className="px-4 py-3 font-semibold text-center w-32">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {productosConCostoCero.map(producto => {
                    const nuevoCosto = Number(zeroCostProductsEdits[producto.productoId] || 0)
                    const nuevoTotal = producto.cantidadContada * nuevoCosto

                    return (
                      <tr key={producto.productoId} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{producto.nombreProducto}</div>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-600">
                          {safeToFixed(producto.cantidadContada, 1)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-sm font-medium">
                            ${safeToFixed(Number(producto.costoProducto) || 0, 2)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={zeroCostProductsEdits[producto.productoId] || ''}
                            onChange={(e) => setZeroCostProductsEdits({
                              ...zeroCostProductsEdits,
                              [producto.productoId]: e.target.value
                            })}
                            className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="0.00"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 rounded text-sm font-medium ${nuevoTotal > 0
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-600'
                            }`}>
                            ${safeToFixed(nuevoTotal, 2)}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center mt-6">
              <div className="text-sm text-gray-600">
                Total de productos: <span className="font-semibold">{productosConCostoCero.length}</span>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowZeroCostProductsModal(false)}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    setIsUpdatingZeroCosts(true)
                    try {
                      // Actualizar solo los productos que tienen un nuevo costo válido
                      const updates = Object.entries(zeroCostProductsEdits)
                        .filter(([, value]) => Number(value) > 0)

                      if (updates.length === 0) {
                        toast.error('Ingresa al menos un costo válido')
                        setIsUpdatingZeroCosts(false)
                        return
                      }

                      console.log('🔄 Iniciando actualización de costos:', updates)

                      // Actualizar cada producto secuencialmente
                      for (const [productoId, value] of updates) {
                        console.log('📝 Actualizando producto:', productoId, 'con costo:', Number(value))

                        const response = await sesionesApi.updateProduct(id, productoId, {
                          costoProducto: Number(value)
                        })

                        console.log('✅ Respuesta actualización:', response.data)
                      }

                      console.log('🔄 Refrescando datos de la sesión...')

                      // Refrescar datos de la sesión
                      await refetch()

                      setShowZeroCostProductsModal(false)
                      setZeroCostProductsEdits({})
                      toast.success(`${updates.length} producto(s) actualizado(s) correctamente`)

                      console.log('✅ Actualización completada exitosamente')

                    } catch (err) {
                      console.error('❌ Error actualizando productos:', err)
                      console.error('❌ Detalles del error:', err.response?.data)
                      handleApiError(err)
                    } finally {
                      setIsUpdatingZeroCosts(false)
                    }
                  }}
                  disabled={isUpdatingZeroCosts}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUpdatingZeroCosts ? 'Enviando...' : 'Crear'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal - Múltiples Productos Pendientes */}
      {multipleProductsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-xl font-bold text-gray-800">
                Productos Escaneados Rápidamente ({pendingProducts.length})
              </h3>
              <button
                onClick={() => {
                  setMultipleProductsModal(false)
                  setPendingProducts([])
                }}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(pendingProducts.length, 3)}, 1fr)` }}>
                {pendingProducts.map((item, index) => (
                  <div key={item.id} className="bg-gray-50 rounded-lg p-4 border">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-gray-800">{item.producto.nombre}</h4>
                      <button
                        onClick={() => {
                          setPendingProducts(prev => prev.filter(p => p.id !== item.id))
                        }}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Cantidad <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.cantidad}
                          onChange={(e) => {
                            setPendingProducts(prev => prev.map(p =>
                              p.id === item.id ? { ...p, cantidad: e.target.value } : p
                            ))
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="0.00"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Costo <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.costo}
                          onChange={(e) => {
                            setPendingProducts(prev => prev.map(p =>
                              p.id === item.id ? { ...p, costo: e.target.value } : p
                            ))
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="0.00"
                        />
                      </div>

                      <div className="text-sm text-gray-600">
                        <div>Categoría: {item.producto.categoria}</div>
                        <div>Unidad: {item.producto.unidad}</div>
                        <div>SKU: {item.producto.sku || 'Sin SKU'}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {pendingProducts.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p>No hay productos pendientes</p>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center p-6 border-t bg-gray-50">
              <div className="text-sm text-gray-600">
                Productos listos para agregar: <span className="font-semibold">{pendingProducts.length}</span>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setMultipleProductsModal(false)
                    setPendingProducts([])
                  }}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    try {
                      // Validar que todos los productos tengan cantidad y costo válidos
                      const productosValidos = pendingProducts.filter(p =>
                        Number(p.cantidad) > 0 && Number(p.costo) > 0
                      )

                      if (productosValidos.length === 0) {
                        toast.error('Ingresa cantidad y costo válidos para al menos un producto')
                        return
                      }

                      // Iniciar reloj si es el primer producto
                      if (productosContados.length === 0 && !sesion?.timerEnMarcha) {
                        try {
                          await sesionesApi.resumeTimer(id)
                          console.log('✅ Reloj iniciado al agregar múltiples productos')
                          await refetch()
                        } catch (error) {
                          console.error('Error al iniciar reloj:', error)
                        }
                      }

                      // Agregar cada producto válido
                      for (const item of productosValidos) {
                        console.log('➕ Agregando producto múltiple:', item.producto.nombre)

                        // Si el producto es de ProductoGeneral, primero crear en ProductoCliente
                        if (item.producto.costoBase !== undefined) {
                          const nuevoProductoCliente = await productosApi.createForCliente(obtenerClienteId(sesion), {
                            nombre: item.producto.nombre,
                            descripcion: item.producto.descripcion,
                            costo: Number(item.costo),
                            unidad: item.producto.unidad,
                            categoria: item.producto.categoria,
                            proveedor: item.producto.proveedor,
                            sku: item.producto.codigoBarras || ''
                          })

                          // El backend devuelve el producto directamente en datos, con campo id (no _id)
                          const productoClienteCreado = nuevoProductoCliente.data?.datos || nuevoProductoCliente.data?.producto

                          // Agregar a la sesión
                          await sesionesApi.addProduct(id, {
                            productoClienteId: productoClienteCreado?.id || productoClienteCreado?._id,
                            cantidadContada: Number(item.cantidad),
                            costoProducto: Number(item.costo)
                          })
                        } else {
                          // El producto ya es de ProductoCliente
                          await sesionesApi.addProduct(id, {
                            producto: item.producto._id,
                            cantidadContada: Number(item.cantidad),
                            costoProducto: Number(item.costo)
                          })
                        }
                      }

                      // Refrescar datos de la sesión
                      await refetch()

                      // Limpiar estados
                      setMultipleProductsModal(false)
                      setPendingProducts([])
                      setLastScannedTime(0)
                      setLastScannedProduct(null)

                      toast.success(`${productosValidos.length} producto(s) agregado(s) exitosamente`)

                    } catch (error) {
                      console.error('❌ Error agregando productos múltiples:', error)
                      handleApiError(error)
                    }
                  }}
                  disabled={pendingProducts.filter(p => Number(p.cantidad) > 0 && Number(p.costo) > 0).length === 0}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Agregar Productos
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Financiero Dinámico */}
      {activeModal && activeModal !== 'reporteCompleto' && modalData.title && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className={`bg-white rounded-lg shadow-2xl ${modalData.isCustomModal || activeModal === 'configuracion'
            ? 'max-w-6xl w-full max-h-[90vh] overflow-hidden'
            : 'max-w-md w-full'
            }`}>
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-xl font-bold text-gray-800">{modalData.title}</h3>
              <button
                onClick={closeFinancialModal}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Contenido personalizado para modales especiales */}
            {modalData.isCustomModal ? (
              <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
                {activeModal === 'configuracion' && (
                  <div className="p-6">
                    {/* Pestañas de navegación */}
                    <div className="mb-6">
                      <div className="border-b border-gray-200">
                        <nav className="-mb-px flex space-x-8">
                          <button
                            onClick={() => setActiveConfigTab('general')}
                            className={`py-2 px-1 border-b-2 font-medium text-sm ${activeConfigTab === 'general'
                              ? 'border-slate-500 text-slate-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                              }`}
                          >
                            Configuración General
                          </button>
                          <button
                            onClick={() => setActiveConfigTab('distribucion')}
                            className={`py-2 px-1 border-b-2 font-medium text-sm ${activeConfigTab === 'distribucion'
                              ? 'border-emerald-500 text-emerald-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                              }`}
                          >
                            <Calculator className="w-4 h-4 inline mr-2" />
                            Distribución de Saldo
                          </button>
                          <button
                            onClick={() => setActiveConfigTab('contador')}
                            className={`py-2 px-1 border-b-2 font-medium text-sm ${activeConfigTab === 'contador'
                              ? 'border-amber-500 text-amber-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                              }`}
                          >
                            <Calendar className="w-4 h-4 inline mr-2" />
                            Datos del Contador
                          </button>
                          <button
                            onClick={() => setActiveConfigTab('descargar')}
                            className={`py-2 px-1 border-b-2 font-medium text-sm ${activeConfigTab === 'descargar'
                              ? 'border-cyan-500 text-cyan-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                              }`}
                          >
                            <Download className="w-4 h-4 inline mr-2" />
                            Descargar/Imprimir
                          </button>
                          <button
                            onClick={() => setActiveConfigTab('empleados')}
                            className={`py-2 px-1 border-b-2 font-medium text-sm ${activeConfigTab === 'empleados'
                              ? 'border-blue-500 text-blue-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                              }`}
                          >
                            <Users className="w-4 h-4 inline mr-2" />
                            Gestión de Empleados
                          </button>
                        </nav>
                      </div>
                    </div>

                    {/* Contenido de las pestañas */}
                    {activeConfigTab === 'general' && (
                      <div className="space-y-6">
                        <h4 className="text-lg font-semibold text-gray-800 border-b pb-2">Configuración General del Inventario</h4>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Unidad Predeterminada</label>
                              <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-slate-500 focus:border-slate-500">
                                <option value="unidad">Unidad</option>
                                <option value="kg">Kilogramos</option>
                                <option value="litros">Litros</option>
                                <option value="metros">Metros</option>
                                <option value="cajas">Cajas</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Alerta Stock Mínimo</label>
                              <input
                                type="number"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-slate-500 focus:border-slate-500"
                                placeholder="10"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Redondeo de Precios</label>
                              <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-slate-500 focus:border-slate-500">
                                <option value="sin-redondeo">Sin redondeo</option>
                                <option value="2-decimales">2 decimales</option>
                                <option value="0-decimales">0 decimales</option>
                              </select>
                            </div>
                          </div>
                          <div className="space-y-4">
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                className="h-4 w-4 text-slate-600 focus:ring-slate-500 border-gray-300 rounded"
                              />
                              <span className="ml-2 text-sm text-gray-700">Activar Notificaciones</span>
                            </div>
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                className="h-4 w-4 text-slate-600 focus:ring-slate-500 border-gray-300 rounded"
                              />
                              <span className="ml-2 text-sm text-gray-700">Guardar automáticamente</span>
                            </div>
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                className="h-4 w-4 text-slate-600 focus:ring-slate-500 border-gray-300 rounded"
                              />
                              <span className="ml-2 text-sm text-gray-700">Mostrar códigos de barras</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {activeConfigTab === 'distribucion' && (
                      <div className="space-y-6">
                        <h4 className="text-lg font-semibold text-gray-800 border-b pb-2 flex items-center">
                          <Calculator className="w-5 h-5 mr-2 text-emerald-600" />
                          Distribución de Saldo
                        </h4>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Configuración básica */}
                          <div className="space-y-4">
                            <h5 className="font-medium text-gray-800">Configuración General</h5>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Total de Utilidades Netas (Calculado automáticamente)</label>
                              <div className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-700">
                                {formatearMoneda(calculateUtilidadesNetas())}
                              </div>
                              <p className="text-xs text-gray-500 mt-1">Se calcula automáticamente desde el porcentaje neto × (Total Pasivos + Capital)</p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Número de Socios</label>
                              <select
                                value={distribucionData.numeroSocios}
                                onChange={(e) => {
                                  const num = parseInt(e.target.value)
                                  const newSocios = Array(num).fill().map((_, i) =>
                                    distribucionData.socios[i] || { nombre: '', porcentaje: 100 / num, utilidadAcumulada: 0, utilidadPeriodo: 0, cuentaAdeudada: 0 }
                                  )
                                  setDistribucionData({ ...distribucionData, numeroSocios: num, socios: newSocios })
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500"
                              >
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                                  <option key={n} value={n}>{n} socios</option>
                                ))}
                              </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Fecha Desde</label>
                                <input
                                  type="date"
                                  value={distribucionData.fechaDesde}
                                  onChange={(e) => setDistribucionData({ ...distribucionData, fechaDesde: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Fecha Hasta</label>
                                <input
                                  type="date"
                                  value={distribucionData.fechaHasta}
                                  onChange={(e) => setDistribucionData({ ...distribucionData, fechaHasta: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Lista de socios */}
                          <div className="space-y-4">
                            <h5 className="font-medium text-gray-800">Distribución por Socios</h5>
                            <div className="max-h-96 overflow-y-auto space-y-3">
                              {distribucionData.socios.map((socio, index) => (
                                <div key={index} className="bg-gray-50 p-4 rounded-lg space-y-3">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Socio {index + 1}</label>
                                    <input
                                      type="text"
                                      value={socio.nombre}
                                      onChange={(e) => {
                                        const newSocios = [...distribucionData.socios]
                                        newSocios[index].nombre = e.target.value
                                        setDistribucionData({ ...distribucionData, socios: newSocios })
                                      }}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500"
                                      placeholder="Nombre del Socio"
                                    />
                                  </div>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">Porcentaje (%)</label>
                                      <input
                                        type="number"
                                        step="0.01"
                                        max="100"
                                        value={socio.porcentaje}
                                        onChange={(e) => {
                                          const newSocios = [...distribucionData.socios]
                                          newSocios[index].porcentaje = parseFloat(e.target.value) || 0
                                          setDistribucionData({ ...distribucionData, socios: newSocios })
                                        }}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">Cuenta Adeudada</label>
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={socio.cuentaAdeudada}
                                        onChange={(e) => {
                                          const newSocios = [...distribucionData.socios]
                                          newSocios[index].cuentaAdeudada = parseFloat(e.target.value) || 0
                                          setDistribucionData({ ...distribucionData, socios: newSocios })
                                        }}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500"
                                        placeholder="14,465.00"
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Comentarios</label>
                          <textarea
                            value={distribucionData.comentarios}
                            onChange={(e) => setDistribucionData({ ...distribucionData, comentarios: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500"
                            rows={3}
                            placeholder="Notas sobre la distribución..."
                          />
                        </div>
                      </div>
                    )}

                    {activeConfigTab === 'contador' && (
                      <div className="space-y-6">
                        <h4 className="text-lg font-semibold text-gray-800 border-b pb-2 flex items-center">
                          <Calendar className="w-5 h-5 mr-2 text-amber-600" />
                          Datos del Contador
                        </h4>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <h5 className="font-medium text-gray-800">Información del Contador</h5>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Costo del Servicio</label>
                              <input
                                type="number"
                                step="0.01"
                                value={contadorData.costoServicio}
                                onChange={(e) => setContadorData({ ...contadorData, costoServicio: parseFloat(e.target.value) || 0 })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500"
                                placeholder="5000.00"
                              />
                              <p className="text-xs text-gray-500 mt-1">Este costo aparecerá en la portada del reporte</p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Fecha del Inventario</label>
                              <input
                                type="date"
                                value={contadorData.fechaInventario}
                                onChange={(e) => setContadorData({ ...contadorData, fechaInventario: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Periodicidad</label>
                              <select
                                value={contadorData.periodicidad}
                                onChange={(e) => setContadorData({ ...contadorData, periodicidad: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500"
                              >
                                <option value="mensual">Mensual</option>
                                <option value="bimestral">Cada 2 meses</option>
                                <option value="trimestral">Trimestral</option>
                                <option value="semestral">Semestral</option>
                                <option value="anual">Anual</option>
                              </select>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <h5 className="font-medium text-gray-800">Programación</h5>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Próxima Fecha</label>
                              <input
                                type="date"
                                value={contadorData.proximaFecha}
                                onChange={(e) => setContadorData({ ...contadorData, proximaFecha: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Notas Adicionales</label>
                              <textarea
                                value={contadorData.notasAdicionales}
                                onChange={(e) => setContadorData({ ...contadorData, notasAdicionales: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500"
                                rows={4}
                                placeholder="Instrucciones especiales..."
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {activeConfigTab === 'descargar' && (
                      <div className="space-y-6">
                        <h4 className="text-lg font-semibold text-gray-800 border-b pb-2 flex items-center">
                          <Download className="w-5 h-5 mr-2 text-cyan-600" />
                          Descargar/Imprimir Inventario
                        </h4>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <h5 className="font-medium text-gray-800">Opciones de Descarga</h5>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Formato</label>
                              <select
                                value={downloadData.formato}
                                onChange={(e) => setDownloadData({ ...downloadData, formato: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-cyan-500 focus:border-cyan-500"
                              >
                                <option value="PDF">PDF</option>
                                <option value="Excel">Excel (.xlsx)</option>
                                <option value="Word">Word (.docx)</option>
                                <option value="CSV">CSV</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Documento</label>
                              <select
                                value={downloadData.tipoDocumento}
                                onChange={(e) => setDownloadData({ ...downloadData, tipoDocumento: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-cyan-500 focus:border-cyan-500"
                              >
                                <option value="completo">Inventario Completo</option>
                                <option value="productos">Solo Lista de Productos</option>
                                <option value="reporte">Solo Reporte Financiero</option>
                                <option value="balance">Solo Balance General</option>
                              </select>
                            </div>
                            <div className="space-y-3">
                              <div className="flex items-center">
                                <input
                                  type="checkbox"
                                  checked={downloadData.incluirPrecios}
                                  onChange={(e) => setDownloadData({ ...downloadData, incluirPrecios: e.target.checked })}
                                  className="h-4 w-4 text-cyan-600 focus:ring-cyan-500 border-gray-300 rounded"
                                />
                                <span className="ml-2 text-sm text-gray-700">Incluir precios y costos</span>
                              </div>
                              <div className="flex items-center">
                                <input
                                  type="checkbox"
                                  checked={downloadData.incluirTotales}
                                  onChange={(e) => setDownloadData({ ...downloadData, incluirTotales: e.target.checked })}
                                  className="h-4 w-4 text-cyan-600 focus:ring-cyan-500 border-gray-300 rounded"
                                />
                                <span className="ml-2 text-sm text-gray-700">Incluir totales</span>
                              </div>
                              <div className="flex items-center">
                                <input
                                  type="checkbox"
                                  checked={downloadData.incluirBalance}
                                  onChange={(e) => setDownloadData({ ...downloadData, incluirBalance: e.target.checked })}
                                  className="h-4 w-4 text-cyan-600 focus:ring-cyan-500 border-gray-300 rounded"
                                />
                                <span className="ml-2 text-sm text-gray-700">Incluir balance general</span>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <h5 className="font-medium text-gray-800">Configuración de Fecha</h5>
                            <div className="flex items-center space-x-3">
                              <input
                                type="checkbox"
                                checked={downloadData.fechaPersonalizada}
                                onChange={(e) => setDownloadData({ ...downloadData, fechaPersonalizada: e.target.checked })}
                                className="h-4 w-4 text-cyan-600 focus:ring-cyan-500 border-gray-300 rounded"
                              />
                              <span className="text-sm text-gray-700">Usar fecha personalizada</span>
                            </div>
                            {downloadData.fechaPersonalizada && (
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Fecha del Documento</label>
                                <input
                                  type="date"
                                  value={downloadData.fechaDocumento}
                                  onChange={(e) => setDownloadData({ ...downloadData, fechaDocumento: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-cyan-500 focus:border-cyan-500"
                                />
                              </div>
                            )}
                            <div className="bg-blue-50 p-4 rounded-lg">
                              <h6 className="font-medium text-blue-900 mb-2">Vista Previa</h6>
                              <p className="text-sm text-blue-700">
                                {sesion?.clienteNegocio?.nombre || 'Cliente'}_Inventario_{downloadData.fechaPersonalizada ? downloadData.fechaDocumento : new Date().toISOString().split('T')[0]}.{downloadData.formato.toLowerCase()}
                              </p>
                            </div>

                            <div className="flex space-x-3 pt-4">
                              <button
                                type="button"
                                onClick={handleDownloadInventario}
                                className="flex-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded font-medium transition-colors flex items-center justify-center space-x-2"
                              >
                                <Download className="w-4 h-4" />
                                <span>Descargar</span>
                              </button>
                              <button
                                type="button"
                                onClick={handlePrintInventario}
                                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded font-medium transition-colors flex items-center justify-center space-x-2"
                              >
                                <Printer className="w-4 h-4" />
                                <span>Imprimir</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {activeConfigTab === 'empleados' && (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between border-b pb-2">
                          <h4 className="text-lg font-semibold text-gray-800 flex items-center">
                            <Users className="w-5 h-5 mr-2 text-blue-600" />
                            Gestión de Empleados
                          </h4>
                          <button
                            type="button"
                            onClick={() => {
                              setEmpleadosData({
                                ...empleadosData,
                                empleados: [...empleadosData.empleados, {
                                  id: Date.now(),
                                  nombre: '',
                                  salario: 0,
                                  deuda: 0,
                                  fechaIngreso: new Date().toISOString().split('T')[0],
                                  activo: true,
                                  notas: ''
                                }]
                              })
                            }}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors flex items-center space-x-2"
                          >
                            <Users className="w-4 h-4" />
                            <span>Agregar Empleado</span>
                          </button>
                        </div>

                        {empleadosData.empleados.length === 0 ? (
                          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                            <Users className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                            <p className="text-gray-600 mb-2">No hay empleados registrados</p>
                            <p className="text-sm text-gray-500">Haz clic en "Agregar Empleado" para comenzar</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {/* Resumen de gastos de nómina */}
                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm text-blue-700 font-medium">Total Nómina del Período</p>
                                  <p className="text-xs text-blue-600 mt-1">
                                    {empleadosData.empleados.filter(e => e.activo).length} empleado(s) activo(s)
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-2xl font-bold text-blue-900">
                                    RD$ {empleadosData.empleados
                                      .filter(e => e.activo)
                                      .reduce((sum, emp) => sum + (parseFloat(emp.salario) || 0), 0)
                                      .toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </p>
                                  <p className="text-xs text-blue-600">
                                    Se suma a gastos del mes
                                  </p>
                                </div>
                              </div>

                              {/* Checkbox para incluir en reporte */}
                              <div className="mt-3 pt-3 border-t border-blue-200 flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id="incluirNominaReporte"
                                  checked={empleadosData.incluirEnReporte}
                                  onChange={(e) => setEmpleadosData({
                                    ...empleadosData,
                                    incluirEnReporte: e.target.checked
                                  })}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <label htmlFor="incluirNominaReporte" className="text-sm text-blue-800 cursor-pointer">
                                  <span className="font-medium">Incluir detalle de nómina en el reporte de inventario</span>
                                  <p className="text-xs text-blue-600 mt-0.5">
                                    {empleadosData.incluirEnReporte
                                      ? 'Los empleados aparecerán detallados en el reporte'
                                      : 'Solo se mostrará el total en gastos generales'}
                                  </p>
                                </label>
                              </div>
                            </div>

                            {/* Lista de empleados */}
                            <div className="space-y-3 max-h-96 overflow-y-auto">
                              {empleadosData.empleados.map((empleado, index) => (
                                <div key={empleado.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                  <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center space-x-2">
                                      <div className={`w-3 h-3 rounded-full ${empleado.activo ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                                      <h5 className="font-medium text-gray-800">Empleado {index + 1}</h5>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (confirm('¿Está seguro de eliminar este empleado?')) {
                                          setEmpleadosData({
                                            ...empleadosData,
                                            empleados: empleadosData.empleados.filter(e => e.id !== empleado.id)
                                          })
                                          toast.success('Empleado eliminado')
                                        }
                                      }}
                                      className="text-red-600 hover:text-red-800 transition-colors"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo *</label>
                                      <input
                                        type="text"
                                        value={empleado.nombre}
                                        onChange={(e) => {
                                          const newEmpleados = [...empleadosData.empleados]
                                          newEmpleados[index].nombre = e.target.value
                                          setEmpleadosData({ ...empleadosData, empleados: newEmpleados })
                                        }}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Ej: Juan Pérez"
                                      />
                                    </div>

                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">Salario Mensual *</label>
                                      <div className="relative">
                                        <span className="absolute left-3 top-2 text-gray-500">RD$</span>
                                        <input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          value={empleado.salario}
                                          onChange={(e) => {
                                            const newEmpleados = [...empleadosData.empleados]
                                            newEmpleados[index].salario = parseFloat(e.target.value) || 0
                                            setEmpleadosData({ ...empleadosData, empleados: newEmpleados })
                                          }}
                                          className="w-full pl-12 pr-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                          placeholder="0.00"
                                        />
                                      </div>
                                    </div>

                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">Deuda del Empleado</label>
                                      <div className="relative">
                                        <span className="absolute left-3 top-2 text-gray-500">RD$</span>
                                        <input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          value={empleado.deuda}
                                          onChange={(e) => {
                                            const newEmpleados = [...empleadosData.empleados]
                                            newEmpleados[index].deuda = parseFloat(e.target.value) || 0
                                            setEmpleadosData({ ...empleadosData, empleados: newEmpleados })
                                          }}
                                          className="w-full pl-12 pr-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                          placeholder="0.00"
                                        />
                                      </div>
                                      <p className="text-xs text-gray-500 mt-1">
                                        {empleado.deuda > 0 ? (
                                          <span className="text-amber-600">
                                            Salario neto: RD$ {((parseFloat(empleado.salario) || 0) - (parseFloat(empleado.deuda) || 0)).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                                          </span>
                                        ) : (
                                          <span className="text-green-600">Sin deuda</span>
                                        )}
                                      </p>
                                    </div>

                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Ingreso</label>
                                      <input
                                        type="date"
                                        value={empleado.fechaIngreso}
                                        onChange={(e) => {
                                          const newEmpleados = [...empleadosData.empleados]
                                          newEmpleados[index].fechaIngreso = e.target.value
                                          setEmpleadosData({ ...empleadosData, empleados: newEmpleados })
                                        }}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                      />
                                    </div>

                                    <div className="md:col-span-2">
                                      <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                                      <textarea
                                        value={empleado.notas}
                                        onChange={(e) => {
                                          const newEmpleados = [...empleadosData.empleados]
                                          newEmpleados[index].notas = e.target.value
                                          setEmpleadosData({ ...empleadosData, empleados: newEmpleados })
                                        }}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                        rows={2}
                                        placeholder="Información adicional sobre el empleado..."
                                      />
                                    </div>

                                    <div className="md:col-span-2 flex items-center space-x-2">
                                      <input
                                        type="checkbox"
                                        checked={empleado.activo}
                                        onChange={(e) => {
                                          const newEmpleados = [...empleadosData.empleados]
                                          newEmpleados[index].activo = e.target.checked
                                          setEmpleadosData({ ...empleadosData, empleados: newEmpleados })
                                        }}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                      />
                                      <label className="text-sm text-gray-700">
                                        Empleado activo {!empleado.activo && <span className="text-red-600">(inactivo - no se suma a gastos)</span>}
                                      </label>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Información adicional */}
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                              <h5 className="font-medium text-amber-900 mb-2 flex items-center">
                                <DollarSign className="w-4 h-4 mr-2" />
                                Información Importante
                              </h5>
                              <ul className="text-sm text-amber-800 space-y-1">
                                <li>• Los salarios de empleados activos se suman automáticamente a los gastos del mes</li>
                                <li>• Las deudas se restan del salario para calcular el pago neto</li>
                                <li>• Esta información se incluirá en el reporte de inventario</li>
                                <li>• Marca como inactivo a empleados que ya no trabajen para excluirlos del cálculo</li>
                              </ul>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Botones de acción */}
                    <div className="flex justify-end space-x-3 pt-6 border-t mt-6">
                      <button
                        type="button"
                        onClick={closeFinancialModal}
                        className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded font-medium transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          // Transformar y enviar al backend para persistencia real
                          const transformedData = transformFinancialDataForBackend(datosFinancieros)
                          updateFinancialMutation.mutate(transformedData)

                          toast.success('Configuración guardada exitosamente')
                          closeFinancialModal()
                        }}
                        className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded font-medium transition-colors"
                      >
                        Guardar Configuración
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleFinancialSubmit} className="p-6 space-y-4">
                <div className={`flex items-center space-x-3 p-4 bg-blue-50 rounded-lg border border-blue-200`}>
                  <div className={`text-blue-600`}>
                    {modalData.icon}
                  </div>
                  <div>
                    <h4 className={`font-medium text-blue-900`}>{modalData.title}</h4>
                    <p className={`text-sm text-blue-700`}>Complete la información requerida</p>
                  </div>
                </div>

                {modalData.fields?.map((field, index) => {
                  const isHiddenInMultipleMode = modoMultipleGastos && ['monto', 'fecha', 'categoria', 'descripcion'].includes(field.key)
                  return (
                  <div key={index} className={isHiddenInMultipleMode ? 'hidden' : ''}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {field.label}
                      {field.required !== false && ' *'}
                    </label>

                    {field.type === 'select' ? (
                      <select
                        name={field.key}
                        required={field.required !== false}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        onChange={(e) => {
                          // Si es el campo esSocio, cambiar la visualización del campo deudor
                          if (field.key === 'esSocio') {
                            const socioSelect = document.getElementById('deudor-socio-select')
                            const textInput = document.getElementById('deudor-text-input')

                            if (e.target.value === 'true') {
                              // Mostrar selector de socios
                              if (socioSelect) {
                                socioSelect.style.display = 'block'
                                socioSelect.required = true
                              }
                              if (textInput) {
                                textInput.style.display = 'none'
                                textInput.required = false
                                textInput.value = ''
                              }
                            } else {
                              // Mostrar input de texto
                              if (socioSelect) {
                                socioSelect.style.display = 'none'
                                socioSelect.required = false
                                socioSelect.value = ''
                              }
                              if (textInput) {
                                textInput.style.display = 'block'
                                textInput.required = true
                              }
                            }
                          }
                        }}
                      >
                        <option value="">Seleccionar...</option>
                        {field.options?.map((option, optIndex) => (
                          <option key={optIndex} value={option}>{option}</option>
                        ))}
                      </select>
                    ) : field.type === 'conditional' && field.key === 'deudor' ? (
                      <div id="deudor-field">
                        <select
                          name={field.key}
                          required={field.required !== false}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                          style={{ display: 'none' }}
                          id="deudor-socio-select"
                        >
                          <option value="">Seleccionar socio...</option>
                          {distribucionData.socios.map((socio, idx) => (
                            <option key={idx} value={JSON.stringify({ index: idx, nombre: socio.nombre || `Socio ${idx + 1}` })}>
                              {socio.nombre || `Socio ${idx + 1}`}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          name={field.key}
                          placeholder={field.placeholder}
                          required={field.required !== false}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                          id="deudor-text-input"
                        />
                      </div>
                    ) : field.type === 'checkbox' ? (
                      field.key === 'agregarMultiple' ? (
                        <div className="space-y-3">
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              name={field.key}
                              id="agregarMultiple"
                              checked={modoMultipleGastos}
                              onChange={(e) => setModoMultipleGastos(e.target.checked)}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <span className="ml-2 text-sm text-gray-700 font-medium">Agregar varios gastos con descripción y monto</span>
                          </div>
                          
                          {modoMultipleGastos && (
                            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                              <div className="flex justify-between items-center mb-3">
                                <h4 className="font-medium text-blue-800">Detalles de Gastos</h4>
                                <button
                                  type="button"
                                  onClick={() => setGastosDetalle([...gastosDetalle, { id: Date.now(), descripcion: '', monto: 0, categoria: 'Otros', fecha: new Date().toISOString().split('T')[0] }])}
                                  className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                                >
                                  + Agregar Gasto
                                </button>
                              </div>
                              
                              {gastosDetalle.length === 0 ? (
                                <p className="text-sm text-gray-500 text-center py-2">No hay gastos agregados. Haz clic en "Agregar Gasto" para comenzar.</p>
                              ) : (
                                <div className="space-y-3 max-h-60 overflow-y-auto">
                                  {gastosDetalle.map((gasto, index) => (
                                    <div key={gasto.id} className="flex gap-2 items-start bg-white p-2 rounded border">
                                      <div className="flex-1">
                                        <input
                                          type="text"
                                          placeholder="Descripción del gasto"
                                          value={gasto.descripcion}
                                          onChange={(e) => {
                                            const newGastos = [...gastosDetalle]
                                            newGastos[index].descripcion = e.target.value
                                            setGastosDetalle(newGastos)
                                          }}
                                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                        />
                                      </div>
                                      <div className="w-24">
                                        <input
                                          type="number"
                                          placeholder="Monto"
                                          value={gasto.monto}
                                          onChange={(e) => {
                                            const newGastos = [...gastosDetalle]
                                            newGastos[index].monto = parseFloat(e.target.value) || 0
                                            setGastosDetalle(newGastos)
                                          }}
                                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                          step="0.01"
                                          min="0"
                                        />
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const newGastos = gastosDetalle.filter((_, i) => i !== index)
                                          setGastosDetalle(newGastos)
                                        }}
                                        className="text-red-500 hover:text-red-700 p-1"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              
                              {gastosDetalle.length > 0 && (
                                <div className="mt-3 pt-2 border-t border-blue-200 text-right">
                                  <span className="font-medium text-blue-800">Total: RD$ {gastosDetalle.reduce((sum, g) => sum + (parseFloat(g.monto) || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            name={field.key}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="ml-2 text-sm text-gray-600">Activar esta opción</span>
                        </div>
                      )
                    ) : field.type === 'date' ? (
                      <input
                        type="date"
                        name={field.key}
                        required={field.required !== false}
                        defaultValue={field.required !== false ? new Date().toISOString().split('T')[0] : ''}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      />
                    ) : (
                      <input
                        type={field.type}
                        name={field.key}
                        placeholder={field.placeholder}
                        required={field.required !== false}
                        step={field.type === 'number' ? '0.01' : undefined}
                        min={field.type === 'number' ? '0' : undefined}
                        defaultValue={
                          field.type === 'number' && field.key === 'monto' ?
                            (activeModal === 'ventas' ? datosFinancieros.ventasDelMes :
                              activeModal === 'gastos' ? datosFinancieros.gastosGenerales :
                                activeModal === 'cuentasPorCobrar' ? datosFinancieros.cuentasPorCobrar :
                                  activeModal === 'cuentasPorPagar' ? datosFinancieros.cuentasPorPagar :
                                    activeModal === 'efectivo' ? datosFinancieros.efectivoEnCajaYBanco : '') :
                            field.type === 'number' && field.key === 'valorActual' ? datosFinancieros.activosFijos : ''
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      />
                    )}
                  </div>
                )})}

                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={closeFinancialModal}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className={`px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors`}
                  >
                    Guardar
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )
      }

      {/* Modal de Reporte Inventario Unificado */}
      {
        showReportModal && sesion && (
          <ReporteInventarioModal
            isOpen={showReportModal}
            onClose={() => setShowReportModal(false)}
            sesion={sesion}
            cliente={sesion.clienteNegocio}
            contadorData={contadorData}
          />
        )
      }
    </div >
  )
}

export default InventarioDetalleNuevo
