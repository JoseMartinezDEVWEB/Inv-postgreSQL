const xlsx = require('xlsx');
const pdf = require('pdf-parse');
const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Procesa un archivo (XLSX o PDF) y extrae una lista de productos.
 */
const processFile = async (fileBuffer, fileName, apiKey = null) => {
    const extension = fileName.split('.').pop().toLowerCase();

    if (extension === 'xlsx' || extension === 'xls') {
        return processExcel(fileBuffer);
    } else if (extension === 'pdf') {
        return processPDF(fileBuffer, apiKey);
    } else {
        throw new Error('Formato de archivo no soportado. Use XLSX o PDF.');
    }
};

/**
 * Procesa archivos Excel (XLSX/XLS)
 */
const processExcel = (buffer) => {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    // Mapear campos comunes a la estructura de ProductoGeneral
    return data.map(item => ({
        nombre: item.Producto || item.Nombre || item.nombre || '',
        costoBase: parseFloat(item.Costo || item.Precio || item.costo || 0),
        unidad: item.Unidad || item.unidad || 'unidad',
        codigoBarras: String(item.SKU || item.Codigo || item.codigoBarras || '').trim(),
        categoria: item.Categoria || item.categoria || 'General',
        descripcion: item.Descripcion || item.descripcion || '',
        proveedor: item.Proveedor || item.proveedor || ''
    })).filter(p => p.nombre);
};

/**
 * Procesa archivos PDF usando IA (Gemini)
 */
const processPDF = async (buffer, apiKey) => {
    const data = await pdf(buffer);
    const text = data.text;

    if (!apiKey) {
        throw new Error('Se requiere una API Key de Gemini para procesar archivos PDF.');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    const prompt = `
    Analiza el siguiente texto extraído de un catálogo de productos y genera una lista en formato JSON de los productos encontrados.
    Extrae: nombre, costoBase (solo el número), unidad (ej: unidad, kg, lb), codigoBarras (si hay), categoria y descripcion.
    
    Texto del catálogo:
    """
    ${text}
    """
    
    Responde ÚNICAMENTE con el JSON bajo este esquema: 
    [{"nombre": "...", "costoBase": 0.0, "unidad": "...", "codigoBarras": "...", "categoria": "...", "descripcion": "..."}]
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let jsonText = response.text();
    
    // Limpiar respuesta si viene con markdown
    jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    try {
        const productos = JSON.parse(jsonText);
        return Array.isArray(productos) ? productos : [];
    } catch (e) {
        console.error("Error parseando JSON de Gemini:", e);
        throw new Error("La IA no pudo formatear los datos correctamente. Intente subir un archivo más legible.");
    }
};

module.exports = {
    processFile
};
