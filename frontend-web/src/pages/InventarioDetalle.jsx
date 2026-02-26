import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { sesionesApi, productosApi, reportesApi, handleApiError } from '../services/api'
import { ArrowLeft, Search, Barcode, Plus, Trash2, Save, X, AlertCircle, Clock, DollarSign, TrendingUp, TrendingDown, Users, CreditCard, Briefcase, PiggyBank, Printer, FileText, Settings, ShoppingCart, Receipt, Wallet, Menu, Smartphone, Download } from 'lucide-react'
import Button from '../components/ui/Button'
import Modal, { ModalFooter } from '../components/ui/Modal'
import toast from 'react-hot-toast'

const InventarioDetalle = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const searchInputRef = useRef(null)
  
  // Estados
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [selectedProducto, setSelectedProducto] = useState(null)
  const [cantidad, setCantidad] = useState('')
  const [showExitModal, setShowExitModal] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [showFinancialModal, setShowFinancialModal] = useState(false)
  const [tiempoTranscurrido, setTiempoTranscurrido] = useState(0)
  const [activeModal, setActiveModal] = useState(null)
  const [modalData, setModalData] = useState({})
  const [showMenuModal, setShowMenuModal] = useState(false)
  const [showDownloadModal, setShowDownloadModal] = useState(false)
  const [showConnectModal, setShowConnectModal] = useState(false)
  const [showSearchEditModal, setShowSearchEditModal] = useState(false)
  const [invSearchTerm, setInvSearchTerm] = useState('')
  const [editValues, setEditValues] = useState({})
  const [pageSpec, setPageSpec] = useState('')
  
  // Datos financieros
  const [datosFinancieros, setDatosFinancieros] = useState({
    ventasDelMes: 0,
    gastosGenerales: 0,
    cuentasPorCobrar: 0,
    cuentasPorPagar: 0,
    efectivoEnCajaYBanco: 0,
    activosFijos: 0
  })

  // Obtener sesión
  const { data: sesion, isLoading, isError, refetch } = useQuery(
    ['sesion-inventario', id],
    () => sesionesApi.getById(id).then((res) => res.data.datos?.sesion || res.data.sesion || res.data),
    { 
      enabled: Boolean(id), 
      onError: handleApiError,
      refetchInterval: 5000, // Actualizar cada 5 segundos
      onSuccess: (data) => {
        // Cargar datos financieros si existen
        if (data?.datosFinancieros) {
          setDatosFinancieros({
            ventasDelMes: data.datosFinancieros.ventasDelMes || 0,
            gastosGenerales: data.datosFinancieros.gastosGenerales || 0,
            cuentasPorCobrar: data.datosFinancieros.cuentasPorCobrar || 0,
            cuentasPorPagar: data.datosFinancieros.cuentasPorPagar || 0,
            efectivoEnCajaYBanco: data.datosFinancieros.efectivoEnCajaYBanco || 0,
            activosFijos: data.datosFinancieros.activosFijos || 0
          })
        }
      }
    }
  )

  const updateProductMutation = useMutation(
    ({ productoId, data }) => sesionesApi.updateProduct(id, productoId, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['sesion-inventario', id])
        toast.success('Producto actualizado')
      },
      onError: handleApiError
    }
  )
  
  // Temporizador
  useEffect(() => {
    if (!sesion?.fecha) return
    
    const calcularTiempo = () => {
      const inicio = new Date(sesion.fecha)
      const ahora = new Date()
      const diferencia = Math.floor((ahora - inicio) / 1000) // segundos
      setTiempoTranscurrido(diferencia)
    }
    
    calcularTiempo()
    const interval = setInterval(calcularTiempo, 1000)
    
    return () => clearInterval(interval)
  }, [sesion?.fecha])
  
  // Formatear tiempo
  const formatearTiempo = (segundos) => {
    const horas = Math.floor(segundos / 3600)
    const minutos = Math.floor((segundos % 3600) / 60)
    const segs = segundos % 60
    return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}:${String(segs).padStart(2, '0')}`
  }

  // Mutación para agregar producto
  const addProductMutation = useMutation(
    (data) => sesionesApi.addProduct(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['sesion-inventario', id])
        toast.success('Producto agregado exitosamente')
        setSelectedProducto(null)
        setCantidad('')
        setSearchTerm('')
        setSearchResults([])
        searchInputRef.current?.focus()
      },
      onError: handleApiError
    }
  )

  // Mutación para remover producto
  const removeProductMutation = useMutation(
    (productoId) => sesionesApi.removeProduct(id, productoId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['sesion-inventario', id])
        toast.success('Producto removido')
      },
      onError: handleApiError
    }
  )

  // Mutación para completar sesión
  const completeMutation = useMutation(
    () => sesionesApi.complete(id),
    {
      onSuccess: () => {
        toast.success('Sesión completada exitosamente')
        navigate('/inventarios')
      },
      onError: handleApiError
    }
  )

  // Mutación para cancelar sesión
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

  // Buscar productos
  useEffect(() => {
    const searchProducts = async () => {
      if (searchTerm.length < 2) {
        setSearchResults([])
        return
      }

      setIsSearching(true)
      try {
        const response = await productosApi.getByCliente(sesion?.clienteNegocio?._id, {
          buscar: searchTerm,
          limite: 10,
          pagina: 1
        })
        setSearchResults(response.data.datos?.productos || [])
      } catch (error) {
        console.error('Error buscando productos:', error)
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }

    const debounce = setTimeout(searchProducts, 300)
    return () => clearTimeout(debounce)
  }, [searchTerm, sesion?.clienteNegocio?._id])

  // Manejar selección de producto
  const handleSelectProduct = (producto) => {
    setSelectedProducto(producto)
    setSearchTerm(producto.nombre)
    setSearchResults([])
    // Enfocar input de cantidad
    setTimeout(() => {
      document.getElementById('cantidad-input')?.focus()
    }, 100)
  }

  // Agregar producto a la sesión
  const handleAddProduct = (e) => {
    e.preventDefault()
    
    if (!selectedProducto) {
      toast.error('Selecciona un producto')
      return
    }

    if (!cantidad || parseFloat(cantidad) <= 0) {
      toast.error('Ingresa una cantidad válida')
      return
    }

    addProductMutation.mutate({
      producto: selectedProducto._id,
      cantidadContada: parseFloat(cantidad)
    })
  }

  // Manejar salida
  const handleExit = () => {
    setShowExitModal(true)
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
        setModalData({
          title: 'Gastos Generales',
          icon: <TrendingDown className="w-6 h-6" />,
          color: 'red',
          fields: [
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
          title: 'Capital',
          icon: <PiggyBank className="w-6 h-6" />,
          color: 'yellow',
          fields: [
            { key: 'tipoCapital', label: 'Tipo de Capital', type: 'select', options: ['Capital Social', 'Utilidades Retenidas', 'Reservas', 'Otros'] },
            { key: 'monto', label: 'Monto', type: 'number', placeholder: '0.00' },
            { key: 'fecha', label: 'Fecha', type: 'date' },
            { key: 'descripcion', label: 'Descripción', type: 'text', placeholder: 'Detalles del capital' }
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
      case 'reporte':
        setModalData({
          title: 'Ver Reporte de Inventario',
          icon: <FileText className="w-6 h-6" />,
          color: 'teal',
          fields: [
            { key: 'tipoReporte', label: 'Tipo de Reporte', type: 'select', options: ['Resumen Ejecutivo', 'Detallado', 'Por Categorías', 'Valorización'] },
            { key: 'fechaInicio', label: 'Fecha de Inicio', type: 'date' },
            { key: 'fechaFin', label: 'Fecha de Fin', type: 'date' },
            { key: 'incluirGraficos', label: 'Incluir Gráficos', type: 'checkbox' }
          ]
        })
        break
      case 'configuracion':
        setModalData({
          title: 'Configuración de Inventario',
          icon: <Settings className="w-6 h-6" />,
          color: 'slate',
          fields: [
            { key: 'unidadPredeterminada', label: 'Unidad Predeterminada', type: 'select', options: ['Unidad', 'Kg', 'Litros', 'Metros', 'Cajas'] },
            { key: 'alertaStockMinimo', label: 'Alerta Stock Mínimo', type: 'number', placeholder: '10' },
            { key: 'redondeoPrecios', label: 'Redondeo de Precios', type: 'select', options: ['Sin redondeo', '2 decimales', '0 decimales'] },
            { key: 'notificaciones', label: 'Activar Notificaciones', type: 'checkbox' }
          ]
        })
        break
      default:
        setModalData({})
    }
  }

  const parsePageSpec = (spec, total) => {
    try {
      const parts = String(spec || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
      const set = new Set()
      for (const part of parts) {
        if (part.includes('-')) {
          const [a, b] = part.split('-').map(n => parseInt(n, 10))
          if (Number.isFinite(a) && Number.isFinite(b)) {
            const start = Math.max(1, Math.min(a, b))
            const end = Math.min(total, Math.max(a, b))
            for (let i = start; i <= end; i++) set.add(i - 1)
          }
        } else {
          const n = parseInt(part, 10)
          if (Number.isFinite(n) && n >= 1 && n <= total) set.add(n - 1)
        }
      }
      return Array.from(set).sort((x, y) => x - y)
    } catch (_) {
      return []
    }
  }

  const handleDownloadPDFPages = async () => {
    try {
      if (!pageSpec.trim()) {
        toast.error('Ingresa las páginas a imprimir, por ejemplo: 3-5 o 3,4,5')
        return
      }
      const { PDFDocument } = await import('pdf-lib')
      const resp = await reportesApi.downloadInventoryPDF(id)
      const ab = await resp.data.arrayBuffer?.() || await new Response(resp.data).arrayBuffer()
      const srcDoc = await PDFDocument.load(ab)
      const total = srcDoc.getPageCount()
      const indices = parsePageSpec(pageSpec, total)
      if (!indices.length) {
        toast.error('Rango de páginas inválido')
        return
      }
      const outDoc = await PDFDocument.create()
      const copied = await outDoc.copyPages(srcDoc, indices)
      copied.forEach(p => outDoc.addPage(p))
      const bytes = await outDoc.save()
      const blob = new Blob([bytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Inventario_${sesion?.numeroSesion || 'inventario'}_pags_${pageSpec.replace(/\s+/g,'')}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Descarga iniciada')
      setShowDownloadModal(false)
    } catch (e) {
      handleApiError(e)
    }
  }

  // Cerrar modal financiero
  const closeFinancialModal = () => {
    setActiveModal(null)
    setModalData({})
  }

  // Manejar envío del formulario financiero
  const handleFinancialSubmit = (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const data = Object.fromEntries(formData.entries())
    
    console.log(`Datos de ${activeModal}:`, data)
    toast.success(`${modalData.title} guardado exitosamente`)
    closeFinancialModal()
    
    // Aquí puedes agregar la lógica para guardar los datos en el backend
  }

  const handleSaveAndExit = () => {
    completeMutation.mutate()
  }

  const handleExitWithoutSave = () => {
    navigate('/inventarios')
  }

  const handleDeleteAndExit = () => {
    if (window.confirm('¿Estás seguro de eliminar esta sesión? Esta acción no se puede deshacer.')) {
      cancelMutation.mutate()
    }
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center z-50">
        <div className="text-center">
          <div className="loading-spinner w-12 h-12 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Cargando sesión...</p>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center z-50">
        <div className="text-center space-y-4">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />
          <p className="text-gray-700 text-lg">No se pudo cargar la sesión</p>
          <div className="space-x-2">
            <Button variant="outline" onClick={() => refetch()}>Reintentar</Button>
            <Button onClick={() => navigate('/inventarios')}>Volver</Button>
          </div>
        </div>
      </div>
    )
  }

  const productosContados = sesion?.productosContados || []
  const valorTotal = sesion?.totales?.valorTotalInventario || 0
  const totalProductos = sesion?.totales?.totalProductosContados || 0

  const filteredList = useMemo(() => {
    const q = invSearchTerm.trim().toLowerCase()
    if (!q) return productosContados
    return productosContados.filter(p =>
      (p.nombreProducto || '').toLowerCase().includes(q) ||
      (p.skuProducto || '').toLowerCase().includes(q)
    )
  }, [invSearchTerm, productosContados])

  const handleDownloadExcel = () => {
    try {
      const rows = productosContados.map(p => [
        p.nombreProducto || '',
        p.skuProducto || '',
        String(p.cantidadContada ?? ''),
        String(p.costoProducto ?? ''),
        String((Number(p.cantidadContada || 0) * Number(p.costoProducto || 0)).toFixed(2))
      ])
      const header = ['Nombre', 'Código', 'Cantidad', 'Costo', 'Total']
      const csv = [header, ...rows]
        .map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(','))
        .join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Listado_${sesion?.numeroSesion || 'inventario'}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Descarga iniciada')
      setShowDownloadModal(false)
    } catch (e) {
      handleApiError(e)
    }
  }

  const handleDownloadPDF = async () => {
    try {
      if (sesion?.estado === 'completada') {
        const resp = await reportesApi.downloadInventoryPDF(id)
        const blob = new Blob([resp.data], { type: 'application/pdf' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `Inventario_${sesion?.numeroSesion || 'inventario'}.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } else {
        const win = window.open('', '_blank')
        const rows = productosContados.map(p => `
          <tr>
            <td>${p.nombreProducto || ''}</td>
            <td>${p.skuProducto || ''}</td>
            <td style="text-align:right">${p.cantidadContada || 0}</td>
            <td style="text-align:right">${p.costoProducto || 0}</td>
            <td style="text-align:right">${(Number(p.cantidadContada || 0) * Number(p.costoProducto || 0)).toFixed(2)}</td>
          </tr>`).join('')
        win.document.write(`<!doctype html><html><head><title>Listado</title>
          <style>body{font-family:Arial;padding:16px} table{width:100%;border-collapse:collapse} th,td{border:1px solid #ddd;padding:8px;font-size:12px} th{background:#f3f4f6;text-align:left}</style>
        </head><body>
          <h3>Listado de Productos - ${sesion?.numeroSesion || ''}</h3>
          <table>
            <thead><tr><th>Nombre</th><th>Código</th><th>Cantidad</th><th>Costo</th><th>Total</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </body></html>`)
        win.document.close()
        win.focus()
        win.print()
      }
      toast.success('Generado')
      setShowDownloadModal(false)
    } catch (e) {
      handleApiError(e)
    }
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-50 to-blue-50 overflow-hidden z-40">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg">
        <div className="px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleExit}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title="Volver"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold">Sesión {sesion?.numeroSesion}</h1>
                <p className="text-blue-100 text-sm">
                  {new Date(sesion?.fecha).toLocaleDateString()} • {sesion?.estado}
                </p>
              </div>
            </div>
            <div className="flex items-end flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-white border border-emerald-400/40 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span className="font-mono text-sm">{formatearTiempo(tiempoTranscurrido)}</span>
                </div>
                <button
                  onClick={() => setShowMenuModal(true)}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                  title="Menú"
                >
                  <Menu className="w-5 h-5" />
                </button>
              </div>
              <div className="text-right">
                <div className="text-2xl sm:text-3xl font-bold">${valorTotal.toLocaleString()}</div>
                <div className="text-blue-100 text-sm">{totalProductos} productos</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="h-[calc(100vh-88px)] overflow-y-auto">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          {/* Cliente Info */}
          <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-blue-500">
            <h3 className="font-semibold text-gray-900 mb-2">Cliente</h3>
            <p className="text-lg font-medium text-gray-800">{sesion?.clienteNegocio?.nombre}</p>
            <p className="text-sm text-gray-600">{sesion?.clienteNegocio?.telefono}</p>
            <p className="text-sm text-gray-600">{sesion?.clienteNegocio?.direccion}</p>
          </div>

          {/* Buscador de Productos */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
              <Search className="w-5 h-5 mr-2 text-blue-600" />
              Agregar Producto
            </h3>
            
            <form onSubmit={handleAddProduct} className="space-y-4">
              <div className="relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por nombre o código de barras..."
                  className="w-full px-4 py-3 pl-12 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                  autoComplete="off"
                />
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                
                {/* Resultados de búsqueda */}
                {searchResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-2 bg-white border-2 border-gray-200 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                    {searchResults.map((producto) => (
                      <button
                        key={producto._id}
                        type="button"
                        onClick={() => handleSelectProduct(producto)}
                        className="w-full px-4 py-3 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition-colors"
                      >
                        <div className="font-medium text-gray-900">{producto.nombre}</div>
                        <div className="text-sm text-gray-600">
                          {producto.categoria} • ${producto.costo} / {producto.unidad}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                
                {isSearching && (
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                    <div className="loading-spinner w-5 h-5"></div>
                  </div>
                )}
              </div>

              {selectedProducto && (
                <div className="flex items-center space-x-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cantidad
                    </label>
                    <input
                      id="cantidad-input"
                      type="number"
                      value={cantidad}
                      onChange={(e) => setCantidad(e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                      required
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Unidad
                    </label>
                    <div className="px-4 py-3 bg-gray-100 rounded-lg text-lg font-medium text-gray-700">
                      {selectedProducto.unidad}
                    </div>
                  </div>
                  <div className="pt-6">
                    <Button
                      type="submit"
                      variant="primary"
                      icon={<Plus className="w-5 h-5" />}
                      loading={addProductMutation.isLoading}
                      className="bg-green-600 hover:bg-green-700 px-6 py-3"
                    >
                      Agregar
                    </Button>
                  </div>
                </div>
              )}
            </form>
          </div>

          {/* Sección de Gestión Financiera */}
          <div className="bg-white rounded-xl shadow-md p-6 mt-8">
            <h3 className="font-semibold text-gray-900 text-lg mb-6 flex items-center">
              <DollarSign className="w-5 h-5 mr-2 text-green-600" />
              Gestión Financiera e Inventario
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 mb-6">
              {/* Fila 1 - Botones Financieros */}
              <button
                onClick={() => openFinancialModal('ventas')}
                className="flex flex-col items-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 rounded-lg border border-blue-200 transition-all duration-200 hover:shadow-md group"
              >
                <ShoppingCart className="w-6 h-6 text-blue-600 mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium text-blue-800">Ventas</span>
              </button>
              
              <button
                onClick={() => openFinancialModal('gastos')}
                className="flex flex-col items-center p-4 bg-gradient-to-br from-red-50 to-red-100 hover:from-red-100 hover:to-red-200 rounded-lg border border-red-200 transition-all duration-200 hover:shadow-md group"
              >
                <TrendingDown className="w-6 h-6 text-red-600 mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium text-red-800">Gastos</span>
              </button>
              
              <button
                onClick={() => openFinancialModal('cuentasPorCobrar')}
                className="flex flex-col items-center p-4 bg-gradient-to-br from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 rounded-lg border border-green-200 transition-all duration-200 hover:shadow-md group"
              >
                <Users className="w-6 h-6 text-green-600 mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium text-green-800 text-center">Cuentas por Cobrar</span>
              </button>
              
              <button
                onClick={() => openFinancialModal('cuentasPorPagar')}
                className="flex flex-col items-center p-4 bg-gradient-to-br from-orange-50 to-orange-100 hover:from-orange-100 hover:to-orange-200 rounded-lg border border-orange-200 transition-all duration-200 hover:shadow-md group"
              >
                <CreditCard className="w-6 h-6 text-orange-600 mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium text-orange-800 text-center">Cuentas por Pagar</span>
              </button>
              
              <button
                onClick={() => openFinancialModal('efectivo')}
                className="flex flex-col items-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200 rounded-lg border border-purple-200 transition-all duration-200 hover:shadow-md group"
              >
                <Wallet className="w-6 h-6 text-purple-600 mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium text-purple-800 text-center">Efectivo</span>
              </button>
              
              <button
                onClick={() => openFinancialModal('activosFijos')}
                className="flex flex-col items-center p-4 bg-gradient-to-br from-indigo-50 to-indigo-100 hover:from-indigo-100 hover:to-indigo-200 rounded-lg border border-indigo-200 transition-all duration-200 hover:shadow-md group"
              >
                <Briefcase className="w-6 h-6 text-indigo-600 mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium text-indigo-800 text-center">Activos Fijos</span>
              </button>
              
              <button
                onClick={() => openFinancialModal('capital')}
                className="flex flex-col items-center p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 hover:from-yellow-100 hover:to-yellow-200 rounded-lg border border-yellow-200 transition-all duration-200 hover:shadow-md group"
              >
                <PiggyBank className="w-6 h-6 text-yellow-600 mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium text-yellow-800">Capital</span>
              </button>
              
              {/* Fila 2 - Botones de Gestión */}
              <button
                onClick={() => openFinancialModal('imprimir')}
                className="flex flex-col items-center p-4 bg-gradient-to-br from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 rounded-lg border border-gray-200 transition-all duration-200 hover:shadow-md group"
              >
                <Printer className="w-6 h-6 text-gray-600 mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium text-gray-800">Imprimir</span>
              </button>
              
              <button
                onClick={() => openFinancialModal('reporte')}
                className="flex flex-col items-center p-4 bg-gradient-to-br from-teal-50 to-teal-100 hover:from-teal-100 hover:to-teal-200 rounded-lg border border-teal-200 transition-all duration-200 hover:shadow-md group"
              >
                <FileText className="w-6 h-6 text-teal-600 mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium text-teal-800">Ver Reporte</span>
              </button>
              
              <button
                onClick={() => openFinancialModal('configuracion')}
                className="flex flex-col items-center p-4 bg-gradient-to-br from-slate-50 to-slate-100 hover:from-slate-100 hover:to-slate-200 rounded-lg border border-slate-200 transition-all duration-200 hover:shadow-md group"
              >
                <Settings className="w-6 h-6 text-slate-600 mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium text-slate-800">Configuración</span>
              </button>
            </div>
          </div>

          {/* Productos Contados */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900 text-lg">Productos contados</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Producto
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cantidad
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Costo
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {productosContados.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
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
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{producto.nombreProducto}</div>
                          <div className="text-xs text-gray-500">{producto.unidadProducto}</div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="text-sm font-semibold text-gray-900">
                            {producto.cantidadContada.toLocaleString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="text-sm text-gray-900">
                            ${producto.costoProducto.toLocaleString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="text-sm font-bold text-blue-600">
                            ${producto.valorTotal.toLocaleString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => {
                              if (window.confirm(`¿Eliminar ${producto.nombreProducto}?`)) {
                                removeProductMutation.mutate(producto.producto)
                              }
                            }}
                            className="text-red-600 hover:text-red-800 transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Menú */}
      <Modal
        isOpen={showMenuModal}
        onClose={() => setShowMenuModal(false)}
        title="Menú de sesión"
        size="sm"
      >
        <div className="space-y-3">
          <button onClick={() => { setShowMenuModal(false); setShowDownloadModal(true) }} className="w-full flex items-center justify-between px-4 py-3 bg-sky-50 border-2 border-sky-200 rounded-lg hover:bg-sky-100">
            <div className="flex items-center space-x-3">
              <Download className="w-5 h-5 text-sky-600" />
              <div>
                <div className="font-medium text-sky-900">Descargar listado</div>
                <div className="text-sm text-sky-700">PDF o Excel</div>
              </div>
            </div>
          </button>
          <button onClick={() => { setShowMenuModal(false); setShowConnectModal(true) }} className="w-full flex items-center justify-between px-4 py-3 bg-violet-50 border-2 border-violet-200 rounded-lg hover:bg-violet-100">
            <div className="flex items-center space-x-3">
              <Smartphone className="w-5 h-5 text-violet-600" />
              <div className="font-medium text-violet-900">Conectar</div>
            </div>
          </button>
          <button onClick={() => { setShowMenuModal(false); setShowSearchEditModal(true) }} className="w-full flex items-center justify-between px-4 py-3 bg-emerald-50 border-2 border-emerald-200 rounded-lg hover:bg-emerald-100">
            <div className="flex items-center space-x-3">
              <Search className="w-5 h-5 text-emerald-600" />
              <div className="font-medium text-emerald-900">Buscar producto</div>
            </div>
          </button>
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowMenuModal(false)}>Cerrar</Button>
        </ModalFooter>
      </Modal>

      {/* Modal Descargar */}
      <Modal
        isOpen={showDownloadModal}
        onClose={() => setShowDownloadModal(false)}
        title="Descargar listado"
        size="sm"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Button onClick={handleDownloadPDF} className="w-full" icon={<Printer className="w-4 h-4" />}>PDF</Button>
            <Button onClick={handleDownloadExcel} className="w-full" variant="secondary" icon={<FileText className="w-4 h-4" />}>Excel</Button>
          </div>
          <div className="pt-2 border-t border-gray-200 space-y-2">
            <label className="block text-sm text-gray-700">Imprimir páginas específicas (ej: 3-5 o 3,4,5)</label>
            <input
              type="text"
              value={pageSpec}
              onChange={(e) => setPageSpec(e.target.value)}
              placeholder="3-5,7"
              className="w-full px-3 py-2 border rounded-lg"
            />
            <Button onClick={handleDownloadPDFPages} className="w-full" icon={<Printer className="w-4 h-4" />}>PDF (páginas)</Button>
          </div>
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowDownloadModal(false)}>Cerrar</Button>
        </ModalFooter>
      </Modal>

      {/* Modal Conectar */}
      <Modal
        isOpen={showConnectModal}
        onClose={() => setShowConnectModal(false)}
        title="Conectar"
        size="sm"
      >
        <div className="space-y-3 text-sm text-gray-700">
          <div>Conecta tu dispositivo para sincronizar y compartir.</div>
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowConnectModal(false)}>Cerrar</Button>
        </ModalFooter>
      </Modal>

      {/* Modal Buscar/Editar producto */}
      <Modal
        isOpen={showSearchEditModal}
        onClose={() => setShowSearchEditModal(false)}
        title="Buscar producto en la lista"
        size="lg"
      >
        <div className="space-y-4">
          <input
            type="text"
            value={invSearchTerm}
            onChange={(e) => setInvSearchTerm(e.target.value)}
            placeholder="Buscar por nombre o código"
            className="w-full px-4 py-2 border rounded-lg"
          />
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {filteredList.map((p) => {
              const key = typeof p.producto === 'object' ? p.producto?._id : p.producto
              const cantidadVal = editValues[key]?.cantidad ?? p.cantidadContada
              const costoVal = editValues[key]?.costo ?? p.costoProducto
              return (
                <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1 pr-4">
                    <div className="font-medium text-gray-900">{p.nombreProducto}</div>
                    <div className="text-xs text-gray-500">{p.skuProducto || 'Sin código'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="number" className="w-24 px-2 py-1 border rounded" value={cantidadVal} onChange={(e)=>setEditValues(v=>({...v,[key]:{...(v[key]||{}),cantidad:e.target.value}}))} />
                    <input type="number" className="w-24 px-2 py-1 border rounded" value={costoVal} onChange={(e)=>setEditValues(v=>({...v,[key]:{...(v[key]||{}),costo:e.target.value}}))} />
                    <Button size="sm" onClick={() => updateProductMutation.mutate({ productoId: key, data: { cantidadContada: parseFloat(cantidadVal)||0, costoProducto: parseFloat(costoVal)||0 } })}>Guardar</Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowSearchEditModal(false)}>Cerrar</Button>
        </ModalFooter>
      </Modal>

      {/* Modal de Salida */}
      <Modal
        isOpen={showExitModal}
        onClose={() => setShowExitModal(false)}
        title="Salir de la sesión"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            ¿Qué deseas hacer con esta sesión de inventario?
          </p>
          
          <div className="space-y-3">
            <button
              onClick={handleSaveAndExit}
              disabled={completeMutation.isLoading || productosContados.length === 0}
              className="w-full flex items-center justify-between px-4 py-3 bg-green-50 border-2 border-green-200 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center space-x-3">
                <Save className="w-5 h-5 text-green-600" />
                <div className="text-left">
                  <div className="font-medium text-green-900">Completar y Guardar</div>
                  <div className="text-sm text-green-700">Finaliza la sesión y guarda los datos</div>
                </div>
              </div>
            </button>

            <button
              onClick={handleExitWithoutSave}
              className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 border-2 border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <ArrowLeft className="w-5 h-5 text-blue-600" />
                <div className="text-left">
                  <div className="font-medium text-blue-900">Salir sin Completar</div>
                  <div className="text-sm text-blue-700">Volver más tarde para continuar</div>
                </div>
              </div>
            </button>

            <button
              onClick={handleDeleteAndExit}
              disabled={cancelMutation.isLoading}
              className="w-full flex items-center justify-between px-4 py-3 bg-red-50 border-2 border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center space-x-3">
                <Trash2 className="w-5 h-5 text-red-600" />
                <div className="text-left">
                  <div className="font-medium text-red-900">Cancelar y Eliminar</div>
                  <div className="text-sm text-red-700">Elimina esta sesión permanentemente</div>
                </div>
              </div>
            </button>
          </div>
        </div>

        <ModalFooter>
          <Button
            variant="outline"
            onClick={() => setShowExitModal(false)}
          >
            Cancelar
          </Button>
        </ModalFooter>
      </Modal>

      {/* Modal Financiero Dinámico */}
      {activeModal && modalData.title && (
        <Modal
          isOpen={true}
          onClose={closeFinancialModal}
          title={modalData.title}
          size="md"
        >
          <form onSubmit={handleFinancialSubmit} className="space-y-4">
            <div className={`flex items-center space-x-3 p-4 bg-${modalData.color}-50 rounded-lg border border-${modalData.color}-200`}>
              <div className={`text-${modalData.color}-600`}>
                {modalData.icon}
              </div>
              <div>
                <h4 className={`font-medium text-${modalData.color}-900`}>{modalData.title}</h4>
                <p className={`text-sm text-${modalData.color}-700`}>Complete la información requerida</p>
              </div>
            </div>
            
            {modalData.fields?.map((field, index) => (
              <div key={index}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {field.label}
                  {field.type !== 'checkbox' && ' *'}
                </label>
                
                {field.type === 'select' ? (
                  <select
                    name={field.key}
                    required={field.type !== 'checkbox'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">Seleccionar...</option>
                    {field.options?.map((option, optIndex) => (
                      <option key={optIndex} value={option}>{option}</option>
                    ))}
                  </select>
                ) : field.type === 'checkbox' ? (
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      name={field.key}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-600">Activar esta opción</span>
                  </div>
                ) : field.type === 'date' ? (
                  <input
                    type="date"
                    name={field.key}
                    required={field.type !== 'checkbox'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                  />
                ) : (
                  <input
                    type={field.type}
                    name={field.key}
                    placeholder={field.placeholder}
                    required={field.type !== 'checkbox'}
                    step={field.type === 'number' ? '0.01' : undefined}
                    min={field.type === 'number' ? '0' : undefined}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                  />
                )}
              </div>
            ))}

            <ModalFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeFinancialModal}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="primary"
                className={`bg-${modalData.color}-600 hover:bg-${modalData.color}-700`}
              >
                Guardar
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default InventarioDetalle





