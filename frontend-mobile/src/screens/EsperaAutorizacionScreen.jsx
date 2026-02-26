import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { solicitudesConexionApi } from '../services/api'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useNavigation } from '@react-navigation/native'

const EsperaAutorizacionScreen = ({ route }) => {
  const navigation = useNavigation()
  const { solicitudId: propSolicitudId } = route.params || {}
  
  const [solicitudId, setSolicitudId] = useState(propSolicitudId ? String(propSolicitudId) : null)
  const [estado, setEstado] = useState('pendiente')
  const [estadoConexion, setEstadoConexion] = useState('desconectado')
  const [sesionInventario, setSesionInventario] = useState(null)
  const [loading, setLoading] = useState(true)
  const [contable, setContable] = useState(null)

  useEffect(() => {
    cargarSolicitudId()
  }, [])

  useEffect(() => {
    if (!solicitudId) return

    // Polling cada 5 segundos
    const interval = setInterval(() => {
      verificarEstado()
    }, 5000)

    // Verificar inmediatamente
    verificarEstado()

    return () => clearInterval(interval)
  }, [solicitudId])

  const cargarSolicitudId = async () => {
    try {
      if (propSolicitudId) {
        setSolicitudId(String(propSolicitudId))
        return
      }

      const storedId = await AsyncStorage.getItem('solicitudId')
      if (storedId) {
        setSolicitudId(storedId)
      } else {
        Alert.alert('Error', 'No se encontró la solicitud', [
          { text: 'Volver', onPress: () => navigation.goBack() }
        ])
      }
    } catch (error) {
      console.error('Error al cargar solicitud ID:', error)
    }
  }

  const verificarEstado = async () => {
    try {
      setLoading(true)
      const response = await solicitudesConexionApi.verificarEstado(solicitudId)
      const datos = response.data.datos

      setEstado(datos.estado)
      setEstadoConexion(datos.estadoConexion)
      setSesionInventario(datos.sesionInventario)

      // Si fue aceptada, navegar a sesión de inventario
      if (datos.estado === 'aceptada') {
        Alert.alert(
          '¡Autorizado!',
          'Tu solicitud ha sido aceptada. Ahora puedes comenzar a trabajar.',
          [
            {
              text: 'Continuar',
              onPress: () => {
                // Aquí navegar a la sesión de inventario colaborador
                navigation.replace('SesionColaborador', {
                  solicitudId: solicitudId,
                  sesionInventario: datos.sesionInventario
                })
              }
            }
          ]
        )
      }

      // Si fue rechazada
      if (datos.estado === 'rechazada') {
        Alert.alert(
          'Solicitud Rechazada',
          'Tu solicitud de conexión ha sido rechazada por el usuario principal.',
          [
            { text: 'Volver', onPress: () => navigation.navigate('Login') }
          ]
        )
      }

      // Si expiró
      if (datos.estado === 'expirada') {
        Alert.alert(
          'Solicitud Expirada',
          'Tu solicitud ha expirado. Por favor, solicita una nueva conexión.',
          [
            { text: 'Volver', onPress: () => navigation.navigate('Login') }
          ]
        )
      }
    } catch (error) {
      console.error('Error al verificar estado:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCancelar = () => {
    Alert.alert(
      'Cancelar Solicitud',
      '¿Estás seguro de cancelar la solicitud?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem('solicitudId')
            navigation.navigate('Login')
          }
        }
      ]
    )
  }

  return (
    <LinearGradient
      colors={['#eff6ff', '#dbeafe', '#bfdbfe']}
      style={styles.container}
    >
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            {loading ? (
              <ActivityIndicator size="large" color="#3b82f6" />
            ) : estado === 'pendiente' ? (
              <Ionicons name="hourglass-outline" size={64} color="#f59e0b" />
            ) : estado === 'aceptada' ? (
              <Ionicons name="checkmark-circle" size={64} color="#10b981" />
            ) : (
              <Ionicons name="close-circle" size={64} color="#ef4444" />
            )}
          </View>
          
          <Text style={styles.title}>
            {estado === 'pendiente' ? 'Esperando Autorización...' : 
             estado === 'aceptada' ? '¡Autorizado!' :
             estado === 'rechazada' ? 'Solicitud Rechazada' :
             'Solicitud Expirada'}
          </Text>
          
          {estado === 'pendiente' && (
            <Text style={styles.subtitle}>
              Tu solicitud está siendo revisada por el usuario principal
            </Text>
          )}
        </View>

        {/* Info Card */}
        {estado === 'pendiente' && (
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="information-circle" size={20} color="#3b82f6" />
              <Text style={styles.infoText}>
                El usuario principal recibirá una notificación de tu solicitud
              </Text>
            </View>
            
            <View style={styles.infoRow}>
              <Ionicons name="time" size={20} color="#3b82f6" />
              <Text style={styles.infoText}>
                Esto puede tomar unos momentos
              </Text>
            </View>
            
            <View style={styles.infoRow}>
              <Ionicons name="sync" size={20} color="#3b82f6" />
              <Text style={styles.infoText}>
                Verificando estado automáticamente...
              </Text>
            </View>
          </View>
        )}

        {/* Loading Indicator */}
        {estado === 'pendiente' && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#3b82f6" />
            <Text style={styles.loadingText}>
              {loading ? 'Verificando...' : 'Esperando respuesta...'}
            </Text>
          </View>
        )}

        {/* Botones */}
        <View style={styles.buttonsContainer}>
          {estado === 'pendiente' && (
            <>
              <TouchableOpacity
                style={styles.refreshButton}
                onPress={verificarEstado}
                disabled={loading}
              >
                <Ionicons name="refresh" size={20} color="#3b82f6" />
                <Text style={styles.refreshButtonText}>Verificar Ahora</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancelar}
              >
                <Text style={styles.cancelButtonText}>Cancelar Solicitud</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Info adicional */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            ID de Solicitud: {solicitudId ? String(solicitudId).slice(-8) : '...'}
          </Text>
        </View>
      </View>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  infoText: {
    fontSize: 14,
    color: '#475569',
    marginLeft: 12,
    flex: 1,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748b',
    marginLeft: 10,
  },
  buttonsContainer: {
    gap: 12,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 2,
    borderColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  refreshButtonText: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  cancelButton: {
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#dc2626',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    marginTop: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#94a3b8',
    fontFamily: 'monospace',
  },
})

export default EsperaAutorizacionScreen
