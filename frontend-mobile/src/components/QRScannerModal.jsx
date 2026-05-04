import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Vibration,
} from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { invitacionesApi, handleApiError } from '../services/api'
import { showMessage } from 'react-native-flash-message'
import axios from 'axios'

// Crear instancia limpia de axios para verificación de servidores (sin interceptores ni baseURL)
// Esto evita conflictos con la configuración global de axios que usa api.js
const cleanAxios = axios.create({
  timeout: 8000,
  headers: {
    'Content-Type': 'application/json',
  },
})

const QRScannerModal = ({ visible, onClose, onSuccess, mode = 'invitacion' }) => {
  const [hasPermission, setHasPermission] = useState(null)
  const [scanned, setScanned] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [flashOn, setFlashOn] = useState(false)

  const [cameraPermission, requestCameraPermission] = useCameraPermissions()

  useEffect(() => {
    if (visible) {
      checkAndRequestPermission()
      setScanned(false)
      setFlashOn(false) // Siempre inicia con flash apagado
    }
  }, [visible])

  const checkAndRequestPermission = async () => {
    try {
      let granted = false;
      if (!cameraPermission?.granted && cameraPermission?.canAskAgain) {
        const result = await requestCameraPermission();
        granted = result?.granted === true;
      } else {
        granted = cameraPermission?.granted === true;
      }
      
      setHasPermission(granted);
      if (!granted) {
        showPermissionAlert();
      }
    } catch (error) {
      console.error('Error requesting camera permission:', error);
      setHasPermission(false);
      Alert.alert('Error', 'No se pudo obtener permiso para usar la cámara');
    }
  };

  const showPermissionAlert = () => {
    Alert.alert(
      'Permiso necesario',
      'Se requiere acceso a la cámara para escanear códigos QR',
      [
        { text: 'Cancelar', onPress: onClose },
        { text: 'Reintentar', onPress: checkAndRequestPermission }
      ]
    )
  }

  const handleBarCodeScanned = async ({ type, data }) => {
    if (scanned || isProcessing) return

    setScanned(true)
    Vibration.vibrate(100) // Vibración de feedback

    try {
      setIsProcessing(true)

      // Parsear datos del QR (siempre JSON)
      let qrData
      try {
        qrData = JSON.parse(data.trim())
      } catch (e) {
        throw new Error('Código QR inválido (no es JSON)')
      }

      if (mode === 'conexion') {
        // Soportar tanto j4pro_url (campo legacy) como url (campo nuevo compacto)
        const j4proUrl = (qrData?.j4pro_url || qrData?.url || '').toString().trim().replace(/\/+$/, '')
        if (!j4proUrl) {
          throw new Error('Este QR no contiene la URL del servidor (j4pro_url o url)')
        }
        if (!/^https?:\/\//i.test(j4proUrl)) {
          throw new Error('URL del servidor inválida (debe iniciar con http:// o https://)')
        }

        // Validación robusta: verificar contra el endpoint del backend (PÚBLICO, sin auth)
        const verifyUrl = `${j4proUrl}/api/red/info`
        console.log('🔍 [QRScanner] Verificando servidor en:', verifyUrl)

        let verifyResp
        try {
          verifyResp = await cleanAxios.get(verifyUrl, {
            timeout: 8000,
            validateStatus: () => true
          })
          console.log('✅ [QRScanner] Respuesta del servidor:', verifyResp.status, verifyResp.data)
        } catch (networkError) {
          console.error('❌ [QRScanner] Error de red al verificar servidor:', networkError.message)
          throw new Error(`No se pudo conectar al servidor en ${j4proUrl}.\n\n• Verifica que estés en el mismo WiFi.\n• Asegúrate que el servidor esté iniciado en el PC.\n• Revisa que el Firewall de Windows permita el puerto.`)
        }

        if (verifyResp.status !== 200 || !verifyResp.data?.ok) {
          console.error('❌ [QRScanner] Respuesta inválida del servidor:', verifyResp.status, verifyResp.data)
          throw new Error(`El servidor respondió con código ${verifyResp.status}. Verifica que el backend esté corriendo e iniciado correctamente en el PC.`)
        }

        const canonicalBase = (verifyResp.data.url || j4proUrl).toString().replace(/\/+$/, '')
        const canonicalApiUrl = (verifyResp.data.apiUrl || `${canonicalBase}/api`).toString().replace(/\/+$/, '')

        Vibration.vibrate([0, 80, 80, 80])
        showMessage({
          message: 'Servidor configurado',
          description: canonicalBase,
          type: 'success',
          duration: 2500,
        })

        onSuccess({
          tipo: 'conexion_j4pro',
          j4pro_url: canonicalBase,
          apiUrl: canonicalApiUrl,
        })

        return
      }


      // === Modo invitación V2 (Soporte para auto-configuración y auto-solicitud) ===
      if (qrData.tipo === 'invitacion_j4_v2') {
        Vibration.vibrate([0, 100, 100, 100])
        onSuccess(qrData)
        return
      }

      // === Modo invitación (legacy) ===
      // Validar que sea una invitación de J4
      if (!qrData.tipo || qrData.tipo !== 'invitacion_j4') {
        throw new Error('Este código QR no es una invitación válida de J4 Pro')
      }

      if (!qrData.token) {
        throw new Error('Código QR incompleto')
      }

      // Consumir la invitación sin crear cuenta
      const response = await invitacionesApi.consumirSinCuenta(qrData.token)

      if (response.data.exito) {
        Vibration.vibrate([0, 100, 100, 100]) // Vibración de รฉxito

        // Guardar token de sesión temporal
        const datos = response.data.datos

        showMessage({
          message: '¡Conectado exitosamente!',
          description: `Acceso como ${qrData.rol}`,
          type: 'success',
          duration: 3000,
        })

        onSuccess(datos)
      } else {
        throw new Error(response.data.mensaje || 'Error al conectar')
      }

    } catch (error) {
      console.error('Error al procesar QR:', error)

      const errorMsg = error.response?.data?.mensaje || error.message || 'Error al procesar el código QR'

      Alert.alert(
        'Error',
        errorMsg,
        [
          { text: 'Cerrar', onPress: onClose },
          {
            text: 'Reintentar',
            onPress: () => {
              setScanned(false)
              setIsProcessing(false)
            }
          }
        ]
      )
    } finally {
      setIsProcessing(false)
    }
  }

  const handleClose = () => {
    if (!isProcessing) {
      onClose()
    }
  }

  if (!visible) return null

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <LinearGradient
          colors={['#8b5cf6', '#7c3aed']}
          style={styles.header}
        >
          <TouchableOpacity
            onPress={handleClose}
            style={styles.closeButton}
            disabled={isProcessing}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Escanear Código QR</Text>
          <View style={styles.placeholder} />
        </LinearGradient>

        {/* Instrucciones */}
        <View style={styles.instructionsContainer}>
          <Ionicons name="qr-code-outline" size={40} color="#8b5cf6" />
          <Text style={styles.instructionsTitle}>
            {mode === 'conexion' ? 'Configurar Conexión' : 'Acceso como Colaborador'}
          </Text>
          <Text style={styles.instructionsText}>
            {mode === 'conexion'
              ? 'Escanea el QR generado en Desktop para configurar automáticamente la conexión al backend (LAN)'
              : 'Pide al administrador que genere un código QR desde la sesión de inventario y escanéalo para conectarte'}
          </Text>
        </View>

        {/* Scanner */}
        <View style={styles.scannerContainer}>
          {hasPermission === null ? (
            <View style={styles.centerContent}>
              <ActivityIndicator size="large" color="#8b5cf6" />
              <Text style={styles.loadingText}>Solicitando permiso de cámara...</Text>
            </View>
          ) : hasPermission === false ? (
            <View style={styles.centerContent}>
              <Ionicons name="camera-off-outline" size={60} color="#ef4444" />
              <Text style={styles.errorText}>
                No hay acceso a la cámara
              </Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={requestCameraPermission}
              >
                <Text style={styles.retryButtonText}>Reintentar</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <CameraView
                onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                barcodeScannerSettings={{
                  barcodeTypes: ['qr'],
                }}
                style={StyleSheet.absoluteFillObject}
                enableTorch={flashOn}
              />

              {/* Overlay del marco de escaneo */}
              <View style={styles.overlay}>
                <View style={styles.scanFrame}>
                  <View style={[styles.corner, styles.topLeft]} />
                  <View style={[styles.corner, styles.topRight]} />
                  <View style={[styles.corner, styles.bottomLeft]} />
                  <View style={[styles.corner, styles.bottomRight]} />
                </View>
              </View>

              {isProcessing && (
                <View style={styles.processingOverlay}>
                  <ActivityIndicator size="large" color="#fff" />
                  <Text style={styles.processingText}>Conectando...</Text>
                </View>
              )}

              {scanned && !isProcessing && (
                <View style={styles.scannedOverlay}>
                  <TouchableOpacity
                    style={styles.scanAgainButton}
                    onPress={() => setScanned(false)}
                  >
                    <Ionicons name="refresh" size={20} color="#fff" />
                    <Text style={styles.scanAgainText}>Escanear de nuevo</Text>
                  </TouchableOpacity>
                </View>
              )}
              {/* Botón de Flash */}
              {!isProcessing && (
                <TouchableOpacity
                  style={[styles.flashButton, flashOn && styles.flashButtonActive]}
                  onPress={() => setFlashOn(prev => !prev)}
                >
                  <Ionicons name={flashOn ? 'flash' : 'flash-off'} size={22} color={flashOn ? '#fbbf24' : '#fff'} />
                  <Text style={[styles.flashText, flashOn && { color: '#fbbf24' }]}>
                    {flashOn ? 'Flash ON' : 'Flash OFF'}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* Footer con información */}
        <View style={styles.footer}>
          <View style={styles.footerItem}>
            <Ionicons name="shield-checkmark-outline" size={24} color="#10b981" />
            <Text style={styles.footerText}>Conexión segura</Text>
          </View>
          <View style={styles.footerItem}>
            <Ionicons name="time-outline" size={24} color="#f59e0b" />
            <Text style={styles.footerText}>Válido 24h</Text>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  closeButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  placeholder: {
    width: 38,
  },
  instructionsContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 30,
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginVertical: 15,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginTop: 10,
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  scannerContainer: {
    flex: 1,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 15,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#fff',
  },
  errorText: {
    marginTop: 15,
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 250,
    height: 250,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#8b5cf6',
    borderWidth: 4,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    marginTop: 15,
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
  },
  scannedOverlay: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  scanAgainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  scanAgainText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 15,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  // Flash toggle
  flashButton: {
    position: 'absolute',
    bottom: 90,
    left: '50%',
    transform: [{ translateX: -70 }],
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1.5,
    borderColor: '#94a3b8',
    borderRadius: 25,
    paddingVertical: 10,
    paddingHorizontal: 22,
    gap: 8,
    width: 140,
    justifyContent: 'center',
  },
  flashButtonActive: {
    backgroundColor: 'rgba(251,191,36,0.15)',
    borderColor: '#fbbf24',
  },
  flashText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
})

export default QRScannerModal
