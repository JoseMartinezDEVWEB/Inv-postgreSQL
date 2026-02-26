import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from 'react-query';
import { clientesApi } from '../services/api';
import { Picker } from '@react-native-picker/picker';

const SesionModal = ({ visible, onClose, onSave }) => {
  const [clienteNegocio, setClienteNegocio] = useState(null);
  const [notas, setNotas] = useState('');
  const [search, setSearch] = useState('');

  const { data: clientesData, isLoading: clientesLoading, error, refetch } = useQuery(
    'clientesParaSesion',
    async () => {
      console.log('📋 Cargando clientes para sesión...')
      // El backend (esquemaPaginacion) sólo permite limite hasta 100
      const response = await clientesApi.getAll({ limite: 100, pagina: 1 })
      console.log('✅ Respuesta de clientes:', response.data)
      // El backend devuelve { datos: { datos: clientes[], paginacion: {...} } }
      const clientes = response.data?.datos?.datos || response.data?.datos?.clientes || []
      console.log(`✅ Total de clientes cargados: ${clientes.length}`)
      return clientes
    },
    {
      enabled: visible, // Solo obtener si el modal está visible
      retry: 2,
      onError: (err) => {
        console.error('❌ Error cargando clientes:', err)
        alert('Error al cargar clientes: ' + (err?.message || 'Error desconocido'))
      }
    }
  );

  useEffect(() => {
    if (visible && !clientesLoading && clientesData) {
      console.log('📊 Clientes disponibles en modal:', clientesData)
    }
  }, [visible, clientesLoading, clientesData]);

  const handleSave = () => {
    if (!clienteNegocio) {
      alert('Por favor, selecciona un cliente.');
      return;
    }
    onSave({ clienteNegocio, notas });
  };

  useEffect(() => {
    if (!visible) {
      setClienteNegocio(null);
      setNotas('');
    }
  }, [visible]);

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Nueva Sesión</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close-circle" size={30} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.formContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Cliente</Text>
              {clientesLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#1e40af" />
                  <Text style={styles.loadingText}>Cargando clientes...</Text>
                </View>
              ) : error ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>Error al cargar clientes</Text>
                  <TouchableOpacity onPress={refetch} style={styles.retryButton}>
                    <Text style={styles.retryText}>Reintentar</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Buscar cliente..."
                    value={search}
                    onChangeText={setSearch}
                  />
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={clienteNegocio}
                      onValueChange={(itemValue) => setClienteNegocio(itemValue)}
                      style={styles.picker}
                    >
                      <Picker.Item label="Selecciona un cliente..." value={null} />
                      {(clientesData || [])
                        .filter((c) =>
                          (c?.nombre || '').toLowerCase().includes((search || '').toLowerCase())
                        )
                        .map((cliente) => (
                        <Picker.Item 
                          key={cliente._id || cliente.id} 
                          label={cliente.nombre || 'Sin nombre'} 
                          value={cliente._id || cliente.id} 
                        />
                      ))}
                    </Picker>
                  </View>
                  {clientesData && clientesData.length === 0 && (
                    <Text style={styles.emptyText}>No hay clientes disponibles. Crea uno primero.</Text>
                  )}
                  {clientesData && clientesData.length > 0 && search && 
                    clientesData.filter((c) => (c?.nombre || '').toLowerCase().includes((search || '').toLowerCase())).length === 0 && (
                    <Text style={styles.emptyText}>No se encontraron clientes con "{search}"</Text>
                  )}
                </>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Notas (Opcional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={notas}
                onChangeText={setNotas}
                placeholder="Notas adicionales sobre la sesión..."
                multiline
              />
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={handleSave}>
              <Text style={styles.saveButtonText}>Crear Sesión</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContainer: { height: '70%', backgroundColor: '#f8fafc', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#1e293b' },
  formContainer: { paddingBottom: 20 },
  inputGroup: { marginBottom: 15 },
  label: { fontSize: 16, color: '#475569', marginBottom: 8, fontWeight: '500' },
  input: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: '#1e293b' },
  searchInput: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: '#1e293b', marginBottom: 10 },
  textArea: { height: 100, textAlignVertical: 'top' },
  pickerContainer: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, backgroundColor: '#ffffff', marginBottom: 5 },
  picker: { height: 50, width: '100%' },
  loadingContainer: { padding: 20, alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#64748b', fontSize: 14 },
  errorContainer: { padding: 15, backgroundColor: '#fee2e2', borderRadius: 8, alignItems: 'center' },
  errorText: { color: '#dc2626', fontSize: 14, marginBottom: 10 },
  retryButton: { backgroundColor: '#dc2626', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 6 },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  emptyText: { color: '#64748b', fontSize: 13, fontStyle: 'italic', marginTop: 5 },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 15, marginTop: 10 },
  button: { paddingVertical: 12, paddingHorizontal: 25, borderRadius: 8, alignItems: 'center' },
  saveButton: { backgroundColor: '#1e40af' },
  saveButtonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  cancelButton: { marginRight: 10 },
  cancelButtonText: { color: '#475569', fontSize: 16, fontWeight: '500' },
});

export default SesionModal;
