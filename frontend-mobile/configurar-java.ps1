# Script para configurar Java 17 (desde Android Studio) como predeterminado

$JavaPath = "C:\Program Files\Android\Android Studio\jbr"

Write-Host "Configurando JAVA_HOME a: $JavaPath"

# 1. Establecer variable de entorno JAVA_HOME para el usuario actual
[System.Environment]::SetEnvironmentVariable("JAVA_HOME", $JavaPath, [System.EnvironmentVariableTarget]::User)

# 2. Agregar %JAVA_HOME%\bin al Path del usuario si no existe
$CurrentPath = [System.Environment]::GetEnvironmentVariable("Path", [System.EnvironmentVariableTarget]::User)
if ($CurrentPath -notlike "*%JAVA_HOME%\bin*") {
    $NewPath = "$CurrentPath;%JAVA_HOME%\bin"
    [System.Environment]::SetEnvironmentVariable("Path", $NewPath, [System.EnvironmentVariableTarget]::User)
    Write-Host "Path actualizado."
} else {
    Write-Host "Path ya incluye JAVA_HOME."
}

Write-Host "✅ Configuración completada."
Write-Host "Por favor, REINICIA tu terminal (cierra y abre VS Code) para que los cambios surtan efecto."
Write-Host "Luego verifica escribiendo: java -version"
