import React, { createContext, useContext, useCallback, useState, useRef, useEffect } from 'react'
import { saludApi } from '../services/api'

const LoaderContext = createContext(null)

export const LoaderProvider = ({ children }) => {
  const [visible, setVisible] = useState(false)
  const timeoutRef = useRef(null)
  const [durationMs, setDurationMs] = useState(1200)
  const [variant, setVariant] = useState('splash') // splash | navigate | product | financial | config | export | print | notice | login | logout
  const [message, setMessage] = useState('')

  // Evaluar salud del backend una vez y ajustar duración a 6s cuando todo va bien
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const [s1, s2] = await Promise.allSettled([saludApi.check(), saludApi.checkDB()])
        const ok1 = s1.status === 'fulfilled' && s1.value?.status === 200
        const ok2 = s2.status === 'fulfilled' && s2.value?.status === 200
        if (mounted && ok1 && ok2) setDurationMs(6000)
      } catch {
        /* mantener 1200ms por defecto */
      }
    })()
    return () => { mounted = false }
  }, [durationMs])

  const hideLoader = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setVisible(false)
    setVariant('splash')
    setMessage('')
  }, [])

  const showLoader = useCallback((duration = durationMs) => {
    // Evitar parpadeos mostrando al menos 400ms
    const safeDuration = Math.max(duration, 400)
    setVisible(true)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      setVisible(false)
      timeoutRef.current = null
    }, safeDuration)
  }, [])

  // API de alto nivel para variantes
  const showAnimation = useCallback((name, duration = durationMs, customMessage = '') => {
    setVariant(name || 'splash')
    setMessage(customMessage || '')
    showLoader(duration)
  }, [durationMs, showLoader])

  const value = { visible, showLoader, hideLoader, durationMs, variant, message, showAnimation, setVariant }
  return (
    <LoaderContext.Provider value={value}>
      {children}
    </LoaderContext.Provider>
  )
}

export const useLoader = () => {
  const ctx = useContext(LoaderContext)
  if (!ctx) throw new Error('useLoader debe usarse dentro de LoaderProvider')
  return ctx
}
