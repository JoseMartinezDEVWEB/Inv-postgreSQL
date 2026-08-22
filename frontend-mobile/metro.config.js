const { getDefaultConfig } = require('expo/metro-config');

// Configuración por defecto de Expo/Metro (estable y compatible con EAS Build)
const config = getDefaultConfig(__dirname);

// Limitar número de workers para evitar Out Of Memory en Windows durante gradle build
config.maxWorkers = 2;

module.exports = config;



