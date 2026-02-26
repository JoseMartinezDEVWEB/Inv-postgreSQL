import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Package, TrendingUp, Users, BarChart3 } from 'lucide-react'
import logo from '../img/logo_transparent.png'

const SplashScreen = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0)
  const [progress, setProgress] = useState(0)

  const steps = [
    {
      icon: Package,
      title: 'Gestor de Inventario',
      description: 'Sistema completo para el manejo de inventarios y balances',
      color: 'text-primary-600',
      bgColor: 'bg-primary-100',
    },
    {
      icon: Users,
      title: 'Trabajo Colaborativo',
      description: 'Múltiples usuarios trabajando en tiempo real',
      color: 'text-success-600',
      bgColor: 'bg-success-100',
    },
    {
      icon: TrendingUp,
      title: 'Reportes Avanzados',
      description: 'Generación automática de reportes y balances',
      color: 'text-warning-600',
      bgColor: 'bg-warning-100',
    },
    {
      icon: BarChart3,
      title: 'Análisis de Datos',
      description: 'Estadísticas y métricas en tiempo real',
      color: 'text-danger-600',
      bgColor: 'bg-danger-100',
    },
  ]

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          setTimeout(() => {
            onComplete()
          }, 500)
          return 100
        }
        return prev + 2
      })
    }, 50)

    return () => clearInterval(interval)
  }, [onComplete])

  useEffect(() => {
    const stepInterval = setInterval(() => {
      setCurrentStep(prev => (prev + 1) % steps.length)
    }, 1000)

    return () => clearInterval(stepInterval)
  }, [steps.length])

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 flex items-center justify-center z-50">
      {/* Fondo animado */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-white/5 rounded-full animate-pulse-slow"></div>
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-white/5 rounded-full animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/5 rounded-full animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Contenido principal */}
      <div className="relative z-10 text-center">
        {/* Logo/Icono principal */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className="mb-8"
        >
          <div className="w-32 h-32 mx-auto bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center shadow-strong overflow-hidden">
            <img src={logo} alt="Logo" className="w-20 h-20 object-contain drop-shadow" />
          </div>
        </motion.div>

        {/* Título principal */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mb-2 flex items-center justify-center"
        >
          <span className="text-3xl font-semibold text-white/90">TECH STOCK J4-PRO</span>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="text-xl text-white/90 mb-12 text-shadow"
        >
          Gestor de Inventario
        </motion.p>

        {/* Pasos de carga */}
        <div className="mb-8">
          {steps.map((step, index) => {
            const Icon = step.icon
            const isActive = index === currentStep
            const isCompleted = index < currentStep

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ 
                  opacity: isActive || isCompleted ? 1 : 0.3,
                  x: 0,
                  scale: isActive ? 1.05 : 1
                }}
                transition={{ duration: 0.5 }}
                className={`
                  flex items-center space-x-4 mb-4 p-4 rounded-lg backdrop-blur-md
                  ${isActive ? 'bg-white/20' : 'bg-white/10'}
                  transition-all duration-300
                `}
              >
                <div className={`
                  w-12 h-12 rounded-full flex items-center justify-center
                  ${isActive ? step.bgColor : 'bg-white/20'}
                  transition-all duration-300
                `}>
                  <Icon className={`w-6 h-6 ${isActive ? step.color : 'text-white/70'}`} />
                </div>
                
                <div className="text-left">
                  <h3 className={`font-semibold ${isActive ? 'text-white' : 'text-white/70'}`}>
                    {step.title}
                  </h3>
                  <p className={`text-sm ${isActive ? 'text-white/90' : 'text-white/50'}`}>
                    {step.description}
                  </p>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Barra de progreso */}
        <div className="w-80 mx-auto">
          <div className="flex justify-between text-sm text-white/70 mb-2">
            <span>Iniciando sistema...</span>
            <span>{Math.round(progress)}%</span>
          </div>
          
          <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-white/60 to-white/80 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* Texto de estado */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1 }}
          className="text-white/70 text-sm mt-4"
        >
          {progress < 30 && 'Conectando con el servidor...'}
          {progress >= 30 && progress < 60 && 'Cargando configuración...'}
          {progress >= 60 && progress < 90 && 'Inicializando componentes...'}
          {progress >= 90 && '¡Casi listo!'}
        </motion.p>
      </div>

      {/* Partículas flotantes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-white/20 rounded-full"
            initial={{
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
            }}
            animate={{
              y: [null, -100],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: Math.random() * 3 + 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>
    </div>
  )
}

export default SplashScreen



