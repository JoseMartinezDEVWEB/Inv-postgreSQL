/**
 * peerSyncService.js
 * ------------------
 * Servicio de sincronizacion peer-to-peer via Wi-Fi.
 *
 * ARQUITECTURA (sin modulos nativos de servidor HTTP):
 *  - HOST        -> Genera un PIN de 6 digitos + muestra su IP local.
 *                   Valida conexiones entrantes del colaborador via el
 *                   backend en la nube O via un WebSocket dedicado (cuando
 *                   ambos dispositivos estan en la misma LAN).
 *  - COLABORADOR -> Ingresa la IP del host + PIN, valida, y envia
 *                   el inventario via WebSocket o fetch directo.
 *
 * DEPENDENCIAS: Solo @react-native-community/netinfo (ya instalada).
 * react-native-zeroconf se usa opcionalmente para descubrimiento automatico.
 *
 * NOTA: El servidor HTTP del host se implementa usando el WebSocket
 * existente del backend (modo online) o via conexion directa LAN.
 * Para el modo LAN puro usamos un simple ping HTTP con fetch().
 */

import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

// -----------------------------------------------------------------------
// Constantes
// -----------------------------------------------------------------------
export const PEER_PORT = 5001;
const WS_TIMEOUT_MS = 15000;
const PIN_TTL_MS = 10 * 60 * 1000; // PIN valido por 10 minutos
const STORAGE_KEY_PIN = 'peer_sync_pin';
const STORAGE_KEY_TOKEN = 'peer_sync_token';

// -----------------------------------------------------------------------
// Estado interno
// -----------------------------------------------------------------------
let _hostPin = null;
let _hostToken = null;
let _hostPinExpiry = null;
let _collaboratorWs = null;
let _onInventoryReceived = null;

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------
function generatePin() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

function generateToken() {
    return 'peer-' + Date.now() + '-' + Math.random().toString(36).slice(2, 12);
}

/**
 * Obtiene la IP local del dispositivo en la red Wi-Fi.
 * @returns {Promise<string|null>}
 */
async function getLocalIp() {
    try {
        const state = await NetInfo.fetch();
        return state?.details?.ipAddress || null;
    } catch (e) {
        console.warn('[PeerSync] No se pudo obtener IP local:', e.message);
        return null;
    }
}

// -----------------------------------------------------------------------
// HOST: Generar PIN y token de sesion
// -----------------------------------------------------------------------

/**
 * Genera un PIN de 6 digitos y un token de sesion para el host.
 * El colaborador necesita la IP del host (mostrada en pantalla) + este PIN.
 *
 * @returns {Promise<{pin: string, token: string, ip: string|null, port: number, expiresAt: number}>}
 */
async function startHostServer() {
    _hostPin = generatePin();
    _hostToken = generateToken();
    _hostPinExpiry = Date.now() + PIN_TTL_MS;

    // Persistir para que sobreviva reinicios de pantalla
    await AsyncStorage.setItem(STORAGE_KEY_PIN, JSON.stringify({
        pin: _hostPin,
        token: _hostToken,
        expiresAt: _hostPinExpiry,
    }));

    const ip = await getLocalIp();
    console.log('[PeerSync] HOST iniciado – IP:', ip, '| PIN:', _hostPin, '| Puerto:', PEER_PORT);

    return {
        pin: _hostPin,
        token: _hostToken,
        ip,
        port: PEER_PORT,
        expiresAt: _hostPinExpiry,
    };
}

/**
 * Detiene el modo host y limpia el PIN.
 */
async function stopHostServer() {
    _hostPin = null;
    _hostToken = null;
    _hostPinExpiry = null;
    await AsyncStorage.removeItem(STORAGE_KEY_PIN);
    console.log('[PeerSync] HOST detenido.');
}

/**
 * Valida un PIN entrante (usado en el lado host para verificar al colaborador).
 * @param {string} pin
 * @returns {{valid: boolean, token?: string}}
 */
function validatePin(pin) {
    if (!_hostPin || !_hostToken) return { valid: false };
    if (Date.now() > _hostPinExpiry) return { valid: false, expired: true };
    if (pin !== _hostPin) return { valid: false };
    return { valid: true, token: _hostToken };
}

/**
 * Registra un callback que se llama cuando el host recibe inventario.
 * @param {function(Array): void} callback
 */
function onInventoryReceived(callback) {
    _onInventoryReceived = callback;
}

function _handleIncomingInventory(data) {
    try {
        const payload = typeof data === 'string' ? JSON.parse(data) : data;
        if (payload?.type === 'send_inventory' && Array.isArray(payload.inventory)) {
            console.log('[PeerSync] Inventario recibido:', payload.inventory.length, 'items');
            if (_onInventoryReceived) _onInventoryReceived(payload.inventory);
        }
    } catch (e) {
        console.warn('[PeerSync] Error procesando inventario:', e.message);
    }
}

// -----------------------------------------------------------------------
// Descubrimiento (MDNS opcional)
// -----------------------------------------------------------------------

/**
 * Intenta descubrir hosts via MDNS (react-native-zeroconf).
 * Si el modulo no esta disponible, retorna lista vacia.
 * El usuario puede ingresar la IP manualmente como alternativa.
 *
 * @param {number} [timeoutMs=5000]
 * @returns {Promise<Array<{name: string, host: string, port: number}>>}
 */
async function discoverHosts(timeoutMs = 5000) {
    return new Promise((resolve) => {
        const hosts = [];
        try {
            const Zeroconf = require('react-native-zeroconf').default
                || require('react-native-zeroconf');
            const zc = new Zeroconf();

            zc.on('resolved', (service) => {
                if (service?.addresses?.length) {
                    hosts.push({
                        name: service.name || 'Host',
                        host: service.addresses[0],
                        port: service.port || PEER_PORT,
                        addresses: service.addresses,
                    });
                    console.log('[PeerSync] Host encontrado via MDNS:', service.addresses[0]);
                }
            });

            zc.on('error', (err) => console.warn('[PeerSync] MDNS error:', err.message));
            zc.scan('_invcolab._tcp.');
            setTimeout(() => { try { zc.stop(); } catch (_) {} resolve(hosts); }, timeoutMs);

        } catch (e) {
            // MDNS no disponible — el usuario debe ingresar la IP manualmente
            console.info('[PeerSync] MDNS no disponible, usar IP manual.');
            resolve([]);
        }
    });
}

// -----------------------------------------------------------------------
// COLABORADOR: Conectar al host y enviar inventario
// -----------------------------------------------------------------------

/**
 * Verifica que el host en hostInfo esta activo haciendo ping HTTP.
 * @param {{host: string, port?: number}} hostInfo
 * @returns {Promise<boolean>}
 */
async function pingHost(hostInfo) {
    const { host, port = PEER_PORT } = hostInfo;
    try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 5000);
        const res = await fetch('http://' + host + ':' + port + '/peer/health', {
            signal: ctrl.signal,
        });
        clearTimeout(tid);
        return res.ok;
    } catch (_) {
        return false;
    }
}

/**
 * Conecta el colaborador al host usando PIN.
 *
 * Flujo:
 *  1. POST http://{host}:{port}/peer/auth  { pin }  -> { token }
 *  2. Abre WebSocket ws://{host}:{port}/peer/ws con token en header
 *
 * @param {{host: string, port?: number}} hostInfo
 * @param {string} pin
 * @returns {Promise<{token: string}>}
 */
async function connectToHost(hostInfo, pin) {
    const { host, port = PEER_PORT } = hostInfo;
    const baseUrl = 'http://' + host + ':' + port;

    // Validar PIN via HTTP
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), WS_TIMEOUT_MS);
    let json;
    try {
        const res = await fetch(baseUrl + '/peer/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin }),
            signal: ctrl.signal,
        });
        json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.exito) {
            throw new Error(json?.message || 'PIN invalido o host no disponible');
        }
    } finally {
        clearTimeout(tid);
    }

    const token = json.accessToken || json.token;

    // Abrir WebSocket autenticado
    await _openCollaboratorWs('ws://' + host + ':' + port + '/peer/ws', token);
    console.log('[PeerSync] Conectado al host', host + ':' + port);

    // Guardar token localmente
    await AsyncStorage.setItem(STORAGE_KEY_TOKEN, token);
    return { token };
}

function _openCollaboratorWs(wsUrl, token) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('Timeout al conectar WebSocket con el host'));
        }, WS_TIMEOUT_MS);

        try {
            // Hermes/RN acepta WebSocket nativo sin modulos extra
            _collaboratorWs = new WebSocket(wsUrl + '?token=' + encodeURIComponent(token));

            _collaboratorWs.onopen = () => {
                clearTimeout(timeout);
                console.log('[PeerSync] WS abierto');
                resolve();
            };

            _collaboratorWs.onerror = (e) => {
                clearTimeout(timeout);
                reject(new Error(e.message || 'Error de WebSocket'));
            };

            _collaboratorWs.onclose = () => {
                console.log('[PeerSync] WS cerrado');
                _collaboratorWs = null;
            };

            _collaboratorWs.onmessage = (e) => _handleIncomingInventory(e.data);

        } catch (e) {
            clearTimeout(timeout);
            reject(e);
        }
    });
}

/**
 * Envia el inventario al host.
 * Si no hay WS activo, intenta via HTTP POST como alternativa.
 *
 * @param {Array<object>} inventoryList
 * @param {{host?: string, port?: number}} [hostInfo] - Requerido si no hay WS activo
 */
async function sendInventory(inventoryList, hostInfo) {
    const payload = JSON.stringify({
        type: 'send_inventory',
        inventory: inventoryList,
        timestamp: new Date().toISOString(),
        platform: Platform.OS,
    });

    // Preferir WebSocket si esta abierto
    if (_collaboratorWs && _collaboratorWs.readyState === WebSocket.OPEN) {
        _collaboratorWs.send(payload);
        console.log('[PeerSync] Inventario enviado via WS:', inventoryList.length, 'items');
        return;
    }

    // Fallback: HTTP POST directo al host
    if (hostInfo?.host) {
        const { host, port = PEER_PORT } = hostInfo;
        const token = await AsyncStorage.getItem(STORAGE_KEY_TOKEN);
        const res = await fetch('http://' + host + ':' + port + '/peer/inventory', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: 'Bearer ' + token } : {}),
            },
            body: payload,
        });
        if (!res.ok) throw new Error('Error al enviar inventario via HTTP: ' + res.status);
        console.log('[PeerSync] Inventario enviado via HTTP:', inventoryList.length, 'items');
        return;
    }

    throw new Error('No hay conexion activa con el host. Conecta primero.');
}

/**
 * Cierra la conexion con el host.
 */
function disconnect() {
    if (_collaboratorWs) {
        _collaboratorWs.close();
        _collaboratorWs = null;
    }
    AsyncStorage.removeItem(STORAGE_KEY_TOKEN).catch(() => {});
    console.log('[PeerSync] Desconectado del host.');
}

/**
 * Estado actual del servicio.
 */
function getStatus() {
    return {
        isHostActive: !!_hostPin && Date.now() < (_hostPinExpiry || 0),
        isConnectedToHost: !!_collaboratorWs && _collaboratorWs.readyState === WebSocket.OPEN,
        hostPin: _hostPin,
        hostPinExpiresIn: _hostPinExpiry ? Math.max(0, _hostPinExpiry - Date.now()) : 0,
    };
}

// -----------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------
const peerSyncService = {
    // HOST
    startHostServer,
    stopHostServer,
    validatePin,
    onInventoryReceived,
    // COLABORADOR
    discoverHosts,
    pingHost,
    connectToHost,
    sendInventory,
    disconnect,
    // COMPARTIDO
    getStatus,
    getLocalIp,
    PEER_PORT,
};

export default peerSyncService;
