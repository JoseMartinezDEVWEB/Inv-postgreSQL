import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import config from './env.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Clase singleton para manejar la conexión a SQLite
class DatabaseManager {
  constructor() {
    this.db = null
  }

  // Inicializar la base de datos
  initialize() {
    if (this.db) {
      return this.db
    }

    try {
      // Crear directorio de database si no existe
      const dbDir = path.dirname(path.resolve(config.database.path))
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true })
        console.log(`📁 Directorio de base de datos creado: ${dbDir}`)
      }

      // Crear directorio de backups si no existe
      const backupDir = path.resolve(config.database.backupPath)
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true })
        console.log(`📁 Directorio de backups creado: ${backupDir}`)
      }

      // Conectar a la base de datos
      this.db = new Database(path.resolve(config.database.path), config.database.options)

      // Configuraciones importantes de SQLite
      this.db.pragma('journal_mode = WAL') // Write-Ahead Logging para mejor concurrencia
      this.db.pragma('foreign_keys = ON') // Habilitar claves foráneas
      this.db.pragma('synchronous = NORMAL') // Balance entre seguridad y velocidad
      this.db.pragma('cache_size = 10000') // Cache más grande para mejor performance

      console.log('✅ Conexión a SQLite establecida')
      console.log(`📍 Ruta de DB: ${path.resolve(config.database.path)}`)

      return this.db
    } catch (error) {
      console.error('❌ Error al conectar a SQLite:', error)
      throw error
    }
  }

  // Obtener la instancia de la base de datos
  getDatabase() {
    if (!this.db) {
      this.initialize()
    }
    return this.db
  }

  // Cerrar la conexión
  close() {
    if (this.db) {
      this.db.close()
      this.db = null
      console.log('🔒 Conexión a SQLite cerrada')
    }
  }

  // Crear backup de la base de datos
  backup(backupPath = null) {
    if (!this.db) {
      throw new Error('Base de datos no inicializada')
    }

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const defaultBackupPath = path.join(
        config.database.backupPath,
        `backup_${timestamp}.db`
      )
      const finalBackupPath = backupPath || defaultBackupPath

      // Usar el método nativo de SQLite para backup
      this.db.backup(finalBackupPath)

      console.log(`✅ Backup creado: ${finalBackupPath}`)
      return finalBackupPath
    } catch (error) {
      console.error('❌ Error al crear backup:', error)
      throw error
    }
  }

  // Ejecutar consulta preparada
  prepare(sql) {
    return this.getDatabase().prepare(sql)
  }

  // Ejecutar transacción
  transaction(fn) {
    return this.getDatabase().transaction(fn)
  }

  // Ejecutar múltiples sentencias SQL
  exec(sql) {
    return this.getDatabase().exec(sql)
  }
}

// Exportar instancia singleton
const dbManager = new DatabaseManager()

export default dbManager
export { dbManager }
