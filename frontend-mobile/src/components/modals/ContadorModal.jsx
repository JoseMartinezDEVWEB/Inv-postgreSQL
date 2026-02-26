import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Dimensions,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { Picker } from '@react-native-picker/picker'

const { width, height } = Dimensions.get('window')

const ContadorModal = ({ visible, onClose, onSave, initialData }) => {
  const [contadorData, setContadorData] = useState({
    costoServicio: 0,
    fechaInventario: new Date().toISOString().split('T')[0],
    periodicidad: 'mensual',
    proximaFecha: '',
    notas: '',
    ...initialData
  })

  // Opciones de periodicidad
  const periodicidadOptions = [
    { label: 'Mensual', value: 'mensual', meses: 1 },
    { label: 'Bimestral', value: 'bimestral', meses: 2 },
    { label: 'Trimestral', value: 'trimestral', meses: 3 },
    { label: 'Semestral', value: 'semestral', meses: 6 },
    { label: 'Anual', value: 'anual', meses: 12 }
  ]

  // Calcular próxima fecha automáticamente
  useEffect(() => {
    if (contadorData.fechaInventario && contadorData.periodicidad) {
      calcularProximaFecha()
    }
  }, [contadorData.fechaInventario, contadorData.periodicidad])

  const calcularProximaFecha = () => {
    const fechaActual = new Date(contadorData.fechaInventario)
    const periodicidad = periodicidadOptions.find(p => p.value === contadorData.periodicidad)
    
    if (fechaActual && periodicidad) {
      const proximaFecha = new Date(fechaActual)
      proximaFecha.setMonth(proximaFecha.getMonth() + periodicidad.meses)
      
      setContadorData(prev => ({
        ...prev,
        proximaFecha: proximaFecha.toISOString().split('T')[0]
      }))
    }
  }

  // Validar y guardar
  const handleSave = () => {
    if (!contadorData.costoServicio || contadorData.costoServicio <= 0) {
      Alert.alert('Error', 'Ingresa un costo de servicio válido')
      return
    }

    if (!contadorData.fechaInventario) {
      Alert.alert('Error', 'Selecciona la fecha del inventario')
      return
    }

    onSave(contadorData)
    onClose()
  }

  // Actualizar campo
  const updateField = (field, value) => {
    setContadorData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // Formatear fecha para mostrar
  const formatDate = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  // Calcular costo por día
  const calcularCostoPorDia = () => {
    const periodicidad = periodicidadOptions.find(p => p.value === contadorData.periodicidad)
    if (periodicidad && contadorData.costoServicio) {
      const diasEnPeriodo = periodicidad.meses * 30 // Aproximado
      return (contadorData.costoServicio / diasEnPeriodo).toFixed(2)
    }
    return '0.00'
  }

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <LinearGradient colors={['#f59e0b', '#d97706']} style={styles.modalHeader}>
            <View style={styles.headerContent}>
              <View style={styles.headerLeft}>
                <Ionicons name="calendar" size={24} color="#ffffff" />
                <Text style={styles.modalTitle}>Datos del Contador</Text>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Información del Contador */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Información del Contador</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Costo del Servicio</Text>
                <View style={styles.currencyInput}>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput
                    style={[styles.input, styles.currencyInputField]}
                    placeholder="0.00"
                    keyboardType="numeric"
                    value={contadorData.costoServicio.toString()}
                    onChangeText={(text) => updateField('costoServicio', parseFloat(text) || 0)}
                  />
                </View>
                <Text style={styles.dateHelper}>
                  Este costo aparecerá en la portada del reporte
                </Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Fecha del Inventario</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  value={contadorData.fechaInventario}
                  onChangeText={(text) => updateField('fechaInventario', text)}
                />
                <Text style={styles.dateHelper}>
                  {formatDate(contadorData.fechaInventario)}
                </Text>
              </View>
            </View>

            {/* Periodicidad */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Periodicidad</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Frecuencia de Inventarios</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={contadorData.periodicidad}
                    onValueChange={(value) => updateField('periodicidad', value)}
                    style={styles.picker}
                  >
                    {periodicidadOptions.map((option) => (
                      <Picker.Item
                        key={option.value}
                        label={option.label}
                        value={option.value}
                      />
                    ))}
                  </Picker>
                </View>
              </View>

              <View style={styles.periodicidadInfo}>
                <View style={styles.infoCard}>
                  <Ionicons name="time" size={20} color="#f59e0b" />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Costo por día</Text>
                    <Text style={styles.infoValue}>${calcularCostoPorDia()}</Text>
                  </View>
                </View>
                
                <View style={styles.infoCard}>
                  <Ionicons name="calendar" size={20} color="#f59e0b" />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Próximo inventario</Text>
                    <Text style={styles.infoValue}>
                      {contadorData.proximaFecha || 'No calculado'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Programación */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Programación</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Próxima Fecha de Inventario</Text>
                <TextInput
                  style={[styles.input, styles.readOnlyInput]}
                  placeholder="Se calcula automáticamente"
                  value={contadorData.proximaFecha}
                  editable={false}
                />
                <Text style={styles.dateHelper}>
                  {formatDate(contadorData.proximaFecha)}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.recalculateButton}
                onPress={calcularProximaFecha}
              >
                <Ionicons name="refresh" size={20} color="#ffffff" />
                <Text style={styles.recalculateButtonText}>Recalcular Fecha</Text>
              </TouchableOpacity>
            </View>

            {/* Notas */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Notas Adicionales</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Notas sobre el contador, observaciones especiales, etc..."
                multiline
                numberOfLines={4}
                value={contadorData.notas}
                onChangeText={(text) => updateField('notas', text)}
              />
            </View>

            {/* Resumen */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Resumen</Text>
              <View style={styles.resumenCard}>
                <View style={styles.resumenRow}>
                  <Text style={styles.resumenLabel}>Costo Servicio:</Text>
                  <Text style={styles.resumenValue}>
                    ${contadorData.costoServicio.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.resumenRow}>
                  <Text style={styles.resumenLabel}>Periodicidad:</Text>
                  <Text style={styles.resumenValue}>
                    {periodicidadOptions.find(p => p.value === contadorData.periodicidad)?.label}
                  </Text>
                </View>
                <View style={styles.resumenRow}>
                  <Text style={styles.resumenLabel}>Costo Diario:</Text>
                  <Text style={styles.resumenValue}>${calcularCostoPorDia()}</Text>
                </View>
                <View style={styles.resumenRow}>
                  <Text style={styles.resumenLabel}>Próximo Inventario:</Text>
                  <Text style={styles.resumenValue}>
                    {contadorData.proximaFecha || 'No programado'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Recordatorios */}
            <View style={styles.section}>
              <View style={styles.reminderCard}>
                <Ionicons name="information-circle" size={24} color="#3b82f6" />
                <View style={styles.reminderContent}>
                  <Text style={styles.reminderTitle}>Recordatorio</Text>
                  <Text style={styles.reminderText}>
                    El sistema calculará automáticamente la próxima fecha de inventario 
                    basándose en la periodicidad seleccionada. Puedes modificar estas 
                    fechas manualmente si es necesario.
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>Guardar Configuración</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: width * 0.95,
    maxHeight: height * 0.9,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
  },
  modalHeader: {
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginLeft: 10,
  },
  closeButton: {
    padding: 5,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginVertical: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 15,
  },
  inputGroup: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#ffffff',
  },
  readOnlyInput: {
    backgroundColor: '#f9fafb',
    color: '#6b7280',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  currencyInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#ffffff',
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#374151',
    paddingHorizontal: 12,
  },
  currencyInputField: {
    flex: 1,
    borderWidth: 0,
    paddingLeft: 0,
  },
  dateHelper: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 5,
    fontStyle: 'italic',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#ffffff',
  },
  picker: {
    height: 50,
  },
  periodicidadInfo: {
    marginTop: 15,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  infoContent: {
    marginLeft: 10,
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#92400e',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: 'bold',
    marginTop: 2,
  },
  recalculateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f59e0b',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  recalculateButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  resumenCard: {
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  resumenRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  resumenLabel: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  resumenValue: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: 'bold',
  },
  reminderCard: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  reminderContent: {
    marginLeft: 10,
    flex: 1,
  },
  reminderTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 5,
  },
  reminderText: {
    fontSize: 12,
    color: '#374151',
    lineHeight: 16,
  },
  modalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    marginRight: 10,
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
})

export default ContadorModal
