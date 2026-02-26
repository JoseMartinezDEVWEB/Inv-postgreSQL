import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from 'react-query';
import { productosApi } from '../../services/api';

const ProductSearchModal = ({ visible, onClose, onSelectProduct, clienteId }) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Cargar productos generales cuando se abre el modal (sin búsqueda o con menos de 3 caracteres)
  const { data: generalProductsList, isLoading: loadingGeneralList, error: generalListError } = useQuery(
    ['loadProductosGenerales', visible],
    () => productosApi.getAllGenerales({ limite: 20, pagina: 1, soloActivos: true }),
    {
      select: (response) => {
        // Backend SQLite devuelve: { exito: true, datos: { productos: [...], paginacion: {...} } }
        return response.data?.datos?.productos || response.data?.productos || [];
      },
      enabled: Boolean(visible && searchTerm.length < 3),
      retry: false,
      staleTime: 30000,
      onError: (error) => {
        // Silencioso - no mostrar errores de conexión
        // Los productos se cargan desde localDb cuando no hay conexión
      }
    }
  );

  // Buscar productos del cliente cuando hay 3 o más caracteres
  const { data: clientProducts, isLoading: loadingClient, error: clientError } = useQuery(
    ['searchProductosCliente', clienteId, searchTerm],
    () => {
      const searchTerm3 = searchTerm.trim().substring(0, 3);
      return productosApi.getByClient(clienteId, { buscar: searchTerm3, limite: 10, soloActivos: true });
    },
    {
      select: (response) => {
        // Backend SQLite devuelve: { exito: true, datos: { productos: [...], paginacion: {...} } }
        const productos = response.data?.datos?.productos || response.data?.productos || [];
        // Filtrar productos que empiecen con las primeras 3 letras
        return productos.filter(producto => {
          const nombreProducto = (producto.nombre || '').toLowerCase();
          const busqueda = searchTerm.trim().toLowerCase();
          return nombreProducto.startsWith(busqueda.substring(0, 3));
        });
      },
      enabled: Boolean(searchTerm.length >= 3 && visible && clienteId),
      retry: false,
      staleTime: 30000,
      onError: (error) => {
        console.log('⚠️ Error buscando productos del cliente:', error.response?.status, error.message);
        if (error.response?.status !== 404) {
          console.error('❌ Error crítico en búsqueda de productos del cliente:', error);
        }
      }
    }
  );

  // Buscar productos generales cuando hay 3 o más caracteres
  const { data: generalProducts, isLoading: loadingGeneral, error: generalError } = useQuery(
    ['searchProductosGenerales', searchTerm],
    () => {
      const searchTerm3 = searchTerm.trim().substring(0, 3);
      return productosApi.getAllGenerales({ buscar: searchTerm3, limite: 20, pagina: 1, soloActivos: true });
    },
    {
      select: (response) => {
        // Backend SQLite devuelve: { exito: true, datos: { productos: [...], paginacion: {...} } }
        const productos = response.data?.datos?.productos || response.data?.productos || [];
        // Filtrar productos que empiecen con las primeras 3 letras
        return productos.filter(producto => {
          const nombreProducto = (producto.nombre || '').toLowerCase();
          const busqueda = searchTerm.trim().toLowerCase();
          return nombreProducto.startsWith(busqueda.substring(0, 3));
        });
      },
      enabled: Boolean(searchTerm.length >= 3 && visible),
      retry: false,
      staleTime: 30000,
      onError: (error) => {
        console.log('⚠️ Error buscando productos generales:', error.response?.status, error.message);
        console.error('❌ Error en búsqueda de productos generales:', error);
      }
    }
  );

  // Combinar resultados según el estado de búsqueda
  const searchResults = React.useMemo(() => {
    try {
      if (searchTerm.length < 3) {
        // Mostrar productos generales cuando no hay búsqueda o menos de 3 caracteres
        const general = Array.isArray(generalProductsList) ? generalProductsList : [];
        return general.map(p => ({ ...p, isClientProduct: false }));
      } else {
        // Buscar productos cuando hay 3 o más caracteres
        const client = Array.isArray(clientProducts) ? clientProducts : [];
        const general = Array.isArray(generalProducts) ? generalProducts : [];
        
        // Marcar productos del cliente vs generales
        const clientMarked = client.map(p => ({ ...p, isClientProduct: true }));
        const generalMarked = general.map(p => ({ ...p, isClientProduct: false }));
        
        // Combinar y eliminar duplicados
        const todos = [...clientMarked, ...generalMarked];
        const unicos = todos.filter((producto, index, self) =>
          index === self.findIndex((p) => 
            (p.nombre === producto.nombre) || 
            (p._id === producto._id) || 
            (p.id === producto.id)
          )
        );
        
        return unicos;
      }
    } catch (error) {
      console.log('⚠️ Error combinando resultados de búsqueda:', error.message);
      return [];
    }
  }, [clientProducts, generalProducts, generalProductsList, searchTerm.length]);

  const isLoading = loadingClient || loadingGeneral || loadingGeneralList;

  useEffect(() => {
    if (!visible) {
      setSearchTerm('');
    }
  }, [visible]);

  const handleSelect = (product) => {
    onSelectProduct(product);
    onClose();
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.resultItem} onPress={() => handleSelect(item)}>
      <View style={styles.productInfo}>
        <View style={styles.productHeader}>
          <Text style={styles.productName}>{item.nombre}</Text>
          {!item.isClientProduct && (
            <View style={styles.generalBadge}>
              <Text style={styles.generalBadgeText}>General</Text>
            </View>
          )}
        </View>
        <Text style={styles.productSku}>
          {item.isClientProduct ? (item.sku || 'Sin SKU') : (item.codigoBarras || 'Sin código')}
        </Text>
      </View>
      <Text style={styles.productCost}>
        ${(item.isClientProduct ? item.costo : item.costoBase || 0).toFixed(2)}
      </Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Buscar Producto</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close-circle" size={30} color="#64748b" />
            </TouchableOpacity>
          </View>

          <View style={styles.searchWrapper}>
            <Ionicons name="search" size={20} color="#64748b" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Escribe el nombre del producto..."
              placeholderTextColor="#94a3b8"
              value={searchTerm}
              onChangeText={setSearchTerm}
              autoFocus
            />
          </View>

          {isLoading ? (
            <ActivityIndicator size="large" color="#1e40af" style={{ marginTop: 20 }} />
          ) : (
            <FlatList
              data={searchResults || []}
              renderItem={renderItem}
              keyExtractor={(item) => item._id}
              contentContainerStyle={styles.listContainer}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    {searchTerm.length === 0
                      ? '📦 Listado de productos generales'
                      : searchTerm.length < 3
                      ? 'Escribe al menos 3 caracteres para buscar'
                      : (clientError || generalError)
                      ? 'Error al buscar productos. Intenta de nuevo.'
                      : 'No se encontraron productos.'}
                  </Text>
                  {/* No mostrar errores de conexión - la búsqueda funciona offline desde localDb */}
                </View>
              }
              ListHeaderComponent={
                searchTerm.length >= 3 && searchResults.length > 0 ? (
                  <View style={styles.headerInfo}>
                    <Text style={styles.headerInfoText}>
                      🔍 Resultados: "{searchTerm}" ({searchResults.length})
                    </Text>
                  </View>
                ) : searchTerm.length === 0 && searchResults.length > 0 ? (
                  <View style={styles.headerInfo}>
                    <Text style={styles.headerInfoText}>
                      📦 Productos Generales ({searchResults.length})
                    </Text>
                  </View>
                ) : null
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContainer: { height: '85%', backgroundColor: '#f8fafc', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1e293b' },
  searchWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 15, paddingVertical: 12, marginBottom: 15 },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 16, color: '#1e293b' },
  listContainer: { paddingBottom: 20 },
  resultItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  productInfo: { flex: 1 },
  productHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  productName: { fontSize: 16, fontWeight: '600', color: '#1e293b', flex: 1 },
  generalBadge: { backgroundColor: '#f59e0b', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginLeft: 8 },
  generalBadgeText: { fontSize: 10, fontWeight: 'bold', color: '#ffffff' },
  productSku: { fontSize: 13, color: '#64748b', marginTop: 2 },
  productCost: { fontSize: 16, fontWeight: 'bold', color: '#1e40af' },
  emptyContainer: { alignItems: 'center', marginTop: 50 },
  emptyText: { fontSize: 16, color: '#64748b' },
  errorText: { fontSize: 14, color: '#ef4444', marginTop: 8, textAlign: 'center' },
  headerInfo: { backgroundColor: '#e0f2fe', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginBottom: 10 },
  headerInfoText: { fontSize: 14, fontWeight: '600', color: '#0369a1' },
});

export default ProductSearchModal;
