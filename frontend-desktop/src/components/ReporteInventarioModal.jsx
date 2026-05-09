import React, { useState, useEffect, useRef } from 'react'
import {
    X,
    FileText,
    Download,
    Printer,
    Menu,
    ShoppingCart,
    PieChart,
    Calculator,
    ArrowLeft,
    History,
    ArrowRightLeft,
    Calendar
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import logoInfocolmados from '../img/logo_transparent.png'
import { reportesApi, sesionesApi } from '../services/api'
import { useAuth } from '../context/AuthContext'

// Constantes
const PRODUCTOS_POR_PAGINA = 45

const ReporteInventarioModal = ({ isOpen, onClose, sesion, cliente, contadorData: initialContadorData }) => {
    const { user } = useAuth()
    const [currentReportSection, setCurrentReportSection] = useState('portada')
    const [currentReportPage, setCurrentReportPage] = useState(0)
    const [showReportMenu, setShowReportMenu] = useState(false)
    const [showSelectionModal, setShowSelectionModal] = useState(false)
    const [selectionAction, setSelectionAction] = useState('descargar') // 'descargar' o 'imprimir'
    const reportContentRef = useRef(null)

    // Estados para datos
    const [datosFinancieros, setDatosFinancieros] = useState({
        ventasDelMes: 0,
        gastosGenerales: [],
        cuentasPorCobrar: [],
        cuentasPorPagar: [],
        efectivoEnCajaYBanco: [],
        deudaANegocio: [],
        activosFijos: 0,
        capitalAnterior: 0,
        capitalAnteriorDescripcion: ''
    })

    const [distribucionData, setDistribucionData] = useState({
        numeroSocios: 1,
        socios: [],
        fechaDesde: '',
        fechaHasta: '',
        comentarios: ''
    })

    const [contadorData, setContadorData] = useState({
        costoServicio: 0,
        nombre: '',
        cedula: '',
        telefono: '',
        email: ''
    })
    
    const [sesionPrevia, setSesionPrevia] = useState(null)
    const [showComparativa, setShowComparativa] = useState(false)
    const [tipoComparativa, setTipoComparativa] = useState('balance') // 'balance' o 'distribucion'
    const [fechaProximoInventario, setFechaProximoInventario] = useState('')

    const [isEditable, setIsEditable] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    // Cargar datos de la sesión
    useEffect(() => {
        if (isOpen && sesion) {
            console.log('📄 [REPORTE] Sesión cargada para reporte:', sesion)
            if (sesion.datosFinancieros) {
                const df = sesion.datosFinancieros
                const nuevosDatosFinancieros = {
                    ventasDelMes: df.ventasDelMes || 0,
                    gastosGenerales: Array.isArray(df.gastosGeneralesDetalle)
                        ? df.gastosGeneralesDetalle
                        : Array.isArray(df.gastosGenerales)
                            ? df.gastosGenerales
                            : (df.gastosGenerales ? [{ monto: df.gastosGenerales, descripcion: 'Gastos generales', categoria: 'Otros', nombre: 'Gasto General' }] : []),
                    cuentasPorCobrar: Array.isArray(df.cuentasPorCobrarDetalle)
                        ? df.cuentasPorCobrarDetalle
                        : Array.isArray(df.cuentasPorCobrar)
                            ? df.cuentasPorCobrar
                            : (df.cuentasPorCobrar ? [{ monto: df.cuentasPorCobrar, descripcion: 'Cuenta por cobrar', cliente: 'Cliente', nombre: 'Cuenta por Cobrar' }] : []),
                    cuentasPorPagar: Array.isArray(df.cuentasPorPagarDetalle)
                        ? df.cuentasPorPagarDetalle
                        : Array.isArray(df.cuentasPorPagar)
                            ? df.cuentasPorPagar
                            : (df.cuentasPorPagar ? [{ monto: df.cuentasPorPagar, descripcion: 'Cuenta por pagar', proveedor: 'Proveedor', nombre: 'Cuenta por Pagar' }] : []),
                    efectivoEnCajaYBanco: Array.isArray(df.efectivoEnCajaYBancoDetalle)
                        ? df.efectivoEnCajaYBancoDetalle
                        : Array.isArray(df.efectivoEnCajaYBanco)
                            ? df.efectivoEnCajaYBanco
                            : (df.efectivoEnCajaYBanco ? [{ monto: df.efectivoEnCajaYBanco, descripcion: 'Efectivo en caja', tipoCuenta: 'Caja', nombre: 'Efectivo/Banco' }] : []),
                    deudaANegocio: Array.isArray(df.deudaANegocioDetalle)
                        ? df.deudaANegocioDetalle
                        : Array.isArray(df.deudaANegocio)
                            ? df.deudaANegocio
                            : (df.deudaANegocio ? [{ monto: df.deudaANegocio, descripcion: 'Deuda de socio', deudor: 'Socio', nombre: 'Deuda Socio' }] : []),
                    activosFijos: df.activosFijos || 0,
                    costoMercancia: df.costoMercancia || 0,
                    capitalAnterior: df.capitalAnterior || 0,
                    capitalAnteriorDescripcion: df.capitalAnteriorDescripcion || ''
                }
                setDatosFinancieros(nuevosDatosFinancieros)
            }
            if (sesion.datosFinancieros?.distribucionData) {
                setDistribucionData(sesion.datosFinancieros.distribucionData)
            } else {
                // Fallback a 1 socio genérico si no hay datos
                setDistribucionData({
                    numeroSocios: 1,
                    socios: [{ nombre: 'Socio 1', porcentaje: 100, cuentaAdeudada: 0 }],
                    fechaDesde: '',
                    fechaHasta: '',
                    comentarios: ''
                })
            }
            if (initialContadorData) {
                setContadorData(initialContadorData)
            } else if (sesion.contadorData) {
                setContadorData(sesion.contadorData)
            }
            if (sesion.fechaProximoInventario) {
                setFechaProximoInventario(new Date(sesion.fechaProximoInventario).toISOString().split('T')[0])
            } else {
                setFechaProximoInventario('')
            }

            setCurrentReportSection('portada')
            setCurrentReportPage(0)
            
            // Cargar sesión previa silenciosamente
            cargarSesionPrevia()
        }
    }, [isOpen, sesion, initialContadorData])

    const cargarSesionPrevia = async () => {
        try {
            const clienteId = cliente?.id || sesion?.clienteNegocioId
            if (clienteId && sesion?.id) {
                const response = await sesionesApi.getUltimaPrevia(clienteId, sesion.id)
                const data = handleApiResponse(response)
                setSesionPrevia(data)
            }
        } catch (error) {
            console.error('Error al cargar sesión previa:', error)
        }
    }

    const handleSaveProximaFecha = async (fecha) => {
        setFechaProximoInventario(fecha)
        try {
            await sesionesApi.update(sesion.id, { fechaProximoInventario: fecha })
            toast.success('Fecha de próximo inventario actualizada')
        } catch (error) {
            console.error('Error al guardar fecha próxima:', error)
            toast.error('Error al guardar fecha')
        }
    }

    if (!isOpen) return null

    // --- HELPERS ---
    const formatearMoneda = (valor) => {
        const numero = Number(valor) || 0
        if (isNaN(numero) || !isFinite(numero)) return 'RD$ 0.00'
        return `RD$ ${numero.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }

    const formatearFecha = (fecha) => {
        if (!fecha) return new Date().toLocaleDateString('es-DO', { year: 'numeric', month: '2-digit', day: '2-digit' })
        return new Date(fecha).toLocaleDateString('es-DO', { year: 'numeric', month: '2-digit', day: '2-digit' })
    }

    const arraySource = sesion?.productosContados || sesion?.productos || []
    const productosContados = Array.isArray(arraySource) ? arraySource : []
    
    // Cálculo robusto del valor total recorriendo todos los productos
    const valorTotal = productosContados.reduce((sum, p) => {
        const cant = parseFloat(p.cantidadContada) || 0
        const cost = parseFloat(p.costoProducto) || 0
        return sum + (cant * cost)
    }, 0)

    const getTotalPaginasProductos = () => {
        if (productosContados.length === 0) return 0
        return Math.ceil(productosContados.length / PRODUCTOS_POR_PAGINA)
    }

    const getProductosPaginados = () => {
        const inicio = currentReportPage * PRODUCTOS_POR_PAGINA
        const fin = inicio + PRODUCTOS_POR_PAGINA
        return productosContados.slice(inicio, fin)
    }

    const getReportPageInfo = () => {
        if (currentReportSection === 'portada') return { current: 1, total: 1, label: 'Portada' }
        if (currentReportSection === 'productos') return { current: currentReportPage + 1, total: getTotalPaginasProductos(), label: 'Listado de Productos' }
        if (currentReportSection === 'balance') return { current: 1, total: 1, label: 'Balance General' }
        if (currentReportSection === 'distribucion') return { current: 1, total: 1, label: 'Distribución de Saldo' }
        return { current: 1, total: 1, label: '' }
    }

    // Cálculos financieros simples para visualización
    const getEditableTotal = (key) => {
        const data = datosFinancieros[key]
        if (Array.isArray(data)) {
            return data.reduce((sum, item) => sum + (parseFloat(item.monto) || 0), 0)
        }
        return parseFloat(data) || 0
    }

    const calculateUtilidadesNetas = () => {
        const valorInventario = valorTotal || 0
        const totalActivos = valorInventario + getEditableTotal('cuentasPorCobrar') + getEditableTotal('efectivoEnCajaYBanco') + getEditableTotal('deudaANegocio') + (parseFloat(datosFinancieros.activosFijos) || 0)
        const totalPasivos = getEditableTotal('cuentasPorPagar')
        const capitalActual = totalActivos - totalPasivos
        const capitalAnterior = parseFloat(datosFinancieros.capitalAnterior) || 0

        return capitalActual - capitalAnterior
    }

    const calculateUtilidadesBrutas = () => {
        return calculateUtilidadesNetas() + getEditableTotal('gastosGenerales')
    }

    // Calcular la deuda de un socio dinámicamente desde deudaANegocio
    // Busca por socioIndex (índice en el array de socios) o por nombre del socio
    const calculateDeudaSocio = (socioIdx, socioNombre) => {
        const deudas = datosFinancieros.deudaANegocio
        if (!Array.isArray(deudas)) return 0
        return deudas
            .filter(d => {
                if (!d.esSocio) return false
                // Match por índice numérico (cuando se seleccionó del selector)
                if (d.socioIndex !== undefined && d.socioIndex !== null && String(d.socioIndex) === String(socioIdx)) return true
                // Fallback: match por nombre del socio (case insensitive)
                if (socioNombre && d.deudor && d.deudor.toLowerCase().trim() === socioNombre.toLowerCase().trim()) return true
                return false
            })
            .reduce((sum, d) => sum + (parseFloat(d.monto) || 0), 0)
    }

    // --- ACCIONES DE EDICIÓN ---
    const handleFinancialInputChange = (key, value, index, field) => {
        const newData = { ...datosFinancieros }
        const items = [...(newData[key] || [])]
        items[index] = { ...items[index], [field]: value }
        newData[key] = items
        setDatosFinancieros(newData)
    }

    const handleRemoveItem = (key, index) => {
        const newData = { ...datosFinancieros }
        const items = [...(newData[key] || [])]
        items.splice(index, 1)
        newData[key] = items
        setDatosFinancieros(newData)
    }

    const handleSaveFinancials = async () => {
        setIsSaving(true)
        const toastId = toast.loading('Guardando cambios...')
        try {
            // Transformar datos para el backend (Similar a InventarioDetalleNuevo.jsx)
            const df = { ...datosFinancieros }
            const payload = {
                ...df,
                // Convertir arrays a totales para campos legacy
                gastosGenerales: Array.isArray(df.gastosGenerales) ? df.gastosGenerales.reduce((sum, item) => sum + (parseFloat(item.monto) || 0), 0) : df.gastosGenerales,
                gastosGeneralesDetalle: df.gastosGenerales,

                cuentasPorCobrar: Array.isArray(df.cuentasPorCobrar) ? df.cuentasPorCobrar.reduce((sum, item) => sum + (parseFloat(item.monto) || 0), 0) : df.cuentasPorCobrar,
                cuentasPorCobrarDetalle: df.cuentasPorCobrar,

                cuentasPorPagar: Array.isArray(df.cuentasPorPagar) ? df.cuentasPorPagar.reduce((sum, item) => sum + (parseFloat(item.monto) || 0), 0) : df.cuentasPorPagar,
                cuentasPorPagarDetalle: df.cuentasPorPagar,

                efectivoEnCajaYBanco: Array.isArray(df.efectivoEnCajaYBanco) ? df.efectivoEnCajaYBanco.reduce((sum, item) => sum + (parseFloat(item.monto) || 0), 0) : df.efectivoEnCajaYBanco,
                efectivoEnCajaYBancoDetalle: df.efectivoEnCajaYBanco,

                deudaANegocio: Array.isArray(df.deudaANegocio) ? df.deudaANegocio.reduce((sum, item) => sum + (parseFloat(item.monto) || 0), 0) : df.deudaANegocio,
                deudaANegocioDetalle: df.deudaANegocio,

                // Otros campos (asegurar que sean números o strings limpios)
                ventasDelMes: parseFloat(df.ventasDelMes) || 0,
                activosFijos: parseFloat(df.activosFijos) || 0,
                costoMercancia: parseFloat(df.costoMercancia) || 0,
                capitalAnterior: parseFloat(df.capitalAnterior) || 0,
                capitalAnteriorDescripcion: df.capitalAnteriorDescripcion || ''
            }

            await sesionesApi.updateFinancial(sesion.id || sesion._id, payload)

            toast.success('Cambios guardados correctamente', { id: toastId })
            setIsEditable(false)

            // Refrescar datos localmente si es posible
            if (typeof onClose === 'function') {
                // onClose() 
            }
        } catch (error) {
            console.error('Error al guardar financieros:', error)
            toast.error('Error al guardar los cambios', { id: toastId })
        } finally {
            setIsSaving(false)
        }
    }

    // --- ACCIONES ---

    // ---- IMPRIMIR PAGINA ACTUAL (Compatible con Electron y navegadores) ----
    const imprimirPaginaActual = () => {
        const contenido = document.getElementById('reporte-content-body')
        if (!contenido) {
            toast.error('No se encontró el contenido del reporte')
            return
        }

        const seccionLabel = getReportPageInfo().label
        const clienteNombre = cliente?.nombre || sesion?.clienteNegocio?.nombre || 'CLIENTE'
        const pageTitle = `Reporte: ${clienteNombre} - ${seccionLabel}`

        // Obtener estilos Tailwind vigentes del documento
        const estilosActuales = Array.from(document.styleSheets)
            .filter(s => { try { return s.cssRules && s.href === null } catch { return false } })
            .map(s => Array.from(s.cssRules).map(r => r.cssText).join('\n'))
            .join('\n')

        const htmlCompleto = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>${pageTitle}</title>
  <style>
    ${estilosActuales}
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 12px;
      color: #111;
      background: #fff;
      padding: 24px 32px;
    }
    h1, h2, h3, h4, h5 { font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { padding: 6px 8px; border: 1px solid #ddd; text-align: left; font-size: 11px; }
    th { background: #f0f4f8; font-weight: 700; }
    tr:nth-child(even) { background: #f9fafb; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .font-bold { font-weight: bold; }
    button { display: none !important; }
    @media print {
      body { margin: 0; padding: 10px; }
      @page { margin: 1.5cm; size: A4; }
      button, .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  ${contenido.innerHTML}
</body>
</html>`

        // Crear iframe oculto e inyectarlo en el documento actual
        // (funciona en Electron, donde window.open puede estar bloqueado)
        const idIframe = '__print_frame__'
        const existente = document.getElementById(idIframe)
        if (existente) existente.remove()

        const iframe = document.createElement('iframe')
        iframe.id = idIframe
        iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:900px;height:700px;border:none;visibility:hidden;'
        document.body.appendChild(iframe)

        const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument
        if (!iframeDoc) {
            toast.error('No se pudo preparar la ventana de impresión')
            return
        }

        iframeDoc.open()
        iframeDoc.write(htmlCompleto)
        iframeDoc.close()

        // Esperar que el contenido cargue, luego lanzar diálogo del sistema
        setTimeout(() => {
            try {
                iframe.contentWindow.focus()
                iframe.contentWindow.print()
            } catch (e) {
                console.error('Error al imprimir:', e)
                toast.error('Error al abrir el diálogo de impresión')
            }
            // Limpiar el iframe después de 5s
            setTimeout(() => { iframe.remove() }, 5000)
        }, 600)
    }

    const ejecutarAccionReporte = async (tipoDocumento) => {
        const toastId = toast.loading('Preparando reporte...')
        setShowSelectionModal(false)

        // Si es impresión directa de la página actual
        if (selectionAction === 'imprimir') {
            toast.dismiss(toastId)
            imprimirPaginaActual()
            return
        }

        // Si es descarga: generar PDF desde el frontend con html2canvas + jsPDF
        try {
            const { default: jsPDF } = await import('jspdf')
            const { default: html2canvas } = await import('html2canvas')

            const clienteNombre = cliente?.nombre || sesion?.clienteNegocio?.nombre || 'CLIENTE'
            const nombreArchivo = `Reporte_${clienteNombre}_${sesion?.numeroSesion || ''}.pdf`

            // Determinar qué secciones incluir según tipoDocumento
            const secciones = []
            if (tipoDocumento === 'completo') {
                secciones.push('portada', 'balance', 'distribucion', 'productos')
            } else if (tipoDocumento === 'total') {
                secciones.push('portada', 'balance', 'distribucion')
            } else if (tipoDocumento === 'productos') {
                secciones.push('productos')
            }

            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
            const pageW = pdf.internal.pageSize.getWidth()
            const pageH = pdf.internal.pageSize.getHeight()
            let isFirstPage = true

            for (const seccion of secciones) {
                // Cambiar sección actual para renderizarla
                setCurrentReportSection(seccion)
                if (seccion === 'productos') {
                    const totalPags = getTotalPaginasProductos()
                    for (let pag = 0; pag < totalPags; pag++) {
                        setCurrentReportPage(pag)
                        // Dar tiempo al DOM para actualizar
                        await new Promise(r => setTimeout(r, 250))

                        const el = document.getElementById('reporte-content-body')
                        if (!el) continue
                        const canvas = await html2canvas(el, { scale: 1.5, useCORS: true, logging: false })
                        const imgData = canvas.toDataURL('image/jpeg', 0.92)
                        const ratio = Math.min(pageW / canvas.width, pageH / canvas.height)
                        const imgW = canvas.width * ratio
                        const imgH = canvas.height * ratio

                        if (!isFirstPage) pdf.addPage()
                        pdf.addImage(imgData, 'JPEG', (pageW - imgW) / 2, (pageH - imgH) / 2, imgW, imgH)
                        isFirstPage = false
                    }
                } else {
                    await new Promise(r => setTimeout(r, 250))
                    const el = document.getElementById('reporte-content-body')
                    if (!el) continue
                    const canvas = await html2canvas(el, { scale: 1.5, useCORS: true, logging: false })
                    const imgData = canvas.toDataURL('image/jpeg', 0.92)
                    const ratio = Math.min(pageW / canvas.width, pageH / canvas.height)
                    const imgW = canvas.width * ratio
                    const imgH = canvas.height * ratio

                    if (!isFirstPage) pdf.addPage()
                    pdf.addImage(imgData, 'JPEG', (pageW - imgW) / 2, (pageH - imgH) / 2, imgW, imgH)
                    isFirstPage = false
                }
            }

            pdf.save(nombreArchivo)
            toast.success('Reporte descargado ✅', { id: toastId })

            // Restaurar la vista original
            setCurrentReportSection('portada')
            setCurrentReportPage(0)
        } catch (error) {
            console.error('Error al generar PDF:', error)
            toast.error('Error al generar el PDF: ' + (error?.message || 'Error desconocido'), { id: toastId })
        }
    }

    // --- HELPERS DE RENDERIZADO (funciones normales, NO componentes React) ---
    // IMPORTANTE: Se usa función en lugar de componente (<EditableCategory />) para evitar
    // que React desmonte/remonte los inputs en cada re-render, lo que causaría pérdida de foco.
    const renderEditableCategory = (title, dataKey, colorClass) => {
        const items = Array.isArray(datosFinancieros[dataKey]) ? datosFinancieros[dataKey] : []
        const total = getEditableTotal(dataKey)

        return (
            <div className="mb-4">
                <div className="flex justify-between items-center mb-1">
                    <span className={`font-bold text-xs uppercase tracking-wider ${colorClass}`}>{title}</span>
                    <span className="font-bold text-gray-700">{formatearMoneda(total)}</span>
                </div>

                <div className="space-y-1.5 pl-3 border-l-2 border-gray-100 mt-2">
                    {items.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 group">
                            {isEditable ? (
                                <>
                                    <input
                                        type="text"
                                        value={item.nombre || ''}
                                        onChange={(e) => handleFinancialInputChange(dataKey, e.target.value, idx, 'nombre')}
                                        className="flex-1 text-[11px] px-1.5 py-0.5 border rounded bg-white focus:border-teal-400 focus:outline-none"
                                        placeholder="Descripción"
                                    />
                                    <input
                                        type="number"
                                        value={item.monto || 0}
                                        onChange={(e) => handleFinancialInputChange(dataKey, parseFloat(e.target.value) || 0, idx, 'monto')}
                                        className="w-24 text-[11px] px-1.5 py-0.5 border rounded text-right bg-white focus:border-teal-400 focus:outline-none"
                                    />
                                    <button
                                        onClick={() => handleRemoveItem(dataKey, idx)}
                                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </>
                            ) : (
                                <div className="flex justify-between w-full text-[11px] text-gray-500 italic">
                                    <span>• {item.nombre || (dataKey === 'gastosGenerales' ? 'Gasto' : 'Item')}</span>
                                    <span>{formatearMoneda(item.monto)}</span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    // --- RENDER ---
    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4 overflow-hidden">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white rounded-xl w-full max-w-[95vw] h-[90vh] flex flex-col shadow-2xl overflow-hidden"
                >
                    {/* HEADER - Teal sólido */}
                    <div className="bg-teal-700 text-white px-6 py-4 flex items-center justify-between shadow-md shrink-0">
                        <div className="flex items-center space-x-3">
                            <FileText className="w-6 h-6" />
                            <div>
                                <h2 className="text-xl font-bold">Reporte de Inventario</h2>
                                {(() => {
                                    const info = getReportPageInfo()
                                    return <p className="text-teal-100 text-sm">{info.label} {info.total > 1 ? `- Pág ${info.current}/${info.total}` : ''}</p>
                                })()}
                            </div>
                        </div>

                        <div className="flex items-center space-x-2">
                            <div className="flex items-center bg-white/10 px-3 py-1.5 rounded-lg mr-2 border border-white/20">
                                <input
                                    type="checkbox"
                                    id="enable-edit"
                                    checked={isEditable}
                                    onChange={(e) => setIsEditable(e.target.checked)}
                                    className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                                />
                                <label htmlFor="enable-edit" className="ml-2 text-sm font-medium cursor-pointer select-none">
                                    Edición
                                </label>
                            </div>

                            {isEditable && (
                                <button
                                    onClick={handleSaveFinancials}
                                    disabled={isSaving}
                                    className="px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg text-sm font-bold transition-colors shadow-lg flex items-center gap-2 mr-2"
                                >
                                    {isSaving ? '...' : 'Guardar'}
                                </button>
                            )}

                            <div className="relative">
                                <button onClick={() => setShowReportMenu(!showReportMenu)} className="p-2 hover:bg-white/20 rounded-lg transition-colors flex items-center gap-2">
                                    <Menu className="w-6 h-6" />
                                    <span className="text-sm font-medium hidden sm:inline">Opciones</span>
                                </button>
                                {showReportMenu && (
                                    <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 z-50 text-gray-800 py-2">
                                        <div className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider border-b">Visualización</div>
                                        <button onClick={() => { setCurrentReportSection('portada'); setShowReportMenu(false) }} className="w-full text-left px-4 py-3 hover:bg-teal-50 flex items-center gap-3 transition-colors">
                                            <FileText className="w-4 h-4 text-teal-600" /> Ver Portada
                                        </button>
                                        <button onClick={() => { setCurrentReportSection('productos'); setShowReportMenu(false) }} className="w-full text-left px-4 py-3 hover:bg-teal-50 flex items-center gap-3 transition-colors">
                                            <ShoppingCart className="w-4 h-4 text-teal-600" /> Ver Listado de Productos
                                        </button>
                                        <button onClick={() => { setCurrentReportSection('balance'); setShowReportMenu(false) }} className="w-full text-left px-4 py-3 hover:bg-teal-50 flex items-center gap-3 transition-colors">
                                            <Calculator className="w-4 h-4 text-teal-600" /> Balance General
                                        </button>
                                        <button onClick={() => { setCurrentReportSection('distribucion'); setShowReportMenu(false) }} className="w-full text-left px-4 py-3 hover:bg-teal-50 flex items-center gap-3 border-b transition-colors">
                                            <PieChart className="w-4 h-4 text-teal-600" /> Ver Distribución de Saldo
                                        </button>

                                        <div className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider mt-1 border-b">Acciones Profesionales</div>
                                        <button onClick={() => { setSelectionAction('imprimir'); setShowSelectionModal(true); setShowReportMenu(false) }} className="w-full text-left px-4 py-3 hover:bg-orange-50 flex items-center gap-3 text-orange-700 font-medium transition-colors">
                                            <Printer className="w-4 h-4" /> Imprimir Reporte...
                                        </button>
                                        <button onClick={() => { setSelectionAction('descargar'); setShowSelectionModal(true); setShowReportMenu(false) }} className="w-full text-left px-4 py-3 hover:bg-blue-50 flex items-center gap-3 text-blue-700 font-medium transition-colors">
                                            <Download className="w-4 h-4" /> Descargar Reporte (PDF)...
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* MODAL DE SELECCION DE TIPO DE REPORTE */}
                        <AnimatePresence>
                            {showSelectionModal && (
                                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
                                    >
                                        <div className={`px-6 py-4 flex items-center justify-between text-white ${selectionAction === 'imprimir' ? 'bg-orange-600' : 'bg-blue-600'}`}>
                                            <h3 className="font-bold flex items-center gap-2">
                                                {selectionAction === 'imprimir' ? <Printer className="w-5 h-5" /> : <Download className="w-5 h-5" />}
                                                {selectionAction === 'imprimir' ? 'Opciones de Impresión' : 'Opciones de Descarga'}
                                            </h3>
                                            <button onClick={() => setShowSelectionModal(false)} className="hover:bg-white/20 p-1 rounded-full"><X className="w-5 h-5" /></button>
                                        </div>

                                        <div className="p-6 space-y-4">
                                            {selectionAction === 'imprimir' ? (
                                                // Opciones de impresión: sección actual o todas
                                                <>
                                                    <p className="text-gray-600 text-sm mb-2">¿Qué desea imprimir?</p>

                                                    <button
                                                        onClick={() => { setShowSelectionModal(false); imprimirPaginaActual() }}
                                                        className="w-full p-4 border-2 border-orange-100 rounded-xl hover:border-orange-500 hover:bg-orange-50 text-left transition-all group"
                                                    >
                                                        <div className="font-bold text-gray-800 group-hover:text-orange-700 flex items-center gap-2">
                                                            <Printer className="w-4 h-4" /> Imprimir página actual
                                                        </div>
                                                        <div className="text-xs text-gray-500 italic mt-1">Solo la sección que está viendo ahora: <strong>{getReportPageInfo().label}</strong></div>
                                                    </button>

                                                    <button
                                                        onClick={() => ejecutarAccionReporte('completo')}
                                                        className="w-full p-4 border-2 border-gray-100 rounded-xl hover:border-orange-500 hover:bg-orange-50 text-left transition-all group"
                                                    >
                                                        <div className="font-bold text-gray-800 group-hover:text-orange-700 flex items-center gap-2">
                                                            <FileText className="w-4 h-4" /> Imprimir Inventario Completo (PDF)
                                                        </div>
                                                        <div className="text-xs text-gray-500 italic mt-1">Genera y abre el PDF completo — Portada + Balance + Distribución + Productos</div>
                                                    </button>

                                                    <button
                                                        onClick={() => ejecutarAccionReporte('productos')}
                                                        className="w-full p-4 border-2 border-gray-100 rounded-xl hover:border-orange-500 hover:bg-orange-50 text-left transition-all group"
                                                    >
                                                        <div className="font-bold text-gray-800 group-hover:text-orange-700 flex items-center gap-2">
                                                            <ShoppingCart className="w-4 h-4" /> Solo Listado de Productos (PDF)
                                                        </div>
                                                        <div className="text-xs text-gray-500 italic mt-1">PDF solo con la tabla de mercancía contada</div>
                                                    </button>
                                                </>
                                            ) : (
                                                // Opciones de descarga (sin cambios)
                                                <>
                                                    <p className="text-gray-600 text-sm mb-4">Seleccione el formato y contenido para su reporte profesional:</p>

                                                    <button
                                                        onClick={() => ejecutarAccionReporte('completo')}
                                                        className="w-full p-4 border-2 border-gray-100 rounded-xl hover:border-teal-500 hover:bg-teal-50 text-left transition-all group"
                                                    >
                                                        <div className="font-bold text-gray-800 group-hover:text-teal-700">Inventario Completo</div>
                                                        <div className="text-xs text-gray-500 italic">Portada + Balance + Distribución + Listado de Productos</div>
                                                    </button>

                                                    <button
                                                        onClick={() => ejecutarAccionReporte('total')}
                                                        className="w-full p-4 border-2 border-gray-100 rounded-xl hover:border-teal-500 hover:bg-teal-50 text-left transition-all group"
                                                    >
                                                        <div className="font-bold text-gray-800 group-hover:text-teal-700">Reporte Total (Resumen)</div>
                                                        <div className="text-xs text-gray-500 italic">Portada + Balance General + Distribución de Saldo</div>
                                                    </button>

                                                    <button
                                                        onClick={() => ejecutarAccionReporte('productos')}
                                                        className="w-full p-4 border-2 border-gray-100 rounded-xl hover:border-teal-500 hover:bg-teal-50 text-left transition-all group"
                                                    >
                                                        <div className="font-bold text-gray-800 group-hover:text-teal-700">Solo Listado de Productos</div>
                                                        <div className="text-xs text-gray-500 italic">Tabla detallada de mercancía contada</div>
                                                    </button>
                                                </>
                                            )}
                                        </div>

                                        <div className="bg-gray-50 px-6 py-4 flex justify-end">
                                            <button onClick={() => setShowSelectionModal(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors">Cancelar</button>
                                        </div>
                                    </motion.div>
                                </div>
                            )}
                        </AnimatePresence>

                        <button onClick={onClose} className="ml-4 p-2 hover:bg-white/20 rounded-full transition-colors">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* CONTENT */}
                    <div className="flex-1 overflow-y-auto bg-gray-100 p-8" id="reporte-scroll-container">
                        <div id="reporte-content-body" className="bg-white shadow-lg mx-auto max-w-4xl p-10 min-h-[1000px] relative text-gray-800">

                            {currentReportSection === 'portada' && (
                                <div className="flex flex-col h-full min-h-[900px] relative py-8">

                                    {/* CENTRO: Nombre del cliente + Logo + Contador */}
                                    <div className="flex-1 flex flex-col items-center justify-center text-center">
                                        <h1 className="text-5xl font-extrabold text-gray-900 tracking-widest mb-4 uppercase">
                                            {(cliente?.nombre || sesion?.clienteNegocio?.nombre || 'CLIENTE').toUpperCase()}
                                        </h1>

                                        {/* Logo grande en el centro */}
                                        <div className="my-10 flex justify-center">
                                            <img src={logoInfocolmados} alt="Logo" className="h-80 w-80 object-contain" />
                                        </div>

                                        {/* Inventario elaborado por - ahora en el centro */}
                                        <div className="mt-4 border-t border-gray-200 pt-6">
                                            <div className="text-sm text-gray-500 mb-1">Inventario elaborado por:</div>
                                            <h2 className="text-2xl font-bold text-gray-800 uppercase">
                                                {(sesion?.usuario?.nombre || 'ADMINISTRADOR').toUpperCase()}
                                            </h2>
                                        </div>
                                    </div>

                                    {/* ABAJO: Fecha Inventario y Costo del Servicio pegado al fondo */}
                                    <div className="flex justify-between border-t-4 border-teal-600 pt-4 mt-4">
                                        <div className="flex gap-12">
                                            <div>
                                                <div className="font-semibold text-gray-700 text-base">Fecha Inventario</div>
                                                <div className="text-xl font-bold text-gray-900">{formatearFecha(sesion?.fecha)}</div>
                                            </div>
                                            <div>
                                                <div className="font-semibold text-gray-700 text-base flex items-center gap-2">
                                                    Próximo Inventario
                                                    {isEditable && <Calendar className="w-3 h-3 text-teal-600" />}
                                                </div>
                                                {isEditable ? (
                                                    <input
                                                        type="date"
                                                        value={fechaProximoInventario}
                                                        onChange={(e) => handleSaveProximaFecha(e.target.value)}
                                                        className="text-lg font-bold text-teal-800 border rounded px-2 py-1 bg-teal-50 focus:outline-none focus:border-teal-500"
                                                    />
                                                ) : (
                                                    <div className="text-xl font-bold text-teal-700">
                                                        {fechaProximoInventario ? formatearFecha(fechaProximoInventario) : 'Pendiente'}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-semibold text-gray-700 text-base">Costo del Servicio</div>
                                            <div className="text-2xl font-extrabold text-teal-700">{formatearMoneda(contadorData.costoServicio)}</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {currentReportSection === 'productos' && (
                                <div>
                                    <div className="text-center mb-6 border-b pb-4">
                                        <h2 className="text-3xl font-bold text-gray-800">Listado de Productos</h2>
                                        <p className="text-gray-500 text-base mt-1">{cliente?.nombre} - {formatearFecha(sesion?.fecha)}</p>
                                    </div>

                                    <table className="w-full border-collapse">
                                        <thead>
                                            <tr className="bg-gray-100 border-y-2 border-gray-300">
                                                <th className="py-4 px-3 text-left font-bold text-gray-800 text-base">Producto</th>
                                                <th className="py-4 px-3 text-center font-bold text-gray-800 text-base">Cant.</th>
                                                <th className="py-4 px-3 text-right font-bold text-gray-800 text-base">Costo</th>
                                                <th className="py-4 px-3 text-right font-bold text-gray-800 text-base">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {getProductosPaginados().map((p, i) => (
                                                <tr key={i} className={`border-b border-gray-200 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                                                    <td className="py-3 px-3 text-gray-900 text-base font-medium">{p.nombreProducto || p.nombre}</td>
                                                    <td className="py-3 px-3 text-center font-semibold text-base">{Number(p.cantidadContada || 0).toFixed(2)}</td>
                                                    <td className="py-3 px-3 text-right text-base">{Number(p.costoProducto || 0).toFixed(2)}</td>
                                                    <td className="py-3 px-3 text-right font-bold text-base text-teal-700">{formatearMoneda((Number(p.cantidadContada || 0) * Number(p.costoProducto || 0)))}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr>
                                                <td colSpan="4" className="pt-4">
                                                    <div className="flex justify-between items-end border-t-2 border-gray-800 pt-3">
                                                        <div className="text-sm text-gray-500">
                                                            Usuario: {sesion?.usuario?.nombre || 'ADMINISTRADOR'}<br />
                                                            Teléfono: {sesion?.usuario?.telefono || '1234567890'}
                                                        </div>
                                                        <div className="text-right text-base">
                                                            <div>Líneas {(currentReportPage * PRODUCTOS_POR_PAGINA) + 1} a {(currentReportPage * PRODUCTOS_POR_PAGINA) + getProductosPaginados().length}</div>
                                                            <div className="font-bold">Total Página: {formatearMoneda(getProductosPaginados().reduce((sum, p) => sum + ((Number(p.cantidadContada || 0) * Number(p.costoProducto || 0))), 0))}</div>
                                                            <div className="font-bold text-teal-700 text-lg">Total Reporte: {formatearMoneda(valorTotal)}</div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right text-sm text-gray-400 mt-2">Pág. {currentReportPage + 1} de {getTotalPaginasProductos()}</div>
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}

                            {currentReportSection === 'balance' && (
                                <div>
                                    <div className="text-center mb-10">
                                        <h2 className="text-2xl font-bold uppercase text-gray-900 mb-1">{(cliente?.nombre || 'CLIENTE').toUpperCase()}</h2>
                                        <div className="flex items-center justify-center gap-4 mb-2">
                                            <h3 className="text-lg text-teal-700 font-semibold">Balance General</h3>
                                            <button 
                                                onClick={() => { setTipoComparativa('balance'); setShowComparativa(true) }}
                                                className="p-1.5 bg-teal-50 text-teal-600 rounded-full hover:bg-teal-100 transition-colors shadow-sm no-print"
                                                title="Comparar con balance anterior"
                                            >
                                                <ArrowRightLeft className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <p className="text-sm text-gray-500">Al {formatearFecha(sesion?.fecha)}</p>
                                        <p className="text-xs text-gray-400">(En RD $)</p>
                                    </div>

                                    <div className="border-t border-gray-200 mb-6"></div>

                                    <div className="grid grid-cols-2 gap-x-12 gap-y-8">
                                        {/* COLUMNA ACTIVOS */}
                                        <div>
                                            <h4 className="font-bold text-blue-700 border-b-2 border-blue-600 mb-4 pb-1">ACTIVOS</h4>

                                            <h5 className="font-bold text-gray-700 mb-2">CORRIENTES</h5>
                                            <div className="space-y-4 text-sm mb-6">
                                                {renderEditableCategory('EFECTIVO', 'efectivoEnCajaYBanco', 'text-gray-900')}
                                                {renderEditableCategory('CUENTAS POR COBRAR', 'cuentasPorCobrar', 'text-gray-900')}

                                                <div className="flex justify-between mt-2">
                                                    <span className="font-bold text-xs uppercase tracking-wider text-gray-900">INVENTARIO DE MERCANCIA</span>
                                                    <span className="font-bold text-gray-700">{formatearMoneda(valorTotal)}</span>
                                                </div>

                                                {renderEditableCategory('DEUDA A NEGOCIO', 'deudaANegocio', 'text-gray-900')}

                                                <div className="flex justify-between font-bold border-t-2 border-gray-300 pt-2 mt-4 text-gray-900">
                                                    <span>TOTAL CORRIENTES</span>
                                                    <span>{formatearMoneda(getEditableTotal('efectivoEnCajaYBanco') + getEditableTotal('cuentasPorCobrar') + valorTotal + getEditableTotal('deudaANegocio'))}</span>
                                                </div>
                                            </div>

                                            <h5 className="font-bold text-gray-700 mb-2">FIJOS</h5>
                                            <div className="space-y-1 text-sm mb-4">
                                                <div className="flex justify-between"><span>ACTIVOS FIJOS</span><span className="font-medium">{formatearMoneda(Number(datosFinancieros.activosFijos) || 0)}</span></div>
                                                <div className="flex justify-between font-bold border-t border-gray-300 pt-1 mt-2 text-gray-900"><span>TOTAL FIJOS</span><span>{formatearMoneda(Number(datosFinancieros.activosFijos) || 0)}</span></div>
                                            </div>

                                            <div className="flex justify-between font-bold text-base mt-8 border-t-2 border-gray-800 pt-2">
                                                <span>TOTAL ACTIVOS</span>
                                                <span>{formatearMoneda(getEditableTotal('efectivoEnCajaYBanco') + getEditableTotal('cuentasPorCobrar') + valorTotal + getEditableTotal('deudaANegocio') + (Number(datosFinancieros.activosFijos) || 0))}</span>
                                            </div>
                                        </div>

                                        {/* COLUMNA PASIVOS Y CAPITAL */}
                                        <div>
                                            <h4 className="font-bold text-red-700 border-b-2 border-red-600 mb-4 pb-1">PASIVOS Y CAPITAL</h4>

                                            <h5 className="font-bold text-gray-700 mb-2">PASIVOS</h5>
                                            <div className="space-y-4 text-sm mb-6">
                                                {renderEditableCategory('CUENTAS POR PAGAR', 'cuentasPorPagar', 'text-gray-900')}
                                                <div className="flex justify-between font-bold border-t-2 border-gray-300 pt-2 mt-4 text-gray-900">
                                                    <span>TOTAL PASIVOS</span>
                                                    <span>{formatearMoneda(getEditableTotal('cuentasPorPagar'))}</span>
                                                </div>
                                            </div>

                                            <h5 className="font-bold text-gray-700 mb-2">CAPITAL</h5>
                                            <div className="space-y-1 text-sm mb-4">
                                                {(() => {
                                                    const totalActivos = getEditableTotal('efectivoEnCajaYBanco') + getEditableTotal('cuentasPorCobrar') + valorTotal + getEditableTotal('deudaANegocio') + (Number(datosFinancieros.activosFijos) || 0);
                                                    const totalPasivos = getEditableTotal('cuentasPorPagar');
                                                    const capitalAnterior = parseFloat(datosFinancieros.capitalAnterior) || 0;
                                                    const utilidadNeta = calculateUtilidadesNetas();
                                                    const capitalTotal = totalActivos - totalPasivos;

                                                    return (
                                                        <div className="space-y-1">
                                                            <div className="flex justify-between">
                                                                <div className="flex flex-col">
                                                                    <span>CAPITAL ANTERIOR</span>
                                                                    {datosFinancieros.capitalAnteriorDescripcion && (
                                                                        <span className="text-[10px] text-gray-400 italic font-normal">
                                                                            ({datosFinancieros.capitalAnteriorDescripcion})
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <span className="font-medium">{formatearMoneda(capitalAnterior)}</span>
                                                            </div>
                                                            <div className="flex justify-between"><span>UTILIDAD DEL EJERCICIO</span><span className="font-medium text-green-700">{formatearMoneda(utilidadNeta)}</span></div>
                                                            <div className="flex justify-between font-bold border-t border-gray-300 pt-1 mt-2"><span>TOTAL CAPITAL</span><span className="font-bold">{formatearMoneda(capitalTotal)}</span></div>
                                                        </div>
                                                    )
                                                })()}
                                            </div>

                                            <div className="flex justify-between font-bold text-base mt-8 border-t-2 border-gray-800 pt-2">
                                                <span>TOTAL PASIVOS + CAPITAL</span>
                                                <span>{formatearMoneda(getEditableTotal('efectivoEnCajaYBanco') + getEditableTotal('cuentasPorCobrar') + valorTotal + getEditableTotal('deudaANegocio') + (Number(datosFinancieros.activosFijos) || 0))}</span>
                                            </div>

                                            {/* ESTADO DE RESULTADOS - VENTAS Y GASTOS */}
                                            <div className="mt-8 bg-blue-50 p-4 rounded border border-blue-100">
                                                <h5 className="font-bold text-blue-700 mb-3 border-b border-blue-200 pb-1">VENTAS Y GASTOS</h5>
                                                <div className="space-y-4 text-sm">
                                                    <div className="flex justify-between text-green-700 font-bold text-base">
                                                        <span>VENTAS DEL MES</span>
                                                        <span>{formatearMoneda(datosFinancieros.ventasDelMes)}</span>
                                                    </div>

                                                    <div className="flex justify-between text-gray-700 font-medium">
                                                        <span>COSTO MERCANCÍA</span>
                                                        {(() => {
                                                            const ventas = Number(datosFinancieros.ventasDelMes) || 0
                                                            const bruta = calculateUtilidadesBrutas()
                                                            const cogs = ventas - bruta
                                                            return <span>({formatearMoneda(cogs)})</span>
                                                        })()}
                                                    </div>

                                                    <div className="flex justify-between text-blue-700 font-bold border-t border-blue-200 pt-2">
                                                        <span>UTILIDAD BRUTA</span>
                                                        <span>{formatearMoneda(calculateUtilidadesBrutas())}</span>
                                                    </div>

                                                    <div className="flex justify-between text-red-600 font-medium">
                                                        <span>GASTOS GENERALES</span>
                                                        <span>({formatearMoneda(getEditableTotal('gastosGenerales'))})</span>
                                                    </div>

                                                    <div className="flex justify-between font-extrabold text-gray-900 text-lg border-t-2 border-blue-200 pt-2 mt-2">
                                                        <span>UTILIDAD NETA</span>
                                                        <span>{formatearMoneda(calculateUtilidadesNetas())}</span>
                                                    </div>

                                                    {/* Porcentajes de Rentabilidad */}
                                                    <div className="grid grid-cols-2 gap-4 mt-2 pt-2 border-t border-blue-100 italic font-medium">
                                                        {(() => {
                                                            const ventas = Number(datosFinancieros.ventasDelMes) || 0
                                                            const neta = calculateUtilidadesNetas()
                                                            const bruta = calculateUtilidadesBrutas()

                                                            const pBruto = ventas > 0 ? (bruta / ventas) * 100 : 0
                                                            const pNeto = ventas > 0 ? (neta / ventas) * 100 : 0

                                                            return (
                                                                <>
                                                                    <div className="flex justify-between text-blue-800">
                                                                        <span>% BRUTO:</span>
                                                                        <span>{pBruto.toFixed(2)}%</span>
                                                                    </div>
                                                                    <div className="flex justify-between text-teal-800">
                                                                        <span>% NETO:</span>
                                                                        <span>{pNeto.toFixed(2)}%</span>
                                                                    </div>
                                                                </>
                                                            )
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>

                                        </div>
                                    </div>

                                    {/* Footer Balance */}
                                    <div className="mt-20 text-center text-xs text-gray-500">
                                        <div className="font-bold text-gray-800">Contador: {sesion?.usuario?.nombre || 'ADMINISTRADOR'}</div>
                                        <div>Teléfono: {sesion?.usuario?.telefono || '1234567890'}</div>
                                        <div className="mt-4 max-w-2xl mx-auto text-gray-400 text-[10px] leading-tight">
                                            Solo somos responsables de los datos introducidos en el inventario de mercancía. Los resultados del balance del negocio son responsabilidad del propietario del negocio resultados del inventario y reconocimiento del propietario estos datos numéricos reales según su desempeño del negocio en el periodo evaluado.
                                        </div>
                                    </div>
                                </div>
                            )}

                            {currentReportSection === 'distribucion' && (
                                <div>
                                    <div className="text-center mb-8">
                                        <h2 className="text-2xl font-bold uppercase text-gray-900 mb-1">{(cliente?.nombre || 'CLIENTE').toUpperCase()}</h2>
                                        <div className="flex items-center justify-center gap-4 mb-2">
                                            <h3 className="text-lg text-teal-700 font-semibold">Distribución de Saldo</h3>
                                            <button 
                                                onClick={() => { setTipoComparativa('distribucion'); setShowComparativa(true) }}
                                                className="p-1.5 bg-teal-50 text-teal-600 rounded-full hover:bg-teal-100 transition-colors shadow-sm no-print"
                                                title="Comparar con distribución anterior"
                                            >
                                                <History className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <p className="text-sm text-gray-500">Al {formatearFecha(sesion?.fecha)}</p>
                                        <p className="text-xs text-gray-400">(En RD $)</p>
                                    </div>

                                    <div className="bg-gray-50 p-4 rounded-lg mb-8 border border-gray-100 flex justify-between items-center text-sm">
                                        <div>
                                            <span className="font-bold text-gray-700">Total de Utilidades Netas:</span>
                                            <span className="ml-2 font-bold text-gray-900">{formatearMoneda(calculateUtilidadesNetas())}</span>
                                        </div>
                                        <div>
                                            <span className="font-bold text-gray-700">Número de Socios:</span>
                                            <span className="ml-2 font-bold text-gray-900">{distribucionData.socios.length}</span>
                                        </div>
                                    </div>

                                    <h4 className="font-bold text-gray-800 mb-4 border-b pb-2">Distribución por Socios</h4>

                                    <table className="w-full text-sm border-collapse mb-10">
                                        <thead>
                                            <tr className="bg-gray-50 border-y border-gray-200 text-xs uppercase tracking-wider">
                                                <th className="py-3 px-2 text-left font-bold text-gray-700">Socio</th>
                                                <th className="py-3 px-2 text-center font-bold text-gray-700">Porcentaje</th>
                                                <th className="py-3 px-2 text-right font-bold text-gray-700">Utilidad del Periodo</th>
                                                <th className="py-3 px-2 text-right font-bold text-gray-700">Utilidad Acumulada</th>
                                                <th className="py-3 px-2 text-right font-bold text-gray-700">Cuenta Adeudada</th>
                                                <th className="py-3 px-2 text-right font-bold text-gray-700">Saldo Neto</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {distribucionData.socios.map((socio, idx) => {
                                                const utilidadTotal = calculateUtilidadesNetas();
                                                const porcentaje = Number(socio.porcentaje) || 0;
                                                const utilidadSocio = (utilidadTotal * porcentaje) / 100;
                                                // Calcular deuda dinámicamente desde deudaANegocio
                                                const deuda = calculateDeudaSocio(idx, socio.nombre);
                                                const saldo = utilidadSocio - deuda;

                                                return (
                                                    <tr key={idx} className="border-b border-gray-100">
                                                        <td className="py-4 px-2 font-bold text-gray-800">{socio.nombre || `Socio ${idx + 1}`}</td>
                                                        <td className="py-4 px-2 text-center text-gray-600">{porcentaje.toFixed(2)}%</td>
                                                        <td className="py-4 px-2 text-right font-medium">{formatearMoneda(utilidadSocio)}</td>
                                                        <td className="py-4 px-2 text-right font-medium">{formatearMoneda(utilidadSocio)}</td>
                                                        <td className="py-4 px-2 text-right text-red-500">{formatearMoneda(deuda)}</td>
                                                        <td className={`py-4 px-2 text-right font-bold ${saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                            {formatearMoneda(saldo)}
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                            <tr className="bg-gray-100 font-bold border-t-2 border-gray-200">
                                                <td className="py-3 px-2 text-gray-900">TOTAL</td>
                                                <td className="py-3 px-2 text-center text-gray-900">100.00%</td>
                                                <td className="py-3 px-2 text-right text-gray-900">{formatearMoneda(calculateUtilidadesNetas())}</td>
                                                <td className="py-3 px-2 text-right text-gray-900">{formatearMoneda(calculateUtilidadesNetas())}</td>
                                                <td className="py-3 px-2 text-right text-red-600 font-bold">{formatearMoneda(distribucionData.socios.reduce((a, s, i) => a + calculateDeudaSocio(i, s.nombre), 0))}</td>
                                                <td className="py-3 px-2 text-right text-green-700 font-bold">{formatearMoneda(calculateUtilidadesNetas() - distribucionData.socios.reduce((a, s, i) => a + calculateDeudaSocio(i, s.nombre), 0))}</td>
                                            </tr>
                                        </tbody>
                                    </table>

                                    <h4 className="font-bold text-gray-800 mb-20">Firmas</h4>

                                    <div className="flex justify-around pt-10">
                                        {distribucionData.socios.map((socio, idx) => (
                                            <div key={idx} className="border-t border-gray-400 w-1/3 text-center text-sm pt-2 text-gray-600">
                                                {socio.nombre || `Socio ${idx + 1}`}<br />Firma y Cédula
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer: Navegación de páginas + Imprimir página actual */}
                    <div className="bg-white border-t px-6 py-3 flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-2">
                            {currentReportSection === 'productos' && getTotalPaginasProductos() > 1 && (
                                <>
                                    <button
                                        onClick={() => setCurrentReportPage(p => Math.max(0, p - 1))}
                                        disabled={currentReportPage === 0}
                                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 text-sm font-medium"
                                    >
                                        <ArrowLeft className="w-4 h-4" /> Anterior
                                    </button>
                                    <span className="text-sm font-medium text-gray-600 px-3">
                                        Pág. {currentReportPage + 1} de {getTotalPaginasProductos()}
                                    </span>
                                    <button
                                        onClick={() => setCurrentReportPage(p => Math.min(getTotalPaginasProductos() - 1, p + 1))}
                                        disabled={currentReportPage >= getTotalPaginasProductos() - 1}
                                        className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-50 text-sm font-medium"
                                    >
                                        Siguiente <ArrowLeft className="w-4 h-4 rotate-180" />
                                    </button>
                                </>
                            )}
                        </div>

                        {/* Botón rápido imprimir página actual */}
                        <button
                            onClick={imprimirPaginaActual}
                            className="flex items-center gap-2 px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-bold transition-colors shadow"
                            title={`Imprimir: ${getReportPageInfo().label}`}
                        >
                            <Printer className="w-4 h-4" />
                            Imprimir esta página
                        </button>
                    </div>

                    {/* MODAL DE COMPARATIVA LADO A LADO */}
                    <AnimatePresence>
                        {showComparativa && (
                            <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 20 }}
                                    className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden"
                                >
                                    <div className="bg-teal-800 text-white px-6 py-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <ArrowRightLeft className="w-6 h-6" />
                                            <div>
                                                <h3 className="font-bold text-lg">Comparativa Histórica</h3>
                                                <p className="text-teal-100 text-xs uppercase tracking-widest">{tipoComparativa === 'balance' ? 'Balance General' : 'Distribución de Saldo'}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => setShowComparativa(false)} className="hover:bg-white/20 p-2 rounded-full transition-colors"><X className="w-6 h-6" /></button>
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                                        {!sesionPrevia && (
                                            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg mb-6 flex items-center gap-3 text-sm font-medium">
                                                <History className="w-5 h-5" />
                                                No se encontró un inventario anterior completado. Se comparará con valores en cero.
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 gap-8 h-full">
                                            {/* PANEL ANTERIOR */}
                                            <div className="flex flex-col">
                                                <div className="bg-gray-200 text-gray-700 px-4 py-2 rounded-t-lg font-bold text-sm flex justify-between">
                                                    <span>ANTERIOR: {sesionPrevia ? formatearFecha(sesionPrevia.fecha) : 'N/A'}</span>
                                                    <span>INV: {sesionPrevia?.numeroSesion || '---'}</span>
                                                </div>
                                                <div className="flex-1 bg-white border-2 border-gray-100 p-6 rounded-b-lg shadow-sm">
                                                    {tipoComparativa === 'balance' ? (
                                                        <ComparativaBalanceContent 
                                                            sesion={sesionPrevia} 
                                                            valorInventario={sesionPrevia?.totales?.valorTotalInventario || 0}
                                                            formatearMoneda={formatearMoneda}
                                                        />
                                                    ) : (
                                                        <ComparativaDistribucionContent 
                                                            sesion={sesionPrevia}
                                                            formatearMoneda={formatearMoneda}
                                                        />
                                                    )}
                                                </div>
                                            </div>

                                            {/* PANEL ACTUAL */}
                                            <div className="flex flex-col">
                                                <div className="bg-teal-600 text-white px-4 py-2 rounded-t-lg font-bold text-sm flex justify-between">
                                                    <span>ACTUAL: {formatearFecha(sesion?.fecha)}</span>
                                                    <span>INV: {sesion?.numeroSesion || '---'}</span>
                                                </div>
                                                <div className="flex-1 bg-white border-2 border-teal-50 p-6 rounded-b-lg shadow-md">
                                                    {tipoComparativa === 'balance' ? (
                                                        <ComparativaBalanceContent 
                                                            sesion={sesion} 
                                                            valorInventario={valorTotal}
                                                            formatearMoneda={formatearMoneda}
                                                        />
                                                    ) : (
                                                        <ComparativaDistribucionContent 
                                                            sesion={sesion}
                                                            formatearMoneda={formatearMoneda}
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="bg-gray-100 px-6 py-4 flex justify-end gap-3">
                                        <button 
                                            onClick={() => setShowComparativa(false)}
                                            className="px-6 py-2 bg-white border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors"
                                        >
                                            Cerrar Comparativa
                                        </button>
                                    </div>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </div>
        </AnimatePresence>
    )
}

// --- COMPONENTES AUXILIARES PARA COMPARATIVA (Internos) ---

const ComparativaBalanceContent = ({ sesion, valorInventario, formatearMoneda }) => {
    if (!sesion) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 italic">
                <Calculator className="w-12 h-12 mb-2 opacity-20" />
                No hay datos previos
            </div>
        )
    }

    const df = sesion.datosFinancieros || {}
    const getSum = (key) => {
        const data = df[key] || df[`${key}Detalle`] || []
        if (Array.isArray(data)) return data.reduce((a, b) => a + (parseFloat(b.monto) || 0), 0)
        return parseFloat(data) || 0
    }

    const efectivo = getSum('efectivoEnCajaYBanco')
    const cobrar = getSum('cuentasPorCobrar')
    const deuda = getSum('deudaANegocio')
    const activosFijos = parseFloat(df.activosFijos) || 0
    
    const pagar = getSum('cuentasPorPagar')
    
    const totalActivos = efectivo + cobrar + valorInventario + deuda + activosFijos
    const totalPasivos = pagar
    const capital = totalActivos - totalPasivos

    return (
        <div className="space-y-6 text-sm">
            <div className="space-y-2">
                <h4 className="font-bold text-blue-600 border-b pb-1 text-xs uppercase tracking-wider">Activos</h4>
                <div className="flex justify-between"><span>Efectivo:</span><span className="font-medium">{formatearMoneda(efectivo)}</span></div>
                <div className="flex justify-between"><span>Cuentas por Cobrar:</span><span className="font-medium">{formatearMoneda(cobrar)}</span></div>
                <div className="flex justify-between"><span>Inventario:</span><span className="font-medium">{formatearMoneda(valorInventario)}</span></div>
                <div className="flex justify-between font-bold border-t pt-1 mt-2 text-gray-800">
                    <span>TOTAL ACTIVOS:</span>
                    <span>{formatearMoneda(totalActivos)}</span>
                </div>
            </div>

            <div className="space-y-2">
                <h4 className="font-bold text-red-600 border-b pb-1 text-xs uppercase tracking-wider">Pasivos y Capital</h4>
                <div className="flex justify-between"><span>Cuentas por Pagar:</span><span className="font-medium">{formatearMoneda(pagar)}</span></div>
                <div className="flex justify-between font-bold text-gray-800"><span>Capital:</span><span>{formatearMoneda(capital)}</span></div>
                <div className="flex justify-between font-bold border-t pt-1 mt-2 text-teal-700">
                    <span>PASIVO + CAPITAL:</span>
                    <span>{formatearMoneda(pagar + capital)}</span>
                </div>
            </div>

            <div className="mt-4 p-3 bg-teal-50 rounded-lg border border-teal-100">
                <div className="text-[10px] uppercase font-bold text-teal-600 mb-1">Resultado</div>
                <div className="flex justify-between items-end">
                    <span className="font-bold text-gray-700">Utilidad Neta:</span>
                    <span className="text-lg font-black text-teal-800">
                        {formatearMoneda(capital - (parseFloat(df.capitalAnterior) || 0))}
                    </span>
                </div>
            </div>
        </div>
    )
}

const ComparativaDistribucionContent = ({ sesion, formatearMoneda }) => {
    if (!sesion) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 italic">
                <PieChart className="w-12 h-12 mb-2 opacity-20" />
                No hay datos previos
            </div>
        )
    }

    const df = sesion.datosFinancieros || {}
    const distribucion = df.distribucionData || { socios: [] }
    
    // Función de utilidad para calcular utilidad neta de una sesión
    const getUtilidadNeta = (s) => {
        if (!s) return 0
        const d = s.datosFinancieros || {}
        const totalActivos = (s.totales?.valorTotalInventario || 0) + 
            (Array.isArray(d.efectivoEnCajaYBancoDetalle) ? d.efectivoEnCajaYBancoDetalle.reduce((a, b) => a + (parseFloat(b.monto) || 0), 0) : (parseFloat(d.efectivoEnCajaYBanco) || 0)) +
            (Array.isArray(d.cuentasPorCobrarDetalle) ? d.cuentasPorCobrarDetalle.reduce((a, b) => a + (parseFloat(b.monto) || 0), 0) : (parseFloat(d.cuentasPorCobrar) || 0)) +
            (Array.isArray(d.deudaANegocioDetalle) ? d.deudaANegocioDetalle.reduce((a, b) => a + (parseFloat(b.monto) || 0), 0) : (parseFloat(d.deudaANegocio) || 0)) +
            (parseFloat(d.activosFijos) || 0)
        
        const totalPasivos = Array.isArray(d.cuentasPorPagarDetalle) ? d.cuentasPorPagarDetalle.reduce((a, b) => a + (parseFloat(b.monto) || 0), 0) : (parseFloat(d.cuentasPorPagar) || 0)
        
        const capital = totalActivos - totalPasivos
        return capital - (parseFloat(d.capitalAnterior) || 0)
    }

    const utilidadTotal = getUtilidadNeta(sesion)

    return (
        <div className="space-y-4">
            <div className="bg-teal-50 p-3 rounded-lg flex justify-between items-center mb-4 border border-teal-100">
                <span className="font-bold text-teal-800 text-sm">Utilidad Total:</span>
                <span className="font-black text-teal-900 text-lg">{formatearMoneda(utilidadTotal)}</span>
            </div>

            <div className="space-y-3">
                {distribucion.socios.map((socio, idx) => {
                    const utilidadSocio = (utilidadTotal * (parseFloat(socio.porcentaje) || 0)) / 100
                    return (
                        <div key={idx} className="p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                            <div className="flex justify-between items-center mb-1">
                                <span className="font-bold text-gray-800">{socio.nombre}</span>
                                <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-500 font-bold">{socio.porcentaje}%</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Distribución:</span>
                                <span className="font-bold text-teal-700">{formatearMoneda(utilidadSocio)}</span>
                            </div>
                        </div>
                    )
                })}
            </div>
            
            {distribucion.socios.length === 0 && (
                <div className="text-center py-10 text-gray-400 italic text-sm">
                    No se configuraron socios en esta sesión
                </div>
            )}
        </div>
    )
}

export default ReporteInventarioModal
