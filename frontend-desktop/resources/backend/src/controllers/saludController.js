import dbManager from '../config/database.js'
import { respuestaExito } from '../utils/helpers.js'
import os from 'os'

export const checkSalud = async (req, res) => {
  res.json(
    respuestaExito({
      estado: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    })
  )
}

export const checkDB = async (req, res) => {
  try {
    const db = dbManager.getDatabase()
    const result = db.prepare('SELECT 1 as test').get()

    res.json(
      respuestaExito({
        estado: 'OK',
        conexion: 'Activa',
        test: result.test === 1,
      })
    )
  } catch (error) {
    res.status(500).json({
      estado: 'ERROR',
      conexion: 'Fallida',
      error: error.message,
    })
  }
}

export const getSystemInfo = async (req, res) => {
  const info = {
    plataforma: os.platform(),
    arquitectura: os.arch(),
    cpus: os.cpus().length,
    memoriaTotal: `${Math.round(os.totalmem() / 1024 / 1024 / 1024)} GB`,
    memoriaLibre: `${Math.round(os.freemem() / 1024 / 1024 / 1024)} GB`,
    uptime: `${Math.floor(os.uptime() / 3600)} horas`,
    nodeVersion: process.version,
  }

  res.json(respuestaExito(info))
}

export default {
  checkSalud,
  checkDB,
  getSystemInfo,
}
