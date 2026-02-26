import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { solicitudesConexionApi } from '../services/api'
import { motion } from 'framer-motion'
import { Clock, CheckCircle2, XCircle, AlertTriangle, ArrowLeft } from 'lucide-react'

const POLL_INTERVAL = 5000

const EsperaAutorizacion = () => {
  const { solicitudId } = useParams()
  const navigate = useNavigate()
  const [estado, setEstado] = useState('pendiente')
  const [mensaje, setMensaje] = useState('Esperando autorización del usuario principal...')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let intervalId

    const fetchEstado = async () => {
      try {
        setIsLoading(true)
        const response = await solicitudesConexionApi.verificarEstado(solicitudId)
        const datos = response.data?.datos || {}

        setEstado(datos.estado)
        setError(null)

        if (datos.estado === 'aceptada') {
          setMensaje('Tu solicitud ha sido aceptada. Ahora puedes trabajar como colaborador.')
          if (intervalId) clearInterval(intervalId)
        } else if (datos.estado === 'rechazada') {
          setMensaje('Tu solicitud fue rechazada. Contacta al usuario principal si crees que es un error.')
          if (intervalId) clearInterval(intervalId)
        } else if (datos.estado === 'expirada') {
          setMensaje('Tu solicitud ha expirado. Solicita un nuevo código al usuario principal.')
          if (intervalId) clearInterval(intervalId)
        } else {
          setMensaje('Esperando autorización del usuario principal...')
        }
      } catch (err) {
        console.error('Error al verificar estado de la solicitud:', err)
        setError('No se pudo verificar el estado. Intentaremos nuevamente en unos segundos.')
      } finally {
        setIsLoading(false)
      }
    }

    if (solicitudId) {
      fetchEstado()
      intervalId = setInterval(fetchEstado, POLL_INTERVAL)
    }

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [solicitudId])

  const renderIcon = () => {
    if (estado === 'aceptada') {
      return <CheckCircle2 className="w-14 h-14 text-emerald-500" />
    }
    if (estado === 'rechazada' || estado === 'expirada') {
      return <XCircle className="w-14 h-14 text-red-500" />
    }
    return <Clock className="w-14 h-14 text-amber-500" />
  }

  const renderEstadoLabel = () => {
    if (estado === 'aceptada') return 'Solicitud aceptada'
    if (estado === 'rechazada') return 'Solicitud rechazada'
    if (estado === 'expirada') return 'Solicitud expirada'
    return 'Solicitud pendiente'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="relative z-10 max-w-md w-full space-y-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <div className="mx-auto w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center shadow-medium">
            {renderIcon()}
          </div>
          <h2 className="mt-6 text-2xl font-bold text-gray-900">
            Estado de la conexión como colaborador
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Mantén esta pantalla abierta mientras el usuario principal autoriza tu conexión.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="bg-white py-6 px-6 shadow-strong rounded-2xl border border-gray-100 space-y-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">ID de solicitud</span>
            <span className="text-xs font-mono text-gray-700 bg-gray-100 px-2 py-1 rounded">
              {solicitudId}
            </span>
          </div>

          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">Estado</span>
            <span
              className={`text-sm font-semibold px-3 py-1 rounded-full ${
                estado === 'aceptada'
                  ? 'bg-emerald-50 text-emerald-700'
                  : estado === 'rechazada' || estado === 'expirada'
                  ? 'bg-red-50 text-red-700'
                  : 'bg-amber-50 text-amber-700'
              }`}
            >
              {renderEstadoLabel()}
            </span>
          </div>

          <p className="mt-4 text-sm text-gray-700 leading-relaxed">{mensaje}</p>

          {isLoading && (
            <div className="mt-4 flex items-center space-x-3 text-sm text-gray-500">
              <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              <span>Consultando estado...</span>
            </div>
          )}

          {error && (
            <div className="mt-4 flex items-start space-x-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="inline-flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver al inicio de sesión</span>
            </button>
            <span className="text-xs text-gray-400">Esta ventana se actualiza automáticamente</span>
          </div>
        </motion.div>

        <div className="text-center text-xs text-gray-400 mt-4">
          <p>
            Si ya estás trabajando desde la app móvil, puedes usar este mismo código de solicitud
            para sincronizar tus productos cuando estés en línea.
          </p>
        </div>
      </div>
    </div>
  )
}

export default EsperaAutorizacion
