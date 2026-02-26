import React, { useState } from 'react'
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

const { width, height } = Dimensions.get('window')

const DistribucionModal = ({ visible, onClose, onSave, initialData }) => {
  const [distribucionData, setDistribucionData] = useState({
    totalUtilidadesNetas: 0,
    numeroSocios: 2,
    socios: [
      { nombre: '', porcentaje: 50, utilidadPeriodo: 0, utilidadAcumulada: 0, cuentaAdeudada: 0 },
      { nombre: '', porcentaje: 50, utilidadPeriodo: 0, utilidadAcumulada: 0, cuentaAdeudada: 0 }
    ],
    fechaDesde: '',
    fechaHasta: '',
    comentarios: '',
    ...initialData
  })

  // Agregar socio
  const agregarSocio = () => {
    if (distribucionData.numeroSocios >= 6) {
      Alert.alert('Límite alcanzado', 'Máximo 6 socios permitidos')
      return
    }

    const nuevoNumero = distribucionData.numeroSocios + 1
    const porcentajeBase = Math.floor(100 / nuevoNumero)
    const nuevosPocentajes = distribucionData.socios.map(() => porcentajeBase)
    
    setDistribucionData(prev => ({
      ...prev,
      numeroSocios: nuevoNumero,
      socios: [
        ...prev.socios.map((socio, index) => ({
          ...socio,
          porcentaje: nuevosPocentajes[index]
        })),
        { 
          nombre: '', 
          porcentaje: porcentajeBase, 
          utilidadPeriodo: 0, 
          utilidadAcumulada: 0, 
          cuentaAdeudada: 0 
        }
      ]
    }))
  }

  // Eliminar socio
  const eliminarSocio = (index) => {
    if (distribucionData.numeroSocios <= 2) {
      Alert.alert('Mínimo requerido', 'Mínimo 2 socios requeridos')
      return
    }

    const nuevosSocios = distribucionData.socios.filter((_, i) => i !== index)
    const nuevoNumero = distribucionData.numeroSocios - 1
    const porcentajeBase = Math.floor(100 / nuevoNumero)
    
    setDistribucionData(prev => ({
      ...prev,
      numeroSocios: nuevoNumero,
      socios: nuevosSocios.map(socio => ({
        ...socio,
        porcentaje: porcentajeBase
      }))
    }))
  }

  // Actualizar socio
  const actualizarSocio = (index, campo, valor) => {
    setDistribucionData(prev => ({
      ...prev,
      socios: prev.socios.map((socio, i) => 
        i === index ? { ...socio, [campo]: valor } : socio
      )
    }))
  }

  // Calcular utilidades automáticamente
  const calcularUtilidades = () => {
    const totalUtilidades = parseFloat(distribucionData.totalUtilidadesNetas) || 0
    
    setDistribucionData(prev => ({
      ...prev,
      socios: prev.socios.map(socio => ({
        ...socio,
        utilidadPeriodo: (totalUtilidades * socio.porcentaje) / 100
      }))
    }))
  }

  // Validar y guardar
  const handleSave = () => {
    const totalPorcentaje = distribucionData.socios.reduce((sum, socio) => sum + socio.porcentaje, 0)
    
    if (totalPorcentaje !== 100) {
      Alert.alert('Error', 'La suma de porcentajes debe ser 100%')
      return
    }

    const sociosSinNombre = distribucionData.socios.filter(socio => !socio.nombre.trim())
    if (sociosSinNombre.length > 0) {
      Alert.alert('Error', 'Todos los socios deben tener nombre')
      return
    }

    onSave(distribucionData)
    onClose()
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
          <LinearGradient colors={['#22c55e', '#16a34a']} style={styles.modalHeader}>
            <View style={styles.headerContent}>
              <View style={styles.headerLeft}>
                <Ionicons name="calculator" size={24} color="#ffffff" />
                <Text style={styles.modalTitle}>Distribución de Saldo</Text>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Configuración general */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Configuración General</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Total Utilidades Netas</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.00"
                  keyboardType="numeric"
                  value={distribucionData.totalUtilidadesNetas.toString()}
                  onChangeText={(text) => setDistribucionData(prev => ({
                    ...prev,
                    totalUtilidadesNetas: parseFloat(text) || 0
                  }))}
                />
              </View>

              <View style={styles.dateRow}>
                <View style={styles.dateInput}>
                  <Text style={styles.inputLabel}>Fecha Desde</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="YYYY-MM-DD"
                    value={distribucionData.fechaDesde}
                    onChangeText={(text) => setDistribucionData(prev => ({
                      ...prev,
                      fechaDesde: text
                    }))}
                  />
                </View>
                <View style={styles.dateInput}>
                  <Text style={styles.inputLabel}>Fecha Hasta</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="YYYY-MM-DD"
                    value={distribucionData.fechaHasta}
                    onChangeText={(text) => setDistribucionData(prev => ({
                      ...prev,
                      fechaHasta: text
                    }))}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={styles.calculateButton}
                onPress={calcularUtilidades}
              >
                <Ionicons name="calculator" size={20} color="#ffffff" />
                <Text style={styles.calculateButtonText}>Calcular Utilidades</Text>
              </TouchableOpacity>
            </View>

            {/* Socios */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  Socios ({distribucionData.numeroSocios})
                </Text>
                <TouchableOpacity
                  style={styles.addSocioButton}
                  onPress={agregarSocio}
                >
                  <Ionicons name="add" size={20} color="#22c55e" />
                  <Text style={styles.addSocioText}>Agregar</Text>
                </TouchableOpacity>
              </View>

              {distribucionData.socios.map((socio, index) => (
                <View key={index} style={styles.socioCard}>
                  <View style={styles.socioHeader}>
                    <Text style={styles.socioTitle}>Socio {index + 1}</Text>
                    {distribucionData.numeroSocios > 2 && (
                      <TouchableOpacity
                        style={styles.deleteSocioButton}
                        onPress={() => eliminarSocio(index)}
                      >
                        <Ionicons name="trash" size={16} color="#ef4444" />
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.socioInputs}>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Nombre</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Nombre del socio"
                        value={socio.nombre}
                        onChangeText={(text) => actualizarSocio(index, 'nombre', text)}
                      />
                    </View>

                    <View style={styles.inputRow}>
                      <View style={styles.inputHalf}>
                        <Text style={styles.inputLabel}>Porcentaje (%)</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="0"
                          keyboardType="numeric"
                          value={socio.porcentaje.toString()}
                          onChangeText={(text) => actualizarSocio(index, 'porcentaje', parseFloat(text) || 0)}
                        />
                      </View>
                      <View style={styles.inputHalf}>
                        <Text style={styles.inputLabel}>Utilidad Período</Text>
                        <TextInput
                          style={[styles.input, styles.readOnlyInput]}
                          placeholder="0.00"
                          value={socio.utilidadPeriodo.toFixed(2)}
                          editable={false}
                        />
                      </View>
                    </View>

                    <View style={styles.inputRow}>
                      <View style={styles.inputHalf}>
                        <Text style={styles.inputLabel}>Utilidad Acumulada</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="0.00"
                          keyboardType="numeric"
                          value={socio.utilidadAcumulada.toString()}
                          onChangeText={(text) => actualizarSocio(index, 'utilidadAcumulada', parseFloat(text) || 0)}
                        />
                      </View>
                      <View style={styles.inputHalf}>
                        <Text style={styles.inputLabel}>Cuenta Adeudada</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="0.00"
                          keyboardType="numeric"
                          value={socio.cuentaAdeudada.toString()}
                          onChangeText={(text) => actualizarSocio(index, 'cuentaAdeudada', parseFloat(text) || 0)}
                        />
                      </View>
                    </View>

                    {/* Saldo Neto */}
                    <View style={styles.saldoNetoContainer}>
                      <Text style={styles.saldoNetoLabel}>Saldo Neto:</Text>
                      <Text style={[
                        styles.saldoNetoValue,
                        { color: (socio.utilidadAcumulada - socio.cuentaAdeudada) < 0 ? '#ef4444' : '#22c55e' }
                      ]}>
                        ${((socio.utilidadAcumulada || 0) - (socio.cuentaAdeudada || 0)).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Text>
                    </View>

                    {/* Línea para Firma */}
                    <View style={styles.firmaContainer}>
                      <View style={styles.firmaLinea} />
                      <Text style={styles.firmaTexto}>Firma y Cédula</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>

            {/* Comentarios */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Comentarios</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Notas adicionales sobre la distribución..."
                multiline
                numberOfLines={4}
                value={distribucionData.comentarios}
                onChangeText={(text) => setDistribucionData(prev => ({
                  ...prev,
                  comentarios: text
                }))}
              />
            </View>

            {/* Resumen */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Resumen</Text>
              <View style={styles.resumenCard}>
                <View style={styles.resumenRow}>
                  <Text style={styles.resumenLabel}>Total Utilidades:</Text>
                  <Text style={styles.resumenValue}>
                    ${distribucionData.totalUtilidadesNetas.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.resumenRow}>
                  <Text style={styles.resumenLabel}>Total Porcentajes:</Text>
                  <Text style={[
                    styles.resumenValue,
                    { color: distribucionData.socios.reduce((sum, socio) => sum + socio.porcentaje, 0) === 100 ? '#22c55e' : '#ef4444' }
                  ]}>
                    {distribucionData.socios.reduce((sum, socio) => sum + socio.porcentaje, 0)}%
                  </Text>
                </View>
                <View style={styles.resumenRow}>
                  <Text style={styles.resumenLabel}>Número de Socios:</Text>
                  <Text style={styles.resumenValue}>{distribucionData.numeroSocios}</Text>
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
              <Text style={styles.saveButtonText}>Guardar Distribución</Text>
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
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
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  dateInput: {
    flex: 1,
    marginHorizontal: 5,
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inputHalf: {
    flex: 1,
    marginHorizontal: 5,
  },
  calculateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  calculateButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  addSocioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  addSocioText: {
    color: '#22c55e',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 5,
  },
  socioCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  socioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  socioTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  deleteSocioButton: {
    padding: 5,
  },
  socioInputs: {
    gap: 10,
  },
  resumenCard: {
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: '#bae6fd',
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
    backgroundColor: '#22c55e',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Estilos para Saldo Neto
  saldoNetoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  saldoNetoLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#374151',
  },
  saldoNetoValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Estilos para Firma
  firmaContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  firmaLinea: {
    width: '80%',
    height: 2,
    backgroundColor: '#6b7280',
    marginBottom: 8,
  },
  firmaTexto: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
  },
})

export default DistribucionModal
