#!/bin/bash

# Script para limpiar completamente y reinstalar la app mobile

echo ""
echo "===================================================================="
echo "   LIMPIEZA COMPLETA - J4 Pro Mobile"
echo "===================================================================="
echo ""

# Limpiar npm cache
echo "[1/4] Limpiando cache de npm..."
npm cache clean --force

# Remover node_modules
echo "[2/4] Removiendo node_modules..."
if [ -d "node_modules" ]; then
  rm -rf node_modules
  echo "     ✓ node_modules removido"
else
  echo "     ℹ No hay node_modules que remover"
fi

# Remover package-lock.json
echo "[3/4] Removiendo package-lock.json..."
if [ -f "package-lock.json" ]; then
  rm package-lock.json
  echo "     ✓ package-lock.json removido"
else
  echo "     ℹ No hay package-lock.json que remover"
fi

# Reinstalar dependencias
echo "[4/4] Reinstalando dependencias (esto puede tomar varios minutos)..."
npm install

echo ""
echo "===================================================================="
echo "   ✓ LIMPIEZA COMPLETADA"
echo "===================================================================="
echo ""
echo "PRÓXIMO PASO:"
echo "   npx expo start --clear"
echo ""

