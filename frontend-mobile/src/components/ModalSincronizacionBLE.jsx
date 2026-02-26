import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import bleService from '../services/BLEService'
import { showMessage } from 'react-native-flash-message'

const ModalSincronizacionBLE = ({ visible, onClose, productos, onSuccess, mode = 'send' }) => {
  const [isScanning, setIsScanning] = useState(false)
  const [devices, setDevices] = useState([])
  const [connectedDevice, setConnectedDevice] = useState(null)
  const [transferProgress, setTransferProgress] = useState(0)
  const [isTransferring, setIsTransferring] = useState(false)
  const [receivedProducts, setReceivedProducts] = useState([])

  useEffect(() => {
    if (visible) {
      iniciarEscaneo()
    }

    return () => {
      bleService.stopScan()
    }
  }, [visible])

  const iniciarEscaneo = () => {
    setDevices([])
    setIsScanning(true)

    bleService.startScan((device) => {
      setDevices(prev => {
        // Evitar duplicados
        if (prev.find(d => d.id === device.id)) {
          return prev
        }
        return [...prev, device]
      })
    })

    // Detener después de 30seg
    setTimeout(() => {
      setIsScanning(false)
    }, 30000)
  }

  const conectarDispositivo = async (device) => {
    try {
      setIsScanning(false)
      bleService.stopScan()

      await bleService.connectToDevice(device.id, (data) => {
        // Callback cuando se reciben datos
        handleDataReceived(data)
      })

      setConnectedDevice(device)
      showMessage({
        message: '✅ Conectado',
        description: `Conectado a ${device.name}`,
        type: 'success'
      })

      // Si estamos en modo envío, enviar productos automáticamente
      if (mode === 'send' && productos.length > 0) {
        setTimeout(() => {
          enviarProductos()
        }, 1000)
      }
    } catch (error) {
      Alert.alert('Error de Conexión', error.message)
    }
  }

  const enviarProductos = async () => {
    if (!connectedDevice || productos.length === 0) return

    try {
      setIsTransferring(true)
      setTransferProgress(0)

      await bleService.sendProducts(productos)

      setTransferProgress(100)
      
      showMessage({
        message: '✅ Sincronización Exitosa',
        description: `${productos.length} productos enviados`,
        type: 'success',
        duration: 3000
      })

      setTimeout(() => {
        onSuccess?.()
        handleClose()
      }, 2000)
    } catch (error) {
      Alert.alert('Error al Enviar', error.message)
    } finally {
      setIsTransferring(false)
    }
  }

  const handleDataReceived = (data) => {
    console.log('📥 Datos recibidos:', data)

    if (data.type === 'productos') {
      // Acumular productos recibidos
      setReceivedProducts(prev => [...prev, ...data.data])
      
      // Actualizar progreso
      const progress = (data.batch / data.total) * 100
      setTransferProgress(progress)

    } else if (data.type === 'complete') {
      // Transferencia completa
      showMessage({
        message: '✅ Recibido',
        description: `${data.total} productos recibidos`,
        type: 'success'
      })

      // Llamar callback con productos recibidos
      setTimeout(() => {
        onSuccess?.(receivedProducts)
        handleClose()
      }, 2000)
    }
  }

  const handleClose = () => {
    bleService.disconnect()
    setConnectedDevice(null)
    setDevices([])
    setIsScanning(false)
    setIsTransferring(false)
    setTransferProgress(0)
    setReceivedProducts([])
    onClose()
  }

  const renderDevice = ({ item }) => (
    <TouchableOpacity
      style={styles.deviceItem}
      onPress={() => conectarDispositivo(item)}
      disabled={connectedDevice !== null}
    >
      <View style={styles.deviceIcon}>
        <Ionicons name="phone-portrait-outline" size={24} color="#3b82f6" />
      </View>
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceName}>{item.name || 'Dispositivo Desconocido'}</Text>
        <Text style={styles.deviceId}>{item.id.slice(0, 20)}...</Text>
        {item.rssi && (
          <Text style={styles.deviceSignal}>
            Señal: {item.rssi} dBm
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
    </TouchableOpacity>
  )

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              {mode === 'send' ? 'Enviar Productos' : 'Recibir Productos'}
            </Text>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* Contenido */}
          {!connectedDevice ? (
            <>
              {/* Escaneo de dispositivos */}
              <View style={styles.scanSection}>
                <View style={styles.scanHeader}>
                  <Ionicons name="bluetooth" size={32} color="#3b82f6" />
                  <Text style={styles.scanTitle}>
                    {isScanning ? 'Buscando dispositivos...' : 'Dispositivos encontrados'}
                  </Text>
                </View>

                {isScanning && (
                  <ActivityIndicator size="large" color="#3b82f6" style={styles.loader} />
                )}

                <FlatList
                  data={devices}
                  keyExtractor={(item) => item.id}
                  renderItem={renderDevice}
                  ListEmptyComponent={
                    !isScanning && (
                      <View style={styles.emptyState}>
                        <Ionicons name="search-outline" size={48} color="#cbd5e1" />
                        <Text style={styles.emptyText}>No se encontraron dispositivos</Text>
                        <TouchableOpacity
                          style={styles.retryButton}
                          onPress={iniciarEscaneo}
                        >
                          <Ionicons name="refresh" size={20} color="#3b82f6" />
                          <Text style={styles.retryText}>Buscar de nuevo</Text>
                        </TouchableOpacity>
                      </View>
                    )
                  }
                  contentContainerStyle={devices.length === 0 ? styles.emptyContainer : null}
                />
              </View>

              <View style={styles.info}>
                <Ionicons name="information-circle-outline" size={16} color="#64748b" />
                <Text style={styles.infoText}>
                  Asegúrate que el otro dispositivo tenga Bluetooth activado y la app abierta
                </Text>
              </View>
            </>
          ) : (
            <>
              {/* Dispositivo conectado - Transferencia */}
              <View style={styles.transferSection}>
                <View style={styles.connectedDevice}>
                  <Ionicons name="checkmark-circle" size={48} color="#10b981" />
                  <Text style={styles.connectedName}>{connectedDevice.name}</Text>
                  <Text style={styles.connectedStatus}>Conectado</Text>
                </View>

                {isTransferring && (
                  <View style={styles.progressSection}>
                    <Text style={styles.progressText}>
                      {mode === 'send' ? 'Enviando productos...' : 'Recibiendo productos...'}
                    </Text>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressFill, { width: `${transferProgress}%` }]} />
                    </View>
                    <Text style={styles.progressPercentage}>{Math.round(transferProgress)}%</Text>
                  </View>
                )}

                {mode === 'send' && productos.length > 0 && (
                  <View style={styles.productsInfo}>
                    <Text style={styles.productsCount}>
                      📦 {productos.length} producto{productos.length !== 1 ? 's' : ''} para enviar
                    </Text>
                  </View>
                )}

                {mode === 'receive' && receivedProducts.length > 0 && (
                  <View style={styles.productsInfo}>
                    <Text style={styles.productsCount}>
                      📥 {receivedProducts.length} producto{receivedProducts.length !== 1 ? 's' : ''} recibido{receivedProducts.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                )}
              </View>

              {!isTransferring && mode === 'send' && (
                <TouchableOpacity
                  style={styles.sendButton}
                  onPress={enviarProductos}
                >
                  <Ionicons name="send" size={20} color="#fff" />
                  <Text style={styles.sendButtonText}>Enviar Ahora</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
  },
  scanSection: {
    flex: 1,
    padding: 20,
  },
  scanHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  scanTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
    marginTop: 8,
  },
  loader: {
    marginVertical: 20,
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  deviceIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  deviceId: {
    fontSize: 12,
    color: '#94a3b8',
    fontFamily: 'monospace',
  },
  deviceSignal: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 12,
    marginBottom: 20,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  retryText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '600',
  },
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    padding: 12,
    marginHorizontal: 20,
    borderRadius: 8,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#64748b',
  },
  transferSection: {
    padding: 20,
    alignItems: 'center',
  },
  connectedDevice: {
    alignItems: 'center',
    marginBottom: 30,
  },
  connectedName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 12,
  },
  connectedStatus: {
    fontSize: 14,
    color: '#10b981',
    marginTop: 4,
  },
  progressSection: {
    width: '100%',
    marginBottom: 20,
  },
  progressText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
  },
  progressPercentage: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3b82f6',
    textAlign: 'center',
  },
  productsInfo: {
    backgroundColor: '#eff6ff',
    padding: 12,
    borderRadius: 8,
    width: '100%',
  },
  productsCount: {
    fontSize: 14,
    color: '#1e40af',
    textAlign: 'center',
    fontWeight: '600',
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    marginHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
})

export default ModalSincronizacionBLE
