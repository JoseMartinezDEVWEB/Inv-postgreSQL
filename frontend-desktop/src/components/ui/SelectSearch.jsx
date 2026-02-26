import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Search, Check } from 'lucide-react'

const SelectSearch = ({
  options = [],
  value = '',
  onChange,
  placeholder = 'Selecciona una opción',
  searchPlaceholder = 'Buscar...',
  loading = false,
  disabled = false,
  className = '',
  required = false,
  ...props
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedOption, setSelectedOption] = useState(null)
  const dropdownRef = useRef(null)
  const inputRef = useRef(null)

  // Filtrar opciones basado en el término de búsqueda
  const filteredOptions = options.filter(option =>
    option.label?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    option.value?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Debug: mostrar opciones en desarrollo
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 SelectSearch - Opciones recibidas:', options)
      console.log('🔍 SelectSearch - Opciones filtradas:', filteredOptions)
      console.log('🔍 SelectSearch - Valor actual:', value)
      console.log('🔍 SelectSearch - Opción seleccionada:', selectedOption)
    }
  }, [options, filteredOptions, value, selectedOption])

  // Encontrar la opción seleccionada
  useEffect(() => {
    const option = options.find(opt => opt.value === value)
    setSelectedOption(option)
  }, [value, options])

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
        setSearchTerm('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Manejar selección
  const handleSelect = (option) => {
    onChange(option.value)
    setSelectedOption(option)
    setIsOpen(false)
    setSearchTerm('')
  }

  // Manejar teclado
  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      if (filteredOptions.length > 0) {
        handleSelect(filteredOptions[0])
      }
    } else if (event.key === 'Escape') {
      setIsOpen(false)
      setSearchTerm('')
    }
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Input principal */}
      <div
        className={`
          relative w-full px-3 py-2 border border-gray-300 rounded-md
          focus:ring-2 focus:ring-primary-500 focus:border-primary-500
          cursor-pointer transition-colors
          ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white hover:border-gray-400'}
          ${isOpen ? 'ring-2 ring-primary-500 border-primary-500' : ''}
        `}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <div className="flex items-center justify-between">
          <span className={`${selectedOption ? 'text-gray-900' : 'text-gray-500'}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronDown 
            className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          />
        </div>
      </div>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-hidden"
          >
            {/* Campo de búsqueda */}
            <div className="p-2 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  autoFocus
                />
              </div>
            </div>

            {/* Lista de opciones */}
            <div className="max-h-48 overflow-y-auto">
              {loading ? (
                <div className="p-3 text-center text-gray-500">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-500 border-t-transparent mx-auto"></div>
                  <span className="ml-2">Cargando...</span>
                </div>
              ) : filteredOptions.length > 0 ? (
                filteredOptions.map((option) => (
                  <div
                    key={option.value}
                    className={`
                      px-3 py-2 cursor-pointer transition-colors flex items-center justify-between
                      hover:bg-gray-100
                      ${value === option.value ? 'bg-primary-50 text-primary-700' : 'text-gray-900'}
                    `}
                    onClick={() => handleSelect(option)}
                  >
                    <span className="text-sm">{option.label}</span>
                    {value === option.value && (
                      <Check className="w-4 h-4 text-primary-600" />
                    )}
                  </div>
                ))
              ) : (
                <div className="p-3 text-center text-gray-500 text-sm">
                  {searchTerm ? 'No se encontraron resultados' : 'No hay opciones disponibles'}
                </div>
              )}
            </div>
            
            {/* Debug info en desarrollo */}
            {process.env.NODE_ENV === 'development' && (
              <div className="p-2 text-xs text-gray-400 border-t border-gray-200 bg-gray-50">
                <div>Opciones: {options.length}</div>
                <div>Filtradas: {filteredOptions.length}</div>
                <div>Búsqueda: "{searchTerm}"</div>
                <div>Valor: {value || 'N/A'}</div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input oculto para formularios */}
      {required && (
        <input
          type="hidden"
          value={value}
          required={required}
          {...props}
        />
      )}
    </div>
  )
}

export default SelectSearch
