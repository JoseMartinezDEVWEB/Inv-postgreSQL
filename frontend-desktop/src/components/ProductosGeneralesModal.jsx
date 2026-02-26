import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { productosApi, sesionesApi, handleApiError } from '../services/api'
import { Plus, Search, Package, DollarSign, Tag, Camera, QrCode } from 'lucide-react'
import Button from './ui/Button'
import Card from './ui/Card'
import LoadingSpinner from './ui/LoadingSpinner'
import Modal from './ui/Modal'
import BarcodeScanner from './BarcodeScanner'
import { toast } from 'react-hot-toast'

const ProductosGeneralesModal = ({ isOpen, onClose, sesionId, clienteId }) => {
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProducts, setSelectedProducts] = useState([])
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false)
  const [barcodeSearch, setBarcodeSearch] = useState('')

  // Obtener productos generales
  const { data: productosData, isLoading } = useQuery(
    ['productos-generales-disponibles', clienteId, searchTerm],
    () => productosApi.getAllGenerales({
      buscar: searchTerm,
      limite: 50
    }),
    {
      enabled: isOpen && Boolean(clienteId),
      onError: handleApiError
    }
  )

  // Mutación para buscar producto por código de barras
  const buscarPorCodigoMutation = useMutation(
    (codigo) => productosApi.buscarPorCodigoBarras(codigo),
    {
      onSuccess: (response) => {
        if (response.data.exito) {
          const producto = response.data.datos.producto

          // Agregar automáticamente el producto encontrado a la selección
          if (!selectedProducts.find(p => p._id === producto._id)) {
            setSelectedProducts(prev => [...prev, producto._id])
            toast.success(`Producto encontrado: ${producto.nombre}`)
          } else {
            toast.info('Producto ya seleccionado')
          }
        }
      },
      onError: (error) => {
        toast.error('Producto no encontrado con ese código de barras')
      }
    }
  )

  // Mutación para asignar productos generales al cliente y agregarlos a la sesión
  const asignarMutation = useMutation(
    ({ productosIds }) => productosApi.asignarGenerales(clienteId, productosIds),
    {
      onSuccess: (response) => {
        if (response.data.exito) {
          const productosCreados = response.data.datos.productosCreados || []

          // Los productos ya fueron asignados al cliente
          // Ahora necesitamos agregarlos a la sesión específica
          const promesasAgregar = productosCreados.map(producto =>
            sesionesApi.addProduct(sesionId, {
              producto: producto._id,
              cantidadContada: 0,
              notas: `Agregado desde productos generales: ${producto.nombre}`
            })
          )

          return Promise.all(promesasAgregar)
        }
      },
      onSuccess: (response, variables) => {
        const productosCreados = response.data.datos.productosCreados || []
        queryClient.invalidateQueries(['sesion-inventario', sesionId])
        queryClient.invalidateQueries(['productos-generales-disponibles', clienteId])

        toast.success(`${productosCreados.length} productos agregados a la sesión exitosamente`)
        onClose()
        setSelectedProducts([])
        setSearchTerm('')
      },
      onError: handleApiError
    }
  )

  const productos = productosData?.datos || []

  const handleProductToggle = (productoId) => {
    setSelectedProducts(prev =>
      prev.includes(productoId)
        ? prev.filter(id => id !== productoId)
        : [...prev, productoId]
    )
  }

  const handleAgregarProductos = () => {
    if (selectedProducts.length === 0) {
      toast.error('Selecciona al menos un producto')
      return
    }

    asignarMutation.mutate({ productosIds: selectedProducts })
  }

  const handleSearch = (e) => {
    setSearchTerm(e.target.value)
  }

  // Función para manejar búsqueda por código de barras
  const handleBarcodeSearch = (e) => {
    e.preventDefault()
    if (barcodeSearch.trim()) {
      buscarPorCodigoMutation.mutate(barcodeSearch.trim())
    }
  }

  // Función para manejar producto encontrado por escáner
  const handleProductFound = (producto) => {
    if (!selectedProducts.find(p => p._id === producto._id)) {
      setSelectedProducts(prev => [...prev, producto._id])
    }
  }

  if (!isOpen) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Agregar Productos Generales"
      size="lg"
    >
      <div className="space-y-4">
        {/* Barra de búsqueda con código de barras */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar productos generales..."
                value={searchTerm}
                onChange={handleSearch}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 placeholder-gray-500"
              />
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowBarcodeScanner(true)}
            icon={<Camera className="w-4 h-4" />}
            className="flex items-center space-x-2"
          >
            <QrCode className="w-4 h-4" />
            <span className="hidden sm:inline">Escanear</span>
          </Button>
        </div>

        {/* Búsqueda por código de barras manual */}
        <form onSubmit={handleBarcodeSearch} className="flex gap-2">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Ingrese código de barras..."
              value={barcodeSearch}
              onChange={(e) => setBarcodeSearch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 placeholder-gray-500"
            />
          </div>
          <Button
            type="submit"
            variant="outline"
            disabled={!barcodeSearch.trim() || buscarPorCodigoMutation.isLoading}
            loading={buscarPorCodigoMutation.isLoading}
          >
            Buscar
          </Button>
        </form>

        {/* Lista de productos */}
        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="lg" />
            </div>
          ) : productos.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No se encontraron productos generales
            </div>
          ) : (
            <div className="space-y-2">
              {productos.map((producto) => (
                <Card
                  key={producto._id}
                  className={`p-4 cursor-pointer transition-colors ${
                    selectedProducts.includes(producto._id)
                      ? 'ring-2 ring-primary-500 bg-primary-50'
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => handleProductToggle(producto._id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                        <Package className="w-5 h-5 text-primary-600" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{producto.nombre}</div>
                        <div className="text-sm text-gray-500">
                          {producto.categoria} • {producto.unidad}
                        </div>
                        {producto.descripcion && (
                          <div className="text-sm text-gray-400 mt-1">
                            {producto.descripcion}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="flex items-center text-sm text-gray-600">
                          <DollarSign className="w-4 h-4 mr-1" />
                          ${producto.costoBase?.toLocaleString() || 0}
                        </div>
                        <div className="text-xs text-gray-500">
                          {producto.estadisticas?.totalClientes || 0} clientes
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={selectedProducts.includes(producto._id)}
                        onChange={() => handleProductToggle(producto._id)}
                        className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                      />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-gray-600">
            {selectedProducts.length} productos seleccionados
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={asignarMutation.isLoading}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleAgregarProductos}
              loading={asignarMutation.isLoading}
              disabled={selectedProducts.length === 0}
              icon={<Plus className="w-4 h-4" />}
            >
              Agregar a Sesión
            </Button>
          </div>
        </div>
      </div>

      {/* Modal del escáner de código de barras */}
      <BarcodeScanner
        isOpen={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onProductFound={handleProductFound}
        clienteId={clienteId}
        sesionId={sesionId}
      />
    </Modal>
  )
}

export default ProductosGeneralesModal
