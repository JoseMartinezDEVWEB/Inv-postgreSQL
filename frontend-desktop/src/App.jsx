import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { NotificationProvider } from './context/NotificationContext'
import SplashScreen from './components/SplashScreen'
import TitleBar from './components/TitleBar'
import { initConfig } from './config/env'

// Páginas
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Clientes from './pages/Clientes'
import Inventarios from './pages/Inventarios'
import InventarioDetalle from './pages/InventarioDetalleNuevo'
import ProductosGenerales from './pages/ProductosGenerales'
import Agenda from './pages/Agenda'
import Perfil from './pages/Perfil'
import Usuarios from './pages/Usuarios'
import Invitaciones from './pages/Invitaciones'
import EsperaAutorizacion from './pages/EsperaAutorizacion'

// Layouts
import MainLayout from './layouts/MainLayout'
import AdminLayout from './layouts/AdminLayout'
import ContableLayout from './layouts/ContableLayout'

// Componente de rutas protegidas
const ProtectedRoute = ({ children, requiredRole = null }) => {
  const { isAuthenticated, user, isLoading } = useAuth()

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

  if (requiredRole && user?.rol !== requiredRole) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

// Componente principal de la aplicación
const AppContent = () => {
  const [showSplash, setShowSplash] = useState(true)
  const [configLoaded, setConfigLoaded] = useState(false)
  const { isAuthenticated, user } = useAuth()

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

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />
  }

  return (
    <>
      <TitleBar />
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
              <Routes>
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="clientes" element={<Clientes />} />
                <Route path="inventarios" element={<Inventarios />} />
                <Route path="agenda" element={<Agenda />} />
                <Route path="perfil" element={<Perfil />} />
              </Routes>
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
              <Routes>
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="clientes" element={<Clientes />} />
                <Route path="inventarios" element={<Inventarios />} />
                <Route path="agenda" element={<Agenda />} />
                <Route path="perfil" element={<Perfil />} />
              </Routes>
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
                ? user?.rol === 'administrador'
                  ? '/admin/dashboard'
                  : user?.rol === 'contable'
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


