import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { clientesApi, handleApiError, handleApiResponse } from '../services/api'
import { Plus, Search, Edit, Trash2, Eye, Phone, MapPin, FileText } from 'lucide-react'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Table, { StatusBadge, TableActions } from '../components/ui/Table'
import Modal, { ModalFooter } from '../components/ui/Modal'
import Pagination from '../components/ui/Pagination'
import Card from '../components/ui/Card'
import ImportarPDFModal from '../components/ImportarPDFModal'
import toast from 'react-hot-toast'

const Clientes = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCliente, setSelectedCliente] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isImportarPDFModalOpen, setIsImportarPDFModalOpen] = useState(false)
  const [modalType, setModalType] = useState('create') // create, edit, view
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(5)
  const [formData, setFormData] = useState({
    nombre: '',
    telefono: '',
    direccion: '',
    notas: '',
  })
  
  const queryClient = useQueryClient()

  // Obtener clientes
  const { data: clientesData, isLoading } = useQuery(
    ['clientes', currentPage, itemsPerPage, searchTerm],
    async () => {
      const response = await clientesApi.getAll({ 
        buscar: searchTerm, 
        limite: itemsPerPage, 
        pagina: currentPage 
      })
      return handleApiResponse(response)
    }
  )

  // Mutación para crear cliente
  const createMutation = useMutation(clientesApi.create, {
    onSuccess: () => {
      queryClient.invalidateQueries('clientes')
      toast.success('Cliente creado exitosamente')
      setIsModalOpen(false)
      resetForm()
    },
    onError: handleApiError,
  })

  // Mutación para actualizar cliente
  const updateMutation = useMutation(
    ({ id, data }) => clientesApi.update(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('clientes')
        toast.success('Cliente actualizado exitosamente')
        setIsModalOpen(false)
        resetForm()
      },
      onError: handleApiError,
    }
  )

  // Mutación para eliminar cliente
  const deleteMutation = useMutation(clientesApi.delete, {
    onSuccess: () => {
      queryClient.invalidateQueries('clientes')
      toast.success('Cliente eliminado exitosamente')
    },
    onError: handleApiError,
  })

  // Resetear formulario
  const resetForm = () => {
    setFormData({
      nombre: '',
      telefono: '',
      direccion: '',
      notas: '',
    })
    setSelectedCliente(null)
  }

  // Abrir modal
  const openModal = (type, cliente = null) => {
    setModalType(type)
    if (cliente) {
      setSelectedCliente(cliente)
      setFormData({
        nombre: cliente.nombre || '',
        telefono: cliente.telefono || '',
        direccion: cliente.direccion || '',
        notas: cliente.notas || '',
      })
    } else {
      resetForm()
    }
    setIsModalOpen(true)
  }

  // Manejar envío del formulario
  const handleSubmit = (e) => {
    e.preventDefault()
    
    if (modalType === 'create') {
      createMutation.mutate(formData)
    } else if (modalType === 'edit') {
      updateMutation.mutate({ id: selectedCliente._id, data: formData })
    }
  }

  // Manejar eliminación
  const handleDelete = (cliente) => {
    if (window.confirm(`¿Estás seguro de eliminar a ${cliente.nombre}?`)) {
      deleteMutation.mutate(cliente._id)
    }
  }

  // Manejar búsqueda
  const handleSearch = (e) => {
    setSearchTerm(e.target.value)
    setCurrentPage(1)
  }

  // Columnas de la tabla
  const columns = [
    {
      key: 'nombre',
      title: 'Nombre',
      sortable: true,
      render: (value, row) => (
        <div>
          <div className="font-medium text-gray-900">{value}</div>
          <div className="text-sm text-gray-500">{row.telefono}</div>
        </div>
      ),
    },
    {
      key: 'direccion',
      title: 'Dirección',
      render: (value) => (
        <div className="flex items-center text-sm text-gray-600">
          <MapPin className="w-4 h-4 mr-1" />
          {value}
        </div>
      ),
    },
    {
      key: 'estadisticas',
      title: 'Estadísticas',
      render: (_, row) => (
        <div className="text-sm">
          <div>Inventarios: {row.estadisticas?.totalInventarios || 0}</div>
          <div>Último: {row.estadisticas?.ultimoInventario ? 
            new Date(row.estadisticas.ultimoInventario).toLocaleDateString() : 
            'Nunca'
          }</div>
        </div>
      ),
    },
    {
      key: 'activo',
      title: 'Estado',
      render: (value) => (
        <StatusBadge 
          status={value ? 'Activo' : 'Inactivo'} 
          variant={value ? 'success' : 'danger'} 
        />
      ),
    },
    {
      key: 'actions',
      title: 'Acciones',
      render: (_, row) => (
        <TableActions>
          <Button
            variant="ghost"
            size="sm"
            icon={<Eye className="w-4 h-4" />}
            onClick={() => openModal('view', row)}
          />
          <Button
            variant="ghost"
            size="sm"
            icon={<Edit className="w-4 h-4" />}
            onClick={() => openModal('edit', row)}
          />
          <Button
            variant="ghost"
            size="sm"
            icon={<Trash2 className="w-4 h-4" />}
            onClick={() => handleDelete(row)}
            className="text-danger-600 hover:text-danger-700"
          />
        </TableActions>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-600">Gestiona tus clientes y negocios</p>
        </div>
        
        <Button
          variant="primary"
          icon={<Plus className="w-4 h-4" />}
          onClick={() => openModal('create')}
        >
          Nuevo Cliente
        </Button>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg shadow-soft border border-gray-100">
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <Input
              placeholder="Buscar clientes..."
              value={searchTerm}
              onChange={handleSearch}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
        </div>
      </div>

      {/* Tabla */}
      <Card className="p-0 overflow-hidden">
        <div className="max-h-96 overflow-y-auto">
          <Table
            data={clientesData?.datos || []}
            columns={columns}
            loading={isLoading}
            emptyMessage="No hay clientes registrados"
          />
        </div>
        {clientesData?.paginacion?.totalPaginas > 1 && (
          <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
            <Pagination
              currentPage={currentPage}
              totalPages={clientesData.paginacion.totalPaginas || 1}
              totalItems={clientesData.paginacion.totalRegistros || 0}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </Card>

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          modalType === 'create' ? 'Nuevo Cliente' :
          modalType === 'edit' ? 'Editar Cliente' :
          'Detalles del Cliente'
        }
        size="md"
      >
        {modalType === 'view' ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Nombre</label>
              <p className="mt-1 text-sm text-gray-900">{selectedCliente?.nombre}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Teléfono</label>
              <p className="mt-1 text-sm text-gray-900">{selectedCliente?.telefono}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Dirección</label>
              <p className="mt-1 text-sm text-gray-900">{selectedCliente?.direccion}</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Estadísticas de Inventarios</label>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total de Inventarios:</span>
                  <span className="text-sm font-bold text-blue-600">
                    {selectedCliente?.estadisticas?.totalInventarios || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Último Inventario:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {selectedCliente?.estadisticas?.ultimoInventario 
                      ? new Date(selectedCliente.estadisticas.ultimoInventario).toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })
                      : 'Nunca'}
                  </span>
                </div>
              </div>
            </div>
            {selectedCliente?.notas && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Notas</label>
                <p className="mt-1 text-sm text-gray-900">{selectedCliente.notas}</p>
              </div>
            )}
            
            {/* Botón para importar PDF */}
            <div className="pt-4 border-t border-gray-200">
              <Button
                variant="primary"
                icon={<FileText className="w-4 h-4" />}
                onClick={() => {
                  setIsModalOpen(false)
                  setIsImportarPDFModalOpen(true)
                }}
                className="w-full"
              >
                Importar Inventario desde PDF
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Nombre del Cliente"
              name="nombre"
              value={formData.nombre}
              onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
              required
            />
            
            <Input
              label="Teléfono"
              name="telefono"
              value={formData.telefono}
              onChange={(e) => setFormData(prev => ({ ...prev, telefono: e.target.value }))}
              required
            />
            
            <Input
              label="Dirección"
              name="direccion"
              value={formData.direccion}
              onChange={(e) => setFormData(prev => ({ ...prev, direccion: e.target.value }))}
              required
            />
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
              <textarea
                name="notas"
                value={formData.notas}
                onChange={(e) => setFormData(prev => ({ ...prev, notas: e.target.value }))}
                rows={3}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                placeholder="Notas adicionales sobre el cliente..."
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
                loading={createMutation.isLoading || updateMutation.isLoading}
              >
                {modalType === 'create' ? 'Crear Cliente' : 'Actualizar Cliente'}
              </Button>
            </ModalFooter>
          </form>
        )}
      </Modal>

      {/* Modal para importar PDF */}
      <ImportarPDFModal
        isOpen={isImportarPDFModalOpen}
        onClose={() => {
          setIsImportarPDFModalOpen(false)
          setSelectedCliente(null)
        }}
        cliente={selectedCliente}
      />
    </div>
  )
}

export default Clientes



