/**
 * Script para empaquetar el backend con la aplicación desktop
 * Copia los archivos necesarios del backend a la carpeta de recursos
 */

import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const projectRoot = path.join(__dirname, '..')
const backendSource = path.join(projectRoot, '../backend-sqlite')
const backendDest = path.join(projectRoot, 'resources/backend')

console.log('📦 Empaquetando backend...')
console.log('   Origen:', backendSource)
console.log('   Destino:', backendDest)

try {
  // Limpiar carpeta destino
  if (fs.existsSync(backendDest)) {
    console.log('🗑️  Limpiando carpeta destino...')
    fs.removeSync(backendDest)
  }

  // Crear carpeta destino
  fs.ensureDirSync(backendDest)

  // Copiar archivos necesarios
  console.log('📋 Copiando archivos...')

  // 1. Copiar src completo
  fs.copySync(
    path.join(backendSource, 'src'),
    path.join(backendDest, 'src'),
    { overwrite: true }
  )

  // 2. Copiar package.json
  fs.copySync(
    path.join(backendSource, 'package.json'),
    path.join(backendDest, 'package.json')
  )

  // 3. Copiar .env.example como .env
  const envExample = path.join(backendSource, '.env.example')
  if (fs.existsSync(envExample)) {
    fs.copySync(
      envExample,
      path.join(backendDest, '.env')
    )
  }

  // 4. Crear carpeta database vacía (se creará en runtime)
  fs.ensureDirSync(path.join(backendDest, 'database'))
  fs.ensureDirSync(path.join(backendDest, 'database/backups'))
  fs.ensureDirSync(path.join(backendDest, 'logs'))

  // 5. Copiar node_modules necesarios (solo producción)
  console.log('📦 Instalando dependencias de producción...')
  const { execSync } = await import('child_process')

  try {
    execSync('npm install --production --omit=dev', {
      cwd: backendDest,
      stdio: 'inherit'
    })
  } catch (error) {
    console.error('❌ Error al instalar dependencias:', error.message)
    throw error
  }

  // 6. Copiar ejecutable de Node.js (Standalone)
  console.log('📦 Empaquetando ejecutable de Node.js...')
  const nodeExePath = process.execPath.endsWith('node.exe') ? process.execPath : process.env.NODE || 'node' // Intento básico

  // Buscar ubicación real de node (asumiendo Windows x64 dev environment)
  // Si estamos corriendo este script con node, process.execPath es el binario de node.
  // Pero necesitamos asegurarnos de que sea el node.exe puro y no electron.exe si se corre desde ahí (raro en build script).

  let sourceNodePath = process.execPath
  if (!sourceNodePath.endsWith('node.exe')) {
    // Si por alguna razón no detectamos node.exe, intentamos buscarlo con 'where'
    try {
      sourceNodePath = execSync('where node').toString().split('\r\n')[0].trim()
    } catch (e) {
      console.warn('⚠️ No se pudo localizar node.exe automáticamente. Usando copia del sistema si existe.')
    }
  }

  const binDir = path.join(backendDest, 'bin')
  fs.ensureDirSync(binDir)

  if (fs.existsSync(sourceNodePath) && sourceNodePath.endsWith('node.exe')) {
    console.log(`   Copiando node.exe desde: ${sourceNodePath}`)
    fs.copySync(sourceNodePath, path.join(binDir, 'node.exe'))
  } else {
    throw new Error('No se pudo encontrar un ejecutable node.exe válido para empaquetar.')
  }

  console.log('✅ Backend empaquetado correctamente')
  console.log('📊 Archivos copiados:')
  console.log('   - Código fuente (src/)')
  console.log('   - package.json')
  console.log('   - Variables de entorno')
  console.log('   - Dependencias de producción')
  console.log('   - Carpetas de datos (database/, logs/)')
  console.log('   - Binario Node.js (bin/node.exe)')

} catch (error) {
  console.error('❌ Error al empaquetar backend:', error)
  process.exit(1)
}
