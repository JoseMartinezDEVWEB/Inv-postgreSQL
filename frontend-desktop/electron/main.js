import { app, BrowserWindow, Menu, ipcMain, dialog, shell } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import http from 'http'
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

  // Atajos de teclado para DevTools: F12 siempre, Ctrl+Shift+I solo en dev
  mainWindow.webContents.on('before-input-event', (event, input) => {
    const toggleDevTools = () => {
      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools()
      } else {
        mainWindow.webContents.openDevTools()
      }
    }
    if (input.key === 'F12') toggleDevTools()
    if (isDev && input.control && input.shift && input.key.toLowerCase() === 'i') toggleDevTools()
  })

  // Confirmación antes de cerrar
  attachCloseConfirmation(mainWindow)

  // Limpiar referencia cuando la ventana es destruida
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

// ── Control de cierre con confirmación ───────────────────────────────────────
let isClosingConfirmed = false

function attachCloseConfirmation(win) {
  win.on('close', async (e) => {
    // Si ya fue confirmado (el usuario dijo "Sí"), dejarlo cerrar
    if (isClosingConfirmed) return

    // Prevenir cierre inmediato
    e.preventDefault()

    const { response } = await dialog.showMessageBox(win, {
      type: 'question',
      buttons: ['Cancelar', 'Cerrar aplicación'],
      defaultId: 0,
      cancelId: 0,
      title: 'Cerrar TECH STOCK J4-PRO',
      message: '¿Deseas cerrar la aplicación?',
      detail: 'El servidor local se detendrá. Todos tus datos están guardados.',
    })

    if (response === 1) {
      // Usuario confirmó — cerrar limpiamente
      isClosingConfirmed = true
      backendServer.stop()
      win.destroy()   // destroy() cierra sin disparar 'close' de nuevo
    }
    // Si response === 0 (Cancelar), simplemente no hacemos nada → ventana sigue abierta
  })
}

// Eventos de la aplicación
app.whenReady().then(async () => {
  try {
    console.log('🚀 Iniciando backend embebido (con reintentos automáticos)...')
    // startWithRetry: 2 intentos con 4 s de espera entre ellos.
    // Si el backend ya fue levantado por el auto-inicio de Windows,
    // el primer intento lo detecta y no vuelve a arrancarlo.
    await backendServer.startWithRetry(2)
    backendReady = true
    console.log(`✅ Backend listo en: ${backendServer.getApiUrl()}`)

    // Registrar auto-inicio en Windows (Startup folder) para que la próxima
    // vez que encienda el PC el backend ya esté corriendo antes de abrir la app.
    backendServer.registerWindowsAutoStart().catch(() => {})
  } catch (error) {
    console.error('❌ Error al iniciar backend:', error)

    let title = 'Error al iniciar el servidor'
    let message = 'No se pudo iniciar el servidor local.\n\n'

    if (error.message.includes('PG_NOT_AVAILABLE')) {
      title = 'PostgreSQL no disponible'
      message +=
        'El servidor de la aplicación arrancó correctamente, pero no pudo conectarse a PostgreSQL.\n\n' +
        'Soluciones:\n' +
        '1. Abre el Administrador de servicios de Windows (services.msc)\n' +
        '2. Busca el servicio "postgresql-x64-XX" y asegúrate de que esté "En ejecución"\n' +
        '3. Si no está instalado, reinstala la aplicación y sigue el asistente de configuración\n\n' +
        `Detalle técnico: ${error.message}`
    } else if (error.message.includes('no responde')) {
      title = 'Puerto Ocupado'
      message +=
        'El puerto 4501 está siendo usado por otro proceso que no responde.\n\n' +
        'Soluciones:\n' +
        '1. Reinicia el equipo e intenta de nuevo.\n' +
        '2. Abre el Administrador de tareas y cierra cualquier proceso "node.exe".\n\n' +
        `Detalle técnico: ${error.message}`
    } else if (error.message.includes('Backend no respondió')) {
      title = 'Servidor lento al iniciar'
      message +=
        'El servidor tardó demasiado en arrancar.\n' +
        'Puede deberse a que el antivirus está analizando los archivos en primer uso.\n\n' +
        'Cierra esta ventana y vuelve a abrir la aplicación en unos segundos.\n\n' +
        `Detalle técnico: ${error.message}`
    } else {
      message += `Detalle técnico: ${error.message}`
    }

    dialog.showErrorBox(title, message)
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

// ── Helpers para llamar la API del backend desde main process ─────────────────
function fetchBackendJSON(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const apiUrl  = new URL(backendServer.getApiUrl())
    const options = {
      hostname: apiUrl.hostname,
      port    : apiUrl.port,
      path    : `/api${path}`,
      method,
      headers : { 'Content-Type': 'application/json' },
    }
    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', c => { data += c })
      res.on('end', () => {
        try { resolve(JSON.parse(data)) } catch { resolve({ ok: false, error: data }) }
      })
    })
    req.on('error', reject)
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

// ── IPC Backup ────────────────────────────────────────────────────────────────
ipcMain.handle('backup-crear', async (_, etiqueta) => {
  try {
    return await fetchBackendJSON('/backup/crear', 'POST', { etiqueta: etiqueta || '' })
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('backup-listar', async () => {
  try {
    return await fetchBackendJSON('/backup/listar')
  } catch (err) {
    return { ok: false, error: err.message, backups: [] }
  }
})

ipcMain.handle('backup-eliminar', async (_, filename) => {
  try {
    return await fetchBackendJSON(`/backup/${encodeURIComponent(filename)}`, 'DELETE')
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

// Exportar backup a ruta elegida por el usuario
ipcMain.handle('backup-exportar', async (_, filename) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title      : 'Exportar Respaldo',
      defaultPath: filename,
      filters    : [{ name: 'Base de Datos SQLite', extensions: ['db'] }],
    })
    if (result.canceled) return { ok: false, canceled: true }

    // Descargar el archivo del backend via HTTP
    const apiUrl = backendServer.getApiUrl()
    const parsed = new URL(apiUrl)
    await new Promise((resolve, reject) => {
      const options = {
        hostname: parsed.hostname,
        port    : parsed.port,
        path    : `/api/backup/descargar/${encodeURIComponent(filename)}`,
        method  : 'GET',
      }
      const req = http.request(options, (res) => {
        const chunks = []
        res.on('data', c => chunks.push(c))
        res.on('end', () => {
          fs.writeFileSync(result.filePath, Buffer.concat(chunks))
          resolve()
        })
      })
      req.on('error', reject)
      req.end()
    })
    return { ok: true, path: result.filePath }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

// Importar backup desde archivo externo (reemplaza la DB actual)
ipcMain.handle('backup-importar', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title      : 'Importar Respaldo — Selecciona el archivo .db',
      filters    : [{ name: 'Base de Datos SQLite', extensions: ['db'] }],
      properties : ['openFile'],
    })
    if (result.canceled || !result.filePaths.length) return { ok: false, canceled: true }

    // Encontrar la ruta de la DB actual dentro del app instalado
    const backendPath = backendServer.getBackendPath()
    const dbPath      = path.join(backendPath, 'database', 'inventario.db')

    if (!fs.existsSync(dbPath)) return { ok: false, error: 'No se encontró la base de datos actual' }

    // Hacer backup de seguridad antes de restaurar
    const ts         = new Date().toISOString().replace(/[:.]/g, '-')
    const backupDir  = path.join(backendPath, 'database', 'backups')
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true })
    fs.copyFileSync(dbPath, path.join(backupDir, `backup_pre_restauracion_${ts}.db`))

    // Detener el backend, copiar el archivo, reiniciar
    backendServer.stop()
    await new Promise(r => setTimeout(r, 1500))
    fs.copyFileSync(result.filePaths[0], dbPath)
    await backendServer.start()

    return { ok: true, mensaje: 'Base de datos restaurada correctamente. La app se recargará.' }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})
