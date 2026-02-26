@echo off
REM Script para limpiar completamente y reinstalar la app mobile

echo.
echo ====================================================================
echo   LIMPIEZA COMPLETA - J4 Pro Mobile
echo ====================================================================
echo.

REM Limpiar npm cache
echo [1/4] Limpiando cache de npm...
call npm cache clean --force

REM Remover node_modules
echo [2/4] Removiendo node_modules...
if exist node_modules (
  rmdir /s /q node_modules
  echo     ✓ node_modules removido
) else (
  echo     ℹ No hay node_modules que remover
)

REM Remover package-lock.json
echo [3/4] Removiendo package-lock.json...
if exist package-lock.json (
  del package-lock.json
  echo     ✓ package-lock.json removido
) else (
  echo     ℹ No hay package-lock.json que remover
)

REM Reinstalar dependencias
echo [4/4] Reinstalando dependencias (esto puede tomar varios minutos)...
call npm install

echo.
echo ====================================================================
echo   ✓ LIMPIEZA COMPLETADA
echo ====================================================================
echo.
echo PRÓXIMO PASO:
echo   npx expo start --clear
echo.
pause



