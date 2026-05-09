import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from 'react-query'
import { Upload, FileText, X, CheckCircle, AlertCircle, Check } from 'lucide-react'
import Modal from './ui/Modal'
import Button from './ui/Button'
import toast from 'react-hot-toast'
import api from '../services/api'

/**
 * Modal de importación paso a paso:
 *   1. Fecha del inventario
 *   2. Archivo de Productos   (obligatorio — crea la sesión)
 *   3. Archivo de Balance     (opcional)
 *   4. Archivo de Distribución(opcional)
 *   5. Resumen y confirmación
 */

const fmt$ = (v) =>
  v != null
    ? `$${parseFloat(v).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '—'

// ── Sub-componentes ─────────────────────────────────────────────────────────

const StepDot = ({ num, label, done, active }) => (
  <div className="flex flex-col items-center">
    <div
      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white transition-all ${
        done ? 'bg-green-500' : active ? 'bg-blue-600' : 'bg-gray-300'
      }`}
    >
      {done ? <Check className="w-3.5 h-3.5" /> : num}
    </div>
    <span
      className={`text-xs mt-0.5 text-center leading-tight ${
        active ? 'text-blue-600 font-semibold' : done ? 'text-green-600' : 'text-gray-400'
      }`}
    >
      {label}
    </span>
  </div>
)

const Connector = ({ done }) => (
  <div className={`h-0.5 w-8 mb-3 transition-all flex-shrink-0 ${done ? 'bg-green-500' : 'bg-gray-300'}`} />
)

const ProgressBar = ({ progreso }) => (
  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
    <div
      className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
      style={{ width: `${progreso}%` }}
    />
  </div>
)

const ResultRow = ({ label, value }) =>
  value != null ? (
    <div className="flex justify-between text-xs">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800">{value}</span>
    </div>
  ) : null

// ── Componente principal ─────────────────────────────────────────────────────

const ImportarPDFModal = ({ isOpen, onClose, cliente }) => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const inputRef = useRef(null)

  const [paso, setPaso] = useState(1)
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [sesionId, setSesionId] = useState(null)
  const [archivoActual, setArchivoActual] = useState(null)
  const [procesando, setProcesando] = useState(false)
  const [progreso, setProgreso] = useState(0)
  const [error, setError] = useState(null)
  const [resumenProductos, setResumenProductos] = useState(null)
  const [resumenBalance, setResumenBalance] = useState(null)
  const [resumenDistribucion, setResumenDistribucion] = useState(null)

  useEffect(() => {
    if (isOpen) {
      setPaso(1)
      setFecha(new Date().toISOString().split('T')[0])
      setSesionId(null)
      setArchivoActual(null)
      setProcesando(false)
      setProgreso(0)
      setError(null)
      setResumenProductos(null)
      setResumenBalance(null)
      setResumenDistribucion(null)
    }
  }, [isOpen])

  const handleClose = () => {
    setArchivoActual(null)
    onClose()
  }

  // ── Selección de archivo ─────────────────────────────────────────────────

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['pdf', 'xlsx', 'xls'].includes(ext)) {
      toast.error('Solo se permiten archivos PDF, XLSX o XLS')
      return
    }
    setArchivoActual(file)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFileSelect({ target: { files: [file] } })
  }

  // ── Config para peticiones multipart/form-data ─────────────────────────
  // El axios instance tiene Content-Type: application/json por defecto.
  // transformRequest lo borra para que axios ponga el boundary correcto al enviar FormData.
  const multipartConfig = (extra = {}) => ({
    ...extra,
    headers: { 'X-Client-Type': 'web', ...(extra.headers || {}) },
    transformRequest: [(data, headers) => {
      if (headers) {
        delete headers['Content-Type']
        delete headers['content-type']
      }
      return data
    }],
  })

  // ── Helpers de progreso ─────────────────────────────────────────────────

  const startProgress = (step = 8) => {
    let iv
    iv = setInterval(() => setProgreso((p) => Math.min(p + step, 85)), 400)
    return iv
  }

  const finishProgress = (iv) => {
    clearInterval(iv)
    setProgreso(100)
  }

  const resetProgress = () => setProgreso(0)

  // ── Paso 2: Procesar productos ───────────────────────────────────────────

  const procesarProductos = async () => {
    if (!archivoActual) return
    setProcesando(true)
    setError(null)
    resetProgress()

    const formData = new FormData()
    formData.append('file', archivoActual)
    formData.append('fechaInventario', fecha)

    const iv = startProgress(8)
    try {
      const resp = await api.post(
        `/clientes-negocios/${cliente.id}/importar/productos`,
        formData,
        multipartConfig({ timeout: 180000 })
      )
      finishProgress(iv)
      if (!resp.data.exito) throw new Error(resp.data.mensaje || 'Error al procesar')

      setSesionId(resp.data.datos.sesionId)
      setResumenProductos(resp.data.datos)
      queryClient.invalidateQueries(['sesiones', cliente.id])
      queryClient.invalidateQueries(['sesiones-cliente', cliente.id])
      queryClient.invalidateQueries(['clientInventories', cliente.id])
      queryClient.invalidateQueries(['agenda-resumen'])
      toast.success(`${resp.data.datos.totalProductos} productos importados`)

      setTimeout(() => { setArchivoActual(null); resetProgress(); setPaso(3) }, 700)
    } catch (e) {
      clearInterval(iv)
      const msg = e.response?.data?.mensaje || e.message || 'Error al procesar productos'
      setError(msg)
      toast.error(msg)
      resetProgress()
    } finally {
      setProcesando(false)
    }
  }

  // ── Paso 3: Procesar balance ─────────────────────────────────────────────

  const procesarBalance = async () => {
    if (!archivoActual || !sesionId) return
    setProcesando(true)
    setError(null)
    resetProgress()

    const formData = new FormData()
    formData.append('file', archivoActual)

    const iv = startProgress(12)
    try {
      const resp = await api.patch(
        `/clientes-negocios/${cliente.id}/sesiones/${sesionId}/importar-balance`,
        formData,
        multipartConfig({ timeout: 60000 })
      )
      finishProgress(iv)
      if (!resp.data.exito) throw new Error(resp.data.mensaje || 'Error al procesar balance')

      setResumenBalance(resp.data.datos.balance)
      toast.success('Balance General importado')

      setTimeout(() => { setArchivoActual(null); resetProgress(); setPaso(4) }, 700)
    } catch (e) {
      clearInterval(iv)
      const msg = e.response?.data?.mensaje || e.message || 'Error al procesar balance'
      setError(msg)
      toast.error(msg)
      resetProgress()
    } finally {
      setProcesando(false)
    }
  }

  // ── Paso 4: Procesar distribución ────────────────────────────────────────

  const procesarDistribucion = async () => {
    if (!archivoActual || !sesionId) return
    setProcesando(true)
    setError(null)
    resetProgress()

    const formData = new FormData()
    formData.append('file', archivoActual)

    const iv = startProgress(12)
    try {
      const resp = await api.patch(
        `/clientes-negocios/${cliente.id}/sesiones/${sesionId}/importar-distribucion`,
        formData,
        multipartConfig({ timeout: 60000 })
      )
      finishProgress(iv)
      if (!resp.data.exito) throw new Error(resp.data.mensaje || 'Error al procesar distribución')

      setResumenDistribucion(resp.data.datos.distribucion)
      toast.success('Distribución de Saldo importada')

      setTimeout(() => { setArchivoActual(null); resetProgress(); setPaso(5) }, 700)
    } catch (e) {
      clearInterval(iv)
      const msg = e.response?.data?.mensaje || e.message || 'Error al procesar distribución'
      setError(msg)
      toast.error(msg)
      resetProgress()
    } finally {
      setProcesando(false)
    }
  }

  const saltar = () => { setArchivoActual(null); setError(null); setPaso(paso + 1) }

  // ── Drop Zone ──────────────────────────────────────────────────────────

  const DropZone = ({ label }) => (
    <div
      className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors ${
        archivoActual
          ? 'border-blue-400 bg-blue-50'
          : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
      }`}
      onClick={() => inputRef.current?.click()}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.xlsx,.xls"
        onChange={handleFileSelect}
        className="hidden"
      />
      {archivoActual ? (
        <div className="flex items-center justify-center gap-2">
          <FileText className="w-5 h-5 text-blue-500 flex-shrink-0" />
          <span className="text-sm font-medium text-blue-700 truncate max-w-[300px]">
            {archivoActual.name}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); setArchivoActual(null) }}
            className="text-gray-400 hover:text-red-500 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <>
          <Upload className="w-7 h-7 mx-auto text-gray-400 mb-1" />
          <p className="text-sm text-gray-600">{label}</p>
          <p className="text-xs text-gray-400 mt-0.5">PDF, XLSX o XLS · máx. 50 MB</p>
        </>
      )}
    </div>
  )

  // ── Render ─────────────────────────────────────────────────────────────

  const STEPS = [
    { id: 1, label: 'Fecha' },
    { id: 2, label: 'Productos' },
    { id: 3, label: 'Balance' },
    { id: 4, label: 'Distribución' },
    { id: 5, label: 'Listo' },
  ]

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Importar Inventario desde Archivo"
      size="xl"
    >
      <div className="space-y-4">

        {/* ── Indicador de pasos ─────────────────────────────────────────── */}
        <div className="flex items-center justify-center gap-0">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.id}>
              <StepDot
                num={s.id}
                label={s.label}
                done={paso > s.id}
                active={paso === s.id}
              />
              {i < STEPS.length - 1 && <Connector done={paso > s.id} />}
            </React.Fragment>
          ))}
        </div>

        {/* ── Error ──────────────────────────────────────────────────────── */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* ── Contenido del paso ─────────────────────────────────────────── */}
        <div className="min-h-[200px] max-h-[52vh] overflow-y-auto pr-1 space-y-3">

          {/* PASO 1 — Fecha */}
          {paso === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">¿Cuál es la fecha de este inventario?</h3>
                <p className="text-sm text-gray-500 mb-3">
                  Se usará como fecha de la sesión que se creará al importar.
                </p>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                <p className="font-semibold text-blue-900 mb-2">¿Cómo funciona la importación?</p>
                <ol className="list-decimal list-inside space-y-1 text-blue-700">
                  <li>Sube el archivo de <strong>Productos</strong> — reporte de inventario (obligatorio)</li>
                  <li>Sube el archivo de <strong>Balance General</strong> — datos financieros (opcional)</li>
                  <li>Sube el archivo de <strong>Distribución de Saldo</strong> (opcional)</li>
                </ol>
                <p className="text-xs text-blue-600 mt-2">
                  Cada archivo se procesa por separado para mayor precisión.
                </p>
              </div>
            </div>
          )}

          {/* PASO 2 — Productos */}
          {paso === 2 && (
            <div className="space-y-3">
              <div>
                <h3 className="font-semibold text-gray-900">
                  Archivo de Productos <span className="text-red-500">*</span>
                </h3>
                <p className="text-sm text-gray-500">
                  Reporte de inventario con lista de productos, cantidades y costos.
                </p>
              </div>
              <DropZone label="Haz clic o arrastra el reporte de inventario de productos" />
              {procesando && (
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Extrayendo productos...</span>
                    <span>{progreso}%</span>
                  </div>
                  <ProgressBar progreso={progreso} />
                </div>
              )}
              {resumenProductos && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-green-900">
                      {resumenProductos.totalProductos} productos extraídos
                    </p>
                    <p className="text-xs text-green-700">
                      Total Inventario: {fmt$(resumenProductos.totalGeneral)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PASO 3 — Balance General */}
          {paso === 3 && (
            <div className="space-y-3">
              <div>
                <h3 className="font-semibold text-gray-900">
                  Archivo de Balance General{' '}
                  <span className="text-gray-400 font-normal text-sm">(opcional)</span>
                </h3>
                <p className="text-sm text-gray-500">
                  Sube el PDF con el Balance General del negocio para incluir los datos financieros.
                  Si no tienes este archivo, haz clic en <strong>Saltar</strong>.
                </p>
              </div>
              <DropZone label="Haz clic o arrastra el archivo de Balance General" />
              {procesando && (
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Extrayendo balance...</span>
                    <span>{progreso}%</span>
                  </div>
                  <ProgressBar progreso={progreso} />
                </div>
              )}
              {resumenBalance && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-semibold text-green-900">Balance General importado</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                    <ResultRow label="Efectivo / Caja / Banco" value={fmt$(resumenBalance.efectivo_caja_banco)} />
                    <ResultRow label="Cuentas por Cobrar" value={fmt$(resumenBalance.cuentas_por_cobrar)} />
                    <ResultRow label="Inventario" value={fmt$(resumenBalance.valor_inventario)} />
                    <ResultRow label="Activos Fijos" value={fmt$(resumenBalance.activos_fijos)} />
                    <ResultRow label="Total Activos" value={fmt$(resumenBalance.total_activos)} />
                    <ResultRow label="Total Pasivos" value={fmt$(resumenBalance.total_pasivos)} />
                    <ResultRow label="Capital Contable" value={fmt$(resumenBalance.capital_contable)} />
                    <ResultRow label="Ventas del Mes" value={fmt$(resumenBalance.ventas_del_mes)} />
                    <ResultRow label="Utilidad Bruta" value={fmt$(resumenBalance.utilidad_bruta)} />
                    <ResultRow label="Gastos Generales" value={fmt$(resumenBalance.gastos_generales)} />
                    <ResultRow label="Utilidad Neta" value={fmt$(resumenBalance.utilidad_neta)} />
                    <ResultRow
                      label="% Neto"
                      value={resumenBalance.porcentaje_neto != null ? `${resumenBalance.porcentaje_neto}%` : null}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PASO 4 — Distribución de Saldo */}
          {paso === 4 && (
            <div className="space-y-3">
              <div>
                <h3 className="font-semibold text-gray-900">
                  Archivo de Distribución de Saldo{' '}
                  <span className="text-gray-400 font-normal text-sm">(opcional)</span>
                </h3>
                <p className="text-sm text-gray-500">
                  Sube el PDF con la Distribución de Saldo para visualizar el desglose de activos.
                  Si no tienes este archivo, haz clic en <strong>Saltar</strong>.
                </p>
              </div>
              <DropZone label="Haz clic o arrastra el archivo de Distribución de Saldo" />
              {procesando && (
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Extrayendo distribución...</span>
                    <span>{progreso}%</span>
                  </div>
                  <ProgressBar progreso={progreso} />
                </div>
              )}
              {resumenDistribucion && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-semibold text-green-900">Distribución de Saldo importada</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                    <ResultRow label="Efectivo / Caja / Banco" value={fmt$(resumenDistribucion.efectivo_caja_banco)} />
                    <ResultRow label="Inventario" value={fmt$(resumenDistribucion.inventario_mercancia)} />
                    <ResultRow label="Activos Fijos" value={fmt$(resumenDistribucion.activos_fijos)} />
                    <ResultRow label="Cuentas por Cobrar" value={fmt$(resumenDistribucion.cuentas_por_cobrar)} />
                    <ResultRow label="Cuentas por Pagar" value={fmt$(resumenDistribucion.cuentas_por_pagar)} />
                    <ResultRow label="Total Utilidades Netas" value={fmt$(resumenDistribucion.total_utilidades_netas)} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PASO 5 — Resumen final */}
          {paso === 5 && (
            <div className="space-y-3">
              <div className="text-center py-2">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                <h3 className="font-semibold text-gray-900 text-lg">¡Importación completada!</h3>
                <p className="text-sm text-gray-500 mt-1">El inventario fue guardado como nueva sesión.</p>
              </div>

              {/* Resumen general */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Cliente:</span>
                  <span className="font-medium">{cliente?.nombre}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Fecha:</span>
                  <span className="font-medium">
                    {new Date(fecha + 'T12:00:00').toLocaleDateString('es-DO')}
                  </span>
                </div>
                {resumenProductos && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Productos:</span>
                      <span className="font-medium">{resumenProductos.totalProductos}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Total Inventario:</span>
                      <span className="font-medium">{fmt$(resumenProductos.totalGeneral)}</span>
                    </div>
                  </>
                )}
                {resumenBalance?.ventas_del_mes != null && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Ventas del Mes:</span>
                    <span className="font-medium">{fmt$(resumenBalance.ventas_del_mes)}</span>
                  </div>
                )}
                {resumenBalance?.utilidad_neta != null && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Utilidad Neta:</span>
                    <span className="font-medium">{fmt$(resumenBalance.utilidad_neta)}</span>
                  </div>
                )}
              </div>

              {/* Tags de archivos importados */}
              <div className="flex flex-wrap gap-2">
                <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-1 rounded-full">
                  ✅ Productos importados
                </span>
                {resumenBalance && (
                  <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-1 rounded-full">
                    ✅ Balance General
                  </span>
                )}
                {resumenDistribucion && (
                  <span className="bg-purple-100 text-purple-800 text-xs font-medium px-2.5 py-1 rounded-full">
                    ✅ Distribución de Saldo
                  </span>
                )}
              </div>
            </div>
          )}

        </div>

        {/* ── Footer de botones ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-200">
          <Button variant="outline" onClick={handleClose} disabled={procesando}>
            {paso === 5 ? 'Cerrar' : 'Cancelar'}
          </Button>

          <div className="flex gap-2">
            {/* Saltar pasos opcionales */}
            {(paso === 3 || paso === 4) && !procesando && (
              <Button variant="outline" onClick={saltar}>
                Saltar
              </Button>
            )}

            {/* Acción principal por paso */}
            {paso === 1 && (
              <Button variant="primary" onClick={() => { setError(null); setPaso(2) }} disabled={!fecha}>
                Continuar →
              </Button>
            )}

            {paso === 2 && (
              <Button
                variant="primary"
                onClick={procesarProductos}
                disabled={!archivoActual || procesando}
              >
                {procesando ? 'Procesando...' : 'Procesar Productos'}
              </Button>
            )}

            {paso === 3 && (
              <Button
                variant="primary"
                onClick={procesarBalance}
                disabled={!archivoActual || procesando}
              >
                {procesando ? 'Procesando...' : 'Procesar Balance'}
              </Button>
            )}

            {paso === 4 && (
              <Button
                variant="primary"
                onClick={procesarDistribucion}
                disabled={!archivoActual || procesando}
              >
                {procesando ? 'Procesando...' : 'Procesar Distribución'}
              </Button>
            )}

            {paso === 5 && sesionId && (
              <Button
                variant="primary"
                onClick={() => { onClose?.(); navigate(`/inventarios/${sesionId}`) }}
              >
                Ver Sesión →
              </Button>
            )}
          </div>
        </div>

      </div>
    </Modal>
  )
}

export default ImportarPDFModal
