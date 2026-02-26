// Servicio para interactuar con Electron
class ElectronService {
  constructor() {
    this.isElectron = typeof window !== 'undefined' && window.electronAPI
  }

  // Verificar si estamos en Electron
  isElectronApp() {
    return this.isElectron
  }

  // Obtener información de la aplicación
  async getAppVersion() {
    if (!this.isElectron) return null
    return await window.electronAPI.getAppVersion()
  }

  // Mostrar diálogo de guardar archivo
  async showSaveDialog(options = {}) {
    if (!this.isElectron) return null
    
    const defaultOptions = {
      title: 'Guardar archivo',
      defaultPath: 'reporte.pdf',
      filters: [
        { name: 'PDF', extensions: ['pdf'] },
        { name: 'Todos los archivos', extensions: ['*'] }
      ]
    }
    
    return await window.electronAPI.showSaveDialog({ ...defaultOptions, ...options })
  }

  // Mostrar diálogo de abrir archivo
  async showOpenDialog(options = {}) {
    if (!this.isElectron) return null
    
    const defaultOptions = {
      title: 'Abrir archivo',
      filters: [
        { name: 'Todos los archivos', extensions: ['*'] }
      ]
    }
    
    return await window.electronAPI.showOpenDialog({ ...defaultOptions, ...options })
  }

  // Guardar archivo usando el diálogo nativo
  async saveFile(data, filename, options = {}) {
    if (!this.isElectron) {
      // Fallback para web: descargar directamente
      const blob = new Blob([data])
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      return
    }

    const result = await this.showSaveDialog({
      defaultPath: filename,
      ...options
    })

    if (!result.canceled && result.filePath) {
      // En una aplicación real, aquí usarías fs para escribir el archivo
      // Por ahora, usamos el fallback de descarga
      const blob = new Blob([data])
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    }
  }

  // Configurar listeners de eventos del menú
  setupMenuListeners(navigate) {
    if (!this.isElectron) return

    // Nueva sesión
    window.electronAPI.onMenuNewSession(() => {
      navigate('/inventarios')
    })

    // Nuevo cliente
    window.electronAPI.onMenuNewClient(() => {
      navigate('/clientes')
    })

    // Configuración
    window.electronAPI.onMenuSettings(() => {
      navigate('/perfil')
    })

    // Navegación
    window.electronAPI.onMenuNavigate((event, path) => {
      navigate(path)
    })
  }

  // Limpiar listeners
  cleanupMenuListeners() {
    if (!this.isElectron) return

    window.electronAPI.removeAllListeners('menu-new-session')
    window.electronAPI.removeAllListeners('menu-new-client')
    window.electronAPI.removeAllListeners('menu-settings')
    window.electronAPI.removeAllListeners('menu-navigate')
  }

  // Obtener información del sistema
  getSystemInfo() {
    if (!this.isElectron) return null
    return window.systemInfo
  }

  // Verificar si es macOS
  isMacOS() {
    return this.isElectron && window.systemInfo?.platform === 'darwin'
  }

  // Verificar si es Windows
  isWindows() {
    return this.isElectron && window.systemInfo?.platform === 'win32'
  }

  // Verificar si es Linux
  isLinux() {
    return this.isElectron && window.systemInfo?.platform === 'linux'
  }
}

// Crear instancia singleton
const electronService = new ElectronService()

export default electronService



