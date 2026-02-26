import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Switch, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { Picker } from '@react-native-picker/picker';

const ProductModal = ({ visible, onClose, onSave, product }) => {
  const [formData, setFormData] = useState({});
  const [showScanner, setShowScanner] = useState(false);
  const [scanningField, setScanningField] = useState(null); // 'contenedor' o 'unidad'
  const [hasPermission, setHasPermission] = useState(null);

  useEffect(() => {
    if (product) {
      setFormData({
        nombre: product.nombre || '',
        descripcion: product.descripcion || '',
        categoria: product.categoria || 'General',
        unidad: product.unidad || 'unidad',
        costoBase: product.costoBase?.toString() || '0',
        proveedor: product.proveedor || '',
        codigoBarras: product.codigoBarras || '',
        notas: product.notas || '',
        tipoContenedor: product.tipoContenedor || 'ninguno',
        tieneUnidadesInternas: product.tieneUnidadesInternas || false,
        unidadesInternas: product.unidadesInternas || {
          cantidad: 0,
          codigoBarras: '',
          nombre: '',
          costoPorUnidad: 0
        },
        tipoPeso: product.tipoPeso || 'ninguno'
      });
    } else {
      setFormData({
        nombre: '',
        descripcion: '',
        categoria: 'General',
        unidad: 'unidad',
        costoBase: '0',
        proveedor: '',
        codigoBarras: '',
        notas: '',
        tipoContenedor: 'ninguno',
        tieneUnidadesInternas: false,
        unidadesInternas: {
          cantidad: 0,
          codigoBarras: '',
          nombre: '',
          costoPorUnidad: 0
        },
        tipoPeso: 'ninguno'
      });
    }
  }, [product, visible]);

  const handleSave = () => {
    // Validaciones
    if (!formData.nombre.trim()) {
      Alert.alert('Error', 'El nombre del producto es requerido');
      return;
    }
    if (formData.tieneUnidadesInternas) {
      if (!formData.unidadesInternas.cantidad || formData.unidadesInternas.cantidad <= 0) {
        Alert.alert('Error', 'Debe especificar la cantidad de unidades internas');
        return;
      }
      if (!formData.unidadesInternas.codigoBarras.trim()) {
        Alert.alert('Error', 'El código de barras de la unidad interna es obligatorio');
        return;
      }
    }
    if (formData.tipoContenedor === 'saco' && formData.tipoPeso === 'ninguno') {
      Alert.alert('Error', 'Debe seleccionar el tipo de peso para los sacos');
      return;
    }

    const processedData = {
      ...formData,
      costoBase: parseFloat(formData.costoBase) || 0,
      unidadesInternas: formData.tieneUnidadesInternas ? {
        ...formData.unidadesInternas,
        cantidad: parseInt(formData.unidadesInternas.cantidad, 10) || 0
      } : undefined
    };
    onSave(processedData);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      
      // Recalcular costo por unidad si cambia costoBase o cantidad
      if ((field === 'costoBase' || field === 'unidadesInternas') && prev.tieneUnidadesInternas) {
        const costo = field === 'costoBase' ? parseFloat(value) : parseFloat(prev.costoBase);
        const cantidad = field === 'unidadesInternas' ? value.cantidad : prev.unidadesInternas.cantidad;
        if (costo > 0 && cantidad > 0) {
          newData.unidadesInternas = {
            ...newData.unidadesInternas,
            costoPorUnidad: costo / cantidad
          };
        }
      }
      
      return newData;
    });
  };

  const handleUnidadesInternasChange = (field, value) => {
    setFormData(prev => {
      const newUnidadesInternas = {
        ...prev.unidadesInternas,
        [field]: value
      };
      
      // Calcular costo por unidad
      if (field === 'cantidad' && value > 0 && parseFloat(prev.costoBase) > 0) {
        newUnidadesInternas.costoPorUnidad = parseFloat(prev.costoBase) / value;
      }
      
      return {
        ...prev,
        unidadesInternas: newUnidadesInternas
      };
    });
  };

  const requestCameraPermission = async () => {
    const { status } = await BarCodeScanner.requestPermissionsAsync();
    setHasPermission(status === 'granted');
    return status === 'granted';
  };

  const handleOpenScanner = async (field) => {
    const granted = await requestCameraPermission();
    if (granted) {
      setScanningField(field);
      setShowScanner(true);
    } else {
      Alert.alert('Permiso Denegado', 'Necesitamos permiso para acceder a la cámara para escanear códigos de barras.');
    }
  };

  const handleBarCodeScanned = ({ type, data }) => {
    setShowScanner(false);
    
    if (scanningField === 'contenedor') {
      handleInputChange('codigoBarras', data);
    } else if (scanningField === 'unidad') {
      handleUnidadesInternasChange('codigoBarras', data);
    }
    
    setScanningField(null);
    Alert.alert('Código Escaneado', `Código: ${data}`);
  };

  // Modal de escáner
  if (showScanner) {
    return (
      <Modal visible={showScanner} animationType="slide">
        <View style={styles.scannerContainer}>
          <BarCodeScanner
            onBarCodeScanned={handleBarCodeScanned}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.scannerOverlay}>
            <Text style={styles.scannerText}>
              Escanee el código de barras {scanningField === 'contenedor' ? 'del contenedor' : 'de la unidad interna'}
            </Text>
            <TouchableOpacity
              style={styles.cancelScanButton}
              onPress={() => { setShowScanner(false); setScanningField(null); }}
            >
              <Ionicons name="close-circle" size={40} color="#fff" />
              <Text style={styles.cancelScanText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

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
            <Text style={styles.modalTitle}>{product ? 'Editar Producto' : 'Nuevo Producto'}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close-circle" size={30} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.formContainer}>
            {/* Nombre */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nombre *</Text>
              <TextInput
                style={styles.input}
                value={formData.nombre}
                onChangeText={(text) => handleInputChange('nombre', text)}
                placeholder="Ej: Arroz Blanco"
              />
            </View>

            {/* Descripción */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Descripción</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.descripcion}
                onChangeText={(text) => handleInputChange('descripcion', text)}
                placeholder="Descripción detallada del producto"
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Categoría y Unidad */}
            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Categoría *</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={formData.categoria}
                    onValueChange={(value) => handleInputChange('categoria', value)}
                    style={styles.picker}
                  >
                    <Picker.Item label="General" value="General" />
                    <Picker.Item label="Alimentos General" value="Alimentos General" />
                    <Picker.Item label="Enlatados" value="Enlatados" />
                    <Picker.Item label="Mercado" value="Mercado" />
                    <Picker.Item label="Embutidos" value="Embutidos" />
                    <Picker.Item label="Carnes" value="Carnes" />
                    <Picker.Item label="Bebidas" value="Bebidas" />
                    <Picker.Item label="Desechables" value="Desechables" />
                    <Picker.Item label="Electricidad" value="Electricidad" />
                    <Picker.Item label="Dulce" value="Dulce" />
                  </Picker>
                </View>
              </View>

              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Unidad *</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={formData.unidad}
                    onValueChange={(value) => handleInputChange('unidad', value)}
                    style={styles.picker}
                  >
                    <Picker.Item label="Unidad" value="unidad" />
                    <Picker.Item label="Kg" value="kg" />
                    <Picker.Item label="Lb" value="lb" />
                    <Picker.Item label="Gr" value="gr" />
                    <Picker.Item label="Litro" value="litro" />
                    <Picker.Item label="Ml" value="ml" />
                    <Picker.Item label="Metro" value="metro" />
                    <Picker.Item label="Cm" value="cm" />
                    <Picker.Item label="Caja" value="caja" />
                    <Picker.Item label="Paquete" value="paquete" />
                    <Picker.Item label="Cajón" value="cajon" />
                    <Picker.Item label="Saco" value="saco" />
                    <Picker.Item label="Fardo" value="fardo" />
                    <Picker.Item label="Docena" value="docena" />
                    <Picker.Item label="Par" value="par" />
                    <Picker.Item label="Otro" value="otro" />
                  </Picker>
                </View>
              </View>
            </View>

            {/* Costo Base y Proveedor */}
            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Costo Base *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.costoBase}
                  onChangeText={(text) => handleInputChange('costoBase', text)}
                  keyboardType="numeric"
                  placeholder="0.00"
                />
              </View>

              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Proveedor</Text>
                <TextInput
                  style={styles.input}
                  value={formData.proveedor}
                  onChangeText={(text) => handleInputChange('proveedor', text)}
                  placeholder="Nombre del proveedor"
                />
              </View>
            </View>

            {/* Código de Barras Contenedor */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Código de Barras</Text>
              <View style={styles.barcodeRow}>
                <TextInput
                  style={[styles.input, styles.barcodeInput]}
                  value={formData.codigoBarras}
                  onChangeText={(text) => handleInputChange('codigoBarras', text)}
                  placeholder="1234567890123"
                />
                <TouchableOpacity
                  style={styles.scanButton}
                  onPress={() => handleOpenScanner('contenedor')}
                >
                  <Ionicons name="scan" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            {/* SECCIÓN: TIPO DE CONTENEDOR */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Tipo de Contenedor</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Tipo de Contenedor</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={formData.tipoContenedor}
                    onValueChange={(value) => handleInputChange('tipoContenedor', value)}
                    style={styles.picker}
                  >
                    <Picker.Item label="Ninguno" value="ninguno" />
                    <Picker.Item label="Caja" value="caja" />
                    <Picker.Item label="Paquete" value="paquete" />
                    <Picker.Item label="Saco" value="saco" />
                    <Picker.Item label="Fardo" value="fardo" />
                    <Picker.Item label="Cajón" value="cajon" />
                  </Picker>
                </View>
              </View>

              {/* Tipo de Peso (solo para sacos) */}
              {formData.tipoContenedor === 'saco' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Tipo de Peso *</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={formData.tipoPeso}
                      onValueChange={(value) => handleInputChange('tipoPeso', value)}
                      style={styles.picker}
                    >
                      <Picker.Item label="Seleccionar..." value="ninguno" />
                      <Picker.Item label="Libras (lb)" value="lb" />
                      <Picker.Item label="Kilogramos (kg)" value="kg" />
                      <Picker.Item label="Gramos (gr)" value="gr" />
                    </Picker>
                  </View>
                </View>
              )}

              {/* Switch: ¿Tiene unidades internas? */}
              <View style={styles.switchContainer}>
                <Text style={styles.label}>¿Tiene unidades internas?</Text>
                <Switch
                  value={formData.tieneUnidadesInternas}
                  onValueChange={(value) => handleInputChange('tieneUnidadesInternas', value)}
                  trackColor={{ false: '#cbd5e1', true: '#3b82f6' }}
                  thumbColor={formData.tieneUnidadesInternas ? '#1e40af' : '#f1f5f9'}
                />
              </View>

              {/* Campos de Unidades Internas */}
              {formData.tieneUnidadesInternas && (
                <View style={styles.unidadesContainer}>
                  <Text style={styles.subsectionTitle}>Información de Unidades Internas</Text>

                  <View style={styles.row}>
                    <View style={[styles.inputGroup, styles.halfWidth]}>
                      <Text style={styles.label}>Cantidad *</Text>
                      <TextInput
                        style={styles.input}
                        value={formData.unidadesInternas.cantidad?.toString()}
                        onChangeText={(text) => handleUnidadesInternasChange('cantidad', parseInt(text) || 0)}
                        keyboardType="numeric"
                        placeholder="12"
                      />
                    </View>

                    <View style={[styles.inputGroup, styles.halfWidth]}>
                      <Text style={styles.label}>Costo/Unidad</Text>
                      <TextInput
                        style={[styles.input, styles.readOnly]}
                        value={`$${formData.unidadesInternas.costoPorUnidad?.toFixed(2) || '0.00'}`}
                        editable={false}
                      />
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Código de Barras (Unidad) *</Text>
                    <View style={styles.barcodeRow}>
                      <TextInput
                        style={[styles.input, styles.barcodeInput]}
                        value={formData.unidadesInternas.codigoBarras}
                        onChangeText={(text) => handleUnidadesInternasChange('codigoBarras', text)}
                        placeholder="7501234567890"
                      />
                      <TouchableOpacity
                        style={styles.scanButton}
                        onPress={() => handleOpenScanner('unidad')}
                      >
                        <Ionicons name="scan" size={24} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Nombre de Unidad (Opcional)</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.unidadesInternas.nombre}
                      onChangeText={(text) => handleUnidadesInternasChange('nombre', text)}
                      placeholder="Ej: Botella Coca-Cola 12oz"
                    />
                  </View>

                  <View style={styles.infoBox}>
                    <Ionicons name="information-circle" size={20} color="#f59e0b" />
                    <Text style={styles.infoText}>
                      Se creará automáticamente un producto secundario con el código de barras de la unidad interna.
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Notas */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Notas Adicionales</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.notas}
                onChangeText={(text) => handleInputChange('notas', text)}
                placeholder="Información adicional sobre el producto"
                multiline
                numberOfLines={3}
              />
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={handleSave}>
              <Text style={styles.saveButtonText}>Guardar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContainer: { height: '90%', backgroundColor: '#f8fafc', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#1e293b' },
  formContainer: { paddingBottom: 20 },
  inputGroup: { marginBottom: 15 },
  label: { fontSize: 16, color: '#475569', marginBottom: 8, fontWeight: '500' },
  input: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: '#1e293b' },
  textArea: { height: 80, textAlignVertical: 'top' },
  readOnly: { backgroundColor: '#f1f5f9', color: '#64748b' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 0 },
  halfWidth: { width: '48%' },
  pickerContainer: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, overflow: 'hidden' },
  picker: { height: 50 },
  barcodeRow: { flexDirection: 'row', gap: 8 },
  barcodeInput: { flex: 1 },
  scanButton: { backgroundColor: '#3b82f6', borderRadius: 8, width: 50, justifyContent: 'center', alignItems: 'center' },
  sectionContainer: { backgroundColor: '#dbeafe', borderLeftWidth: 4, borderLeftColor: '#3b82f6', borderRadius: 8, padding: 15, marginBottom: 15, marginTop: 10 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e40af', marginBottom: 15 },
  subsectionTitle: { fontSize: 16, fontWeight: '600', color: '#475569', marginBottom: 10 },
  switchContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 10 },
  unidadesContainer: { backgroundColor: '#f8fafc', borderLeftWidth: 2, borderLeftColor: '#cbd5e1', padding: 15, borderRadius: 8, marginTop: 10 },
  infoBox: { backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fde68a', borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'flex-start', marginTop: 10 },
  infoText: { flex: 1, fontSize: 13, color: '#92400e', marginLeft: 8 },
  scannerContainer: { flex: 1, backgroundColor: '#000' },
  scannerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  scannerText: { fontSize: 18, color: '#fff', fontWeight: 'bold', textAlign: 'center', marginBottom: 20, paddingHorizontal: 30 },
  cancelScanButton: { backgroundColor: '#ef4444', paddingVertical: 15, paddingHorizontal: 30, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  cancelScanText: { fontSize: 16, color: '#fff', fontWeight: 'bold' },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 15, marginTop: 10 },
  button: { paddingVertical: 12, paddingHorizontal: 25, borderRadius: 8, alignItems: 'center' },
  saveButton: { backgroundColor: '#1e40af' },
  saveButtonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  cancelButton: { marginRight: 10 },
  cancelButtonText: { color: '#475569', fontSize: 16, fontWeight: '500' },
});

export default ProductModal;
