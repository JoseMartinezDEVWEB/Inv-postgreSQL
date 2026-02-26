import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, QrCode, Camera, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react'
import { invitacionesApi } from '../services/api'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import jsQR from 'jsqr'

const QRScannerModal = ({ isOpen, onClose }) => {
  const [isScanning, setIsScanning] = useState(false)
  const [hasPermission, setHasPermission] = useState(null)
  const [error, setError] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [scannedData, setScannedData] = useState(null)
  
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const scanIntervalRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (isOpen) {
      startCamera()
    } else {
      stopCamera()
    }

    return () => {
      stopCamera()
    }
  }, [isOpen])

  const startCamera = async () => {
    try {
      setError(null)
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      })
      
      streamRef.current = stream
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
        setHasPermission(true)
        setIsScanning(true)
        startScanning()
      }
    } catch (err) {
      console.error('Error accessing camera:', err)
      setHasPermission(false)
      setError('No se pudo acceder a la cámara. Por favor, permite el acceso.')
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current)
      scanIntervalRef.current = null
    }
    setIsScanning(false)
  }

  const startScanning = () => {
    scanIntervalRef.current = setInterval(() => {
      if (videoRef.current && canvasRef.current && !isProcessing) {
        const video = videoRef.current
        const canvas = canvasRef.current
        const context = canvas.getContext('2d')

        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          context.drawImage(video, 0, 0, canvas.width, canvas.height)

          const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
          const code = jsQR(imageData.data, imageData.width, imageData.height)

          if (code) {
            handleQRDetected(code.data)
          }
        }
      }
    }, 300)
  }

  const handleQRDetected = async (data) => {
    if (isProcessing || scannedData) return

    try {
      setIsProcessing(true)
      setScannedData(data)
      stopCamera()

      // Parsear datos del QR
      let qrData
      try {
        qrData = JSON.parse(data)
      } catch (e) {
        throw new Error('Código QR inválido')
      }

      // Validar que sea una invitación de J4
      if (!qrData.tipo || qrData.tipo !== 'invitacion_j4') {
        throw new Error('Este código QR no es una invitación válida de J4 Pro')
      }

      if (!qrData.token) {
        throw new Error('Código QR incompleto')
      }

      // Consumir la invitación sin crear cuenta
      const response = await invitacionesApi.consumirSinCuenta(qrData.token)

      if (response.data.exito) {
        const datos = response.data.datos

        // Guardar token de sesión temporal
        localStorage.setItem('accessToken', datos.sessionToken)
        localStorage.setItem('colaboradorTemporal', JSON.stringify({
          tipo: 'colaborador_temporal',
          invitacionId: datos.invitacionId,
          contable: datos.contable,
          rol: datos.rol,
          expiraEn: datos.expiraEn
        }))

        toast.success('¡Conectado exitosamente como colaborador!', {
          icon: '👥',
          duration: 3000,
        })

        // Redirigir al dashboard
        setTimeout(() => {
          navigate('/dashboard')
          onClose()
        }, 1000)
      } else {
        throw new Error(response.data.mensaje || 'Error al conectar')
      }
    } catch (error) {
      console.error('Error al procesar QR:', error)
      
      const errorMsg = error.response?.data?.mensaje || error.message || 'Error al procesar el código QR'
      
      toast.error(errorMsg, {
        duration: 4000,
      })

      setError(errorMsg)
      setScannedData(null)
      setIsProcessing(false)
      
      // Reiniciar cámara después de 2 segundos
      setTimeout(() => {
        setError(null)
        startCamera()
      }, 2000)
    }
  }

  const handleClose = () => {
    if (!isProcessing) {
      stopCamera()
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto">
        {/* Overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="fixed inset-0 bg-black/30 backdrop-blur-sm"
        />

        {/* Modal */}
        <div className="flex min-h-full items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                    <QrCode className="w-6 h-6 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-white">
                    Escanear Código QR
                  </h2>
                </div>
                <button
                  onClick={handleClose}
                  disabled={isProcessing}
                  className="text-white/80 hover:text-white transition-colors disabled:opacity-50"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Instrucciones */}
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                <div className="flex items-start space-x-3">
                  <QrCode className="w-5 h-5 text-purple-600 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">
                      Acceso como Colaborador
                    </h3>
                    <p className="text-sm text-gray-600">
                      Pide al administrador que genere un código QR desde la sesión de inventario y escanéalo para conectarte sin necesidad de crear una cuenta.
                    </p>
                  </div>
                </div>
              </div>

              {/* Scanner Area */}
              <div className="relative">
                {hasPermission === null && (
                  <div className="flex flex-col items-center justify-center py-16 space-y-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent"></div>
                    <p className="text-gray-600">Solicitando permiso de cámara...</p>
                  </div>
                )}

                {hasPermission === false && (
                  <div className="flex flex-col items-center justify-center py-16 space-y-4">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                      <Camera className="w-8 h-8 text-red-600" />
                    </div>
                    <p className="text-gray-900 font-medium">No hay acceso a la cámara</p>
                    <p className="text-sm text-gray-600 text-center max-w-sm">
                      Por favor, permite el acceso a la cámara en la configuración de tu navegador
                    </p>
                    <button
                      onClick={startCamera}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Reintentar</span>
                    </button>
                  </div>
                )}

                {hasPermission === true && (
                  <div className="relative bg-black rounded-xl overflow-hidden">
                    {/* Video */}
                    <video
                      ref={videoRef}
                      className="w-full h-96 object-cover"
                      playsInline
                      muted
                    />
                    
                    {/* Canvas oculto para procesamiento */}
                    <canvas ref={canvasRef} className="hidden" />

                    {/* Frame overlay */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="relative w-64 h-64">
                        {/* Esquinas del marco */}
                        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-purple-500"></div>
                        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-purple-500"></div>
                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-purple-500"></div>
                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-purple-500"></div>
                        
                        {/* Línea de escaneo animada */}
                        {isScanning && !isProcessing && (
                          <motion.div
                            className="absolute left-0 right-0 h-0.5 bg-purple-500"
                            initial={{ top: 0 }}
                            animate={{ top: '100%' }}
                            transition={{
                              duration: 2,
                              repeat: Infinity,
                              ease: 'linear',
                            }}
                          />
                        )}
                      </div>
                    </div>

                    {/* Estado de procesamiento */}
                    {isProcessing && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <div className="bg-white rounded-xl p-6 flex flex-col items-center space-y-3">
                          <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent"></div>
                          <p className="text-gray-900 font-medium">Conectando...</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Error message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start space-x-3"
                >
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-900">Error</p>
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </motion.div>
              )}

              {/* Footer info */}
              <div className="flex items-center justify-center space-x-8 text-sm">
                <div className="flex items-center space-x-2 text-green-600">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Conexión segura</span>
                </div>
                <div className="flex items-center space-x-2 text-amber-600">
                  <AlertCircle className="w-4 h-4" />
                  <span>Válido 24h</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  )
}

export default QRScannerModal
