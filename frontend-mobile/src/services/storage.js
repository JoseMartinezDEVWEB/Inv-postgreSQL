import AsyncStorage from '@react-native-async-storage/async-storage'
import { getInternetCredentials, setInternetCredentials, resetInternetCredentials } from './secureStorage'

/**
 * Utilidad simple de almacenamiento basada en AsyncStorage para Expo Go.
 * Permite guardar tokens u otra información sensible en desarrollo.
 */
const storage = {
  setItem: async (key, value) => {
    if (key === 'auth_token') {
      const token = typeof value === 'string' ? value : String(value)
      await setInternetCredentials('auth_token', 'token', token)
      return
    }
    if (key === 'refresh_token') {
      const token = typeof value === 'string' ? value : String(value)
      await setInternetCredentials('refresh_token', 'refresh', token)
      return
    }
    if (key === 'user_data') {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value)
      await setInternetCredentials('user_data', 'user', stringValue)
      return
    }
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value)
    await AsyncStorage.setItem(key, stringValue)
  },

  getItem: async (key) => {
    if (key === 'auth_token') {
      const creds = await getInternetCredentials('auth_token')
      return creds?.password || null
    }
    if (key === 'refresh_token') {
      const creds = await getInternetCredentials('refresh_token')
      return creds?.password || null
    }
    if (key === 'user_data') {
      const creds = await getInternetCredentials('user_data')
      if (!creds?.password) return null
      try {
        return JSON.parse(creds.password)
      } catch (_) {
        return creds.password
      }
    }
    const value = await AsyncStorage.getItem(key)
    if (value === null) return null
    try {
      return JSON.parse(value)
    } catch (error) {
      return value
    }
  },

  removeItem: async (key) => {
    if (key === 'auth_token') {
      await resetInternetCredentials('auth_token')
      return
    }
    if (key === 'refresh_token') {
      await resetInternetCredentials('refresh_token')
      return
    }
    if (key === 'user_data') {
      await resetInternetCredentials('user_data')
      return
    }
    await AsyncStorage.removeItem(key)
  },

  clear: async () => {
    await AsyncStorage.clear()
  }
}

export default storage
