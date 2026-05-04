/**
 * Configuracion de entorno para la aplicacion movil
 * MODO HIBRIDO: Funciona con backend local (PostgreSQL) y sin internet (SQLite local)
 * NOTA: El backend en Render (appj4-hlqj.onrender.com) está DEPRECADO y eliminado.
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';

// =============================================
// CONFIGURACION DEL BACKEND LOCAL
// =============================================
// Si quieres apuntar a una IP manual (sin auto-detección):
// Ejemplo: '192.168.1.100'
const CUSTOM_BACKEND_IP = null;
// Puerto estándar del backend Node.js+PostgreSQL
const CUSTOM_BACKEND_PORT = '4501';
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
const buildLocalBackendUrl = (ip, port = '4501') => {
  if (!ip) return null;
  const cleanIp = ip.replace(/^https?:\/\//, '');
  return `http://${cleanIp}:${port}/api`;
};

// Funcion para resolver la URL de la API (solo red local, sin Render)
export const resolveApiBaseUrl = () => {
  // 1. Prioridad: IP Personalizada manual configurada por el usuario
  if (CUSTOM_BACKEND_IP) {
    const customUrl = buildLocalBackendUrl(CUSTOM_BACKEND_IP, CUSTOM_BACKEND_PORT);
    console.log('   Usando backend personalizado:', customUrl);
    return customUrl;
  }

  // 2. Auto-detección de IP LAN vía Expo (desarrollo)
  const debuggerHost = Constants.expoConfig?.hostUri;
  const lanIp = debuggerHost ? debuggerHost.split(':')[0] : null;

  if (lanIp && lanIp !== 'localhost' && lanIp !== '127.0.0.1') {
    const lanUrl = `http://${lanIp}:${CUSTOM_BACKEND_PORT}/api`;
    console.log('   Auto-detectado LAN:', lanUrl);
    return lanUrl;
  }

  // 3. Fallback: localhost (el usuario deberá configurar la IP manualmente
  //    desde ConfiguracionScreen si el auto-detect falla)
  const fallbackUrl = `http://localhost:${CUSTOM_BACKEND_PORT}/api`;
  console.log('   Fallback a localhost (configurar IP manualmente):', fallbackUrl);
  return fallbackUrl;
};

// Funcion para resolver URL de WebSocket (ws:// para red local, sin SSL)
export const resolveWebSocketUrl = () => {
  const apiUrl = resolveApiBaseUrl();
  // Usar ws:// en red local (no wss:// que requiere certificado SSL)
  const wsUrl = apiUrl
    .replace('https://', 'wss://')
    .replace('http://', 'ws://')
    .replace('/api', '');
  console.log('\u2705 WebSocket URL (red local):', wsUrl);
  return wsUrl;
};

// Verificar conectividad con el backend
// apiUrlOverride: URL a verificar (opcional). Si no se provee, usa la URL actual.
export const checkBackendConnectivity = async (timeout = 5000, apiUrlOverride = null) => {
  const apiUrl = apiUrlOverride || resolveApiBaseUrl();

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
  // cloudApiUrl eliminado — el backend Render/MongoDB está deprecado

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
