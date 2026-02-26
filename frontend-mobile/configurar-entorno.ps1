# Script para configurar el entorno de la app móvil J4 Pro
# Uso: .\configurar-entorno.ps1 -entorno [local|lan|nube]

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('local','lan','nube')]
    [string]$entorno
)

Write-Host "🔧 Configurando app móvil para entorno: $entorno" -ForegroundColor Cyan

switch ($entorno) {
    'local' {
        $url = "http://10.0.2.2:3001/api"
        Write-Host "📱 Configurado para desarrollo local (emulador Android)" -ForegroundColor Green
        Write-Host "   URL: $url" -ForegroundColor Yellow
    }
    'lan' {
        # Obtener IP actual
        $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.InterfaceAlias -like "*Wi-Fi*" -or $_.InterfaceAlias -like "*Ethernet*"} | Select-Object -First 1).IPAddress
        
        if ($ip) {
            $url = "http://${ip}:3001/api"
            Write-Host "📱 Configurado para red local (LAN)" -ForegroundColor Green
            Write-Host "   IP detectada: $ip" -ForegroundColor Yellow
            Write-Host "   URL: $url" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "⚠️  IMPORTANTE: Asegúrate de que:" -ForegroundColor Yellow
            Write-Host "   1. El backend esté corriendo en esta PC" -ForegroundColor White
            Write-Host "   2. El firewall permita conexiones en puerto 3001" -ForegroundColor White
            Write-Host "   3. El dispositivo móvil esté en la misma WiFi" -ForegroundColor White
        } else {
            Write-Host "❌ No se pudo detectar la IP de red" -ForegroundColor Red
            Write-Host "   Ingresa manualmente la IP:" -ForegroundColor Yellow
            $ip = Read-Host "   IP"
            $url = "http://${ip}:3001/api"
        }
    }
    'nube' {
        $url = "https://appj4-hlqj.onrender.com/api"
        Write-Host "📱 Configurado para producción en la nube" -ForegroundColor Green
        Write-Host "   URL: $url" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "⚠️  Asegúrate de que el backend esté desplegado en Render/Railway" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "🔨 Configurando variable de entorno..." -ForegroundColor Cyan
[System.Environment]::SetEnvironmentVariable('EXPO_PUBLIC_API_URL', $url, [System.EnvironmentVariableTarget]::User)

Write-Host "✅ Variable configurada: EXPO_PUBLIC_API_URL=$url" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Próximos pasos:" -ForegroundColor Cyan
Write-Host "   1. Cierra y abre una nueva terminal PowerShell" -ForegroundColor White
Write-Host "   2. Ejecuta: cd frontend-mobile" -ForegroundColor White
Write-Host "   3. Para desarrollo: npx expo start" -ForegroundColor White
Write-Host "   4. Para build: eas build -p android --profile production" -ForegroundColor White
Write-Host ""
Write-Host "🧪 Para verificar la conexión:" -ForegroundColor Cyan
Write-Host "   curl $url/salud" -ForegroundColor White
Write-Host ""
