const { spawnSync, execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const rootDir = path.resolve(process.cwd())

const mode = (process.argv[2] || '').toLowerCase()
if (!mode || (mode !== 'test' && mode !== 'dist')) {
  console.error('Uso: node scripts/build-apk.js <test|dist>')
  console.error('')
  console.error('  test  - APK standalone de prueba (release con firma debug, rápido)')
  console.error('  dist  - APK de distribución (release optimizado)')
  process.exit(1)
}

// Preferir android/ si existe; si no, usar android_backup/ (repo actual)
const androidDir = fs.existsSync(path.join(rootDir, 'android'))
  ? path.join(rootDir, 'android')
  : path.join(rootDir, 'android_backup')

if (!fs.existsSync(androidDir)) {
  console.error('No se encontró ni android/ ni android_backup/')
  process.exit(1)
}

const isWin = process.platform === 'win32'
const gradlew = isWin ? 'gradlew.bat' : './gradlew'
const gradlewPath = path.join(androidDir, gradlew)

if (!fs.existsSync(gradlewPath)) {
  console.error(`No se encontró el wrapper: ${gradlewPath}`)
  process.exit(1)
}

const acceptLicenses = () => {
  if (!isWin) return // Solo automatizado en Windows por ahora
  
  const androidHome = process.env.ANDROID_HOME || path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk')
  const paths = [
    path.join(androidHome, 'cmdline-tools', 'latest', 'bin', 'sdkmanager.bat'),
    path.join(androidHome, 'tools', 'bin', 'sdkmanager.bat')
  ]
  
  const sdkManager = paths.find(p => fs.existsSync(p))
  if (sdkManager) {
    console.log('ℹ️  Aceptando licencias de Android SDK...')
    try {
      execSync(`echo y| "${sdkManager}" --licenses`, { stdio: 'ignore' })
      console.log('✅ Licencias verificadas.')
    } catch (e) {
      console.warn('⚠️  No se pudo verificar licencias automáticamente.')
    }
  }
}

const execGradle = (args) => {
  acceptLicenses()
  console.log(`\n🔧 Ejecutando: gradlew ${args.join(' ')}\n`)
  const result = spawnSync(gradlew, args, {
    cwd: androidDir,
    stdio: 'inherit',
    shell: isWin, // necesario para ejecutar .bat en Windows
  })
  if (result.status !== 0) {
    process.exit(result.status || 1)
  }
}

/**
 * IMPORTANTE: En proyectos Expo con expo-dev-client:
 * 
 * - assembleDebug genera un "Development Build" que requiere servidor Metro
 * - assembleRelease genera un APK standalone con el bundle JS embebido
 * 
 * Para builds de prueba que funcionen sin servidor, usamos assembleRelease
 * pero firmado con el keystore de debug (configurado en build.gradle).
 */

if (mode === 'test') {
  // Build de prueba STANDALONE (release con firma debug)
  // Esto genera un APK que funciona sin servidor de desarrollo
  const abi = (process.env.ABI || process.env.ANDROID_ABI || 'arm64-v8a').trim()
  
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║           📦 APK DE PRUEBA STANDALONE (J4 Pro)             ║')
  console.log('╠════════════════════════════════════════════════════════════╣')
  console.log(`║  Modo: Release (con firma debug)                           ║`)
  console.log(`║  ABI: ${abi.padEnd(53)}║`)
  console.log(`║  Android Dir: ${path.relative(rootDir, androidDir).padEnd(45)}║`)
  console.log('╚════════════════════════════════════════════════════════════╝')
  console.log('')
  console.log('ℹ️  Este APK incluye el bundle JS y funciona SIN servidor Metro.')
  console.log('')
  
  // Usamos assembleRelease que incluye el bundle JS
  // El build.gradle ya está configurado para usar signingConfigs.debug cuando no hay keystore de release
  execGradle(['assembleRelease', `-PreactNativeArchitectures=${abi}`])
  
  const apkPath = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release')
  console.log('\n✅ Build finalizado.')
  console.log(`📁 APK ubicado en: ${apkPath}`)
  console.log('')
  console.log('📱 Para instalar en el dispositivo:')
  console.log(`   adb install "${path.join(apkPath, `app-${abi}-release.apk`)}"`)
  
} else {
  // Build de distribución completo (release con clean)
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║         📦 APK DE DISTRIBUCIÓN (J4 Pro)                    ║')
  console.log('╠════════════════════════════════════════════════════════════╣')
  console.log(`║  Modo: Release optimizado (con clean)                      ║`)
  console.log(`║  Android Dir: ${path.relative(rootDir, androidDir).padEnd(45)}║`)
  console.log('╚════════════════════════════════════════════════════════════╝')
  console.log('')
  console.log('ℹ️  Generando APKs para todas las arquitecturas...')
  console.log('')
  
  execGradle(['clean', 'assembleRelease'])
  
  const apkPath = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release')
  console.log('\n✅ Build finalizado.')
  console.log(`📁 APKs ubicados en: ${apkPath}`)
  
  // Listar APKs generados
  if (fs.existsSync(apkPath)) {
    const apks = fs.readdirSync(apkPath).filter(f => f.endsWith('.apk'))
    if (apks.length > 0) {
      console.log('\n📋 APKs generados:')
      apks.forEach(apk => {
        const size = (fs.statSync(path.join(apkPath, apk)).size / (1024 * 1024)).toFixed(2)
        console.log(`   - ${apk} (${size} MB)`)
      })
    }
  }
}
