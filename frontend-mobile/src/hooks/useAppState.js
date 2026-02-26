import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

const APP_STATE_KEY = '@app_state_backup'
const AUTO_SAVE_INTERVAL = 30000 // 30 segundos

/**
 * Hook para manejar el estado de la aplicación y autoguardado
 * @param {Function} onSaveState - Función que retorna el estado a guardar
 * @param {Function} onRestoreState - Función para restaurar el estado guardado
 * @param {Object} options - Opciones adicionales
 */
export const useAppState = (onSaveState, onRestoreState, options = {}) => {
  const { autoSaveInterval = AUTO_SAVE_INTERVAL, enabled = true } = options
  const appState = useRef(AppState.currentState)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!enabled) return

    // Restaurar estado al montar
    const restoreState = async () => {
      try {
        const savedState = await AsyncStorage.getItem(APP_STATE_KEY)
        if (savedState) {
          const parsedState = JSON.parse(savedState)
          if (onRestoreState) {
            onRestoreState(parsedState)
          }
        }
      } catch (error) {
        console.log('Error restaurando estado:', error)
      }
    }

    restoreState()

    // Configurar intervalo de autoguardado
    if (autoSaveInterval > 0) {
      intervalRef.current = setInterval(async () => {
        try {
          if (onSaveState) {
            const stateToSave = onSaveState()
            if (stateToSave) {
              await AsyncStorage.setItem(APP_STATE_KEY, JSON.stringify(stateToSave))
            }
          }
        } catch (error) {
          console.log('Error en autoguardado:', error)
        }
      }, autoSaveInterval)
    }

    // Listener para cambios de estado de la app
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App vuelve a foreground - restaurar estado
        try {
          const savedState = await AsyncStorage.getItem(APP_STATE_KEY)
          if (savedState) {
            const parsedState = JSON.parse(savedState)
            if (onRestoreState) {
              onRestoreState(parsedState)
            }
          }
        } catch (error) {
          console.log('Error restaurando estado al volver a foreground:', error)
        }
      } else if (
        appState.current === 'active' &&
        nextAppState.match(/inactive|background/)
      ) {
        // App va a background - guardar estado
        try {
          if (onSaveState) {
            const stateToSave = onSaveState()
            if (stateToSave) {
              await AsyncStorage.setItem(APP_STATE_KEY, JSON.stringify(stateToSave))
            }
          }
        } catch (error) {
          console.log('Error guardando estado al ir a background:', error)
        }
      }

      appState.current = nextAppState
    })

    return () => {
      subscription?.remove()
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [enabled, autoSaveInterval, onSaveState, onRestoreState])
}

export default useAppState





