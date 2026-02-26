import React from 'react'
import { View, Text, StyleSheet, Dimensions, Image } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import * as Animatable from 'react-native-animatable'
import { Ionicons } from '@expo/vector-icons'

const { width, height } = Dimensions.get('window')

const SplashScreen = ({ onComplete, durationMs = 1200, variant = 'splash', message = '' }) => {
  const [progress, setProgress] = React.useState(0)
  const [currentStep, setCurrentStep] = React.useState(0)

  const theme = {
    splash: {
      gradient: ['#3b82f6', '#1d4ed8', '#1e40af'],
      brand: 'TECH STOCK J4-PRO',
      subtitle: 'Gestor de Inventario',
      steps: [
        { icon: 'cube-outline', title: 'Gestor de Inventario' },
        { icon: 'people-outline', title: 'Trabajo Colaborativo' },
        { icon: 'trending-up-outline', title: 'Reportes Avanzados' },
        { icon: 'stats-chart-outline', title: 'Análisis de Datos' },
      ],
      status: message || 'Iniciando sistema...'
    },
    login: {
      gradient: ['#2563eb', '#1d4ed8', '#1e3a8a'],
      brand: 'Conectando',
      subtitle: 'Iniciando sesión',
      steps: [
        { icon: 'lock-closed-outline', title: 'Verificando credenciales' },
        { icon: 'shield-checkmark-outline', title: 'Autenticando' },
        { icon: 'cloud-outline', title: 'Conectando con el servidor' },
      ],
      status: message || 'Iniciando sesión...'
    },
    logout: {
      gradient: ['#475569', '#334155', '#1f2937'],
      brand: 'Cerrando sesión',
      subtitle: 'Hasta luego',
      steps: [
        { icon: 'refresh-outline', title: 'Limpiando datos' },
        { icon: 'exit-outline', title: 'Desconectando' },
      ],
      status: message || 'Cerrando sesión...'
    },
    navigate: {
      gradient: ['#06b6d4', '#0891b2', '#0e7490'],
      brand: 'Navegando',
      subtitle: 'Cambiando de pantalla',
      steps: [
        { icon: 'swap-horizontal-outline', title: 'Preparando vista' },
        { icon: 'sparkles-outline', title: 'Cargando componentes' },
      ],
      status: message || 'Cargando pantalla...'
    },
    product: {
      gradient: ['#22c55e', '#16a34a', '#15803d'],
      brand: 'Producto',
      subtitle: 'Creando y agregando',
      steps: [
        { icon: 'cube-outline', title: 'Creando producto' },
        { icon: 'add-circle-outline', title: 'Agregando al inventario' },
      ],
      status: message || 'Procesando...'
    },
    financial: {
      gradient: ['#f59e0b', '#d97706', '#b45309'],
      brand: 'Finanzas',
      subtitle: 'Guardando datos',
      steps: [
        { icon: 'calculator-outline', title: 'Validando datos' },
        { icon: 'save-outline', title: 'Guardando' },
      ],
      status: message || 'Guardando cambios...'
    },
    config: {
      gradient: ['#64748b', '#475569', '#334155'],
      brand: 'Configuración',
      subtitle: 'Aplicando ajustes',
      steps: [
        { icon: 'settings-outline', title: 'Actualizando opciones' },
        { icon: 'save-outline', title: 'Guardando' },
      ],
      status: message || 'Guardando configuración...'
    },
    export: {
      gradient: ['#06b6d4', '#0891b2', '#0e7490'],
      brand: 'Exportando',
      subtitle: 'Generando documento',
      steps: [
        { icon: 'document-text-outline', title: 'Preparando archivo' },
        { icon: 'download-outline', title: 'Descargando' },
      ],
      status: message || 'Generando archivo...'
    },
    print: {
      gradient: ['#8b5cf6', '#7c3aed', '#6d28d9'],
      brand: 'Imprimiendo',
      subtitle: 'Enviando a impresora',
      steps: [
        { icon: 'print-outline', title: 'Preparando impresión' },
        { icon: 'print-outline', title: 'Imprimiendo' },
      ],
      status: message || 'Imprimiendo...'
    },
    notice: {
      gradient: ['#7c3aed', '#6d28d9', '#5b21b6'],
      brand: 'Procesando',
      subtitle: 'Por favor espera',
      steps: [
        { icon: 'notifications-outline', title: 'Mostrando aviso' },
      ],
      status: message || 'Procesando...'
    }
  }

  const cfg = theme[variant] || theme.splash

  React.useEffect(() => {
    const tickMs = 50
    const totalStepsCount = Math.max(1, Math.round(durationMs / tickMs))
    const inc = 100 / totalStepsCount
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval)
          setTimeout(() => onComplete && onComplete(), 300)
          return 100
        }
        return Math.min(100, p + inc)
      })
    }, tickMs)
    return () => clearInterval(interval)
  }, [onComplete, durationMs])

  React.useEffect(() => {
    const stepInterval = setInterval(() => {
      setCurrentStep((s) => (s + 1) % Math.max(1, cfg.steps.length))
    }, 1000)
    return () => clearInterval(stepInterval)
  }, [cfg.steps.length])

  return (
    <LinearGradient
      colors={cfg.gradient}
      style={styles.container}
    >
      {/* Fondo animado */}
      <View style={styles.background}>
        <Animatable.View
          animation="pulse"
          iterationCount="infinite"
          duration={2000}
          style={[styles.circle, styles.circle1]}
        />
        <Animatable.View
          animation="pulse"
          iterationCount="infinite"
          duration={2000}
          delay={500}
          style={[styles.circle, styles.circle2]}
        />
        <Animatable.View
          animation="pulse"
          iterationCount="infinite"
          duration={2000}
          delay={1000}
          style={[styles.circle, styles.circle3]}
        />
      </View>

      {/* Contenido principal */}
      <View style={styles.content}>
        {/* Logo */}
        <Animatable.View
          animation="bounceIn"
          duration={1000}
          style={styles.logoContainer}
        >
          <View style={styles.logo}>
            <Image source={require('../../assets/icon.png')} style={styles.logoImage} resizeMode="contain" />
          </View>
        </Animatable.View>

        {/* Título */}
        <Animatable.View
          animation="fadeInUp"
          duration={800}
          delay={300}
          style={styles.titleContainer}
        >
          <Text style={styles.brandText}>{cfg.brand}</Text>
          <Text style={styles.subtitle}>{cfg.subtitle}</Text>
        </Animatable.View>

        {/* Pasos de carga */}
        <Animatable.View
          animation="fadeInUp"
          duration={800}
          delay={500}
          style={styles.stepsContainer}
        >
          {cfg.steps.map((s, index) => {
            const isActive = index === currentStep
            return (
              <View key={index} style={[styles.step, isActive ? styles.stepActive : styles.stepInactive]}>
                <Ionicons name={s.icon} size={24} color={isActive ? '#ffffff' : '#e5e7eb'} />
                <Text style={[styles.stepText, isActive && { fontWeight: '700' }]}>{s.title}</Text>
              </View>
            )
          })}
        </Animatable.View>

        {/* Barra de progreso */}
        <Animatable.View
          animation="fadeInUp"
          duration={800}
          delay={700}
          style={styles.progressContainer}
        >
          <View style={styles.progressHeader}>
            <Text style={styles.progressHeaderText}>{cfg.status}</Text>
            <Text style={styles.progressHeaderText}>{Math.round(progress)}%</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.statusText}>
            {progress < 30 && (variant === 'splash' ? 'Conectando con el servidor...' : cfg.status)}
            {progress >= 30 && progress < 60 && (variant === 'splash' ? 'Cargando configuración...' : cfg.status)}
            {progress >= 60 && progress < 90 && (variant === 'splash' ? 'Inicializando componentes...' : cfg.status)}
            {progress >= 90 && '¡Casi listo!'}
          </Text>
        </Animatable.View>
      </View>

      {/* Partículas flotantes */}
      <View style={styles.particles}>
        {[...Array(20)].map((_, i) => (
          <Animatable.View
            key={i}
            animation={{
              0: {
                translateY: height,
                opacity: 0,
              },
              1: {
                translateY: -100,
                opacity: 1,
              },
            }}
            duration={3000 + Math.random() * 2000}
            iterationCount="infinite"
            delay={Math.random() * 2000}
            style={[
              styles.particle,
              {
                left: Math.random() * width,
                top: height + 50,
              },
            ]}
          />
        ))}
      </View>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  background: {
    position: 'absolute',
    width: width * 2,
    height: height * 2,
  },
  circle: {
    position: 'absolute',
    borderRadius: 1000,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  circle1: {
    width: 200,
    height: 200,
    top: height * 0.1,
    left: width * 0.1,
  },
  circle2: {
    width: 150,
    height: 150,
    top: height * 0.6,
    right: width * 0.1,
  },
  circle3: {
    width: 100,
    height: 100,
    top: height * 0.3,
    left: width * 0.5,
  },
  content: {
    alignItems: 'center',
    zIndex: 1,
  },
  logoContainer: {
    marginBottom: 30,
  },
  logo: {
    width: 140,
    height: 140,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  logoImage: {
    width: 110,
    height: 110,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  brandText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 5,
  },
  stepsContainer: {
    marginBottom: 40,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 25,
    backdropFilter: 'blur(10px)',
  },
  stepText: {
    color: '#ffffff',
    marginLeft: 15,
    fontSize: 16,
    fontWeight: '500',
  },
  progressContainer: {
    alignItems: 'center',
    width: width * 0.8,
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 2,
    width: '100%',
  },
  progressText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
  },
  particles: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  particle: {
    position: 'absolute',
    width: 4,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 2,
  },
})

export default SplashScreen



