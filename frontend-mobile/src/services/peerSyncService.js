/**
 * peerSyncService.js
 * ------------------
 * Servicio de sincronización peer-to-peer (Wi-Fi / WebSocket).
 *
 * ARQUITECTURA:
 *  - HOST        -> Abre un servidor HTTP en el puerto 5001 y genera un PIN de 6 digitos.
 *  - COLABORADOR -> Descubre el host por MDNS (_invcolab._tcp), ingresa el PIN,
 *                   recibe el token de sesion y envia su listado de inventario via WS.
 *
 * DEPENDENCIAS NATIVAS (instalar si no estan):
 *  - react-native-zeroconf    -> npm install react-native-zeroconf
 *  - react-native-http-server -> npm install react-native-http-server
 *  - @react-native-community/netinfo (ya instalada)
 *
 * USO - HOST:
 *   const { pin } = await peerSyncService.startHostServer();
 *   peerSyncService.onInventoryReceived((list) => { ... });
 *   await peerSyncService.stopHostServer();
 *
 * USO - COLABORADOR:
 *   const hosts = await peerSyncService.discoverHosts();
 *   await peerSyncService.connectToHost(hosts[0], '123456');
 *   await peerSyncService.sendInventory(myProducts);
 *   peerSyncService.disconnect();
 */

import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

// -----------------------------------------------------------------------
// Constantes
// -----------------------------------------------------------------------
const PEER_PORT = 5001;
const SERVICE_TYPE = '_invcolab._tcp.';
const SERVICE_NAME = 'InvColabHost';
const WS_TIMEOUT_MS = 15000;

// -----------------------------------------------------------------------
// Estado interno
// -----------------------------------------------------------------------
let _hostServer = null;
let _hostPin = null;
let _hostSessionToken = null;
let _collaboratorWs = null;
let _zeroconf = null;
let _onInventoryReceived = null;

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------
function generatePin() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

function generateSessionToken() {
    return 'peer-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
}

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
// HOST: Iniciar / Detener servidor
// -----------------------------------------------------------------------

/**
 * Inicia el servidor HTTP del host en el puerto 5001.
 * @returns {Promise<{pin: string, port: number, ip: string|null}>}
 */
async function startHostServer() {
    if (_hostServer) {
        console.log('[PeerSync] Servidor ya activo, PIN:', _hostPin);
        return { pin: _hostPin, port: PEER_PORT, ip: await getLocalIp() };
    }

    _hostPin = generatePin();
    _hostSessionToken = generateSessionToken();

    try {
        let HttpServer;
        try {
            HttpServer = require('react-native-http-server').default
                || require('react-native-http-server');
        } catch (_) {
            // En desarrollo sin el modulo nativo: usar mock
            console.warn('[PeerSync] react-native-http-server no instalado. Mock activo en DEV.');
            _hostServer = { stop: () => {} };
            console.log('[PeerSync] Servidor MOCK iniciado – PIN:', _hostPin);
            await _registerMdnsService();
            return { pin: _hostPin, port: PEER_PORT, ip: await getLocalIp() };
        }

        _hostServer = new HttpServer({ port: PEER_PORT });

        _hostServer.listen((request, response) => {
            const { url, method, postData } = request;

            // POST /auth/pin -> valida el PIN y devuelve token
            if (url === '/auth/pin' && method === 'POST') {
                let body = {};
                try { body = JSON.parse(postData); } catch (_) {}

                if (body.pin === _hostPin) {
                    response.send(200, 'application/json', JSON.stringify({
                        exito: true,
                        accessToken: _hostSessionToken,
                        message: 'PIN valido',
                    }));
                } else {
                    response.send(401, 'application/json', JSON.stringify({
                        exito: false,
                        message: 'PIN invalido',
                    }));
                }
                return;
            }

            // GET /health -> latido
            if (url === '/health' && method === 'GET') {
                response.send(200, 'application/json', JSON.stringify({
                    status: 'ok', service: SERVICE_NAME,
                }));
                return;
            }

            response.send(404, 'application/json', JSON.stringify({ message: 'Not found' }));
        });

        await _registerMdnsService();
        const ip = await getLocalIp();
        console.log('[PeerSync] Servidor iniciado –', ip + ':' + PEER_PORT, '| PIN:', _hostPin);
        return { pin: _hostPin, port: PEER_PORT, ip };

    } catch (e) {
        console.error('[PeerSync] Error al iniciar servidor:', e.message);
        _hostServer = null;
        _hostPin = null;
        throw e;
    }
}

/**
 * Detiene el servidor del host y elimina el registro MDNS.
 */
async function stopHostServer() {
    try {
        await _unregisterMdnsService();
        if (_hostServer) {
            _hostServer.stop();
            _hostServer = null;
        }
        _hostPin = null;
        _hostSessionToken = null;
        console.log('[PeerSync] Servidor detenido.');
    } catch (e) {
        console.warn('[PeerSync] Error al detener servidor:', e.message);
    }
}

/**
 * Registra un callback que se llama cuando el host recibe inventario del colaborador.
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
// MDNS
// -----------------------------------------------------------------------
async function _registerMdnsService() {
    try {
        const Zeroconf = require('react-native-zeroconf').default
            || require('react-native-zeroconf');
        if (!_zeroconf) _zeroconf = new Zeroconf();
        _zeroconf.registerService(SERVICE_TYPE, SERVICE_NAME, PEER_PORT, {});
        console.log('[PeerSync] MDNS registrado:', SERVICE_NAME);
    } catch (e) {
        console.warn('[PeerSync] MDNS no disponible:', e.message);
    }
}

async function _unregisterMdnsService() {
    try {
        if (_zeroconf) {
            _zeroconf.removeDeviceListeners();
            _zeroconf.stop();
            _zeroconf = null;
        }
    } catch (e) {
        console.warn('[PeerSync] Error al detener MDNS:', e.message);
    }
}

/**
 * Descubre hosts activos en la red local via MDNS.
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
                        name: service.name,
                        host: service.addresses[0],
                        port: service.port || PEER_PORT,
                        addresses: service.addresses,
                    });
                    console.log('[PeerSync] Host encontrado:', service.addresses[0]);
                }
            });

            zc.on('error', (err) => console.warn('[PeerSync] Error MDNS:', err.message));
            zc.scan(SERVICE_TYPE);

            setTimeout(() => { zc.stop(); resolve(hosts); }, timeoutMs);

        } catch (e) {
            console.warn('[PeerSync] MDNS no disponible:', e.message);
            resolve([]);
        }
    });
}

// -----------------------------------------------------------------------
// COLABORADOR: Conectar y enviar inventario
// -----------------------------------------------------------------------

/**
 * Conecta al host usando su IP y PIN.
 * 1. Valida el PIN via HTTP y obtiene un token.
 * 2. Abre una conexion WebSocket autenticada.
 *
 * @param {{host: string, port?: number}} hostInfo
 * @param {string} pin - PIN de 6 digitos
 * @returns {Promise<{token: string}>}
 */
async function connectToHost(hostInfo, pin) {
    const { host, port = PEER_PORT } = hostInfo;
    const baseUrl = 'http://' + host + ':' + port;

    // 1. Validar PIN
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), WS_TIMEOUT_MS);
    let json;
    try {
        const res = await fetch(baseUrl + '/auth/pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin }),
            signal: controller.signal,
        });
        json = await res.json();
        if (!res.ok || !json?.exito) {
            throw new Error(json?.message || 'PIN invalido o host no disponible');
        }
    } finally {
        clearTimeout(timeoutId);
    }

    const token = json.accessToken;

    // 2. Abrir WebSocket
    await _openCollaboratorWs('ws://' + host + ':' + port + '/ws', token);
    console.log('[PeerSync] Conectado al host', host + ':' + port);
    return { token };
}

function _openCollaboratorWs(wsUrl, token) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('Timeout al conectar WebSocket con el host'));
        }, WS_TIMEOUT_MS);

        try {
            _collaboratorWs = new WebSocket(wsUrl, [], {
                headers: { Authorization: 'Bearer ' + token },
            });

            _collaboratorWs.onopen = () => {
                clearTimeout(timeout);
                console.log('[PeerSync] WebSocket abierto con host');
                resolve();
            };

            _collaboratorWs.onerror = (e) => {
                clearTimeout(timeout);
                reject(new Error(e.message || 'Error de WebSocket'));
            };

            _collaboratorWs.onclose = () => {
                console.log('[PeerSync] WebSocket cerrado');
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
 * Envia el listado de inventario al host via WebSocket.
 * @param {Array<object>} inventoryList
 */
async function sendInventory(inventoryList) {
    if (!_collaboratorWs || _collaboratorWs.readyState !== WebSocket.OPEN) {
        throw new Error('No hay conexion WebSocket activa con el host');
    }
    _collaboratorWs.send(JSON.stringify({
        type: 'send_inventory',
        inventory: inventoryList,
        timestamp: new Date().toISOString(),
        platform: Platform.OS,
    }));
    console.log('[PeerSync] Inventario enviado:', inventoryList.length, 'items');
}

/**
 * Cierra la conexion WebSocket del colaborador.
 */
function disconnect() {
    if (_collaboratorWs) {
        _collaboratorWs.close();
        _collaboratorWs = null;
    }
    console.log('[PeerSync] Desconectado del host.');
}

/**
 * Estado actual del servicio.
 */
function getStatus() {
    return {
        isHostRunning: !!_hostServer,
        isConnectedToHost: !!_collaboratorWs
            && _collaboratorWs.readyState === WebSocket.OPEN,
        hostPin: _hostPin,
    };
}

// -----------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------
const peerSyncService = {
    startHostServer,
    stopHostServer,
    onInventoryReceived,
    discoverHosts,
    connectToHost,
    sendInventory,
    disconnect,
    getStatus,
    getLocalIp,
    PEER_PORT,
};

export default peerSyncService;
