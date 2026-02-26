import React, { useState, useEffect, useRef } from 'react'
import { useQuery } from 'react-query'
import { productosApi, handleApiResponse } from '../services/api'
import Button from './ui/Button'
import { Package, DollarSign, Tag, User, Hash, Scan } from 'lucide-react'

const ProductoForm = ({ producto, onSubmit, onCancel, isLoading = false }) => {
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    categoria: 'General',
    unidad: 'unidad',
    costoBase: 0,
    proveedor: '',
    codigoBarras: '',
    notas: '',
    // Nuevos campos
    tipoContenedor: 'ninguno',
    tieneUnidadesInternas: false,
    unidadesInternas: {
      cantidad: 0,
      codigoBarras: '',
      nombre: '',
      costoPorUnidad: 0
    },
    tipoPeso: 'ninguno'
  })

  const [errors, setErrors] = useState({})
  const [isScanning, setIsScanning] = useState(false)
  const [scanningField, setScanningField] = useState(null) // 'contenedor' o 'unidad'
  const codigoBarrasRef = useRef(null)
  const codigoBarrasUnidadRef = useRef(null)

  // Unidades disponibles
  const unidades = [
    'unidad', 'kg', 'lb', 'gr', 'litro', 'ml', 'metro', 'cm', 
    'caja', 'paquete', 'cajon', 'saco', 'fardo', 'docena', 'par', 'otro'
  ]

  // Categorías fijas del sistema
  const categorias = [
    'General',
    'Alimentos General',
    'Enlatados',
    'Mercado',
    'Embutidos',
    'Carnes',
    'Bebidas',
    'Desechables',
    'Electricidad',
    'Dulce'
  ]

  // Tipos de contenedor
  const tiposContenedor = [
    { value: 'ninguno', label: 'Ninguno' },
    { value: 'caja', label: 'Caja' },
    { value: 'paquete', label: 'Paquete' },
    { value: 'saco', label: 'Saco' },
    { value: 'fardo', label: 'Fardo' },
    { value: 'cajon', label: 'Cajón' }
  ]

  // Tipos de peso (para sacos)
  const tiposPeso = [
    { value: 'ninguno', label: 'Ninguno' },
    { value: 'lb', label: 'Libras (lb)' },
    { value: 'kg', label: 'Kilogramos (kg)' },
    { value: 'gr', label: 'Gramos (gr)' }
  ]

  useEffect(() => {
    if (producto) {
      setFormData({
        nombre: producto.nombre || '',
        descripcion: producto.descripcion || '',
        categoria: producto.categoria || 'General',
        unidad: producto.unidad || 'unidad',
        costoBase: producto.costoBase || 0,
        proveedor: producto.proveedor || '',
        codigoBarras: producto.codigoBarras || '',
        notas: producto.notas || '',
        tipoContenedor: producto.tipoContenedor || 'ninguno',
        tieneUnidadesInternas: producto.tieneUnidadesInternas || false,
        unidadesInternas: producto.unidadesInternas || {
          cantidad: 0,
          codigoBarras: '',
          nombre: '',
          costoPorUnidad: 0
        },
        tipoPeso: producto.tipoPeso || 'ninguno'
      })
    }
  }, [producto])

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
    
    // Limpiar error del campo cuando el usuario empiece a escribir
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  // Manejador para unidades internas (nested object)
  const handleUnidadesInternasChange = (field, value) => {
    setFormData(prev => {
      const newUnidadesInternas = {
        ...prev.unidadesInternas,
        [field]: value
      }

      // Calcular costo por unidad automáticamente cuando cambia cantidad o costo base
      if (field === 'cantidad' && value > 0 && prev.costoBase > 0) {
        newUnidadesInternas.costoPorUnidad = prev.costoBase / value
      }

      return {
        ...prev,
        unidadesInternas: newUnidadesInternas
      }
    })
  }

  // Recalcular costo por unidad cuando cambia el costo base
  const handleCostoBaseChange = (e) => {
    const newCosto = parseFloat(e.target.value) || 0
    setFormData(prev => {
      const newData = {
        ...prev,
        costoBase: newCosto
      }

      // Recalcular costoPorUnidad si tiene unidades internas
      if (prev.tieneUnidadesInternas && prev.unidadesInternas.cantidad > 0) {
        newData.unidadesInternas = {
          ...prev.unidadesInternas,
          costoPorUnidad: newCosto / prev.unidadesInternas.cantidad
        }
      }

      return newData
    })
  }

  // Manejador para checkbox de unidades internas
  const handleTieneUnidadesInternasChange = (e) => {
    const checked = e.target.checked
    setFormData(prev => ({
      ...prev,
      tieneUnidadesInternas: checked,
      // Resetear unidades internas si se desmarca
      unidadesInternas: checked ? prev.unidadesInternas : {
        cantidad: 0,
        codigoBarras: '',
        nombre: '',
        costoPorUnidad: 0
      }
    }))
  }

  // Manejador para activar modo escaneo (web - escáner físico)
  const handleActivarEscaneo = (field) => {
    setScanningField(field)
    setIsScanning(true)
    
    // Enfocar el input correspondiente
    setTimeout(() => {
      if (field === 'contenedor') {
        codigoBarrasRef.current?.focus()
      } else {
        codigoBarrasUnidadRef.current?.focus()
      }
    }, 100)
  }

  // Manejador para cuando el escáner ingresa el código
  const handleCodigoBarrasKeyPress = (e, field) => {
    // Enter significa que el escáner terminó de ingresar el código
    if (e.key === 'Enter' && isScanning && scanningField === field) {
      e.preventDefault()
      setIsScanning(false)
      setScanningField(null)
      // El código ya está en el campo gracias al escáner
    }
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.nombre.trim()) {
      newErrors.nombre = 'El nombre del producto es requerido'
    }

    if (!formData.categoria.trim()) {
      newErrors.categoria = 'La categoría es requerida'
    }

    if (!formData.unidad) {
      newErrors.unidad = 'La unidad de medida es requerida'
    }

    if (formData.costoBase < 0) {
      newErrors.costoBase = 'El costo no puede ser negativo'
    }

    if (formData.codigoBarras && formData.codigoBarras.length > 50) {
      newErrors.codigoBarras = 'El código de barras no puede exceder 50 caracteres'
    }

    // Validaciones para unidades internas
    if (formData.tieneUnidadesInternas) {
      if (!formData.unidadesInternas.cantidad || formData.unidadesInternas.cantidad <= 0) {
        newErrors.unidadesCantidad = 'La cantidad de unidades internas es requerida'
      }
      if (!formData.unidadesInternas.codigoBarras.trim()) {
        newErrors.unidadesCodigoBarras = 'El código de barras de la unidad interna es obligatorio'
      }
    }

    // Validación para sacos
    if (formData.tipoContenedor === 'saco' && formData.tipoPeso === 'ninguno') {
      newErrors.tipoPeso = 'Debe seleccionar el tipo de peso para los sacos'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    
    if (validateForm()) {
      onSubmit(formData)
    }
  }

  const handleCategoriaChange = (e) => {
    const { value } = e.target
    setFormData(prev => ({
      ...prev,
      categoria: value
    }))
    
    if (errors.categoria) {
      setErrors(prev => ({
        ...prev,
        categoria: ''
      }))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Nombre del producto */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Package className="w-4 h-4 inline mr-1" />
            Nombre del Producto *
          </label>
          <input
            type="text"
            name="nombre"
            value={formData.nombre}
            onChange={handleInputChange}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 placeholder-gray-500 ${
              errors.nombre ? 'border-red-300' : 'border-gray-300'
            }`}
            placeholder="Ej: Arroz Blanco"
            maxLength={500}
          />
          {errors.nombre && (
            <p className="mt-1 text-sm text-red-600">{errors.nombre}</p>
          )}
        </div>

        {/* Descripción */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Descripción
          </label>
          <textarea
            name="descripcion"
            value={formData.descripcion}
            onChange={handleInputChange}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 placeholder-gray-500"
            placeholder="Descripción detallada del producto"
            maxLength={500}
          />
          <p className="mt-1 text-xs text-gray-500">
            {formData.descripcion.length}/500 caracteres
          </p>
        </div>

        {/* Categoría */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Tag className="w-4 h-4 inline mr-1" />
            Categoría *
          </label>
          <select
            name="categoria"
            value={formData.categoria}
            onChange={handleInputChange}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
              errors.categoria ? 'border-red-300' : 'border-gray-300'
            }`}
          >
            {categorias.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          {errors.categoria && (
            <p className="mt-1 text-sm text-red-600">{errors.categoria}</p>
          )}
        </div>

        {/* Unidad */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Unidad de Medida *
          </label>
          <select
            name="unidad"
            value={formData.unidad}
            onChange={handleInputChange}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
              errors.unidad ? 'border-red-300' : 'border-gray-300'
            }`}
          >
            {unidades.map((unidad) => (
              <option key={unidad} value={unidad}>
                {unidad.charAt(0).toUpperCase() + unidad.slice(1)}
              </option>
            ))}
          </select>
          {errors.unidad && (
            <p className="mt-1 text-sm text-red-600">{errors.unidad}</p>
          )}
        </div>

        {/* Costo Base */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <DollarSign className="w-4 h-4 inline mr-1" />
            Costo Base *
          </label>
          <input
            type="number"
            name="costoBase"
            value={formData.costoBase}
            onChange={handleCostoBaseChange}
            min="0"
            step="0.01"
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 placeholder-gray-500 ${
              errors.costoBase ? 'border-red-300' : 'border-gray-300'
            }`}
            placeholder="0.00"
          />
          {errors.costoBase && (
            <p className="mt-1 text-sm text-red-600">{errors.costoBase}</p>
          )}
        </div>

        {/* Proveedor */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <User className="w-4 h-4 inline mr-1" />
            Proveedor
          </label>
          <input
            type="text"
            name="proveedor"
            value={formData.proveedor}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 placeholder-gray-500"
            placeholder="Nombre del proveedor"
            maxLength={200}
          />
        </div>

        {/* Código de Barras */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Hash className="w-4 h-4 inline mr-1" />
            Código de Barras
          </label>
          <div className="flex gap-2">
            <input
              ref={codigoBarrasRef}
              type="text"
              name="codigoBarras"
              value={formData.codigoBarras}
              onChange={handleInputChange}
              onKeyPress={(e) => handleCodigoBarrasKeyPress(e, 'contenedor')}
              className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 placeholder-gray-500 ${
                errors.codigoBarras ? 'border-red-300' : 'border-gray-300'
              } ${isScanning && scanningField === 'contenedor' ? 'ring-2 ring-blue-500' : ''}`}
              placeholder="1234567890123"
              maxLength={50}
            />
            <button
              type="button"
              onClick={() => handleActivarEscaneo('contenedor')}
              className={`px-4 py-2 border rounded-lg flex items-center gap-2 transition-colors ${
                isScanning && scanningField === 'contenedor'
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
              title="Activar escáner de código de barras"
            >
              <Scan className="w-4 h-4" />
              {isScanning && scanningField === 'contenedor' ? 'Escaneando...' : 'Escanear'}
            </button>
          </div>
          {errors.codigoBarras && (
            <p className="mt-1 text-sm text-red-600">{errors.codigoBarras}</p>
          )}
          {isScanning && scanningField === 'contenedor' && (
            <p className="mt-1 text-xs text-blue-600">
              Use el escáner físico para leer el código de barras. Presione Enter o escanee el código.
            </p>
          )}
        </div>

        {/* ==== SECCIÓN: TIPO DE CONTENEDOR ==== */}
        <div className="md:col-span-2 mt-4">
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
            <h3 className="text-sm font-semibold text-blue-800 mb-3">Tipo de Contenedor</h3>
            
            {/* Tipo de Contenedor */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Contenedor *
                </label>
                <select
                  name="tipoContenedor"
                  value={formData.tipoContenedor}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  {tiposContenedor.map((tipo) => (
                    <option key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tipo de Peso - Solo para sacos */}
              {formData.tipoContenedor === 'saco' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de Peso *
                  </label>
                  <select
                    name="tipoPeso"
                    value={formData.tipoPeso}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                      errors.tipoPeso ? 'border-red-300' : 'border-gray-300'
                    }`}
                  >
                    {tiposPeso.map((tipo) => (
                      <option key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </option>
                    ))}
                  </select>
                  {errors.tipoPeso && (
                    <p className="mt-1 text-sm text-red-600">{errors.tipoPeso}</p>
                  )}
                </div>
              )}
            </div>

            {/* Checkbox: ¿Tiene unidades internas? */}
            <div className="mt-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.tieneUnidadesInternas}
                  onChange={handleTieneUnidadesInternasChange}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  ¿Tiene unidades internas?
                </span>
              </label>
              <p className="mt-1 text-xs text-gray-500 ml-6">
                Marque esta opción si este contenedor incluye unidades individuales (ej: Caja con 12 botellas)
              </p>
            </div>

            {/* Campos de Unidades Internas - Solo si está marcado */}
            {formData.tieneUnidadesInternas && (
              <div className="mt-4 pl-6 border-l-2 border-gray-300">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Información de Unidades Internas</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Cantidad de unidades */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cantidad de Unidades *
                    </label>
                    <input
                      type="number"
                      value={formData.unidadesInternas.cantidad}
                      onChange={(e) => handleUnidadesInternasChange('cantidad', parseInt(e.target.value) || 0)}
                      min="1"
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 placeholder-gray-500 ${
                        errors.unidadesCantidad ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="12"
                    />
                    {errors.unidadesCantidad && (
                      <p className="mt-1 text-sm text-red-600">{errors.unidadesCantidad}</p>
                    )}
                  </div>

                  {/* Código de barras de unidad */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Código de Barras (Unidad) *
                    </label>
                    <div className="flex gap-2">
                      <input
                        ref={codigoBarrasUnidadRef}
                        type="text"
                        value={formData.unidadesInternas.codigoBarras}
                        onChange={(e) => handleUnidadesInternasChange('codigoBarras', e.target.value)}
                        onKeyPress={(e) => handleCodigoBarrasKeyPress(e, 'unidad')}
                        className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 placeholder-gray-500 ${
                          errors.unidadesCodigoBarras ? 'border-red-300' : 'border-gray-300'
                        } ${isScanning && scanningField === 'unidad' ? 'ring-2 ring-blue-500' : ''}`}
                        placeholder="7501234567890"
                        maxLength={50}
                      />
                      <button
                        type="button"
                        onClick={() => handleActivarEscaneo('unidad')}
                        className={`px-3 py-2 border rounded-lg flex items-center gap-1 transition-colors text-sm ${
                          isScanning && scanningField === 'unidad'
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                        title="Activar escáner de código de barras"
                      >
                        <Scan className="w-4 h-4" />
                      </button>
                    </div>
                    {errors.unidadesCodigoBarras && (
                      <p className="mt-1 text-sm text-red-600">{errors.unidadesCodigoBarras}</p>
                    )}
                    {isScanning && scanningField === 'unidad' && (
                      <p className="mt-1 text-xs text-blue-600">
                        Use el escáner físico para leer el código de barras. Presione Enter o escanee el código.
                      </p>
                    )}
                  </div>

                  {/* Nombre de unidad (opcional) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nombre de Unidad (Opcional)
                    </label>
                    <input
                      type="text"
                      value={formData.unidadesInternas.nombre}
                      onChange={(e) => handleUnidadesInternasChange('nombre', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 placeholder-gray-500"
                      placeholder="Ej: Botella Coca-Cola 12oz"
                      maxLength={200}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Si no se especifica, se generará automáticamente
                    </p>
                  </div>

                  {/* Costo por unidad (calculado automáticamente) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Costo por Unidad (Calculado)
                    </label>
                    <input
                      type="text"
                      value={`$${formData.unidadesInternas.costoPorUnidad.toFixed(2)}`}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700 cursor-not-allowed"
                      placeholder="$0.00"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Se calcula automáticamente: Costo Base ÷ Cantidad
                    </p>
                  </div>
                </div>

                <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded p-3">
                  <p className="text-xs text-yellow-800">
                    <strong>Nota:</strong> Al crear este producto, se generará automáticamente un producto secundario 
                    con el código de barras de la unidad interna y el costo por unidad calculado.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Notas */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notas Adicionales
          </label>
          <textarea
            name="notas"
            value={formData.notas}
            onChange={handleInputChange}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 placeholder-gray-500"
            placeholder="Información adicional sobre el producto"
            maxLength={1000}
          />
          <p className="mt-1 text-xs text-gray-500">
            {formData.notas.length}/1000 caracteres
          </p>
        </div>
      </div>

      {/* Botones */}
      <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={isLoading}
          className="flex items-center space-x-2"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Guardando...</span>
            </>
          ) : (
            <>
              <Package className="w-4 h-4" />
              <span>{producto ? 'Actualizar' : 'Crear'} Producto</span>
            </>
          )}
        </Button>
      </div>
    </form>
  )
}

export default ProductoForm

