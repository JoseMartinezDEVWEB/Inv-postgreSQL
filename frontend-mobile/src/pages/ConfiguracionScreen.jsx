import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Keyboard } from 'react-native';
import { useApi } from '../context/ApiContext';
import { SafeAreaView } from 'react-native-safe-area-context';

const ConfiguracionScreen = ({ navigation }) => {
  const { apiUrl, updateApiUrl, isUrlDefault } = useApi();
  
  // Extraer solo la IP y el puerto de la URL completa
  const extractIpAndPort = (url) => {
    if (!url) return '';
    const match = url.match(/https?:\/\/([^/]+)/);
    return match ? match[1] : url;
  };

  const [ip, setIp] = useState(extractIpAndPort(apiUrl));

  const normalizeHostPort = (value) => {
    if (!value) return '';
    return value
      .trim()
      .replace(/^https?:\/\//i, '')
      .replace(/\/api\/?$/i, '')
      .replace(/\/+$/g, '');
  };

  const handleSave = async () => {
    Keyboard.dismiss();
    if (!ip || ip.trim() === '') {
      Alert.alert('Error', 'La dirección IP no puede estar vacía.');
      return;
    }

    // Reconstruir la URL completa con /api al final
    const hostPort = normalizeHostPort(ip);
    const newApiUrl = `http://${hostPort}/api`;
    
    const success = await updateApiUrl(newApiUrl);
    if (success) {
      Alert.alert('Éxito', 'La dirección del servidor ha sido actualizada.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } else {
      Alert.alert('Error', 'No se pudo guardar la configuración. Inténtalo de nuevo.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Configuración del Servidor</Text>
        <Text style={styles.label}>Dirección IP y Puerto del Servidor</Text>
        <TextInput
          style={styles.input}
          value={ip}
          onChangeText={setIp}
          placeholder="Ej: 192.168.1.50:4000"
          autoCapitalize="none"
          keyboardType="url"
          autoCorrect={false}
        />
        <Text style={styles.info}>
          Aquí debes ingresar la dirección IP que aparece en la consola del servidor de escritorio.
        </Text>
        {isUrlDefault && (
          <Text style={styles.warning}>
            Estás usando la dirección por defecto. Es probable que necesites cambiarla.
          </Text>
        )}

        <TouchableOpacity style={styles.button} onPress={handleSave}>
          <Text style={styles.buttonText}>Guardar y Reconectar</Text>
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
  },
  warning: {
    fontSize: 13,
    color: '#d9534f',
    marginBottom: 20,
    fontWeight: 'bold',
  },
  button: {
    backgroundColor: '#0275d8',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ConfiguracionScreen;
