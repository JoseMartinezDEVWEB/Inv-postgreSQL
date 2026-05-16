/**
 * Servidor Backend Embebido para Electron
 * Inicia automáticamente el backend SQLite en modo standalone
 */

import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import http from 'http'
import os from 'os'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

class BackendServer {
  constructor() {
    this.process = null
    // Puerto estable para el backend embebido
    this.port = 4501
    // IPv4 explícito — en Windows localhost puede resolver a IPv6
    this.host = '127.0.0.1'
    this.isRunning = false
    this._backendReadyPromise = null
    this._resolveBackendReady = null
    this._rejectBackendReady = null
    this._backendLogsBuffer = ''
    this._backendLastLines = []
  }

  // ─── Verificación de puerto ────────────────────────────────────────────────

  async checkPort(port) {
    return new Promise((resolve) => {
      const server = http.createServer()
      server.once('error', () => resolve(false))
      server.once('listening', () => {
        server.close()
        resolve(true)
      })
      server.listen(port, '0.0.0.0')
    })
  }

  // ─── Rutas ─────────────────────────────────────────────────────────────────

  getBackendPath() {
    // Desarrollo: usar el backend del proyecto
    const devPath = path.join(__dirname, '../../backend')
    if (fs.existsSync(devPath)) return devPath

    // Producción: backend empaquetado en resources
    const prodPath = path.join(process.resourcesPath, 'backend')
    if (fs.existsSync(prodPath)) return prodPath

    throw new Error('Backend no encontrado')
  }

  // ─── Inicio principal ──────────────────────────────────────────────────────

  /**
   * Intenta iniciar el backend con reintentos automáticos.
   * Primer intento falla silenciosamente si es un error de arranque lento;
   * el segundo intento lo detecta como proceso que ya está levantando.
   */
  async startWithRetry(maxRetries = 2) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.start()
        return
      } catch (err) {
        if (attempt < maxRetries) {
          console.warn(`⚠️ Intento ${attempt}/${maxRetries} falló: ${err.message}`)
          console.warn(`   Reintentando en 4 segundos...`)
          await new Promise(r => setTimeout(r, 4000))
        } else {
          throw err
        }
      }
    }
  }

  async start() {
    if (this.isRunning) {
      console.log('⚠️ Backend ya está corriendo')
      return
    }

    try {
      const backendPath = this.getBackendPath()
      const healthUrl = this._getHealthUrl()

      // ── 1. ¿Hay un backend ya corriendo y saludable? ──────────────────────
      try {
        await this.checkHealth(healthUrl, { logErrors: false })
        console.log('✅ Backend externo detectado y saludable. Reutilizando.')
        this.isRunning = true
        return
      } catch {
        // No hay respuesta de salud — continuar evaluando
      }

      // ── 2. ¿El puerto está ocupado? (backend arrancando por Task/Startup) ──
      const isPortAvailable = await this.checkPort(this.port)

      if (!isPortAvailable) {
        // El puerto está en uso pero no responde aún.
        // Típico al arrancar el PC: el Task Scheduler levantó el backend
        // pero todavía está inicializando (migraciones, AV scan de node.exe…)
        console.log(`⏳ Puerto ${this.port} ocupado. Esperando proceso existente (hasta 60 s)...`)
        const existingReady = await this._waitForExistingProcess(healthUrl, 60000)
        if (existingReady) {
          console.log('✅ Proceso existente listo. Reutilizando.')
          this.isRunning = true
          return
        }
        // Si después de 60 s sigue sin responder, es un proceso huérfano.
        // Tiramos error para que el reintento externo nos dé otra oportunidad.
        throw new Error(
          `El puerto ${this.port} está ocupado por otro proceso que no responde. ` +
          `Reinicia el PC o cierra el proceso que usa ese puerto.`
        )
      }

      // ── 3. Puerto libre — arrancar el backend nosotros ────────────────────

      // Configurar regla de Firewall automáticamente en Windows
      if (process.platform === 'win32') {
        try { await this.setupFirewall() } catch (fwErr) {
          console.warn('⚠️ Firewall no configurado automáticamente:', fwErr.message)
        }
      }

      console.log('🚀 Iniciando backend local...')
      console.log('📂 Path:', backendPath)
      console.log('🔌 Puerto (fijo):', this.port)

      // Señal "backend listo" basada en logs del proceso hijo
      this._backendReadyPromise = new Promise((resolve, reject) => {
        this._resolveBackendReady = resolve
        this._rejectBackendReady = reject
      })
      this._backendLogsBuffer = ''
      this._backendLastLines = []

      // Log en archivo para diagnóstico en producción
      const appData = process.env.APPDATA ||
        (process.platform === 'darwin'
          ? path.join(os.homedir(), 'Library', 'Preferences')
          : '/var/local')
      const logDir = path.join(appData, 'TECH STOCK J4-PRO', 'logs')
      if (!fs.existsSync(logDir)) {
        try { fs.mkdirSync(logDir, { recursive: true }) } catch { }
      }
      const logFile = path.join(logDir, 'backend-startup.log')
      const logToFile = (msg) => {
        try { fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`) } catch { }
      }

      logToFile('--- Iniciando nuevo arranque del backend ---')

      const isProduction = backendPath.includes('resources')
      logToFile(`Producción: ${isProduction}  |  Path: ${backendPath}`)

      // Calcular ruta de datos en AppData (evita problemas de permisos en Program Files)
      const userDataPath = path.join(appData, 'TECH STOCK J4-PRO', 'data')
      if (!fs.existsSync(userDataPath)) {
        try { fs.mkdirSync(userDataPath, { recursive: true }) } catch { }
      }

      let command = 'node'
      let args = ['server.js']
      let spawnEnv = {
        ...process.env,
        PORT: String(this.port),
        NODE_ENV: isProduction ? 'production' : 'development',
        USER_DATA_PATH: userDataPath,
      }

      if (isProduction) {
        const bundledNodePath = path.join(backendPath, 'bin', 'node.exe')
        logToFile(`Buscando node.exe en: ${bundledNodePath}`)
        if (fs.existsSync(bundledNodePath)) {
          console.log('📦 Usando Node.js empaquetado (Standalone)')
          logToFile('✅ node.exe encontrado.')
          command = bundledNodePath
        } else {
          console.warn('⚠️ No se encontró Node.js empaquetado. Usando proceso de Electron.')
          logToFile('❌ node.exe NO encontrado. Fallback a Electron.')
          command = process.execPath
          args = ['--no-sandbox', 'src/server.js']
          spawnEnv.ELECTRON_RUN_AS_NODE = '1'
        }
      } else {
        console.log('🔧 Modo Desarrollo: usando Node.js del sistema')
      }

      logToFile(`Comando: ${command}  |  Args: ${JSON.stringify(args)}`)

      this.process = spawn(command, args, {
        cwd: backendPath,
        env: spawnEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      let processExited = false
      let exitCode = null
      let processError = null

      this._attachBackendLogPipes()

      this.process.on('error', (error) => {
        console.error('❌ Error al iniciar backend:', error)
        this.isRunning = false
        processExited = true
        processError = error
        if (this._rejectBackendReady) this._rejectBackendReady(error)
      })

      this.process.on('exit', (code) => {
        exitCode = code
        processExited = true
        if (code !== 0 && code !== null) {
          console.log(`🛑 Backend detenido con código ${code}`)
        }
        this.isRunning = false
        if (code !== 0 && this._rejectBackendReady) {
          this._rejectBackendReady(new Error(`Backend salió con código ${code}`))
        }
      })

      // Esperar arranque inicial del proceso
      await new Promise(resolve => setTimeout(resolve, 2000))

      if (processExited && exitCode !== 0) {
        if (this.process) { this.process.kill(); this.process = null }
        throw processError || new Error(`Backend falló con código ${exitCode}`)
      }

      // Esperar a que el servidor responda (hasta 120 s — AV scan en primer arranque)
      await this.waitForServer({ initialTimeoutMs: 20000, extendedTimeoutMs: 120000 })
      this.isRunning = true
      console.log('✅ Backend local iniciado correctamente')

    } catch (error) {
      if (this.process) { this.process.kill(); this.process = null }
      console.error('❌ Error al iniciar backend:', error)
      throw error
    }
  }

  // ─── Esperar proceso existente (arrancado por auto-inicio de Windows) ──────

  async _waitForExistingProcess(healthUrl, timeoutMs = 60000) {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      try {
        const ok = await this.checkHealth(healthUrl, { logErrors: false })
        if (ok) return true
      } catch {
        // Aún no listo
      }
      await new Promise(r => setTimeout(r, 1500))
    }
    return false
  }

  // ─── Pipes de logs ──────────────────────────────────────────────────────────

  _getHealthUrl() {
    return `http://${this.host}:${this.port}/api/salud`
  }

  _pushBackendLine(line) {
    this._backendLastLines.push(line)
    if (this._backendLastLines.length > 200) this._backendLastLines.shift()

    const portMatch =
      line.match(/Servidor iniciado en puerto\s+(\d{2,5})/i) ||
      line.match(/Servidor Local:\s*http:\/\/localhost:(\d{2,5})/i) ||
      line.match(/API Local:\s*http:\/\/localhost:(\d{2,5})\/api/i)

    if (portMatch) {
      const reportedPort = Number(portMatch[1])
      if (Number.isFinite(reportedPort) && reportedPort > 0) {
        if (this.port !== reportedPort) {
          console.log(`🔄 Puerto actualizado por logs: ${this.port} → ${reportedPort}`)
          this.port = reportedPort
        }
        if (this._resolveBackendReady) this._resolveBackendReady(true)
      }
    }
  }

  _attachBackendLogPipes() {
    if (!this.process) return
    const onChunk = (chunk, streamName) => {
      const text = chunk.toString('utf8')
      if (streamName === 'stdout') process.stdout.write(text)
      else process.stderr.write(text)
      this._backendLogsBuffer += text
      let idx
      while ((idx = this._backendLogsBuffer.indexOf('\n')) !== -1) {
        const line = this._backendLogsBuffer.slice(0, idx).replace(/\r$/, '')
        this._backendLogsBuffer = this._backendLogsBuffer.slice(idx + 1)
        if (line.trim().length > 0) this._pushBackendLine(line)
      }
    }
    if (this.process.stdout) this.process.stdout.on('data', (c) => onChunk(c, 'stdout'))
    if (this.process.stderr) this.process.stderr.on('data', (c) => onChunk(c, 'stderr'))
  }

  // ─── Detectar tipo de backend (SQLite o PostgreSQL) ───────────────────────

  _isPostgresBackend(backendPath) {
    // PG backend: tiene models/index.js con dialect postgres, sin carpeta src/
    return fs.existsSync(path.join(backendPath, 'models', 'index.js')) &&
           !fs.existsSync(path.join(backendPath, 'src'))
  }

  // ─── Esperar que el servidor responda ──────────────────────────────────────

  async waitForServer({ initialTimeoutMs = 20000, extendedTimeoutMs = 120000, pollIntervalMs = 500 } = {}) {
    const start = Date.now()
    const url = this._getHealthUrl()
    let consecutiveDbErrors = 0

    while (true) {
      const elapsed = Date.now() - start

      if (this.process && this.process.exitCode !== null) {
        const lastLines = this._backendLastLines.slice(-30).join('\n')
        throw new Error(
          `Backend terminó antes de estar listo (exitCode=${this.process.exitCode}).\n` +
          (lastLines ? `Últimos logs:\n${lastLines}` : '')
        )
      }

      // Señal rápida desde logs
      if (this._backendReadyPromise) {
        const ready = await Promise.race([
          this._backendReadyPromise.then(() => true).catch(() => false),
          new Promise((resolve) => setTimeout(() => resolve(false), 50)),
        ])
        if (ready) return true
      }

      // Healthcheck real
      try {
        const ok = await this.checkHealth(url, { logErrors: false })
        if (ok) {
          consecutiveDbErrors = 0
          return true
        }
      } catch (err) {
        // Si la respuesta del backend indica que PostgreSQL no está conectado,
        // contabilizarlo para dar un error claro después de ~45 s sin DB.
        if (err.message && err.message.includes('DB_DISCONNECTED')) {
          consecutiveDbErrors++
          if (consecutiveDbErrors === 1) {
            console.warn('⚠️ Backend activo pero PostgreSQL no conectado. Esperando...')
          }
          // 45 s de errores de BD → PostgreSQL probablemente no está instalado/iniciado
          if (consecutiveDbErrors * pollIntervalMs > 45000) {
            throw new Error(
              'PG_NOT_AVAILABLE: El backend está activo pero PostgreSQL no responde.\n' +
              'Verifica que el servicio PostgreSQL esté instalado e iniciado en Windows.'
            )
          }
        }
      }

      if (elapsed > extendedTimeoutMs) {
        throw new Error(`Backend no respondió en ${extendedTimeoutMs / 1000} segundos`)
      }

      if (elapsed > initialTimeoutMs && elapsed % 10000 < 500) {
        console.log(`⏳ Esperando backend... ${Math.round(elapsed / 1000)}s (arranque lento o AV scan)`)
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
    }
  }

  // ─── Health check HTTP ─────────────────────────────────────────────────────

  async checkHealth(url, { logErrors = false } = {}) {
    return new Promise((resolve, reject) => {
      const req = http.get(url, {
        headers: { Accept: 'application/json' },
      }, (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(true)
          } else {
            // Intentar parsear respuesta para dar error más específico
            let errorMsg = `Status ${res.statusCode}`
            try {
              const body = JSON.parse(data)
              // Backend PostgreSQL devuelve database:'disconnected' cuando PG no responde
              if (body.database === 'disconnected' || body.status === 'error') {
                errorMsg = `DB_DISCONNECTED: ${body.error || body.message || 'PostgreSQL no conectado'}`
              }
            } catch { /* no es JSON */ }

            if (logErrors) {
              console.log(`🩺 checkHealth: status=${res.statusCode} → ${errorMsg}`)
            }
            reject(new Error(errorMsg))
          }
        })
      })
      req.on('error', (error) => {
        if (logErrors) console.log(`🩺 checkHealth error: ${error.code} url=${url}`)
        reject(error)
      })
      req.setTimeout(3000, () => {
        req.destroy()
        reject(new Error('Timeout'))
      })
    })
  }

  // ─── Detener ───────────────────────────────────────────────────────────────

  stop() {
    if (this.process) {
      console.log('🛑 Deteniendo backend...')
      this.process.kill()
      this.process = null
      this.isRunning = false
    }
  }

  // ─── Firewall ──────────────────────────────────────────────────────────────

  async setupFirewall() {
    return new Promise((resolve) => {
      const ruleName = 'J4ProBackend'
      const cmd =
        `netsh advfirewall firewall show rule name="${ruleName}" >nul 2>&1 || ` +
        `netsh advfirewall firewall add rule name="${ruleName}" dir=in action=allow protocol=TCP localport=${this.port} profile=any enable=yes`
      spawn('cmd.exe', ['/c', cmd], { stdio: 'ignore' }).on('exit', () => resolve(true))
    })
  }

  // ─── Registrar auto-inicio en Windows (Startup folder) ────────────────────

  async registerWindowsAutoStart() {
    if (process.platform !== 'win32') return

    try {
      const backendPath = this.getBackendPath()
      const nodePath = path.join(backendPath, 'bin', 'node.exe')

      if (!fs.existsSync(nodePath)) {
        console.warn('⚠️ Auto-inicio: node.exe no encontrado, se omite.')
        return
      }

      const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
      const userDataPath = path.join(appData, 'TECH STOCK J4-PRO', 'data')
      const j4proDir = path.join(appData, 'TECH STOCK J4-PRO')
      if (!fs.existsSync(j4proDir)) fs.mkdirSync(j4proDir, { recursive: true })

      // Detectar si el backend bundled es PostgreSQL o SQLite
      const isPostgres = this._isPostgresBackend(backendPath)

      // Crear VBScript que lanza el backend con ventana oculta.
      // En VBScript los backslashes NO se escapan — se escriben tal cual.
      // Las triples comillas (""") producen una comilla literal dentro del string VBS.
      const vbsPath = path.join(j4proDir, 'start-backend.vbs')
      const vbsLines = [
        'Set WshShell = CreateObject("WScript.Shell")',
        `WshShell.Environment("Process")("PORT") = "4501"`,
        `WshShell.Environment("Process")("NODE_ENV") = "production"`,
        `WshShell.Environment("Process")("USER_DATA_PATH") = "${userDataPath}"`,
      ]

      if (isPostgres) {
        // Para PostgreSQL: leer credenciales del .env ya existente en el backend.
        // El process.env hereda NODE_ENV y PORT; las vars DB las carga dotenv desde .env
        vbsLines.push(`' Backend PostgreSQL — credenciales en .env del directorio de trabajo`)
      }

      vbsLines.push(
        `WshShell.CurrentDirectory = "${backendPath}"`,
        // """ruta\node.exe"" server.js" → command = "ruta\node.exe" server.js
        `WshShell.Run """${nodePath}"" server.js", 0, False`,
      )

      const vbsContent = vbsLines.join('\r\n')

      fs.writeFileSync(vbsPath, vbsContent, 'utf8')

      // Poner el VBScript en la carpeta Startup del usuario (sin admin)
      const startupFolder = path.join(
        appData,
        'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup'
      )
      const startupTarget = path.join(startupFolder, 'TECH-STOCK-J4PRO-Backend.vbs')

      if (!fs.existsSync(startupTarget)) {
        fs.copyFileSync(vbsPath, startupTarget)
        console.log('✅ Auto-inicio registrado en carpeta Startup de Windows')
      } else {
        // Actualizar si el archivo fuente cambió
        const existingContent = fs.readFileSync(startupTarget, 'utf8')
        if (existingContent !== vbsContent) {
          fs.copyFileSync(vbsPath, startupTarget)
          console.log('🔄 Script de auto-inicio actualizado')
        } else {
          console.log('✅ Auto-inicio ya registrado y actualizado')
        }
      }
    } catch (err) {
      // No crítico — la app funciona sin auto-inicio
      console.warn('⚠️ No se pudo registrar auto-inicio:', err.message)
    }
  }

  // ─── Getters ───────────────────────────────────────────────────────────────

  getApiUrl() {
    return `http://${this.host}:${this.port}/api`
  }

  getPort() {
    return this.port
  }
}

export default new BackendServer()
