import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { checkBackendConnectivity, resolveApiBaseUrl } from '../config/env';
import { setRuntimeApiBaseUrl } from '../services/api';

const ConfiguracionScreen = ({ navigation }) => {
  // Extraer solo la IP:PUERTO de la URL actual
  const extractIpAndPort = (url) => {
    if (!url) return '';
    const match = url.match(/https?:\/\/([^/]+)/);
    return match ? match[1] : url;
  };

  const [ipBackend, setIpBackend] = useState(extractIpAndPort(resolveApiBaseUrl()));
  const [guardando, setGuardando] = useState(false);

  const normalizeHostPort = (value) => {
    if (!value) return '';
    return value
      .trim()
      .replace(/^https?:\/\//i, '')
      .replace(/\/api\/?$/i, '')
      .replace(/\/+$/g, '');
  };

  // CORRECCIÓN 11: Validar conectividad antes de guardar la IP
  const guardarConfiguracion = async () => {
    Keyboard.dismiss();

    if (!ipBackend || ipBackend.trim() === '') {
      Alert.alert('Error', 'Ingresa la IP del servidor Node.js+PostgreSQL');
      return;
    }

    const cleanIp = normalizeHostPort(ipBackend);
    const newApiUrl = `http://${cleanIp}/api`;

    setGuardando(true);
    try {
      const { connected } = await checkBackendConnectivity(5000, newApiUrl);

      if (!connected) {
        Alert.alert(
          'Sin conexión',
          `No hay respuesta en ${newApiUrl}\n\nVerifica:\n• El backend Node.js+PostgreSQL está corriendo\n• El puerto 4501 está abierto\n• El dispositivo está en la misma red WiFi`
        );
        return;
      }

      await setRuntimeApiBaseUrl(newApiUrl);
      Alert.alert('✅ Conectado', `Backend PostgreSQL en ${newApiUrl}`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('Error', e.message || 'No se pudo guardar la configuración');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Configuración del Servidor</Text>

        <Text style={styles.label}>IP y Puerto del Servidor Node.js+PostgreSQL</Text>
        <TextInput
          style={styles.input}
          value={ipBackend}
          onChangeText={setIpBackend}
          placeholder="Ej: 192.168.1.50:4501"
          autoCapitalize="none"
          keyboardType="url"
          autoCorrect={false}
          editable={!guardando}
        />
        <Text style={styles.info}>
          Ingresa la dirección IP que aparece en la consola del backend PostgreSQL.{'\n'}
          Asegúrate de que ambos dispositivos estén en la misma red WiFi.
        </Text>

        <TouchableOpacity
          style={[styles.button, guardando && styles.buttonDisabled]}
          onPress={guardarConfiguracion}
          disabled={guardando}
        >
          {guardando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Verificar y Guardar</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f2f5',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    color: '#555',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 10,
  },
  info: {
    fontSize: 12,
    color: '#666',
    marginBottom: 20,
    lineHeight: 18,
  },
  button: {
    backgroundColor: '#0275d8',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 50,
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#7ab3e0',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ConfiguracionScreen;
