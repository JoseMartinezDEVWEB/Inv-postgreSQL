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
  Switch,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'

const { width, height } = Dimensions.get('window')

const ExportModal = ({ visible, onClose, sesionData, onExport, initialConfig }) => {
  const [exportConfig, setExportConfig] = useState({
    formato: 'pdf',
    tipoDocumento: 'completo',
    incluirPrecios: true,
    incluirTotales: true,
    incluirBalanceGeneral: true,
    fechaPersonalizada: false,
    fechaDesde: '',
    fechaHasta: '',
    nombreArchivo: ''
  })

  const [isExporting, setIsExporting] = useState(false)

  // Opciones de formato
  const formatoOptions = [
    { value: 'pdf', label: 'PDF', icon: 'document-text', color: '#ef4444' },
    { value: 'excel', label: 'Excel', icon: 'grid', color: '#22c55e' },
    { value: 'word', label: 'Word', icon: 'document', color: '#3b82f6' },
    { value: 'csv', label: 'CSV', icon: 'list', color: '#f59e0b' }
  ]

  // Opciones de tipo de documento
  const tipoDocumentoOptions = [
    { value: 'completo', label: 'Documento Completo', description: 'Incluye todos los datos del inventario' },
    { value: 'productos', label: 'Solo Productos', description: 'Lista de productos inventariados' },
    { value: 'reporte', label: 'Solo Reporte', description: 'Resumen y estadísticas' },
    { value: 'balance', label: 'Solo Balance', description: 'Balance financiero únicamente' }
  ]

  // Generar nombre de archivo automático
  const generateFileName = () => {
    const fecha = new Date().toISOString().split('T')[0]
    const sesion = sesionData?.numeroSesion || 'SIN_NUMERO'
    const cliente = sesionData?.clienteNegocio?.nombre?.replace(/\s+/g, '_') || 'CLIENTE'
    const tipo = exportConfig.tipoDocumento.toUpperCase()
    const extension = exportConfig.formato === 'excel' ? 'xlsx' : exportConfig.formato

    return `INVENTARIO_${sesion}_${cliente}_${tipo}_${fecha}.${extension}`
  }

  // Actualizar configuración
  const updateConfig = (field, value) => {
    setExportConfig(prev => {
      const newConfig = { ...prev, [field]: value }
      
      // Auto-generar nombre de archivo cuando cambian ciertos campos
      if (['formato', 'tipoDocumento'].includes(field)) {
        newConfig.nombreArchivo = generateFileName()
      }
      
      return newConfig
    })
  }

  // Aplicar configuración inicial al abrir o cuando cambie initialConfig
  React.useEffect(() => {
    if (visible) {
      const defaults = {
        formato: 'pdf',
        tipoDocumento: 'completo',
        incluirPrecios: true,
        incluirTotales: true,
        incluirBalanceGeneral: true,
        fechaPersonalizada: false,
        fechaDesde: '',
        fechaHasta: '',
        nombreArchivo: ''
      }
      const merged = { ...defaults, ...(initialConfig || {}) }
      setExportConfig(merged)
      // Asegurar nombre sugerido
      const name = merged.nombreArchivo && merged.nombreArchivo.trim() ? merged.nombreArchivo : generateFileName()
      setExportConfig(prev => ({ ...prev, nombreArchivo: name }))
    }
  }, [visible, initialConfig])

  // Validar configuración
  const validateConfig = () => {
    if (!exportConfig.nombreArchivo.trim()) {
      Alert.alert('Error', 'Ingresa un nombre para el archivo')
      return false
    }

    if (exportConfig.fechaPersonalizada) {
      if (!exportConfig.fechaDesde || !exportConfig.fechaHasta) {
        Alert.alert('Error', 'Completa las fechas personalizadas')
        return false
      }
      
      if (new Date(exportConfig.fechaDesde) > new Date(exportConfig.fechaHasta)) {
        Alert.alert('Error', 'La fecha "desde" debe ser anterior a la fecha "hasta"')
        return false
      }
    }

    return true
  }

  // Manejar exportación
  const handleExport = async () => {
    if (!validateConfig()) return

    setIsExporting(true)
    
    try {
      // Preparar datos para exportación
      const exportData = {
        ...exportConfig,
        sesionId: sesionData?._id,
        sesionData: sesionData
      }

      // Llamar función de exportación del componente padre
      await onExport(exportData)
      
      Alert.alert(
        'Exportación Exitosa',
        `El archivo ${exportConfig.nombreArchivo} ha sido generado correctamente.`,
        [
          { text: 'OK', onPress: () => onClose() }
        ]
      )
    } catch (error) {
      Alert.alert('Error', 'No se pudo exportar el archivo: ' + error.message)
    } finally {
      setIsExporting(false)
    }
  }

  // Manejar vista previa
  const handlePreview = () => {
    Alert.alert(
      'Vista Previa',
      `Archivo: ${exportConfig.nombreArchivo}\nFormato: ${exportConfig.formato.toUpperCase()}\nTipo: ${tipoDocumentoOptions.find(t => t.value === exportConfig.tipoDocumento)?.label}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Exportar', onPress: handleExport }
      ]
    )
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
          <LinearGradient colors={['#06b6d4', '#0891b2']} style={styles.modalHeader}>
            <View style={styles.headerContent}>
              <View style={styles.headerLeft}>
                <Ionicons name="download" size={24} color="#ffffff" />
                <Text style={styles.modalTitle}>Descargar/Imprimir</Text>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Formato */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Formato de Archivo</Text>
              <View style={styles.formatGrid}>
                {formatoOptions.map((formato) => (
                  <TouchableOpacity
                    key={formato.value}
                    style={[
                      styles.formatCard,
                      exportConfig.formato === formato.value && styles.formatCardSelected
                    ]}
                    onPress={() => updateConfig('formato', formato.value)}
                  >
                    <Ionicons
                      name={formato.icon}
                      size={24}
                      color={exportConfig.formato === formato.value ? '#ffffff' : formato.color}
                    />
                    <Text style={[
                      styles.formatLabel,
                      exportConfig.formato === formato.value && styles.formatLabelSelected
                    ]}>
                      {formato.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Tipo de Documento */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tipo de Documento</Text>
              {tipoDocumentoOptions.map((tipo) => (
                <TouchableOpacity
                  key={tipo.value}
                  style={[
                    styles.tipoCard,
                    exportConfig.tipoDocumento === tipo.value && styles.tipoCardSelected
                  ]}
                  onPress={() => updateConfig('tipoDocumento', tipo.value)}
                >
                  <View style={styles.radioButton}>
                    {exportConfig.tipoDocumento === tipo.value && (
                      <View style={styles.radioButtonSelected} />
                    )}
                  </View>
                  <View style={styles.tipoContent}>
                    <Text style={[
                      styles.tipoLabel,
                      exportConfig.tipoDocumento === tipo.value && styles.tipoLabelSelected
                    ]}>
                      {tipo.label}
                    </Text>
                    <Text style={styles.tipoDescription}>{tipo.description}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* Opciones de Contenido */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Opciones de Contenido</Text>
              
              <View style={styles.optionRow}>
                <Text style={styles.optionLabel}>Incluir Precios</Text>
                <Switch
                  value={exportConfig.incluirPrecios}
                  onValueChange={(value) => updateConfig('incluirPrecios', value)}
                  trackColor={{ false: '#d1d5db', true: '#06b6d4' }}
                  thumbColor={exportConfig.incluirPrecios ? '#ffffff' : '#f4f3f4'}
                />
              </View>

              <View style={styles.optionRow}>
                <Text style={styles.optionLabel}>Incluir Totales</Text>
                <Switch
                  value={exportConfig.incluirTotales}
                  onValueChange={(value) => updateConfig('incluirTotales', value)}
                  trackColor={{ false: '#d1d5db', true: '#06b6d4' }}
                  thumbColor={exportConfig.incluirTotales ? '#ffffff' : '#f4f3f4'}
                />
              </View>

              <View style={styles.optionRow}>
                <Text style={styles.optionLabel}>Incluir Balance General</Text>
                <Switch
                  value={exportConfig.incluirBalanceGeneral}
                  onValueChange={(value) => updateConfig('incluirBalanceGeneral', value)}
                  trackColor={{ false: '#d1d5db', true: '#06b6d4' }}
                  thumbColor={exportConfig.incluirBalanceGeneral ? '#ffffff' : '#f4f3f4'}
                />
              </View>
            </View>

            {/* Configuración de Fecha */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Configuración de Fecha</Text>
              
              <View style={styles.optionRow}>
                <Text style={styles.optionLabel}>Usar Fecha Personalizada</Text>
                <Switch
                  value={exportConfig.fechaPersonalizada}
                  onValueChange={(value) => updateConfig('fechaPersonalizada', value)}
                  trackColor={{ false: '#d1d5db', true: '#06b6d4' }}
                  thumbColor={exportConfig.fechaPersonalizada ? '#ffffff' : '#f4f3f4'}
                />
              </View>

              {exportConfig.fechaPersonalizada && (
                <View style={styles.dateInputs}>
                  <View style={styles.dateInput}>
                    <Text style={styles.inputLabel}>Fecha Desde</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="YYYY-MM-DD"
                      value={exportConfig.fechaDesde}
                      onChangeText={(text) => updateConfig('fechaDesde', text)}
                    />
                  </View>
                  <View style={styles.dateInput}>
                    <Text style={styles.inputLabel}>Fecha Hasta</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="YYYY-MM-DD"
                      value={exportConfig.fechaHasta}
                      onChangeText={(text) => updateConfig('fechaHasta', text)}
                    />
                  </View>
                </View>
              )}
            </View>

            {/* Nombre del Archivo */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Nombre del Archivo</Text>
              <View style={styles.inputGroup}>
                <TextInput
                  style={styles.input}
                  placeholder="Nombre del archivo"
                  value={exportConfig.nombreArchivo}
                  onChangeText={(text) => updateConfig('nombreArchivo', text)}
                />
                <TouchableOpacity
                  style={styles.generateButton}
                  onPress={() => updateConfig('nombreArchivo', generateFileName())}
                >
                  <Ionicons name="refresh" size={16} color="#06b6d4" />
                  <Text style={styles.generateButtonText}>Auto-generar</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Vista Previa */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Vista Previa</Text>
              <View style={styles.previewCard}>
                <View style={styles.previewHeader}>
                  <Ionicons name="document" size={20} color="#06b6d4" />
                  <Text style={styles.previewFileName}>{exportConfig.nombreArchivo}</Text>
                </View>
                <View style={styles.previewDetails}>
                  <Text style={styles.previewDetail}>
                    Formato: {formatoOptions.find(f => f.value === exportConfig.formato)?.label}
                  </Text>
                  <Text style={styles.previewDetail}>
                    Tipo: {tipoDocumentoOptions.find(t => t.value === exportConfig.tipoDocumento)?.label}
                  </Text>
                  <Text style={styles.previewDetail}>
                    Sesión: {sesionData?.numeroSesion || 'N/A'}
                  </Text>
                  <Text style={styles.previewDetail}>
                    Cliente: {sesionData?.clienteNegocio?.nombre || 'N/A'}
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
            <TouchableOpacity 
              style={styles.previewButton} 
              onPress={handlePreview}
              disabled={isExporting}
            >
              <Ionicons name="eye" size={16} color="#06b6d4" />
              <Text style={styles.previewButtonText}>Vista Previa</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.exportButton, isExporting && styles.exportButtonDisabled]} 
              onPress={handleExport}
              disabled={isExporting}
            >
              {isExporting ? (
                <Text style={styles.exportButtonText}>Exportando...</Text>
              ) : (
                <>
                  <Ionicons name="download" size={16} color="#ffffff" />
                  <Text style={styles.exportButtonText}>Exportar</Text>
                </>
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
  formatGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  formatCard: {
    width: '48%',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  formatCardSelected: {
    backgroundColor: '#06b6d4',
    borderColor: '#0891b2',
  },
  formatLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginTop: 8,
  },
  formatLabelSelected: {
    color: '#ffffff',
  },
  tipoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tipoCardSelected: {
    backgroundColor: '#ecfeff',
    borderColor: '#06b6d4',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  radioButtonSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#06b6d4',
  },
  tipoContent: {
    flex: 1,
  },
  tipoLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 2,
  },
  tipoLabelSelected: {
    color: '#0891b2',
  },
  tipoDescription: {
    fontSize: 12,
    color: '#6b7280',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  optionLabel: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  dateInputs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
  },
  dateInput: {
    flex: 1,
    marginHorizontal: 5,
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
  inputGroup: {
    position: 'relative',
  },
  generateButton: {
    position: 'absolute',
    right: 8,
    top: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#f0f9ff',
  },
  generateButtonText: {
    fontSize: 12,
    color: '#06b6d4',
    fontWeight: '600',
    marginLeft: 4,
  },
  previewCard: {
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  previewFileName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0891b2',
    marginLeft: 8,
    flex: 1,
  },
  previewDetails: {
    gap: 4,
  },
  previewDetail: {
    fontSize: 12,
    color: '#374151',
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
    marginRight: 5,
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
  previewButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#06b6d4',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 5,
  },
  previewButtonText: {
    color: '#06b6d4',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  exportButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#06b6d4',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 5,
  },
  exportButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  exportButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
})

export default ExportModal
