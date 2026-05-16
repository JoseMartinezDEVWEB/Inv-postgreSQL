import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs/promises'
import { existsSync, readFileSync } from 'fs'
import XLSX from 'xlsx'
import { PDFParse } from 'pdf-parse'
import dbManager from '../config/database.js'
import { respuestaExito } from '../utils/helpers.js'
import { AppError } from '../middlewares/errorHandler.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ─── helpers ────────────────────────────────────────────────────────────────

function limpiarTexto(valor) {
  if (valor === null || valor === undefined) return ''
  return String(valor).trim()
}

function parsearNumero(valor) {
  if (valor === null || valor === undefined || valor === '') return 0
  if (typeof valor === 'number') return isNaN(valor) ? 0 : valor
  const s = String(valor).replace(/[$€RD,\s]/g, '').replace(/[^0-9.-]/g, '')
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

const HEADERS_IGNORAR = new Set([
  'nombre','descripcion','articulo','producto','item','cantidad',
  'costo','precio','total','codigo','barcode','subtotal','sku',
  'unidad','categoria','ref','referencia','0',
])

// ─── EXCEL ───────────────────────────────────────────────────────────────────

const COL_MAPS = {
  nombre:   ['articulo', 'artículo', 'nombre', 'producto', 'descripcion', 'descripción', 'item', 'description'],
  cantidad: ['cantidad', 'cant', 'qty', 'unidades', 'stock', 'existencia'],
  costo:    ['costo', 'precio', 'pvp', 'cost'],
  total:    ['total', 'importe', 'monto'],
  categoria:['categoria', 'categoría', 'grupo', 'familia', 'departamento', 'category'],
  codigo:   ['sku', 'codigo', 'código', 'barcode', 'ref', 'referencia', 'cod', 'code'],
}

function identificarColumna(columnas, campo) {
  for (const posible of COL_MAPS[campo]) {
    const col = columnas.find(c => c.toLowerCase().trim().includes(posible))
    if (col) return col
  }
  return null
}

function procesarExcel(rutaArchivo) {
  const workbook = XLSX.readFile(rutaArchivo, { type: 'file', cellDates: true })
  const todosProductos = []

  for (const nombreHoja of workbook.SheetNames) {
    const hoja = workbook.Sheets[nombreHoja]
    const filas = XLSX.utils.sheet_to_json(hoja, { defval: null, raw: false })
    if (!filas || filas.length === 0) continue

    const columnas = Object.keys(filas[0])
    const colNombre   = identificarColumna(columnas, 'nombre')   || columnas[0]
    const colCantidad = identificarColumna(columnas, 'cantidad')
    const colCosto    = identificarColumna(columnas, 'costo')
    const colTotal    = identificarColumna(columnas, 'total')
    const colCategoria= identificarColumna(columnas, 'categoria')
    const colCodigo   = identificarColumna(columnas, 'codigo')

    for (const fila of filas) {
      const nombre = limpiarTexto(fila[colNombre])
      if (!nombre || nombre.length < 2) continue
      if (HEADERS_IGNORAR.has(nombre.toLowerCase())) continue

      let cantidad = 1
      if (colCantidad) {
        const v = parsearNumero(fila[colCantidad])
        if (v > 0 && v <= 100000) cantidad = Math.round(v)
      }

      let costo = 0
      if (colCosto) costo = parsearNumero(fila[colCosto])

      if (costo === 0 && colTotal) {
        const total = parsearNumero(fila[colTotal])
        if (total > 0 && cantidad > 0) costo = total / cantidad
      }

      if (costo === 0) {
        for (const col of columnas) {
          if (col === colNombre || col === colCantidad || col === colTotal) continue
          const v = parsearNumero(fila[col])
          if (v > 0 && v < 1_000_000) { costo = v; break }
        }
      }

      let codigoBarras = null
      if (colCodigo) {
        const raw = limpiarTexto(fila[colCodigo])
        if (raw && raw !== '0' && raw.length > 1 && !['nan','none','null',''].includes(raw.toLowerCase())) {
          codigoBarras = raw
        }
      }

      let categoria = 'General'
      if (colCategoria) {
        const cat = limpiarTexto(fila[colCategoria])
        if (cat && cat.length > 1 && !HEADERS_IGNORAR.has(cat.toLowerCase())) categoria = cat
      }

      todosProductos.push({ nombre, codigoBarras, cantidad, costoBase: costo, categoria, unidad: 'unidad' })
    }
  }

  return todosProductos
}

// ─── PDF ─────────────────────────────────────────────────────────────────────

const RE_INVENTARIO = /^(.+?)\s+(\d+[.,]?\d*)\s+(\d+[.,]?\d*)\s+RD\$?\s*([\d\s,.]+)\s*$/i
const UNIDADES_SUFIJO = new Set(['UDS','PAQ','LIB','UNI','UND','UNIDAD','UNIDADES','UNID'])

function parsearLineasInventario(lineas) {
  const productos = []
  for (const linea of lineas) {
    const l = linea.trim()
    if (!l || l.length < 10) continue
    const m = RE_INVENTARIO.exec(l)
    if (!m) continue
    const cantidad = parsearNumero(m[2])
    const costo    = parsearNumero(m[3])
    if (costo < 0 || costo >= 1_000_000) continue
    const partes = m[1].trim().split(/\s+/)
    while (partes.length > 0 && UNIDADES_SUFIJO.has(partes[partes.length - 1].toUpperCase())) partes.pop()
    const nombre = partes.join(' ').trim()
    if (!nombre || nombre.length < 2 || HEADERS_IGNORAR.has(nombre.toLowerCase())) continue
    productos.push({ nombre, codigoBarras: null, cantidad: Math.max(1, Math.round(cantidad)), costoBase: costo, categoria: 'General', unidad: 'unidad' })
  }
  return productos
}

function parsearTextoPDF(texto) {
  const lineas = texto.split('\n')
  const productos = []
  const nombresVistos = new Set()

  const desdeReporte = parsearLineasInventario(lineas)
  for (const p of desdeReporte) {
    const clave = p.nombre.toLowerCase()
    if (!nombresVistos.has(clave)) { nombresVistos.add(clave); productos.push(p) }
  }
  if (productos.length > 0) return productos

  for (const linea of lineas) {
    const l = linea.trim()
    if (!l || l.length < 5 || HEADERS_IGNORAR.has(l.toLowerCase())) continue
    const numeros = [...l.matchAll(/(\d+[.,]?\d*)/g)].map(m => parsearNumero(m[1])).filter(n => n > 0)
    if (numeros.length === 0) continue
    const primerNumPos = l.search(/\d/)
    let nombre = primerNumPos > 5 ? l.substring(0, primerNumPos).replace(/[:|–\-\s]+$/, '').trim() : ''
    if (!nombre || nombre.length < 3 || HEADERS_IGNORAR.has(nombre.toLowerCase())) continue
    const clave = nombre.toLowerCase()
    if (nombresVistos.has(clave)) continue
    nombresVistos.add(clave)
    const cantidad = numeros.length >= 2 && numeros[0] <= 100000 ? Math.round(numeros[0]) : 1
    const costo    = numeros.length >= 2 ? numeros[1] : numeros[0]
    productos.push({ nombre, codigoBarras: null, cantidad, costoBase: costo < 1_000_000 ? costo : 0, categoria: 'General', unidad: 'unidad' })
  }
  return productos
}

async function procesarPDF(rutaArchivo) {
  const buffer = readFileSync(rutaArchivo)
  const parser = new PDFParse({ data: buffer, verbosity: 0 })
  const data = await parser.getText()
  const texto = data.text || ''
  if (!texto || texto.trim().length < 10) {
    return { error: 'No se pudo extraer texto del PDF. El archivo podría estar escaneado o protegido.' }
  }
  const productos = parsearTextoPDF(texto)
  if (productos.length === 0) {
    return { error: 'No se encontraron productos en el PDF. Verifica que el archivo tenga un listado de productos con nombres y valores.' }
  }
  return productos
}

// ─── Bulk DB insert con transacción única ────────────────────────────────────

function insertarEnBulk(productosRaw, usuarioId) {
  const db = dbManager.getDatabase()

  // 1 sola query para cargar TODOS los existentes en memoria
  const existentes = db.prepare(
    'SELECT id, nombre, codigoBarras FROM productos_generales WHERE activo = 1'
  ).all()

  const porCodigo = new Map()
  const porNombre = new Map()
  for (const p of existentes) {
    if (p.codigoBarras && p.codigoBarras !== '0') porCodigo.set(p.codigoBarras.toLowerCase(), p.id)
    porNombre.set(p.nombre.toLowerCase().trim(), p.id)
  }

  // Clasificar
  const aCrear      = []
  const aActualizar = []
  const clavesProcesadas = new Set()

  for (const prod of productosRaw) {
    const nombre = limpiarTexto(prod.nombre)
    if (!nombre || nombre.length < 2) continue
    if (HEADERS_IGNORAR.has(nombre.toLowerCase())) continue

    const clave = nombre.toLowerCase().trim()
    if (clavesProcesadas.has(clave)) continue
    clavesProcesadas.add(clave)

    const codBarras = prod.codigoBarras ? String(prod.codigoBarras).trim() : null
    const validCod  = codBarras && codBarras !== '0' && codBarras.length > 1 ? codBarras : null
    const costoBase = parsearNumero(prod.costoBase ?? prod.precio ?? 0)
    const categoria = prod.categoria || 'General'
    const unidad    = prod.unidad    || 'unidad'

    const existeId = (validCod && porCodigo.get(validCod.toLowerCase())) || porNombre.get(clave)

    if (existeId) {
      aActualizar.push({ id: existeId, costoBase, categoria })
    } else {
      aCrear.push({ nombre, codigoBarras: validCod, costoBase, categoria, unidad })
    }
  }

  // 1 transacción para todo
  const stmtIns = db.prepare(`
    INSERT INTO productos_generales
      (nombre, codigoBarras, costoBase, categoria, unidad, creadoPorId, tipoCreacion,
       activo, unidadesInternas, estadisticas, tipoContenedor, tieneUnidadesInternas, tipoPeso, esProductoSecundario)
    VALUES (?, ?, ?, ?, ?, ?, 'importacion', 1, '{}', '{}', 'ninguno', 0, 'ninguno', 0)
  `)
  const stmtUpd = db.prepare(
    'UPDATE productos_generales SET costoBase = ?, categoria = ? WHERE id = ?'
  )

  db.transaction(() => {
    for (const p of aCrear)     stmtIns.run(p.nombre, p.codigoBarras, p.costoBase, p.categoria, p.unidad, usuarioId)
    for (const p of aActualizar) stmtUpd.run(p.costoBase, p.categoria, p.id)
  })()

  // Muestra para preview (máx 200)
  const muestra = [
    ...aCrear.slice(0, 200).map(p => ({ ...p, accion: 'creado' })),
    ...aActualizar.slice(0, Math.max(0, 200 - aCrear.length)).map(p => ({ ...p, accion: 'actualizado' })),
  ]

  return {
    totalProcesados  : productosRaw.length,
    totalCreados     : aCrear.length,
    totalActualizados: aActualizar.length,
    totalErrores     : 0,
    productos        : muestra,
  }
}

// ─── Controller ──────────────────────────────────────────────────────────────

export const importarProductosDesdeArchivo = async (req, res) => {
  let archivoPath = null
  try {
    if (!req.file) {
      return res.status(400).json({
        exito: false,
        mensaje: 'No se recibió ningún archivo. Envíe el archivo en el campo "archivo" con formato multipart/form-data.',
      })
    }

    archivoPath = req.file.path
    const extension = path.extname(req.file.originalname).toLowerCase().slice(1)

    if (!['xlsx', 'xls', 'pdf'].includes(extension)) {
      throw new AppError('Formato no soportado. Use XLSX, XLS o PDF', 400)
    }

    // ── Parsear archivo ──────────────────────────────────────────────────────
    let productosRaw = []

    if (['xlsx', 'xls'].includes(extension)) {
      productosRaw = procesarExcel(archivoPath)
    } else {
      const resultado = await procesarPDF(archivoPath)
      if (resultado && resultado.error) {
        return res.status(400).json({ exito: false, mensaje: resultado.error })
      }
      productosRaw = Array.isArray(resultado) ? resultado : (resultado.productos || [])
    }

    // Limpiar archivo temporal
    try { await fs.unlink(archivoPath) } catch (_) { /* ignorar */ }
    archivoPath = null

    if (!productosRaw || productosRaw.length === 0) {
      return res.status(400).json({
        exito: false,
        mensaje: 'No se encontraron productos válidos en el archivo. Verifica que tenga columnas de nombre/producto y datos en las filas.',
      })
    }

    // ── Insertar en bulk ────────────────────────────────────────────────────
    const usuarioId = req.usuario?.id || null
    const resultado = insertarEnBulk(productosRaw, usuarioId)

    res.json(respuestaExito(
      resultado,
      `Importación completada: ${resultado.totalCreados} creados, ${resultado.totalActualizados} actualizados de ${resultado.totalProcesados} procesados`,
    ))

  } catch (error) {
    if (archivoPath && existsSync(archivoPath)) {
      try { await fs.unlink(archivoPath) } catch (_) { /* ignorar */ }
    }
    if (error instanceof AppError) throw error
    console.error('Error en importarProductosDesdeArchivo:', error)
    throw new AppError(`Error al importar: ${error.message}`, 500)
  }
}

export default { importarProductosDesdeArchivo }
