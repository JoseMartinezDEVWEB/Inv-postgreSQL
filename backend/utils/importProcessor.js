const xlsx = require('xlsx');
const pdf = require('pdf-parse');
const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Función de utilidad para buscar valores en un objeto basados en múltiples posibles nombres de columna
 */
const getFieldValue = (item, keywords) => {
    const keys = Object.keys(item);
    for (const keyword of keywords) {
        const foundKey = keys.find(k => k.toLowerCase().trim() === keyword.toLowerCase().trim());
        if (foundKey !== undefined && item[foundKey] !== null && item[foundKey] !== '') {
            return item[foundKey];
        }
    }
    // Búsqueda por inclusión si no hubo coincidencia exacta
    for (const keyword of keywords) {
        const foundKey = keys.find(k => k.toLowerCase().includes(keyword.toLowerCase()));
        if (foundKey !== undefined && item[foundKey] !== null && item[foundKey] !== '') {
            return item[foundKey];
        }
    }
    return null;
};

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
        throw new Error('Formato de archivo no soportado. Use XLSX, XLS o PDF.');
    }
};

/**
 * Procesa archivos Excel (XLSX/XLS) con mapeo flexible de cabeceras
 */
const processExcel = (buffer) => {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    return data.map(item => {
        const nombre = getFieldValue(item, ['Producto', 'Nombre', 'Articulo', 'Descripcion', 'Item', 'nombre', 'producto', 'descripción', 'descrip', 'artículo']);
        const costo = getFieldValue(item, ['Costo', 'Precio', 'Valor', 'Precio Unitario', 'Unitario', 'costo', 'precio', 'pr_venta', 'pr venta', 'venta', 'cost']);
        const cantidad = getFieldValue(item, ['Cantidad', 'Existencia', 'Stock', 'Cant', 'Conteo', 'cantidad', 'existencia', 'inv', 'inventario', 'saldo', 'qty']);
        const unidad = getFieldValue(item, ['Unidad', 'Medida', 'Presentacion', 'U/M', 'unidad', 'medida', 'und', 'unid', 'um']);
        const codigo = getFieldValue(item, ['Codigo', 'SKU', 'Barras', 'Barcode', 'ID', 'codigo', 'sku', 'cod', 'código', 'cod.']);
        const categoria = getFieldValue(item, ['Categoria', 'Departamento', 'Grupo', 'Seccion', 'categoria', 'familia', 'línea', 'linea', 'rubro']);

        return {
            nombre: (nombre !== null && nombre !== undefined && nombre !== '') ? String(nombre).trim() : '',
            costoBase: parseFloat(String(costo || 0).replace(/[^0-9.]/g, '')) || 0,
            cantidadContada: parseFloat(String(cantidad || 0).replace(/[^0-9.]/g, '')) || 0,
            unidad: (unidad !== null && unidad !== undefined && unidad !== '') ? String(unidad).trim() : 'unidad',
            codigoBarras: (codigo !== undefined && codigo !== null && codigo !== '') ? String(codigo).trim() : null,
            categoria: (categoria !== null && categoria !== undefined && categoria !== '') ? String(categoria).trim() : 'General',
            descripcion: (item.Descripcion || item.descripcion) ? String(item.Descripcion || item.descripcion).trim() : '',
            importado: true
        };
    }).filter(p => p.nombre);
};

/**
 * Procesa archivos PDF usando IA (Gemini)
 */
const processPDF = async (buffer, apiKey) => {
    let text = '';
    try {
        const data = await pdf(buffer);
        text = data.text;
    } catch (e) {
        console.error("Error al extraer texto del PDF:", e);
        throw new Error("El archivo PDF parece estar corrupto o protegido. No se pudo extraer el texto.");
    }

    if (!text || text.trim().length < 10) {
        throw new Error('No se pudo extraer suficiente texto del PDF. Intente con un archivo que contenga texto legible.');
    }

    if (!apiKey) {
        throw new Error('Se requiere una API Key de Gemini para procesar archivos PDF.');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    const prompt = `
    ERES UN EXPERTO EN AUDITORÍA Y CONTABILIDAD.
    Analiza el reporte de inventario y extrae TODOS los productos en una lista simple.

    FORMATO DE SALIDA (ESTRICTO):
    Debes responder con una lista donde cada línea sea un producto con este formato exacto:
    NOMBRE | COSTO_UNITARIO | CANTIDAD | UNIDAD | CODIGO_BARRAS

    REGLAS DE EXTRACCIÓN:
    1. Usa el pipeline "|" como separador.
    2. No incluyas encabezados, ni markdown, ni explicaciones.
    3. Si un dato no existe, déjalo vacío (ej: "Producto X | 10.5 | 5 | UDS | ").
    4. Identifica el nombre aunque las columnas estén pegadas (ej: "UDS10.00$ 150.0015.00ACE BRILLANTE" -> "ACE BRILLANTE | 15.00 | 10.00 | UDS | ").
    5. No inventes datos. Si no hay costo, usa 0.

    Texto del reporte:
    """
    ${text.substring(0, 30000)}
    """
    `;

    // Modelos 2026 estables
    const modelosATestear = [
        { name: "gemini-flash-latest", version: 'v1beta' },
        { name: "gemini-2.5-flash", version: 'v1beta' },
        { name: "gemini-2.0-flash", version: 'v1beta' },
        { name: "gemini-pro-latest", version: 'v1beta' }
    ];

    let lastError = null;
    let productosRaw = null;

    for (const config of modelosATestear) {
        try {
            console.log(`[DEBUG] Consultando IA (${config.name})...`);
            const model = genAI.getGenerativeModel({ 
                model: config.name,
                generationConfig: {
                    temperature: 0.1,
                    topP: 0.8,
                    maxOutputTokens: 8192,
                }
            }, { apiVersion: config.version });
            
            const result = await Promise.race([
                model.generateContent(prompt),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout 60s')), 60000))
            ]);

            const response = await result.response;
            if (response.candidates && response.candidates.length > 0) {
                productosRaw = response.text();
                console.log(`✅ Respuesta recibida de ${config.name}`);
                break; 
            }
        } catch (e) {
            console.error(`❌ Fallo con ${config.name}:`, e.message);
            if (e.message.includes('429')) throw new Error("Cuota agotada en Gemini. Intenta más tarde.");
            lastError = e;
        }
    }

    if (!productosRaw) {
        throw new Error(`Error de conexión con IA: ${lastError?.message || 'Reintenta'}`);
    }

    try {
        console.log("[DEBUG] Procesando líneas de texto...");
        const lineas = productosRaw.split('\n');
        const productos = [];
        
        const palabrasIgnorar = ['nombre', 'unidad', 'total', 'cantidad', 'reporte', 'inventario', 'articulounidad'];

        for (let linea of lineas) {
            linea = linea.trim();
            if (!linea || !linea.includes('|')) continue;

            const partes = linea.split('|').map(p => p.trim());
            if (partes.length < 3) continue;

            const nombre = partes[0];
            const costo = parseFloat(partes[1].replace(/[^0-9.]/g, '')) || 0;
            const cantidad = parseFloat(partes[2].replace(/[^0-9.]/g, '')) || 0;
            const unidad = partes[3] || 'unidad';
            const codigo = partes[4] || '';

            const nombreLower = nombre.toLowerCase();
            if (nombre && !palabrasIgnorar.some(p => nombreLower.includes(p)) && (costo > 0 || cantidad > 0)) {
                productos.push({
                    nombre,
                    costoBase: costo,
                    cantidadContada: cantidad,
                    unidad: unidad.toLowerCase(),
                    codigoBarras: codigo,
                    importado: true
                });
            }
        }

        console.log(`✅ Extracción exitosa: ${productos.length} productos encontrados.`);
        return productos;

    } catch (e) {
        console.error("Error en parser de líneas:", e);
        throw new Error("No se pudo interpretar la respuesta de la IA. Por favor reintenta.");
    }
};

module.exports = {
    processFile
};
