import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dbManager from '../config/database.js'
import config from '../config/env.js'
import { validarJWT, validarRol } from '../middlewares/auth.js'
import logger from '../utils/logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const router     = Router()

const getBackupDir = () => path.resolve(process.cwd(), config.database.backupPath)

const limpiarBackupsViejos = (maxGuardar = 30) => {
  try {
    const dir = getBackupDir()
    if (!fs.existsSync(dir)) return
    const archivos = fs.readdirSync(dir)
      .filter(f => f.endsWith('.db'))
      .map(f => ({ nombre: f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)
    archivos.slice(maxGuardar).forEach(f => {
      fs.unlinkSync(path.join(dir, f.nombre))
      logger.info(`🗑️ Backup antiguo eliminado: ${f.nombre}`)
    })
  } catch (err) {
    logger.warn('Advertencia al limpiar backups viejos:', err.message)
  }
}

// POST /api/backup/crear  — crea un backup manual (solo admin)
router.post('/crear', validarJWT, validarRol('administrador'), async (req, res) => {
  try {
    const backupDir = getBackupDir()
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true })

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const etiqueta  = req.body?.etiqueta ? `_${req.body.etiqueta.replace(/[^a-zA-Z0-9]/g, '_')}` : ''
    const filename  = `backup_manual${etiqueta}_${timestamp}.db`
    const destPath  = path.join(backupDir, filename)

    // db.backup() en better-sqlite3 devuelve una Promise — hay que awaitarla
    const db = dbManager.getDatabase()
    await db.backup(destPath)

    limpiarBackupsViejos(30)

    const stat = fs.statSync(destPath)
    logger.info(`📦 Backup manual creado: ${filename}`)
    res.json({
      ok: true,
      backup: { nombre: filename, tamaño: stat.size, fecha: stat.mtime, tipo: 'manual' },
    })
  } catch (err) {
    logger.error('Error al crear backup manual:', err.message)
    res.status(500).json({ ok: false, error: err.message })
  }
})

// GET /api/backup/listar  — lista todos los backups (solo admin)
router.get('/listar', validarJWT, validarRol('administrador'), (req, res) => {
  try {
    const dir = getBackupDir()
    if (!fs.existsSync(dir)) return res.json({ ok: true, backups: [] })

    const backups = fs.readdirSync(dir)
      .filter(f => f.endsWith('.db'))
      .map(f => {
        const stat = fs.statSync(path.join(dir, f))
        return {
          nombre : f,
          tamaño : stat.size,
          fecha  : stat.mtime,
          tipo   : f.includes('_auto_') ? 'automatico' : 'manual',
        }
      })
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))

    res.json({ ok: true, backups, directorio: dir })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// GET /api/backup/descargar/:filename  — descarga el archivo .db (solo admin)
router.get('/descargar/:filename', validarJWT, validarRol('administrador'), (req, res) => {
  try {
    // Sanear nombre para evitar path traversal
    const filename = path.basename(req.params.filename).replace(/[^a-zA-Z0-9_\-\.]/g, '')
    if (!filename.endsWith('.db')) return res.status(400).json({ ok: false, error: 'Archivo inválido' })

    const filePath = path.join(getBackupDir(), filename)
    if (!fs.existsSync(filePath)) return res.status(404).json({ ok: false, error: 'Backup no encontrado' })

    res.download(filePath, filename)
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// DELETE /api/backup/:filename  — elimina un backup (solo admin)
router.delete('/:filename', validarJWT, validarRol('administrador'), (req, res) => {
  try {
    const filename = path.basename(req.params.filename).replace(/[^a-zA-Z0-9_\-\.]/g, '')
    const filePath = path.join(getBackupDir(), filename)
    if (!fs.existsSync(filePath)) return res.status(404).json({ ok: false, error: 'Backup no encontrado' })
    fs.unlinkSync(filePath)
    logger.info(`🗑️ Backup eliminado por usuario: ${filename}`)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

export { limpiarBackupsViejos, getBackupDir }
export default router
