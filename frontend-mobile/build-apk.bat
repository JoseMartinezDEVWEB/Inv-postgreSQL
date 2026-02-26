@echo off
setlocal EnableDelayedExpansion

echo ========================================
echo   APK Hibrida - J4 Pro Mobile
echo   (Funciona con y sin internet)
echo ========================================
echo.
echo CARACTERISTICAS DE LA APK:
echo   - Funciona CON internet (usa backend en la nube)
echo   - Funciona SIN internet (usa SQLite local)
echo   - Sincroniza automaticamente al recuperar conexion
echo   - Login offline: admin@j4pro.com / Jose.1919
echo.

REM Directorio base
set BASE_DIR=%~dp0
cd /d "%BASE_DIR%"

echo [INFO] Directorio: %BASE_DIR%
echo.

REM Menu
echo Selecciona una opcion:
echo.
echo 1. Generar APK de PRODUCCION (Clean + Bundle + Build)
echo 2. Solo generar bundle JS (Fix undefined is not a function)
echo 3. Solo limpiar proyecto (Deep Clean)
echo 4. Salir
echo.

set /p choice="Opcion (1-4): "

if "%choice%"=="1" goto build_production
if "%choice%"=="2" goto bundle_only
if "%choice%"=="3" goto clean_only
if "%choice%"=="4" goto end

echo [ERROR] Opcion invalida
pause
exit /b 1

REM =============================================
REM BUILD DE PRODUCCION (CLEAN + BUNDLE + ASSEMBLE)
REM =============================================
:build_production
echo.
echo ========================================
echo   Generando APK de Produccion
echo ========================================
echo.

echo [PASO 1/5] Limpieza profunda (Deep Clean)...
call :do_clean

echo [PASO 1.5/5] Verificando entorno Android...
if not exist "%BASE_DIR%android\local.properties" (
    echo [WARN] No se encontro local.properties
    echo [INFO] Intentando crear archivo automaticamente...
    
    set "SDK_PATH=C:\\Users\\%USERNAME%\\AppData\\Local\\Android\\Sdk"
    
    if exist "C:\Users\%USERNAME%\AppData\Local\Android\Sdk" (
        echo sdk.dir=!SDK_PATH! > "%BASE_DIR%android\local.properties"
        echo [OK] Archivo local.properties creado apuntando a:
        echo      !SDK_PATH!
    ) else (
        echo [ERROR] No se encontro el SDK de Android en la ruta por defecto.
        echo [ERROR] Por favor crea el archivo android\local.properties manualmente.
        pause
        exit /b 1
    )
)

echo [PASO 2/5] Verificando dependencias...
if not exist "%BASE_DIR%node_modules" (
    echo [INFO] Instalando dependencias...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Fallo npm install
        pause
        exit /b 1
    )
)

echo [PASO 3/5] Generando Bundle JS (Fix undefined error)...
call :do_bundle

echo [PASO 4/5] Compilando APK Release...
cd /d "%BASE_DIR%android"
echo [INFO] Ejecutando gradlew assembleRelease...
call gradlew.bat assembleRelease
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Fallo la compilacion
    cd /d "%BASE_DIR%"
    pause
    exit /b 1
)
cd /d "%BASE_DIR%"

echo.
echo ========================================
echo   APK GENERADA EXITOSAMENTE!
echo ========================================
goto show_apk

REM =============================================
REM SOLO BUNDLE
REM =============================================
:bundle_only
echo.
echo ========================================
echo   Generando solo Bundle JS
echo ========================================
echo.
call :do_bundle
echo [OK] Bundle generado correctamente
goto end

REM =============================================
REM SOLO LIMPIEZA
REM =============================================
:clean_only
echo.
echo ========================================
echo   Limpieza Profunda
echo ========================================
echo.
call :do_clean
echo [OK] Limpieza completada
goto end

REM =============================================
REM FUNCIONES
REM =============================================

:do_clean
echo [INFO] Limpiando cache de Metro...
if exist "%BASE_DIR%node_modules\.cache" rmdir /s /q "%BASE_DIR%node_modules\.cache" 2>nul
echo [INFO] Limpiando cache de Expo...
if exist "%BASE_DIR%.expo" rmdir /s /q "%BASE_DIR%.expo" 2>nul
echo [INFO] Limpiando builds de Android...
cd /d "%BASE_DIR%android"
call gradlew.bat clean 2>nul
cd /d "%BASE_DIR%"
echo [INFO] Eliminando bundles anteriores...
if exist "%BASE_DIR%android\app\src\main\assets\index.android.bundle" (
    del /f "%BASE_DIR%android\app\src\main\assets\index.android.bundle" 2>nul
)
exit /b 0

:do_bundle
echo [INFO] Preparando assets...
set ASSETS_DIR=%BASE_DIR%android\app\src\main\assets
if not exist "%ASSETS_DIR%" mkdir "%ASSETS_DIR%"
if exist "%ASSETS_DIR%\index.android.bundle" del /f "%ASSETS_DIR%\index.android.bundle" 2>nul

echo [INFO] Ejecutando react-native bundle...
echo [INFO] Generando bundle explicito para evitar 'undefined is not a function'...

call npx react-native bundle ^
    --platform android ^
    --dev false ^
    --entry-file node_modules/expo/AppEntry.js ^
    --bundle-output "%ASSETS_DIR%\index.android.bundle" ^
    --assets-dest "%BASE_DIR%android\app\src\main\res" ^
    --reset-cache

if %ERRORLEVEL% NEQ 0 (
    echo [WARN] Fallo primer intento, probando con index.js...
    call npx react-native bundle ^
        --platform android ^
        --dev false ^
        --entry-file index.js ^
        --bundle-output "%ASSETS_DIR%\index.android.bundle" ^
        --assets-dest "%BASE_DIR%android\app\src\main\res" ^
        --reset-cache
        
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] No se pudo generar el bundle
        exit /b 1
    )
)
exit /b 0

:show_apk
set APK_RELEASE=%BASE_DIR%android\app\build\outputs\apk\release\app-release.apk
set APK_UNSIGNED=%BASE_DIR%android\app\build\outputs\apk\release\app-release-unsigned.apk

if exist "%APK_RELEASE%" (
    echo [OK] APK: %APK_RELEASE%
) else if exist "%APK_UNSIGNED%" (
    echo [OK] APK (sin firmar): %APK_UNSIGNED%
) else (
    echo [INFO] APK generada en android\app\build\outputs\apk\release\
)
goto end

:end
echo.
echo Presiona cualquier tecla para salir...
pause >nul
exit /b 0
