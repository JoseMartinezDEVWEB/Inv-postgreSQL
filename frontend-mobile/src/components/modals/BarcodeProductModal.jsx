import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Modal para agregar cantidad y costo después de escanear código de barras
 */
const BarcodeProductModal = ({ 
  visible, 
  onClose, 
  producto, 
  codigoBarras,
  onConfirm,
  costoInicial = '',
  cantidadInicial = '1',
  cantidadAnterior = null // Nueva prop para cantidad del inventario importado
}) => {
  const [cantidad, setCantidad] = useState(cantidadInicial);
  const [costo, setCosto] = useState(costoInicial);

  useEffect(() => {
    if (visible && producto) {
      // Si el producto tiene costo, usarlo como valor inicial
      const costoProducto = producto.costo || producto.costoBase || '';
      setCosto(costoProducto ? String(costoProducto) : '');
      // Si hay cantidad anterior del inventario importado, usarla como valor inicial
      setCantidad(cantidadAnterior ? String(cantidadAnterior) : (cantidadInicial || '1'));
    }
  }, [visible, producto, cantidadInicial, cantidadAnterior]);

  const handleConfirm = () => {
    const cantidadNum = parseFloat(cantidad) || 1;
    const costoNum = parseFloat(costo) || 0;

    if (cantidadNum <= 0) {
      return; // Validación básica - el componente padre puede manejar mejor
    }

    onConfirm({
      cantidad: cantidadNum,
      costo: costoNum,
    });
  };

  const handleClose = () => {
    setCantidad('1');
    setCosto('');
    onClose();
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <View style={styles.modalContainer}>
            <View style={styles.header}>
              <View style={styles.headerContent}>
                <Ionicons name="barcode" size={24} color="#3b82f6" />
                <Text style={styles.title}>Agregar Producto</Text>
              </View>
              <TouchableOpacity onPress={handleClose}>
                <Ionicons name="close-circle" size={28} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.content} 
              contentContainerStyle={styles.contentContainer}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
              keyboardShouldPersistTaps="handled"
            >
              {/* Información del producto */}
              {producto ? (
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>{producto.nombre || 'Producto'}</Text>
                  <View style={styles.productDetails}>
                    {producto.sku && (
                      <View style={styles.detailRow}>
                        <Ionicons name="pricetag-outline" size={16} color="#64748b" />
                        <Text style={styles.productSku}>SKU: {producto.sku}</Text>
                      </View>
                    )}
                    {codigoBarras && (
                      <View style={styles.detailRow}>
                        <Ionicons name="barcode-outline" size={16} color="#64748b" />
                        <Text style={styles.productCode}>Código: {codigoBarras}</Text>
                      </View>
                    )}
                    {producto.descripcion && (
                      <View style={styles.detailRow}>
                        <Ionicons name="document-text-outline" size={16} color="#64748b" />
                        <Text style={styles.productDescription}>{producto.descripcion}</Text>
                      </View>
                    )}
                    {producto.categoria && (
                      <View style={styles.detailRow}>
                        <Ionicons name="folder-outline" size={16} color="#64748b" />
                        <Text style={styles.productCategory}>Categoría: {producto.categoria}</Text>
                      </View>
                    )}
                    {(producto.costo || producto.costoBase) && (
                      <View style={styles.detailRow}>
                        <Ionicons name="cash-outline" size={16} color="#10b981" />
                        <Text style={styles.productCost}>
                          Costo sugerido: ${(producto.costo || producto.costoBase || 0).toFixed(2)}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              ) : (
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>Nuevo Producto</Text>
                  {codigoBarras && (
                    <View style={styles.detailRow}>
                      <Ionicons name="barcode-outline" size={16} color="#64748b" />
                      <Text style={styles.productCode}>Código: {codigoBarras}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Campos de entrada */}
              <View style={styles.form}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Cantidad *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="1"
                    keyboardType="numeric"
                    value={cantidad}
                    onChangeText={setCantidad}
                    autoFocus
                    selectTextOnFocus
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Costo por unidad</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    value={costo}
                    onChangeText={setCosto}
                  />
                </View>

                {/* Cálculo total */}
                <View style={styles.totalContainer}>
                  <Text style={styles.totalLabel}>Total:</Text>
                  <Text style={styles.totalValue}>
                    ${((parseFloat(cantidad) || 0) * (parseFloat(costo) || 0)).toFixed(2)}
                  </Text>
                </View>
              </View>
            </ScrollView>

            {/* Botones */}
            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={handleClose}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.confirmButton]}
                onPress={handleConfirm}
              >
                <Ionicons name="add-circle" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.confirmButtonText}>Agregar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  keyboardView: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    justifyContent: 'center',
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    width: '100%',
    maxHeight: '90%',
    minHeight: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexShrink: 0,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  content: {
    flex: 1,
    minHeight: 200,
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 8,
  },
  productInfo: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 20,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  productName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 16,
    lineHeight: 26,
  },
  productDetails: {
    gap: 10,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  productCode: {
    fontSize: 15,
    color: '#64748b',
    flex: 1,
  },
  productSku: {
    fontSize: 15,
    color: '#64748b',
    flex: 1,
  },
  productDescription: {
    fontSize: 14,
    color: '#64748b',
    flex: 1,
    fontStyle: 'italic',
  },
  productCategory: {
    fontSize: 14,
    color: '#64748b',
    flex: 1,
  },
  productCost: {
    fontSize: 15,
    color: '#10b981',
    fontWeight: '600',
    flex: 1,
  },
  cantidadAnteriorRow: {
    backgroundColor: '#fef3c7',
    padding: 8,
    borderRadius: 8,
    marginTop: 4,
  },
  cantidadAnterior: {
    fontSize: 14,
    color: '#92400e',
    fontWeight: '600',
    flex: 1,
  },
  form: {
    gap: 24,
  },
  inputGroup: {
    gap: 10,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    color: '#1e293b',
    minHeight: 56,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#0ea5e9',
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0369a1',
  },
  totalValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0369a1',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    flexShrink: 0,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  cancelButton: {
    backgroundColor: '#f1f5f9',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
  confirmButton: {
    backgroundColor: '#3b82f6',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});

export default BarcodeProductModal;

