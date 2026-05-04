@echo off
echo ================================================
echo   CONFIGURAR FIREWALL PARA J4 PRO - PUERTO 4501
echo ================================================
echo.

:: Verificar permisos de administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] Necesitas ejecutar esto como ADMINISTRADOR!
    echo Haz clic derecho en este archivo y selecciona "Ejecutar como administrador"
    pause
    exit /b 1
)

:: Eliminar reglas existentes (4500 y 4501)
echo [1/3] Eliminando reglas antiguas...
netsh advfirewall firewall delete rule name="J4 Pro Backend" >nul 2>&1
netsh advfirewall firewall delete rule name="J4 Pro Backend TCP" >nul 2>&1
netsh advfirewall firewall delete rule name="J4 Pro Backend UDP" >nul 2>&1

:: Crear regla TCP para entrada
echo [2/3] Creando regla TCP en puerto 4501...
netsh advfirewall firewall add rule name="J4 Pro Backend TCP" dir=in action=allow protocol=TCP localport=4501 profile=any enable=yes

:: Crear regla UDP para WebSocket/Discovery
echo [3/3] Creando regla UDP en puerto 4501...
netsh advfirewall firewall add rule name="J4 Pro Backend UDP" dir=in action=allow protocol=UDP localport=4501 profile=any enable=yes

echo.
echo ================================================
echo   LISTO! El firewall ahora permite conexiones
echo   en el puerto 4501 desde cualquier red.
echo ================================================
echo.
echo 1. Reinicia la aplicacion de escritorio
echo 2. Escanea el NUEVO codigo QR
echo.
pause
