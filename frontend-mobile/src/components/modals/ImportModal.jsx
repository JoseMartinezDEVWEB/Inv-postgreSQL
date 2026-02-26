import React, { useState, useEffect } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, FlatList, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { importarProductosDesdeArchivo } from '../../services/importService';

const ImportModal = ({ visible, onClose, onImport }) => {
    const [step, setStep] = useState(1);
    const [file, setFile] = useState(null);
    const [apiKey, setApiKey] = useState('');
    const [loading, setLoading] = useState(false);
    const [previewData, setPreviewData] = useState([]);
    const [statusMsg, setStatusMsg] = useState('');

    useEffect(() => {
        loadKey();
    }, []);

    const loadKey = async () => {
        const key = await AsyncStorage.getItem('gemini_api_key');
        if (key) setApiKey(key);
    };

    const handlePickDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: [
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'application/vnd.ms-excel',
                    'application/pdf'
                ],
                copyToCacheDirectory: true
            });

            if (result.canceled === false) {
                setFile(result.assets ? result.assets[0] : result);
            }
        } catch (err) {
            console.log(err);
        }
    };

    const handleProcess = async () => {
        if (!file) return Alert.alert("Error", "Selecciona un archivo");

        setLoading(true);
        setStatusMsg("Enviando archivo al servidor...");
        try {
            if (apiKey) {
                await AsyncStorage.setItem('gemini_api_key', apiKey);
            }

            setStatusMsg("El servidor procesará el archivo con Python e IA...");

            // Usar el nuevo servicio que llama al backend Python
            const products = await importarProductosDesdeArchivo(file, apiKey);

            if (Array.isArray(products) && products.length > 0) {
                setPreviewData(products);
                setStep(2);
                setStatusMsg(`Se encontraron ${products.length} productos.`);
            } else {
                throw new Error("No se encontraron productos válidos en el archivo");
            }
        } catch (error) {
            const errorMessage = error.response?.data?.mensaje || error.message || "Error al procesar el archivo";
            Alert.alert("Error", errorMessage);
        } finally {
            setLoading(false);
            setStatusMsg('');
        }
    };

    const handleConfirm = () => {
        onImport(previewData);
        setStep(1);
        setFile(null);
        setPreviewData([]);
        onClose();
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={styles.overlay}>
                <View style={styles.modalContainer}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Importar Productos</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.content}>
                        {step === 1 && (
                            <>
                                <Text style={styles.label}>1. API Key Gemini (Opcional - Solo para PDFs complejos)</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Pega tu API Key aquí (opcional)"
                                    value={apiKey}
                                    onChangeText={setApiKey}
                                    secureTextEntry
                                />
                                <Text style={[styles.label, { fontSize: 12, color: '#64748b', fontWeight: 'normal' }]}>
                                    Para archivos Excel no es necesario. Solo se requiere para PDFs complejos.
                                </Text>

                                <Text style={styles.label}>2. Archivo Excel o PDF</Text>
                                <TouchableOpacity style={styles.uploadBox} onPress={handlePickDocument}>
                                    {file ? (
                                        <View style={{ alignItems: 'center' }}>
                                            <Ionicons name="document-text" size={32} color="#16a34a" />
                                            <Text style={styles.fileName}>{file.name}</Text>
                                        </View>
                                    ) : (
                                        <View style={{ alignItems: 'center' }}>
                                            <Ionicons name="cloud-upload-outline" size={32} color="#94a3b8" />
                                            <Text style={styles.uploadText}>Toca para seleccionar Excel</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>

                                {loading && (
                                    <View style={styles.loadingContainer}>
                                        <ActivityIndicator size="small" color="#2563eb" />
                                        <Text style={styles.loadingText}>{statusMsg}</Text>
                                    </View>
                                )}

                                <TouchableOpacity
                                    style={[styles.btn, (!file || loading) && styles.btnDisabled]}
                                    onPress={handleProcess}
                                    disabled={!file || loading}
                                >
                                    <Text style={styles.btnText}>{loading ? 'Procesando...' : 'Analizar Archivo'}</Text>
                                </TouchableOpacity>
                            </>
                        )}

                        {step === 2 && (
                            <>
                                <Text style={styles.subtitle}>Vista Previa ({previewData.length})</Text>
                                <FlatList
                                    data={previewData}
                                    keyExtractor={(_, i) => String(i)}
                                    style={{ maxHeight: 300 }}
                                    renderItem={({ item }) => (
                                        <View style={styles.previewItem}>
                                            <Text style={styles.pName}>{item.nombre}</Text>
                                            <Text style={styles.pPrice}>${item.costoBase}</Text>
                                        </View>
                                    )}
                                />
                                <View style={styles.footerBtns}>
                                    <TouchableOpacity style={[styles.btn, styles.btnOutline]} onPress={() => setStep(1)}>
                                        <Text style={styles.btnOutlineText}>Atrás</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.btn, { flex: 1, marginLeft: 10 }]} onPress={handleConfirm}>
                                        <Text style={styles.btnText}>Importar</Text>
                                    </TouchableOpacity>
                                </View>
                            </>
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContainer: { backgroundColor: 'white', borderRadius: 16, padding: 20, maxHeight: '80%' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    title: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
    content: {},
    label: { fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 8, marginTop: 10 },
    input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 10, fontSize: 14, color: '#1e293b', marginBottom: 10 },
    uploadBox: { borderWidth: 2, borderColor: '#e2e8f0', borderStyle: 'dashed', borderRadius: 12, padding: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
    uploadText: { color: '#94a3b8', marginTop: 5 },
    fileName: { color: '#16a34a', fontWeight: 'bold', marginTop: 5, textAlign: 'center' },
    btn: { backgroundColor: '#2563eb', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 10 },
    btnDisabled: { backgroundColor: '#94a3b8' },
    btnText: { color: 'white', fontWeight: 'bold' },
    loadingContainer: { flexDirection: 'row', justifyContent: 'center', marginVertical: 10 },
    loadingText: { marginLeft: 10, color: '#64748b' },
    subtitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
    previewItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    pName: { flex: 1, fontWeight: 'bold', color: '#334155' },
    pPrice: { color: '#16a34a', fontWeight: 'bold' },
    footerBtns: { flexDirection: 'row', marginTop: 20 },
    btnOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#cbd5e1', width: 100 },
    btnOutlineText: { color: '#64748b', fontWeight: 'bold' }
});

export default ImportModal;
