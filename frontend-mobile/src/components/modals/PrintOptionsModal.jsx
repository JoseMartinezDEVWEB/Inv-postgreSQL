import React, { useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  Switch,
  StyleSheet,
  Dimensions,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'

const { width, height } = Dimensions.get('window')

const PRINT_MODES = [
  {
    id: 'completo',
    title: 'Reporte completo',
    description: 'Incluye portada, listado de artículos, balance y distribución (opcional)',
    icon: 'document-text-outline',
    accent: '#0891b2',
  },
  {
    id: 'listado',
    title: 'Solo listado',
    description: 'Genera únicamente el listado de productos inventariados',
    icon: 'list-outline',
    accent: '#2563eb',
  },
  {
    id: 'balance',
    title: 'Solo balance general',
    description: 'Incluye únicamente la página del balance financiero',
    icon: 'stats-chart-outline',
    accent: '#10b981',
  },
  {
    id: 'distribucion',
    title: 'Distribución de saldo',
    description: 'Genera el resumen y tarjetas de socios para distribución de utilidades',
    icon: 'people-outline',
    accent: '#f97316',
  },
]

const PrintOptionsModal = ({
  visible,
  onClose,
  onConfirm,
  distribucionDisponible = false,
  defaultPages = '',
}) => {
  const [mode, setMode] = useState('completo')
  const [includeBalance, setIncludeBalance] = useState(true)
  const [includeDistribucion, setIncludeDistribucion] = useState(false)
  const [pageSpec, setPageSpec] = useState(defaultPages)

  useEffect(() => {
    if (visible) {
      setMode('completo')
      setIncludeBalance(true)
      setIncludeDistribucion(distribucionDisponible)
      setPageSpec(defaultPages || '')
    }
  }, [visible, distribucionDisponible, defaultPages])

  const modeOptions = useMemo(() => (
    distribucionDisponible
      ? PRINT_MODES
      : PRINT_MODES.filter(option => option.id !== 'distribucion')
  ), [distribucionDisponible])

  const handleConfirm = () => {
    onConfirm?.({
      mode,
      includeBalance,
      includeDistribucion: includeDistribucion && distribucionDisponible,
      pages: pageSpec.trim(),
    })
  }

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <LinearGradient colors={['#0f172a', '#0e7490']} style={styles.header}>
            <View style={styles.headerContent}>
              <View style={styles.headerLeft}>
                <Ionicons name="print-outline" size={24} color="#ffffff" />
                <Text style={styles.headerTitle}>Opciones de impresión</Text>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          <View style={styles.content}>
            <Text style={styles.sectionTitle}>Tipo de reporte</Text>
            <View style={styles.optionList}>
              {modeOptions.map((option) => {
                const selected = option.id === mode
                return (
                  <TouchableOpacity
                    key={option.id}
                    activeOpacity={0.8}
                    onPress={() => setMode(option.id)}
                    style={[styles.optionCard, selected && { borderColor: option.accent, backgroundColor: '#f8fafc' }]}
                  >
                    <View style={styles.optionHeader}>
                      <View style={[styles.optionIconCircle, { backgroundColor: `${option.accent}20` }] }>
                        <Ionicons name={option.icon} size={18} color={option.accent} />
                      </View>
                      <Text style={[styles.optionTitle, selected && { color: option.accent }]}>{option.title}</Text>
                      <View style={[styles.radioOuter, selected && { borderColor: option.accent }] }>
                        {selected && <View style={[styles.radioInner, { backgroundColor: option.accent }]} />}
                      </View>
                    </View>
                    <Text style={styles.optionDescription}>{option.description}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            {mode === 'completo' && (
              <View style={styles.switchSection}>
                <View style={styles.switchRow}>
                  <View>
                    <Text style={styles.switchLabel}>Incluir balance general</Text>
                    <Text style={styles.switchDescription}>Agrega la página de balance financiero al reporte</Text>
                  </View>
                  <Switch
                    value={includeBalance}
                    onValueChange={setIncludeBalance}
                    trackColor={{ false: '#cbd5f5', true: '#0ea5e9' }}
                    thumbColor={includeBalance ? '#ffffff' : '#f4f4f5'}
                  />
                </View>
                <View style={[styles.switchRow, !distribucionDisponible && styles.switchRowDisabled]}>
                  <View>
                    <Text style={styles.switchLabel}>Incluir distribución de saldo</Text>
                    <Text style={styles.switchDescription}>
                      {distribucionDisponible
                        ? 'Adjunta la distribución configurada para los socios'
                        : 'Configura la distribución en la sesión para habilitar esta opción'}
                    </Text>
                  </View>
                  <Switch
                    value={distribucionDisponible && includeDistribucion}
                    onValueChange={setIncludeDistribucion}
                    disabled={!distribucionDisponible}
                    trackColor={{ false: '#cbd5f5', true: '#0ea5e9' }}
                    thumbColor={includeDistribucion && distribucionDisponible ? '#ffffff' : '#f4f4f5'}
                  />
                </View>
              </View>
            )}

            <View style={styles.sectionDivider} />

            <Text style={styles.sectionTitle}>Páginas específicas (opcional)</Text>
            <Text style={styles.pagesHint}>Ejemplos: 3,4,5 o 3-5</Text>
            <TextInput
              style={styles.pagesInput}
              placeholder="Todas las páginas"
              placeholderTextColor="#94a3b8"
              value={pageSpec}
              onChangeText={setPageSpec}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.printButton} onPress={handleConfirm}>
              <Ionicons name="print" size={18} color="#ffffff" />
              <Text style={styles.printText}>Imprimir</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: width * 0.95,
    maxHeight: height * 0.9,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 10,
  },
  optionList: {
    gap: 12,
  },
  optionCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 16,
    backgroundColor: '#ffffff',
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  optionIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  optionDescription: {
    marginTop: 8,
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#cbd5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  switchSection: {
    marginTop: 18,
    gap: 14,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  switchRowDisabled: {
    opacity: 0.6,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  switchDescription: {
    fontSize: 12,
    color: '#475569',
    marginTop: 4,
    maxWidth: width * 0.55,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 20,
  },
  pagesHint: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 8,
  },
  pagesInput: {
    borderWidth: 1,
    borderColor: '#cbd5f5',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cbd5f5',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelText: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '600',
  },
  printButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    backgroundColor: '#0e7490',
    paddingVertical: 12,
  },
  printText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
})

export default PrintOptionsModal
