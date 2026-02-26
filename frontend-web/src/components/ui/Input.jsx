import React, { forwardRef } from 'react'
import { motion } from 'framer-motion'
import { Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react'

const Input = forwardRef(({
  label,
  error,
  success,
  helperText,
  leftIcon,
  rightIcon,
  type = 'text',
  size = 'md',
  variant = 'default',
  disabled = false,
  required = false,
  className = '',
  containerClassName = '',
  ...props
}, ref) => {
  const [showPassword, setShowPassword] = React.useState(false)
  const [isFocused, setIsFocused] = React.useState(false)

  // Tamaños
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-4 py-3 text-base',
  }

  // Variantes
  const variants = {
    default: 'border-gray-300 focus:border-primary-500 focus:ring-primary-500',
    error: 'border-danger-500 focus:border-danger-500 focus:ring-danger-500',
    success: 'border-success-500 focus:border-success-500 focus:ring-success-500',
  }

  // Determinar variante actual
  const currentVariant = error ? 'error' : success ? 'success' : variant

  // Clases base
  const baseClasses = `
    block w-full rounded-lg border
    transition-all duration-200 ease-in-out
    focus:outline-none focus:ring-2 focus:ring-offset-0
    disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
    placeholder-gray-400
  `

  // Clases del input
  const inputClasses = `
    ${baseClasses}
    ${sizes[size]}
    ${variants[currentVariant]}
    ${leftIcon ? 'pl-10' : ''}
    ${rightIcon || type === 'password' ? 'pr-10' : ''}
    ${className}
  `.trim()

  // Renderizar icono de estado
  const renderStatusIcon = () => {
    if (error) {
      return <AlertCircle className="w-5 h-5 text-danger-500" />
    }
    if (success) {
      return <CheckCircle className="w-5 h-5 text-success-500" />
    }
    return null
  }

  // Renderizar icono de contraseña
  const renderPasswordIcon = () => {
    if (type === 'password') {
      return (
        <button
          type="button"
          className="absolute inset-y-0 right-0 pr-3 flex items-center"
          onClick={() => setShowPassword(!showPassword)}
        >
          {showPassword ? (
            <EyeOff className="w-5 h-5 text-gray-400 hover:text-gray-600" />
          ) : (
            <Eye className="w-5 h-5 text-gray-400 hover:text-gray-600" />
          )}
        </button>
      )
    }
    return null
  }

  // Determinar tipo de input
  const inputType = type === 'password' ? (showPassword ? 'text' : 'password') : type

  return (
    <div className={`relative ${containerClassName}`}>
      {/* Label */}
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-danger-500 ml-1">*</span>}
        </label>
      )}

      {/* Container del input */}
      <div className="relative">
        {/* Icono izquierdo */}
        {leftIcon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <div className="w-5 h-5 text-gray-400">
              {leftIcon}
            </div>
          </div>
        )}

        {/* Input */}
        <motion.input
          ref={ref}
          type={inputType}
          className={inputClasses}
          disabled={disabled}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          whileFocus={{ scale: 1.01 }}
          transition={{ duration: 0.1 }}
          {...props}
        />

        {/* Icono derecho */}
        {rightIcon && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <div className="w-5 h-5 text-gray-400">
              {rightIcon}
            </div>
          </div>
        )}

        {/* Icono de contraseña */}
        {renderPasswordIcon()}

        {/* Icono de estado */}
        {(error || success) && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            {renderStatusIcon()}
          </div>
        )}
      </div>

      {/* Mensaje de error o helper text */}
      {(error || helperText) && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="mt-1"
        >
          {error ? (
            <p className="text-sm text-danger-600 flex items-center">
              <AlertCircle className="w-4 h-4 mr-1" />
              {error}
            </p>
          ) : (
            <p className="text-sm text-gray-500">{helperText}</p>
          )}
        </motion.div>
      )}
    </div>
  )
})

Input.displayName = 'Input'

export default Input



