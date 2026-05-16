import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Mail, Lock } from 'lucide-react'
import logoApp from '../img/logo_transparent.png'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'

const Login = () => {
  const { login, isLoading } = useAuth()
  const navigate = useNavigate()

  const [formData, setFormData] = useState({
    credencial: '',
    password: '',
  })

  const [errors, setErrors] = useState({})
  const [showPassword, setShowPassword] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))

    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.credencial || formData.credencial.trim() === '') {
      newErrors.credencial = 'El correo electrónico o usuario es requerido'
    }

    if (!formData.password) {
      newErrors.password = 'La contraseña es requerida'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    const result = await login(formData)

    if (result.success) {
      const userRole = result.user?.rol
      switch (userRole) {
        case 'administrador':
          navigate('/admin/dashboard')
          break
        case 'contable':
          navigate('/contable/dashboard')
          break
        case 'colaborador':
        default:
          navigate('/dashboard')
          break
      }
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
        {/* Header */}
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
            <Input
              label="Correo electrónico o Usuario"
              name="credencial"
              type="text"
              value={formData.credencial}
              onChange={handleChange}
              error={errors.credencial}
              leftIcon={<Mail className="w-5 h-5" />}
              placeholder="tu@email.com o nombre de usuario"
              required
            />

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
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-center text-sm text-gray-500"
        >
          <p>© 2026 J4 Pro. Todos los derechos reservados.</p>
        </motion.div>
      </div>
    </div>
  )
}

export default Login
