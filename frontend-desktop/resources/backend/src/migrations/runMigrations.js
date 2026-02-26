import dbManager from '../config/database.js'
import * as migration001 from './001_initial_schema.js'
import * as migration002 from './002_connection_states.js'
import * as migration003 from './003_sync_fields.js'
import * as migration004 from './004_productos_offline_cantidad.js'
import * as migration005 from './005_limite_colaboradores.js'

// Lista de migraciones en orden
const migrations = [
  { name: '001_initial_schema', module: migration001 },
  { name: '002_connection_states', module: migration002 },
  { name: '003_sync_fields', module: migration003 },
  { name: '004_productos_offline_cantidad', module: migration004 },
  { name: '005_limite_colaboradores', module: migration005 },
]

// Tabla de control de migraciones
const createMigrationsTable = (db) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      executedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `)
}

// Obtener migraciones ejecutadas
const getExecutedMigrations = (db) => {
  const stmt = db.prepare('SELECT name FROM migrations ORDER BY id')
  return stmt.all().map(row => row.name)
}

// Registrar migración ejecutada
const registerMigration = (db, name) => {
  const stmt = db.prepare('INSERT INTO migrations (name) VALUES (?)')
  stmt.run(name)
}

// Ejecutar migraciones pendientes
export const runMigrations = () => {
  console.log('🚀 Iniciando migraciones...\n')

  const db = dbManager.getDatabase()

  try {
    // Crear tabla de control
    createMigrationsTable(db)

    // Obtener migraciones ya ejecutadas
    const executed = getExecutedMigrations(db)
    console.log(`📋 Migraciones ejecutadas: ${executed.length}`)

    // Ejecutar migraciones pendientes
    let count = 0
    for (const migration of migrations) {
      if (!executed.includes(migration.name)) {
        console.log(`\n▶️  Ejecutando: ${migration.name}`)
        migration.module.up(db)
        registerMigration(db, migration.name)
        count++
      }
    }

    if (count === 0) {
      console.log('\n✅ Base de datos ya está actualizada')
    } else {
      console.log(`\n✅ ${count} migración(es) ejecutada(s) exitosamente`)
    }
  } catch (error) {
    console.error('\n❌ Error ejecutando migraciones:', error)
    throw error
  }
}

// Revertir última migración
export const rollbackLastMigration = () => {
  console.log('⬇️  Revirtiendo última migración...\n')

  const db = dbManager.getDatabase()

  try {
    const executed = getExecutedMigrations(db)

    if (executed.length === 0) {
      console.log('ℹ️  No hay migraciones para revertir')
      return
    }

    const lastMigration = executed[executed.length - 1]
    const migration = migrations.find(m => m.name === lastMigration)

    if (!migration) {
      throw new Error(`No se encontró la migración: ${lastMigration}`)
    }

    console.log(`▶️  Revirtiendo: ${migration.name}`)
    migration.module.down(db)

    // Eliminar registro de migración
    const stmt = db.prepare('DELETE FROM migrations WHERE name = ?')
    stmt.run(migration.name)

    console.log('\n✅ Migración revertida exitosamente')
  } catch (error) {
    console.error('\n❌ Error revirtiendo migración:', error)
    throw error
  }
}

// Si se ejecuta directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
}
