@echo off
setlocal EnableDelayedExpansion

:: --- CONFIGURACION DE RUTAS ---
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%PATH%"

echo ===========================================================
echo    INICIANDO COMPILACION DE APK LOCAL - J4 PRO       
echo ===========================================================
echo.

cd /d "%~dp0"

:: --- PASO 1: VERIFICAR LICENCIAS ---
echo [1/4] Verificando licencias de Android SDK...

:: 1. Intentar reparacion masiva via PowerShell (Solucion Definitiva)
if exist "reparar-licencias.ps1" (
    echo [INFO] Ejecutando Reparacion Maestro de licencias...
    powershell -ExecutionPolicy Bypass -File "reparar-licencias.ps1"
)

:: 2. Asegurar que local.properties no tenga espacios traicioneros
if exist "android\local.properties" (
    echo [INFO] Limpiando local.properties...
    powershell -Command "$p = Get-Content 'android\local.properties'; $p -replace '\s+$', '' | Set-Content 'android\local.properties'"
)

:: --- PASO 2: PREBUILD ---
if exist "android" goto :android_exists
echo.
echo [2/4] Generando directorio nativo de Android (Prebuild)...
call npx expo prebuild --platform android --no-install
if %ERRORLEVEL% equ 0 goto :paso_compilacion
echo [ERROR] Fallo el prebuild de Expo.
pause
exit /b 1

:android_exists
echo.
echo [2/4] Directorio Android ya existe. Saltando prebuild.

:paso_compilacion
:: --- PASO 3: COMPILACION ---
echo.
echo [3/4] Preparando entorno de compilacion...
if exist "android" goto :android_dir_ok
echo [ERROR] El directorio 'android' no existe. No se puede compilar.
pause
exit /b 1

:android_dir_ok
cd android
if exist "gradlew.bat" goto :gradlew_ok
echo [ERROR] No se encontro gradlew.bat en el directorio android.
pause
exit /b 1

:gradlew_ok
echo [INFO] Optimizando memoria para compilacion (Metro Node Memory)...
set NODE_OPTIONS=--max-old-space-size=4096

echo [INFO] Limpiando cache de Metro...
call npx expo start -c --no-dev --no-watch < nul > nul 2>&1

echo [INFO] Limpiando cache de Gradle...
call gradlew.bat clean

echo [INFO] Compilando APK Release (esto puede tardar varios minutos)...
call gradlew.bat assembleRelease
if %ERRORLEVEL% neq 0 goto :error_gradle

echo.
echo ===========================================================
echo    APK GENERADA EXITOSAMENTE!                        
echo ===========================================================
echo.
:: Abre la carpeta donde esta la APK
start explorer app\build\outputs\apk\release
goto :fin

:error_gradle
echo.
echo ===========================================================
echo    HUBO UN ERROR EN LA COMPILACION.                  
echo ===========================================================
echo.
echo [SUGERENCIA] Revisa que tengas instalados estos componentes en Android Studio:
echo   - Android SDK Build-Tools
echo   - NDK (Side by side)
echo   - CMake
echo.
pause

:fin
cd ..
exit /b 0
