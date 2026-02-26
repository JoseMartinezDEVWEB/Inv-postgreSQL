# Script de verificación pre-build para EAS Build
# Ejecutar con: .\VERIFICAR_ANTES_BUILD.ps1

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "🔍 VERIFICACIÓN PRE-BUILD" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

$allChecks = $true

# 1. Verificar carpeta android/
Write-Host "📁 Verificando carpeta android/..." -ForegroundColor Yellow
if (Test-Path "android") {
    Write-Host "   ❌ FALLO: Carpeta android/ existe" -ForegroundColor Red
    Write-Host "   Acción: Ejecuta el script de limpieza" -ForegroundColor Yellow
    $allChecks = $false
} else {
    Write-Host "   ✅ OK: Carpeta android/ no existe" -ForegroundColor Green
}

# 2. Verificar carpeta ios/
Write-Host "📁 Verificando carpeta ios/..." -ForegroundColor Yellow
if (Test-Path "ios") {
    Write-Host "   ❌ FALLO: Carpeta ios/ existe" -ForegroundColor Red
    Write-Host "   Acción: Ejecuta el script de limpieza" -ForegroundColor Yellow
    $allChecks = $false
} else {
    Write-Host "   ✅ OK: Carpeta ios/ no existe" -ForegroundColor Green
}

# 3. Verificar node_modules
Write-Host "📦 Verificando node_modules/..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Write-Host "   ✅ OK: node_modules existe" -ForegroundColor Green
} else {
    Write-Host "   ❌ FALLO: node_modules no existe" -ForegroundColor Red
    Write-Host "   Acción: Ejecuta npm install" -ForegroundColor Yellow
    $allChecks = $false
}

# 4. Verificar package.json
Write-Host "📄 Verificando package.json..." -ForegroundColor Yellow
if (Test-Path "package.json") {
    $packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
    
    # Verificar dependencias problemáticas
    $problematicDeps = @(
        "react-native-network-info",
        "react-native-device-info",
        "react-native-keychain",
        "react-native-linear-gradient"
    )
    
    $hasProblems = $false
    foreach ($dep in $problematicDeps) {
        if ($packageJson.dependencies.PSObject.Properties.Name -contains $dep) {
            Write-Host "   ❌ FALLO: Dependencia problemática encontrada: $dep" -ForegroundColor Red
            $hasProblems = $true
            $allChecks = $false
        }
    }
    
    if (-not $hasProblems) {
        Write-Host "   ✅ OK: No hay dependencias problemáticas" -ForegroundColor Green
    }
    
    # Verificar expo-secure-store
    if ($packageJson.dependencies.PSObject.Properties.Name -contains "expo-secure-store") {
        Write-Host "   ✅ OK: expo-secure-store instalado" -ForegroundColor Green
    } else {
        Write-Host "   ❌ FALLO: expo-secure-store no encontrado" -ForegroundColor Red
        Write-Host "   Acción: Ejecuta el script de limpieza" -ForegroundColor Yellow
        $allChecks = $false
    }
} else {
    Write-Host "   ❌ FALLO: package.json no encontrado" -ForegroundColor Red
    $allChecks = $false
}

# 5. Verificar app.json
Write-Host "📱 Verificando app.json..." -ForegroundColor Yellow
if (Test-Path "app.json") {
    $appJson = Get-Content "app.json" -Raw | ConvertFrom-Json
    
    $packageName = $appJson.expo.android.package
    if ($packageName -match "-") {
        Write-Host "   ❌ FALLO: Package name contiene guiones: $packageName" -ForegroundColor Red
        Write-Host "   Acción: Debe ser: com.j4pro.gestorinventario" -ForegroundColor Yellow
        $allChecks = $false
    } else {
        Write-Host "   ✅ OK: Package name válido: $packageName" -ForegroundColor Green
    }
} else {
    Write-Host "   ❌ FALLO: app.json no encontrado" -ForegroundColor Red
    $allChecks = $false
}

# 6. Verificar eas.json
Write-Host "🚀 Verificando eas.json..." -ForegroundColor Yellow
if (Test-Path "eas.json") {
    Write-Host "   ✅ OK: eas.json existe" -ForegroundColor Green
} else {
    Write-Host "   ⚠️ ADVERTENCIA: eas.json no encontrado" -ForegroundColor Yellow
}

# 7. Verificar .easignore
Write-Host "🚫 Verificando .easignore..." -ForegroundColor Yellow
if (Test-Path ".easignore") {
    $easignore = Get-Content ".easignore" -Raw
    if ($easignore -match "android/" -and $easignore -match "ios/") {
        Write-Host "   ✅ OK: .easignore configurado correctamente" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️ ADVERTENCIA: .easignore incompleto" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ⚠️ ADVERTENCIA: .easignore no encontrado" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan

if ($allChecks) {
    Write-Host "✅ TODAS LAS VERIFICACIONES PASARON" -ForegroundColor Green
    Write-Host "================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "🚀 Tu proyecto está listo para EAS Build" -ForegroundColor Green
    Write-Host ""
    Write-Host "Ejecuta:" -ForegroundColor Cyan
    Write-Host "   eas build -p android --profile preview" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "❌ ALGUNAS VERIFICACIONES FALLARON" -ForegroundColor Red
    Write-Host "================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "⚠️ Debes corregir los errores antes de hacer build" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Ejecuta primero:" -ForegroundColor Cyan
    Write-Host "   .\limpiar-proyecto-eas.ps1" -ForegroundColor White
    Write-Host ""
}

Write-Host "📋 Para más información, lee:" -ForegroundColor Cyan
Write-Host "   - REPORTE_FINAL_REPARACION.md" -ForegroundColor White
Write-Host "   - REPARACION_EAS_BUILD.md" -ForegroundColor White
Write-Host ""
