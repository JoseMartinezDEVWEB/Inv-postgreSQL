import { BleManager } from 'react-native-ble-plx';
import { PermissionsAndroid, Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// UUIDs únicos para el servicio J4
const SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
const CHARACTERISTIC_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';

class BLEService {
  constructor() {
    try {
      this.manager = new BleManager();
      this.isInitialized = true;
    } catch (error) {
      // Si el error es por falta de módulo nativo (común en desarrollo), solo loguear info
      if (error.message && error.message.includes('createClient')) {
        console.log('ℹ️ BLE no disponible: Ejecutando sin módulo nativo Bluetooth (funcionalidad limitada)');
      } else {
        console.warn('⚠️ Error al inicializar BleManager:', error.message);
      }
      this.manager = null;
      this.isInitialized = false;
    }
    this.connectedDevice = null;
    this.isScanning = false;
    this.isDestroyed = false;
    this.listeners = {
      onDeviceFound: null,
      onDataReceived: null,
      onConnectionChange: null,
      onError: null
    };
  }

  // Solicitar permisos en Android
  async requestPermissions() {
    if (Platform.OS === 'android') {
      if (Platform.Version >= 31) {
        // Android 12+
        const permissions = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);

        return Object.values(permissions).every(
          status => status === PermissionsAndroid.RESULTS.GRANTED
        );
      } else {
        // Android < 12
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
    }
    return true; // iOS maneja permisos automáticamente
  }

  // Verificar estado de Bluetooth
  async checkBluetoothState() {
    if (!this.manager || this.isDestroyed) {
      console.log('ℹ️ BLE no disponible para verificar estado');
      return false;
    }
    
    try {
      const state = await this.manager.state();
      if (state !== 'PoweredOn') {
        Alert.alert(
          'Bluetooth Desactivado',
          'Por favor activa el Bluetooth para sincronizar dispositivos.',
          [{ text: 'OK' }]
        );
        return false;
      }
      return true;
    } catch (error) {
      console.warn('⚠️ Error al verificar Bluetooth:', error.message);
      return false;
    }
  }

  // Escanear dispositivos cercanos
  async startScan(onDeviceFound) {
    if (!this.manager || this.isDestroyed) {
      console.log('ℹ️ BLE no disponible para escaneo');
      return;
    }

    const hasPermissions = await this.requestPermissions();
    if (!hasPermissions) {
      Alert.alert('Permisos Requeridos', 'Se necesitan permisos de Bluetooth y ubicación');
      return;
    }

    const isBluetoothOn = await this.checkBluetoothState();
    if (!isBluetoothOn) return;

    this.isScanning = true;
    this.listeners.onDeviceFound = onDeviceFound;

    console.log('🔍 Iniciando escaneo BLE...');

    this.manager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.error('Error al escanear:', error);
        this.listeners.onError?.(error);
        return;
      }

      // Filtrar solo dispositivos con nombre que contengan "J4"
      if (device?.name && device.name.includes('J4')) {
        console.log('📱 Dispositivo encontrado:', device.name);
        this.listeners.onDeviceFound?.(device);
      }
    });

    // Detener escaneo después de 30 segundos
    setTimeout(() => {
      this.stopScan();
    }, 30000);
  }

  // Detener escaneo
  stopScan() {
    if (this.isScanning && this.manager && !this.isDestroyed) {
      try {
        this.manager.stopDeviceScan();
        this.isScanning = false;
        console.log('⏹️ Escaneo detenido');
      } catch (error) {
        console.warn('⚠️ Error al detener escaneo:', error.message);
      }
    }
  }

  // Conectar a un dispositivo
  async connectToDevice(deviceId, onDataReceived) {
    if (!this.manager) {
      throw new Error('El servicio Bluetooth no está disponible en este dispositivo');
    }

    try {
      this.stopScan();
      console.log('🔗 Conectando a dispositivo:', deviceId);

      const device = await this.manager.connectToDevice(deviceId);
      this.connectedDevice = device;

      console.log('✅ Conectado a:', device.name);
      this.listeners.onConnectionChange?.(true, device);

      // Descubrir servicios y características
      await device.discoverAllServicesAndCharacteristics();

      // Escuchar notificaciones de datos
      device.monitorCharacteristicForService(
        SERVICE_UUID,
        CHARACTERISTIC_UUID,
        (error, characteristic) => {
          if (error) {
            console.error('Error al recibir datos:', error);
            return;
          }

          if (characteristic?.value) {
            const data = this.decodeBase64(characteristic.value);
            console.log('📥 Datos recibidos:', data);
            onDataReceived?.(JSON.parse(data));
          }
        }
      );

      return device;
    } catch (error) {
      console.error('Error al conectar:', error);
      this.listeners.onError?.(error);
      throw error;
    }
  }

  // Enviar datos a dispositivo conectado
  async sendData(data) {
    if (!this.connectedDevice) {
      throw new Error('No hay dispositivo conectado');
    }

    try {
      const jsonString = JSON.stringify(data);
      const base64Data = this.encodeToBase64(jsonString);

      console.log('📤 Enviando datos:', data);

      await this.connectedDevice.writeCharacteristicWithResponseForService(
        SERVICE_UUID,
        CHARACTERISTIC_UUID,
        base64Data
      );

      console.log('✅ Datos enviados exitosamente');
      return true;
    } catch (error) {
      console.error('Error al enviar datos:', error);
      throw error;
    }
  }

  // Enviar múltiples productos en lotes
  async sendProducts(productos) {
    const BATCH_SIZE = 5; // Enviar de 5 en 5
    const batches = [];

    for (let i = 0; i < productos.length; i += BATCH_SIZE) {
      batches.push(productos.slice(i, i + BATCH_SIZE));
    }

    console.log(`📦 Enviando ${productos.length} productos en ${batches.length} lotes`);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      await this.sendData({
        type: 'productos',
        batch: i + 1,
        total: batches.length,
        data: batch
      });

      // Esperar 500ms entre lotes para no saturar
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Enviar mensaje de finalización
    await this.sendData({
      type: 'complete',
      total: productos.length
    });

    console.log('✅ Todos los productos enviados');
  }

  // Desconectar dispositivo
  async disconnect() {
    if (this.connectedDevice) {
      try {
        await this.connectedDevice.cancelConnection();
        console.log('🔌 Desconectado');
        this.listeners.onConnectionChange?.(false, null);
        this.connectedDevice = null;
      } catch (error) {
        console.error('Error al desconectar:', error);
      }
    }
  }

  // Anunciar este dispositivo como disponible para conexión
  async startAdvertising(deviceName) {
    // Nota: BLE Peripheral mode requiere configuración nativa adicional
    // Por ahora, usamos el nombre del dispositivo en el escaneo
    console.log('📡 Dispositivo anunciándose como:', deviceName);
    
    // Guardar nombre para futuras conexiones
    await AsyncStorage.setItem('ble_device_name', deviceName);
  }

  // Utilidades para codificación
  encodeToBase64(string) {
    // Convertir string a base64 usando btoa (disponible en React Native)
    try {
      return btoa(unescape(encodeURIComponent(string)));
    } catch (e) {
      console.error('Error al codificar:', e);
      return '';
    }
  }

  decodeBase64(base64) {
    // Convertir base64 a string usando atob (disponible en React Native)
    try {
      return decodeURIComponent(escape(atob(base64)));
    } catch (e) {
      console.error('Error al decodificar:', e);
      return '';
    }
  }

  // Limpiar recursos
  destroy() {
    if (this.isDestroyed) return;
    
    this.isDestroyed = true;
    this.stopScan();
    this.disconnect();
    
    if (this.manager) {
      try {
        this.manager.destroy();
        this.manager = null;
      } catch (error) {
        console.warn('⚠️ Error al destruir BLE manager:', error.message);
      }
    }
    
    // Limpiar listeners
    this.listeners = {
      onDeviceFound: null,
      onDataReceived: null,
      onConnectionChange: null,
      onError: null
    };
  }
}

// Exportar instancia singleton
const bleService = new BLEService();
export default bleService;
