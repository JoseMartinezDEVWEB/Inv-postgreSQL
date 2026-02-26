import { app, BrowserWindow, Menu, ipcMain, dialog, shell } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import backendServer from './backend-server.js'

process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
// Detectar si estamos en desarrollo basándonos en si existe node_modules
const isDev = !app.isPackaged

// Mantener una referencia global del objeto window
let mainWindow
let backendReady = false

function createWindow() {
  // Crear la ventana del navegador
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: isDev
      ? path.join(__dirname, '../build/icon.png')
      : path.join(__dirname, '../build/icon.ico'),
    show: false,
    title: 'Gestor de Inventario J4 Pro - Desktop',
    frame: false,
    backgroundColor: '#f3f4f6'
  })

  // Cargar la aplicación
  if (isDev) {
    // En dev, Vite corre en 5173 (ver `vite.config.js` / scripts).
    // Permitimos override por env para casos especiales.
    const devUrl = process.env.ELECTRON_START_URL || 'http://localhost:5173'
    mainWindow.loadURL(devUrl)
    // No abrir DevTools automáticamente a menos que sea necesario para debugging
    // mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // Mostrar la ventana cuando esté lista y maximizarla
  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize()
    mainWindow.show()
  })

  // Atajos de teclado para abrir/cerrar DevTools (Ctrl+Shift+I o F12) solo en desarrollo
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (isDev) {
      if (input.control && input.shift && input.key.toLowerCase() === 'i') {
        if (mainWindow.webContents.isDevToolsOpened()) {
          mainWindow.webContents.closeDevTools()
        } else {
          mainWindow.webContents.openDevTools()
        }
      }
      if (input.key === 'F12') {
        if (mainWindow.webContents.isDevToolsOpened()) {
          mainWindow.webContents.closeDevTools()
        } else {
          mainWindow.webContents.openDevTools()
        }
      }
    }
  })

  // Manejar el cierre de la ventana
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Manejar enlaces externos
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Ocultar menú (se puede mostrar con Alt)
  Menu.setApplicationMenu(null)
}

// Eventos de la aplicación
app.whenReady().then(async () => {
  try {
    console.log('🚀 Iniciando backend embebido...')
    await backendServer.start()
    backendReady = true
    console.log(`✅ Backend listo en: ${backendServer.getApiUrl()}`)
  } catch (error) {
    console.error('❌ Error al iniciar backend:', error)
    dialog.showErrorBox(
      'Error al iniciar',
      'No se pudo iniciar el servidor local. La aplicación se cerrará.'
    )
    app.quit()
    return
  }
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    backendServer.stop()
    app.quit()
  }
})

app.on('before-quit', () => {
  console.log('🛑 Cerrando aplicación...')
  backendServer.stop()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// Manejar comandos IPC
ipcMain.handle('get-app-version', () => {
  return app.getVersion()
})

ipcMain.handle('show-save-dialog', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, options)
  return result
})

ipcMain.handle('show-open-dialog', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options)
  return result
})

// Controles de ventana
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize()
})

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  }
})

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close()
})

// Obtener URL del backend
ipcMain.handle('get-backend-url', () => {
  return backendServer.getApiUrl()
})

ipcMain.handle('is-backend-ready', () => {
  return backendReady
})
