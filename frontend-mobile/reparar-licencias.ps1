# Script para forzar la aceptacion de licencias de Android SDK
# Uso: powershell -ExecutionPolicy Bypass -File reparar-licencias.ps1

$licenciasDir = "$env:LOCALAPPDATA\Android\Sdk\licenses"
if (!(Test-Path $licenciasDir)) {
    New-Item -ItemType Directory -Path $licenciasDir -Force
}

# Lista de hashes conocidos (incluye NDK 26, SDK 34, etc.)
$hashes = @(
    "8933bad161af4178b1185d1a37fbf41ea5269c55",
    "d89816181597448a33d97c765a65e5339f40775d",
    "24333f8a63b6b1251d3828c5083aa5dfe5b10565",
    "24333f8a63b6825ea9c5514f83c2829b004d1fee",
    "c70a5444f153240e34b80267f81525a774135e5d",
    "e9acabf393f9c6b7385966453965585ad8db474a",
    "3357aedc30b2e88a38ae33b708ce12b934b1509a",
    "211d6934a34b6b66e857147b4e945c55be027725"
)

# Archivos de licencia a generar
$archivos = @(
    "android-sdk-license",
    "android-ndk-license",
    "android-sdk-preview-license",
    "android-googledk-license",
    "android-googletv-license",
    "google-gdk-license",
    "mips-android-sysimage-license",
    "android-sdk-arm-dbt-license"
)

Write-Host "Reparando licencias en: $licenciasDir" -ForegroundColor Cyan

foreach ($archivo in $archivos) {
    $rutaFinal = Join-Path $licenciasDir $archivo
    # Unir hashes con saltos de linea y guardar como ASCII (importante)
    $contenido = $hashes -join "`n"
    [System.IO.File]::WriteAllText($rutaFinal, $contenido, [System.Text.Encoding]::ASCII)
    Write-Host "Generado: $archivo" -ForegroundColor Green
}

Write-Host "`nLicencias inyectadas con exito." -ForegroundColor Cyan
