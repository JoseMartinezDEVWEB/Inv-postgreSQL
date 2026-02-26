import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

// Verificar si SecureStore está disponible y es confiable
const canUseSecureStore = async () => {
  try {
    // En Android, a veces SecureStore tiene problemas en builds híbridas o sin firma correcta
    // Para asegurar estabilidad, usamos AsyncStorage en Android por ahora
    if (Platform.OS === 'android') {
      return false
    }
    await SecureStore.isAvailableAsync()
    return true
  } catch (_) {
    return false
  }
}

export async function setInternetCredentials(service, username, password) {
  const useSecure = await canUseSecureStore()
  const data = JSON.stringify({ username, password })
  
  if (useSecure) {
    try {
      await SecureStore.setItemAsync(`ss:${service}`, data)
      return true
    } catch (e) {
      console.log('SecureStore set failed', e)
      // Fallback continuará abajo
    }
  }
  
  try {
    await AsyncStorage.setItem(`ss:${service}`, data)
    return true
  } catch (e) {
    console.error('AsyncStorage set failed', e)
    return false
  }
}

export async function getInternetCredentials(service) {
  const useSecure = await canUseSecureStore()
  
  if (useSecure) {
    try {
      const raw = await SecureStore.getItemAsync(`ss:${service}`)
      if (raw) {
        const v = JSON.parse(raw)
        return v && typeof v === 'object' ? v : null
      }
    } catch (e) {
      console.log('SecureStore get failed', e)
      // Fallback continuará abajo
    }
  }
  
  try {
    const raw = await AsyncStorage.getItem(`ss:${service}`)
    if (!raw) return null
    const v = JSON.parse(raw)
    return v && typeof v === 'object' ? v : null
  } catch (e) {
    console.error('AsyncStorage get failed', e)
    return null
  }
}

export async function resetInternetCredentials(service) {
  const useSecure = await canUseSecureStore()
  
  if (useSecure) {
    try {
      await SecureStore.deleteItemAsync(`ss:${service}`)
    } catch (_) {
      // Continuar
    }
  }
  
  try {
    await AsyncStorage.removeItem(`ss:${service}`)
  } catch (_) {}
}
