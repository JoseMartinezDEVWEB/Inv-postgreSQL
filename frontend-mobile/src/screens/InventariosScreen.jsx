import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { sesionesApi, handleApiError } from '../services/api';
import { showMessage } from 'react-native-flash-message';
import { LinearGradient } from 'expo-linear-gradient';
import SesionModal from '../components/SesionModal';
import { useLoader } from '../context/LoaderContext';
import localDb from '../services/localDb';
import { useNetInfo } from '@react-native-community/netinfo';

// --- Componentes Internos ---

const SkeletonCard = () => (
  <View style={styles.skeletonCard}>
    <LinearGradient
      colors={['#e2e8f0', '#f1f5f9', '#e2e8f0']}
      style={StyleSheet.absoluteFill}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
    />
  </View>
);

const getStatusInfo = (estado) => {
  switch (estado) {
    case 'completada':
      return { text: 'Completada', color: '#16a34a', icon: 'checkmark-circle' };
    case 'cancelada':
      return { text: 'Cancelada', color: '#dc2626', icon: 'close-circle' };
    case 'en_progreso':
      return { text: 'En Progreso', color: '#f59e0b', icon: 'play-circle' };
    default:
      return { text: 'Iniciada', color: '#3b82f6', icon: 'ellipse' };
  }
};

const SesionCard = ({ item, onSelect }) => {
  const status = getStatusInfo(item.estado);
  return (
    <TouchableOpacity style={styles.sesionCard} onPress={() => onSelect(item)}>
      <View style={styles.cardHeader}>
        <Text style={styles.clienteNombre}>{item.clienteNegocio?.nombre || 'Cliente no disponible'}</Text>
        <View style={[styles.statusBadge, { backgroundColor: status.color }]}>
          <Ionicons name={status.icon} size={14} color="#ffffff" />
          <Text style={styles.statusText}>{status.text}</Text>
        </View>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={16} color="#64748b" />
          <Text style={styles.infoText}>{new Date(item.fecha).toLocaleDateString()}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="pricetag-outline" size={16} color="#64748b" />
          <Text style={styles.infoText}>Sesión #{item.numeroSesion}</Text>
        </View>
      </View>
      <View style={styles.cardFooter}>
        <Text style={styles.valorLabel}>Valor Total:</Text>
        <Text style={styles.valorTotal}>${(item.totales?.valorTotalInventario || 0).toFixed(2)}</Text>
      </View>
    </TouchableOpacity>
  );
};

// --- Pantalla Principal ---

const InventariosScreen = ({ navigation }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalVisible, setModalVisible] = useState(false);
  const queryClient = useQueryClient();
  const { showLoader } = useLoader();

  const netInfo = useNetInfo();

  const { data: sesionesData, isLoading, isError, refetch } = useQuery(
    ['sesiones', searchTerm, netInfo.isConnected],
    async () => {
      if (netInfo.isConnected) {
        try {
          const response = await sesionesApi.getAll({ buscar: searchTerm, limite: 50, pagina: 1 });
          const sesiones = response.data.datos.sesiones;

          // Guardar en DB local
          await localDb.guardarSesiones(sesiones);

          return { sesiones };
        } catch (error) {
          console.log('⚠️ Error API, intentando local:', error.message);
          const sesionesLocales = await localDb.obtenerSesiones();
          return { sesiones: sesionesLocales };
        }
      } else {
        console.log('📴 Modo Offline: Usando DB local');
        const sesionesLocales = await localDb.obtenerSesiones();
        return { sesiones: sesionesLocales };
      }
    },
    {
      // select: (response) => response.data.datos, 
    }
  );

  const createMutation = useMutation(
    async (sesionData) => {
      if (netInfo.isConnected) {
        return sesionesApi.create(sesionData);
      } else {
        // Crear localmente
        const nuevaSesion = {
          ...sesionData,
          _id: `local_${Date.now()}`,
          numeroSesion: `OFF-${Date.now().toString().slice(-6)}`,
          fecha: new Date().toISOString(),
          clienteNombre: 'Cliente Offline', // Deberíamos obtener el nombre real si es posible
        };
        await localDb.crearSesionLocal(nuevaSesion);
        return { data: { datos: { sesion: nuevaSesion } } };
      }
    },
    {
      onSuccess: (response) => {
        queryClient.invalidateQueries('sesiones');
        showMessage({ message: 'Sesión creada exitosamente', type: 'success' });
        setModalVisible(false);
        const sesionId = response.data.datos.sesion._id;
        navigation.navigate('InventarioDetalle', { sesionId });
      },
      onError: handleApiError,
    }
  );

  const handleCreateSesion = (sesionData) => {
    showLoader(1200);
    createMutation.mutate(sesionData);
  };

  const handleSelectSesion = (sesion) => {
    showLoader(800);
    navigation.navigate('InventarioDetalle', { sesionId: sesion._id });
  };

  const renderContent = () => {
    if (isLoading) {
      return <View style={styles.listContainer}>{[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}</View>;
    }
    if (isError) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="cloud-offline-outline" size={64} color="#ef4444" />
          <Text style={styles.errorText}>Error al cargar los inventarios</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <FlatList
        data={sesionesData?.sesiones || []}
        renderItem={({ item }) => <SesionCard item={item} onSelect={handleSelectSesion} />}
        keyExtractor={(item, index) => item._id || item.id || `inventario-${index}`}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        onRefresh={() => { showLoader(800); refetch(); }}
        refreshing={isLoading}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="archive-outline" size={64} color="#cbd5e1" />
            <Text style={styles.emptyText}>No se encontraron inventarios</Text>
          </View>
        }
      />
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Inventarios</Text>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchWrapper}>
          <Ionicons name="search" size={20} color="#64748b" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por cliente o número..."
            placeholderTextColor="#94a3b8"
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
        </View>
      </View>

      {renderContent()}

      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Ionicons name="add" size={30} color="#ffffff" />
      </TouchableOpacity>

      <SesionModal
        visible={isModalVisible}
        onClose={() => setModalVisible(false)}
        onSave={handleCreateSesion}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1e293b' },
  searchContainer: { padding: 20 },
  searchWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 15, paddingVertical: 12 },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 16, color: '#1e293b' },
  listContainer: { paddingHorizontal: 20, paddingBottom: 80 },
  skeletonCard: { backgroundColor: '#e2e8f0', borderRadius: 16, height: 120, marginBottom: 16, overflow: 'hidden' },
  sesionCard: { backgroundColor: '#ffffff', borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  clienteNombre: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12 },
  statusText: { color: '#ffffff', fontSize: 12, fontWeight: 'bold', marginLeft: 4 },
  cardBody: { paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between' },
  infoRow: { flexDirection: 'row', alignItems: 'center' },
  infoText: { fontSize: 14, color: '#64748b', marginLeft: 6 },
  cardFooter: { backgroundColor: '#f8fafc', padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  valorLabel: { fontSize: 14, color: '#475569' },
  valorTotal: { fontSize: 18, fontWeight: 'bold', color: '#1e40af' },
  fab: { position: 'absolute', right: 20, bottom: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: '#1e40af', justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, color: '#64748b', marginTop: 15, textAlign: 'center' },
  errorText: { fontSize: 16, color: '#b91c1c', marginTop: 15, textAlign: 'center' },
  retryButton: { marginTop: 20, backgroundColor: '#1e40af', paddingVertical: 10, paddingHorizontal: 25, borderRadius: 20 },
  retryButtonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
});

export default InventariosScreen;



