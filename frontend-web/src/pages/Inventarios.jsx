import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { sesionesApi, handleApiError, handleApiResponse } from '../services/api'
import { Plus, Search, Eye, Play, CheckCircle, XCircle, Clock, Calendar, TrendingUp, Package, DollarSign, Filter } from 'lucide-react'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Table, { StatusBadge, TableActions } from '../components/ui/Table'
import Modal, { ModalFooter } from '../components/ui/Modal'
import SelectSearch from '../components/ui/SelectSearch'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useClientes } from '../hooks/useClientes'
import toast from 'react-hot-toast'

const Inventarios = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSesion, setSelectedSesion] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalType, setModalType] = useState('create')
  const [formData, setFormData] = useState({
    clienteNegocio: '',
    notas: '',
  })
  
  // Estados para el modal de inventarios por cliente
  const [showClientInventoriesModal, setShowClientInventoriesModal] = useState(false)
  const [selectedClientForInventories, setSelectedClientForInventories] = useState(null)
  const [dateFilter, setDateFilter] = useState({
    desde: '',
    hasta: '',
    estado: 'todos'
  })
  
  // Estado para modal de confirmación de eliminación
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [sesionToDelete, setSesionToDelete] = useState(null)
  
  const queryClient = useQueryClient()
  const { user, isAuthenticated, token } = useAuth()

  // Obtener sesiones
  const { data: sesionesData, isLoading, error: sesionesError } = useQuery(
    ['sesiones', searchTerm],
    async () => {
      const response = await sesionesApi.getAll({ buscar: searchTerm, limite: 50, pagina: 1 })
      return handleApiResponse(response)
    },
    {
      onError: (error) => {
        console.error('❌ Error al cargar sesiones:', error)
        toast.error('Error al cargar las sesiones de inventario')
      }
    }
  )

  // Obtener clientes usando el hook personalizado
  const { 
    clientes: clientesData, 
    clientesOptions, 
    isLoading: clientesLoading, 
    error: clientesError,
    refetch: refetchClientes
  } = useClientes({
    enabled: isAuthenticated,
    refetchOnWindowFocus: false
  })
  
  // Obtener inventarios por cliente
  const { data: clientInventoriesData, isLoading: clientInventoriesLoading, refetch: refetchClientInventories } = useQuery(
    ['clientInventories', selectedClientForInventories?._id, dateFilter],
    () => {
      if (!selectedClientForInventories?._id) return null
      const params = {}
      if (dateFilter.desde) params.fechaDesde = dateFilter.desde
      if (dateFilter.hasta) params.fechaHasta = dateFilter.hasta
      if (dateFilter.estado !== 'todos') params.estado = dateFilter.estado
      return sesionesApi.getByClient(selectedClientForInventories._id, params)
    },
    {
      enabled: !!selectedClientForInventories?._id,
      select: (response) => {
        // La estructura es: { data: { exito: true, datos: { sesiones } } }
        return response?.data?.datos
      },
    }
  )

  // Mutación para crear sesión
  const createMutation = useMutation(sesionesApi.create, {
    onSuccess: (response) => {
      queryClient.invalidateQueries('sesiones')
      toast.success('Sesión de inventario creada exitosamente')
      setIsModalOpen(false)
      resetForm()
      // Redirigir a la sesión creada
      const sesionId = response.data.datos?.sesion?._id || response.data.sesion?._id
      if (sesionId) {
        window.location.href = `/inventarios/${sesionId}`
      }
    },
    onError: (error) => {
      console.error('❌ Error al crear sesión:', error)
      
      // Verificar si el error es por sesión activa existente
      if (error.response?.status === 400 && error.response?.data?.datos?.sesionActiva) {
        const sesionActivaId = error.response.data.datos.sesionActiva
        
        // Mostrar mensaje personalizado con opción de ir a la sesión activa
        toast.error(
          (t) => (
            <div className="flex flex-col space-y-2">
              <p className="font-medium">Ya existe una sesión activa para este cliente</p>
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    toast.dismiss(t.id)
                    window.location.href = `/inventarios/${sesionActivaId}`
                  }}
                  className="px-3 py-1 bg-primary-600 text-white rounded hover:bg-primary-700 text-sm"
                >
                  Ir a la sesión activa
                </button>
                <button
                  onClick={() => toast.dismiss(t.id)}
                  className="px-3 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 text-sm"
                >
                  Cerrar
                </button>
              </div>
            </div>
          ),
          { duration: 8000 }
        )
        
        // Cerrar el modal
        setIsModalOpen(false)
        
        // Opcional: Redirigir automáticamente después de 3 segundos
        setTimeout(() => {
          window.location.href = `/inventarios/${sesionActivaId}`
        }, 3000)
      } else {
        // Para otros errores, usar el manejador estándar
        handleApiError(error)
      }
    },
  })

  // Mutación para completar sesión
  const completeMutation = useMutation(sesionesApi.complete, {
    onSuccess: () => {
      queryClient.invalidateQueries('sesiones')
      toast.success('Sesión completada exitosamente')
    },
    onError: handleApiError,
  })

  // Mutación para cancelar sesión
  const cancelMutation = useMutation(sesionesApi.cancel, {
    onSuccess: () => {
      queryClient.invalidateQueries('sesiones')
      toast.success('Sesión cancelada exitosamente')
    },
    onError: handleApiError,
  })

  // Resetear formulario
  const resetForm = () => {
    setFormData({
      clienteNegocio: '',
      notas: '',
    })
    setSelectedSesion(null)
  }

  // Abrir modal
  const openModal = (type, sesion = null) => {
    setModalType(type)
    if (sesion) {
      setSelectedSesion(sesion)
      setFormData({
        clienteNegocio: sesion.clienteNegocio?._id || '',
        notas: sesion.notas || '',
      })
    } else {
      resetForm()
    }
    setIsModalOpen(true)
  }

  // Manejar envío del formulario
  const handleSubmit = (e) => {
    e.preventDefault()
    
    // Validar que se haya seleccionado un cliente
    if (!formData.clienteNegocio) {
      toast.error('Por favor selecciona un cliente')
      return
    }
    
    // Validar que el ID tenga 24 caracteres
    const clienteId = String(formData.clienteNegocio).trim()
    if (clienteId.length !== 24) {
      toast.error(`ID de cliente inválido (${clienteId.length} caracteres, se requieren 24)`)
      console.error('❌ ID inválido:', clienteId, 'Longitud:', clienteId.length)
      return
    }
    
    // Preparar datos para enviar
    const datosEnviar = {
      clienteNegocio: clienteId,
      notas: formData.notas || ''
    }
    
    createMutation.mutate(datosEnviar)
  }

  // Manejar completar sesión
  const handleComplete = (sesion) => {
    if (window.confirm(`¿Estás seguro de completar la sesión ${sesion.numeroSesion}?`)) {
      completeMutation.mutate(sesion._id)
    }
  }

  // Manejar cancelar sesión con confirmación
  const handleCancelWithConfirmation = (sesion) => {
    setSesionToDelete(sesion)
    setShowDeleteModal(true)
  }

  // Confirmar eliminación
  const confirmDelete = () => {
    if (sesionToDelete) {
      handleCancel(sesionToDelete)
      setShowDeleteModal(false)
      setSesionToDelete(null)
    }
  }

  // Cancelar eliminación
  const cancelDelete = () => {
    setShowDeleteModal(false)
    setSesionToDelete(null)
  }

  // Obtener color del estado
  const getEstadoColor = (estado) => {
    switch (estado) {
      case 'completada':
        return 'success'
      case 'cancelada':
        return 'danger'
      case 'en_progreso':
        return 'warning'
      default:
        return 'info'
    }
  }

  // Obtener icono del estado
  const getEstadoIcon = (estado) => {
    switch (estado) {
      case 'completada':
        return <CheckCircle className="w-4 h-4" />
      case 'cancelada':
        return <XCircle className="w-4 h-4" />
      case 'en_progreso':
        return <Play className="w-4 h-4" />
      default:
        return <Clock className="w-4 h-4" />
    }
  }
  
  // Abrir modal de inventarios por cliente
  const openClientInventoriesModal = (cliente) => {
    setSelectedClientForInventories(cliente)
    setDateFilter({
      desde: '',
      hasta: '',
      estado: 'todos'
    })
    setShowClientInventoriesModal(true)
  }
  
  // Calcular estadísticas de inventarios del cliente
  const getClientInventoriesStats = () => {
    if (!clientInventoriesData?.sesiones) return null
    
    const sesiones = clientInventoriesData.sesiones
    const totalSesiones = sesiones.length
    const sesionesCompletadas = sesiones.filter(s => s.estado === 'completada').length
    const sesionesEnProgreso = sesiones.filter(s => s.estado === 'en_progreso' || s.estado === 'iniciada').length
    const sesionesCanceladas = sesiones.filter(s => s.estado === 'cancelada').length
    
    const valorTotal = sesiones.reduce((sum, s) => sum + (s.totales?.valorTotalInventario || 0), 0)
    const totalProductos = sesiones.reduce((sum, s) => sum + (s.totales?.totalProductosContados || 0), 0)
    
    return {
      totalSesiones,
      sesionesCompletadas,
      sesionesEnProgreso,
      sesionesCanceladas,
      valorTotal,
      totalProductos
    }
  }

  // Columnas de la tabla
  const columns = [
    {
      key: 'numeroSesion',
      title: 'Sesión',
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center space-x-2">
          <div>
            <div className="font-medium text-gray-900">{value}</div>
            <div className="text-sm text-gray-500">
              {new Date(row.fecha).toLocaleDateString()}
            </div>
          </div>
          {(row.estado === 'iniciada' || row.estado === 'en_progreso') && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
              Activa
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'clienteNegocio',
      title: 'Cliente',
      render: (_, row) => (
        <div 
          className="cursor-pointer hover:bg-blue-50 p-2 rounded transition-colors"
          onClick={() => openClientInventoriesModal(row.clienteNegocio)}
          title="Click para ver todos los inventarios de este cliente"
        >
          <div className="font-medium text-blue-600 hover:text-blue-800">{row.clienteNegocio?.nombre}</div>
          <div className="text-sm text-gray-500">{row.clienteNegocio?.telefono}</div>
        </div>
      ),
    },
    {
      key: 'estado',
      title: 'Estado',
      render: (value) => (
        <StatusBadge 
          status={value.replace('_', ' ').toUpperCase()} 
          variant={getEstadoColor(value)} 
        />
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
      title: 'Acciones',
      render: (_, row) => (
        <TableActions>
          {row.estado === 'iniciada' || row.estado === 'en_progreso' ? (
            <Link to={`/inventarios/${row._id}`}>
              <Button
                variant="primary"
                size="sm"
                icon={<Play className="w-4 h-4" />}
                className="bg-green-600 hover:bg-green-700"
              >
                Continuar
              </Button>
            </Link>
          ) : (
            <Link to={`/inventarios/${row._id}`}>
              <Button
                variant="ghost"
                size="sm"
                icon={<Eye className="w-4 h-4" />}
              >
                Ver
              </Button>
            </Link>
          )}
          
          {row.estado === 'iniciada' || row.estado === 'en_progreso' ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                icon={<CheckCircle className="w-4 h-4" />}
                onClick={() => handleComplete(row)}
                className="text-success-600 hover:text-success-700"
                title="Completar sesión"
              />
              <Button
                variant="ghost"
                size="sm"
                icon={<XCircle className="w-4 h-4" />}
                onClick={() => handleCancelWithConfirmation(row)}
                className="text-danger-600 hover:text-danger-700"
                title="Cancelar sesión"
              />
            </>
          ) : null}
        </TableActions>
      ),
    },
  ]

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="header-responsive">
        <div>
          <h1 className="heading-responsive text-gray-900">Inventarios</h1>
          <p className="text-responsive text-gray-600 mt-1">Gestiona las sesiones de inventario</p>
        </div>
        
        <Button
          variant="primary"
          icon={<Plus className="w-4 h-4" />}
          onClick={() => openModal('create')}
          className="btn-responsive"
        >
          Nueva Sesión
        </Button>
      </div>

      {/* Filtros */}
      <div className="card-responsive">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
          <div className="flex-1">
            <Input
              placeholder="Buscar sesiones..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="table-responsive">
        <Table
          data={sesionesData?.sesiones || []}
          columns={columns}
          loading={isLoading}
          emptyMessage="No hay sesiones de inventario"
        />
      </div>

      {/* Modal - Nueva Sesión */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Nueva Sesión de Inventario"
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cliente *
            </label>
            <SelectSearch
              options={clientesOptions}
              value={formData.clienteNegocio}
              onChange={(value) => {
                setFormData(prev => ({ ...prev, clienteNegocio: value }))
              }}
              placeholder={clientesLoading ? "Cargando clientes..." : "Selecciona un cliente"}
              searchPlaceholder="Buscar cliente por nombre o teléfono..."
              loading={clientesLoading}
              required
            />
            {clientesError && (
              <div className="mt-2">
                <p className="text-sm text-red-600">
                  Error al cargar clientes: {clientesError.message}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => refetchClientes()}
                  className="mt-1"
                >
                  Reintentar
                </Button>
              </div>
            )}
            {clientesData && clientesData.length === 0 && !clientesLoading && (
              <div className="mt-2">
                <p className="text-sm text-yellow-600">
                  No hay clientes disponibles. Crea un cliente primero.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => refetchClientes()}
                  className="mt-1"
                >
                  Recargar clientes
                </Button>
              </div>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <textarea
              name="notas"
              value={formData.notas}
              onChange={(e) => setFormData(prev => ({ ...prev, notas: e.target.value }))}
              rows={3}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              placeholder="Notas adicionales sobre la sesión..."
            />
          </div>

          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={createMutation.isLoading}
            >
              Crear Sesión
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Modal - Inventarios por Cliente */}
      {showClientInventoriesModal && selectedClientForInventories && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Inventarios de {selectedClientForInventories.nombre}</h2>
                  <p className="text-blue-100 mt-1">
                    {selectedClientForInventories.telefono} • {selectedClientForInventories.direccion}
                  </p>
                </div>
                <button
                  onClick={() => setShowClientInventoriesModal(false)}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Filtros */}
            <div className="p-6 bg-gray-50 border-b">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Fecha Desde
                  </label>
                  <input
                    type="date"
                    value={dateFilter.desde}
                    onChange={(e) => setDateFilter(prev => ({ ...prev, desde: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Fecha Hasta
                  </label>
                  <input
                    type="date"
                    value={dateFilter.hasta}
                    onChange={(e) => setDateFilter(prev => ({ ...prev, hasta: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Filter className="w-4 h-4 inline mr-1" />
                    Estado
                  </label>
                  <select
                    value={dateFilter.estado}
                    onChange={(e) => setDateFilter(prev => ({ ...prev, estado: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="todos">Todos</option>
                    <option value="completada">Completadas</option>
                    <option value="en_progreso">En Progreso</option>
                    <option value="iniciada">Iniciadas</option>
                    <option value="cancelada">Canceladas</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={() => setDateFilter({ desde: '', hasta: '', estado: 'todos' })}
                    className="w-full"
                  >
                    Limpiar Filtros
                  </Button>
                </div>
              </div>
            </div>

            {/* Estadísticas */}
            {clientInventoriesData?.sesiones && (() => {
              const stats = getClientInventoriesStats()
              return (
                <div className="p-6 bg-white border-b">
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-blue-600 font-medium">Total</p>
                          <p className="text-2xl font-bold text-blue-900">{stats.totalSesiones}</p>
                        </div>
                        <Package className="w-8 h-8 text-blue-400" />
                      </div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-green-600 font-medium">Completadas</p>
                          <p className="text-2xl font-bold text-green-900">{stats.sesionesCompletadas}</p>
                        </div>
                        <CheckCircle className="w-8 h-8 text-green-400" />
                      </div>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-yellow-600 font-medium">En Progreso</p>
                          <p className="text-2xl font-bold text-yellow-900">{stats.sesionesEnProgreso}</p>
                        </div>
                        <Play className="w-8 h-8 text-yellow-400" />
                      </div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-red-600 font-medium">Canceladas</p>
                          <p className="text-2xl font-bold text-red-900">{stats.sesionesCanceladas}</p>
                        </div>
                        <XCircle className="w-8 h-8 text-red-400" />
                      </div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-purple-600 font-medium">Valor Total</p>
                          <p className="text-xl font-bold text-purple-900">${stats.valorTotal.toLocaleString()}</p>
                        </div>
                        <DollarSign className="w-8 h-8 text-purple-400" />
                      </div>
                    </div>
                    <div className="bg-indigo-50 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-indigo-600 font-medium">Productos</p>
                          <p className="text-2xl font-bold text-indigo-900">{stats.totalProductos}</p>
                        </div>
                        <TrendingUp className="w-8 h-8 text-indigo-400" />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Lista de inventarios */}
            <div className="flex-1 overflow-y-auto p-6">
              {clientInventoriesLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
              ) : clientInventoriesData?.sesiones?.length > 0 ? (
                <div className="space-y-4">
                  {clientInventoriesData.sesiones.map((sesion) => (
                    <div
                      key={sesion._id}
                      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">
                              Sesión #{sesion.numeroSesion}
                            </h3>
                            <StatusBadge 
                              status={sesion.estado.replace('_', ' ').toUpperCase()} 
                              variant={getEstadoColor(sesion.estado)} 
                            />
                            {(sesion.estado === 'iniciada' || sesion.estado === 'en_progreso') && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                Activa
                              </span>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-gray-500">Fecha</p>
                              <p className="font-medium text-gray-900">
                                {new Date(sesion.fecha).toLocaleDateString('es-ES', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-500">Productos</p>
                              <p className="font-medium text-gray-900">
                                {sesion.totales?.totalProductosContados || 0}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-500">Valor Total</p>
                              <p className="font-medium text-green-600">
                                ${(sesion.totales?.valorTotalInventario || 0).toLocaleString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-500">Última Actualización</p>
                              <p className="font-medium text-gray-900">
                                {new Date(sesion.actualizadoEn).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          
                          {sesion.notas && (
                            <div className="mt-3 p-3 bg-gray-50 rounded">
                              <p className="text-sm text-gray-600">
                                <span className="font-medium">Notas:</span> {sesion.notas}
                              </p>
                            </div>
                          )}
                        </div>
                        
                        <div className="ml-4 flex flex-col space-y-2">
                          {sesion.estado === 'iniciada' || sesion.estado === 'en_progreso' ? (
                            <Link to={`/inventarios/${sesion._id}`}>
                              <Button
                                variant="primary"
                                size="sm"
                                icon={<Play className="w-4 h-4" />}
                                className="bg-green-600 hover:bg-green-700 w-full"
                              >
                                Continuar
                              </Button>
                            </Link>
                          ) : (
                            <Link to={`/inventarios/${sesion._id}`}>
                              <Button
                                variant="outline"
                                size="sm"
                                icon={<Eye className="w-4 h-4" />}
                                className="w-full"
                              >
                                Ver Detalles
                              </Button>
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                  <Package className="w-16 h-16 mb-4 text-gray-300" />
                  <p className="text-lg font-medium">No se encontraron inventarios</p>
                  <p className="text-sm">Intenta ajustar los filtros de búsqueda</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 bg-gray-50 border-t">
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowClientInventoriesModal(false)}
                >
                  Cerrar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal - Confirmación de Eliminación */}
      {showDeleteModal && sesionToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0">
                  <XCircle className="w-8 h-8 text-red-500" />
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-medium text-gray-900">
                    Cancelar Sesión
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Esta acción no se puede deshacer.
                  </p>
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
                <div className="flex">
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-red-800">
                      ¿Estás seguro de que deseas cancelar la sesión #{sesionToDelete.numeroSesion}?
                    </h4>
                    <div className="mt-2 text-sm text-red-700">
                      <p><strong>Cliente:</strong> {sesionToDelete.clienteNegocio?.nombre}</p>
                      <p><strong>Fecha:</strong> {new Date(sesionToDelete.fecha).toLocaleDateString()}</p>
                      <p><strong>Productos:</strong> {sesionToDelete.totales?.totalProductosContados || 0}</p>
                      <p><strong>Valor:</strong> ${sesionToDelete.totales?.valorTotalInventario?.toLocaleString() || '0'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={cancelDelete}
                  disabled={cancelMutation.isLoading}
                >
                  No, Cancelar
                </Button>
                <Button
                  variant="danger"
                  onClick={confirmDelete}
                  loading={cancelMutation.isLoading}
                  disabled={cancelMutation.isLoading}
                >
                  Sí, Cancelar Sesión
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Inventarios
