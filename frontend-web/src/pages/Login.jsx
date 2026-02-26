import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, Mail, Lock, QrCode } from 'lucide-react'
import logoApp from '../img/logo_transparent.png'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import QRScannerModal from '../components/QRScannerModal'
import toast from 'react-hot-toast'
import { solicitudesConexionApi } from '../services/api'

const Login = () => {
  const { login, isLoading } = useAuth()
  const navigate = useNavigate()
  
  const [formData, setFormData] = useState({
    email: '', // Puede ser email o nombre de usuario
    password: '',
  })
  
  const [errors, setErrors] = useState({})
  const [showPassword, setShowPassword] = useState(false)
  const [showQRScanner, setShowQRScanner] = useState(false)
  const [showCodigoInput, setShowCodigoInput] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [nombreColaborador, setNombreColaborador] = useState('')
  const [loadingCodigo, setLoadingCodigo] = useState(false)

  // Manejar cambios en el formulario
  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    
    // Limpiar error del campo
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  // Validar formulario
  const validateForm = () => {
    const newErrors = {}
    
    if (!formData.email || formData.email.trim() === '') {
      newErrors.email = 'El correo electrónico o usuario es requerido'
    }
    
    if (!formData.password) {
      newErrors.password = 'La contraseña es requerida'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Manejar envío del formulario
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }
    
    const result = await login(formData)
    
    if (result.success) {
      // Redirigir según el rol del usuario
      const userRole = result.user.rol
      switch (userRole) {
        case 'administrador':
          navigate('/admin/dashboard')
          break
        case 'contable':
          navigate('/contable/dashboard')
          break
        case 'contador':
        default:
          navigate('/dashboard')
          break
      }
    }
  }

  // Manejar envío de código de 6 dígitos para conexión como colaborador
  const handleCodigoSubmit = async (e) => {
    e.preventDefault()

    if (!codigo || codigo.length !== 6) {
      toast.error('Por favor ingresa un código válido de 6 dígitos')
      return
    }

    if (!nombreColaborador || nombreColaborador.trim() === '') {
      toast.error('Por favor ingresa tu nombre para identificarte')
      return
    }

    try {
      setLoadingCodigo(true)

      // Generar/recuperar ID de dispositivo para web
      let dispositivoId = localStorage.getItem('deviceId')
      if (!dispositivoId) {
        dispositivoId = `web_${navigator.userAgent}_${Date.now()}`
        localStorage.setItem('deviceId', dispositivoId)
      }

      const dispositivoInfo = {
        navegador: navigator.userAgent,
        plataforma: navigator.platform,
        idioma: navigator.language,
      }

      const response = await solicitudesConexionApi.solicitar({
        codigoNumerico: codigo,
        nombreColaborador: nombreColaborador.trim(),
        dispositivoId,
        dispositivoInfo,
      })

      const datos = response.data?.datos || {}

      setShowCodigoInput(false)
      setCodigo('')
      setNombreColaborador('')

      toast.success(
        datos.contable?.nombre
          ? `Solicitud enviada a ${datos.contable.nombre}. Espera la autorización.`
          : 'Solicitud enviada. Espera la autorización del usuario principal.'
      )

      if (datos.solicitudId) {
        // Navegar a pantalla de espera (pública)
        navigate(`/colaborador/espera/${datos.solicitudId}`)
      }
    } catch (error) {
      const mensaje =
        error.response?.data?.mensaje || 'Código inválido o error de conexión'
      toast.error(mensaje)
    } finally {
      setLoadingCodigo(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Fondo decorativo */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-primary-100/30 rounded-full animate-pulse-slow"></div>
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-secondary-100/30 rounded-full animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="relative z-10 max-w-md w-full space-y-8">
        {/* Header con icono de la app */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <div className="mx-auto w-24 h-24 bg-white rounded-3xl flex items-center justify-center shadow-lg overflow-hidden">
            <img
              src={logoApp}
              alt="Logo J4 Pro"
              className="w-20 h-20 object-contain"
            />
          </div>

          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Gestor de Inventario
          </h2>

          <p className="mt-2 text-sm text-gray-600">
            Inicia sesión en tu cuenta de J4 Pro
          </p>
        </motion.div>

        {/* Formulario */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-white py-8 px-6 shadow-strong rounded-2xl border border-gray-100"
        >
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Email o Usuario */}
            <Input
              label="Correo electrónico o Usuario"
              name="email"
              type="text"
              value={formData.email}
              onChange={handleChange}
              error={errors.email}
              leftIcon={<Mail className="w-5 h-5" />}
              placeholder="tu@email.com o nombre de usuario"
              required
            />

            {/* Contraseña */}
            <Input
              label="Contraseña"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={handleChange}
              error={errors.password}
              leftIcon={<Lock className="w-5 h-5" />}
              placeholder="Tu contraseña"
              required
            />

            {/* Opciones adicionales */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                  Recordarme
                </label>
              </div>

              <div className="text-sm">
                <Link
                  to="/forgot-password"
                  className="font-medium text-primary-600 hover:text-primary-500 transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
            </div>

            {/* Botón de envío */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={isLoading}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Iniciando sesión...' : 'Iniciar sesión'}
            </Button>
          </form>

          {/* Botón Acceder como Colaborador */}
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowQRScanner(true)}
              className="w-full flex items-center justify-center space-x-2 px-4 py-3 border-2 border-purple-600 text-purple-600 rounded-xl hover:bg-purple-50 transition-all duration-200 font-medium"
            >
              <QrCode className="w-5 h-5" />
              <span>Acceder como Colaborador</span>
            </button>
          </div>

          {/* Botón e inputs para Código de 6 Dígitos */}
          <div className="mt-3 space-y-3">
            <button
              type="button"
              onClick={() => setShowCodigoInput(!showCodigoInput)}
              className="w-full flex items-center justify-center space-x-2 px-4 py-3 border-2 border-purple-500 text-purple-700 rounded-xl hover:bg-purple-50 transition-all duration-200 font-medium bg-purple-50/50"
            >
              <span>Ingresar Código de 6 Dígitos</span>
            </button>

            {showCodigoInput && (
              <form
                className="space-y-4 mt-2 bg-purple-50 border border-purple-100 rounded-xl p-4"
                onSubmit={handleCodigoSubmit}
              >
                <div>
                  <label className="block text-sm font-medium text-purple-900 mb-1">
                    Código de acceso
                  </label>
                  <input
                    type="text"
                    value={codigo}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 6)
                      setCodigo(value)
                    }}
                    maxLength={6}
                    disabled={loadingCodigo}
                    className="w-full text-center tracking-[0.6em] text-lg font-mono font-semibold text-purple-700 bg-white border border-purple-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="000000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-purple-900 mb-1">
                    Tu nombre
                  </label>
                  <input
                    type="text"
                    value={nombreColaborador}
                    onChange={(e) => setNombreColaborador(e.target.value)}
                    disabled={loadingCodigo}
                    className="w-full text-sm text-gray-900 bg-white border border-purple-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Nombre del colaborador"
                  />
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  loading={loadingCodigo}
                  disabled={loadingCodigo}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  {loadingCodigo ? 'Verificando...' : 'Conectar'}
                </Button>
              </form>
            )}
          </div>

          
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-center text-sm text-gray-500"
        >
          <p>© 2024 J4 Pro. Todos los derechos reservados.</p>
        </motion.div>
      </div>

      {/* Modal de Escáner QR */}
      <QRScannerModal
        isOpen={showQRScanner}
        onClose={() => setShowQRScanner(false)}
      />
    </div>
  )
}

export default Login



