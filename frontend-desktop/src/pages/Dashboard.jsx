import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { useQuery } from 'react-query'
import { clientesApi, sesionesApi, reportesApi, handleApiResponse } from '../services/api'
import {
  Users,
  Package,
  TrendingUp,
  DollarSign,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  BarChart3,
  Plus,
} from 'lucide-react'
import Button from '../components/ui/Button'
import { Link } from 'react-router-dom'

const Dashboard = () => {
  const { user } = useAuth()
  const [stats, setStats] = useState({
    totalClientes: 0,
    sesionesActivas: 0,
    sesionesCompletadas: 0,
    valorTotalInventarios: 0,
  })

  // Obtener estadísticas de clientes (total en BD)
  const { data: clientesData } = useQuery(
    'clientes-stats',
    async () => {
      const response = await clientesApi.getAll({ limite: 1, pagina: 1 })
      const datos = handleApiResponse(response)
      return datos.paginacion?.total ?? datos.paginacion?.totalRegistros ?? 0
    }
  )

  // Obtener sesiones recientes
  const { data: sesionesData } = useQuery(
    'sesiones-recientes',
    async () => {
      const response = await sesionesApi.getAll({ limite: 5, pagina: 1 })
      return handleApiResponse(response)
    }
  )

  // Obtener estadísticas de reportes
  const { data: reportesData } = useQuery(
    'reportes-stats',
    async () => {
      const response = await reportesApi.getStats()
      return handleApiResponse(response)
    }
  )

  // Actualizar estadísticas
  useEffect(() => {
    if (clientesData !== undefined) {
      setStats(prev => ({
        ...prev,
        totalClientes: clientesData,
      }))
    }
  }, [clientesData])

  useEffect(() => {
    if (reportesData?.estadisticasGenerales) {
      const stats = reportesData.estadisticasGenerales
      setStats(prev => ({
        ...prev,
        sesionesCompletadas: stats.totalSesiones || 0,
        valorTotalInventarios: stats.valorTotalInventarios || 0,
      }))
    }
  }, [reportesData])

  // Calcular sesiones activas
  useEffect(() => {
    if (sesionesData?.sesiones) {
      const activas = sesionesData.sesiones.filter(
        sesion => sesion.estado === 'iniciada' || sesion.estado === 'en_progreso'
      ).length
      setStats(prev => ({
        ...prev,
        sesionesActivas: activas,
      }))
    }
  }, [sesionesData])

  // Tarjetas de estadísticas
  const statCards = [
    {
      title: 'Total Clientes',
      value: stats.totalClientes,
      icon: Users,
      color: 'text-primary-600',
      bgColor: 'bg-primary-100',
      change: '+12%',
      changeType: 'positive',
    },
    {
      title: 'Sesiones Activas',
      value: stats.sesionesActivas,
      icon: Clock,
      color: 'text-warning-600',
      bgColor: 'bg-warning-100',
      change: '+3',
      changeType: 'positive',
    },
    {
      title: 'Sesiones Completadas',
      value: stats.sesionesCompletadas,
      icon: CheckCircle,
      color: 'text-success-600',
      bgColor: 'bg-success-100',
      change: '+8%',
      changeType: 'positive',
    },
    {
      title: 'Valor Total Inventarios',
      value: `$${stats.valorTotalInventarios.toLocaleString()}`,
      icon: DollarSign,
      color: 'text-danger-600',
      bgColor: 'bg-danger-100',
      change: '+15%',
      changeType: 'positive',
    },
  ]

  // Actividades recientes
  const recentActivities = [
    {
      id: 1,
      type: 'inventario',
      title: 'Sesión de inventario completada',
      description: 'Cliente: Tienda ABC - Valor: $15,000',
      time: 'Hace 2 horas',
      icon: Package,
      color: 'text-success-600',
    },
    {
      id: 2,
      type: 'cliente',
      title: 'Nuevo cliente agregado',
      description: 'Supermercado XYZ registrado',
      time: 'Hace 4 horas',
      icon: Users,
      color: 'text-primary-600',
    },
    {
      id: 3,
      type: 'reporte',
      title: 'Reporte generado',
      description: 'Balance mensual - Enero 2024',
      time: 'Hace 6 horas',
      icon: BarChart3,
      color: 'text-warning-600',
    },
  ]

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="header-responsive">
        <div>
          <h1 className="heading-responsive text-gray-900">
            ¡Hola, {user?.nombre}!
          </h1>
          <p className="text-responsive text-gray-600 mt-1">
            Aquí tienes un resumen de tu actividad reciente
          </p>
        </div>

        <div className="flex space-x-3">
          <Link to="/inventarios">
            <Button
              variant="primary"
              icon={<Plus className="w-4 h-4" />}
              className="btn-responsive"
            >
              Nueva Sesión
            </Button>
          </Link>
        </div>
      </div>

      {/* Tarjetas de estadísticas */}
      <div className="dashboard-grid">
        {statCards.map((card, index) => {
          const Icon = card.icon
          return (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="card-responsive hover-lift"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-600 truncate">{card.title}</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
                  <p className={`text-xs sm:text-sm mt-1 ${card.changeType === 'positive' ? 'text-success-600' : 'text-danger-600'
                    }`}>
                    {card.change} vs mes anterior
                  </p>
                </div>
                <div className={`w-10 h-10 sm:w-12 sm:h-12 ${card.bgColor} rounded-lg flex items-center justify-center flex-shrink-0 ml-2`}>
                  <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${card.color}`} />
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      <div className="dashboard-content-grid">
        {/* Sesiones recientes */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="card-responsive"
        >
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Sesiones Recientes</h3>
              <Link
                to="/inventarios"
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                Ver todas
              </Link>
            </div>
          </div>

          <div className="p-4">
            {sesionesData?.sesiones?.length > 0 ? (
              <div className="space-y-3">
                {sesionesData.sesiones.map((sesion) => {
                  const sesionId = sesion._id ?? sesion.id
                  return (
                    <Link
                      key={sesionId}
                      to={sesionId ? `/inventarios/${sesionId}` : '/inventarios'}
                      className="flex items-center space-x-4 p-2 -mx-2 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${sesion.estado === 'completada' ? 'bg-success-500' :
                        sesion.estado === 'en_progreso' ? 'bg-warning-500' :
                          'bg-primary-500'
                        }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {sesion.numeroSesion}
                        </p>
                        <p className="text-sm text-gray-500">
                          {sesion.clienteNegocio?.nombre}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          ${sesion.totales?.valorTotalInventario?.toLocaleString() || '0'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(sesion.fecha).toLocaleDateString()}
                        </p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No hay sesiones recientes</p>
                <Link to="/inventarios">
                  <Button variant="outline" size="sm" className="mt-4">
                    Crear primera sesión
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </motion.div>

        {/* Actividades recientes */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="card-responsive"
        >
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Actividades Recientes</h3>
          </div>

          <div className="p-4">
            <div className="space-y-3">
              {recentActivities.map((activity, index) => {
                const Icon = activity.icon
                return (
                  <div key={activity.id} className="flex items-start space-x-4">
                    <div className={`w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center`}>
                      <Icon className={`w-4 h-4 ${activity.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {activity.title}
                      </p>
                      <p className="text-sm text-gray-500">
                        {activity.description}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {activity.time}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Acciones rápidas */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
        className="bg-white rounded-xl shadow-soft border border-gray-100 p-4"
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Acciones Rápidas</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Link to="/clientes">
            <Button variant="outline" className="w-full justify-start text-responsive">
              <Users className="w-4 h-4 mr-2" />
              Gestionar Clientes
            </Button>
          </Link>
          <Link to="/inventarios">
            <Button variant="outline" className="w-full justify-start text-responsive">
              <Package className="w-4 h-4 mr-2" />
              Ver Inventarios
            </Button>
          </Link>
          <Link to="/reportes">
            <Button variant="outline" className="w-full justify-start text-responsive sm:col-span-2 lg:col-span-1">
              <BarChart3 className="w-4 h-4 mr-2" />
              Generar Reportes
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>
  )
}

export default Dashboard
