/**
 * Script de empaquetado para backend SQLite
 */
import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

const projectRoot   = path.join(__dirname, '..')
const backendSource = path.join(projectRoot, '../backend-sqlite-src')
const backendDest   = path.join(projectRoot, 'resources/backend')

console.log('📦 Preparando Backend SQLite para el instalador...')

try {
  if (fs.existsSync(backendDest)) {
    fs.removeSync(backendDest)
  }
  fs.ensureDirSync(backendDest)

  // Copiar todo desde el backup del SQLite
  if (!fs.existsSync(backendSource)) {
    console.error('❌ No se encontró la fuente de SQLite en:', backendSource)
    process.exit(1)
  }
  
  fs.copySync(backendSource, backendDest)

  // .env para producción SQLite
  const envContent = [
    'PORT=4501',
    'NODE_ENV=production',
    'DB_DIALECT=sqlite'
  ].join('\n')
  fs.writeFileSync(path.join(backendDest, '.env'), envContent)

  // Nota: SQLite suele tener sus dependencias ya listas o necesita npm install
  console.log('📦 Verificando dependencias de SQLite...')
  execSync('npm install --production', { cwd: backendDest, stdio: 'inherit' })

  // Asegurar bin/node.exe
  const binDir = path.join(backendDest, 'bin')
  fs.ensureDirSync(binDir)
  if (!fs.existsSync(path.join(binDir, 'node.exe'))) {
    fs.copySync(process.execPath, path.join(binDir, 'node.exe'))
  }

  console.log('✅ Backend SQLite listo')
} catch (error) {
  console.error('❌ Error:', error.message)
  process.exit(1)
}
