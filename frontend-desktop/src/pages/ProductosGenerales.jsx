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
  Users,
  Send,
  Menu
} from 'lucide-react'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import ErrorMessage from '../components/ui/ErrorMessage'
import Table from '../components/ui/Table'
import Pagination from '../components/ui/Pagination'
import Modal from '../components/ui/Modal'
import ProductoForm from '../components/ProductoForm'
import { toast } from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import ImportModal from '../components/ui/ImportModal'
import { Upload } from 'lucide-react'
import { useSocket } from '../hooks/useSocket'
import webSocketService from '../services/websocket'
import { useHotkeys } from 'react-hotkeys-hook'
import { useRef } from 'react'

const ProductosGenerales = () => {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { onlineColaboradores, isConnected, enviarInventarioAColaboradores, obtenerColaboradoresEnLinea } = useSocket()
  const [showModal, setShowModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showCategoryMenu, setShowCategoryMenu] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(5)
  const [isEnviandoInventario, setIsEnviandoInventario] = useState(false)
  const searchInputRef = useRef(null)

  // Hotkeys
  useHotkeys('mod+n', (e) => {
    e.preventDefault()
    handleCreateProduct()
  }, { enableOnFormTags: true })

  useHotkeys('mod+f', (e) => {
    e.preventDefault()
    searchInputRef.current?.focus()
  }, { enableOnFormTags: true })

  // Efecto global para sincronizar con colaboradores en tiempo real
  useEffect(() => {
    const handleProductoGeneralCreado = (payload) => {
      console.log('🔄 Catálogo global notificado de nuevo producto genérico', payload)
      queryClient.invalidateQueries('productos-generales')
      queryClient.invalidateQueries('estadisticas-productos-generales')
      queryClient.invalidateQueries('categorias-productos')
    }

    if (webSocketService) {
      webSocketService.on('producto_general_creado', handleProductoGeneralCreado)
    }

    return () => {
      if (webSocketService) {
        webSocketService.off('producto_general_creado', handleProductoGeneralCreado)
      }
    }
  }, [queryClient])

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

  // Mutación para eliminar TODOS los productos
  const deleteAllMutation = useMutation(
    async () => {
      const response = await productosApi.deleteAllGenerales()
      return handleApiResponse(response)
    },
    {
      onSuccess: (data) => {
        queryClient.invalidateQueries('productos-generales')
        toast.success(data.mensaje || 'Todos los productos han sido eliminados')
      },
      onError: (err) => {
        console.error('❌ [Frontend] Error al eliminar todo:', err);
        handleApiError(err);
      }
    }
  )

  const productos = productosData?.datos || []
  const paginacion = productosData?.paginacion || {}
  const categorias = categoriasData?.categorias || categoriasData || []

  // Debug: Log productos para verificar estructura
  console.log('Productos recibidos:', productos.length, 'items')
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
      deleteMutation.mutate(producto.id)
    }
  }

  const handleDeleteAllProducts = () => {
    if (window.confirm('⚠️ ¿ESTÁS SEGURO? Esta acción eliminará TODOS los productos generales de la base de datos. Esto se usa para renovar la base de datos antes de una importación masiva. NO SE PUEDE DESHACER.')) {
      if (window.confirm('Confirma nuevamente: ¿Deseas borrar TODO el inventario?')) {
        deleteAllMutation.mutate()
      }
    }
  }

  const handleSubmitProduct = (productoData) => {
    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, productoData })
    } else {
      createMutation.mutate(productoData)
    }
  }

  const handleImportProducts = async (products) => {
    const toastId = toast.loading(`Procesando ${products.length} productos...`);
    try {
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
      const response = await productosApi.getAllGenerales({
        pagina: 1,
        limite: 10000,
        buscar: '',
        categoria: ''
      })

      const data = handleApiResponse(response)
      
      // Manejo robusto de la respuesta (puede ser un array directo o un objeto con datos/productos/rows)
      let todosLosProductos = [];
      if (Array.isArray(data)) {
        todosLosProductos = data;
      } else if (data && typeof data === 'object') {
        todosLosProductos = data.datos || data.productos || data.rows || [];
      }

      if (todosLosProductos.length === 0) {
        toast.dismiss(toastId)
        toast.error('No hay productos para enviar')
        setIsEnviandoInventario(false)
        return
      }

      console.log(`📦 [Desktop] Procesando ${todosLosProductos.length} productos para enviar al móvil`)

      const productosFormateados = todosLosProductos.map(p => ({
        _id: p._id || p.id,
        id: p.id || p._id,
        nombre: p.nombre || '',
        sku: p.sku || '',
        codigoBarras: p.codigoBarras || '',
        codigo_barra: p.codigoBarras || '',
        costo: p.costo || p.costoBase || 0,
        precioVenta: p.precioVenta || 0,
        unidad: p.unidad || 'unidad',
        categoria: p.categoria || 'General',
        descripcion: p.descripcion || ''
      }))

      toast.dismiss(toastId)
      toast.loading(`Enviando inventario a ${onlineColaboradores} colaborador(es)...`, { id: toastId })
      enviarInventarioAColaboradores(productosFormateados)

      setTimeout(() => {
        toast.dismiss(toastId)
        toast.success(`Inventario enviado a ${onlineColaboradores} colaborador(es)`)
        setIsEnviandoInventario(false)
      }, 500)

    } catch (error) {
      toast.dismiss(toastId)
      handleApiError(error)
      setIsEnviandoInventario(false)
    }
  }

  // Escuchar resultado del envío de inventario
  useEffect(() => {
    const allowedRoles = ['administrador', 'contable']
    if (!allowedRoles.includes(user?.rol) || !isConnected) return

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

  // Debug: Log del estado de colaboradores
  useEffect(() => {
    const allowedRoles = ['administrador', 'contable']
    if (allowedRoles.includes(user?.rol)) {
      console.log('🔍 [ProductosGenerales] Estado:', {
        isConnected,
        onlineColaboradores,
        userRol: user?.rol
      })
    }
  }, [isConnected, onlineColaboradores, user?.rol])

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
          {/* Colaboradores en línea (admin y contable) */}
          {['administrador', 'contable'].includes(user?.rol) && (
            <div
              className="flex items-center space-x-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors"
              onClick={() => {
                if (isConnected) {
                  obtenerColaboradoresEnLinea()
                }
              }}
              title={isConnected ? 'Click para actualizar' : 'Sin conexión WebSocket'}
            >
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
              <Users className={`w-4 h-4 ${isConnected ? 'text-blue-600' : 'text-gray-400'}`} />
              <span className="text-sm font-medium text-gray-700">
                Colaboradores:
              </span>
              <span className={`text-sm font-bold ${isConnected ? 'text-blue-600' : 'text-gray-400'}`}>
                {isConnected ? (onlineColaboradores ?? 0) : '--'}
              </span>
            </div>
          )}
          {['administrador', 'contable'].includes(user?.rol) && (
            <>
              {user?.rol === 'administrador' && (
                <Button
                  onClick={handleDeleteAllProducts}
                  disabled={deleteAllMutation.isLoading}
                  variant="outline"
                  className="flex items-center space-x-2 bg-red-50 hover:bg-red-100 border-red-200 text-red-700"
                  title="Eliminar todos los productos"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{deleteAllMutation.isLoading ? 'Eliminando...' : 'Eliminar Todo'}</span>
                </Button>
              )}
              <Button
                onClick={handleEnviarProductosAColaboradores}
                disabled={!isConnected || onlineColaboradores === 0 || isEnviandoInventario}
                variant="outline"
                className="flex items-center space-x-2 bg-green-50 hover:bg-green-100 border-green-200 text-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                title={onlineColaboradores === 0 ? 'No hay colaboradores en línea' : 'Enviar inventario'}
              >
                <Send className="w-4 h-4" />
                <span>{isEnviandoInventario ? 'Enviando...' : 'Enviar a Colabs'}</span>
              </Button>
              {user?.rol === 'administrador' && (
                <Button
                  onClick={() => setShowImportModal(true)}
                  variant="outline"
                  className="flex items-center space-x-2 bg-yellow-50 hover:bg-yellow-100 border-yellow-200 text-yellow-700"
                >
                  <Upload className="w-4 h-4" />
                  <span>Importar</span>
                </Button>
              )}
            </>
          )}
          <Button
            onClick={handleCreateProduct}
            className="flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar</span>
          </Button>
        </div>
      </div>

      {/* Filtros y búsqueda */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 max-w-2xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Buscar productos... (Ctrl+F)"
                value={searchTerm}
                onChange={handleSearch}
                className="w-full pl-10 pr-4 py-3 text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 placeholder-gray-500 shadow-sm"
              />
            </div>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowCategoryMenu(!showCategoryMenu)}
              className="flex items-center space-x-2 px-4 py-3 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
            >
              <Menu className="w-5 h-5 text-gray-600" />
              <span className="font-medium text-gray-700">
                {selectedCategory || 'Categorías'}
              </span>
            </button>

            {showCategoryMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-100 p-2 z-50 max-h-96 overflow-y-auto">
                <button
                  onClick={() => {
                    handleCategoryFilter('')
                    setShowCategoryMenu(false)
                  }}
                  className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors mb-1 ${selectedCategory === ''
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-700 hover:bg-gray-50'
                    }`}
                >
                  Todas las categorías
                </button>
                {categorias.map((categoria) => (
                  <button
                    key={categoria}
                    onClick={() => {
                      handleCategoryFilter(categoria)
                      setShowCategoryMenu(false)
                    }}
                    className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors mb-1 ${selectedCategory === categoria
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-700 hover:bg-gray-50'
                      }`}
                  >
                    {categoria}
                  </button>
                ))}
              </div>
            )}
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
                {paginacion.totalRegistros || 0}
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
