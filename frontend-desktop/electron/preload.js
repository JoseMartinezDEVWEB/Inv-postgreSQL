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



