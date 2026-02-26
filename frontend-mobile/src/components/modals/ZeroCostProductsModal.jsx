import React, { useState } from 'react'
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  ScrollView,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useMutation, useQueryClient } from 'react-query'
import { sesionesApi, handleApiError } from '../../services/api'
import { showMessage } from 'react-native-flash-message'

const { width, height } = Dimensions.get('window')

const ZeroCostProductsModal = ({ 
  visible, 
  onClose, 
  productos, 
  sesionId,
  zeroCostProductsEdits,
  setZeroCostProductsEdits 
}) => {
  const [isUpdating, setIsUpdating] = useState(false)
  const queryClient = useQueryClient()


  // Mutación para actualizar productos
  const updateProductMutation = useMutation(
    ({ productId, ...updateData }) => sesionesApi.updateProduct(sesionId, productId, updateData),
    {
      onError: handleApiError
    }
  )

  const handleUpdateCosts = async () => {
    setIsUpdating(true)
    try {
      // Filtrar solo los productos que tienen cambios válidos
      const updates = Object.entries(zeroCostProductsEdits)
        .filter(([_, data]) => {
          const costo = Number(data?.costo || 0)
          const cantidad = Number(data?.cantidad || 0)
          return costo > 0 && cantidad > 0
        })
      
      if (updates.length === 0) {
        Alert.alert('Error', 'Ingresa al menos un costo y cantidad válidos')
        setIsUpdating(false)
        return
      }
      
      // Actualizar cada producto
      for (const [productKey, data] of updates) {
        const updateData = {}
        if (data.costo !== undefined) {
          updateData.costoProducto = Number(data.costo)
        }
        if (data.cantidad !== undefined) {
          updateData.cantidadContada = Number(data.cantidad)
        }
        await updateProductMutation.mutateAsync({
          productId: productKey,
          ...updateData
        })
      }
      
      // Refrescar datos de la sesión
      queryClient.invalidateQueries(['sesion', sesionId])
      
      onClose()
      setZeroCostProductsEdits({})
      showMessage({ 
        message: `${updates.length} producto(s) actualizado(s) correctamente`, 
        type: 'success' 
      })
      
    } catch (error) {
      console.error('❌ Error actualizando productos:', error)
      handleApiError(error)
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Productos con Valor 0</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>
          
          {/* Subtitle */}
          <Text style={styles.subtitle}>
            Asigna costos a los productos que tienen valor 0
          </Text>

          {/* Main Content Area */}
          <ScrollView style={styles.mainContent}>
            {productos.length > 0 ? (
              productos.map((item, index) => (
                <View key={item._id || index} style={styles.productItem}>
                  <Text style={styles.productName}>
                    {item.nombreProducto || 'Producto sin nombre'}
                  </Text>
                  <Text style={styles.productSku}>
                    SKU: {item.skuProducto || 'N/A'}
                  </Text>

                  <View style={styles.inputsRow}>
                    <View style={styles.inputContainer}>
                      <Text style={styles.inputLabel}>Cantidad</Text>
                      <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        value={String(zeroCostProductsEdits[item._id]?.cantidad || item.cantidadContada || 0)}
                        onChangeText={(value) => {
                          setZeroCostProductsEdits(prev => ({
                            ...prev,
                            [item._id]: {
                              ...prev[item._id],
                              cantidad: value
                            }
                          }))
                        }}
                      />
                    </View>

                    <View style={styles.inputContainer}>
                      <Text style={styles.inputLabel}>Costo</Text>
                      <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        value={String(zeroCostProductsEdits[item._id]?.costo || item.costoProducto || 0)}
                        onChangeText={(value) => {
                          setZeroCostProductsEdits(prev => ({
                            ...prev,
                            [item._id]: {
                              ...prev[item._id],
                              costo: value
                            }
                          }))
                        }}
                      />
                    </View>
                  </View>

                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total:</Text>
                    <Text style={styles.totalValue}>
                      ${(Number(zeroCostProductsEdits[item._id]?.cantidad || item.cantidadContada || 0) *
                          Number(zeroCostProductsEdits[item._id]?.costo || item.costoProducto || 0)).toFixed(2)}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No hay productos con costo 0</Text>
              </View>
            )}
            </ScrollView>

          {/* Summary */}
          <View style={styles.summary}>
            <Text style={styles.summaryText}>
              Total de productos: <Text style={styles.summaryBold}>{productos.length}</Text>
            </Text>
          </View>
          
          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={isUpdating}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.updateButton, isUpdating && styles.updateButtonDisabled]}
              onPress={handleUpdateCosts}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.updateButtonText}>Actualizar Costos</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 5,
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  closeButton: {
    padding: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  mainContent: {
    flex: 1,
    padding: 15,
  },
  productItem: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  productHeader: {
    marginBottom: 12,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  productSku: {
    fontSize: 12,
    color: '#64748b',
  },
  inputsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#ffffff',
    textAlign: 'center',
  },
  inputsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    gap: 10,
  },
  inputContainer: {
    flex: 1,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  summary: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  summaryText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  summaryBold: {
    fontWeight: 'bold',
    color: '#1e293b',
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  updateButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
  },
  updateButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  updateButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
})

export default ZeroCostProductsModal
