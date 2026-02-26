/**
 * Configuracion de entorno para la aplicacion movil
 * MODO HIBRIDO: Funciona con internet (backend) y sin internet (SQLite local)
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';

// =============================================
// CONFIGURACION DEL BACKEND
// =============================================
// URL del backend en la nube (Render) - Backend principal
const CLOUD_API_URL = 'https://appj4-hlqj.onrender.com/api';

// Si quieres usar un backend LOCAL en vez de la nube, configura aqui:
// (Dejar en null para usar la nube o detectar automaticamente)
const CUSTOM_BACKEND_IP = null;  // Ejemplo: '192.168.1.100'
// Puerto estándar para el backend PostgreSQL
const CUSTOM_BACKEND_PORT = '4000';
// =============================================

// Funcion para detectar tipo de dispositivo
const detectDeviceType = () => {
  if (Platform.OS === 'android') {
    return Constants.isDevice ? 'physical-android' : 'emulator-android';
  } else if (Platform.OS === 'ios') {
    return Constants.isDevice ? 'physical-ios' : 'simulator-ios';
  }
  return 'unknown';
};

// Funcion para detectar si es build de produccion
const isProductionBuild = () => {
  return !__DEV__;
};

// Funcion para construir URL de backend local
const buildLocalBackendUrl = (ip, port = '4000') => {
  if (!ip) return null;
  const cleanIp = ip.replace(/^https?:\/\//, '');
  return `http://${cleanIp}:${port}/api`;
};

// Funcion para resolver la URL de la API
export const resolveApiBaseUrl = () => {
  const extra = Constants.expoConfig?.extra ?? {};
  const endpoints = extra.API_ENDPOINTS ?? {};
  const deviceType = detectDeviceType();
  const isProduction = isProductionBuild();

  console.log('🔧 Configuracion de API:');
  console.log('   Dispositivo:', deviceType);
  console.log('   Produccion:', isProduction);

  // 1. Prioridad: IP Personalizada manual
  if (CUSTOM_BACKEND_IP) {
    const customUrl = buildLocalBackendUrl(CUSTOM_BACKEND_IP, CUSTOM_BACKEND_PORT);
    console.log('   Usando backend personalizado:', customUrl);
    return customUrl;
  }

  // 2. Producción: Usar nube
  if (isProduction) {
    console.log('✅ Modo PRODUCCION - Backend en la nube');
    return CLOUD_API_URL;
  }

  // 3. Desarrollo: Detectar entorno
  // Intenta usar la IP de la máquina de desarrollo (LAN) si está disponible en Constants
  const debuggerHost = Constants.expoConfig?.hostUri;
  const lanIp = debuggerHost ? debuggerHost.split(':')[0] : null;

  if (lanIp && lanIp !== 'localhost' && lanIp !== '127.0.0.1') {
    const lanUrl = `http://${lanIp}:${CUSTOM_BACKEND_PORT}/api`;
    console.log('💻 Modo DESARROLLO (LAN) - Detectado:', lanUrl);
    return lanUrl;
  }

  // Fallback a endpoints configurados o nube
  const devUrl = endpoints.lan ||
    endpoints.emulator ||
    endpoints.local ||
    CLOUD_API_URL;

  console.log('💻 Modo DESARROLLO - URL:', devUrl);
  return devUrl;
};

// Funcion para resolver URL de WebSocket
export const resolveWebSocketUrl = () => {
  const apiUrl = resolveApiBaseUrl();
  const wsUrl = apiUrl.replace('/api', '');
  console.log('✅ WebSocket URL:', wsUrl);
  return wsUrl;
};

// Verificar conectividad con el backend
export const checkBackendConnectivity = async (timeout = 5000) => {
  const apiUrl = resolveApiBaseUrl();

  try {
    console.log('🔍 Verificando conectividad con:', `${apiUrl}/salud`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(`${apiUrl}/salud`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Backend CONECTADO');
      return { connected: true, data };
    } else {
      console.log('⚠️ Backend respondio con error:', response.status);
      return { connected: false, error: `HTTP ${response.status}` };
    }
  } catch (error) {
    console.log('📴 Sin conexion al backend:', error.message);
    return { connected: false, error: error.message };
  }
};

// Estado de conexion global (se actualiza dinamicamente)
let _isOnline = true;

export const setOnlineStatus = (status) => {
  _isOnline = status;
  console.log(_isOnline ? '🌐 ONLINE - Usando backend' : '📴 OFFLINE - Usando SQLite local');
};

export const isOnline = () => _isOnline;

// Funcion para obtener info de configuracion (debugging)
export const getConfigInfo = () => ({
  apiUrl: resolveApiBaseUrl(),
  wsUrl: resolveWebSocketUrl(),
  cloudUrl: CLOUD_API_URL,
  customBackendIP: CUSTOM_BACKEND_IP,
  isProduction: isProductionBuild(),
  deviceType: detectDeviceType(),
  platform: Platform.OS,
});

// Configuracion exportada
export const config = {
  // URLs
  apiUrl: resolveApiBaseUrl(),
  wsUrl: resolveWebSocketUrl(),
  cloudApiUrl: CLOUD_API_URL,

  // Estado
  isOffline: false,
  isProduction: isProductionBuild(),
  deviceType: detectDeviceType(),
  platform: Platform.OS,

  // Info de la app
  appName: Constants.expoConfig?.name || 'Gestor de Inventario J4 Pro',
  appVersion: Constants.expoConfig?.version || '2.0.0',

  // MODO STANDALONE (Local)
  useLocalDbOnly: true, // Forzar uso de DB local siempre

  // Funciones
  checkConnectivity: checkBackendConnectivity,
  isOnline,
  setOnlineStatus,
};

export default config;
