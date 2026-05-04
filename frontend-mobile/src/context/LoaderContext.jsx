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
        // Ejecutar chequeos de salud sin bloquear el inicio si fallan o tardan mucho
        const healthPromise = Promise.allSettled([
          saludApi.check(),
          saludApi.checkDB()
        ]);
        
        // Timeout de 2 segundos para el chequeo de salud
        const timeoutPromise = new Promise(resolve => setTimeout(() => resolve('timeout'), 2000));
        
        const result = await Promise.race([healthPromise, timeoutPromise]);
        
        if (result === 'timeout') {
          console.log('⏳ LoaderContext: Salud API timeout, continuando...');
          if (mounted) setDurationMs(1200);
        } else {
          const [s1, s2] = result;
          const ok1 = s1.status === 'fulfilled' && s1.value?.status === 200;
          const ok2 = s2.status === 'fulfilled' && s2.value?.status === 200;
          
          if (mounted) {
            if (ok1 && ok2) {
              setDurationMs(600); // Rápido si está sano
              console.log('🚀 LoaderContext: Sistema saludable, acelerando inicio');
            } else {
              setDurationMs(1500); // Un poco más lento si hay problemas
              console.log('⚠️ LoaderContext: Problemas de salud detectados');
            }
          }
        }
      } catch (err) {
        console.log('❌ LoaderContext: Error en health check:', err.message);
        if (mounted) setDurationMs(1200);
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
