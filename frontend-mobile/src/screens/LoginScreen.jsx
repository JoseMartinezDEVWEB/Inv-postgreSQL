import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Image,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../context/AuthContext'
import { useLoader } from '../context/LoaderContext'
import QRScannerModal from '../components/QRScannerModal'
import { solicitudesConexionApi, setRuntimeApiBaseUrl } from '../services/api'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Device from 'expo-device'

const LoginScreen = ({ navigation }) => {
  const { login, isLoading, loginAsCollaborator } = useAuth()
  const { showAnimation } = useLoader()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const [showQRScanner, setShowQRScanner] = useState(false)
  const [showCodigoInput, setShowCodigoInput] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [nombreColaborador, setNombreColaborador] = useState('')
  const [loadingCodigo, setLoadingCodigo] = useState(false)

  // Manejar cambios en el formulario
  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))

    // Limpiar error del campo
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }))
    }
  }

  // Validar formulario
  const validateForm = () => {
    const newErrors = {}

    if (!formData.email) {
      newErrors.email = 'El email o usuario es requerido'
    }
    // NO validar formato de email, puede ser nombre de usuario

    if (!formData.password) {
      newErrors.password = 'La contraseña es requerida'
    }
    // NO validar longitud mínima, permitir cualquier contraseña

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Manejar envío del formulario
  const handleSubmit = async () => {
    if (!validateForm()) {
      return
    }

    showAnimation('login', 1200)
    const result = await login(formData)

    if (!result.success) {
      Alert.alert('Error', result.error)
    }
  }

  // Manejar éxito del escáner QR
  const handleQRSuccess = async (data) => {
    setShowQRScanner(false)
    try {
      // Modo conexión (auto-config backend LAN)
      if (data?.tipo === 'conexion_j4pro' && data?.apiUrl) {
        await setRuntimeApiBaseUrl(data.apiUrl)
        Alert.alert(
          'Conexión configurada',
          `Servidor configurado:\n${data.j4pro_url}\n\nYa puedes iniciar sesión.`,
        )
        return
      }

      // Modo invitación (legacy)
      showAnimation('login', 1200)
      await loginAsCollaborator(data)
    } catch (e) {
      Alert.alert('Error', e.message || 'No se pudo configurar la conexión')
    }
  }

  // Manejar código de 6 dígitos - Nueva versión con solicitud (compatible Android/iOS)
  const handleCodigoSubmit = async () => {
    if (!codigo || codigo.length !== 6) {
      Alert.alert('Error', 'Por favor ingresa un código válido de 6 dígitos')
      return
    }

    if (!nombreColaborador || nombreColaborador.trim() === '') {
      Alert.alert('Error', 'Por favor ingresa tu nombre para identificarte')
      return
    }

    try {
      setLoadingCodigo(true)

      // Obtener ID único del dispositivo
      const dispositivoId =
        (await AsyncStorage.getItem('deviceId')) || `${Device.modelName || 'unknown'}_${Date.now()}`
      await AsyncStorage.setItem('deviceId', dispositivoId)

      // Crear solicitud de conexión
      const response = await solicitudesConexionApi.solicitar({
        codigoNumerico: codigo,
        nombreColaborador: nombreColaborador.trim(),
        dispositivoId,
        dispositivoInfo: {
          modelo: Device.modelName || 'Desconocido',
          sistemaOperativo: Platform.OS,
          version: Platform.Version?.toString() || 'N/A',
        },
      })

      // Obtener el ID de la solicitud de la respuesta
      const nuevaSolicitudId = response.data.datos.id || response.data.datos._id || response.data.datos.solicitudId

      // Guardar solicitudId para verificar estado después
      if (nuevaSolicitudId) {
        await AsyncStorage.setItem('solicitudId', String(nuevaSolicitudId))
      }

      setShowCodigoInput(false)
      setCodigo('')
      setNombreColaborador('')

      Alert.alert(
        'Solicitud Enviada',
        `Tu solicitud ha sido enviada correctamente.\n\nEspera a que autorice tu conexión.`,
        [
          {
            text: 'Verificar Estado',
            onPress: () =>
              navigation.navigate('EsperaAutorizacion', {
                solicitudId: String(nuevaSolicitudId),
              }),
          },
        ]
      )
    } catch (error) {
      console.error('Error al crear solicitud de conexión:', error)
      const mensajeError = error.response?.data?.mensaje || error.message || 'Error de conexión'
      const currentApi = axios.defaults.baseURL || 'Cargando...'
      Alert.alert(
        'Error al Conectar',
        mensajeError + `\n\nURL actual: ${currentApi}\n\nSugerencias:\n` +
        '• Verifica que el código sea correcto\n' +
        '• Asegúrate de estar en la misma red (WiFi) que el PC\n' +
        '• El PC debe tener el Firewall abierto para J4 Pro\n' +
        '• El colaborador debe estar activo'
      )
    } finally {
      setLoadingCodigo(false)
    }
  }

  return (
    <LinearGradient
      colors={['#eff6ff', '#dbeafe', '#bfdbfe']}
      style={styles.container}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Image
                source={require('../../assets/icon.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.subtitle}>Gestor de Inventario</Text>
          </View>

          {/* Formulario */}
          <View style={styles.formContainer}>
            {/* Botones (QR + Configuración) */}
            <View style={styles.topRightButtons}>
              <TouchableOpacity
                style={styles.iconTopButton}
                onPress={() => setShowQRScanner(true)}
              >
                <Ionicons name="qr-code-outline" size={22} color="#64748b" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconTopButton}
                onPress={() => navigation.navigate('Configuracion')}
              >
                <Ionicons name="settings-outline" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.formTitle}>Iniciar Sesión</Text>

            {/* Email */}
            <View style={styles.inputContainer}>
              <View style={styles.inputWrapper}>
                <Ionicons name="mail" size={20} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Email o Usuario"
                  placeholderTextColor="#94a3b8"
                  value={formData.email}
                  onChangeText={(value) => handleChange('email', value)}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
            </View>

            {/* Contraseña */}
            <View style={styles.inputContainer}>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed" size={20} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Contraseña"
                  placeholderTextColor="#94a3b8"
                  value={formData.password}
                  onChangeText={(value) => handleChange('password', value)}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIcon}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color="#64748b"
                  />
                </TouchableOpacity>
              </View>
              {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
            </View>

            {/* Botón de envío */}
            <TouchableOpacity
              style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={isLoading}
            >
              <LinearGradient
                colors={['#3b82f6', '#2563eb']}
                style={styles.submitButtonGradient}
              >
                <Text style={styles.submitButtonText}>
                  {isLoading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Botón Acceder como Colaborador (Eliminado QR, solo manual) */}
            {/*
            <TouchableOpacity
              style={styles.collaboratorButton}
              onPress={() => setShowQRScanner(true)}
            >
              <Ionicons name="qr-code-outline" size={20} color="#8b5cf6" />
              <Text style={styles.collaboratorButtonText}>Escanear Código QR</Text>
            </TouchableOpacity>
            */}

            {/* Botón Ingresar Código Manual - Ahora estilo principal */}
            <TouchableOpacity
              style={styles.collaboratorButton}
              onPress={() => setShowCodigoInput(!showCodigoInput)}
            >
              <Ionicons name="keypad-outline" size={20} color="#8b5cf6" />
              <Text style={styles.collaboratorButtonText}>Ingresar como Colaborador</Text>
            </TouchableOpacity>

            {/* Input de Código (mostrar condicionalmente) */}
            {showCodigoInput && (
              <View style={styles.codigoContainer}>
                <Text style={styles.codigoLabel}>Código de Acceso</Text>
                <TextInput
                  style={styles.codigoInput}
                  placeholder="000000"
                  value={codigo}
                  onChangeText={setCodigo}
                  keyboardType="number-pad"
                  maxLength={6}
                  editable={!loadingCodigo}
                />

                <Text style={[styles.codigoLabel, { marginTop: 12 }]}>Tu Nombre</Text>
                <TextInput
                  style={styles.nombreInput}
                  placeholder="Nombre del colaborador"
                  value={nombreColaborador}
                  onChangeText={setNombreColaborador}
                  editable={!loadingCodigo}
                />

                <TouchableOpacity
                  style={[styles.codigoSubmitButton, loadingCodigo && styles.submitButtonDisabled]}
                  onPress={handleCodigoSubmit}
                  disabled={loadingCodigo}
                >
                  <Text style={styles.codigoSubmitText}>
                    {loadingCodigo ? 'Verificando...' : 'Conectar'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal de Escáner QR */}
      <QRScannerModal
        visible={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onSuccess={handleQRSuccess}
        mode="conexion"
      />
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 100,
    height: 100,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
  },
  logoImage: {
    width: 80,
    height: 80,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
  },
  formContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 30,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    position: 'relative', // Para posicionar el botón de configuración
  },
  topRightButtons: {
    position: 'absolute',
    top: 15,
    right: 15,
    flexDirection: 'row',
    gap: 6,
    zIndex: 1,
  },
  iconTopButton: {
    padding: 10,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 30,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1e293b',
  },
  eyeIcon: {
    padding: 5,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    marginTop: 5,
    marginLeft: 5,
  },
  submitButton: {
    marginTop: 10,
    marginBottom: 15,
    borderRadius: 12,
    overflow: 'hidden',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonGradient: {
    paddingVertical: 15,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  linksContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  linkButton: {
    padding: 10,
  },
  linkText: {
    color: '#64748b',
    fontSize: 14,
  },
  linkTextBold: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  collaboratorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f3ff',
    borderWidth: 2,
    borderColor: '#8b5cf6',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  collaboratorButtonText: {
    color: '#8b5cf6',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  codigoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#faf5ff',
    borderWidth: 2,
    borderColor: '#7c3aed',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  codigoButtonText: {
    color: '#7c3aed',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  codigoContainer: {
    backgroundColor: '#f5f3ff',
    borderWidth: 2,
    borderColor: '#e9d5ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 15,
  },
  codigoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b21a8',
    marginBottom: 8,
  },
  codigoInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 24,
    fontFamily: 'monospace',
    fontWeight: '700',
    color: '#7c3aed',
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: 12,
  },
  codigoSubmitButton: {
    backgroundColor: '#7c3aed',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  codigoSubmitText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
})

export default LoginScreen



