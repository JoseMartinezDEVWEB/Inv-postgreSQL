import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { productosApi, handleApiError, handleApiResponse } from '../services/api'
import { 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  Package,
  DollarSign,
  Tag,
  ShoppingCart,
  Upload,
  Users,
  Send
} from 'lucide-react'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import ErrorMessage from '../components/ui/ErrorMessage'
import Table from '../components/ui/Table'
import Pagination from '../components/ui/Pagination'
import Modal from '../components/ui/Modal'
import ProductoForm from '../components/ProductoForm'
import ImportModal from '../components/ui/ImportModal'
import { toast } from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../hooks/useSocket'
import webSocketService from '../services/websocket'

const ProductosGenerales = () => {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { onlineColaboradores, isConnected, enviarInventarioAColaboradores, obtenerColaboradoresEnLinea } = useSocket()
  const [showModal, setShowModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(5)
  const [isEnviandoInventario, setIsEnviandoInventario] = useState(false)

  // Consulta de productos generales
  const { data: productosData, isLoading, error } = useQuery(
    ['productos-generales', currentPage, itemsPerPage, searchTerm, selectedCategory],
    async () => {
      const response = await productosApi.getAllGenerales({
        pagina: currentPage,
        limite: itemsPerPage,
        buscar: searchTerm,
        categoria: selectedCategory
      })
      return handleApiResponse(response)
    },
    {
      onError: handleApiError
    }
  )

  // Consulta de categorías
  const { data: categoriasData } = useQuery(
    'categorias-productos',
    async () => {
      const response = await productosApi.getCategorias()
      return handleApiResponse(response)
    },
    {
      onError: handleApiError
    }
  )

  // Consulta para estadísticas generales
  const { data: estadisticasData } = useQuery(
    'estadisticas-productos-generales',
    async () => {
      const response = await productosApi.getAllGenerales({
        pagina: 1,
        limite: 1,
        // Solo necesitamos el total, no los productos
      })
      return handleApiResponse(response)
    },
    {
      onError: handleApiError
    }
  )

  // Mutación para crear producto
  const createMutation = useMutation(
    async (productoData) => {
      const response = await productosApi.createGeneral(productoData)
      return handleApiResponse(response)
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('productos-generales')
        setShowModal(false)
        toast.success('Producto creado exitosamente')
      },
      onError: handleApiError
    }
  )

  // Mutación para actualizar producto
  const updateMutation = useMutation(
    async ({ id, productoData }) => {
      const response = await productosApi.updateGeneral(id, productoData)
      return handleApiResponse(response)
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('productos-generales')
        setShowModal(false)
        setEditingProduct(null)
        toast.success('Producto actualizado exitosamente')
      },
      onError: handleApiError
    }
  )

  // Mutación para eliminar producto
  const deleteMutation = useMutation(
    async (id) => {
      const response = await productosApi.deleteGeneral(id)
      return handleApiResponse(response)
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('productos-generales')
        toast.success('Producto eliminado exitosamente')
      },
      onError: handleApiError
    }
  )

  const productos = productosData?.datos || []
  const paginacion = productosData?.paginacion || {}
  const categorias = categoriasData?.categorias || []

  // Debug: Log productos para verificar estructura
  console.log('Productos recibidos:', productos)
  if (productos.length > 0) {
    console.log('Primer producto:', productos[0])
  }

  const handleCreateProduct = () => {
    setEditingProduct(null)
    setShowModal(true)
  }

  const handleEditProduct = (producto) => {
    setEditingProduct(producto)
    setShowModal(true)
  }

  const handleDeleteProduct = (producto) => {
    if (window.confirm(`¿Estás seguro de que quieres eliminar "${producto.nombre}"?`)) {
      deleteMutation.mutate(producto._id)
    }
  }

  const handleSubmitProduct = (productoData) => {
    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct._id, productoData })
    } else {
      createMutation.mutate(productoData)
    }
  }

  const handleImportProducts = async (products) => {
    // Los productos ya vienen procesados del backend, solo necesitamos mostrarlos
    // El backend ya los ha creado/actualizado en la base de datos
    const toastId = toast.loading(`Procesando ${products.length} productos...`);
    
    try {
      // Los productos ya están en la base de datos, solo invalidar la query
      queryClient.invalidateQueries('productos-generales');
      
      toast.dismiss(toastId);
      toast.success(`Se importaron ${products.length} productos correctamente`);
    } catch (error) {
      toast.dismiss(toastId);
      toast.error(`Error al finalizar la importación: ${error.message}`);
    }
  }

  const handleSearch = (e) => {
    setSearchTerm(e.target.value)
    setCurrentPage(1)
  }

  const handleCategoryFilter = (categoria) => {
    setSelectedCategory(categoria === selectedCategory ? '' : categoria)
    setCurrentPage(1)
  }

  // Función para enviar productos a colaboradores
  const handleEnviarProductosAColaboradores = async () => {
    if (!isConnected) {
      toast.error('No hay conexión con el servidor')
      return
    }

    if (onlineColaboradores === 0) {
      toast.error('No hay colaboradores en línea')
      return
    }

    setIsEnviandoInventario(true)
    const toastId = toast.loading('Obteniendo productos...')

    try {
      // Obtener todos los productos (sin paginación)
      const response = await productosApi.getAllGenerales({
        pagina: 1,
        limite: 10000, // Límite alto para obtener todos
        buscar: '',
        categoria: ''
      })
      
      const data = handleApiResponse(response)
      const todosLosProductos = data.productos || data.datos || []

      if (todosLosProductos.length === 0) {
        toast.dismiss(toastId)
        toast.error('No hay productos para enviar')
        setIsEnviandoInventario(false)
        return
      }

      // Formatear productos para enviar (solo campos necesarios)
      const productosFormateados = todosLosProductos.map(producto => ({
        nombre: producto.nombre,
        costo: producto.costoBase || 0,
        codigo_barra: producto.codigoBarras || '',
        cantidad: 0, // Por defecto 0, ya que esto es el inventario general
        codigoBarras: producto.codigoBarras || '',
        categoria: producto.categoria || '',
        unidad: producto.unidad || '',
        descripcion: producto.descripcion || ''
      }))

      toast.dismiss(toastId)
      toast.loading(`Enviando inventario a ${onlineColaboradores} colaborador(es)...`, { id: toastId })

      // Enviar a través de Socket.io
      enviarInventarioAColaboradores(productosFormateados)

      // El resultado se manejará en el useEffect de abajo

    } catch (error) {
      toast.dismiss(toastId)
      handleApiError(error)
      setIsEnviandoInventario(false)
    }
  }

  // Escuchar resultado del envío de inventario
  useEffect(() => {
    if (user?.rol !== 'administrador' || !isConnected) return

    const handleResultado = (data) => {
      setIsEnviandoInventario(false)
      if (data.success) {
        toast.success(data.message || `Inventario enviado a ${data.count} colaborador(es)`)
      } else {
        toast.error(data.message || 'Error al enviar inventario')
      }
    }

    webSocketService.on('sync_finished_ok', handleResultado)

    return () => {
      webSocketService.off('sync_finished_ok', handleResultado)
    }
  }, [user?.rol, isConnected])

  // Columnas de la tabla
  const columns = [
    {
      key: 'nombre',
      title: 'Producto',
      render: (value, producto) => (
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
            <Package className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <div className="font-medium text-gray-900">{producto.nombre}</div>
            {producto.descripcion && (
              <div className="text-sm text-gray-500">{producto.descripcion}</div>
            )}
          </div>
        </div>
      )
    },
    {
      key: 'categoria',
      title: 'Categoría',
      render: (value, producto) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          <Tag className="w-3 h-3 mr-1" />
          {producto.categoria}
        </span>
      )
    },
    {
      key: 'unidad',
      title: 'Unidad',
      render: (value, producto) => (
        <span className="text-sm text-gray-600">{producto.unidad}</span>
      )
    },
    {
      key: 'costoBase',
      title: 'Costo Base',
      render: (value, producto) => (
        <div className="flex items-center space-x-1">
          <DollarSign className="w-4 h-4 text-green-600" />
          <span className="font-medium text-green-600">
            ${producto.costoBase?.toLocaleString() || 0}
          </span>
        </div>
      )
    },
    {
      key: 'codigoBarras',
      title: 'Código de Barras',
      render: (value, producto) => (
        <span className="text-sm text-gray-600 font-mono">
          {producto.codigoBarras || '-'}
        </span>
      )
    },
    {
      key: 'proveedor',
      title: 'Proveedor',
      render: (value, producto) => (
        <span className="text-sm text-gray-600">{producto.proveedor || '-'}</span>
      )
    },
    {
      key: 'estadisticas',
      title: 'Uso',
      render: (value, producto) => (
        <div className="text-sm text-gray-600">
          <div>{producto.estadisticas?.totalClientes || 0} clientes</div>
          <div>{producto.estadisticas?.totalInventarios || 0} inventarios</div>
        </div>
      )
    },
    {
      key: 'actions',
      title: 'Acciones',
      render: (value, producto) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleEditProduct(producto)}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Editar producto"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDeleteProduct(producto)}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Eliminar producto"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return <ErrorMessage message="Error al cargar los productos generales" />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Productos Generales</h1>
          <p className="text-gray-600">Gestiona la lista maestra de productos disponibles</p>
        </div>
        <div className="flex gap-2 items-center">
          {/* Colaboradores en línea (solo para admins) */}
          {user?.rol === 'administrador' && (
            <div 
              className="flex items-center space-x-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors"
              onClick={() => {
                if (isConnected) {
                  console.log('🔄 Actualizando contador manualmente...')
                  obtenerColaboradoresEnLinea()
                }
              }}
              title={isConnected ? 'Click para actualizar' : 'Sin conexión WebSocket'}
            >
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
              <Users className={`w-4 h-4 ${isConnected ? 'text-blue-600' : 'text-gray-400'}`} />
              <span className="text-sm font-medium text-gray-700">
                Colaboradores activos:
              </span>
              <span className={`text-sm font-bold ${isConnected ? 'text-blue-600' : 'text-gray-400'}`}>
                {isConnected ? (onlineColaboradores ?? 0) : '--'}
              </span>
              {!isConnected && (
                <span className="text-xs text-gray-500 ml-1">(Sin conexión)</span>
              )}
            </div>
          )}
          {user?.rol === 'administrador' && (
            <>
              <Button
                onClick={handleEnviarProductosAColaboradores}
                disabled={!isConnected || onlineColaboradores === 0 || isEnviandoInventario}
                variant="outline"
                className="flex items-center space-x-2 bg-green-50 hover:bg-green-100 border-green-200 text-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                title={onlineColaboradores === 0 ? 'No hay colaboradores en línea' : 'Enviar inventario a colaboradores'}
              >
                <Send className="w-4 h-4" />
                <span>{isEnviandoInventario ? 'Enviando...' : 'Enviar a Colaboradores'}</span>
              </Button>
              <Button
                onClick={() => setShowImportModal(true)}
                variant="outline"
                className="flex items-center space-x-2 bg-yellow-50 hover:bg-yellow-100 border-yellow-200 text-yellow-700"
              >
                <Upload className="w-4 h-4" />
                <span>Importar Lista</span>
              </Button>
            </>
          )}
          <Button
            onClick={handleCreateProduct}
            className="flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar Producto</span>
          </Button>
        </div>
      </div>

      {/* Filtros y búsqueda */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar productos..."
                value={searchTerm}
                onChange={handleSearch}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleCategoryFilter('')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedCategory === ''
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Todas
            </button>
            {categorias.map((categoria) => (
              <button
                key={categoria}
                onClick={() => handleCategoryFilter(categoria)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategory === categoria
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {categoria}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Productos</p>
              <p className="text-2xl font-bold text-gray-900">
                {estadisticasData?.paginacion?.totalRegistros || paginacion.totalRegistros || 0}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Tag className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Categorías</p>
              <p className="text-2xl font-bold text-gray-900">{categorias.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Productos Activos</p>
              <p className="text-2xl font-bold text-gray-900">
                {productos.filter(p => p.activo !== false).length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabla de productos */}
      <Card className="p-0 overflow-hidden">
        <div className="max-h-96 overflow-y-auto">
          <Table
            data={productos}
            columns={columns}
            loading={isLoading}
            emptyMessage="No se encontraron productos generales"
          />
        </div>
        {paginacion.totalPaginas > 1 && (
          <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
            <Pagination
              currentPage={currentPage}
              totalPages={paginacion.totalPaginas || 1}
              totalItems={paginacion.totalRegistros || 0}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </Card>

      {/* Modal para agregar/editar producto */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false)
          setEditingProduct(null)
        }}
        title={editingProduct ? 'Editar Producto' : 'Agregar Producto'}
        size="lg"
      >
        <ProductoForm
          producto={editingProduct}
          onSubmit={handleSubmitProduct}
          onCancel={() => {
            setShowModal(false)
            setEditingProduct(null)
          }}
          isLoading={createMutation.isLoading || updateMutation.isLoading}
        />
      </Modal>

      {/* Modal de Importación */}
      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImportProducts}
      />
    </div>
  )
}

export default ProductosGenerales

