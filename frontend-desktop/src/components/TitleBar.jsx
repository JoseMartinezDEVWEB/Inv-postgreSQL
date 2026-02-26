import React from 'react'
import { Minus, Square, X } from 'lucide-react'
import logoApp from '../img/logo_transparent.png'

const TitleBar = () => {
  const handleMinimize = () => {
    if (window.electron?.minimize) {
      window.electron.minimize()
    }
  }

  const handleMaximize = () => {
    if (window.electron?.maximize) {
      window.electron.maximize()
    }
  }

  const handleClose = () => {
    if (window.electron?.close) {
      window.electron.close()
    }
  }

  // Solo mostrar en Electron
  const isElectron = window.electron !== undefined

  if (!isElectron) return null

  return (
    <div 
      className="flex items-center justify-between h-12 bg-gray-100 border-b border-gray-300 select-none"
      style={{ WebkitAppRegion: 'drag' }}
    >
      {/* Logo y Título */}
      <div className="flex items-center gap-3 px-4">
        <img
          src={logoApp}
          alt="Logo J4 Pro"
          className="w-7 h-7 object-contain"
          draggable={false}
        />
        <span className="text-sm font-semibold text-gray-800">
          Gestor de Inventario J4 Pro - Desktop
        </span>
      </div>

      {/* Botones de control */}
      <div className="flex items-center h-full" style={{ WebkitAppRegion: 'no-drag' }}>
        <button
          onClick={handleMinimize}
          className="h-full px-4 hover:bg-gray-200 transition-colors flex items-center justify-center"
          title="Minimizar"
        >
          <Minus className="w-4 h-4 text-gray-700" />
        </button>
        <button
          onClick={handleMaximize}
          className="h-full px-4 hover:bg-gray-200 transition-colors flex items-center justify-center"
          title="Maximizar"
        >
          <Square className="w-3.5 h-3.5 text-gray-700" />
        </button>
        <button
          onClick={handleClose}
          className="h-full px-4 hover:bg-red-500 hover:text-white transition-colors flex items-center justify-center"
          title="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}

export default TitleBar
