import { productosApi, handleApiResponse, handleApiError } from './api';

/**
 * Importa productos desde XLSX/XLS/PDF usando el backend Node.js.
 * Para Excel/XLS no se requiere API key — se procesa puro en el servidor.
 * Para PDFs la API key es opcional (mejora resultados en PDFs complejos).
 *
 * @param {File} file - Archivo XLSX, XLS o PDF
 * @param {string|null} apiKey - API Key de Google Gemini (opcional, solo PDFs)
 * @returns {Promise<object>} { productos, totalCreados, totalActualizados, totalProcesados, totalErrores }
 */
export const importarProductosDesdeArchivo = async (file, apiKey = null) => {
    try {
        const response = await productosApi.importarDesdeArchivo(file, apiKey);
        // handleApiResponse devuelve data.datos cuando exito=true
        const resultado = handleApiResponse(response);

        // Si el backend devuelve el objeto completo (nuevo formato)
        if (resultado && typeof resultado === 'object' && 'totalCreados' in resultado) {
            return resultado;
        }

        // Fallback: legado — puede ser un array o { productos: [] }
        return resultado?.productos ?? resultado ?? [];
    } catch (error) {
        handleApiError(error);
        throw error;
    }
};

export const parseExcel = async () => {
    console.warn('parseExcel está deprecado. Use importarProductosDesdeArchivo');
    return [];
};

export const parsePDF = async () => {
    console.warn('parsePDF está deprecado. Use importarProductosDesdeArchivo');
    return '';
};

export const processWithAI = async () => {
    console.warn('processWithAI está deprecado. Use importarProductosDesdeArchivo');
    return [];
};
