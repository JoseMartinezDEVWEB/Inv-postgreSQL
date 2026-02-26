import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from 'react-query'
import { reportesApi, sesionesApi } from '../services/api'
import { Download, BarChart3, TrendingUp, Calendar, FileText } from 'lucide-react'
import Button from '../components/ui/Button'
import Table, { StatusBadge } from '../components/ui/Table'
import { Link } from 'react-router-dom'

const Reportes = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('30') // días

  // Obtener estadísticas de reportes
  const { data: statsData, isLoading: statsLoading } = useQuery(
    ['reportes-stats', selectedPeriod],
    () => {
      const fechaFin = new Date()
      const fechaInicio = new Date()
      fechaInicio.setDate(fechaInicio.getDate() - parseInt(selectedPeriod))
      
      return reportesApi.getStats({
        fechaInicio: fechaInicio.toISOString().split('T')[0],
        fechaFin: fechaFin.toISOString().split('T')[0],
      })
    },
    {
      select: (data) => data.data,
    }
  )

  // Obtener sesiones completadas para reportes
  const { data: sesionesData, isLoading: sesionesLoading } = useQuery(
    'sesiones-completadas',
    () => sesionesApi.getAll({ limite: 20, pagina: 1 }),
    {
      select: (data) => data.data.sesiones.filter(s => s.estado === 'completada'),
    }
  )

  // Descargar reporte PDF
  const downloadReport = async (sesionId, type) => {
    try {
      const response = type === 'balance' 
        ? await reportesApi.downloadBalancePDF(sesionId)
        : await reportesApi.downloadInventoryPDF(sesionId)
      
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${type}_${sesionId}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error descargando reporte:', error)
    }
  }

  // Tarjetas de estadísticas
  const statCards = [
    {
      title: 'Total Sesiones',
      value: statsData?.estadisticasGenerales?.totalSesiones || 0,
      icon: BarChart3,
      color: 'text-primary-600',
      bgColor: 'bg-primary-100',
    },
    {
      title: 'Valor Total',
      value: `$${(statsData?.estadisticasGenerales?.valorTotalInventarios || 0).toLocaleString()}`,
      icon: TrendingUp,
      color: 'text-success-600',
      bgColor: 'bg-success-100',
    },
    {
      title: 'Productos Contados',
      value: statsData?.estadisticasGenerales?.totalProductosContados || 0,
      icon: FileText,
      color: 'text-warning-600',
      bgColor: 'bg-warning-100',
    },
    {
      title: 'Valor Promedio',
      value: `$${(statsData?.estadisticasGenerales?.valorPromedioInventario || 0).toLocaleString()}`,
      icon: Calendar,
      color: 'text-danger-600',
      bgColor: 'bg-danger-100',
    },
  ]

  // Columnas de la tabla de sesiones
  const columns = [
    {
      key: 'numeroSesion',
      title: 'Sesión',
      render: (value, row) => (
        <div>
          <div className="font-medium text-gray-900">{value}</div>
          <div className="text-sm text-gray-500">
            {new Date(row.fecha).toLocaleDateString()}
          </div>
        </div>
      ),
    },
    {
      key: 'clienteNegocio',
      title: 'Cliente',
      render: (_, row) => (
        <div className="font-medium text-gray-900">{row.clienteNegocio?.nombre}</div>
      ),
    },
    {
      key: 'totales',
      title: 'Valor Total',
      render: (_, row) => (
        <div className="text-right">
          <div className="font-medium text-gray-900">
            ${row.totales?.valorTotalInventario?.toLocaleString() || '0'}
          </div>
          <div className="text-sm text-gray-500">
            {row.totales?.totalProductosContados || 0} productos
          </div>
        </div>
      ),
    },
    {
      key: 'actions',
      title: 'Reportes',
      render: (_, row) => (
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            icon={<Download className="w-4 h-4" />}
            onClick={() => downloadReport(row._id, 'balance')}
          >
            Balance
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={<Download className="w-4 h-4" />}
            onClick={() => downloadReport(row._id, 'inventory')}
          >
            Inventario
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
          <p className="text-gray-600">Genera y descarga reportes de inventarios y balances</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="7">Últimos 7 días</option>
            <option value="30">Últimos 30 días</option>
            <option value="90">Últimos 90 días</option>
            <option value="365">Último año</option>
          </select>
        </div>
      </div>

      {/* Tarjetas de estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, index) => {
          const Icon = card.icon
          return (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="bg-white p-6 rounded-xl shadow-soft border border-gray-100 hover-lift"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{card.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
                </div>
                <div className={`w-12 h-12 ${card.bgColor} rounded-lg flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 ${card.color}`} />
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Gráfico de distribución mensual */}
      {statsData?.distribucionMensual && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="bg-white p-6 rounded-xl shadow-soft border border-gray-100"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Distribución por Mes
          </h3>
          <div className="space-y-3">
            {statsData.distribucionMensual.map((mes, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-primary-500 rounded-full"></div>
                  <span className="text-sm text-gray-600">
                    {mes._id.mes}/{mes._id.año}
                  </span>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-600">{mes.sesiones} sesiones</span>
                  <span className="text-sm font-medium text-gray-900">
                    ${mes.valorTotal.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Tabla de sesiones para reportes */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="bg-white rounded-xl shadow-soft border border-gray-100"
      >
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Sesiones Completadas
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Descarga reportes de balance e inventario para cada sesión
          </p>
        </div>
        
        <div className="p-6">
          <Table
            data={sesionesData || []}
            columns={columns}
            loading={sesionesLoading}
            emptyMessage="No hay sesiones completadas para generar reportes"
          />
        </div>
      </motion.div>
    </div>
  )
}

export default Reportes



