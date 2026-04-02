import React, { useState, useEffect, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { NotificationProvider } from './context/NotificationContext'
import SplashScreen from './components/SplashScreen'
import TitleBar from './components/TitleBar'
import { initConfig } from './config/env'

// Páginas (Lazy Loaded para Code-Splitting y mejor rendimiento)
const Login = React.lazy(() => import('./pages/Login'))
const Dashboard = React.lazy(() => import('./pages/Dashboard'))
const Clientes = React.lazy(() => import('./pages/Clientes'))
const Inventarios = React.lazy(() => import('./pages/Inventarios'))
const InventarioDetalle = React.lazy(() => import('./pages/InventarioDetalleNuevo'))
const ProductosGenerales = React.lazy(() => import('./pages/ProductosGenerales'))
const Agenda = React.lazy(() => import('./pages/Agenda'))
const Perfil = React.lazy(() => import('./pages/Perfil'))
const Usuarios = React.lazy(() => import('./pages/Usuarios'))
const Invitaciones = React.lazy(() => import('./pages/Invitaciones'))
const EsperaAutorizacion = React.lazy(() => import('./pages/EsperaAutorizacion'))

// Layouts
import MainLayout from './layouts/MainLayout'
import AdminLayout from './layouts/AdminLayout'
import ContableLayout from './layouts/ContableLayout'

// Loading Fallback genérico para Suspense
const GlobalLoader = () => (
  <div className="h-screen flex items-center justify-center overflow-hidden">
    <div className="loading-spinner w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
  </div>
)


// Componente de rutas protegidas
const ProtectedRoute = ({ children, requiredRole = null }) => {
  const { isAuthenticated, user, isLoading, hasRole } = useAuth()

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center overflow-hidden">
        <div className="loading-spinner w-8 h-8"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

// Componente principal de la aplicación
const AppContent = () => {
  const [showSplash, setShowSplash] = useState(true)
  const [configLoaded, setConfigLoaded] = useState(false)
  const { isAuthenticated, user, hasRole } = useAuth()

  // Inicializar configuración al montar
  useEffect(() => {
    const loadConfig = async () => {
      await initConfig()
      setConfigLoaded(true)
    }
    loadConfig()
  }, [])

  // Mostrar splash screen por 3 segundos
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false)
    }, 3000)

    return () => clearTimeout(timer)
  }, [])

  // Manejar F5 para refrescar la aplicación
  useEffect(() => {
    const handleKeyDown = (event) => {
      // F5 o Ctrl+R para refrescar
      if (event.key === 'F5' || (event.ctrlKey && event.key === 'r')) {
        event.preventDefault()
        window.location.reload()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  if (showSplash || !configLoaded) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />
  }

  return (
    <>
      <TitleBar />
      <Suspense fallback={<GlobalLoader />}>
      <Routes>
        {/* Rutas públicas */}
        <Route path="/login" element={<Login />} />
        <Route path="/colaborador/espera/:solicitudId" element={<EsperaAutorizacion />} />

        {/* Rutas protegidas */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Dashboard />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/clientes"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Clientes />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/inventarios"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Inventarios />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventarios/:id"
          element={
            <ProtectedRoute>
              <InventarioDetalle />
            </ProtectedRoute>
          }
        />

        <Route
          path="/productos-generales"
          element={
            <ProtectedRoute>
              <MainLayout>
                <ProductosGenerales />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/agenda"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Agenda />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/perfil"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Perfil />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/usuarios"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Usuarios />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/invitaciones"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Invitaciones />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        {/* Rutas de administrador */}
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute requiredRole="administrador">
              <AdminLayout>
                <Suspense fallback={<GlobalLoader />}>
                <Routes>
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="clientes" element={<Clientes />} />
                  <Route path="inventarios" element={<Inventarios />} />
                  <Route path="agenda" element={<Agenda />} />
                  <Route path="perfil" element={<Perfil />} />
                </Routes>
                </Suspense>
              </AdminLayout>
            </ProtectedRoute>
          }
        />

        {/* Rutas de contable */}
        <Route
          path="/contable/*"
          element={
            <ProtectedRoute requiredRole="contable">
              <ContableLayout>
                <Suspense fallback={<GlobalLoader />}>
                <Routes>
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="clientes" element={<Clientes />} />
                  <Route path="inventarios" element={<Inventarios />} />
                  <Route path="agenda" element={<Agenda />} />
                  <Route path="perfil" element={<Perfil />} />
                </Routes>
                </Suspense>
              </ContableLayout>
            </ProtectedRoute>
          }
        />

        {/* Ruta por defecto */}
        <Route
          path="/"
          element={
            <Navigate
              to={
                isAuthenticated
                  ? hasRole('administrador')
                    ? '/admin/dashboard'
                    : hasRole('contable')
                      ? '/contable/dashboard'
                      : '/dashboard'
                  : '/login'
              }
              replace
            />
          }
        />

        {/* Ruta 404 */}
        <Route
          path="*"
          element={
            <div className="h-screen flex items-center justify-center overflow-hidden">
              <div className="text-center">
                <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
                <p className="text-gray-600 mb-8">Página no encontrada</p>
                <button
                  onClick={() => window.history.back()}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Volver
                </button>
              </div>
            </div>
          }
        />
      </Routes>
      </Suspense>
    </>
  )
}

// Componente principal
const App = () => {
  return (
    <AuthProvider>
      <NotificationProvider>
        <AppContent />
      </NotificationProvider>
    </AuthProvider>
  )
}

export default App


