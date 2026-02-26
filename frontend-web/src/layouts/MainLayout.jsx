import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'
import {
  Users,
  BarChart3,
  FileText,
  Calendar,
  User,
  LogOut,
  Menu,
  X,
  Settings,
  Home,
  ShoppingCart,
  Package,
  UserPlus,
  QrCode,
} from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import ButtonComponent from '../components/ui/Button'
import logoApp from '../img/logo_transparent.png'

const MainLayout = ({ children }) => {
  const { user, logout } = useAuth()
  const { unreadCount } = useNotification()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Navegación principal
  const navigationBase = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Clientes', href: '/clientes', icon: Users },
    { name: 'Inventarios', href: '/inventarios', icon: ShoppingCart },
    { name: 'Productos Generales', href: '/productos-generales', icon: ShoppingCart },
    { name: 'Agenda', href: '/agenda', icon: Calendar },
  ]

  // Agregar opciones de colaboración para contables, administradores y contadores
  const navigation = user?.rol === 'contable' || user?.rol === 'administrador' || user?.rol === 'contador'
    ? [
        ...navigationBase,
        ...(user?.rol === 'contable' || user?.rol === 'administrador' 
          ? [{ name: 'Usuarios', href: '/usuarios', icon: UserPlus }]
          : []),
        { name: 'Invitaciones', href: '/invitaciones', icon: QrCode },
      ]
    : navigationBase

  // Manejar logout
  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  // Verificar si la ruta está activa
  const isActive = (href) => {
    return location.pathname === href
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar móvil */}
      <div className={`fixed inset-0 z-40 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        
        <motion.div
          initial={{ x: -300 }}
          animate={{ x: 0 }}
          exit={{ x: -300 }}
          transition={{ duration: 0.3 }}
          className="relative flex-1 flex flex-col max-w-xs w-full bg-white shadow-xl"
        >
          <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
            <div className="flex-shrink-0 flex items-center justify-center px-4">
              <div className="w-14 h-14 bg-white rounded-3xl shadow-lg flex items-center justify-center overflow-hidden">
                <img
                  src={logoApp}
                  alt="Logo J4 Pro"
                  className="w-12 h-12 object-contain"
                />
              </div>
            </div>
            
            <nav className="mt-5 px-2 space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`
                      group flex items-center px-2 py-2 text-base font-medium rounded-md transition-colors
                      ${isActive(item.href)
                        ? 'bg-primary-100 text-primary-900'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }
                    `}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Icon className="mr-4 h-6 w-6" />
                    {item.name}
                  </Link>
                )
              })}
            </nav>
          </div>
          
          <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-gray-700">
                  {user?.nombre?.charAt(0)?.toUpperCase()}
                </span>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-700">{user?.nombre}</p>
                <p className="text-xs text-gray-500 capitalize">{user?.rol}</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Sidebar desktop */}
      <div className="hidden lg:flex lg:flex-shrink-0 sidebar-responsive">
        <div className="flex flex-col w-64">
          <div className="flex flex-col h-0 flex-1 bg-white border-r border-gray-200">
            <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
              <div className="flex items-center justify-center flex-shrink-0 px-4">
                <div className="w-16 h-16 bg-white rounded-3xl shadow-lg flex items-center justify-center overflow-hidden">
                  <img
                    src={logoApp}
                    alt="Logo J4 Pro"
                    className="w-14 h-14 object-contain"
                  />
                </div>
              </div>
              
              <nav className="mt-5 flex-1 px-2 space-y-1">
                {navigation.map((item) => {
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`
                        group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors
                        ${isActive(item.href)
                          ? 'bg-primary-100 text-primary-900'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }
                      `}
                    >
                      <Icon className="mr-3 h-5 w-5" />
                      {item.name}
                    </Link>
                  )
                })}
              </nav>
            </div>
            
            <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
              <div className="flex items-center w-full">
                <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-gray-700">
                    {user?.nombre?.charAt(0)?.toUpperCase()}
                  </span>
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-gray-700">{user?.nombre}</p>
                  <p className="text-xs text-gray-500 capitalize">{user?.rol}</p>
                </div>
                <ButtonComponent
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  icon={<LogOut className="w-4 h-4" />}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="flex flex-col flex-1">
        {/* Header */}
        <div className="sticky top-0 z-10 flex-shrink-0 flex h-16 bg-white border-b border-gray-200">
          <button
            type="button"
            className="px-4 border-r border-gray-200 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
          
          <div className="flex-1 px-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex-1 flex items-center">
              <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">
                {navigation.find(item => isActive(item.href))?.name || 'Dashboard'}
              </h1>
            </div>
            
            <div className="flex items-center space-x-2 sm:space-x-4">
              {/* Configuración */}
              <Link
                to="/perfil"
                className="p-2 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500"
              >
                <Settings className="h-5 w-5 sm:h-6 sm:w-6" />
              </Link>
              
              {/* Usuario */}
              <div className="relative">
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-gray-700">
                      {user?.nombre?.charAt(0)?.toUpperCase()}
                    </span>
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-sm font-medium text-gray-700">{user?.nombre}</p>
                    <p className="text-xs text-gray-500 capitalize">{user?.rol}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Contenido */}
        <main className="flex-1">
          <div className="py-6">
            <div className="container-responsive">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default MainLayout
