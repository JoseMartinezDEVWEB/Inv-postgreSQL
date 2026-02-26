import { productosApi, handleApiResponse, handleApiError } from './api';
import api from './api';
import storage from './storage';

/**
 * Importa productos desde un archivo XLSX o PDF usando el backend Python
 * Esta función envía el archivo al backend que lo procesa con Python e IA
 * 
 * @param {Object} file - Objeto de archivo de expo-document-picker con { uri, name, mimeType }
 * @param {string} apiKey - API Key de Google Gemini (opcional, solo para PDFs complejos)
 * @returns {Promise<Array>} Array de productos procesados
 */
export const importarProductosDesdeArchivo = async (file, apiKey = null) => {
    try {
        // Verificar que tenemos token antes de intentar la petición
        const token = await storage.getItem('auth_token');
        if (!token) {
            throw new Error('No hay sesión activa. Por favor, inicia sesión nuevamente.');
        }

        console.log('🔑 Token verificado, preparando envío...');

        // Validar que el archivo existe
        if (!file || !file.uri || !file.name) {
            throw new Error('Archivo no válido. Por favor selecciona un archivo.');
        }

        // Validar extensión del archivo
        const extension = file.name.split('.').pop()?.toLowerCase();
        if (!['xlsx', 'xls', 'pdf'].includes(extension)) {
            throw new Error('Formato de archivo no soportado. Use XLSX, XLS o PDF');
        }

        console.log('📤 Preparando envío de archivo:', file.name);

        // Procesar URI: manejar prefijo file:// en Android/iOS
        let fileUri = file.uri;
        if (fileUri && fileUri.startsWith('file://')) {
            // En React Native, file:// es necesario para Android/iOS
            // No eliminamos el prefijo, pero nos aseguramos de que esté presente
            fileUri = fileUri;
        }

        // Validar que tengamos las propiedades necesarias
        if (!fileUri || !file.name) {
            throw new Error('El archivo debe tener uri y name válidos');
        }

        const formData = new FormData();
        
        // React Native requiere este formato específico: objeto con uri, type, name
        // El tipo MIME debe estar correctamente establecido
        const mimeType = file.mimeType || getMimeType(extension) || 'application/octet-stream';
        
        formData.append('archivo', {
            uri: fileUri,
            type: mimeType,
            name: file.name,
        });

        if (apiKey && apiKey.trim()) {
            formData.append('apiKey', apiKey.trim());
        }

        console.log('📡 Enviando al backend...', {
            fileName: file.name,
            mimeType: mimeType,
            uriLength: fileUri.length
        });

        // La ruta /productos/generales/importar está en ROUTES_PREFER_REMOTE
        // NO establecer Content-Type manualmente - Axios lo hace automáticamente
        // con el boundary correcto para multipart/form-data
        const response = await api.post('/productos/generales/importar', formData, {
            headers: {
                // NO establecer 'Content-Type' - Axios lo establece automáticamente
                // con el boundary correcto: 'multipart/form-data; boundary=----WebKitFormBoundary...'
                'Accept': 'application/json',
            },
            timeout: 120000, // 2 minutos para procesamiento de archivos grandes
        });

        console.log('✅ Respuesta del servidor recibida');

        // Validar estructura de respuesta
        if (!response || !response.data) {
            throw new Error('Respuesta inválida del servidor');
        }

        if (response.data.exito !== false && response.data.datos) {
            const productos = Array.isArray(response.data.datos) 
                ? response.data.datos 
                : (response.data.datos.productos || []);
            return productos;
        } else {
            const mensajeError = response.data?.mensaje || response.data?.error || 'Error desconocido en la respuesta';
            throw new Error(mensajeError);
        }

    } catch (error) {
        console.error('❌ Error en importarProductosDesdeArchivo:', error);
        console.error('Error details:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status,
            code: error.code
        });
        
        let mensaje = 'Error al importar archivo';
        
        // Manejar diferentes tipos de errores
        if (error.response) {
            // Error del servidor (500, 400, etc.)
            const status = error.response.status;
            const errorData = error.response.data;
            
            // Manejo especial para errores 401 (No autenticado)
            if (status === 401) {
                const codigo = errorData?.codigo || errorData?.code;
                if (codigo === 'INVALID_TOKEN' || codigo === 'TOKEN_EXPIRED' || codigo === 'AUTH_ERROR') {
                    mensaje = errorData?.mensaje || 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.';
                    // Opcional: podrías redirigir al login aquí
                    console.warn('⚠️ Token inválido o expirado. El usuario debe iniciar sesión nuevamente.');
                } else {
                    mensaje = errorData?.mensaje || 'No estás autenticado. Por favor, inicia sesión nuevamente.';
                }
            } else {
                // Intentar parsear si es string
                if (typeof errorData === 'string') {
                    try {
                        // Si es un string que parece JSON, intentar parsearlo
                        const parsed = JSON.parse(errorData);
                        mensaje = parsed.mensaje || parsed.error || parsed.message || errorData;
                    } catch {
                        // Si no es JSON válido, usar el string directamente
                        mensaje = errorData || `Error del servidor (${status})`;
                    }
                } else if (errorData && typeof errorData === 'object') {
                    // Si es un objeto, extraer el mensaje
                    mensaje = errorData.mensaje || errorData.error || errorData.message || `Error del servidor (${status})`;
                } else {
                    mensaje = `Error del servidor (${status})`;
                }
            }
            
            console.error('Error del servidor:', errorData);
        } else if (error.request) {
            // Error de conexión (timeout, red, etc.)
            if (error.code === 'ECONNABORTED') {
                mensaje = 'Tiempo de espera agotado. El archivo puede ser muy grande o el servidor está ocupado.';
            } else if (error.message && error.message.includes('JSON')) {
                mensaje = 'Error al procesar la respuesta del servidor. Verifica que el archivo sea válido.';
            } else {
                mensaje = 'No se pudo conectar con el servidor. Verifica tu conexión a internet.';
            }
        } else {
            // Error de configuración o validación
            mensaje = error.message || 'Error desconocido al procesar la solicitud';
        }
        
        throw new Error(mensaje);
    }
};

// Función auxiliar para obtener MIME type basado en extensión
const getMimeType = (extension) => {
    const mimeTypes = {
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'xls': 'application/vnd.ms-excel',
        'pdf': 'application/pdf',
    };
    return mimeTypes[extension?.toLowerCase()] || null;
};
