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

const FinancialModal = ({ visible, onClose, onSave, initialData, sesionData, modalType }) => {
  const [formData, setFormData] = useState({})
  const [editingField, setEditingField] = useState(null)
  const [modoMultipleGastos, setModoMultipleGastos] = useState(false)
  const [gastosDetalle, setGastosDetalle] = useState([])

  useEffect(() => {
    if (!visible) {
      setModoMultipleGastos(false)
      setGastosDetalle([])
      setFormData({})
    }
  }, [visible])

  const modalConfig = {
    ventas: {
      title: 'Ventas del Mes',
      icon: 'cart-outline',
      fields: [
        { key: 'monto', label: 'Monto Total', type: 'number', placeholder: '0.00' },
        { key: 'fecha', label: 'Fecha', type: 'date' },
        { key: 'descripcion', label: 'Descripción', type: 'text', placeholder: 'Descripción de las ventas' }
      ]
    },
    gastos: {
      title: 'Gastos Generales',
      icon: 'trending-down-outline',
      fields: [
        { key: 'agregarMultiple', label: 'Agregar varios gastos', type: 'checkbox' },
        { key: 'monto', label: 'Monto Total', type: 'number', placeholder: '0.00' },
        { key: 'fecha', label: 'Fecha', type: 'date' },
        { key: 'categoria', label: 'Categoría', type: 'select', options: ['Operativos', 'Administrativos', 'Ventas', 'Otros'] },
        { key: 'descripcion', label: 'Descripción', type: 'text', placeholder: 'Descripción del gasto' }
      ]
    },
    cuentasPorCobrar: {
      title: 'Cuentas por Cobrar',
      icon: 'people-outline',
      fields: [
        { key: 'cliente', label: 'Cliente', type: 'text', placeholder: 'Nombre del cliente' },
        { key: 'monto', label: 'Monto', type: 'number', placeholder: '0.00' },
        { key: 'fechaVencimiento', label: 'Fecha de Vencimiento', type: 'date' },
        { key: 'descripcion', label: 'Descripción', type: 'text', placeholder: 'Concepto de la cuenta' }
      ]
    },
    cuentasPorPagar: {
      title: 'Cuentas por Pagar',
      icon: 'card-outline',
      fields: [
        { key: 'proveedor', label: 'Proveedor', type: 'text', placeholder: 'Nombre del proveedor' },
        { key: 'monto', label: 'Monto', type: 'number', placeholder: '0.00' },
        { key: 'fechaVencimiento', label: 'Fecha de Vencimiento', type: 'date' },
        { key: 'descripcion', label: 'Descripción', type: 'text', placeholder: 'Concepto de la cuenta' }
      ]
    },
    efectivo: {
      title: 'Efectivo en Caja o Banco',
      icon: 'wallet-outline',
      fields: [
        { key: 'tipoCuenta', label: 'Tipo de Cuenta', type: 'select', options: ['Caja', 'Banco', 'Cuenta de Ahorros', 'Cuenta Corriente'] },
        { key: 'monto', label: 'Monto Disponible', type: 'number', placeholder: '0.00' },
        { key: 'fecha', label: 'Fecha de Corte', type: 'date' },
        { key: 'descripcion', label: 'Descripción', type: 'text', placeholder: 'Detalles adicionales' }
      ]
    },
    deudaANegocio: {
      title: 'Deuda a Negocio',
      icon: 'person-remove-outline',
      fields: [
        { key: 'esSocio', label: '¿Es Socio del Negocio?', type: 'boolean', required: true },
        { key: 'deudor', label: 'Deudor', type: 'conditional', placeholder: 'Nombre del deudor', required: true },
        { key: 'monto', label: 'Monto de la Deuda', type: 'number', placeholder: '0.00', required: true },
        { key: 'tipoDeuda', label: 'Tipo de Deuda', type: 'select', options: ['Dinero', 'Mercancía', 'Servicios', 'Otros'], required: true },
        { key: 'fechaDeuda', label: 'Fecha de la Deuda', type: 'date', required: false },
        { key: 'descripcion', label: 'Descripción', type: 'text', placeholder: 'Detalles de la deuda', required: false }
      ]
    },
    activosFijos: {
      title: 'Activos Fijos',
      icon: 'briefcase-outline',
      fields: [
        { key: 'nombreActivo', label: 'Nombre del Activo', type: 'text', placeholder: 'Ej: Maquinaria, Equipo, etc.' },
        { key: 'valorActual', label: 'Valor Actual', type: 'number', placeholder: '0.00' },
        { key: 'fechaAdquisicion', label: 'Fecha de Adquisición', type: 'date' },
        { key: 'descripcion', label: 'Descripción', type: 'text', placeholder: 'Detalles del activo' }
      ]
    },
    capital: {
      title: 'Capital',
      icon: 'server-outline',
      fields: [
        { key: 'tipoCapital', label: 'Tipo de Capital', type: 'select', options: ['Capital Social', 'Utilidades Retenidas', 'Reservas', 'Otros'] },
        { key: 'monto', label: 'Monto', type: 'number', placeholder: '0.00' },
        { key: 'fecha', label: 'Fecha', type: 'date' },
        { key: 'descripcion', label: 'Descripción', type: 'text', placeholder: 'Detalles del capital' }
      ]
    }
  };

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = () => {
    const updatedFinancialData = { 
      ...{
        ventasDelMes: 0,
        gastosGenerales: [],
        cuentasPorCobrar: [],
        cuentasPorPagar: [],
        efectivoEnCajaYBanco: [],
        deudaANegocio: [],
        activosFijos: 0
      },
      ...(initialData || {})
    };
    const amount = parseFloat(formData.monto) || 0;

    // Crear nueva entrada con todos los datos del formulario
    const newEntry = {
      monto: amount,
      fecha: formData.fecha || new Date().toISOString().split('T')[0],
      descripcion: formData.descripcion || '',
      id: Date.now() // ID único basado en timestamp
    };

    switch (modalType) {
      case 'ventas':
        updatedFinancialData.ventasDelMes = amount;
        break;
      case 'gastos':
        if (modoMultipleGastos && gastosDetalle.length > 0) {
          if (!Array.isArray(updatedFinancialData.gastosGenerales)) {
            updatedFinancialData.gastosGenerales = [];
          }
          updatedFinancialData.gastosGenerales = [...updatedFinancialData.gastosGenerales, ...gastosDetalle];
        } else {
          newEntry.categoria = formData.categoria || 'Otros';
          if (!Array.isArray(updatedFinancialData.gastosGenerales)) {
            updatedFinancialData.gastosGenerales = [];
          }
          updatedFinancialData.gastosGenerales.push(newEntry);
        }
        break;
      case 'cuentasPorCobrar':
        // Agregar cliente específico para cuentas por cobrar
        newEntry.cliente = formData.cliente || 'Cliente';
        newEntry.fechaVencimiento = formData.fechaVencimiento || '';
        // Asegurar que cuentasPorCobrar sea un array
        if (!Array.isArray(updatedFinancialData.cuentasPorCobrar)) {
          updatedFinancialData.cuentasPorCobrar = [];
        }
        updatedFinancialData.cuentasPorCobrar.push(newEntry);
        break;
      case 'cuentasPorPagar':
        // Agregar proveedor específico para cuentas por pagar
        newEntry.proveedor = formData.proveedor || 'Proveedor';
        newEntry.fechaVencimiento = formData.fechaVencimiento || '';
        // Asegurar que cuentasPorPagar sea un array
        if (!Array.isArray(updatedFinancialData.cuentasPorPagar)) {
          updatedFinancialData.cuentasPorPagar = [];
        }
        updatedFinancialData.cuentasPorPagar.push(newEntry);
        break;
      case 'efectivo':
        // Agregar tipo de cuenta específico para efectivo
        newEntry.tipoCuenta = formData.tipoCuenta || 'Caja';
        // Asegurar que efectivoEnCajaYBanco sea un array
        if (!Array.isArray(updatedFinancialData.efectivoEnCajaYBanco)) {
          updatedFinancialData.efectivoEnCajaYBanco = [];
        }
        updatedFinancialData.efectivoEnCajaYBanco.push(newEntry);
        break;
      case 'deudaANegocio':
        // Agregar campos específicos para deuda a negocio
        newEntry.deudor = formData.deudor || 'Deudor';
        newEntry.tipoDeuda = formData.tipoDeuda || 'Dinero';
        newEntry.esSocio = formData.esSocio || false;
        newEntry.fechaDeuda = formData.fechaDeuda || new Date().toISOString().split('T')[0];
        // Asegurar que deudaANegocio sea un array
        if (!Array.isArray(updatedFinancialData.deudaANegocio)) {
          updatedFinancialData.deudaANegocio = [];
        }
        updatedFinancialData.deudaANegocio.push(newEntry);
        break;
      case 'activosFijos':
        updatedFinancialData.activosFijos = amount;
        break;
      default:
        break;
    }

    onSave(updatedFinancialData);
    setFormData({}); // Limpiar el formulario
    onClose();
  };

  // No renderizar si no hay modalType válido
  if (!visible || !modalType || !modalConfig[modalType]) {
    return null
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
          <LinearGradient colors={['#8b5cf6', '#7c3aed']} style={styles.modalHeader}>
            <View style={styles.headerContent}>
              <View style={styles.headerLeft}>
                <Ionicons name={modalConfig[modalType].icon} size={24} color="#ffffff" />
                <Text style={styles.modalTitle}>{modalConfig[modalType].title}</Text>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.section}>
              {modalConfig[modalType].fields.map(field => {
                const isHiddenInMultipleMode = modoMultipleGastos && ['monto', 'fecha', 'categoria', 'descripcion'].includes(field.key)
                if (isHiddenInMultipleMode) return null
                
                return (
                <View key={field.key} style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>{field.label}</Text>
                  {field.type === 'checkbox' ? (
                    <TouchableOpacity 
                      style={[styles.checkboxContainer, modoMultipleGastos && styles.checkboxContainerSelected]}
                      onPress={() => {
                        const newMode = !modoMultipleGastos
                        setModoMultipleGastos(newMode)
                        if (newMode && gastosDetalle.length === 0) {
                          setGastosDetalle([{ id: Date.now(), descripcion: '', monto: 0, categoria: 'Otros', fecha: new Date().toISOString().split('T')[0] }])
                        }
                      }}
                    >
                      <Ionicons 
                        name={modoMultipleGastos ? 'checkbox' : 'square-outline'} 
                        size={24} 
                        color={modoMultipleGastos ? '#2563eb' : '#6b7280'} 
                      />
                      <Text style={[styles.checkboxLabel, modoMultipleGastos && styles.checkboxLabelSelected]}>
                        Agregar varios gastos con descripción y monto
                      </Text>
                    </TouchableOpacity>
                  ) : field.type === 'select' ? (
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={formData[field.key] || ''}
                        style={styles.picker}
                        onValueChange={(itemValue) => updateField(field.key, itemValue)}
                      >
                        <Picker.Item label="Seleccionar..." value="" />
                        {field.options.map((option, index) => (
                          <Picker.Item key={index} label={option} value={option} />
                        ))}
                      </Picker>
                    </View>
                  ) : field.type === 'boolean' ? (
                    <View style={styles.booleanContainer}>
                      <TouchableOpacity 
                        style={[styles.booleanOption, formData[field.key] === true && styles.booleanOptionSelected]}
                        onPress={() => updateField(field.key, true)}
                      >
                        <Text style={[styles.booleanText, formData[field.key] === true && styles.booleanTextSelected]}>Sí</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.booleanOption, formData[field.key] === false && styles.booleanOptionSelected]}
                        onPress={() => updateField(field.key, false)}
                      >
                        <Text style={[styles.booleanText, formData[field.key] === false && styles.booleanTextSelected]}>No</Text>
                      </TouchableOpacity>
                    </View>
                  ) : field.type === 'conditional' && field.key === 'deudor' ? (
                    formData.esSocio === true ? (
                      <View style={styles.pickerContainer}>
                        <Picker
                          selectedValue={formData[field.key] || ''}
                          style={styles.picker}
                          onValueChange={(itemValue) => updateField(field.key, itemValue)}
                        >
                          <Picker.Item label="Seleccionar socio..." value="" />
                          <Picker.Item label="Socio 1" value="Socio 1" />
                          <Picker.Item label="Socio 2" value="Socio 2" />
                        </Picker>
                      </View>
                    ) : (
                      <TextInput
                        style={styles.input}
                        placeholder={field.placeholder}
                        value={formData[field.key] || ''}
                        onChangeText={(text) => updateField(field.key, text)}
                      />
                    )
                  ) : (
                    <TextInput
                      style={styles.input}
                      placeholder={field.placeholder}
                      keyboardType={field.type === 'number' ? 'numeric' : 'default'}
                      value={formData[field.key] || ''}
                      onChangeText={(text) => updateField(field.key, text)}
                    />
                  )}
                </View>
              )})}
            </View>
          </ScrollView>

          {modoMultipleGastos && (
            <View style={styles.multipleGastosContainer}>
              <View style={styles.multipleGastosHeader}>
                <Text style={styles.multipleGastosTitle}>Detalles de Gastos</Text>
                <TouchableOpacity 
                  style={styles.addGastoButton}
                  onPress={() => setGastosDetalle([...gastosDetalle, { id: Date.now(), descripcion: '', monto: 0, categoria: 'Otros', fecha: new Date().toISOString().split('T')[0] }])}
                >
                  <Text style={styles.addGastoButtonText}>+ Agregar</Text>
                </TouchableOpacity>
              </View>
              
              {gastosDetalle.length === 0 ? (
                <Text style={styles.noGastosText}>No hay gastos agregados</Text>
              ) : (
                <ScrollView style={styles.gastosList} showsVerticalScrollIndicator={false}>
                  {gastosDetalle.map((gasto, index) => (
                    <View key={gasto.id} style={styles.gastoItem}>
                      <TextInput
                        style={[styles.input, styles.gastoDescripcion]}
                        placeholder="Descripción del gasto"
                        value={gasto.descripcion}
                        onChangeText={(text) => {
                          const newGastos = [...gastosDetalle]
                          newGastos[index].descripcion = text
                          setGastosDetalle(newGastos)
                        }}
                      />
                      <TextInput
                        style={[styles.input, styles.gastoMonto]}
                        placeholder="Monto"
                        keyboardType="numeric"
                        value={gasto.monto ? gasto.monto.toString() : ''}
                        onChangeText={(text) => {
                          const newGastos = [...gastosDetalle]
                          newGastos[index].monto = parseFloat(text) || 0
                          setGastosDetalle(newGastos)
                        }}
                      />
                      <TouchableOpacity
                        style={styles.removeGastoButton}
                        onPress={() => {
                          const newGastos = gastosDetalle.filter((_, i) => i !== index)
                          setGastosDetalle(newGastos)
                        }}
                      >
                        <Ionicons name="close-circle" size={24} color="#dc2626" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}
              
              {gastosDetalle.length > 0 && (
                <View style={styles.totalGastosContainer}>
                  <Text style={styles.totalGastosText}>
                    Total: RD$ {gastosDetalle.reduce((sum, g) => sum + (parseFloat(g.monto) || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>Guardar Balance</Text>
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
    flexShrink: 1,
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
  sesionInfo: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sesionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sesionLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  sesionValue: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: 'bold',
  },
  campoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  campoHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  campoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  campoInfo: {
    flex: 1,
  },
  campoLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  campoDescription: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 16,
  },
  editButton: {
    padding: 8,
  },
  campoValue: {
    marginLeft: 52,
  },
  campoAmount: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  campoInput: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    borderBottomWidth: 2,
    borderBottomColor: '#3b82f6',
    paddingVertical: 4,
  },
  resumenCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    marginBottom: 15,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  resumenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  resumenTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
    marginLeft: 8,
  },
  resumenContent: {
    padding: 15,
  },
  resumenRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  resumenLabel: {
    fontSize: 14,
    color: '#64748b',
  },
  resumenValue: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '600',
  },
  resumenTotal: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 12,
    marginTop: 8,
  },
  resumenTotalLabel: {
    fontSize: 16,
    color: '#1e293b',
    fontWeight: 'bold',
  },
  resumenTotalValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  indicadoresGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  indicadorCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginHorizontal: 5,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  indicadorValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3b82f6',
    marginBottom: 5,
  },
  indicadorLabel: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 5,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1e293b',
  },
  pickerContainer: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
  },
  picker: {
    height: 50,
    width: '100%',
  },
  booleanContainer: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  booleanOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  booleanOptionSelected: {
    backgroundColor: '#14b8a6',
  },
  booleanText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  booleanTextSelected: {
    color: '#ffffff',
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
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb',
  },
  checkboxContainerSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  checkboxLabel: {
    marginLeft: 10,
    fontSize: 14,
    color: '#6b7280',
  },
  checkboxLabelSelected: {
    color: '#2563eb',
    fontWeight: '600',
  },
  multipleGastosContainer: {
    padding: 12,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    marginHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  multipleGastosHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  multipleGastosTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e40af',
  },
  addGastoButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#2563eb',
    borderRadius: 6,
  },
  addGastoButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  noGastosText: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 14,
    paddingVertical: 12,
  },
  gastosList: {
    maxHeight: 200,
  },
  gastoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  gastoDescripcion: {
    flex: 1,
    marginRight: 8,
  },
  gastoMonto: {
    width: 80,
    marginRight: 8,
  },
  removeGastoButton: {
    padding: 4,
  },
  totalGastosContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#bfdbfe',
    alignItems: 'flex-end',
  },
  totalGastosText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e40af',
  },
})

export default FinancialModal
