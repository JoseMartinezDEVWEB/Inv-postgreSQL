import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import networkDiscoveryService from '../../services/networkDiscoveryService'
import axios from 'axios'
import { showMessage } from 'react-native-flash-message'

const SincronizacionRedModal = ({ visible, onClose, productos, onSuccess, solicitudId }) => {
  const [etapa, setEtapa] = useState('inicial') // inicial, buscando, servidores, manual, enviando
  const [servidores, setServidores] = useState([])
  const [ipManual, setIpManual] = useState('')
  const [puertoManual, setPuertoManual] = useState('4500')
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    if (!visible) {
      // Reset al cerrar
      setEtapa('inicial')
      setServidores([])
      setIpManual('')
      setPuertoManual('4500')
    }
  }, [visible])

  const buscarServidores = async () => {
    setEtapa('buscando')
    setCargando(true)

    try {
      const encontrados = await networkDiscoveryService.escanearRedLocal([4500, 3000, 3001, 5000])

      if (encontrados.length > 0) {
        setServidores(encontrados)
        setEtapa('servidores')
        showMessage({
          message: `✅ ${encontrados.length} servidor(es) encontrado(s)`,
          type: 'success',
        })
      } else {
        Alert.alert(
          'No se encontraron servidores',
          '¿Deseas ingresar la IP manualmente?',
          [
            { text: 'Cancelar', style: 'cancel', onPress: () => setEtapa('inicial') },
            { text: 'Ingresar IP', onPress: () => setEtapa('manual') },
          ]
        )
      }
    } catch (error) {
      console.error('Error buscando servidores:', error)
      Alert.alert('Error', 'No se pudo buscar servidores en la red')
      setEtapa('inicial')
    } finally {
      setCargando(false)
    }
  }

  const conectarManual = async () => {
    if (!ipManual) {
      Alert.alert('Error', 'Ingresa una dirección IP')
      return
    }

    setCargando(true)

    try {
      const resultado = await networkDiscoveryService.probarConexionDirecta(
        ipManual,
        parseInt(puertoManual) || 4500
      )

      if (resultado.exito) {
        showMessage({
          message: '✅ Conexión exitosa',
          type: 'success',
        })
        await enviarProductos(resultado.servidor)
      } else {
        Alert.alert('Error de conexión', resultado.error || 'No se pudo conectar al servidor')
      }
    } catch (error) {
      console.error('Error conectando manualmente:', error)
      Alert.alert('Error', 'No se pudo conectar al servidor')
    } finally {
      setCargando(false)
    }
  }

  const enviarProductos = async (servidor) => {
    setEtapa('enviando')
    setCargando(true)

    try {
      const payload = {
        solicitudId,
        productos: productos.map(p => ({
          temporalId: p.temporalId,
          nombre: p.nombre,
          sku: p.sku,
          codigoBarras: p.codigoBarras,
          cantidad: p.cantidad,
          costo: p.costo,
          timestamp: p.timestamp,
        })),
      }

      // Cifrado simple (Base64) para integridad
      const payloadCifrado = btoa(JSON.stringify(payload))

      const response = await axios.post(
        `${servidor.url}/api/solicitudes-conexion/${solicitudId}/sincronizar`,
        { datos: payloadCifrado },
        {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )

      if (response.status === 200) {
        showMessage({
          message: '✅ Productos sincronizados',
          description: `${productos.length} producto(s) enviado(s) exitosamente`,
          type: 'success',
          duration: 4000,
        })

        if (onSuccess) {
          await onSuccess()
        }

        onClose()
      } else {
        throw new Error('Respuesta inválida del servidor')
      }
    } catch (error) {
      console.error('Error enviando productos:', error)

      let mensajeError = 'No se pudieron enviar los productos'
      if (error.response?.data?.mensaje) {
        mensajeError = error.response.data.mensaje
      } else if (error.message) {
        mensajeError = error.message
      }

      Alert.alert('Error', mensajeError)
      setEtapa('inicial')
    } finally {
      setCargando(false)
    }
  }

  const renderEtapaInicial = () => (
    <View style={styles.contenido}>
      <Ionicons name="wifi" size={64} color="#3b82f6" style={styles.icono} />
      <Text style={styles.titulo}>Sincronizar por Red Local</Text>
      <Text style={styles.descripcion}>
        Encuentra y conecta con el servidor en tu red local para sincronizar {productos.length}{' '}
        producto(s)
      </Text>

      <View style={styles.botonesContainer}>
        <TouchableOpacity style={styles.botonPrincipal} onPress={buscarServidores}>
          <Ionicons name="search" size={20} color="#fff" />
          <Text style={styles.textBotonPrincipal}>Buscar Automáticamente</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.botonSecundario}
          onPress={() => setEtapa('manual')}
        >
          <Ionicons name="create-outline" size={20} color="#3b82f6" />
          <Text style={styles.textBotonSecundario}>Ingresar IP Manualmente</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.botonCancelar} onPress={onClose}>
          <Text style={styles.textBotonCancelar}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    </View>
  )

  const renderEtapaBuscando = () => (
    <View style={styles.contenido}>
      <ActivityIndicator size="large" color="#3b82f6" />
      <Text style={styles.titulo}>Buscando servidores...</Text>
      <Text style={styles.descripcion}>Escaneando la red local</Text>
      <TouchableOpacity
        style={styles.botonCancelar}
        onPress={() => {
          networkDiscoveryService.detenerEscaneo()
          setEtapa('inicial')
        }}
      >
        <Text style={styles.textBotonCancelar}>Cancelar</Text>
      </TouchableOpacity>
    </View>
  )

  const renderEtapaServidores = () => (
    <View style={styles.contenido}>
      <Text style={styles.titulo}>Servidores Encontrados</Text>
      <Text style={styles.descripcion}>Selecciona un servidor para sincronizar</Text>

      <FlatList
        data={servidores}
        keyExtractor={(item, index) => `${item.ip}-${item.puerto}-${index}`}
        style={styles.listaServidores}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.itemServidor}
            onPress={() => enviarProductos(item)}
            disabled={cargando}
          >
            <View style={styles.infoServidor}>
              <Text style={styles.nombreServidor}>{item.nombre}</Text>
              <Text style={styles.urlServidor}>
                {item.ip}:{item.puerto}
              </Text>
              <Text style={styles.versionServidor}>v{item.version}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#94a3b8" />
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={styles.botonCancelar} onPress={onClose}>
        <Text style={styles.textBotonCancelar}>Cancelar</Text>
      </TouchableOpacity>
    </View>
  )

  const renderEtapaManual = () => (
    <View style={styles.contenido}>
      <Text style={styles.titulo}>Conexión Manual</Text>
      <Text style={styles.descripcion}>Ingresa la dirección IP del servidor</Text>

      <TextInput
        style={styles.input}
        placeholder="Ej: 192.168.1.100"
        placeholderTextColor="#94a3b8"
        value={ipManual}
        onChangeText={setIpManual}
        keyboardType="numeric"
      />

      <TextInput
        style={styles.input}
        placeholder="Puerto (default: 3000)"
        placeholderTextColor="#94a3b8"
        value={puertoManual}
        onChangeText={setPuertoManual}
        keyboardType="number-pad"
      />

      <View style={styles.botonesContainer}>
        <TouchableOpacity
          style={styles.botonPrincipal}
          onPress={conectarManual}
          disabled={cargando}
        >
          {cargando ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="link" size={20} color="#fff" />
              <Text style={styles.textBotonPrincipal}>Conectar</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.botonCancelar}
          onPress={() => setEtapa('inicial')}
        >
          <Text style={styles.textBotonCancelar}>Volver</Text>
        </TouchableOpacity>
      </View>
    </View>
  )

  const renderEtapaEnviando = () => (
    <View style={styles.contenido}>
      <ActivityIndicator size="large" color="#22c55e" />
      <Text style={styles.titulo}>Enviando productos...</Text>
      <Text style={styles.descripcion}>{productos.length} producto(s)</Text>
    </View>
  )

  const renderContenido = () => {
    switch (etapa) {
      case 'inicial':
        return renderEtapaInicial()
      case 'buscando':
        return renderEtapaBuscando()
      case 'servidores':
        return renderEtapaServidores()
      case 'manual':
        return renderEtapaManual()
      case 'enviando':
        return renderEtapaEnviando()
      default:
        return renderEtapaInicial()
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>{renderContenido()}</View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 450,
    maxHeight: '80%',
  },
  contenido: {
    padding: 24,
  },
  icono: {
    alignSelf: 'center',
    marginBottom: 16,
  },
  titulo: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 8,
  },
  descripcion: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
  },
  botonesContainer: {
    gap: 12,
  },
  botonPrincipal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  textBotonPrincipal: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  botonSecundario: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  textBotonSecundario: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '600',
  },
  botonCancelar: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  textBotonCancelar: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '600',
  },
  listaServidores: {
    maxHeight: 300,
    marginBottom: 16,
  },
  itemServidor: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  infoServidor: {
    flex: 1,
  },
  nombreServidor: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
  },
  urlServidor: {
    fontSize: 14,
    color: '#3b82f6',
    marginBottom: 2,
  },
  versionServidor: {
    fontSize: 12,
    color: '#94a3b8',
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0f172a',
    marginBottom: 12,
  },
})

export default SincronizacionRedModal










