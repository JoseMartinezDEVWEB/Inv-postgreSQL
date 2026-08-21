/**
 * PinEntryModal.jsx
 * -----------------
 * Modal que permite al colaborador ingresar el PIN de 6 digitos del host
 * para conectarse al servidor local del dispositivo principal via Wi-Fi.
 *
 * USO:
 *   <PinEntryModal
 *     visible={showPinModal}
 *     onClose={() => setShowPinModal(false)}
 *     onConnected={(token, hostInfo) => { ... }}
 *   />
 */

import React, { useState, useRef, useCallback } from 'react';
import {
    Modal,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Alert,
} from 'react-native';
import { showMessage } from 'react-native-flash-message';
import peerSyncService from '../../services/peerSyncService';

const PIN_LENGTH = 6;

/**
 * @param {object} props
 * @param {boolean}  props.visible          - Controla visibilidad del modal.
 * @param {function} props.onClose          - Callback al cerrar sin conectar.
 * @param {function} props.onConnected      - Callback(token, hostInfo) al conectar exitosamente.
 * @param {string}   [props.manualHostIp]   - IP manual del host (omitir para usar MDNS).
 */
export default function PinEntryModal({ visible, onClose, onConnected, manualHostIp }) {
    const [pin, setPin] = useState('');
    const [hostIp, setHostIp] = useState(manualHostIp || '');
    const [step, setStep] = useState('idle'); // 'idle' | 'discovering' | 'connecting' | 'done'
    const [foundHosts, setFoundHosts] = useState([]);
    const [selectedHost, setSelectedHost] = useState(manualHostIp ? { host: manualHostIp, port: peerSyncService.PEER_PORT, name: 'Dispositivo Principal' } : null);
    const [errorMsg, setErrorMsg] = useState('');
    const [mostrarInputManual, setMostrarInputManual] = useState(false);
    const inputRef = useRef(null);

    // ── Limpiar estado al abrir/cerrar ─────────────────────────────────
    const handleClose = useCallback(() => {
        setPin('');
        setHostIp(manualHostIp || '');
        setStep('idle');
        setFoundHosts([]);
        setSelectedHost(null);
        setErrorMsg('');
        setMostrarInputManual(false);
        onClose?.();
    }, [manualHostIp, onClose]);

    // ── PASO 1: Descubrir hosts en la red ──────────────────────────────
    const handleDiscover = useCallback(async () => {
        setErrorMsg('');

        if (manualHostIp || hostIp.trim()) {
            const ipTarget = (hostIp.trim() || manualHostIp).replace(/^https?:\/\//i, '').split(':')[0];
            const manual = { host: ipTarget, port: peerSyncService.PEER_PORT, name: 'Dispositivo Principal' };
            setFoundHosts([manual]);
            setSelectedHost(manual);
            setStep('idle');
            return;
        }

        setStep('discovering');
        try {
            const hosts = await peerSyncService.discoverHosts(4000);
            if (hosts.length === 0) {
                setErrorMsg('No se detectó el dispositivo automáticamente. Ingresa la IP manualmente.');
                setMostrarInputManual(true);
                setStep('idle');
                return;
            }
            setFoundHosts(hosts);
            if (hosts.length >= 1) setSelectedHost(hosts[0]);
            setStep('idle');
        } catch (e) {
            setErrorMsg('No se pudo buscar automáticamente. Ingresa la IP.');
            setMostrarInputManual(true);
            setStep('idle');
        }
    }, [manualHostIp, hostIp]);

    // ── PASO 2: Conectar con PIN ───────────────────────────────────────
    const handleConnect = useCallback(async () => {
        if (!pin || pin.length !== PIN_LENGTH) {
            setErrorMsg('Ingresa el PIN de ' + PIN_LENGTH + ' dígitos mostrado en el dispositivo principal.');
            return;
        }

        let targetHost = selectedHost;
        if (!targetHost && hostIp.trim()) {
            const cleanIp = hostIp.trim().replace(/^https?:\/\//i, '').split(':')[0];
            targetHost = { host: cleanIp, port: peerSyncService.PEER_PORT, name: 'Dispositivo Principal' };
        }

        if (!targetHost) {
            setErrorMsg('Ingresa o selecciona la IP del dispositivo principal.');
            return;
        }

        setErrorMsg('');
        setStep('connecting');
        try {
            const { token } = await peerSyncService.connectToHost(targetHost, pin);
            setStep('done');
            showMessage({ message: 'Conectado al dispositivo principal', type: 'success', duration: 3000 });
            onConnected?.(token, targetHost);
            handleClose();
        } catch (e) {
            setErrorMsg(e.message || 'No se pudo conectar. Verifica que ambos teléfonos estén en el mismo Wi-Fi e intenta de nuevo.');
            setStep('idle');
        }
    }, [pin, selectedHost, hostIp, onConnected, handleClose]);

    const isLoading = step === 'discovering' || step === 'connecting';

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={handleClose}
        >
            <KeyboardAvoidingView
                style={styles.overlay}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <View style={styles.card}>
                    {/* Header */}
                    <Text style={styles.title}>Conectar a dispositivo principal</Text>
                    <Text style={styles.subtitle}>
                        Ingresa el PIN de {PIN_LENGTH} dígitos que aparece en la pantalla del dispositivo principal.
                    </Text>

                    {/* Buscar hosts automáticamente */}
                    {!mostrarInputManual && foundHosts.length === 0 && (
                        <View style={{ marginBottom: 12 }}>
                            <TouchableOpacity
                                style={[styles.btn, styles.btnSecondary]}
                                onPress={handleDiscover}
                                disabled={isLoading}
                            >
                                {step === 'discovering'
                                    ? <ActivityIndicator color="#fff" />
                                    : <Text style={styles.btnText}>Buscar dispositivo en la red</Text>
                                }
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => setMostrarInputManual(true)}
                                style={{ alignItems: 'center', marginTop: 6 }}
                            >
                                <Text style={{ color: '#3b82f6', fontSize: 12, textDecorationLine: 'underline' }}>
                                    Ingresar IP manualmente
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Input manual de IP si se solicita o si falló búsqueda */}
                    {mostrarInputManual && (
                        <View style={{ marginBottom: 12 }}>
                            <Text style={styles.label}>IP del dispositivo principal:</Text>
                            <TextInput
                                style={styles.ipInput}
                                value={hostIp}
                                onChangeText={(t) => {
                                    setHostIp(t);
                                    setErrorMsg('');
                                }}
                                placeholder="Ej: 192.168.1.50"
                                placeholderTextColor="#aaa"
                                keyboardType="url"
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                        </View>
                    )}

                    {/* Lista de hosts encontrados */}
                    {foundHosts.length > 0 && !mostrarInputManual && (
                        <View style={styles.hostList}>
                            <Text style={styles.label}>Dispositivos encontrados:</Text>
                            {foundHosts.map((h, idx) => (
                                <TouchableOpacity
                                    key={idx}
                                    style={[
                                        styles.hostItem,
                                        selectedHost?.host === h.host && styles.hostItemSelected,
                                    ]}
                                    onPress={() => setSelectedHost(h)}
                                >
                                    <Text style={styles.hostItemText}>
                                        {h.name || h.host} ({h.host})
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {/* Input PIN */}
                    <Text style={styles.label}>PIN de seguridad:</Text>
                    <TextInput
                        ref={inputRef}
                        style={styles.pinInput}
                        value={pin}
                        onChangeText={(t) => {
                            const clean = t.replace(/\D/g, '').slice(0, PIN_LENGTH);
                            setPin(clean);
                            setErrorMsg('');
                        }}
                        placeholder="000000"
                        placeholderTextColor="#aaa"
                        keyboardType="number-pad"
                        maxLength={PIN_LENGTH}
                        editable={!isLoading}
                        autoFocus
                        returnKeyType="done"
                        onSubmitEditing={handleConnect}
                    />

                    {/* Error */}
                    {!!errorMsg && (
                        <Text style={styles.errorText}>{errorMsg}</Text>
                    )}

                    {/* Botones de accion */}
                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={[styles.btn, styles.btnCancel]}
                            onPress={handleClose}
                            disabled={isLoading}
                        >
                            <Text style={[styles.btnText, { color: '#555' }]}>Cancelar</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.btn,
                                styles.btnPrimary,
                                (isLoading || pin.length !== PIN_LENGTH) && styles.btnDisabled,
                            ]}
                            onPress={handleConnect}
                            disabled={isLoading || pin.length !== PIN_LENGTH}
                        >
                            {step === 'connecting'
                                ? <ActivityIndicator color="#fff" />
                                : <Text style={styles.btnText}>Conectar</Text>
                            }
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

// ─────────────────────────────────────────────
// Estilos
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    card: {
        width: '100%',
        maxWidth: 380,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 8,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1a1a2e',
        marginBottom: 6,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 13,
        color: '#555',
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 18,
    },
    label: {
        fontSize: 13,
        color: '#333',
        fontWeight: '600',
        marginBottom: 6,
        marginTop: 10,
    },
    ipInput: {
        borderWidth: 1.5,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        fontSize: 15,
        paddingHorizontal: 12,
        paddingVertical: 10,
        color: '#1a1a2e',
        backgroundColor: '#f8fafc',
    },
    pinInput: {
        borderWidth: 2,
        borderColor: '#3d5a80',
        borderRadius: 10,
        fontSize: 28,
        fontWeight: '700',
        letterSpacing: 8,
        textAlign: 'center',
        paddingVertical: 12,
        color: '#1a1a2e',
        marginBottom: 8,
    },
    errorText: {
        color: '#d62828',
        fontSize: 12,
        marginTop: 4,
        textAlign: 'center',
        lineHeight: 16,
    },
    hostList: {
        marginBottom: 8,
    },
    hostItem: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
        padding: 10,
        marginBottom: 6,
    },
    hostItemSelected: {
        borderColor: '#3d5a80',
        backgroundColor: '#eaf0fb',
    },
    hostItemText: {
        fontSize: 13,
        color: '#333',
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 18,
        gap: 12,
    },
    btn: {
        flex: 1,
        paddingVertical: 13,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnPrimary: {
        backgroundColor: '#3d5a80',
    },
    btnSecondary: {
        backgroundColor: '#457b9d',
        marginBottom: 6,
    },
    btnCancel: {
        backgroundColor: '#f0f0f0',
    },
    btnDisabled: {
        opacity: 0.45,
    },
    btnText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 14,
    },
});
