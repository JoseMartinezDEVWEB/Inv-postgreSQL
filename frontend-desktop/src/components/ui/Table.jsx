import React from 'react'
import { motion } from 'framer-motion'
import { ChevronUp, ChevronDown, MoreHorizontal } from 'lucide-react'

const Table = ({
  data = [],
  columns = [],
  loading = false,
  emptyMessage = 'No hay datos disponibles',
  onRowClick,
  className = '',
  ...props
}) => {
  const [sortConfig, setSortConfig] = React.useState({ key: null, direction: 'asc' })
  const [sortedData, setSortedData] = React.useState(data)

  // Ordenar datos
  React.useEffect(() => {
    if (!sortConfig.key) {
      setSortedData(data)
      return
    }

    const sorted = [...data].sort((a, b) => {
      const aValue = a[sortConfig.key]
      const bValue = b[sortConfig.key]

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1
      }
      return 0
    })

    setSortedData(sorted)
  }, [data, sortConfig])

  // Manejar ordenamiento
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  // Renderizar header de la tabla
  const renderHeader = () => (
    <thead className="bg-gray-50">
      <tr>
        {columns.map((column, index) => (
          <th
            key={index}
            className={`
              px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider
              ${column.sortable ? 'cursor-pointer hover:bg-gray-100' : ''}
              ${column.className || ''}
            `}
            onClick={() => column.sortable && handleSort(column.key)}
          >
            <div className="flex items-center space-x-1">
              <span>{column.title}</span>
              {column.sortable && (
                <div className="flex flex-col">
                  <ChevronUp 
                    className={`w-3 h-3 ${
                      sortConfig.key === column.key && sortConfig.direction === 'asc' 
                        ? 'text-primary-600' 
                        : 'text-gray-400'
                    }`} 
                  />
                  <ChevronDown 
                    className={`w-3 h-3 -mt-1 ${
                      sortConfig.key === column.key && sortConfig.direction === 'desc' 
                        ? 'text-primary-600' 
                        : 'text-gray-400'
                    }`} 
                  />
                </div>
              )}
            </div>
          </th>
        ))}
      </tr>
    </thead>
  )

  // Renderizar filas de la tabla
  const renderRows = () => (
    <tbody className="bg-white divide-y divide-gray-200">
      {sortedData.map((row, rowIndex) => (
        <motion.tr
          key={rowIndex}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: rowIndex * 0.05 }}
          className={`
            hover:bg-gray-50 transition-colors duration-150
            ${onRowClick ? 'cursor-pointer' : ''}
          `}
          onClick={() => onRowClick && onRowClick(row, rowIndex)}
        >
          {columns.map((column, colIndex) => (
            <td
              key={colIndex}
              className={`
                px-6 py-4 whitespace-nowrap text-sm text-gray-900
                ${column.className || ''}
              `}
            >
              {column.render ? column.render(row[column.key], row, rowIndex) : row[column.key]}
            </td>
          ))}
        </motion.tr>
      ))}
    </tbody>
  )

  // Renderizar estado de carga
  const renderLoading = () => (
    <tbody>
      <tr>
        <td colSpan={columns.length} className="px-6 py-12 text-center">
          <div className="flex flex-col items-center space-y-4">
            <div className="loading-spinner w-8 h-8"></div>
            <p className="text-gray-500">Cargando datos...</p>
          </div>
        </td>
      </tr>
    </tbody>
  )

  // Renderizar estado vacío
  const renderEmpty = () => (
    <tbody>
      <tr>
        <td colSpan={columns.length} className="px-6 py-12 text-center">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
              <MoreHorizontal className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-gray-500">{emptyMessage}</p>
          </div>
        </td>
      </tr>
    </tbody>
  )

  return (
    <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
      <table className={`min-w-full divide-y divide-gray-200 ${className}`} {...props}>
        {renderHeader()}
        {loading ? renderLoading() : sortedData.length === 0 ? renderEmpty() : renderRows()}
      </table>
    </div>
  )
}

// Componente para acciones de fila
export const TableActions = ({ children, className = '' }) => (
  <div className={`flex items-center space-x-2 ${className}`}>
    {children}
  </div>
)

// Componente para badge de estado
export const StatusBadge = ({ status, variant = 'default' }) => {
  const variants = {
    default: 'bg-gray-100 text-gray-800',
    success: 'bg-success-100 text-success-800',
    warning: 'bg-warning-100 text-warning-800',
    danger: 'bg-danger-100 text-danger-800',
    info: 'bg-primary-100 text-primary-800',
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]}`}>
      {status}
    </span>
  )
}

// Componente para avatar
export const Avatar = ({ src, alt, size = 'md', className = '' }) => {
  const sizes = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
    xl: 'w-12 h-12',
  }

  return (
    <div className={`${sizes[size]} rounded-full overflow-hidden ${className}`}>
      {src ? (
        <img src={src} alt={alt} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-gray-300 flex items-center justify-center">
          <span className="text-gray-600 text-sm font-medium">
            {alt?.charAt(0)?.toUpperCase() || '?'}
          </span>
        </div>
      )}
    </div>
  )
}

export default Table



