# Script limpieza simple
Write-Host "Limpiando proyecto..."
if (Test-Path "android") { Remove-Item "android" -Recurse -Force }
if (Test-Path "ios") { Remove-Item "ios" -Recurse -Force }
if (Test-Path "node_modules") { Remove-Item "node_modules" -Recurse -Force }
if (Test-Path "package-lock.json") { Remove-Item "package-lock.json" -Force }
if (Test-Path ".expo") { Remove-Item ".expo" -Recurse -Force }

Write-Host "Limpiando cache npm..."
npm cache clean --force

Write-Host "Instalando dependencias..."
npm install

Write-Host "Listo!"





