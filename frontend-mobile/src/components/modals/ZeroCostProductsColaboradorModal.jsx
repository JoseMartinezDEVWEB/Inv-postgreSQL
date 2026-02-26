import React, { useState } from 'react'
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  Alert,
  Dimensions,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { showMessage } from 'react-native-flash-message'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')

const ZeroCostProductsColaboradorModal = ({ 
  visible, 
  onClose, 
  productos,
  onUpdateProducts
}) => {
  const [edits, setEdits] = useState({})

  // Filtrar productos con costo 0
  const productosConCostoZero = productos.filter(p => {
    const costo = Number(p.costo) || 0
    return costo === 0
  })

  const handleUpdateCost = (temporalId, field, value) => {
    setEdits(prev => ({
      ...prev,
      [temporalId]: {
        ...prev[temporalId],
        [field]: value
      }
    }))
  }

  const handleSave = () => {
    // Verificar que al menos un producto tenga costo válido
    const productosActualizados = productosConCostoZero.map(producto => {
      const editData = edits[producto.temporalId]
      if (editData && editData.costo && Number(editData.costo) > 0) {
        return {
          ...producto,
          costo: Number(editData.costo),
          cantidad: editData.cantidad ? Number(editData.cantidad) : producto.cantidad
        }
      }
      return producto
    }).filter(p => {
      const editData = edits[p.temporalId]
      return editData && editData.costo && Number(editData.costo) > 0
    })

    if (productosActualizados.length === 0) {
      Alert.alert('Aviso', 'Ingresa al menos un costo válido mayor a 0')
      return
    }

    // Llamar callback para actualizar productos
    onUpdateProducts(productosActualizados)
    
    showMessage({
      message: `${productosActualizados.length} producto(s) actualizado(s)`,
      type: 'success'
    })

    setEdits({})
    onClose()
  }

  const handleClose = () => {
    setEdits({})
    onClose()
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="alert-circle" size={24} color="#f59e0b" />
              <Text style={styles.title}>Productos Valor $0</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>
          
          {/* Subtitle */}
          <Text style={styles.subtitle}>
            Estos productos tienen costo $0. Edita el valor antes de sincronizar.
          </Text>

          {/* Content */}
          <ScrollView 
            style={styles.content} 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
          >
            {productosConCostoZero.length > 0 ? (
              productosConCostoZero.map((item, index) => {
                const editData = edits[item.temporalId] || {}
                const cantidad = editData.cantidad !== undefined ? editData.cantidad : item.cantidad
                const costo = editData.costo !== undefined ? editData.costo : item.costo
                const total = (Number(cantidad) || 0) * (Number(costo) || 0)

                return (
                  <View key={item.temporalId || index} style={styles.productItem}>
                    <View style={styles.productHeader}>
                      <Text style={styles.productName} numberOfLines={2}>
                        {item.nombre || 'Producto sin nombre'}
                      </Text>
                      <Text style={styles.productSku}>
                        {item.sku ? `SKU: ${item.sku}` : ''} 
                        {item.codigoBarras ? ` · CB: ${item.codigoBarras}` : ''}
                      </Text>
                    </View>

                    <View style={styles.inputsRow}>
                      <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Cantidad</Text>
                        <TextInput
                          style={styles.input}
                          keyboardType="numeric"
                          value={String(cantidad || '')}
                          onChangeText={(value) => handleUpdateCost(item.temporalId, 'cantidad', value)}
                          placeholder="0"
                          placeholderTextColor="#9ca3af"
                        />
                      </View>

                      <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Costo $</Text>
                        <TextInput
                          style={[styles.input, styles.costoInput]}
                          keyboardType="decimal-pad"
                          value={String(costo || '')}
                          onChangeText={(value) => handleUpdateCost(item.temporalId, 'costo', value)}
                          placeholder="0.00"
                          placeholderTextColor="#d97706"
                        />
                      </View>
                    </View>

                    <View style={styles.totalRow}>
                      <Text style={styles.totalLabel}>Total:</Text>
                      <Text style={styles.totalValue}>${total.toFixed(2)}</Text>
                    </View>
                  </View>
                )
              })
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="checkmark-circle" size={56} color="#22c55e" />
                <Text style={styles.emptyText}>
                  Todos los productos tienen costo asignado
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Summary */}
          <View style={styles.summary}>
            <Text style={styles.summaryText}>
              Productos con valor 0: <Text style={styles.summaryBold}>{productosConCostoZero.length}</Text>
            </Text>
          </View>
          
          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            
            {productosConCostoZero.length > 0 && (
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSave}
              >
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={styles.saveButtonText}>Guardar Cambios</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  )
}

// Altura de cada producto item (aproximada)
const PRODUCT_ITEM_HEIGHT = 160

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '95%',
    maxWidth: 420,
    // Altura dinámica: mostrar 3 productos + header + footer
    // Si hay menos de 3, se ajusta automáticamente
    maxHeight: SCREEN_HEIGHT * 0.85,
    minHeight: Math.min(SCREEN_HEIGHT * 0.6, 500),
    backgroundColor: '#ffffff',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fffbeb',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#92400e',
  },
  closeButton: {
    padding: 6,
    backgroundColor: '#fef3c7',
    borderRadius: 20,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#f8fafc',
    lineHeight: 20,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  productItem: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 2,
    borderColor: '#fcd34d',
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  productHeader: {
    marginBottom: 14,
  },
  productName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 6,
  },
  productSku: {
    fontSize: 13,
    color: '#64748b',
  },
  inputsRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 14,
  },
  inputContainer: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  input: {
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '600',
    backgroundColor: '#f9fafb',
    textAlign: 'center',
  },
  costoInput: {
    borderColor: '#f59e0b',
    backgroundColor: '#fffbeb',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  totalLabel: {
    fontSize: 15,
    color: '#64748b',
    fontWeight: '600',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f766e',
  },
  emptyContainer: {
    padding: 50,
    alignItems: 'center',
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
  summary: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#fef3c7',
  },
  summaryText: {
    fontSize: 14,
    color: '#92400e',
    textAlign: 'center',
    fontWeight: '500',
  },
  summaryBold: {
    fontWeight: 'bold',
    color: '#b45309',
    fontSize: 16,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1.5,
    flexDirection: 'row',
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
})

export default ZeroCostProductsColaboradorModal
