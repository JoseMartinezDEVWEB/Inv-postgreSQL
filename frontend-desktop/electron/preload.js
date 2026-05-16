const { contextBridge, ipcRenderer } = require('electron')

// Exponer APIs seguras al renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Información de la aplicación
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // Diálogos del sistema
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  
  // Eventos del menú
  onMenuNewSession: (callback) => ipcRenderer.on('menu-new-session', callback),
  onMenuNewClient: (callback) => ipcRenderer.on('menu-new-client', callback),
  onMenuSettings: (callback) => ipcRenderer.on('menu-settings', callback),
  onMenuNavigate: (callback) => ipcRenderer.on('menu-navigate', callback),
  
  // Limpiar listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  
  // Notificaciones de actualización de la app
  onAppUpdate: (callback) => ipcRenderer.on('app-update-available', (_, info) => callback(info)),

  // Backup de base de datos
  backup: {
    crear   : (etiqueta) => ipcRenderer.invoke('backup-crear', etiqueta),
    listar  : ()         => ipcRenderer.invoke('backup-listar'),
    exportar: (filename) => ipcRenderer.invoke('backup-exportar', filename),
    importar: ()         => ipcRenderer.invoke('backup-importar'),
    eliminar: (filename) => ipcRenderer.invoke('backup-eliminar', filename),
  },

  // Información del sistema
  platform: process.platform,
  isElectron: true
})

// Exponer controles de ventana
contextBridge.exposeInMainWorld('electron', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  getBackendUrl: () => ipcRenderer.invoke('get-backend-url'),
  isBackendReady: () => ipcRenderer.invoke('is-backend-ready'),
  isElectron: true
})

// Exponer información básica del sistema
contextBridge.exposeInMainWorld('systemInfo', {
  platform: process.platform,
  arch: process.arch,
  version: process.version,
  isElectron: true
})



