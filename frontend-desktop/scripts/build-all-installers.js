/**
 * Script Maestro: Construye ambas versiones de la app desktop
 */
import { execSync } from 'child_process'
import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'
import os from 'os'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

const projectRoot = path.join(__dirname, '..')
const desktopPath = path.join(os.homedir(), 'Desktop', 'apk-desktop')

console.log('🚀 Iniciando construcción masiva de instaladores...')

try {
  // 1. Limpiar y preparar carpeta en el escritorio
  if (!fs.existsSync(desktopPath)) {
    fs.mkdirSync(desktopPath, { recursive: true })
  }

  // 2. Construir el Frontend (React) - Común para ambos
  console.log('\n⚛️  Construyendo Frontend React...')
  execSync('npm run build:react', { cwd: projectRoot, stdio: 'inherit' })

  // 3. Versión POSTGRESQL
  console.log('\n🐘 Preparando Versión PostgreSQL...')
  execSync('node scripts/package-backend-pg.js', { cwd: projectRoot, stdio: 'inherit' })
  console.log('🏗️  Compilando instalador PostgreSQL...')
  execSync('npx electron-builder --win --config electron-builder-pg.json', { cwd: projectRoot, stdio: 'inherit' })

  // 4. Versión SQLITE
  console.log('\n📁 Preparando Versión SQLite...')
  execSync('node scripts/package-backend-sqlite.js', { cwd: projectRoot, stdio: 'inherit' })
  console.log('🏗️  Compilando instalador SQLite...')
  execSync('npx electron-builder --win --config electron-builder-sqlite.json', { cwd: projectRoot, stdio: 'inherit' })

  // 5. Mover instaladores al escritorio
  console.log('\n🚚 Moviendo instaladores al Escritorio...')
  
  const pgInstallerDir = path.join(projectRoot, 'dist-installer/pg')
  const sqliteInstallerDir = path.join(projectRoot, 'dist-installer/sqlite')

  const moveInstaller = (sourceDir, pattern) => {
    const files = fs.readdirSync(sourceDir)
    const installer = files.find(f => f.includes(pattern) && f.endsWith('.exe'))
    if (installer) {
      fs.copySync(path.join(sourceDir, installer), path.join(desktopPath, installer))
      console.log(`   ✔ ${installer} copiado`)
    }
  }

  moveInstaller(pgInstallerDir, 'PostgreSQL')
  moveInstaller(sqliteInstallerDir, 'SQLite')

  // 6. Generar Guía de Instalación
  console.log('\n📄 Generando Guía de Instalación...')
  const guia = `
===========================================================
    GUÍA DE INSTALACIÓN - TECH STOCK J4-PRO (DESKTOP)
===========================================================

Esta carpeta contiene dos versiones de la aplicación Gestor de Inventario.
Elige la que mejor se adapte a tus necesidades:

1. VERSIÓN POSTGRESQL (Recomendada para redes y múltiples usuarios)
   - Archivo: TECH-STOCK-J4PRO-PostgreSQL-Setup-1.0.0.exe
   - REQUISITO: Debes tener instalado PostgreSQL (v14 o superior) en la PC.
   - VENTAJA: Mayor rendimiento con grandes volúmenes de datos y concurrencia.
   - DETECCIÓN: La app verificará al iniciar si el servidor PostgreSQL está activo.

2. VERSIÓN SQLITE (Ideal para uso local rápido y sencillo)
   - Archivo: TECH-STOCK-J4PRO-SQLite-Setup-1.0.0.exe
   - REQUISITO: Ninguno. Es totalmente standalone.
   - VENTAJA: No requiere configuración de base de datos externa. "Instalar y usar".

INSTRUCCIONES GENERALES:
------------------------
1. Ejecuta el instalador .exe de tu preferencia.
2. Sigue los pasos del asistente de instalación.
3. Al finalizar, encontrarás un acceso directo en tu escritorio.
4. Asegúrate de permitir el acceso en el Firewall de Windows cuando se te solicite,
   para que los dispositivos móviles puedan conectarse a tu inventario.

SOPORTE:
--------
Si tienes dudas, contacta con el administrador del sistema.
Desarrollado por Jose Martinez - J4 Pro.
`
  fs.writeFileSync(path.join(desktopPath, 'Guia_de_Instalacion.txt'), guia.trim())
  console.log('   ✔ Guia_de_Instalacion.txt generada')

  console.log('\n✨ PROCESO COMPLETADO CON ÉXITO ✨')
  console.log(`📂 Revisa la carpeta en: ${desktopPath}`)

} catch (error) {
  console.error('\n❌ ERROR CRÍTICO:', error.message)
  process.exit(1)
}
