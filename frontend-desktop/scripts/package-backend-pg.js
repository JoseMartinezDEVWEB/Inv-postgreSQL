/**
 * package-backend-pg.js
 * Empaqueta el backend PostgreSQL en resources/backend-pg/
 * (NO toca resources/backend/ que es el backend SQLite)
 *
 * Uso:  node scripts/package-backend-pg.js
 */

import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

const projectRoot   = path.join(__dirname, '..')
const backendSource = path.join(projectRoot, '../backend')   // Inv-postgreSQL/backend/ (PG)
const backendDest   = path.join(projectRoot, 'resources/backend-pg')  // <-- separado del SQLite

console.log('\n═══════════════════════════════════════════════════')
console.log(' Empaquetando backend PostgreSQL → resources/backend-pg')
console.log('═══════════════════════════════════════════════════')
console.log('   Origen :', backendSource)
console.log('   Destino:', backendDest)
console.log()

if (!fs.existsSync(backendSource)) {
  console.error('❌ No se encontró el backend PostgreSQL en:', backendSource)
  process.exit(1)
}

try {
  // ── 1. Limpiar destino ─────────────────────────────────────────────────────
  if (fs.existsSync(backendDest)) {
    console.log('🗑️  Limpiando carpeta destino anterior...')
    fs.removeSync(backendDest)
  }
  fs.ensureDirSync(backendDest)

  // ── 2. Copiar carpetas de código fuente ────────────────────────────────────
  console.log('📋 Copiando código fuente...')
  const folders = ['models', 'routes', 'utils', 'scripts']
  for (const folder of folders) {
    const src = path.join(backendSource, folder)
    if (fs.existsSync(src)) {
      fs.copySync(src, path.join(backendDest, folder), { overwrite: true })
      console.log(`   ✔ ${folder}/`)
    }
  }

  // ── 3. Copiar archivos individuales ────────────────────────────────────────
  for (const file of ['server.js', 'package.json', 'package-lock.json']) {
    const src = path.join(backendSource, file)
    if (fs.existsSync(src)) {
      fs.copySync(src, path.join(backendDest, file))
      console.log(`   ✔ ${file}`)
    }
  }

  // ── 4. Crear .env de producción ────────────────────────────────────────────
  console.log('\n📝 Generando .env de producción...')
  const envContent = [
    '# Servidor',
    'PORT=4501',
    'NODE_ENV=production',
    '',
    '# Conexión PostgreSQL (ajustar según instalación)',
    'DB_HOST=localhost',
    'DB_PORT=5432',
    'DB_USER=postgres',
    'DB_PASSWORD=admin123',
    'DB_NAME=inventario_db',
    '',
    '# JWT',
    'JWT_SECRET=j4pro_pg_jwt_secret_change_in_production',
    '',
    '# Keys internas',
    'BROADCAST_API_KEY=J4Pro_BroadcastKey_2026',
  ].join('\n')

  fs.writeFileSync(path.join(backendDest, '.env'), envContent, 'utf8')
  console.log('   ✔ .env (PostgreSQL local)')

  // Carpeta uploads
  fs.ensureDirSync(path.join(backendDest, 'uploads'))
  console.log('   ✔ uploads/')

  // ── 5. Instalar dependencias de producción ─────────────────────────────────
  console.log('\n📦 Instalando dependencias de producción...')
  execSync('npm install --production --omit=dev', {
    cwd: backendDest,
    stdio: 'inherit',
  })
  console.log('   ✔ node_modules instalados')

  // ── 6. Empaquetar node.exe standalone ──────────────────────────────────────
  console.log('\n📦 Empaquetando Node.js standalone (bin/node.exe)...')

  let sourceNodePath = process.execPath

  // Si estamos dentro de Electron, process.execPath apunta a electron.exe
  if (!sourceNodePath.toLowerCase().endsWith('node.exe')) {
    try {
      sourceNodePath = execSync('where node', { encoding: 'utf8' })
        .split('\r\n')[0].trim()
    } catch {
      throw new Error(
        'No se encontró node.exe en el PATH. ' +
        'Asegúrate de ejecutar este script con Node.js del sistema, no con Electron.'
      )
    }
  }

  const binDir = path.join(backendDest, 'bin')
  fs.ensureDirSync(binDir)

  if (fs.existsSync(sourceNodePath) && sourceNodePath.toLowerCase().endsWith('node.exe')) {
    fs.copySync(sourceNodePath, path.join(binDir, 'node.exe'))
    const sizeMB = (fs.statSync(path.join(binDir, 'node.exe')).size / 1024 / 1024).toFixed(1)
    console.log(`   ✔ node.exe copiado (${sizeMB} MB)`)
    console.log(`     desde: ${sourceNodePath}`)
  } else {
    throw new Error(`No se pudo localizar un node.exe válido: ${sourceNodePath}`)
  }

  // ── 7. Resumen ─────────────────────────────────────────────────────────────
  console.log('\n✅ Backend PostgreSQL empaquetado en resources/backend-pg/')
  console.log('   models/ | routes/ | utils/ | server.js | .env | node_modules/ | bin/node.exe')
  console.log('═══════════════════════════════════════════════════\n')

} catch (error) {
  console.error('\n❌ Error al empaquetar backend PostgreSQL:', error.message)
  process.exit(1)
}
