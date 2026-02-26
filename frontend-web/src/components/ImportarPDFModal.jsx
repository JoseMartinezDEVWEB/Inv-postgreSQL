import React, { useState, useRef, useEffect } from 'react'
import { useQueryClient } from 'react-query'
import { Upload, FileText, X, CheckCircle, AlertCircle, Loader, Check } from 'lucide-react'
import Modal from './ui/Modal'
import Button from './ui/Button'
import toast from 'react-hot-toast'
import api from '../services/api'

/**
 * Modal para importar inventarios desde archivos PDF con diseño de pasos
 * Paso 1: Seleccionar PDF
 * Paso 2: Procesar y Revisar (con animación de 3 segundos)
 * Paso 3: Confirmar Importación
 */
const ImportarPDFModal = ({ isOpen, onClose, cliente }) => {
  const [pasoActual, setPasoActual] = useState(1)
  const [archivos, setArchivos] = useState([])
  const [procesando, setProcesando] = useState(false)
  const [progreso, setProgreso] = useState(0)
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState(null)
  const [reintentoHecho, setReintentoHecho] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const inputFileRef = useRef(null)
  const queryClient = useQueryClient()

  // Resetear al abrir/cerrar
  useEffect(() => {
    if (isOpen) {
      setPasoActual(1)
      setArchivos([])
      setResultado(null)
      setError(null)
      setProcesando(false)
      setProgreso(0)
      setReintentoHecho(false)
      setFechaInventario(new Date().toISOString().split('T')[0])
      setFechaInventario(new Date().toISOString().split('T')[0])
    }
  }, [isOpen])

  /**
   * Maneja la selección de archivos PDF
   */
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files)
    
    // Validar que sean PDFs
    const archivosValidos = files.filter(file => 
      file.type === 'application/pdf' || 
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.type === 'application/vnd.ms-excel' ||
      file.name?.endsWith('.pdf') ||
      file.name?.endsWith('.xlsx') ||
      file.name?.endsWith('.xls')
    )
    
    if (pdfFiles.length !== files.length) {
      toast.error('Solo se permiten archivos PDF')
    }
    
    if (pdfFiles.length > 10) {
      toast.error('Máximo 10 archivos PDF permitidos')
      return
    }
    
    setArchivos(archivosValidos)
    setError(null)
  }

  /**
   * Avanza al siguiente paso
   */
  const handleSiguientePaso = () => {
    if (pasoActual === 1 && archivos.length > 0) {
      setPasoActual(2)
      // Iniciar procesamiento automáticamente
      setTimeout(() => {
        handleImportar()
      }, 500)
    }
  }

  /**
   * Elimina un archivo de la lista
   */
  const handleRemoveFile = (index) => {
    setArchivos(prev => prev.filter((_, i) => i !== index))
  }

  /**
   * Formatea el tamaño del archivo
   */
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  // Preflight: verificar que el procesador de PDF esté listo en el servidor
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const getParserEstado = async () => {
    try {
      const resp = await api.get('/clientes-negocios/importar-pdf/estado', { headers: { 'X-Client-Type': 'web' } })
      return resp?.data?.datos || { ready: false }
    } catch (_) {
      return { ready: false }
    }
  }
  const ensureServidorListo = async () => {
    // Hasta 5 intentos, respetando cooldown si viene informado
    for (let intento = 0; intento < 5; intento++) {
      const estado = await getParserEstado()
      if (estado.ready) return true
      const cooldownMs = typeof estado.cooldownMs === 'number' ? estado.cooldownMs : 0
      const espera = Math.min(8000, Math.max(1500, cooldownMs || 2000))
      toast.loading(`Preparando procesador de PDF en el servidor. Intento ${intento + 1}/5...`, { id: 'preflight' })
      await wait(espera)
    }
    toast.dismiss('preflight')
    return false
  }

  /**
   * Procesa los archivos con animación de 3 segundos adicionales
   */
  const handleImportar = async () => {
    setProcesando(true)
    setError(null)
    setProgreso(0)

    let intervalo
    try {
      // Preflight: evitar 503s repetidos si el servidor está inicializando
      const listo = await ensureServidorListo()
      if (!listo) {
        setProcesando(false)
        setError('El procesador de PDF se está preparando en el servidor. Intente de nuevo en unos segundos.')
        toast.error('El procesador de PDF aún se está preparando. Vuelva a intentar en breve.')
        return
      }

      // Crear FormData con los archivos
      const formData = new FormData()
      archivos.forEach(archivo => {
        formData.append('files', archivo)
      })
      
      // Agregar fecha del inventario si está disponible
      if (fechaInventario) {
        formData.append('fechaInventario', fechaInventario)
      }

      // Simular progreso inicial (animación)
      let progresoSimulado = 0
      intervalo = setInterval(() => {
        progresoSimulado += 10
        if (progresoSimulado <= 30) {
          setProgreso(progresoSimulado)
        }
      }, 300)

      // Realizar petición
      const response = await api.post(
        `/clientes-negocios/${cliente._id}/importar-pdf`,
        formData,
        {
          headers: {
            'X-Client-Type': 'web'
          },
          transformRequest: [(data, headers) => {
            if (headers) {
              if (headers['Content-Type']) delete headers['Content-Type']
              if (headers['content-type']) delete headers['content-type']
            }
            return data
          }],
          onUploadProgress: (progressEvent) => {
            if (intervalo) clearInterval(intervalo)
            const total = progressEvent?.total || progressEvent?.target?.getResponseHeader?.('Content-Length') || 0
            if (total > 0) {
              const percentCompleted = Math.round((progressEvent.loaded * 100) / total)
              setProgreso(Math.max(30, Math.min(99, percentCompleted)))
            } else {
              // Si no hay total, avanzar suavemente hasta 90%
              setProgreso(prev => Math.min(90, prev + 5))
            }
          }
        }
      )

      if (intervalo) clearInterval(intervalo)

      if (response.data.exito) {
        setProgreso(100)
        // Espera extra para UX según cantidad de archivos
        const extraDelayMs = 1500 + Math.min(10, archivos.length) * 500
        await new Promise((r) => setTimeout(r, extraDelayMs))
        setResultado(response.data.datos)
        setPasoActual(3)
        queryClient.invalidateQueries('clientes')
        queryClient.invalidateQueries(['sesiones', cliente._id])
      } else {
        throw new Error(response.data.mensaje || 'Error al procesar PDFs')
      }
    } catch (error) {
      console.error('Error al importar PDFs:', error)
      const mensaje = error.response?.data?.mensaje || error.message || 'Error al importar PDFs'
      const headers = error?.response?.headers || {}
      const msgLower = (mensaje || '').toLowerCase()
      const es503 = error?.response?.status === 503
      const parserInit = es503 && (headers['x-parser-initializing'] === 'true' || msgLower.includes('procesador de pdf'))
      const retryAfterHeader = headers['retry-after']
      const cooldownMsHeader = headers['x-parser-cooldown']
      const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : undefined
      const espera = typeof retryAfterMs === 'number' && !Number.isNaN(retryAfterMs)
        ? Math.max(1500, Math.min(10000, retryAfterMs))
        : (typeof cooldownMsHeader === 'string' ? Math.max(1500, Math.min(10000, Number(cooldownMsHeader))) : 1800)

      if (!reintentoHecho && (parserInit || msgLower.includes('pdfplumber'))) {
        setReintentoHecho(true)
        if (intervalo) clearInterval(intervalo)
        toast.loading(`Preparando procesador de PDF en el servidor. Reintentando en ${Math.ceil(espera/1000)}s...`, { id: 'pdf-retry' })
        await wait(espera)
        toast.dismiss('pdf-retry')
        return await handleImportar()
      }
      setProgreso(0)
      setError(mensaje)
      toast.error(mensaje)
    } finally {
      if (intervalo) clearInterval(intervalo)
      setProcesando(false)
    }
  }

  /**
   * Confirma la importación y cierra el modal
   */
  const handleConfirmarImportacion = () => {
    toast.success('Inventario importado exitosamente')
    handleClose()
  }

  const handleGuardarCambios = async () => {
    try {
      const id = resultado?.sesion?._id
      if (!id) return
      setGuardando(true)
      const resp = await api.patch(`/sesiones-inventario/${id}/completar`)
      if (resp.data?.exito) {
        toast.success('Sesión guardada')
        setResultado((prev) => ({
          ...prev,
          sesion: resp.data?.datos?.sesion || prev?.sesion
        }))
        queryClient.invalidateQueries(['sesiones', cliente._id])
      } else {
        throw new Error(resp.data?.mensaje || 'No se pudo guardar la sesión')
      }
    } catch (e) {
      const msg = e.response?.data?.mensaje || e.message || 'Error al guardar cambios'
      toast.error(msg)
    } finally {
      setGuardando(false)
    }
  }

  /**
   * Resetea el modal
   */
  const handleClose = () => {
    setArchivos([])
    setResultado(null)
    setProgreso(0)
    setProcesando(false)
    setReintentoHecho(false)
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Importar Inventario desde Archivo"
      size="lg"
    >
      <div className="space-y-6">
        {/* Indicador de pasos */}
        <div className="flex items-center justify-center space-x-4 mb-8">
          {/* Paso 1 */}
          <div className="flex flex-col items-center">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white transition-all ${
              pasoActual >= 1 ? 'bg-blue-600' : 'bg-gray-300'
            }`}>
              {pasoActual > 1 ? <Check className="w-6 h-6" /> : '1'}
            </div>
            <span className={`text-sm mt-2 font-medium ${
              pasoActual >= 1 ? 'text-blue-600' : 'text-gray-400'
            }`}>
              Seleccionar PDF
            </span>
          </div>

          {/* Línea conectora */}
          <div className={`h-1 w-16 transition-all ${
            pasoActual >= 2 ? 'bg-blue-600' : 'bg-gray-300'
          }`} />

          {/* Paso 2 */}
          <div className="flex flex-col items-center">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white transition-all ${
              pasoActual >= 2 ? 'bg-blue-600' : 'bg-gray-300'
            }`}>
              {pasoActual > 2 ? <Check className="w-6 h-6" /> : '2'}
            </div>
            <span className={`text-sm mt-2 font-medium ${
              pasoActual >= 2 ? 'text-blue-600' : 'text-gray-400'
            }`}>
              Procesar y Revisar
            </span>
          </div>

          {/* Línea conectora */}
          <div className={`h-1 w-16 transition-all ${
            pasoActual >= 3 ? 'bg-blue-600' : 'bg-gray-300'
          }`} />

          {/* Paso 3 */}
          <div className="flex flex-col items-center">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white transition-all ${
              pasoActual >= 3 ? 'bg-blue-600' : 'bg-gray-300'
            }`}>
              3
            </div>
            <span className={`text-sm mt-2 font-medium ${
              pasoActual >= 3 ? 'text-blue-600' : 'text-gray-400'
            }`}>
              Confirmar Importación
            </span>
          </div>
        </div>

        {/* Mensaje de error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
            <AlertCircle className="w-5 h-5 text-red-600 mr-3 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-red-800">
              <p className="font-semibold">Error al procesar archivos</p>
              <p className="mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Contenido según el paso actual */}
        <div className="min-h-[300px]">
          {/* PASO 1: Seleccionar archivos */}
          {pasoActual === 1 && (
            <div className="space-y-4">
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition-colors"
                onClick={() => inputFileRef.current?.click()}
              >
                <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 mb-2">
                  Haga clic para seleccionar archivos (PDF, XLSX, XLS)
                </p>
                <p className="text-sm text-gray-500">
                  Máximo 10 archivos, 50MB cada uno
                </p>
                <input
                  ref={inputFileRef}
                  type="file"
                  accept=".pdf,.xlsx,.xls,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {/* Lista de archivos seleccionados */}
              {archivos.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-gray-900">
                    Archivos seleccionados ({archivos.length})
                  </h4>
                  {archivos.map((archivo, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-gray-50 p-3 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <FileText className="w-5 h-5 text-red-500" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {archivo.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatFileSize(archivo.size)}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveFile(index)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* PASO 2: Procesar y Revisar */}
          {pasoActual === 2 && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="relative mb-6">
                <div className="w-24 h-24 border-8 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <FileText className="w-10 h-10 text-blue-600" />
                </div>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Procesando archivos PDF...
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Analizando y extrayendo datos del inventario
              </p>
              <div className="w-full max-w-md">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    Progreso
                  </span>
                  <span className="text-sm font-medium text-blue-600">
                    {progreso}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-blue-600 h-3 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${progreso}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* PASO 3: Confirmar Importación */}
          {pasoActual === 3 && resultado && (
            <div className="space-y-4">
              <div className="flex items-center justify-center text-green-600 mb-4">
                <CheckCircle className="w-16 h-16" />
              </div>
              
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-green-900 mb-3">
                  ✅ Importación Exitosa
                </h4>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-green-700">Cliente:</span>
                    <span className="font-medium text-green-900">
                      {resultado.resumen?.cliente}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700">Fecha:</span>
                    <span className="font-medium text-green-900">
                      {new Date(resultado.resumen?.fecha).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700">Productos:</span>
                    <span className="font-medium text-green-900">
                      {resultado.resumen?.totalProductos}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700">Total General:</span>
                    <span className="font-medium text-green-900">
                      ${resultado.resumen?.totalGeneral?.toLocaleString('es-DO', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700">Archivos procesados:</span>
                    <span className="font-medium text-green-900">{resultado.resumen?.archivosProcesados ?? resultado.resumen?.archivosProcessados}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700">Sesión:</span>
                    <span className="font-medium text-green-900">
                      {resultado.sesion?.numeroSesion}
                    </span>
                  </div>
                </div>
              </div>

              {/* Balance General */}
              {resultado.resumen?.balanceGeneral && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">
                    Balance General
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                    <div>
                      <span className="text-gray-600">Efectivo:</span>
                      <span className="ml-2 font-medium">${resultado.resumen.balanceGeneral.efectivo_caja_banco?.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Ctas. por Cobrar:</span>
                      <span className="ml-2 font-medium">${resultado.resumen.balanceGeneral.cuentas_por_cobrar?.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Inventario:</span>
                      <span className="ml-2 font-medium">${resultado.resumen.balanceGeneral.valor_inventario?.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Activos Fijos:</span>
                      <span className="ml-2 font-medium">${resultado.resumen.balanceGeneral.activos_fijos?.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Deuda a Negocio:</span>
                      <span className="ml-2 font-medium">${resultado.resumen.balanceGeneral.deuda_a_negocio?.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Total Corrientes:</span>
                      <span className="ml-2 font-medium">${resultado.resumen.balanceGeneral.total_corrientes?.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Total Fijos:</span>
                      <span className="ml-2 font-medium">${resultado.resumen.balanceGeneral.total_fijos?.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Total Activos:</span>
                      <span className="ml-2 font-medium">${resultado.resumen.balanceGeneral.total_activos?.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Ctas. por Pagar:</span>
                      <span className="ml-2 font-medium">${resultado.resumen.balanceGeneral.cuentas_por_pagar?.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Total Pasivos:</span>
                      <span className="ml-2 font-medium">${resultado.resumen.balanceGeneral.total_pasivos?.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Capital Contable:</span>
                      <span className="ml-2 font-medium">${resultado.resumen.balanceGeneral.capital_contable?.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Pasivos + Capital:</span>
                      <span className="ml-2 font-medium">${resultado.resumen.balanceGeneral.total_pasivos_mas_capital?.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Ventas del Mes:</span>
                      <span className="ml-2 font-medium">${resultado.resumen.balanceGeneral.ventas_del_mes?.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Gastos Generales:</span>
                      <span className="ml-2 font-medium">${resultado.resumen.balanceGeneral.gastos_generales?.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Utilidad Neta:</span>
                      <span className="ml-2 font-medium">${resultado.resumen.balanceGeneral.utilidad_neta?.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">% Neto:</span>
                      <span className="ml-2 font-medium">{resultado.resumen.balanceGeneral.porcentaje_neto ?? 0}%</span>
                    </div>
                    <div>
                      <span className="text-gray-600">% Bruto:</span>
                      <span className="ml-2 font-medium">{resultado.resumen.balanceGeneral.porcentaje_bruto ?? 0}%</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Distribución de saldo */}
              {resultado.resumen?.distribucionSaldo && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Distribución de saldo</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                    <div><span className="text-gray-600">Efectivo/Caja/Banco:</span><span className="ml-2 font-medium">${resultado.resumen.distribucionSaldo.efectivo_caja_banco?.toLocaleString()}</span></div>
                    <div><span className="text-gray-600">Inventario:</span><span className="ml-2 font-medium">${resultado.resumen.distribucionSaldo.inventario_mercancia?.toLocaleString()}</span></div>
                    <div><span className="text-gray-600">Activos Fijos:</span><span className="ml-2 font-medium">${resultado.resumen.distribucionSaldo.activos_fijos?.toLocaleString()}</span></div>
                    <div><span className="text-gray-600">Ctas. por Cobrar:</span><span className="ml-2 font-medium">${resultado.resumen.distribucionSaldo.cuentas_por_cobrar?.toLocaleString()}</span></div>
                    <div><span className="text-gray-600">Ctas. por Pagar:</span><span className="ml-2 font-medium">${resultado.resumen.distribucionSaldo.cuentas_por_pagar?.toLocaleString()}</span></div>
                    <div><span className="text-gray-600">Otros:</span><span className="ml-2 font-medium">${resultado.resumen.distribucionSaldo.otros?.toLocaleString()}</span></div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer con botones según el paso */}
      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
        {pasoActual === 1 && (
          <>
            <Button
              variant="outline"
              onClick={handleClose}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleSiguientePaso}
              disabled={archivos.length === 0}
            >
              Siguiente
            </Button>
          </>
        )}

        {pasoActual === 2 && (
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={procesando}
          >
            Cancelar
          </Button>
        )}

        {pasoActual === 3 && (
          <>
            <Button
              variant="primary"
              onClick={handleGuardarCambios}
              disabled={!resultado?.sesion?._id || guardando}
            >
              {guardando ? 'Guardando...' : 'Guardar cambios'}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const id = resultado?.sesion?._id
                if (id) {
                  window.location.href = `/inventarios/${id}`
                }
              }}
              disabled={!resultado?.sesion?._id}
            >
              Ver sesión
            </Button>
            <Button variant="primary" onClick={handleConfirmarImportacion}>Cerrar</Button>
          </>
        )}
      </div>
    </Modal>
  )
}

export default ImportarPDFModal
