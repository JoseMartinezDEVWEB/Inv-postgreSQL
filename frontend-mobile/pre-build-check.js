#!/usr/bin/env node

/**
 * Script de verificación pre-build
 * Verifica que todo esté configurado correctamente antes de generar la APK
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

console.log('🔍 Verificando configuración pre-build...\n')

let errores = 0
let advertencias = 0

// 1. Verificar app.json
console.log('📋 Verificando app.json...')
try {
  const appJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'app.json'), 'utf-8'))
  
  if (!appJson.expo.name) {
    console.log('  ❌ Falta el nombre de la app')
    errores++
  } else {
    console.log(`  ✅ Nombre: ${appJson.expo.name}`)
  }
  
  if (!appJson.expo.version) {
    console.log('  ❌ Falta la versión de la app')
    errores++
  } else {
    console.log(`  ✅ Versión: ${appJson.expo.version}`)
  }
  
  if (!appJson.expo.android?.package) {
    console.log('  ❌ Falta el package name de Android')
    errores++
  } else {
    console.log(`  ✅ Package: ${appJson.expo.android.package}`)
  }
  
  if (!fs.existsSync(path.join(__dirname, appJson.expo.icon))) {
    console.log(`  ⚠️  Icono no encontrado: ${appJson.expo.icon}`)
    advertencias++
  } else {
    console.log(`  ✅ Icono encontrado`)
  }
} catch (error) {
  console.log(`  ❌ Error leyendo app.json: ${error.message}`)
  errores++
}

// 2. Verificar eas.json
console.log('\n⚙️  Verificando eas.json...')
try {
  const easJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'eas.json'), 'utf-8'))
  
  const profiles = ['preview', 'production', 'local-test']
  profiles.forEach(profile => {
    if (easJson.build[profile]) {
      console.log(`  ✅ Perfil '${profile}' configurado`)
      if (easJson.build[profile].env?.EXPO_PUBLIC_API_URL) {
        console.log(`     API: ${easJson.build[profile].env.EXPO_PUBLIC_API_URL}`)
      }
    } else {
      console.log(`  ⚠️  Perfil '${profile}' no encontrado`)
      advertencias++
    }
  })
} catch (error) {
  console.log(`  ❌ Error leyendo eas.json: ${error.message}`)
  errores++
}

// 3. Verificar package.json
console.log('\n📦 Verificando package.json...')
try {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'))
  
  const requiredDeps = ['expo', 'react', 'react-native', 'axios']
  requiredDeps.forEach(dep => {
    if (packageJson.dependencies[dep]) {
      console.log(`  ✅ ${dep}: ${packageJson.dependencies[dep]}`)
    } else {
      console.log(`  ❌ Dependencia faltante: ${dep}`)
      errores++
    }
  })
} catch (error) {
  console.log(`  ❌ Error leyendo package.json: ${error.message}`)
  errores++
}

// 4. Verificar assets
console.log('\n🎨 Verificando assets...')
const assetsDir = path.join(__dirname, 'assets')
if (fs.existsSync(assetsDir)) {
  console.log('  ✅ Carpeta assets existe')
  
  const requiredAssets = ['icon.png', 'splash.png']
  requiredAssets.forEach(asset => {
    if (fs.existsSync(path.join(assetsDir, asset))) {
      console.log(`  ✅ ${asset} encontrado`)
    } else {
      console.log(`  ⚠️  ${asset} no encontrado`)
      advertencias++
    }
  })
} else {
  console.log('  ❌ Carpeta assets no existe')
  errores++
}

// 5. Verificar node_modules
console.log('\n📚 Verificando node_modules...')
if (fs.existsSync(path.join(__dirname, 'node_modules'))) {
  console.log('  ✅ node_modules existe')
} else {
  console.log('  ❌ node_modules no existe. Ejecuta: npm install')
  errores++
}

// Resumen
console.log('\n' + '='.repeat(50))
console.log('📊 RESUMEN')
console.log('='.repeat(50))

if (errores === 0 && advertencias === 0) {
  console.log('✅ Todo está correcto. Listo para generar la APK!')
  console.log('\n🚀 Comandos disponibles:')
  console.log('   npm run build:preview       - APK para pruebas (nube)')
  console.log('   npm run build:production    - APK de producción')
  console.log('   npm run build:local         - APK local (requiere Docker)')
} else {
  if (errores > 0) {
    console.log(`❌ ${errores} error(es) encontrado(s)`)
  }
  if (advertencias > 0) {
    console.log(`⚠️  ${advertencias} advertencia(s) encontrada(s)`)
  }
  
  if (errores > 0) {
    console.log('\n⛔ Corrige los errores antes de generar la APK')
    process.exit(1)
  } else {
    console.log('\n⚠️  Puedes continuar pero se recomienda revisar las advertencias')
  }
}

console.log('\n')
