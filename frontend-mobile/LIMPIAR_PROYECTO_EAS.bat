@echo off
chcp 65001 >nul
echo ================================
echo 🔧 LIMPIEZA COMPLETA DEL PROYECTO
echo ================================
echo.

echo 📁 Eliminando carpetas nativas...
if exist "android" (
    rmdir /s /q "android"
    echo    ✓ Carpeta android/ eliminada
) else (
    echo    ℹ Carpeta android/ no existe
)

if exist "ios" (
    rmdir /s /q "ios"
    echo    ✓ Carpeta ios/ eliminada
)

if exist "android_backup" (
    rmdir /s /q "android_backup"
    echo    ✓ Carpeta android_backup/ eliminada
)

echo.
echo 🗑️ Limpiando node_modules y caché...
if exist "node_modules" (
    rmdir /s /q "node_modules"
    echo    ✓ node_modules eliminado
)

if exist "package-lock.json" (
    del /f /q "package-lock.json"
    echo    ✓ package-lock.json eliminado
)

if exist ".expo" (
    rmdir /s /q ".expo"
    echo    ✓ Caché de Expo eliminado
)

echo.
echo 🧹 Limpiando caché de npm...
call npm cache clean --force
echo    ✓ Caché de npm limpiado

echo.
echo 📦 Instalando dependencias limpias...
call npm install

echo.
echo ================================
echo ✅ LIMPIEZA COMPLETADA
echo ================================
echo.
echo 📋 Próximos pasos:
echo    1. Verifica que NO exista carpeta android/ o ios/
echo    2. Ejecuta: eas build -p android --profile preview
echo.
echo ⚠️ IMPORTANTE:
echo    - NO ejecutes "expo prebuild"
echo    - NO ejecutes "expo run:android"
echo    - Usa siempre "eas build" para compilar
echo.

pause
