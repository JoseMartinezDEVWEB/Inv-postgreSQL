import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  Dimensions,
  TextInput,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'

const { width, height } = Dimensions.get('window')

const ReportPreviewModal = ({ visible, onClose, sesionData, reportType, onExport, onPreview, onPrintPages }) => {
  const [isExporting, setIsExporting] = useState(false)
  const [pageSpec, setPageSpec] = useState('')

  // Generar información del archivo según el tipo de reporte
  const getReportInfo = () => {
    const fecha = new Date().toISOString().split('T')[0].replace(/-/g, '')
    const cliente = sesionData?.clienteNegocio?.nombre?.replace(/\s+/g, '_') || 'CLIENTE'
    const sesion = sesionData?.numeroSesion || 'SIN_NUMERO'
    
    switch (reportType) {
      case 'imprimir':
        return {
          title: 'Descargar/Imprimir',
          icon: 'print-outline',
          fileName: `INVENTARIO_${sesion}_${cliente}_COMPLETO_${fecha}.pdf`,
          format: 'PDF',
          type: 'Documento Completo',
          description: 'Incluye todos los productos, precios y balance general'
        }
      case 'reporte':
        return {
          title: 'Descargar/Imprimir', 
          icon: 'document-text-outline',
          fileName: `INVENTARIO_${sesion}_${cliente}_REPORTE_${fecha}.pdf`,
          format: 'PDF',
          type: 'Solo Reporte',
          description: 'Incluye resumen estadístico y balance financiero'
        }
      default:
        return {
          title: 'Descargar/Imprimir',
          icon: 'download-outline',
          fileName: `INVENTARIO_${sesion}_${cliente}_${fecha}.pdf`,
          format: 'PDF',
          type: 'Documento',
          description: 'Archivo de inventario'
        }
    }
  }

  const reportInfo = getReportInfo()

  // Manejar vista previa
  const handlePreview = () => {
    Alert.alert(
      'Vista Previa',
      `Se abrirá una vista previa del ${reportInfo.type.toLowerCase()}.\n\nArchivo: ${reportInfo.fileName}\nFormato: ${reportInfo.format}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Ver Vista Previa', onPress: () => onPreview && onPreview(reportInfo) }
      ]
    )
  }

  // Manejar exportación
  const handleExport = async () => {
    setIsExporting(true)
    
    try {
      const exportData = {
        reportType,
        fileName: reportInfo.fileName,
        format: reportInfo.format.toLowerCase(),
        tipoDocumento: reportType === 'reporte' ? 'reporte' : 'completo',
        incluirPrecios: true,
        incluirTotales: true,
        incluirBalanceGeneral: true,
        sesionId: sesionData?._id,
        sesionData: sesionData
      }

      await onExport(exportData)
      
      Alert.alert(
        'Exportación Exitosa',
        `El archivo ${reportInfo.fileName} ha sido generado correctamente.`,
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

  return (
    <Modal
      animationType="fade"
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
                <Ionicons name={reportInfo.icon} size={24} color="#ffffff" />
                <Text style={styles.modalTitle}>{reportInfo.title}</Text>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {/* Content */}
          <View style={styles.modalContent}>
            {/* Vista Previa */}
            <View style={styles.previewSection}>
              <Text style={styles.sectionTitle}>Vista Previa</Text>
              <View style={styles.previewCard}>
                <View style={styles.previewHeader}>
                  <Ionicons name="document" size={20} color="#06b6d4" />
                  <Text style={styles.previewFileName}>{reportInfo.fileName}</Text>
                </View>
                <View style={styles.previewDetails}>
                  <Text style={styles.previewDetail}>Formato: {reportInfo.format}</Text>
                  <Text style={styles.previewDetail}>Tipo: {reportInfo.type}</Text>
                  <Text style={styles.previewDetail}>Sesión: {sesionData?.numeroSesion || 'N/A'}</Text>
                  <Text style={styles.previewDetail}>Cliente: {sesionData?.clienteNegocio?.nombre || 'N/A'}</Text>
                </View>
                <Text style={styles.previewDescription}>{reportInfo.description}</Text>
              </View>
            </View>

            {/* Imprimir páginas específicas */}
            <View style={styles.pagesSection}>
              <Text style={styles.sectionTitle}>Imprimir páginas específicas</Text>
              <View style={styles.pagesRow}>
                <View style={styles.pagesInputWrapper}>
                  <Text style={styles.pagesHint}>Ejemplos: 3,4,5 o 3-5</Text>
                  <View style={styles.pagesInputBox}>
                    <TextInput
                      style={styles.pagesInput}
                      placeholder="3-5,7"
                      placeholderTextColor="#94a3b8"
                      keyboardType="default"
                      value={pageSpec}
                      onChangeText={setPageSpec}
                    />
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.pagesButton}
                  onPress={() => {
                    if (!pageSpec || !pageSpec.trim()) {
                      Alert.alert('Rango requerido', 'Ingresa las páginas a imprimir, por ejemplo: 3-5 o 3,4,5')
                      return
                    }
                    onPrintPages && onPrintPages(pageSpec.trim())
                  }}
                  disabled={isExporting}
                >
                  <Ionicons name="print-outline" size={16} color="#ffffff" />
                  <Text style={styles.pagesButtonText}>Imprimir páginas</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

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
    width: width * 0.9,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
    maxHeight: height * 0.7,
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
    padding: 20,
  },
  previewSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 15,
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
    marginBottom: 10,
  },
  previewDetail: {
    fontSize: 12,
    color: '#374151',
    marginBottom: 2,
  },
  previewDescription: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  modalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  pagesSection: {
    marginTop: 8,
  },
  pagesRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  pagesInputWrapper: { flex: 1 },
  pagesHint: { fontSize: 12, color: '#64748b', marginBottom: 6 },
  pagesInputBox: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#dbeafe', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  pagesInput: { color: '#0f172a', fontSize: 14 },
  pagesButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#06b6d4', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8 },
  pagesButtonText: { color: '#fff', fontWeight: '700', marginLeft: 6 },
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

export default ReportPreviewModal
