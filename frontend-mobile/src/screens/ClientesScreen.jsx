import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  ScrollView,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { clientesApi, handleApiError } from '../services/api';
import { showMessage } from 'react-native-flash-message';
import { LinearGradient } from 'expo-linear-gradient';
import ClienteModal from '../components/ClienteModal';
import ImportarPDFModal from '../components/ImportarPDFModal';
import ClienteHistorialModal from '../components/ClienteHistorialModal';
import localDb from '../services/localDb';
import syncService from '../services/syncService';
import { useNetInfo } from '@react-native-community/netinfo';
import { useAuth } from '../context/AuthContext';

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

/**
 * Indicador de sincronización (Optimistic UI)
 * Muestra estado: pending (nube con reloj), synced (nube ok), error (nube con x)
 */
const SyncIndicator = ({ status }) => {
  const [fadeAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    if (status === 'pending') {
      // Animación de parpadeo para pending
      Animated.loop(
        Animated.sequence([
          Animated.timing(fadeAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
          Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [status]);

  if (status === 'synced' || !status) return null;

  const getIcon = () => {
    switch (status) {
      case 'pending':
        return { name: 'cloud-upload-outline', color: '#f59e0b' };
      case 'error':
        return { name: 'cloud-offline-outline', color: '#ef4444' };
      default:
        return { name: 'cloud-outline', color: '#94a3b8' };
    }
  };

  const icon = getIcon();

  return (
    <Animated.View style={[styles.syncIndicator, { opacity: fadeAnim }]}>
      <Ionicons name={icon.name} size={14} color={icon.color} />
    </Animated.View>
  );
};

const ClienteCard = ({ item, onEdit, onDelete, onView }) => {
  // Determinar estado de sincronización
  const syncStatus = item._syncStatus || (item.is_dirty ? 'pending' : 'synced');

  return (
    <View style={[styles.clienteCard, syncStatus === 'pending' && styles.cardPending]}>
      <View style={styles.cardTopRow}>
        <View style={styles.clienteInfo}>
          <View style={styles.nombreRow}>
            <Text style={styles.clienteNombre}>{item.nombre}</Text>
            <SyncIndicator status={syncStatus} />
          </View>
          <Text style={styles.clienteTelefono}>{item.telefono || 'Sin teléfono'}</Text>
        </View>
        <View style={[styles.statusIndicator, { backgroundColor: item.activo ? '#22c55e' : '#ef4444' }]} />
      </View>
      <Text style={styles.clienteDireccion} numberOfLines={2}>{item.direccion || 'Sin dirección'}</Text>
      <View style={styles.cardBottomRow}>
        <View style={styles.statItem}>
          <Ionicons name="archive-outline" size={16} color="#475569" />
          <Text style={styles.statText}>{item.estadisticas?.totalInventarios || 0} Inventarios</Text>
        </View>
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionButton} onPress={() => onView(item)}>
            <Ionicons name="eye-outline" size={20} color="#3b82f6" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => onEdit(item)}>
            <Ionicons name="create-outline" size={20} color="#10b981" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => onDelete(item)}>
            <Ionicons name="trash-outline" size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

// --- Pantalla Principal ---

const ClientesScreen = ({ navigation }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalVisible, setModalVisible] = useState(false);
  const [isViewModalVisible, setViewModalVisible] = useState(false);
  const [isHistorialModalVisible, setHistorialModalVisible] = useState(false);
  const [isImportarPDFModalVisible, setImportarPDFModalVisible] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [syncStats, setSyncStats] = useState({ pendientes: 0 });
  const queryClient = useQueryClient();
  const netInfo = useNetInfo();

  // Obtener contexto de autenticación para business_id
  const { user } = useAuth();
  const businessId = user?.contablePrincipalId || user?._id || user?.id;

  /**
   * Query principal - Usa SQLite local como fuente de verdad
   * Sincroniza en segundo plano cuando hay conexión
   */
  const { data: clientesData, isLoading, isError, refetch } = useQuery(
    ['clientes', searchTerm, netInfo.isConnected],
    async () => {
      // SIEMPRE leer de SQLite local primero (Offline-First)
      const clientesLocales = await localDb.obtenerClientes(searchTerm, businessId);

      // Si hay conexión, sincronizar en segundo plano (no bloquea UI)
      if (netInfo.isConnected) {
        syncService.syncWithCloud().catch(console.error);
      }

      return { datos: clientesLocales };
    },
    {
      staleTime: 5000, // Considerar datos frescos por 5 segundos
      cacheTime: 300000, // Mantener en caché 5 minutos
    }
  );

  // Escuchar eventos de sincronización (después de definir refetch)
  useEffect(() => {
    const unsubscribe = syncService.addListener((evento) => {
      if (evento.tipo === 'sync_success') {
        // Refrescar datos cuando se complete una sincronización
        refetch();
        syncService.obtenerEstadisticas().then(setSyncStats);
      }
    });

    // Cargar estadísticas iniciales
    syncService.obtenerEstadisticas().then(setSyncStats);

    return unsubscribe;
  }, [refetch]); // Incluir refetch en las dependencias

  /**
   * Crear cliente - Optimistic UI
   * 1. Guarda inmediatamente en SQLite local
   * 2. Actualiza UI sin esperar red
   * 3. Sincroniza en segundo plano
   */
  const createMutation = useMutation(
    async (clienteData) => {
      // Paso 1: Guardar localmente PRIMERO (Optimistic UI)
      const clienteLocal = await localDb.crearClienteLocal(clienteData, businessId, user?._id || user?.id);

      // Paso 2: Disparar sincronización en segundo plano (no esperar)
      if (netInfo.isConnected) {
        syncService.syncWithCloud().catch(console.error);
      }

      return { data: { datos: clienteLocal } };
    },
    {
      onSuccess: () => {
        // Invalidar queries para refrescar lista inmediatamente
        queryClient.invalidateQueries(['clientes']);
        queryClient.invalidateQueries(['clientesParaSesion']);

        showMessage({
          message: netInfo.isConnected
            ? 'Cliente creado exitosamente'
            : 'Cliente guardado localmente (se sincronizará al conectar)',
          type: 'success'
        });
        setModalVisible(false);
      },
      onError: (error) => {
        showMessage({
          message: error?.message || 'Error al crear cliente',
          type: 'danger'
        });
      },
    }
  );

  /**
   * Actualizar cliente - Optimistic UI
   */
  const updateMutation = useMutation(
    async ({ id, data }) => {
      // Actualizar localmente primero
      await localDb.actualizarClienteLocal(id, data);

      // Sincronizar en segundo plano
      if (netInfo.isConnected) {
        syncService.syncWithCloud().catch(console.error);
      }

      return { data: { datos: data } };
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['clientes']);
        queryClient.invalidateQueries(['clientesParaSesion']);

        showMessage({
          message: 'Cliente actualizado exitosamente',
          type: 'success'
        });
        setModalVisible(false);
      },
      onError: (error) => {
        showMessage({
          message: error?.message || 'Error al actualizar cliente',
          type: 'danger'
        });
      },
    }
  );

  /**
   * Eliminar cliente - Soft delete local + sync
   */
  const deleteMutation = useMutation(
    async (id) => {
      // Soft delete local
      await localDb.eliminarClienteLocal(id);

      // Sincronizar
      if (netInfo.isConnected) {
        syncService.syncWithCloud().catch(console.error);
      }

      return { data: { success: true } };
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['clientes']);
        queryClient.invalidateQueries(['clientesParaSesion']);

        showMessage({
          message: 'Cliente eliminado exitosamente',
          type: 'success'
        });
      },
      onError: (error) => {
        showMessage({
          message: error?.message || 'Error al eliminar cliente',
          type: 'danger'
        });
      },
    }
  );

  const handleOpenModal = (cliente = null) => {
    setSelectedCliente(cliente);
    setModalVisible(true);
  };

  const handleViewCliente = (cliente) => {
    setSelectedCliente(cliente);
    setViewModalVisible(true);
  };

  const handleOpenImportarPDF = () => {
    setViewModalVisible(false);
    setImportarPDFModalVisible(true);
  };

  const handleSaveCliente = (clienteData) => {
    if (selectedCliente) {
      updateMutation.mutate({ id: selectedCliente._id, data: clienteData });
    } else {
      createMutation.mutate(clienteData);
    }
  };

  const handleDelete = (cliente) => {
    Alert.alert(
      'Eliminar Cliente',
      `¿Estás seguro de eliminar a ${cliente.nombre}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => deleteMutation.mutate(cliente._id) },
      ]
    );
  };

  /**
   * Renderizar barra de estado de sincronización
   */
  const renderSyncStatus = () => {
    if (syncStats.pendientes > 0) {
      return (
        <View style={styles.syncStatusBar}>
          <Ionicons name="cloud-upload-outline" size={16} color="#92400e" />
          <Text style={styles.syncStatusText}>
            {syncStats.pendientes} cambio{syncStats.pendientes > 1 ? 's' : ''} pendiente{syncStats.pendientes > 1 ? 's' : ''} de sincronizar
          </Text>
        </View>
      );
    }
    return null;
  };

  const renderContent = () => {
    if (isLoading) {
      return <View style={styles.listContainer}>{[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}</View>;
    }
    if (isError) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="cloud-offline-outline" size={64} color="#ef4444" />
          <Text style={styles.errorText}>Error al cargar los clientes</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <>
        {renderSyncStatus()}
        <FlatList
          data={clientesData?.datos || []}
          renderItem={({ item }) => (
            <ClienteCard
              item={item}
              onEdit={handleOpenModal}
              onDelete={handleDelete}
              onView={handleViewCliente}
            />
          )}
          keyExtractor={(item, index) => item._id || item.id_uuid || item.id || `cliente-${index}`}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={isLoading}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={64} color="#cbd5e1" />
              <Text style={styles.emptyText}>No se encontraron clientes</Text>
              {!netInfo.isConnected && (
                <Text style={[styles.emptyText, { fontSize: 14, marginTop: 8 }]}>
                  (Modo sin conexión)
                </Text>
              )}
            </View>
          }
        />
      </>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Clientes</Text>
          {/* Indicador de conexión */}
          <Ionicons
            name={netInfo.isConnected ? "cloud-done-outline" : "cloud-offline-outline"}
            size={18}
            color={netInfo.isConnected ? "#22c55e" : "#ef4444"}
            style={{ marginLeft: 8 }}
          />
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => handleOpenModal()}>
          <Ionicons name="add" size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchWrapper}>
          <Ionicons name="search" size={20} color="#64748b" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar clientes..."
            placeholderTextColor="#94a3b8"
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
        </View>
      </View>

      {renderContent()}

      <ClienteModal
        visible={isModalVisible}
        onClose={() => setModalVisible(false)}
        onSave={handleSaveCliente}
        cliente={selectedCliente}
      />

      <ClienteHistorialModal
        visible={isHistorialModalVisible}
        onClose={() => setHistorialModalVisible(false)}
        cliente={selectedCliente}
      />

      {/* Modal de detalles del cliente */}
      <Modal
        visible={isViewModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setViewModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.viewModalContainer}>
            <View style={styles.viewModalHeader}>
              <Text style={styles.viewModalTitle}>Detalles del Cliente</Text>
              <TouchableOpacity onPress={() => setViewModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.viewModalContent}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Nombre</Text>
                <Text style={styles.detailValue}>{selectedCliente?.nombre}</Text>
              </View>

              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Teléfono</Text>
                <Text style={styles.detailValue}>{selectedCliente?.telefono || 'Sin teléfono'}</Text>
              </View>

              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Dirección</Text>
                <Text style={styles.detailValue}>{selectedCliente?.direccion || 'Sin dirección'}</Text>
              </View>

              {selectedCliente?.notas && (
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Notas</Text>
                  <Text style={styles.detailValue}>{selectedCliente.notas}</Text>
                </View>
              )}

              <View style={styles.separator} />

              <TouchableOpacity
                style={[styles.importPDFButton, { backgroundColor: '#0ea5e9', marginBottom: 10 }]}
                onPress={() => {
                  setViewModalVisible(false);
                  setHistorialModalVisible(true);
                }}
              >
                <Ionicons name="time-outline" size={20} color="#ffffff" />
                <Text style={styles.importPDFButtonText}>
                  Ver Historial
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.importPDFButton}
                onPress={handleOpenImportarPDF}
              >
                <Ionicons name="document-text" size={20} color="#ffffff" />
                <Text style={styles.importPDFButtonText}>
                  Importar Inventario desde PDF
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal para importar PDF */}
      <ImportarPDFModal
        visible={isImportarPDFModalVisible}
        onClose={() => {
          setImportarPDFModalVisible(false);
          setSelectedCliente(null);
        }}
        cliente={selectedCliente}
        onVerSesion={(sesionId, sesionData) => {
          setImportarPDFModalVisible(false);
          setSelectedCliente(null);
          // Navegar a la pantalla de detalle del inventario
          navigation.navigate('Inventarios', {
            screen: 'InventarioDetalle',
            params: { sesionId }
          });
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1e293b' },
  addButton: { width: 40, height: 40, backgroundColor: '#3b82f6', borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  searchContainer: { padding: 20 },
  searchWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 15, paddingVertical: 12 },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 16, color: '#1e293b' },
  listContainer: { paddingHorizontal: 20, paddingBottom: 20 },
  clienteCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  // Estilo para cards con sincronización pendiente
  cardPending: { borderColor: '#fbbf24', borderWidth: 1.5, borderStyle: 'dashed' },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  clienteInfo: { flex: 1 },
  // Fila con nombre e indicador de sync
  nombreRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  clienteNombre: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  clienteTelefono: { fontSize: 14, color: '#64748b', marginTop: 4 },
  statusIndicator: { width: 10, height: 10, borderRadius: 5, marginLeft: 10 },
  clienteDireccion: { fontSize: 14, color: '#475569', marginBottom: 12, lineHeight: 20 },
  cardBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 12, marginTop: 4 },
  statItem: { flexDirection: 'row', alignItems: 'center' },
  statText: { fontSize: 14, color: '#475569', marginLeft: 6 },
  actionsRow: { flexDirection: 'row', gap: 8 },
  actionButton: { padding: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  viewModalContainer: { backgroundColor: '#ffffff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  viewModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  viewModalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  viewModalContent: { padding: 20 },
  detailItem: { marginBottom: 20 },
  detailLabel: { fontSize: 14, fontWeight: '600', color: '#64748b', marginBottom: 4 },
  detailValue: { fontSize: 16, color: '#1e293b' },
  separator: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 20 },
  importPDFButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#3b82f6', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12, gap: 8 },
  importPDFButtonText: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, color: '#64748b', marginTop: 15, textAlign: 'center' },
  errorText: { fontSize: 16, color: '#b91c1c', marginTop: 15, textAlign: 'center' },
  retryButton: { marginTop: 20, backgroundColor: '#1e40af', paddingVertical: 10, paddingHorizontal: 25, borderRadius: 20 },
  retryButtonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  skeletonCard: { backgroundColor: '#e2e8f0', borderRadius: 15, height: 120, marginBottom: 15, overflow: 'hidden' },
  // Indicador de sincronización
  syncIndicator: { marginLeft: 4 },
  // Barra de estado de sincronización
  syncStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    marginHorizontal: 20,
    marginBottom: 10
  },
  syncStatusText: { fontSize: 12, color: '#92400e', marginLeft: 6 },
});

export default ClientesScreen;
