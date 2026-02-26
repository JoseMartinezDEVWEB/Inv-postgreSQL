import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  TextInput,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as DocumentPicker from 'expo-document-picker'
import { importarProductosDesdeArchivo } from '../../services/importService'
import { showMessage } from 'react-native-flash-message'
import { isOnline } from '../../config/env'

const ImportarConGeminiModal = ({ visible, onClose, onProductosImportados, solicitudId }) => {
  const [etapa, setEtapa] = useState('inicial') // inicial, seleccionando, procesando, revision
  const [archivo, setArchivo] = useState(null)
  const [productosImportados, setProductosImportados] = useState([])
  const [cargando, setCargando] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [mostrarApiKey, setMostrarApiKey] = useState(false)

  const resetear = () => {
    setEtapa('inicial')
    setArchivo(null)
    setProductosImportados([])
    setCargando(false)
    setApiKey('')
    setMostrarApiKey(false)
  }

  const seleccionarArchivo = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
        ],
        copyToCacheDirectory: true,
      })

      if (result.canceled === false && result.assets && result.assets.length > 0) {
        const file = result.assets[0]
        setArchivo(file)
        setEtapa('seleccionando')
        
        showMessage({
          message: '📄 Archivo seleccionado',
          description: file.name,
          type: 'success',
        })
      }
    } catch (error) {
      console.error('Error seleccionando archivo:', error)
      Alert.alert('Error', 'No se pudo seleccionar el archivo')
    }
  }

  const procesarArchivo = async () => {
    if (!archivo) {
      Alert.alert('Error', 'No hay archivo seleccionado')
      return
    }

    setCargando(true)
    setEtapa('procesando')

    // Verificar internet antes de procesar
    if (!isOnline()) {
      setCargando(false)
      setEtapa('seleccionando')
      Alert.alert(
        'Conexión Requerida',
        'La importación con IA requiere conexión a internet para procesar el archivo en el servidor. Por favor, conéctate y vuelve a intentarlo.',
        [{ text: 'Entendido' }]
      )
      return
    }

    try {
      // Si es PDF y no hay API key, preguntar si quiere continuar sin ella
      const esPDF = archivo.name.toLowerCase().endsWith('.pdf')
      
      if (esPDF && !apiKey) {
        Alert.alert(
          'API Key de Gemini',
          'Para procesar PDFs complejos se recomienda usar una API Key de Google Gemini. ¿Deseas continuar sin ella?',
          [
            { text: 'Cancelar', style: 'cancel', onPress: () => {
              setCargando(false)
              setEtapa('seleccionando')
            }},
            { text: 'Continuar', onPress: () => continuarProcesamiento() },
            { text: 'Agregar API Key', onPress: () => {
              setCargando(false)
              setEtapa('seleccionando')
              setMostrarApiKey(true)
            }},
          ]
        )
        return
      }

      await continuarProcesamiento()
    } catch (error) {
      console.error('Error procesando archivo:', error)
      Alert.alert(
        'Error',
        error.response?.data?.mensaje || error.message || 'No se pudo procesar el archivo'
      )
      setEtapa('seleccionando')
      setCargando(false)
    }
  }

  const continuarProcesamiento = async () => {
    try {
      const productos = await importarProductosDesdeArchivo(archivo, apiKey || null)

      if (!productos || productos.length === 0) {
        Alert.alert('Sin resultados', 'No se encontraron productos en el archivo')
        setEtapa('seleccionando')
        setCargando(false)
        return
      }

      // Agregar flag de origen para auditoría
      const productosConOrigen = productos.map(p => ({
        ...p,
        origen: 'colaborador',
        origenArchivo: archivo.name,
        origenSolicitud: solicitudId,
        timestamp: new Date().toISOString(),
      }))

      setProductosImportados(productosConOrigen)
      setEtapa('revision')
      
      showMessage({
        message: '✅ Archivo procesado',
        description: `${productosConOrigen.length} producto(s) encontrado(s)`,
        type: 'success',
      })
    } catch (error) {
      console.error('Error en continuarProcesamiento:', error)
      throw error
    } finally {
      setCargando(false)
    }
  }

  const confirmarImportacion = () => {
    if (productosImportados.length === 0) {
      Alert.alert('Error', 'No hay productos para importar')
      return
    }

    Alert.alert(
      'Confirmar Importación',
      `¿Deseas importar ${productosImportados.length} producto(s) a tu lista?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Importar',
          onPress: () => {
            if (onProductosImportados) {
              onProductosImportados(productosImportados)
            }
            
            showMessage({
              message: '✅ Productos importados',
              description: `${productosImportados.length} producto(s) agregado(s)`,
              type: 'success',
              duration: 4000,
            })
            
            resetear()
            onClose()
          },
        },
      ]
    )
  }

  const renderEtapaInicial = () => (
    <View style={styles.contenido}>
      <Ionicons name="cloud-upload-outline" size={64} color="#3b82f6" style={styles.icono} />
      <Text style={styles.titulo}>Importar con IA</Text>
      <Text style={styles.descripcion}>
        Selecciona un archivo PDF o Excel para importar productos automáticamente usando Gemini AI
      </Text>

      <View style={styles.infoBox}>
        <Ionicons name="information-circle-outline" size={20} color="#0ea5e9" />
        <Text style={styles.infoText}>
          La IA procesará el archivo y extraerá los productos automáticamente. (Requiere Internet)
        </Text>
      </View>

      <TouchableOpacity style={styles.botonPrincipal} onPress={seleccionarArchivo}>
        <Ionicons name="document-attach-outline" size={20} color="#fff" />
        <Text style={styles.textBotonPrincipal}>Seleccionar Archivo</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.botonCancelar} onPress={onClose}>
        <Text style={styles.textBotonCancelar}>Cancelar</Text>
      </TouchableOpacity>
    </View>
  )

  const renderEtapaSeleccionando = () => (
    <View style={styles.contenido}>
      <Ionicons name="document-text" size={64} color="#22c55e" style={styles.icono} />
      <Text style={styles.titulo}>Archivo Seleccionado</Text>
      
      <View style={styles.archivoCard}>
        <Ionicons
          name={archivo?.name.endsWith('.pdf') ? 'document' : 'document-text'}
          size={32}
          color="#3b82f6"
        />
        <View style={styles.archivoInfo}>
          <Text style={styles.archivoNombre}>{archivo?.name}</Text>
          <Text style={styles.archivoSize}>
            {archivo?.size ? `${(archivo.size / 1024).toFixed(2)} KB` : 'Tamaño desconocido'}
          </Text>
        </View>
      </View>

      {mostrarApiKey && (
        <View style={styles.apiKeyContainer}>
          <Text style={styles.apiKeyLabel}>API Key de Gemini (opcional)</Text>
          <TextInput
            style={styles.input}
            placeholder="AIza..."
            placeholderTextColor="#94a3b8"
            value={apiKey}
            onChangeText={setApiKey}
            secureTextEntry={false}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.apiKeyHint}>
            💡 Consigue tu API Key gratis en ai.google.dev
          </Text>
        </View>
      )}

      <View style={styles.botonesContainer}>
        <TouchableOpacity
          style={styles.botonPrincipal}
          onPress={procesarArchivo}
          disabled={cargando}
        >
          {cargando ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="sparkles" size={20} color="#fff" />
              <Text style={styles.textBotonPrincipal}>Procesar con IA</Text>
            </>
          )}
        </TouchableOpacity>

        {!mostrarApiKey && archivo?.name.endsWith('.pdf') && (
          <TouchableOpacity
            style={styles.botonSecundario}
            onPress={() => setMostrarApiKey(true)}
          >
            <Ionicons name="key-outline" size={20} color="#3b82f6" />
            <Text style={styles.textBotonSecundario}>Agregar API Key</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.botonSecundario} onPress={seleccionarArchivo}>
          <Ionicons name="refresh" size={20} color="#3b82f6" />
          <Text style={styles.textBotonSecundario}>Cambiar Archivo</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.botonCancelar} onPress={() => {
          resetear()
          onClose()
        }}>
          <Text style={styles.textBotonCancelar}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    </View>
  )

  const renderEtapaProcesando = () => (
    <View style={styles.contenido}>
      <ActivityIndicator size="large" color="#3b82f6" />
      <Text style={styles.titulo}>Procesando con IA...</Text>
      <Text style={styles.descripcion}>
        Gemini AI está analizando el archivo y extrayendo los productos
      </Text>
      <View style={styles.loadingDots}>
        <Text style={styles.loadingText}>Esto puede tomar unos momentos</Text>
      </View>
    </View>
  )

  const renderEtapaRevision = () => (
    <View style={styles.contenido}>
      <Text style={styles.titulo}>Productos Encontrados</Text>
      <Text style={styles.descripcion}>
        {productosImportados.length} producto(s) listos para importar
      </Text>

      <ScrollView style={styles.listaProductos} showsVerticalScrollIndicator={false}>
        {productosImportados.map((producto, index) => {
          // Asegurar que el producto tenga las propiedades necesarias
          const productoSafe = {
            nombre: producto.nombre || 'Sin nombre',
            sku: producto.sku || producto.codigo || '',
            codigoBarras: producto.codigoBarras || producto.codigo || '',
            cantidad: producto.cantidad || 1,
            costo: producto.costo || producto.costoBase || 0,
          }
          
          return (
          <View key={`producto-${index}-${productoSafe.nombre}`} style={styles.productoCard}>
            <View style={styles.productoNumero}>
              <Text style={styles.productoNumeroText}>{index + 1}</Text>
            </View>
            <View style={styles.productoInfo}>
              <Text style={styles.productoNombre}>{productoSafe.nombre}</Text>
              <Text style={styles.productoDetalles}>
                {productoSafe.sku ? `SKU: ${productoSafe.sku}` : 'Sin SKU'}
                {productoSafe.codigoBarras ? ` • CB: ${productoSafe.codigoBarras}` : ''}
              </Text>
              <Text style={styles.productoCantidad}>
                Cantidad: {productoSafe.cantidad} | Costo: ${productoSafe.costo.toFixed(2)}
              </Text>
            </View>
          </View>
          )
        })}
      </ScrollView>

      <View style={styles.botonesContainer}>
        <TouchableOpacity style={styles.botonPrincipal} onPress={confirmarImportacion}>
          <Ionicons name="checkmark-circle" size={20} color="#fff" />
          <Text style={styles.textBotonPrincipal}>Importar Productos</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.botonCancelar}
          onPress={() => {
            resetear()
            onClose()
          }}
        >
          <Text style={styles.textBotonCancelar}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    </View>
  )

  const renderContenido = () => {
    switch (etapa) {
      case 'inicial':
        return renderEtapaInicial()
      case 'seleccionando':
        return renderEtapaSeleccionando()
      case 'procesando':
        return renderEtapaProcesando()
      case 'revision':
        return renderEtapaRevision()
      default:
        return renderEtapaInicial()
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
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
    maxHeight: '85%',
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
    marginBottom: 20,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#e0f2fe',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    gap: 8,
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#0369a1',
    lineHeight: 18,
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
  archivoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  archivoInfo: {
    flex: 1,
  },
  archivoNombre: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
  },
  archivoSize: {
    fontSize: 13,
    color: '#64748b',
  },
  apiKeyContainer: {
    marginBottom: 20,
  },
  apiKeyLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0f172a',
    marginBottom: 6,
  },
  apiKeyHint: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
  },
  loadingDots: {
    marginTop: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  listaProductos: {
    maxHeight: 350,
    marginBottom: 16,
  },
  productoCard: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  productoNumero: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productoNumeroText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  productoInfo: {
    flex: 1,
  },
  productoNombre: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
  },
  productoDetalles: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 2,
  },
  productoCantidad: {
    fontSize: 12,
    color: '#0369a1',
    fontWeight: '500',
  },
})

export default ImportarConGeminiModal



