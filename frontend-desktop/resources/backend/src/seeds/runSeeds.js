import dbManager from '../config/database.js'
import { runMigrations } from '../migrations/runMigrations.js'
import seedInitialData from './initialData.js'

// Inicializar base de datos
console.log('🔧 Inicializando base de datos...')
dbManager.initialize()

// Ejecutar migraciones
console.log('📦 Ejecutando migraciones...')
runMigrations()

// Ejecutar seeds
console.log('🌱 Ejecutando seeds...')
seedInitialData()

console.log('✅ Proceso completado')
process.exit(0)
