import React, { useState } from 'react';
import { View, Text, Modal, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from 'react-query';
import { sesionesApi } from '../services/api';
import ReporteInventarioModal from './ReporteInventarioModal'; // Helper component

const ClienteHistorialModal = ({ visible, onClose, cliente }) => {
    const [selectedSesion, setSelectedSesion] = useState(null);
    const [reporteVisible, setReporteVisible] = useState(false);

    // Fetch sessions
    const { data: sesionesData, isLoading } = useQuery(
        ['sesiones-cliente', cliente?._id],
        async () => {
            if (!cliente?._id) return { datos: [] };
            const response = await sesionesApi.getByClient(cliente._id);
            return response.data; // Ensure structure matches
        },
        {
            enabled: visible && !!cliente?._id,
        }
    );

    const handleOpenReporte = (sesion) => {
        setSelectedSesion(sesion);
        setReporteVisible(true);
    };

    const renderItem = ({ item }) => (
        <View style={styles.row}>
            <View style={styles.colFecha}>
                <Text style={styles.textBold}>{new Date(item.fecha).toLocaleDateString()}</Text>
                <Text style={styles.textSmall}>#{item.numeroSesion}</Text>
            </View>
            <View style={styles.colInfo}>
                <Text style={styles.textValue}>${item.totales?.valorTotalInventario?.toLocaleString() || 0}</Text>
                <Text style={styles.textSmall}>{item.totales?.totalProductosContados || 0} prods</Text>
            </View>
            <View style={styles.colAction}>
                <TouchableOpacity onPress={() => handleOpenReporte(item)} style={styles.btnVer}>
                    <Text style={styles.btnText}>Ver</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Historial - {cliente?.nombre}</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color="#333" />
                        </TouchableOpacity>
                    </View>

                    {isLoading ? (
                        <ActivityIndicator size="large" color="#0ea5e9" style={{ marginTop: 20 }} />
                    ) : (
                        <FlatList
                            data={sesionesData?.datos || []}
                            keyExtractor={(item) => item._id || item.id}
                            renderItem={renderItem}
                            ListEmptyComponent={<Text style={styles.emptyText}>No hay inventarios registrados.</Text>}
                            style={styles.list}
                        />
                    )}

                </View>
            </View>

            {/* Reporte Modal (Nested) */}
            <ReporteInventarioModal
                visible={reporteVisible}
                onClose={() => setReporteVisible(false)}
                sesion={selectedSesion}
                cliente={cliente}
            />
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    container: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '80%' },
    header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderColor: '#eee' },
    title: { fontSize: 18, fontWeight: 'bold' },
    list: { padding: 20 },
    row: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#f0f0f0', alignItems: 'center' },
    colFecha: { flex: 2 },
    colInfo: { flex: 2, alignItems: 'flex-end', paddingRight: 10 },
    colAction: { flex: 1, alignItems: 'flex-end' },
    textBold: { fontWeight: '600', fontSize: 16 },
    textValue: { fontWeight: 'bold', fontSize: 16, color: '#0ea5e9' },
    textSmall: { fontSize: 12, color: '#666' },
    btnVer: { backgroundColor: '#e0f2fe', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
    btnText: { color: '#0284c7', fontWeight: '600' },
    emptyText: { textAlign: 'center', marginTop: 20, color: '#999' }
});

export default ClienteHistorialModal;
