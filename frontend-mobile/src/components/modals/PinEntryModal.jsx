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
    const [step, setStep] = useState('idle'); // 'idle' | 'discovering' | 'connecting' | 'done'
    const [foundHosts, setFoundHosts] = useState([]);
    const [selectedHost, setSelectedHost] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    const inputRef = useRef(null);

    // ── Limpiar estado al abrir/cerrar ─────────────────────────────────
    const handleClose = useCallback(() => {
        setPin('');
        setStep('idle');
        setFoundHosts([]);
        setSelectedHost(null);
        setErrorMsg('');
        onClose?.();
    }, [onClose]);

    // ── PASO 1: Descubrir hosts en la red ──────────────────────────────
    const handleDiscover = useCallback(async () => {
        setErrorMsg('');

        // Si el usuario ya provee una IP manual, saltar descubrimiento
        if (manualHostIp) {
            const manual = { host: manualHostIp, port: peerSyncService.PEER_PORT, name: 'Manual' };
            setFoundHosts([manual]);
            setSelectedHost(manual);
            setStep('idle'); // ir directo a ingresar PIN
            return;
        }

        setStep('discovering');
        try {
            const hosts = await peerSyncService.discoverHosts(5000);
            if (hosts.length === 0) {
                setErrorMsg('No se encontraron dispositivos host en la red. Verifica que el dispositivo principal esta activo y en la misma red Wi-Fi.');
                setStep('idle');
                return;
            }
            setFoundHosts(hosts);
            // Si solo hay uno, seleccionarlo automaticamente
            if (hosts.length === 1) setSelectedHost(hosts[0]);
            setStep('idle');
        } catch (e) {
            setErrorMsg('Error al buscar hosts: ' + e.message);
            setStep('idle');
        }
    }, [manualHostIp]);

    // ── PASO 2: Conectar con PIN ───────────────────────────────────────
    const handleConnect = useCallback(async () => {
        if (!pin || pin.length !== PIN_LENGTH) {
            setErrorMsg('Ingresa el PIN de ' + PIN_LENGTH + ' digitos mostrado en el dispositivo principal.');
            return;
        }
        if (!selectedHost) {
            setErrorMsg('Primero busca y selecciona el dispositivo principal.');
            return;
        }

        setErrorMsg('');
        setStep('connecting');
        try {
            const { token } = await peerSyncService.connectToHost(selectedHost, pin);
            setStep('done');
            showMessage({ message: 'Conectado al host', type: 'success', duration: 3000 });
            onConnected?.(token, selectedHost);
            handleClose();
        } catch (e) {
            setErrorMsg(e.message || 'No se pudo conectar. Verifica el PIN e intentalo de nuevo.');
            setStep('idle');
        }
    }, [pin, selectedHost, onConnected, handleClose]);

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
                        Ingresa el PIN de {PIN_LENGTH} digitos que aparece en la pantalla del dispositivo host.
                    </Text>

                    {/* Buscar hosts */}
                    {foundHosts.length === 0 && (
                        <TouchableOpacity
                            style={[styles.btn, styles.btnSecondary]}
                            onPress={handleDiscover}
                            disabled={isLoading}
                        >
                            {step === 'discovering'
                                ? <ActivityIndicator color="#fff" />
                                : <Text style={styles.btnText}>Buscar dispositivo host</Text>
                            }
                        </TouchableOpacity>
                    )}

                    {/* Lista de hosts encontrados */}
                    {foundHosts.length > 0 && (
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
                                        {h.name || h.host}  ({h.host}:{h.port})
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {/* Input PIN */}
                    <Text style={styles.label}>PIN del host:</Text>
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
