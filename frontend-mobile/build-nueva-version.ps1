# Script para generar nueva versión del APK con funciones de colaboración QR
# Versión 2.0.0

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   J4 Pro - Build Nueva Versión 2.0.0  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar que estamos en la carpeta correcta
if (-not (Test-Path "app.json")) {
    Write-Host "❌ Error: No se encuentra app.json" -ForegroundColor Red
    Write-Host "Asegúrate de ejecutar este script desde la carpeta frontend-mobile" -ForegroundColor Yellow
    pause
    exit 1
}

Write-Host "✅ Carpeta correcta verificada" -ForegroundColor Green
Write-Host ""

# Mostrar versión actual
$appJson = Get-Content "app.json" | ConvertFrom-Json
$version = $appJson.expo.version
$versionCode = $appJson.expo.android.versionCode

Write-Host "📱 Versión actual: $version" -ForegroundColor Cyan
Write-Host "📱 Version Code: $versionCode" -ForegroundColor Cyan
Write-Host ""

# Preguntar qué tipo de build hacer
Write-Host "¿Qué tipo de build deseas generar?" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Producción (Optimizado, más lento ~10-15 min)" -ForegroundColor White
Write-Host "2. Preview (Rápido, más pesado ~5-8 min)" -ForegroundColor White
Write-Host "3. Cancelar" -ForegroundColor White
Write-Host ""

$opcion = Read-Host "Selecciona una opción (1, 2 o 3)"

switch ($opcion) {
    "1" {
        Write-Host ""
        Write-Host "🚀 Iniciando build de PRODUCCIÓN..." -ForegroundColor Green
        Write-Host "Esto tomará entre 10-15 minutos. ¡Ten paciencia! ☕" -ForegroundColor Yellow
        Write-Host ""
        
        npx eas build --platform android --profile production
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "✅ ¡Build completado exitosamente!" -ForegroundColor Green
            Write-Host ""
            Write-Host "📥 Pasos siguientes:" -ForegroundColor Cyan
            Write-Host "1. Descarga el APK del link que aparece arriba" -ForegroundColor White
            Write-Host "2. Instálalo en tu dispositivo" -ForegroundColor White
            Write-Host "3. ¡Disfruta las nuevas funciones!" -ForegroundColor White
        } else {
            Write-Host ""
            Write-Host "❌ Error en el build. Revisa los logs arriba." -ForegroundColor Red
        }
    }
    "2" {
        Write-Host ""
        Write-Host "🚀 Iniciando build de PREVIEW..." -ForegroundColor Green
        Write-Host "Esto tomará entre 5-8 minutos." -ForegroundColor Yellow
        Write-Host ""
        
        npx eas build --platform android --profile preview
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "✅ ¡Build completado exitosamente!" -ForegroundColor Green
            Write-Host ""
            Write-Host "📥 Pasos siguientes:" -ForegroundColor Cyan
            Write-Host "1. Descarga el APK del link que aparece arriba" -ForegroundColor White
            Write-Host "2. Instálalo en tu dispositivo" -ForegroundColor White
            Write-Host "3. ¡Disfruta las nuevas funciones!" -ForegroundColor White
        } else {
            Write-Host ""
            Write-Host "❌ Error en el build. Revisa los logs arriba." -ForegroundColor Red
        }
    }
    "3" {
        Write-Host ""
        Write-Host "❌ Build cancelado." -ForegroundColor Yellow
        exit 0
    }
    default {
        Write-Host ""
        Write-Host "❌ Opción inválida. Ejecuta el script de nuevo." -ForegroundColor Red
        pause
        exit 1
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "         Proceso Finalizado             " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

pause
