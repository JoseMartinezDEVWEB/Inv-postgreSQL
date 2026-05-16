/**
 * Script de prebuild: empaqueta el backend PostgreSQL en resources/backend
 * para que electron-builder lo incluya en el instalador final.
 *
 * Estructura del backend PostgreSQL (no usa subcarpeta src/):
 *   backend/
 *     models/    routes/    utils/
 *     server.js  package.json  .env
 */

import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

const projectRoot   = path.join(__dirname, '..')
const backendSource = path.join(projectRoot, '../backend')
const backendDest   = path.join(projectRoot, 'resources/backend')

console.log('📦 Empaquetando backend PostgreSQL...')
console.log('   Origen:', backendSource)
console.log('   Destino:', backendDest)

if (!fs.existsSync(backendSource)) {
  console.error('❌ No se encontró la carpeta del backend en:', backendSource)
  process.exit(1)
}

try {
  // Limpiar destino
  if (fs.existsSync(backendDest)) {
    console.log('🗑️  Limpiando carpeta destino...')
    fs.removeSync(backendDest)
  }
  fs.ensureDirSync(backendDest)

  console.log('📋 Copiando código fuente...')

  // Carpetas de código (estructura plana del backend PostgreSQL)
  const folders = ['models', 'routes', 'utils', 'scripts']
  for (const folder of folders) {
    const src = path.join(backendSource, folder)
    if (fs.existsSync(src)) {
      fs.copySync(src, path.join(backendDest, folder), { overwrite: true })
      console.log(`   ✔ ${folder}/`)
    }
  }

  // Archivos individuales
  const files = ['server.js', 'package.json']
  for (const file of files) {
    const src = path.join(backendSource, file)
    if (fs.existsSync(src)) {
      fs.copySync(src, path.join(backendDest, file))
      console.log(`   ✔ ${file}`)
    }
  }

  // Crear .env de producción (nunca copiar el .env de desarrollo)
  const envContent = [
    'PORT=4501',
    'DB_HOST=localhost',
    'DB_USER=postgres',
    'DB_PASSWORD=admin123',
    'DB_NAME=inventario_db',
    'DB_PORT=5432',
    'JWT_SECRET=j4pro_default_change_in_production',
    'NODE_ENV=production',
    'BROADCAST_API_KEY=J4Pro_BroadcastKey_2026',
  ].join('\n')

  fs.writeFileSync(path.join(backendDest, '.env'), envContent, 'utf8')
  console.log('   ✔ .env (generado para producción)')

  // Carpeta de uploads
  fs.ensureDirSync(path.join(backendDest, 'uploads'))

  // Instalar dependencias de producción
  console.log('\n📦 Instalando dependencias de producción...')
  const { execSync } = await import('child_process')
  execSync('npm install --production --omit=dev', {
    cwd: backendDest,
    stdio: 'inherit',
  })

  // Empaquetar node.exe para no depender de Node.js del sistema
  console.log('\n📦 Empaquetando Node.js standalone...')
  let sourceNodePath = process.execPath

  if (!sourceNodePath.toLowerCase().endsWith('node.exe')) {
    try {
      sourceNodePath = execSync('where node', { encoding: 'utf8' })
        .split('\r\n')[0]
        .trim()
    } catch {
      throw new Error(
        'No se encontró node.exe en PATH. Asegúrate de ejecutar este script con Node.js.'
      )
    }
  }

  const binDir = path.join(backendDest, 'bin')
  fs.ensureDirSync(binDir)

  if (fs.existsSync(sourceNodePath) && sourceNodePath.toLowerCase().endsWith('node.exe')) {
    fs.copySync(sourceNodePath, path.join(binDir, 'node.exe'))
    console.log(`   ✔ node.exe copiado desde: ${sourceNodePath}`)
  } else {
    throw new Error(`No se pudo localizar node.exe válido: ${sourceNodePath}`)
  }

  console.log('\n✅ Backend PostgreSQL empaquetado correctamente')
  console.log('   models/ | routes/ | utils/ | server.js')
  console.log('   .env (producción) | node_modules | bin/node.exe')

} catch (error) {
  console.error('\n❌ Error al empaquetar backend:', error.message)
  process.exit(1)
}
