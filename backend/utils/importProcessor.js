const xlsx = require('xlsx');
const pdf = require('pdf-parse');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// ─── Helpers ─────────────────────────────────────────────────────────────────

const parseNum = (str) => {
    if (str === null || str === undefined || str === '') return 0;
    return parseFloat(String(str).replace(/[$,\s]/g, '')) || 0;
};

const getFieldValue = (item, keywords) => {
    const keys = Object.keys(item);
    for (const keyword of keywords) {
        const foundKey = keys.find(k => k.toLowerCase().trim() === keyword.toLowerCase().trim());
        if (foundKey !== undefined && item[foundKey] !== null && item[foundKey] !== '') return item[foundKey];
    }
    for (const keyword of keywords) {
        const foundKey = keys.find(k => k.toLowerCase().includes(keyword.toLowerCase()));
        if (foundKey !== undefined && item[foundKey] !== null && item[foundKey] !== '') return item[foundKey];
    }
    return null;
};

// ─── Excel ────────────────────────────────────────────────────────────────────

const processExcel = (buffer) => {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet);

    return data.map(item => {
        const nombre   = getFieldValue(item, ['Producto','Nombre','Articulo','Descripcion','Item','nombre','producto','artículo']);
        const costo    = getFieldValue(item, ['Costo','Precio','Valor','Precio Unitario','Unitario','costo','precio','venta','cost']);
        const cantidad = getFieldValue(item, ['Cantidad','Existencia','Stock','Cant','cantidad','existencia','saldo','qty']);
        const unidad   = getFieldValue(item, ['Unidad','Medida','U/M','unidad','medida','und','um']);
        const codigo   = getFieldValue(item, ['Codigo','SKU','Barras','Barcode','codigo','sku','cod']);
        const categoria = getFieldValue(item, ['Categoria','Departamento','Grupo','categoria','familia','linea']);

        return {
            nombre: nombre ? String(nombre).trim() : '',
            costoBase: parseFloat(String(costo || 0).replace(/[^0-9.]/g, '')) || 0,
            cantidadContada: parseFloat(String(cantidad || 0).replace(/[^0-9.]/g, '')) || 0,
            unidad: unidad ? String(unidad).trim() : 'unidad',
            codigoBarras: codigo ? String(codigo).trim() : null,
            categoria: categoria ? String(categoria).trim() : 'General',
            importado: true
        };
    }).filter(p => p.nombre);
};

// ─── Structured PDF Parsers ───────────────────────────────────────────────────

/**
 * Parser for "Reporte de inventario" format (Infocolmados Rev. 13 and similar).
 *
 * IMPORTANT: pdf-parse extracts columns in PDF content-stream order, NOT visual order.
 * Actual extracted line format: UNIT + QTY + $ + TOTAL + COST + NAME  (all concatenated)
 * Example: "UDS10.00$ 150.0015.00ACE BRILLANTE 100 GRAMO"
 * Example: "UDS4.00$ 3,233.48808.37BRUGAL DOBLE RESERVA 700 ML UNIDAD"
 * Header:  "ARTICULOUNIDADCANTIDADTOTALCOSTO"  (column names concatenated)
 *
 * Regex breakdown for each product line:
 *   ([A-Z]{2,8})      → UNIT (e.g. UDS)
 *   ([\d,]+\.?\d*)    → QUANTITY (e.g. 10.00 or 1.21)
 *   \$\s*             → dollar sign separator
 *   ([\d,]+\.\d{2})   → TOTAL (exactly 2 decimal places, e.g. 1,026.00)
 *   ([\d,]+\.\d{2})   → COST  (exactly 2 decimal places, e.g. 19.00)
 *   (.+)              → NAME  (rest of line, e.g. ACE BRILLANTE 100 GRAMO)
 */
const parseReporteInventario = (text) => {
    const productos = [];
    const lines = text.split('\n');
    let inTable = false;

    // Header appears as "ARTICULOUNIDADCANTIDADTOTALCOSTO" (all concatenated, no spaces)
    const headerRx = /ARTICULOUNIDAD|ARTICULOUNIDADCANTIDAD/i;

    // Matches: UNIT(2-8 caps) + QTY + $ + TOTAL(2 dec) + COST(2 dec) + NAME
    const productRx = /^([A-Z]{2,8})([\d,]+\.?\d*)\$\s*([\d,]+\.\d{2})([\d,]+\.\d{2})(.+)$/;

    const skipRx = /^(Total\s|Lineas\s|Contador\s|Tel[eé]fono|Pag\.\s|Impreso|Observaci|Rev\.\s|Reporte\s|Ordenado|Cliente\s*:|Inventario No)/i;

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        // Detect table header (repeats on every page)
        if (headerRx.test(line)) {
            inTable = true;
            continue;
        }
        if (!inTable) continue;
        if (skipRx.test(line)) continue;
        if (/^\d+$/.test(line)) continue; // Pure number lines (page separators)

        const m = line.match(productRx);
        if (!m) continue;

        const unidad   = m[1].trim().toLowerCase();
        const cantidad = parseNum(m[2]);
        const total    = parseNum(m[3]);
        const costo    = parseNum(m[4]);
        const nombre   = m[5].trim();

        if (!nombre || nombre.length < 2) continue;
        if (cantidad === 0 && costo === 0 && total === 0) continue;

        productos.push({
            nombre,
            costoBase: costo,
            cantidadContada: cantidad,
            valorTotal: total,
            unidad,
            codigoBarras: null,
            importado: true
        });
    }

    return productos;
};

/**
 * Line-by-line helper: extracts a monetary value associated with a label.
 *
 * Handles the 4 formats found in Infocolmados PDFs:
 *   1. Same line, $ before value  → "EFECTIVO EN CAJA$ 15,915.00"
 *   2. Same line, value before $  → "TOTAL UTILIDADES NETAS43,950.34 $"
 *   3. Next line has the value    → "VENTAS" \n "$ 300,450.00"
 *   4. Previous line has the value→ "$ 2,000.00" \n "TOTAL PASIVOS"
 *
 * @param {string[]} lines
 * @param {RegExp} labelRx  - Pattern to match the label line
 * @param {'next'|'prev'|'any'} direction - Where to look for value relative to label
 * @returns {number|undefined}
 */
const extractLineValue = (lines, labelRx, direction = 'any') => {
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!labelRx.test(line)) continue;

        if (direction !== 'prev') {
            // Format 1: label line has $ then value — "LABEL$ VALUE"
            let m = line.match(/\$\s*([\d,]+\.?\d+)/);
            if (m) return parseNum(m[1]);

            // Format 2: label line has value then $ — "LABELVALUE $"
            // Must have a $ at or near end of line
            m = line.match(/([\d,]+\.?\d+)\s*\$\s*$/);
            if (m) return parseNum(m[1]);
        }

        if (direction !== 'next') {
            // Format 4: value on the line BEFORE the label
            for (let j = i - 1; j >= Math.max(0, i - 2); j--) {
                const prev = lines[j].trim();
                if (!prev) continue;
                let m = prev.match(/\$\s*([\d,]+\.?\d+)\s*$/);
                if (m) return parseNum(m[1]);
                break;
            }
        }

        if (direction !== 'prev') {
            // Format 3: value on the next line
            for (let j = i + 1; j < Math.min(lines.length, i + 3); j++) {
                const next = lines[j].trim();
                if (!next) continue;
                let m = next.match(/^\$\s*([\d,]+\.?\d+)/);
                if (m) return parseNum(m[1]);
                // Bare number on next line (no $ prefix)
                m = next.match(/^([\d,]+\.?\d+)\s*$/);
                if (m) return parseNum(m[1]);
                break;
            }
        }

        return undefined;
    }
    return undefined;
};

/**
 * Extracts a percentage value (14.63) from "LABELVALUE %" or "LABEL\nVALUE %"
 */
const extractPercentage = (lines, labelRx) => {
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!labelRx.test(line)) continue;

        // Same line: "PORCIENTO NETO14.63 %"
        let m = line.match(/([\d.]+)\s*%/);
        if (m) return parseFloat(m[1]);

        // Next line: "18.01 %"
        if (i + 1 < lines.length) {
            const next = lines[i + 1].trim();
            m = next.match(/^([\d.]+)\s*%/);
            if (m) return parseFloat(m[1]);
        }
        return undefined;
    }
    return undefined;
};

/**
 * Parser for Balance General section (Infocolmados format).
 *
 * @param {string} text
 * @param {boolean} forceMode - When true, skips the "BALANCE GENERAL" header check.
 */
const parseBalanceGeneral = (text, forceMode = false) => {
    if (!forceMode && !/BALANCE GENERAL/i.test(text)) return null;

    const balance = {};
    const lines = text.split('\n');

    const set = (key, val) => { if (val !== undefined && val !== null) balance[key] = val; };

    // Efectivo en caja
    set('efectivo_caja_banco', extractLineValue(lines, /EFECTIVO EN CAJA/i));

    // Cuentas por cobrar — first match (CLIENTE FIAO POR COBRAR or similar)
    set('cuentas_por_cobrar', extractLineValue(lines, /CLIENTE FIAO POR COBRAR|CUENTAS POR COBRAR|CLIENTES? FIADOS?/i));

    // Inventario de mercancía — take FIRST $ value on the line (line may have two values)
    for (const line of lines) {
        if (/INVENTARIO DE MERCANC/i.test(line)) {
            const m = line.match(/\$\s*([\d,]+\.?\d+)/);
            if (m) { balance.valor_inventario = parseNum(m[1]); break; }
        }
    }

    // Activos fijos — take FIRST $ value on the line
    for (const line of lines) {
        if (/^ACTIVOS? FIJOS?/i.test(line.trim())) {
            const m = line.match(/\$\s*([\d,]+\.?\d+)/);
            if (m) { balance.activos_fijos = parseNum(m[1]); break; }
        }
    }

    // Total corrientes (may not exist in all formats)
    set('total_corrientes', extractLineValue(lines, /TOTAL CORRIENTES/i));

    // Total activos
    set('total_activos', extractLineValue(lines, /TOTAL ACTIVOS/i));

    // Total pasivos — in Infocolmados, label appears WITHOUT value on same line;
    // value is on the line immediately before the label
    set('total_pasivos', extractLineValue(lines, /^TOTAL PASIVOS$/i, 'prev'));
    // Fallback: some formats put it inline
    if (!balance.total_pasivos) {
        set('total_pasivos', extractLineValue(lines, /TOTAL PASIVOS/i, 'next'));
    }

    // Capital de trabajo / capital contable — value often on next line
    set('capital_contable', extractLineValue(lines, /CAPITAL DE TRABAJO|CAPITAL CONTABLE/i, 'next'));
    // Fallback: ADICIÓN DE CAPITAL (value concatenated without $)
    if (!balance.capital_contable) {
        for (const line of lines) {
            if (/ADICI[ÓO]N DE CAPITAL/i.test(line)) {
                const m = line.match(/([\d,]+\.?\d+)/);
                if (m) { balance.capital_contable = parseNum(m[1]); break; }
            }
        }
    }

    // Total pasivos + capital
    set('total_pasivos_mas_capital', extractLineValue(lines, /TOTAL PASIVOS\s*\+\s*CAPITAL/i, 'next'));

    // Ventas — value typically on next line: "VENTAS" \n "$ 300,450.00"
    set('ventas_del_mes', extractLineValue(lines, /^VENTAS$|VENTAS DEL MES/i, 'next'));

    // Utilidad bruta (same line)
    set('utilidad_bruta', extractLineValue(lines, /UTILIDAD BRUTA/i));

    // Gastos — in Infocolmados: "GASTOS" header, then detail lines, then a line like
    // "8,165.00$ 10,165.00" — the $ value is the TOTAL
    for (let i = 0; i < lines.length; i++) {
        if (/^GASTOS$/i.test(lines[i].trim())) {
            for (let j = i + 1; j < Math.min(lines.length, i + 5); j++) {
                const l = lines[j].trim();
                // A line that ends with $ VALUE is the total
                const m = l.match(/\$\s*([\d,]+\.?\d+)\s*$/);
                if (m) { balance.gastos_generales = parseNum(m[1]); break; }
            }
            break;
        }
        // Also try "TOTAL GASTOS" or "GASTOS GENERALES"
        if (/TOTAL GASTOS|GASTOS GENERALES/i.test(lines[i].trim())) {
            const m = lines[i].match(/\$\s*([\d,]+\.?\d+)/);
            if (m) { balance.gastos_generales = parseNum(m[1]); break; }
        }
    }

    // Utilidad neta (same line)
    set('utilidad_neta', extractLineValue(lines, /UTILIDAD NETA/i));

    // Porcentajes
    const porcNeto = extractPercentage(lines, /PORCIENTO NETO/i);
    if (porcNeto !== undefined) balance.porcentaje_neto = porcNeto;

    const porcBruto = extractPercentage(lines, /PORCIENTO BRUTO/i);
    if (porcBruto !== undefined) balance.porcentaje_bruto = porcBruto;

    const found = Object.keys(balance).length;
    if (found === 0) return null;
    console.log(`[Balance] ${found} campos: ${Object.keys(balance).join(', ')}`);
    return balance;
};

/**
 * Parser for "Distribución de Saldo" section.
 *
 * @param {string} text
 * @param {boolean} forceMode - When true, skips the header check.
 */
const parseDistribucionSaldo = (text, forceMode = false) => {
    if (!forceMode && !/DISTRIBUCION DE SALDO/i.test(text)) return null;

    const dist = {};
    const lines = text.split('\n');
    const set = (key, val) => { if (val !== undefined && val !== null) dist[key] = val; };

    // Total utilidades netas — Infocolmados format: "TOTAL UTILIDADES NETAS43,950.34 $"
    // (value BEFORE $, at end of line)
    for (const line of lines) {
        if (/TOTAL UTILIDADES NETAS/i.test(line)) {
            // Value before trailing $
            let m = line.match(/([\d,]+\.?\d+)\s*\$\s*$/);
            if (m) { dist.total_utilidades_netas = parseNum(m[1]); break; }
            // Value after $
            m = line.match(/\$\s*([\d,]+\.?\d+)/);
            if (m) { dist.total_utilidades_netas = parseNum(m[1]); break; }
        }
    }

    // The fields below may come from the BALANCE section within the same PDF
    set('efectivo_caja_banco', extractLineValue(lines, /EFECTIVO EN CAJA/i));

    for (const line of lines) {
        if (/INVENTARIO DE MERCANC/i.test(line)) {
            const m = line.match(/\$\s*([\d,]+\.?\d+)/);
            if (m) { dist.inventario_mercancia = parseNum(m[1]); break; }
        }
    }

    for (const line of lines) {
        if (/^ACTIVOS? FIJOS?/i.test(line.trim())) {
            const m = line.match(/\$\s*([\d,]+\.?\d+)/);
            if (m) { dist.activos_fijos = parseNum(m[1]); break; }
        }
    }

    set('cuentas_por_cobrar', extractLineValue(lines, /CLIENTE FIAO POR COBRAR|CUENTAS POR COBRAR/i));
    set('cuentas_por_pagar',  extractLineValue(lines, /CUENTAS POR PAGAR/i));
    if (!dist.cuentas_por_pagar) {
        set('cuentas_por_pagar', extractLineValue(lines, /^TOTAL PASIVOS$/i, 'prev'));
    }

    const found = Object.keys(dist).length;
    if (found === 0) return null;
    console.log(`[Distribucion] ${found} campos: ${Object.keys(dist).join(', ')}`);
    return dist;
};

// ─── AI Fallback (sequential, not parallel) ───────────────────────────────────

const parseAIResponse = (raw) => {
    const productos = [];
    const skipWords = ['nombre','unidad','total','cantidad','reporte','inventario','articulo','producto','encabezado'];

    for (let line of raw.split('\n')) {
        line = line.trim().replace(/^[-*•]\s*/, '');
        if (!line || !line.includes('|')) continue;

        const parts = line.split('|').map(p => p.trim());
        if (parts.length < 3) continue;

        const nombre   = parts[0];
        const cantidad = parseNum(parts[1]);
        const costo    = parseNum(parts[2]);
        const unidad   = parts[3] || 'unidad';

        if (!nombre || nombre.length < 2) continue;
        if (skipWords.some(w => nombre.toLowerCase().includes(w))) continue;
        if (costo === 0 && cantidad === 0) continue;

        productos.push({ nombre, costoBase: costo, cantidadContada: cantidad, unidad, codigoBarras: null, importado: true });
    }
    return productos;
};

const processPDFWithAI = async (text, apiKey) => {
    const genAI = new GoogleGenerativeAI(apiKey);

    const prompt = `
Eres un experto en auditoría y contabilidad. Extrae TODOS los productos del siguiente texto de inventario.

FORMATO DE SALIDA (una línea por producto, sin encabezados ni texto extra):
NOMBRE_PRODUCTO | CANTIDAD | COSTO_UNITARIO | UNIDAD

REGLAS:
- Separador exacto: |
- No incluyas totales, subtotales, encabezados, pies de página ni texto libre
- Si un valor no existe usa 0
- Extrae TODOS los productos, sin omitir ninguno
- Los nombres van tal como aparecen en el texto

Texto:
"""
${text.substring(0, 60000)}
"""
`;

    // Try models sequentially (not in parallel) to avoid rate limiting
    const models = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-pro-latest'];
    let lastError = null;

    for (const modelName of models) {
        try {
            console.log(`[AI] Intentando ${modelName}...`);
            const model = genAI.getGenerativeModel({
                model: modelName,
                generationConfig: { temperature: 0.1, maxOutputTokens: 32768 }
            }, { apiVersion: 'v1beta' });

            const result = await Promise.race([
                model.generateContent(prompt),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout 90s')), 90000))
            ]);
            const response = await result.response;
            if (response.candidates?.length > 0) {
                const raw = response.text();
                console.log(`✅ IA (${modelName}) respondió.`);
                return parseAIResponse(raw);
            }
        } catch (e) {
            console.error(`❌ IA (${modelName}) falló: ${e.message}`);
            if (e.message.includes('429')) throw new Error('Cuota de IA agotada. Intenta más tarde.');
            lastError = e;
        }
    }

    throw new Error(`IA no disponible: ${lastError?.message || 'Sin respuesta'}`);
};

// ─── Main PDF processor ───────────────────────────────────────────────────────

/**
 * @param {Buffer} buffer
 * @param {string|null} apiKey
 * @param {'auto'|'productos'|'balance'|'distribucion'} tipo
 *   - 'auto'       : detect format automatically (original behavior)
 *   - 'productos'  : parse only product list (skip balance/dist parsers)
 *   - 'balance'    : parse only balance general (forceMode — no header required)
 *   - 'distribucion': parse only distribución de saldo (forceMode)
 */
const processPDF = async (buffer, apiKey, tipo = 'auto') => {
    let text = '';
    let numPages = 0;
    try {
        const data = await pdf(buffer);
        text  = data.text;
        numPages = data.numpages || 0;
    } catch (e) {
        console.error('[PDF] Error extrayendo texto:', e.message);
        throw new Error('El archivo PDF parece estar corrupto o protegido.');
    }

    if (!text || text.trim().length < 10) {
        throw new Error('No se pudo extraer texto del PDF. Puede ser un PDF de imágenes escaneadas.');
    }

    console.log(`[PDF] ${numPages} páginas, ${text.length} chars, tipo=${tipo}`);

    // ── Forzar extracción de balance (usuario eligió explícitamente este tipo) ──
    if (tipo === 'balance') {
        const balance = parseBalanceGeneral(text, true);
        return { productos: [], balance, distribucion: null, tipo: 'balance' };
    }

    // ── Forzar extracción de distribución ──────────────────────────────────────
    if (tipo === 'distribucion') {
        const distribucion = parseDistribucionSaldo(text, true);
        return { productos: [], balance: null, distribucion, tipo: 'distribucion' };
    }

    // ── Forzar extracción de productos ─────────────────────────────────────────
    if (tipo === 'productos') {
        const hasInventoryTable = /ARTICULOUNIDAD/i.test(text) || (/ARTICULO/i.test(text) && /CANTIDAD/i.test(text));
        if (hasInventoryTable) {
            const productos = parseReporteInventario(text);
            if (productos.length > 0) {
                console.log(`✅ Parser estructurado: ${productos.length} productos.`);
                return { productos, balance: null, distribucion: null, tipo: 'inventario' };
            }
            console.warn('⚠️ Parser estructurado: 0 productos. Intentando IA...');
        }
        if (!apiKey) throw new Error('Formato no reconocido y no hay API Key de IA configurada.');
        const productosIA = await processPDFWithAI(text, apiKey);
        return { productos: productosIA, balance: null, distribucion: null, tipo: 'inventario_ia' };
    }

    // ── Detección automática (comportamiento original) ─────────────────────────
    const balance      = parseBalanceGeneral(text);
    const distribucion = parseDistribucionSaldo(text);

    const hasInventoryTable = /ARTICULOUNIDAD/i.test(text) || (/ARTICULO/i.test(text) && /CANTIDAD/i.test(text));
    const hasBalanceOnly    = /BALANCE GENERAL/i.test(text) || /DISTRIBUCION DE SALDO/i.test(text);

    if (hasInventoryTable) {
        const productos = parseReporteInventario(text);
        if (productos.length > 0) {
            console.log(`✅ Parser estructurado: ${productos.length} productos.`);
            return { productos, balance, distribucion, tipo: 'inventario' };
        }
        console.warn('⚠️ Parser estructurado: 0 productos. Intentando IA...');
    }

    if (hasBalanceOnly && !hasInventoryTable) {
        console.log('✅ Documento financiero (sin productos).');
        return { productos: [], balance, distribucion, tipo: 'balance' };
    }

    if (!apiKey) {
        if (balance || distribucion) return { productos: [], balance, distribucion, tipo: 'balance' };
        throw new Error('Formato de PDF no reconocido. No hay API Key de IA configurada.');
    }

    console.log('[PDF] Usando IA como fallback...');
    const productosIA = await processPDFWithAI(text, apiKey);
    return { productos: productosIA, balance, distribucion, tipo: 'inventario_ia' };
};

// ─── Entry point ──────────────────────────────────────────────────────────────

/**
 * @param {Buffer} fileBuffer
 * @param {string} fileName
 * @param {string|null} apiKey
 * @param {'auto'|'productos'|'balance'|'distribucion'} tipo
 */
const processFile = async (fileBuffer, fileName, apiKey = null, tipo = 'auto') => {
    const extension = fileName.split('.').pop().toLowerCase();
    if (extension === 'xlsx' || extension === 'xls') {
        // Excel always contains products
        const productos = processExcel(fileBuffer);
        return { productos, balance: null, distribucion: null, tipo: 'excel' };
    } else if (extension === 'pdf') {
        return processPDF(fileBuffer, apiKey, tipo);
    } else {
        throw new Error('Formato no soportado. Use PDF, XLSX o XLS.');
    }
};

module.exports = { processFile };
