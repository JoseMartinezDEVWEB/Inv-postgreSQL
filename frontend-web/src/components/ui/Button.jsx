import React from 'react'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'

const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon = null,
  iconPosition = 'left',
  onClick,
  type = 'button',
  className = '',
  ...props
}) => {
  // Variantes de estilo
  const variants = {
    primary: 'bg-primary-600 hover:bg-primary-700 text-white border-primary-600',
    secondary: 'bg-secondary-600 hover:bg-secondary-700 text-white border-secondary-600',
    success: 'bg-success-600 hover:bg-success-700 text-white border-success-600',
    warning: 'bg-warning-600 hover:bg-warning-700 text-white border-warning-600',
    danger: 'bg-danger-600 hover:bg-danger-700 text-white border-danger-600',
    outline: 'bg-transparent hover:bg-primary-50 text-primary-600 border-primary-600',
    ghost: 'bg-transparent hover:bg-gray-100 text-gray-700 border-transparent',
    link: 'bg-transparent hover:bg-transparent text-primary-600 border-transparent underline',
  }

  // Tamaños
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
    xl: 'px-8 py-4 text-lg',
  }

  // Clases base
  const baseClasses = `
    inline-flex items-center justify-center
    font-medium rounded-lg border
    transition-all duration-200 ease-in-out
    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500
    disabled:opacity-50 disabled:cursor-not-allowed
    hover-lift
  `

  // Clases condicionales
  const classes = `
    ${baseClasses}
    ${variants[variant]}
    ${sizes[size]}
    ${className}
  `.trim()

  // Renderizar icono
  const renderIcon = () => {
    if (loading) {
      return <Loader2 className="w-4 h-4 animate-spin" />
    }
    if (icon) {
      return icon
    }
    return null
  }

  // Renderizar contenido
  const renderContent = () => {
    const iconElement = renderIcon()
    
    if (!iconElement) {
      return children
    }

    if (iconPosition === 'left') {
      return (
        <>
          {iconElement}
          {children && <span className="ml-2">{children}</span>}
        </>
      )
    } else {
      return (
        <>
          {children && <span className="mr-2">{children}</span>}
          {iconElement}
        </>
      )
    }
  }

  return (
    <motion.button
      type={type}
      className={classes}
      disabled={disabled || loading}
      onClick={onClick}
      whileHover={{ scale: disabled || loading ? 1 : 1.02 }}
      whileTap={{ scale: disabled || loading ? 1 : 0.98 }}
      transition={{ duration: 0.1 }}
      {...props}
    >
      {renderContent()}
    </motion.button>
  )
}

// Variantes específicas para casos comunes
export const PrimaryButton = (props) => <Button variant="primary" {...props} />
export const SecondaryButton = (props) => <Button variant="secondary" {...props} />
export const SuccessButton = (props) => <Button variant="success" {...props} />
export const WarningButton = (props) => <Button variant="warning" {...props} />
export const DangerButton = (props) => <Button variant="danger" {...props} />
export const OutlineButton = (props) => <Button variant="outline" {...props} />
export const GhostButton = (props) => <Button variant="ghost" {...props} />
export const LinkButton = (props) => <Button variant="link" {...props} />

export default Button



