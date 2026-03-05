/**
 * Servidor Backend Embebido para Electron
 * Inicia automáticamente el backend SQLite en modo standalone
 */

import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import http from 'http'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

class BackendServer {
  constructor() {
    this.process = null
    // Puerto estable para el backend embebido (debe ser fijo para QR/auto-conexión)
    this.port = 4500
    // En Windows, `localhost` puede resolver a IPv6 (::1) y fallar si el backend
    // solo escucha en IPv4. Usamos loopback IPv4 explícito para checks internos.
    this.host = '127.0.0.1'
    this.isRunning = false
    this._backendReadyPromise = null
    this._resolveBackendReady = null
    this._rejectBackendReady = null
    this._backendLogsBuffer = ''
    this._backendLastLines = []
  }

  async checkPort(port) {
    return new Promise((resolve) => {
      // Intentamos escuchar en 0.0.0.0 para que coincida con el backend
      const server = http.createServer()
      server.once('error', () => resolve(false))
      server.once('listening', () => {
        server.close()
        resolve(true)
      })
      server.listen(port, '0.0.0.0')
    })
  }

  async findAvailablePort(startPort = 4000) {
    let port = startPort
    while (port < startPort + 100) {
      const available = await this.checkPort(port)
      if (available) return port
      port++
    }
    throw new Error('No hay puertos disponibles')
  }

  getBackendPath() {
    // En desarrollo: usar el backend del proyecto
    const devPath = path.join(__dirname, '../../backend')
    if (fs.existsSync(devPath)) {
      return devPath
    }

    // En producción: usar backend empaquetado
    const prodPath = path.join(process.resourcesPath, 'backend')
    if (fs.existsSync(prodPath)) {
      return prodPath
    }

    throw new Error('Backend no encontrado')
  }

  async start() {
    if (this.isRunning) {
      console.log('⚠️ Backend ya está corriendo')
      return
    }

    try {
      const backendPath = this.getBackendPath()
      const healthUrl = this._getHealthUrl()

      // 1. Primero verificar si ya hay uno corriendo (es lo más rápido y seguro)
      try {
        await this.checkHealth(healthUrl, { logErrors: false })
        console.log('✅ Backend externo detectado. Usando instancia existente.')
        this.isRunning = true
        if (this._resolveBackendReady) this._resolveBackendReady(true)
        return
      } catch (err) {
        // No hay backend corriendo, procedemos a intentar iniciarlo
      }

      // 2. Validar disponibilidad del puerto fijo 4500
      const isAvailable = await this.checkPort(this.port)
      if (!isAvailable) {
        throw new Error(
          `El puerto ${this.port} está ocupado por otro proceso. ` +
          `J4 Pro requiere el backend en ${this.port}. ` +
          `Cierra la app/proceso que usa ese puerto y reintenta.`
        )
      }

      console.log('🚀 Iniciando backend local...')
      console.log('📂 Path:', backendPath)
      console.log('🔌 Puerto (fijo):', this.port)

      // Señal de "backend listo" basada en logs del proceso hijo
      this._backendReadyPromise = new Promise((resolve, reject) => {
        this._resolveBackendReady = resolve
        this._rejectBackendReady = reject
      })
      this._backendLogsBuffer = ''
      this._backendLastLines = []

      // Configurar sistema de logs en archivo para debugging en producción
      const appData = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Preferences' : '/var/local')
      const logDir = path.join(appData, 'TECH STOCK J4-PRO', 'logs')
      if (!fs.existsSync(logDir)) {
        try { fs.mkdirSync(logDir, { recursive: true }) } catch (e) { }
      }
      const logFile = path.join(logDir, 'backend-startup.log')

      const logToFile = (msg) => {
        try {
          const timestamp = new Date().toISOString()
          fs.appendFileSync(logFile, `[${timestamp}] ${msg}\n`)
        } catch (e) { }
      }

      logToFile('--- Iniciando nuevo intento de arranque del backend ---')

      // Determinar si estamos en producción basado en el path del backend
      const isProduction = backendPath.includes('resources')
      logToFile(`Modo producción detectado: ${isProduction}`)
      logToFile(`Backend path: ${backendPath}`)

      let command = 'node'
      let args = ['server.js']
      let spawnEnv = {
        ...process.env,
        PORT: String(this.port),
        NODE_ENV: isProduction ? 'production' : 'development'
      }

      if (isProduction) {
        // En producción, buscamos el node.exe empaquetado
        const bundledNodePath = path.join(backendPath, 'bin', 'node.exe')
        logToFile(`Buscando node.exe empaquetado en: ${bundledNodePath}`)

        if (fs.existsSync(bundledNodePath)) {
          console.log('📦 Usando Node.js empaquetado (Standalone)')
          logToFile('✅ Node.exe empaquetado encontrado. Usándolo.')
          command = bundledNodePath
          // No necesitamos ELECTRON_RUN_AS_NODE porque es un node real
        } else {
          console.warn('⚠️ No se encontró Node.js empaquetado. Intentando fallback a sistema...')
          logToFile('❌ Node.exe empaquetado NO encontrado. Intentando fallback.')

          // Fallaks anteriores...
          command = process.execPath
          args = ['--no-sandbox', 'src/server.js']
          spawnEnv.ELECTRON_RUN_AS_NODE = '1'
        }
      } else {
        console.log('🔧 Modo Desarrollo: Usando Node.js del sistema')
      }

      logToFile(`Comando final: ${command}`)
      logToFile(`Argumentos: ${JSON.stringify(args)}`)

      // Iniciar servidor backend
      this.process = spawn(command, args, {
        cwd: backendPath,
        env: spawnEnv,
        // Usar pipes para poder parsear logs y detectar "Servidor iniciado..."
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      let processExited = false
      let exitCode = null
      let processError = null

      // Capturar logs del backend y reenviarlos a la consola (mantiene DX).
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

      // Esperar un poco para que el proceso inicie y detectar fallos tempranos
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Si el proceso ya falló, abortar (no cambiar puerto automáticamente)
      if (processExited && exitCode !== 0) {
        if (this.process) {
          this.process.kill()
          this.process = null
        }
        throw processError || new Error(`Backend falló con código ${exitCode}`)
      }

      // Si el proceso sigue corriendo, esperar a que el servidor esté listo
      await this.waitForServer({ initialTimeoutMs: 15000, extendedTimeoutMs: 60000 })
      this.isRunning = true
      console.log('✅ Backend local iniciado correctamente')
    } catch (error) {
      // Limpiar proceso si existe
      if (this.process) {
        this.process.kill()
        this.process = null
      }
      console.error('❌ Error al iniciar backend:', error)
      throw error
    }
  }

  _getHealthUrl() {
    return `http://${this.host}:${this.port}/api/salud`
  }

  _pushBackendLine(line) {
    // Mantener un buffer pequeño para diagnósticos (por si falla el arranque)
    this._backendLastLines.push(line)
    if (this._backendLastLines.length > 200) this._backendLastLines.shift()

    // Detectar el puerto reportado por el backend y sincronizarlo estrictamente
    // Ejemplos:
    // - "info: ✅ Servidor iniciado en puerto 4500 {...}"
    // - "🌐 Servidor Local: http://localhost:4500"
    const portMatch =
      line.match(/Servidor iniciado en puerto\s+(\d{2,5})/i) ||
      line.match(/Servidor Local:\s*http:\/\/localhost:(\d{2,5})/i) ||
      line.match(/API Local:\s*http:\/\/localhost:(\d{2,5})\/api/i)

    if (portMatch) {
      const reportedPort = Number(portMatch[1])
      if (Number.isFinite(reportedPort) && reportedPort > 0) {
        if (this.port !== reportedPort) {
          console.log(`🔄 Puerto actualizado por logs del backend: ${this.port} → ${reportedPort}`)
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
      // Reenviar para no perder visibilidad en dev
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

  async waitForServer({ initialTimeoutMs = 15000, extendedTimeoutMs = 60000, pollIntervalMs = 500 } = {}) {
    const start = Date.now()
    const url = this._getHealthUrl()

    while (true) {
      const elapsed = Date.now() - start

      // Si el proceso murió, no tiene sentido seguir esperando
      if (this.process && this.process.exitCode !== null) {
        const lastLines = this._backendLastLines.slice(-30).join('\n')
        throw new Error(
          `Backend terminó antes de estar listo (exitCode=${this.process.exitCode}).\n` +
          (lastLines ? `Últimos logs:\n${lastLines}` : '')
        )
      }

      // Señal rápida basada en logs ("Servidor iniciado en puerto X")
      if (this._backendReadyPromise) {
        const ready = await Promise.race([
          this._backendReadyPromise.then(() => true).catch(() => false),
          new Promise((resolve) => setTimeout(() => resolve(false), 50)),
        ])
        if (ready) return true
      }

      // Healthcheck real (HTTP)
      try {
        const ok = await this.checkHealth(url, { logErrors: true })
        if (ok) return true
      } catch (error) {
        // seguimos intentando
      }

      // Refactor “más permisivo”: si el proceso sigue vivo, ampliamos el timeout
      if (elapsed > initialTimeoutMs && elapsed <= extendedTimeoutMs) {
        // No fatal: seguimos esperando (útil cuando migraciones/socket tardan)
      } else if (elapsed > extendedTimeoutMs) {
        throw new Error('Backend no respondió en el tiempo esperado')
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
    }
  }

  async checkHealth(url, { logErrors = false } = {}) {
    return new Promise((resolve, reject) => {
      const req = http.get(url, {
        headers: {
          // Pedimos algo simple; el backend debe permitir salud sin auth.
          Accept: 'text/plain, application/json;q=0.9, */*;q=0.8',
        },
      }, (res) => {
        let data = ''
        res.on('data', (chunk) => {
          data += chunk
        })
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(true)
          } else {
            if (logErrors) {
              const snippet = (data || '').toString().slice(0, 200).replace(/\s+/g, ' ').trim()
              console.log(`🩺 checkHealth fallo: status=${res.statusCode} url=${url} body="${snippet}"`)
            }
            reject(new Error(`Status ${res.statusCode}`))
          }
        })
      })

      req.on('error', (error) => {
        if (logErrors) {
          console.log(`🩺 checkHealth error: code=${error.code || 'N/A'} message=${error.message} url=${url}`)
        }
        reject(error)
      })

      req.setTimeout(2000, () => {
        req.destroy()
        if (logErrors) {
          console.log(`🩺 checkHealth timeout: url=${url}`)
        }
        reject(new Error('Timeout'))
      })
    })
  }

  stop() {
    if (this.process) {
      console.log('🛑 Deteniendo backend...')
      this.process.kill()
      this.process = null
      this.isRunning = false
    }
  }

  getApiUrl() {
    return `http://${this.host}:${this.port}/api`
  }

  getPort() {
    return this.port
  }
}

export default new BackendServer()
