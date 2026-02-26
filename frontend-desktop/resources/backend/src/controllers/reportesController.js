import PDFDocument from 'pdfkit'
import dbManager from '../config/database.js'
import logger from '../utils/logger.js'
import SesionInventario from '../models/SesionInventario.js'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

class ReportesController {
  obtenerEstadisticas = async (req, res) => {
    const { fechaInicio, fechaFin } = req.query
    try {
      const db = dbManager.getDatabase()
      let whereClause = "WHERE estado = 'completada'"
      let params = []
      if (fechaInicio) {
        whereClause += " AND fecha >= ?"
        params.push(fechaInicio)
      }
      if (fechaFin) {
        whereClause += " AND fecha <= ?"
        params.push(fechaFin)
      }

      const statsStmt = db.prepare(`
        SELECT 
          COUNT(*) as totalSesiones,
          SUM(CAST(json_extract(totales, '$.valorTotalInventario') AS REAL)) as valorTotalInventarios,
          SUM(CAST(json_extract(totales, '$.totalProductosContados') AS INTEGER)) as totalProductosContados
        FROM sesiones_inventario
        ${whereClause}
      `)

      const stats = statsStmt.get(...params)
      return res.status(200).json({
        exito: true,
        datos: {
          estadisticasGenerales: {
            totalSesiones: stats.totalSesiones || 0,
            valorTotalInventarios: stats.valorTotalInventarios || 0,
            totalProductosContados: stats.totalProductosContados || 0,
            valorPromedioInventario: (stats.totalSesiones || 0) > 0 ? stats.valorTotalInventarios / stats.totalSesiones : 0
          }
        }
      })
    } catch (error) {
      logger.error('Error estadísticas:', error)
      return res.status(500).json({ exito: false, mensaje: 'Error' })
    }
  }

  obtenerBalance = async (req, res) => {
    const { sesionId } = req.params
    try {
      const sesion = SesionInventario.buscarPorId(sesionId)
      return res.status(200).json({ exito: true, datos: sesion })
    } catch (error) {
      return res.status(500).json({ exito: false, mensaje: 'Error' })
    }
  }

  obtenerInventario = async (req, res) => {
    const { sesionId } = req.params
    try {
      const sesion = SesionInventario.buscarPorId(sesionId)
      return res.status(200).json({ exito: true, datos: sesion?.productosContados || [] })
    } catch (error) {
      return res.status(500).json({ exito: false, mensaje: 'Error' })
    }
  }

  /**
   * REPORTE UNIFICADO
   * POST /api/reportes/inventario/:sesionId/pdf
   */
  descargarInventarioPDF = async (req, res) => {
    const { sesionId } = req.params
    const options = req.body || {}

    try {
      const sesion = SesionInventario.buscarPorId(sesionId)
      if (!sesion) return res.status(404).json({ exito: false, mensaje: 'Sesión no encontrada' })

      // IMPORTANTE: autoFirstPage: false para controlar manualmente las páginas
      const doc = new PDFDocument({ margin: 40, size: 'LETTER', autoFirstPage: false })
      const filename = `Reporte_${sesion.numeroSesion}.pdf`

      res.setHeader('Content-disposition', `attachment; filename="${filename}"`)
      res.setHeader('Content-type', 'application/pdf')
      doc.pipe(res)

      const tealHeader = '#0f766e' // teal-700
      const blueAccent = '#1d4ed8' // blue-700
      const redAccent = '#b91c1c'  // red-700
      const darkText = '#111827'
      const grayText = '#4b5563'
      const lightGray = '#f3f4f6'
      const appTitle = 'TECH STOCK J4-PRO'

      // Path al logo
      const logoPath = path.join(__dirname, '..', '..', '..', 'frontend-desktop', 'src', 'img', 'logo_transparent.png')
      const hasLogo = fs.existsSync(logoPath)

      const isCompleto = options.tipoDocumento === 'completo'
      const isTotal = options.tipoDocumento === 'total' // Portada + Balance + Distribución
      const isProductos = options.tipoDocumento === 'productos'
      const hasPortada = isCompleto || isTotal || options.tipoDocumento === 'portada'

      // Verificar si hay datos financieros
      const f = sesion.datosFinancieros || {}
      const hasDatosBalance = f && Object.keys(f).length > 0
      const hasBalance = (isCompleto || isTotal || options.tipoDocumento === 'balance') && hasDatosBalance

      // Verificar si hay datos de distribución
      const d = options.distribucionData || {}
      const hasDatosDistribucion = d.socios && d.socios.length > 0
      const hasDistribucion = (isCompleto || isTotal || options.tipoDocumento === 'distribucion') && hasDatosDistribucion

      // Verificar si hay productos
      const prods = sesion.productosContados || []
      const hasProductos = prods.length > 0
      const hasProductosList = (isCompleto || options.tipoDocumento === 'productos') && hasProductos

      // --- PORTADA ---
      if (hasPortada) {
        doc.addPage()
        this._drawPortada(doc, sesion, options, tealHeader, darkText, grayText, hasLogo, logoPath)
      }

      // --- BALANCE GENERAL ---
      if (hasBalance) {
        doc.addPage()
        this._drawBalancePage(doc, sesion, options, tealHeader, blueAccent, redAccent, darkText, grayText, lightGray, appTitle)
      }

      // --- DISTRIBUCIÓN ---
      if (hasDistribucion) {
        doc.addPage()
        this._drawDistribucionPage(doc, sesion, options, tealHeader, blueAccent, darkText, grayText, lightGray)
      }

      // --- LISTADO PRODUCTOS ---
      if (hasProductosList) {
        const PER_PAGE = 28
        const totalPages = Math.ceil(prods.length / PER_PAGE) || 1

        for (let pIdx = 0; pIdx < totalPages; pIdx++) {
          doc.addPage()
          this._drawProductosPage(doc, sesion, options, tealHeader, darkText, grayText, lightGray, pIdx, PER_PAGE, totalPages)
        }
      }

      doc.end()
    } catch (error) {
      logger.error('Error unificado PDF:', error)
      return res.status(500).json({ exito: false, mensaje: 'Error al generar PDF' })
    }
  }

  /** HELPERS PARA DIBUJAR SECCIONES **/

  _drawPortada(doc, sesion, options, teal, dark, gray, hasLogo, logoPath) {
    // Estilo Portada Modal
    doc.fillColor(gray).fontSize(10).font('Helvetica').text('Inventario elaborado por:', 50, 60)
    doc.moveDown(0.2)
    doc.fillColor(dark).fontSize(20).font('Helvetica-Bold').text((options.contadorData?.nombre || 'ADMINISTRADOR').toUpperCase())

    doc.moveDown(4)
    doc.fillColor(dark).fontSize(36).font('Helvetica-Bold').text((sesion.nombreCliente || 'CLIENTE').toUpperCase(), { align: 'center' })

    if (hasLogo) {
      doc.moveDown(2)
      // Logo grande centrado
      doc.image(logoPath, (doc.page.width / 2) - 125, doc.y, { width: 250, align: 'center' })
      doc.moveDown(10)
    } else {
      doc.moveDown(12)
    }

    const coverFooterY = 650
    doc.moveTo(50, coverFooterY).lineTo(562, coverFooterY).stroke('#e5e7eb')

    doc.fontSize(11).font('Helvetica-Bold').fillColor(gray).text('Fecha Inventario', 50, coverFooterY + 15)
    doc.fontSize(14).font('Helvetica').fillColor(dark).text(new Date(sesion.fecha).toLocaleDateString(), 50, coverFooterY + 30)

    doc.fontSize(11).font('Helvetica-Bold').fillColor(gray).text('Costo del Servicio', 400, coverFooterY + 15, { align: 'right', width: 160 })
    doc.fontSize(16).font('Helvetica-Bold').fillColor(teal).text(`RD$ ${Number(options.contadorData?.costoServicio || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 400, coverFooterY + 30, { align: 'right', width: 160 })
  }

  _drawBalancePage(doc, sesion, options, teal, blue, red, dark, gray, light, app) {
    doc.rect(0, 0, 612, 12).fill(teal)
    doc.moveDown(2)

    doc.fillColor(dark).fontSize(20).font('Helvetica-Bold').text((sesion.nombreCliente || 'CLIENTE').toUpperCase(), { align: 'center' })
    doc.fillColor(teal).fontSize(13).font('Helvetica-Bold').text('Balance General', { align: 'center' })
    doc.fillColor(gray).fontSize(9).font('Helvetica').text(`Al ${new Date(sesion.fecha).toLocaleDateString()}`, { align: 'center' })
    doc.fontSize(8).text('(En RD $)', { align: 'center' })

    doc.moveDown(1.5)
    doc.moveTo(40, doc.y).lineTo(572, doc.y).stroke('#e5e7eb')
    doc.moveDown(1)

    const f = sesion.datosFinancieros || {}
    const t = sesion.totales || {}
    const col1X = 40
    const col2X = 315
    const colW = 250

    const getVal = (key) => {
      if (Array.isArray(f[key]) && f[key].length > 0) {
        return f[key].reduce((sum, item) => sum + (Number(item.monto) || 0), 0)
      }
      const detalle = f[key + 'Detalle']
      if (Array.isArray(detalle) && detalle.length > 0) {
        return detalle.reduce((sum, item) => sum + (Number(item.monto) || 0), 0)
      }
      return Number(f[key]) || 0
    }

    const getItems = (key) => {
      if (Array.isArray(f[key]) && f[key].length > 0) {
        return f[key]
      }
      const detalle = f[key + 'Detalle']
      if (Array.isArray(detalle) && detalle.length > 0) {
        return detalle
      }
      return null
    }

    const drawRow = (label, value, x, bold = false, fontSize = 9.5, color = dark) => {
      const curY = doc.y
      const fw = colW - 10
      doc.fillColor(color).font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize)
        .text(label, x + 5, curY, { width: fw - 70 })
      doc.fillColor(color).font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize)
        .text(`RD$ ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, x + 5, curY, { align: 'right', width: fw })
      doc.moveDown(0.6)
    }

    const drawDetails = (key, x) => {
      const items = getItems(key)
      if (!items || items.length === 0) return

      const fw = colW - 10
      doc.fillColor(gray).font('Helvetica-Oblique').fontSize(8)
      items.forEach(item => {
        const curY = doc.y
        if (curY > 500) return
        doc.text(`  • ${item.nombre || item.deudor || 'Item'}`, x + 12, curY, { width: fw - 80 })
        doc.text(`RD$ ${Number(item.monto || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, x + 12, curY, { align: 'right', width: fw - 10 })
        doc.moveDown(0.35)
      })
      doc.moveDown(0.2)
    }

    const startY = doc.y
    doc.fillColor(blue).font('Helvetica-Bold').fontSize(11).text('ACTIVOS', col1X, startY)
    doc.moveTo(col1X, doc.y + 2).lineTo(col1X + colW, doc.y + 2).stroke(blue)
    doc.moveDown(0.6)

    doc.fillColor(dark).font('Helvetica-Bold').fontSize(10).text('CORRIENTES', col1X + 5)
    doc.moveDown(0.4)

    const efectivo = getVal('efectivoEnCajaYBanco')
    drawRow('EFECTIVO Y CAJA', efectivo, col1X)
    drawDetails('efectivoEnCajaYBanco', col1X)

    const cobrables = getVal('cuentasPorCobrar')
    drawRow('CUENTAS POR COBRAR', cobrables, col1X)
    drawDetails('cuentasPorCobrar', col1X)

    const inventario = Number(t.valorTotalInventario) || 0
    drawRow('INVENTARIO DE MERCANCIA', inventario, col1X)
    doc.moveDown(0.2)

    const deudaNeg = getVal('deudaANegocio')
    drawRow('DEUDA A NEGOCIO', deudaNeg, col1X)
    drawDetails('deudaANegocio', col1X)

    const tcY = doc.y
    doc.rect(col1X, tcY - 2, colW, 14).fill(light)
    doc.fillColor(dark)
    drawRow('TOTAL CORRIENTES', efectivo + cobrables + inventario + deudaNeg, col1X, true)

    doc.moveDown(0.5)
    doc.fillColor(dark).font('Helvetica-Bold').fontSize(10).text('FIJOS', col1X + 5)
    doc.moveDown(0.4)
    const activosFij = Number(f.activosFijos) || 0
    drawRow('ACTIVOS FIJOS', activosFij, col1X)

    const tfY = doc.y
    doc.rect(col1X, tfY - 2, colW, 14).fill(light)
    doc.fillColor(dark)
    drawRow('TOTAL FIJOS', activosFij, col1X, true)

    const totalActivos = efectivo + cobrables + inventario + deudaNeg + activosFij

    doc.moveDown(0.8)
    doc.moveTo(col1X, doc.y).lineTo(col1X + colW, doc.y).stroke(dark, 1.5)
    doc.moveDown(0.3)
    drawRow('TOTAL ACTIVOS', totalActivos, col1X, true, 10)

    const col1EndY = doc.y

    doc.y = startY
    doc.fillColor(red).font('Helvetica-Bold').fontSize(11).text('PASIVOS Y CAPITAL', col2X, startY)
    doc.moveTo(col2X, doc.y + 2).lineTo(col2X + colW, doc.y + 2).stroke(red)
    doc.moveDown(0.6)

    doc.fillColor(dark).font('Helvetica-Bold').fontSize(10).text('PASIVOS', col2X + 5)
    doc.moveDown(0.4)
    const pasivosTot = getVal('cuentasPorPagar')
    drawRow('CUENTAS POR PAGAR', pasivosTot, col2X)
    drawDetails('cuentasPorPagar', col2X)

    const tpY = doc.y
    doc.rect(col2X, tpY - 2, colW, 14).fill(light)
    doc.fillColor(dark)
    drawRow('TOTAL PASIVOS', pasivosTot, col2X, true)

    doc.moveDown(0.5)
    doc.fillColor(dark).font('Helvetica-Bold').fontSize(10).text('CAPITAL', col2X + 5)
    doc.moveDown(0.4)
    const capAnt = Number(f.capitalAnterior) || 0
    const utiNeta = (totalActivos - pasivosTot) - capAnt
    drawRow('CAPITAL ANTERIOR', capAnt, col2X)

    if (f.capitalAnteriorDescripcion) {
      doc.fillColor(gray).font('Helvetica-Oblique').fontSize(7.5)
        .text(`(${f.capitalAnteriorDescripcion})`, col2X + 15, doc.y - 6)
      doc.moveDown(0.3)
    }

    drawRow('UTILIDAD DEL EJERCICIO', utiNeta, col2X, false, 9.5, blue)
    doc.moveDown(0.2)
    drawRow('TOTAL CAPITAL', totalActivos - pasivosTot, col2X, true)

    doc.moveDown(0.8)
    doc.moveTo(col2X, doc.y).lineTo(col2X + colW, doc.y).stroke(dark, 1.5)
    doc.moveDown(0.3)
    drawRow('TOTAL PASIVOS + CAPITAL', totalActivos, col2X, true, 10)

    const afterBothCols = Math.max(col1EndY, doc.y) + 10
    doc.y = afterBothCols

    const ventas = Number(f.ventasDelMes) || 0
    const gastosGenVal = getVal('gastosGenerales')
    const bruta = utiNeta + gastosGenVal
    const cogs = ventas - bruta
    const pNeto = ventas > 0 ? (utiNeta / ventas) * 100 : 0
    const pBruto = ventas > 0 ? (bruta / ventas) * 100 : 0

    const boxX = 40
    const boxW = 532
    const boxY = doc.y

    doc.rect(boxX, boxY, boxW, 90).fill('#f0f9ff')
    doc.rect(boxX, boxY, boxW, 90).stroke('#bae6fd')

    doc.fillColor(blue).font('Helvetica-Bold').fontSize(11)
      .text('VENTAS Y GASTOS', boxX + 15, boxY + 10)

    const bCol1 = boxX + 20
    const bCol2 = boxX + 300
    const bColW = 220

    doc.fillColor(dark).font('Helvetica').fontSize(10)

    let bY = boxY + 30
    doc.fillColor('#16a34a').font('Helvetica-Bold').fontSize(10)
    doc.text('VENTAS DEL MES', bCol1, bY)
    doc.text(`RD$ ${Number(ventas).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, bCol1, bY, { align: 'right', width: bColW })

    bY += 16
    doc.fillColor(dark).font('Helvetica').fontSize(9.5)
    doc.text('COSTO MERCANCÍA', bCol1, bY)
    doc.text(`(RD$ ${Number(cogs).toLocaleString(undefined, { minimumFractionDigits: 2 })})`, bCol1, bY, { align: 'right', width: bColW })

    bY += 16
    doc.fillColor(blue).font('Helvetica-Bold').fontSize(10)
    doc.text('UTILIDAD BRUTA', bCol1, bY)
    doc.text(`RD$ ${Number(bruta).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, bCol1, bY, { align: 'right', width: bColW })

    bY = boxY + 30
    doc.fillColor(dark).font('Helvetica').fontSize(9.5)
    doc.text('GASTOS GENERALES', bCol2, bY)
    doc.text(`(RD$ ${Number(gastosGenVal).toLocaleString(undefined, { minimumFractionDigits: 2 })})`, bCol2, bY, { align: 'right', width: bColW })

    bY += 16
    doc.moveTo(bCol2, bY).lineTo(bCol2 + bColW, bY).stroke('#93c5fd')
    bY += 5
    doc.fillColor(dark).font('Helvetica-Bold').fontSize(10)
    doc.text('UTILIDAD NETA', bCol2, bY)
    doc.text(`RD$ ${Number(utiNeta).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, bCol2, bY, { align: 'right', width: bColW })

    bY += 18
    doc.fillColor(gray).font('Helvetica').fontSize(8.5)
    doc.text(`% BRUTO: ${pBruto.toFixed(2)}%  |  % NETO: ${pNeto.toFixed(2)}%`, bCol2, bY, { width: bColW })

    doc.y = boxY + 95
    doc.fillColor(gray).fontSize(9).font('Helvetica-Bold')
      .text(`Contador: ${options.contadorData?.nombre || 'ADMINISTRADOR'}`, { align: 'center' })

    if (options.contadorData?.telefono) {
      doc.fontSize(8).font('Helvetica').text(`Teléfono: ${options.contadorData.telefono}`, { align: 'center' })
    }

    // Disclaimer separado del pie de página global
    doc.fontSize(9).fillColor('#6b7280').font('Helvetica-Oblique').text(
      'Solo somos responsables de los datos introducidos en el inventario de mercancía. Los resultados del balance del negocio son responsabilidad del propietario del negocio.',
      40, 705, { align: 'center', width: 532 }
    )
  }

  _drawDistribucionPage(doc, sesion, options, teal, blue, dark, gray, light) {
    doc.rect(0, 0, 612, 12).fill(teal)
    doc.moveDown(2)

    doc.fillColor(dark).fontSize(20).font('Helvetica-Bold').text((sesion.nombreCliente || 'CLIENTE').toUpperCase(), { align: 'center' })
    doc.fillColor(teal).fontSize(13).font('Helvetica-Bold').text('Distribución de Saldo', { align: 'center' })
    doc.fillColor(gray).fontSize(9).font('Helvetica').text(`Al ${new Date(sesion.fecha).toLocaleDateString()}`, { align: 'center' })
    doc.fontSize(8).text('(En RD $)', { align: 'center' })

    doc.moveDown(1.5)
    const d = options.distribucionData || {}
    const socios = d.socios || []

    const resumenY = doc.y
    doc.rect(40, resumenY, 532, 30).fill(light)
    doc.fillColor(dark).font('Helvetica-Bold').fontSize(9)
    doc.text('Total de Utilidades Netas:', 55, resumenY + 10)
    doc.text(`RD$ ${Number(d.utilidadesNetas || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 180, resumenY + 10)
    doc.text('Número de Socios:', 380, resumenY + 10)
    doc.text(`${socios.length || 0}`, 490, resumenY + 10)
    doc.y = resumenY + 40

    doc.fillColor(dark).font('Helvetica-Bold').fontSize(10).text('Distribución por Socios')
    doc.moveDown(0.4)

    const colX = [40, 120, 210, 300, 400, 500]
    const colW = [75, 80, 80, 90, 90, 90]

    const tableHeaderY = doc.y
    doc.rect(40, tableHeaderY, 532, 20).fill(light)
    doc.fillColor(gray).font('Helvetica-Bold').fontSize(8)
    doc.text('SOCIO', colX[0] + 3, tableHeaderY + 6)
    doc.text('PORCENTAJE', colX[1], tableHeaderY + 6, { align: 'center', width: colW[1] })
    doc.text('UTIL. PERIODO', colX[2], tableHeaderY + 6, { align: 'right', width: colW[2] })
    doc.text('UTIL. ACUM.', colX[3], tableHeaderY + 6, { align: 'right', width: colW[3] })
    doc.text('CTA ADEUDADA', colX[4], tableHeaderY + 6, { align: 'right', width: colW[4] })
    doc.text('SALDO NETO', colX[5], tableHeaderY + 6, { align: 'right', width: colW[5] })
    doc.y = tableHeaderY + 22

    let rowY = doc.y
    socios.forEach((s) => {
      const utilidadSocio = (d.utilidadesNetas * (s.porcentaje / 100)) || 0
      const deuda = Number(s.cuentaAdeudada || s.deuda || 0)
      const saldo = utilidadSocio - deuda

      doc.fillColor(dark).font('Helvetica-Bold').fontSize(8.5).text(s.nombre || 'Socio', colX[0] + 3, rowY)
      doc.fillColor(gray).font('Helvetica').fontSize(8.5).text(`${Number(s.porcentaje).toFixed(2)}%`, colX[1], rowY, { align: 'center', width: colW[1] })
      doc.fillColor(dark).font('Helvetica').fontSize(8.5).text(Number(utilidadSocio).toLocaleString(undefined, { minimumFractionDigits: 2 }), colX[2], rowY, { align: 'right', width: colW[2] })
      doc.text(Number(utilidadSocio).toLocaleString(undefined, { minimumFractionDigits: 2 }), colX[3], rowY, { align: 'right', width: colW[3] })
      doc.fillColor(blue).text(Number(deuda).toLocaleString(undefined, { minimumFractionDigits: 2 }), colX[4], rowY, { align: 'right', width: colW[4] })
      doc.fillColor(saldo >= 0 ? '#16a34a' : blue).text(Number(saldo).toLocaleString(undefined, { minimumFractionDigits: 2 }), colX[5], rowY, { align: 'right', width: colW[5] })

      doc.moveTo(40, rowY + 12).lineTo(572, rowY + 12).stroke('#f3f4f6')
      rowY += 14
    })

    const totalDeuda = socios.reduce((sum, s) => sum + Number(s.cuentaAdeudada || s.deuda || 0), 0)
    const totalSaldoNeto = (d.utilidadesNetas || 0) - totalDeuda

    const totalRowY = rowY + 2
    doc.rect(40, totalRowY, 532, 18).fill('#e5e7eb')
    doc.fillColor(dark).font('Helvetica-Bold').fontSize(8.5)
    doc.text('TOTAL', colX[0] + 3, totalRowY + 5)
    doc.text('100.00%', colX[1], totalRowY + 5, { align: 'center', width: colW[1] })
    doc.text(Number(d.utilidadesNetas || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }), colX[2], totalRowY + 5, { align: 'right', width: colW[2] })
    doc.text(Number(d.utilidadesNetas || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }), colX[3], totalRowY + 5, { align: 'right', width: colW[3] })
    doc.fillColor('#b91c1c').text(Number(totalDeuda).toLocaleString(undefined, { minimumFractionDigits: 2 }), colX[4], totalRowY + 5, { align: 'right', width: colW[4] })
    doc.fillColor(totalSaldoNeto >= 0 ? '#16a34a' : '#b91c1c').text(Number(totalSaldoNeto).toLocaleString(undefined, { minimumFractionDigits: 2 }), colX[5], totalRowY + 5, { align: 'right', width: colW[5] })

    doc.y = totalRowY + 35

    doc.moveDown(4)
    doc.fillColor(dark).font('Helvetica-Bold').fontSize(10).text('Firmas', 40, doc.y)
    doc.moveDown(3)

    const sigLineY = doc.y
    const sigColWidth = 140
    socios.slice(0, 4).forEach((s, i) => {
      const row = Math.floor(i / 2)
      const col = i % 2
      const sx = col === 0 ? 80 : 360
      const sy = sigLineY + row * 55
      doc.moveTo(sx, sy).lineTo(sx + sigColWidth, sy).stroke(gray)
      doc.fontSize(8.5).fillColor(gray).font('Helvetica')
      doc.text(s.nombre || `Socio ${i + 1}`, sx, sy + 5, { align: 'center', width: sigColWidth })
      doc.text('Firma y Cédula', sx, sy + 16, { align: 'center', width: sigColWidth })
    })
  }

  _drawProductosPage(doc, sesion, options, teal, dark, gray, light, pIdx, perPage, totalPages) {
    const prods = sesion.productosContados || []

    doc.rect(0, 0, 612, 12).fill(teal)
    doc.moveDown(0.4)

    doc.fillColor(dark).fontSize(18).font('Helvetica-Bold').text('Listado de Productos', { align: 'center' })
    doc.fillColor(gray).fontSize(9).font('Helvetica').text(`${sesion.nombreCliente || 'CLIENTE'} - ${new Date(sesion.fecha).toLocaleDateString()}`, { align: 'center' })

    doc.moveDown(1.5)

    const tableTop = doc.y
    doc.rect(40, tableTop, 532, 20).fill(light)
    doc.fillColor(gray).font('Helvetica-Bold').fontSize(8.5)
    doc.text('Producto', 50, tableTop + 6)
    doc.text('Cant.', 300, tableTop + 6, { align: 'center', width: 60 })
    doc.text('Costo', 380, tableTop + 6, { align: 'right', width: 80 })
    doc.text('Total', 480, tableTop + 6, { align: 'right', width: 85 })

    let curY = tableTop + 25
    const pageItems = prods.slice(pIdx * perPage, (pIdx + 1) * perPage)
    let pageTotal = 0

    pageItems.forEach((item) => {
      const itemTotal = item.valorTotal || (item.cantidadContada * (item.costoProducto || 0))
      pageTotal += itemTotal

      doc.fillColor(dark).font('Helvetica').fontSize(8.5)
      doc.text(item.nombreProducto || 'N/A', 50, curY, { width: 240, height: 12, truncate: true })

      const valCant = Number(item.cantidadContada).toFixed(2)
      doc.fillColor(gray).rect(300, curY - 2, 60, 12).fill('#f9fafb')
      doc.fillColor(dark).text(valCant, 300, curY, { align: 'center', width: 60 })

      doc.fillColor(dark).text(Number(item.costoProducto).toFixed(2), 380, curY, { align: 'right', width: 80 })
      doc.font('Helvetica-Bold').text(Number(itemTotal).toLocaleString(undefined, { minimumFractionDigits: 2 }), 480, curY, { align: 'right', width: 85 })

      doc.moveTo(40, curY + 10).lineTo(572, curY + 10).stroke('#f9fafb')
      curY += 12
    })

    const footerY = Math.min(curY + 20, 680)
    doc.moveTo(40, footerY).lineTo(572, footerY).stroke(dark, 1.5)

    doc.fontSize(8).fillColor(gray).font('Helvetica')
    doc.text(`Usuario: ${sesion?.usuario?.nombre || 'ADMINISTRADOR'}`, 50, footerY + 5)
    doc.text(`Teléfono: ${sesion?.usuario?.telefono || '1234567890'}`, 50, footerY + 15)

    doc.fillColor(dark).fontSize(8.5)
    doc.text(`Líneas ${(pIdx * perPage) + 1} a ${(pIdx * perPage) + pageItems.length}`, 390, footerY + 5, { align: 'right', width: 175 })

    doc.font('Helvetica-Bold')
    doc.text(`Total Pág: RD$ ${Number(pageTotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 390, footerY + 15, { align: 'right', width: 175 })
    doc.text(`Total Reporte: RD$ ${Number(sesion.totales?.valorTotalInventario || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 390, footerY + 25, { align: 'right', width: 175 })

    doc.fontSize(8).fillColor(gray).font('Helvetica')
    doc.text(`Pág. ${pIdx + 1} de ${totalPages}`, 390, footerY + 35, { align: 'right', width: 175 })
  }

  descargarBalancePDF = async (req, res) => {
    // Reutiliza la lógica o llama a descargarInventarioPDF con tipoDocumento: 'balance'
    req.body = { tipoDocumento: 'balance' }
    return this.descargarInventarioPDF(req, res)
  }
}

export default new ReportesController()
