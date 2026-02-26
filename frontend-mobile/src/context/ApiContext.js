import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const ApiContext = createContext();

// Hook personalizado para usar el contexto
export const useApi = () => useContext(ApiContext);

// Proveedor del contexto
export const ApiProvider = ({ children }) => {
  const [apiUrl, setApiUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadApiUrl = async () => {
      try {
        const storedUrl = await AsyncStorage.getItem('apiUrl');
        const initialUrl = storedUrl || process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.100:4000/api';
        setApiUrl(initialUrl);
        axios.defaults.baseURL = initialUrl;
      } catch (error) {
        console.error("Error cargando la URL de la API desde AsyncStorage:", error);
        // Fallback a la URL por defecto en caso de error
        const fallbackUrl = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.100:4000/api';
        setApiUrl(fallbackUrl);
        axios.defaults.baseURL = fallbackUrl;
      } finally {
        setIsLoading(false);
      }
    };

    loadApiUrl();
  }, []);

  const updateApiUrl = async (newUrl) => {
    try {
      // Asegurarse de que la URL tenga el formato correcto
      const formattedUrl = newUrl.startsWith('http') ? newUrl : `http://${newUrl}`;
      await AsyncStorage.setItem('apiUrl', formattedUrl);
      setApiUrl(formattedUrl);
      axios.defaults.baseURL = formattedUrl;
      console.log('URL de la API actualizada:', formattedUrl);
      return true;
    } catch (error) {
      console.error("Error guardando la URL de la API:", error);
      return false;
    }
  };

  const value = {
    apiUrl,
    updateApiUrl,
    isLoading,
    isUrlDefault: apiUrl.includes('192.168.1.100'), // Para saber si se está usando la URL por defecto
  };

  return (
    <ApiContext.Provider value={value}>
      {!isLoading && children}
    </ApiContext.Provider>
  );
};
