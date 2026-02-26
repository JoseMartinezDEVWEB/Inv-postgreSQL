import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import ModalSincronizacionBLE from '../components/ModalSincronizacionBLE'
import { solicitudesConexionApi } from '../services/api'
import { showMessage } from 'react-native-flash-message'

const RecepcionBLEScreen = ({ navigation }) => {
  const [modalBLE, setModalBLE] = useState(false)
  const [productosRecibidos, setProductosRecibidos] = useState([])

  const handleProductosRecibidos = async (productos) => {
    setProductosRecibidos(productos)
    setModalBLE(false)

    // Mostrar confirmación
    Alert.alert(
      'Productos Recibidos',
      `Se recibieron ${productos.length} producto(s) vía Bluetooth.\n\n¿Qué deseas hacer?`,
      [
        {
          text: 'Ver Lista',
          onPress: () => {}
        },
        {
          text: 'Guardar en Sesión',
          onPress: () => guardarProductosEnSesion(productos)
        }
      ]
    )
  }

  const guardarProductosEnSesion = async (productos) => {
    try {
      // Aquí puedes enviar los productos al backend
      // para que se agreguen a la sesión de inventario actual
      showMessage({
        message: '✅ Productos Guardados',
        description: `${productos.length} productos agregados a la sesión`,
        type: 'success'
      })

      // Limpiar productos recibidos
      setProductosRecibidos([])
      
      // Navegar de vuelta
      navigation.goBack()
    } catch (error) {
      Alert.alert('Error', 'No se pudieron guardar los productos')
    }
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#8b5cf6', '#7c3aed']}
        style={styles.header}
      >
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Recibir por Bluetooth</Text>
          <View style={{ width: 24 }} />
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.infoCard}>
          <View style={styles.iconContainer}>
            <Ionicons name="bluetooth" size={64} color="#8b5cf6" />
          </View>

          <Text style={styles.title}>Recibir Productos</Text>
          <Text style={styles.description}>
            Usa esta función para recibir productos de un colaborador que está trabajando offline vía Bluetooth.
          </Text>

          <View style={styles.stepsContainer}>
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <Text style={styles.stepText}>
                El colaborador debe abrir su app y seleccionar "Sincronizar vía Bluetooth"
              </Text>
            </View>

            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <Text style={styles.stepText}>
                Presiona el botón "Iniciar Recepción" abajo
              </Text>
            </View>

            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <Text style={styles.stepText}>
                Selecciona el dispositivo del colaborador cuando aparezca
              </Text>
            </View>

            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>4</Text>
              </View>
              <Text style={styles.stepText}>
                Los productos se recibirán automáticamente
              </Text>
            </View>
          </View>

          <View style={styles.warningBox}>
            <Ionicons name="information-circle" size={20} color="#3b82f6" />
            <Text style={styles.warningText}>
              Asegúrate que ambos dispositivos tengan Bluetooth activado y estén cerca (máximo 10 metros)
            </Text>
          </View>

          <TouchableOpacity
            style={styles.startButton}
            onPress={() => setModalBLE(true)}
          >
            <Ionicons name="bluetooth" size={24} color="#fff" />
            <Text style={styles.startButtonText}>Iniciar Recepción</Text>
          </TouchableOpacity>

          {productosRecibidos.length > 0 && (
            <View style={styles.receivedCard}>
              <Text style={styles.receivedTitle}>
                📥 Productos Recibidos: {productosRecibidos.length}
              </Text>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={() => guardarProductosEnSesion(productosRecibidos)}
              >
                <Text style={styles.saveButtonText}>Guardar en Sesión</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      <ModalSincronizacionBLE
        visible={modalBLE}
        onClose={() => setModalBLE(false)}
        productos={[]}
        onSuccess={handleProductosRecibidos}
        mode="receive"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    padding: 20,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f5f3ff',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  stepsContainer: {
    marginBottom: 24,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#8b5cf6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginTop: 4,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
    gap: 10,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#1e40af',
    lineHeight: 18,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8b5cf6',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 10,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  receivedCard: {
    backgroundColor: '#dcfce7',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  receivedTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#166534',
    marginBottom: 12,
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: '#16a34a',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
})

export default RecepcionBLEScreen
