import { productosApi, handleApiResponse, handleApiError } from './api';

/**
 * Importa productos desde un archivo XLSX o PDF usando el backend Python
 * Esta función envía el archivo al backend que lo procesa con Python e IA
 * 
 * @param {File} file - Archivo XLSX, XLS o PDF
 * @param {string} apiKey - API Key de Google Gemini (opcional, solo para PDFs complejos)
 * @returns {Promise<Array>} Array de productos procesados
 */
export const importarProductosDesdeArchivo = async (file, apiKey = null) => {
    try {
        const response = await productosApi.importarDesdeArchivo(file, apiKey);
        const resultado = handleApiResponse(response);
        
        // El backend devuelve los productos ya procesados
        return resultado.productos || [];
    } catch (error) {
        handleApiError(error);
        throw error;
    }
};














