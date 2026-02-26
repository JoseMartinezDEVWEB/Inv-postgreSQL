import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'

const { width, height } = Dimensions.get('window')

const InventoryReportModal = ({ visible, onClose, sesionData, productosContados, datosFinancieros, contadorData, user }) => {
  const [currentSection, setCurrentSection] = useState('portada') // 'portada', 'productos', 'distribucion', 'balance'
  const [currentPage, setCurrentPage] = useState(0) // Para paginación dentro de productos
  const [showMenu, setShowMenu] = useState(false)

  // Resetear a portada cuando se abre el modal
  useEffect(() => {
    if (visible) {
      setCurrentSection('portada')
      setCurrentPage(0)
      setShowMenu(false)
    }
  }, [visible])
  
  // Calcular total de páginas dinámicamente (44 en la primera, 51 en las siguientes)
  const getTotalPages = () => {
    const validProductos = Array.isArray(productosContados) ? productosContados : []
    const total = validProductos.length
    let paginasProductos = 0
    if (total > 0) {
      const primera = Math.min(44, total)
      paginasProductos = 1 + Math.ceil(Math.max(0, total - primera) / 51)
    }
    return 1 + paginasProductos + 2 // 1 portada + páginas de productos + 2 (balance + distribución)
  }
  
  const totalPages = getTotalPages()

  // Procesar datos financieros para manejar arrays y valores únicos
  const processFinancialData = () => {
    const gastosArray = Array.isArray(datosFinancieros?.gastosGenerales) 
      ? datosFinancieros.gastosGenerales 
      : (datosFinancieros?.gastosGenerales ? [{ monto: datosFinancieros.gastosGenerales, descripcion: 'Gastos generales' }] : []);
    
    const cuentasPorCobrarArray = Array.isArray(datosFinancieros?.cuentasPorCobrar) 
      ? datosFinancieros.cuentasPorCobrar 
      : (datosFinancieros?.cuentasPorCobrar ? [{ monto: datosFinancieros.cuentasPorCobrar, descripcion: 'Cuenta por cobrar' }] : []);
    
    const efectivoArray = Array.isArray(datosFinancieros?.efectivoEnCajaYBanco) 
      ? datosFinancieros.efectivoEnCajaYBanco 
      : (datosFinancieros?.efectivoEnCajaYBanco ? [{ monto: datosFinancieros.efectivoEnCajaYBanco, descripcion: 'Efectivo en caja' }] : []);

    const cuentasPorPagarArray = Array.isArray(datosFinancieros?.cuentasPorPagar) 
      ? datosFinancieros.cuentasPorPagar 
      : (datosFinancieros?.cuentasPorPagar ? [{ monto: datosFinancieros.cuentasPorPagar, descripcion: 'Cuenta por pagar' }] : []);

    const deudaANegocioArray = Array.isArray(datosFinancieros?.deudaANegocio) 
      ? datosFinancieros.deudaANegocio 
      : (datosFinancieros?.deudaANegocio ? [{ monto: datosFinancieros.deudaANegocio, descripcion: 'Deuda a negocio' }] : []);

    return {
      ventasDelMes: parseFloat(datosFinancieros?.ventasDelMes) || 0,
      gastosGenerales: gastosArray,
      gastosGeneralesTotal: gastosArray.reduce((sum, gasto) => sum + (parseFloat(gasto.monto) || 0), 0),
      cuentasPorCobrar: cuentasPorCobrarArray,
      cuentasPorCobrarTotal: cuentasPorCobrarArray.reduce((sum, cuenta) => sum + (parseFloat(cuenta.monto) || 0), 0),
      cuentasPorPagar: cuentasPorPagarArray,
      cuentasPorPagarTotal: cuentasPorPagarArray.reduce((sum, cuenta) => sum + (parseFloat(cuenta.monto) || 0), 0),
      efectivoEnCajaYBanco: efectivoArray,
      efectivoEnCajaYBancoTotal: efectivoArray.reduce((sum, efectivo) => sum + (parseFloat(efectivo.monto) || 0), 0),
      deudaANegocio: deudaANegocioArray,
      deudaANegocioTotal: deudaANegocioArray.reduce((sum, deuda) => sum + (parseFloat(deuda.monto) || 0), 0),
      activosFijos: parseFloat(datosFinancieros?.activosFijos) || 0,
    }
  }

  const financialData = processFinancialData()

  // Calcular totales del inventario
  const calcularTotales = () => {
    const validProductos = Array.isArray(productosContados) ? productosContados : []
    const totalProductos = validProductos.length || 0
    const valorTotal = validProductos.reduce((sum, producto) => {
      const cantidad = parseFloat(producto?.cantidadContada) || 0
      const costo = parseFloat(producto?.costoProducto) || 0
      return sum + (cantidad * costo)
    }, 0) || 0

    return { totalProductos, valorTotal: parseFloat(valorTotal) || 0 }
  }

  const { totalProductos, valorTotal } = calcularTotales()

  // No renderizar si el modal no está visible
  if (!visible) {
    return null
  }

  // Validar que tenemos datos válidos
  if (!sesionData || !productosContados) {
    return null
  }

  // Validar que productosContados es un array válido
  const validProductos = Array.isArray(productosContados) ? productosContados : []
  
  // Función auxiliar para convertir valores a string de forma segura
  const safeString = (value) => {
    if (value === null || value === undefined) return 'N/A'
    if (typeof value === 'object') {
      return value.nombre || value.descripcion || 'Objeto'
    }
    return String(value)
  }

  // Formatear moneda
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: 'DOP'
    }).format(amount || 0)
  }

  // Calcular próxima fecha de inventario (mismo día del siguiente mes)
  const calcularProximaFecha = () => {
    const fecha = sesionData?.fecha ? new Date(sesionData.fecha) : new Date()
    const proximaFecha = new Date(fecha)
    proximaFecha.setMonth(proximaFecha.getMonth() + 1)
    return proximaFecha.toLocaleDateString('es-DO', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    })
  }

  // Página 0: Portada
  const renderPortada = () => (
    <ScrollView style={styles.pageContent}>
      <View style={styles.portadaContainer}>
        {/* Información del Contador */}
        <View style={styles.portadaHeader}>
          <Text style={styles.portadaSubtitle}>
            Inventario de Mercancía y Presentación de Resultados elaborado por:
          </Text>
          <Text style={styles.portadaContadorName}>
            {user?.nombre?.toUpperCase() || 'CONTADOR'}
          </Text>
          <Text style={styles.portadaContadorInfo}>Cédula: {user?.cedula || 'No disponible'}</Text>
          <Text style={styles.portadaContadorInfo}>Teléfono: {user?.telefono || user?.phone || 'No disponible'}</Text>
          <Text style={styles.portadaContadorInfo}>Correo: {user?.email || 'No disponible'}</Text>
        </View>

        {/* Logo (Icono) */}
        <View style={styles.portadaLogoContainer}>
          <View style={styles.portadaLogoCircle}>
            <Ionicons name="business" size={80} color="#10b981" style={{ opacity: 0.6 }} />
          </View>
        </View>

        {/* Nombre del Cliente */}
        <View style={styles.portadaClienteContainer}>
          <Text style={styles.portadaClienteName}>
            {sesionData?.clienteNegocio?.nombre?.toUpperCase() || 'CLIENTE'}
          </Text>
          {sesionData?.clienteNegocio?.telefono && (
            <Text style={styles.portadaClienteInfo}>{sesionData.clienteNegocio.telefono}</Text>
          )}
          {sesionData?.clienteNegocio?.direccion && (
            <Text style={styles.portadaClienteInfo}>{sesionData.clienteNegocio.direccion}</Text>
          )}
        </View>

        {/* Pie de Portada */}
        <View style={styles.portadaFooter}>
          <View style={styles.portadaInfoRow}>
            <View style={styles.portadaInfoColumn}>
              <Text style={styles.portadaLabel}>Inventario</Text>
              <Text style={styles.portadaValue}>
                {new Date(sesionData?.fecha || new Date()).toLocaleDateString('es-DO', { 
                  day: '2-digit', 
                  month: '2-digit', 
                  year: 'numeric' 
                })}
              </Text>
              <Text style={styles.portadaLabel}>Próx. Inventario</Text>
              <Text style={styles.portadaValue}>{calcularProximaFecha()}</Text>
            </View>
            <View style={styles.portadaInfoColumn}>
              <Text style={styles.portadaLabel}>Costo Servicio</Text>
              <Text style={styles.portadaCosto}>
                {formatCurrency(contadorData?.costoServicio || 0)}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  )

  // Obtener productos paginados (44 en primera hoja, 51 en siguientes)
  const getProductosPaginados = () => {
    if (currentPage < 0) return []
    if (currentPage === 0) {
      const inicio = 0
      const fin = Math.min(44, validProductos.length)
      return validProductos.slice(inicio, fin)
    }
    const inicio = 44 + (currentPage - 1) * 51
    const fin = inicio + 51
    return validProductos.slice(inicio, fin)
  }

  const getTotalPaginasProductos = () => {
    const total = validProductos.length
    if (total <= 0) return 0
    if (total <= 44) return 1
    return 1 + Math.ceil((total - 44) / 51)
  }

  const tieneMasDeUnaPagina = () => {
    return getTotalPaginasProductos() > 1
  }

  // Página 1+: Lista de productos con paginación
  const renderPage1 = () => {
    const productosPagina = getProductosPaginados()
    const esPrimeraPagina = currentPage === 0
    const filasObjetivo = esPrimeraPagina ? 44 : 51
    const inicioBase = esPrimeraPagina ? 0 : 44 + (currentPage - 1) * 51
    const lineaInicio = inicioBase + 1
    const lineaFin = Math.min(inicioBase + productosPagina.length, validProductos.length)
    
    // Calcular total de la página y total general
    let totalPagina = 0
    let totalGeneral = 0
    
    productosPagina.forEach(producto => {
      const cantidad = parseFloat(producto.cantidadContada) || 0
      const costo = parseFloat(producto.costoProducto) || 0
      totalPagina += cantidad * costo
    })
    
    validProductos.forEach(producto => {
      const cantidad = parseFloat(producto.cantidadContada) || 0
      const costo = parseFloat(producto.costoProducto) || 0
      totalGeneral += cantidad * costo
    })

    return (
      <ScrollView style={styles.pageContent}>
        {/* Encabezado solo en la primera página de productos */}
        {esPrimeraPagina && (
          <>
            <View style={styles.pageHeader}>
              <Text style={styles.reportTitleMain}>Reporte de inventario</Text>
              <Text style={styles.reportSubtitle}>Ordenado por Nombre de artículo</Text>
              <Text style={styles.revNumber}>Rev. {currentPage + 1}</Text>
            </View>

            <View style={styles.clientInfoSection}>
              <Text style={styles.clientName}>Cliente: {safeString(sesionData?.clienteNegocio?.nombre)}</Text>
              <Text style={styles.inventoryNumber}>Inventario No: {safeString(sesionData?.numeroSesion)}</Text>
              <Text style={styles.date}>Fecha: {new Date(sesionData?.fecha || new Date()).toLocaleDateString('es-DO')}</Text>
            </View>

            <Text style={styles.observationTitle}>Observación:</Text>
          </>
        )}
        
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.col1]}>ARTÍCULO</Text>
            <Text style={[styles.tableHeaderText, styles.col2]}>UNIDAD</Text>
            <Text style={[styles.tableHeaderText, styles.col3]}>CANTIDAD</Text>
            <Text style={[styles.tableHeaderText, styles.col4]}>COSTO</Text>
            <Text style={[styles.tableHeaderText, styles.col5]}>TOTAL</Text>
          </View>

          {productosPagina.map((producto, index) => {
            const cantidad = parseFloat(producto.cantidadContada) || 0
            const costo = parseFloat(producto.costoProducto) || 0
            const total = cantidad * costo
            const nombreProducto = String(
              typeof producto.producto === 'string' 
                ? producto.producto 
                : typeof producto.producto === 'object' && producto.producto?.nombre
                  ? producto.producto.nombre
                  : producto.nombreProducto || producto.nombre || 'Producto sin nombre'
            )

            return (
              <View key={index} style={[styles.tableRow, index % 2 === 0 ? styles.evenRow : styles.oddRow]}>
                <Text style={[styles.tableCell, styles.col1]}>{nombreProducto}</Text>
                <Text style={[styles.tableCell, styles.col2]}>unidad</Text>
                <Text style={[styles.tableCell, styles.col3]}>{cantidad.toFixed(2)}</Text>
                <Text style={[styles.tableCell, styles.col4]}>{costo.toFixed(2)}</Text>
                <Text style={[styles.tableCell, styles.col5]}>RD$ {total.toFixed(2)}</Text>
              </View>
            )
          })}

          {/* Rellenar filas vacías hasta 44/51 */}
          {Array.from({ length: Math.max(0, filasObjetivo - productosPagina.length) }).map((_, index) => (
            <View key={`empty-${index}`} style={[styles.tableRow, styles.emptyRow, (productosPagina.length + index) % 2 === 0 ? styles.evenRow : styles.oddRow]}>
              <Text style={[styles.tableCell, styles.col1]}> </Text>
              <Text style={[styles.tableCell, styles.col2]}> </Text>
              <Text style={[styles.tableCell, styles.col3]}> </Text>
              <Text style={[styles.tableCell, styles.col4]}> </Text>
              <Text style={[styles.tableCell, styles.col5]}> </Text>
            </View>
          ))}
        </View>

        {/* Pie de página - EN TODAS LAS PÁGINAS */}
        <View style={styles.footerInfo}>
          <View style={styles.footerRow}>
            <Text style={styles.lineasText}>Líneas {lineaInicio} a {lineaFin}</Text>
            <View style={styles.totalesColumn}>
              <Text style={styles.totalPaginaText}>Total Página      RD$ {totalPagina.toFixed(2)}</Text>
              <Text style={styles.totalGeneralText}>Total Reporte      RD$ {totalGeneral.toFixed(2)}</Text>
              <Text style={styles.lineasTotalText}>Líneas {lineaFin}/ {validProductos.length}</Text>
            </View>
          </View>
          
          <View style={styles.separatorLine} />
          
          <View style={styles.footerBottomRow}>
            <View style={styles.footerLeftColumn}>
              <Text style={styles.footerUserName}>
                {user?.rol === 'contador' || user?.rol === 'contable' ? 'Contador' : 'Usuario'} {user?.nombre?.toUpperCase() || 'USUARIO SISTEMA'}
              </Text>
              <Text style={styles.footerPhone}>Teléfono {user?.telefono || user?.phone || 'No disponible'}</Text>
            </View>
            <Text style={styles.footerPageNumber}>Pag. {currentPage + 1}/ {getTotalPaginasProductos()}</Text>
          </View>
        </View>
      </ScrollView>
    )
  }

  // Página 2: Distribución de Saldo
  const renderPage2 = () => {
    // Calcular deudas de socios
    const deudasSocios = financialData.deudaANegocio.filter(deuda => deuda.esSocio === true)
    const totalDeudasSocios = deudasSocios.reduce((sum, deuda) => sum + (parseFloat(deuda.monto) || 0), 0)
    
    // Calcular utilidad neta disponible para distribución
    const utilidadNeta = financialData.ventasDelMes - financialData.gastosGeneralesTotal
    const utilidadPorSocio = utilidadNeta / 2 // Asumiendo 2 socios al 50% cada uno
    
    // Calcular deudas por socio con lógica mejorada
    const deudaSocio1 = deudasSocios.filter(d => {
      const deudor = d.deudor?.toLowerCase() || ''
      return deudor.includes('socio 1') || deudor === 'socio 1' || (deudor.includes('1') && deudor.includes('socio'))
    }).reduce((sum, d) => sum + (parseFloat(d.monto) || 0), 0)
    
    const deudaSocio2 = deudasSocios.filter(d => {
      const deudor = d.deudor?.toLowerCase() || ''
      return deudor.includes('socio 2') || deudor === 'socio 2' || (deudor.includes('2') && deudor.includes('socio'))
    }).reduce((sum, d) => sum + (parseFloat(d.monto) || 0), 0)
    
    const deudaNoAsignada = totalDeudasSocios - deudaSocio1 - deudaSocio2
    
    // Distribuir deuda no asignada equitativamente
    const deudaFinalSocio1 = deudaSocio1 + (deudaNoAsignada / 2)
    const deudaFinalSocio2 = deudaSocio2 + (deudaNoAsignada / 2)
    
    // Calcular utilidad neta después de descontar deudas
    const utilidadNetaSocio1 = utilidadPorSocio - deudaFinalSocio1
    const utilidadNetaSocio2 = utilidadPorSocio - deudaFinalSocio2

    return (
      <ScrollView style={styles.pageContent}>
        <View style={styles.centerHeader}>
          <Text style={styles.companyName}>{String(sesionData?.clienteNegocio?.nombre || 'CLIENTE')}</Text>
          <Text style={styles.reportTitle}>Distribución de Saldo</Text>
          <Text style={styles.reportDate}>Al {new Date().toLocaleDateString('es-ES')}</Text>
          <Text style={styles.currency}>(En RD $)</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información General</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Total de Utilidades Netas:</Text>
            <Text style={styles.infoValue}>RD$ {utilidadNeta.toFixed(2)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Total Deudas de Socios:</Text>
            <Text style={[styles.infoValue, styles.gastoValue]}>RD$ {totalDeudasSocios.toFixed(2)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Número de Socios:</Text>
            <Text style={styles.infoValue}>2</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Período:</Text>
            <Text style={styles.infoValue}>{new Date().toLocaleDateString('es-ES')}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Distribución por Socios</Text>
          <View style={styles.distributionTable}>
            <View style={styles.distributionHeader}>
              <Text style={styles.distributionHeaderText}>Socio</Text>
              <Text style={styles.distributionHeaderText}>%</Text>
              <Text style={styles.distributionHeaderText}>Utilidad Bruta</Text>
              <Text style={styles.distributionHeaderText}>Deuda</Text>
              <Text style={styles.distributionHeaderText}>Utilidad Neta</Text>
            </View>
            
            <View style={styles.distributionRow}>
              <Text style={styles.distributionCell}>Socio 1</Text>
              <Text style={styles.distributionCell}>50%</Text>
              <Text style={styles.distributionCell}>RD$ {utilidadPorSocio.toFixed(2)}</Text>
              <Text style={[styles.distributionCell, styles.gastoValue]}>RD$ {deudaFinalSocio1.toFixed(2)}</Text>
              <Text style={[styles.distributionCell, utilidadNetaSocio1 >= 0 ? {} : styles.gastoValue]}>RD$ {utilidadNetaSocio1.toFixed(2)}</Text>
            </View>
            
            <View style={styles.distributionRow}>
              <Text style={styles.distributionCell}>Socio 2</Text>
              <Text style={styles.distributionCell}>50%</Text>
              <Text style={styles.distributionCell}>RD$ {utilidadPorSocio.toFixed(2)}</Text>
              <Text style={[styles.distributionCell, styles.gastoValue]}>RD$ {deudaFinalSocio2.toFixed(2)}</Text>
              <Text style={[styles.distributionCell, utilidadNetaSocio2 >= 0 ? {} : styles.gastoValue]}>RD$ {utilidadNetaSocio2.toFixed(2)}</Text>
            </View>
            
            <View style={[styles.distributionRow, styles.totalRow]}>
              <Text style={[styles.distributionCell, styles.boldText]}>TOTAL</Text>
              <Text style={[styles.distributionCell, styles.boldText]}>100%</Text>
              <Text style={[styles.distributionCell, styles.boldText]}>RD$ {utilidadNeta.toFixed(2)}</Text>
              <Text style={[styles.distributionCell, styles.boldText, styles.gastoValue]}>RD$ {totalDeudasSocios.toFixed(2)}</Text>
              <Text style={[styles.distributionCell, styles.boldText]}>RD$ {(utilidadNetaSocio1 + utilidadNetaSocio2).toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Detalle de deudas de socios */}
        {deudasSocios.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Detalle de Deudas de Socios</Text>
            {deudasSocios.map((deuda, index) => (
              <View key={index} style={styles.debtDetailItem}>
                <View style={styles.debtHeader}>
                  <Text style={styles.debtDebtor}>{deuda.deudor || 'Socio'}</Text>
                  <Text style={[styles.debtAmount, styles.gastoValue]}>RD$ {parseFloat(deuda.monto || 0).toFixed(2)}</Text>
                </View>
                <Text style={styles.debtDescription}>{deuda.descripcion || 'Sin descripción'}</Text>
                <Text style={styles.debtType}>Tipo: {deuda.tipoDeuda || 'Dinero'}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    )
  }

  // Página 3: Balance General
  const renderPage3 = () => (
    <ScrollView style={styles.pageContent}>
      <View style={styles.centerHeader}>
        <Text style={styles.companyName}>{String(sesionData?.clienteNegocio?.nombre || 'CLIENTE')}</Text>
        <Text style={styles.reportTitle}>Balance General</Text>
        <Text style={styles.reportDate}>Al {new Date().toLocaleDateString('es-ES')}</Text>
        <Text style={styles.currency}>(En RD $)</Text>
      </View>

      <View style={styles.balanceContainer}>
        {/* ACTIVOS */}
        <View style={styles.balanceSection}>
          <Text style={[styles.balanceTitle, styles.activosTitle]}>ACTIVOS</Text>
          
          <Text style={styles.balanceSubtitle}>CORRIENTES</Text>
          <View style={styles.balanceItem}>
            <Text style={styles.balanceLabel}>EFECTIVO Y CAJA</Text>
            <Text style={styles.balanceValue}>RD$ {financialData.efectivoEnCajaYBancoTotal.toFixed(2)}</Text>
          </View>
          {financialData.efectivoEnCajaYBanco.length > 0 && (
            <View style={styles.balanceSubItems}>
              {financialData.efectivoEnCajaYBanco.map((efectivo, index) => (
                <Text key={index} style={styles.balanceSubText}>
                  • {efectivo.tipoCuenta || 'Caja'}: RD$ {parseFloat(efectivo.monto || 0).toFixed(2)} ({efectivo.descripcion || 'Sin descripción'})
                </Text>
              ))}
            </View>
          )}
          <View style={styles.balanceItem}>
            <Text style={styles.balanceLabel}>CUENTAS POR COBRAR</Text>
            <Text style={styles.balanceValue}>RD$ {financialData.cuentasPorCobrarTotal.toFixed(2)}</Text>
          </View>
          {financialData.cuentasPorCobrar.length > 0 && (
            <View style={styles.balanceSubItems}>
              {financialData.cuentasPorCobrar.map((cuenta, index) => (
                <Text key={index} style={styles.balanceSubText}>
                  • {cuenta.cliente || 'Cliente'}: RD$ {parseFloat(cuenta.monto || 0).toFixed(2)} ({cuenta.descripcion || 'Sin descripción'})
                </Text>
              ))}
            </View>
          )}
          <View style={styles.balanceItem}>
            <Text style={styles.balanceLabel}>INVENTARIO DE MERCANCÍA</Text>
            <Text style={styles.balanceValue}>RD$ {valorTotal.toFixed(2)}</Text>
          </View>
          <View style={styles.balanceItem}>
            <Text style={styles.balanceLabel}>DEUDA A NEGOCIO</Text>
            <Text style={styles.balanceValue}>RD$ {financialData.deudaANegocioTotal.toFixed(2)}</Text>
          </View>
          {financialData.deudaANegocio.length > 0 && (
            <View style={styles.balanceSubItems}>
              {financialData.deudaANegocio.map((deuda, index) => (
                <Text key={index} style={styles.balanceSubText}>
                  • {deuda.deudor || 'Deudor'}: RD$ {parseFloat(deuda.monto || 0).toFixed(2)} ({deuda.descripcion || 'Sin descripción'})
                </Text>
              ))}
            </View>
          )}
          <View style={[styles.balanceItem, styles.totalItem]}>
            <Text style={styles.balanceTotalLabel}>TOTAL CORRIENTES</Text>
            <Text style={styles.balanceTotalValue}>RD$ {(financialData.efectivoEnCajaYBancoTotal + financialData.cuentasPorCobrarTotal + valorTotal + financialData.deudaANegocioTotal).toFixed(2)}</Text>
          </View>

          <Text style={styles.balanceSubtitle}>FIJOS</Text>
          <View style={styles.balanceItem}>
            <Text style={styles.balanceLabel}>ACTIVOS FIJOS</Text>
            <Text style={styles.balanceValue}>RD$ {financialData.activosFijos.toFixed(2)}</Text>
          </View>
          <View style={[styles.balanceItem, styles.totalItem]}>
            <Text style={styles.balanceTotalLabel}>TOTAL FIJOS</Text>
            <Text style={styles.balanceTotalValue}>RD$ {financialData.activosFijos.toFixed(2)}</Text>
          </View>

          <View style={[styles.balanceItem, styles.grandTotalItem]}>
            <Text style={styles.balanceGrandTotalLabel}>TOTAL ACTIVOS</Text>
            <Text style={styles.balanceGrandTotalValue}>RD$ {(financialData.efectivoEnCajaYBancoTotal + financialData.cuentasPorCobrarTotal + valorTotal + financialData.deudaANegocioTotal + financialData.activosFijos).toFixed(2)}</Text>
          </View>
        </View>

        {/* PASIVOS Y CAPITAL */}
        <View style={styles.balanceSection}>
          <Text style={[styles.balanceTitle, styles.pasivosTitle]}>PASIVOS Y CAPITAL</Text>
          
          <Text style={styles.balanceSubtitle}>PASIVOS</Text>
          <View style={styles.balanceItem}>
            <Text style={styles.balanceLabel}>CUENTAS POR PAGAR</Text>
            <Text style={styles.balanceValue}>RD$ {financialData.cuentasPorPagarTotal.toFixed(2)}</Text>
          </View>
          {financialData.cuentasPorPagar.length > 0 && (
            <View style={styles.balanceSubItems}>
              {financialData.cuentasPorPagar.map((cuenta, index) => (
                <Text key={index} style={styles.balanceSubText}>
                  • {cuenta.proveedor || 'Proveedor'}: RD$ {parseFloat(cuenta.monto || 0).toFixed(2)} ({cuenta.descripcion || 'Sin descripción'})
                </Text>
              ))}
            </View>
          )}
          <View style={[styles.balanceItem, styles.totalItem]}>
            <Text style={styles.balanceTotalLabel}>TOTAL PASIVOS</Text>
            <Text style={styles.balanceTotalValue}>RD$ {financialData.cuentasPorPagarTotal.toFixed(2)}</Text>
          </View>

          <Text style={styles.balanceSubtitle}>CAPITAL</Text>
          <View style={styles.balanceItem}>
            <Text style={styles.balanceLabel}>CAPITAL CONTABLE</Text>
            <Text style={styles.balanceValue}>RD$ {(financialData.efectivoEnCajaYBancoTotal + financialData.cuentasPorCobrarTotal + valorTotal + financialData.deudaANegocioTotal + financialData.activosFijos - financialData.cuentasPorPagarTotal).toFixed(2)}</Text>
          </View>

          <View style={[styles.balanceItem, styles.grandTotalItem]}>
            <Text style={styles.balanceGrandTotalLabel}>TOTAL PASIVOS + CAPITAL</Text>
            <Text style={styles.balanceGrandTotalValue}>RD$ {(financialData.efectivoEnCajaYBancoTotal + financialData.cuentasPorCobrarTotal + valorTotal + financialData.deudaANegocioTotal + financialData.activosFijos).toFixed(2)}</Text>
          </View>

          <View style={styles.ventasSection}>
            <Text style={[styles.balanceTitle, styles.ventasTitle]}>VENTAS Y GASTOS</Text>
            <View style={styles.balanceItem}>
              <Text style={styles.balanceLabel}>VENTAS DEL MES</Text>
              <Text style={styles.balanceValue}>RD$ {financialData.ventasDelMes.toFixed(2)}</Text>
            </View>
            <View style={styles.balanceItem}>
              <Text style={styles.balanceLabel}>GASTOS GENERALES</Text>
              <Text style={[styles.balanceValue, styles.gastoValue]}>RD$ {financialData.gastosGeneralesTotal.toFixed(2)}</Text>
            </View>
            {financialData.gastosGenerales.length > 0 && (
              <View style={styles.balanceSubItems}>
                {financialData.gastosGenerales.map((gasto, index) => (
                  <Text key={index} style={[styles.balanceSubText, styles.gastoValue]}>
                    • {gasto.categoria || 'Sin categoría'}: RD$ {parseFloat(gasto.monto || 0).toFixed(2)} ({gasto.descripcion || 'Sin descripción'})
                  </Text>
                ))}
              </View>
            )}
            <View style={[styles.balanceItem, styles.totalItem]}>
              <Text style={styles.balanceTotalLabel}>UTILIDAD NETA</Text>
              <Text style={styles.balanceTotalValue}>RD$ {(financialData.ventasDelMes - financialData.gastosGeneralesTotal).toFixed(2)}</Text>
            </View>
            <Text style={styles.percentageText}>PORCENTAJE NETO: {financialData.ventasDelMes > 0 ? (((financialData.ventasDelMes - financialData.gastosGeneralesTotal) / financialData.ventasDelMes) * 100).toFixed(2) : 0.00}%</Text>
            <Text style={styles.percentageText}>PORCENTAJE BRUTO: {financialData.ventasDelMes > 0 ? ((financialData.ventasDelMes / financialData.ventasDelMes) * 100).toFixed(2) : 0.00}%</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  )


  const renderCurrentPage = () => {
    if (currentSection === 'portada') {
      return renderPortada()
    } else if (currentSection === 'productos') {
      return renderPage1()
    } else if (currentSection === 'balance') {
      return renderPage3()
    } else if (currentSection === 'distribucion') {
      return renderPage2()
    } else {
      return renderPortada()
    }
  }

  const handleSectionChange = (section) => {
    setCurrentSection(section)
    setCurrentPage(0) // Resetear página cuando cambias de sección
    setShowMenu(false) // Cerrar menú
  }

  const getPageInfo = () => {
    if (currentSection === 'portada') {
      return { current: 1, total: 1, label: 'Portada' }
    } else if (currentSection === 'productos') {
      const total = getTotalPaginasProductos()
      return { current: currentPage + 1, total, label: 'Listado de Productos' }
    } else if (currentSection === 'balance') {
      return { current: 1, total: 1, label: 'Balance General' }
    } else if (currentSection === 'distribucion') {
      return { current: 1, total: 1, label: 'Distribución de Saldo' }
    }
    return { current: 1, total: 1, label: '' }
  }

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <LinearGradient colors={['#14b8a6', '#0d9488']} style={styles.modalHeader}>
            <View style={styles.headerContent}>
              <View style={styles.headerLeft}>
                <Ionicons name="document-text" size={24} color="#ffffff" />
                <Text style={styles.modalTitle}>Reporte de Inventario</Text>
              </View>
              <View style={styles.headerRight}>
                {/* Menú de navegación */}
                <TouchableOpacity 
                  style={styles.menuButton}
                  onPress={() => setShowMenu(!showMenu)}
                >
                  <Ionicons name="menu" size={24} color="#ffffff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                  <Ionicons name="close" size={24} color="#ffffff" />
                </TouchableOpacity>
              </View>
            </View>
            {showMenu && (
              <View style={styles.menuDropdown}>
                <TouchableOpacity 
                  style={[styles.menuItem, currentSection === 'productos' && styles.menuItemActive]}
                  onPress={() => handleSectionChange('productos')}
                >
                  <Ionicons name="list" size={20} color={currentSection === 'productos' ? '#14b8a6' : '#374151'} style={{ marginRight: 12 }} />
                  <Text style={[styles.menuItemText, currentSection === 'productos' && styles.menuItemTextActive]}>
                    Ver Listado de Productos
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.menuItem, currentSection === 'distribucion' && styles.menuItemActive]}
                  onPress={() => handleSectionChange('distribucion')}
                >
                  <Ionicons name="pie-chart" size={20} color={currentSection === 'distribucion' ? '#14b8a6' : '#374151'} style={{ marginRight: 12 }} />
                  <Text style={[styles.menuItemText, currentSection === 'distribucion' && styles.menuItemTextActive]}>
                    Ver Distribución de Saldo
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.menuItem, currentSection === 'balance' && styles.menuItemActive]}
                  onPress={() => handleSectionChange('balance')}
                >
                  <Ionicons name="calculator" size={20} color={currentSection === 'balance' ? '#14b8a6' : '#374151'} style={{ marginRight: 12 }} />
                  <Text style={[styles.menuItemText, currentSection === 'balance' && styles.menuItemTextActive]}>
                    Balance General
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            {(() => {
              const pageInfo = getPageInfo()
              return (
                <Text style={styles.pageIndicator}>
                  {pageInfo.label} {pageInfo.total > 1 ? `- Página ${pageInfo.current} de ${pageInfo.total}` : ''}
                </Text>
              )
            })()}
          </LinearGradient>

          {/* Content */}
          <View style={styles.contentContainer}>
            {renderCurrentPage()}
          </View>

          {/* Footer Navigation - Solo mostrar si estamos en productos y hay más de una página */}
          {currentSection === 'productos' && tieneMasDeUnaPagina() && (
            <View style={styles.footer}>
              <TouchableOpacity 
                style={[styles.navButton, currentPage === 0 && styles.navButtonDisabled]}
                onPress={() => setCurrentPage(Math.max(0, currentPage - 1))}
                disabled={currentPage === 0}
              >
                <Ionicons name="chevron-back" size={18} color={currentPage === 0 ? "#9ca3af" : "#ffffff"} />
                <Text style={[styles.navButtonText, currentPage === 0 && styles.navButtonTextDisabled]}>Anterior</Text>
              </TouchableOpacity>

              <View style={styles.pageIndicatorContainer}>
                {Array.from({ length: getTotalPaginasProductos() }).map((_, page) => (
                  <TouchableOpacity
                    key={page}
                    style={[styles.pageIndicatorDot, currentPage === page && styles.pageIndicatorDotActive]}
                    onPress={() => setCurrentPage(page)}
                  />
                ))}
                <Text style={styles.pageText}>Página {currentPage + 1} de {getTotalPaginasProductos()}</Text>
              </View>

              <TouchableOpacity 
                style={[styles.navButton, currentPage === getTotalPaginasProductos() - 1 && styles.navButtonDisabled]}
                onPress={() => setCurrentPage(Math.min(getTotalPaginasProductos() - 1, currentPage + 1))}
                disabled={currentPage === getTotalPaginasProductos() - 1}
              >
                <Text style={[styles.navButtonText, currentPage === getTotalPaginasProductos() - 1 && styles.navButtonTextDisabled]}>Siguiente</Text>
                <Ionicons name="chevron-forward" size={18} color={currentPage === getTotalPaginasProductos() - 1 ? "#9ca3af" : "#ffffff"} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: width * 0.98,
    height: height * 0.95,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  modalHeader: {
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuButton: {
    padding: 5,
    marginRight: 10,
  },
  menuDropdown: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    marginTop: 10,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuItemActive: {
    backgroundColor: '#f0fdfa',
  },
  menuItemText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
    fontFamily: 'System',
  },
  menuItemTextActive: {
    color: '#14b8a6',
    fontWeight: '700',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginLeft: 10,
  },
  closeButton: {
    padding: 5,
  },
  pageIndicator: {
    color: '#ffffff',
    fontSize: 12,
    marginTop: 5,
    opacity: 0.8,
  },
  contentContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  pageContent: {
    flex: 1,
    padding: 20,
  },
  pageHeader: {
    marginBottom: 15,
  },
  clientName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: 'System',
  },
  inventoryNumber: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: 'System',
  },
  date: {
    fontSize: 15,
    color: '#000000',
    position: 'absolute',
    right: 0,
    top: 0,
    fontFamily: 'System',
    fontWeight: '500',
  },
  observationTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 15,
    fontFamily: 'System',
  },
  table: {
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderBottomWidth: 2,
    borderBottomColor: '#d1d5db',
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
    padding: 10,
    textAlign: 'center',
    fontFamily: 'System',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tableCell: {
    fontSize: 11,
    color: '#000000',
    padding: 8,
    textAlign: 'center',
    fontFamily: 'System',
    fontWeight: '400',
  },
  col1: { flex: 3 },
  col2: { flex: 1.5 },
  col3: { flex: 1.5 },
  col4: { flex: 1.5 },
  col5: { flex: 2 },
  centerHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  companyName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 6,
    fontFamily: 'System',
  },
  reportTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 6,
    fontFamily: 'System',
  },
  reportDate: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 3,
    fontFamily: 'System',
    fontWeight: '500',
  },
  currency: {
    fontSize: 14,
    color: '#000000',
    fontFamily: 'System',
    fontWeight: '500',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 12,
    fontFamily: 'System',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  infoLabel: {
    fontSize: 13,
    color: '#000000',
    fontWeight: '600',
    fontFamily: 'System',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
    fontFamily: 'System',
  },
  distributionTable: {
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  distributionHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
  },
  distributionHeaderText: {
    flex: 1,
    fontSize: 11,
    fontWeight: 'bold',
    color: '#000000',
    padding: 10,
    textAlign: 'center',
    fontFamily: 'System',
  },
  distributionRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  distributionCell: {
    flex: 1,
    fontSize: 11,
    color: '#000000',
    padding: 8,
    textAlign: 'center',
    fontFamily: 'System',
    fontWeight: '400',
  },
  totalRow: {
    backgroundColor: '#f9fafb',
  },
  boldText: {
    fontWeight: 'bold',
  },
  balanceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  balanceSection: {
    flex: 1,
    marginHorizontal: 5,
  },
  balanceTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    paddingBottom: 5,
    borderBottomWidth: 2,
  },
  activosTitle: {
    color: '#2563eb',
    borderBottomColor: '#2563eb',
  },
  pasivosTitle: {
    color: '#dc2626',
    borderBottomColor: '#dc2626',
  },
  ventasTitle: {
    color: '#2563eb',
    borderBottomColor: '#2563eb',
  },
  balanceSubtitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000000',
    marginTop: 12,
    marginBottom: 6,
    fontFamily: 'System',
  },
  balanceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  balanceLabel: {
    fontSize: 12,
    color: '#000000',
    flex: 1,
    fontWeight: '600',
    fontFamily: 'System',
  },
  balanceValue: {
    fontSize: 12,
    color: '#000000',
    textAlign: 'right',
    fontWeight: '600',
    fontFamily: 'System',
  },
  gastoValue: {
    color: '#dc2626', // Color rojo para gastos
  },
  totalItem: {
    borderTopWidth: 1,
    borderTopColor: '#d1d5db',
    paddingTop: 3,
    marginTop: 5,
  },
  balanceTotalLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
    flex: 1,
    fontFamily: 'System',
  },
  balanceTotalValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
    textAlign: 'right',
    fontFamily: 'System',
  },
  grandTotalItem: {
    borderTopWidth: 2,
    borderTopColor: '#374151',
    paddingTop: 5,
    marginTop: 10,
  },
  balanceGrandTotalLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#000000',
    flex: 1,
    fontFamily: 'System',
  },
  balanceGrandTotalValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#000000',
    textAlign: 'right',
    fontFamily: 'System',
  },
  ventasSection: {
    marginTop: 15,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  percentageText: {
    fontSize: 11,
    color: '#000000',
    marginTop: 3,
    fontWeight: '600',
    fontFamily: 'System',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 25,
    paddingVertical: 18,
    borderTopWidth: 2,
    borderTopColor: '#d1d5db',
    backgroundColor: '#f9fafb',
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#14b8a6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  navButtonDisabled: {
    backgroundColor: '#e5e7eb',
    shadowOpacity: 0,
    elevation: 0,
  },
  navButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    marginHorizontal: 6,
    fontFamily: 'System',
  },
  navButtonTextDisabled: {
    color: '#9ca3af',
  },
  pageIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pageIndicatorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#d1d5db',
    marginHorizontal: 4,
  },
  pageIndicatorActive: {
    backgroundColor: '#14b8a6',
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  pageText: {
    fontSize: 13,
    color: '#374151',
    marginLeft: 10,
    fontWeight: '600',
    fontFamily: 'System',
  },
  detailItem: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#14b8a6',
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  detailCategory: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  detailAmount: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#059669',
  },
  detailDescription: {
    fontSize: 10,
    color: '#6b7280',
    marginBottom: 2,
  },
  detailDate: {
    fontSize: 9,
    color: '#9ca3af',
  },
  detailTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  detailTotalLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  detailTotalAmount: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#059669',
  },
  balanceSubItems: {
    marginLeft: 16,
    marginTop: 4,
    marginBottom: 8,
  },
  balanceSubText: {
    fontSize: 11,
    color: '#000000',
    marginBottom: 3,
    fontStyle: 'italic',
    fontFamily: 'System',
    fontWeight: '400',
  },
  debtDetailItem: {
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
  },
  debtHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  debtDebtor: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#dc2626',
  },
  debtAmount: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#dc2626',
  },
  debtDescription: {
    fontSize: 12,
    color: '#000000',
    marginBottom: 3,
    fontFamily: 'System',
    fontWeight: '400',
  },
  debtType: {
    fontSize: 11,
    color: '#000000',
    fontStyle: 'italic',
    fontFamily: 'System',
    fontWeight: '400',
  },
  // Estilos de Portada
  portadaContainer: {
    padding: 20,
    backgroundColor: '#ffffff',
  },
  portadaHeader: {
    marginBottom: 30,
  },
  portadaSubtitle: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 10,
    textAlign: 'left',
  },
  portadaContadorName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 5,
  },
  portadaContadorInfo: {
    fontSize: 11,
    color: '#4b5563',
    marginBottom: 2,
  },
  portadaLogoContainer: {
    alignItems: 'center',
    marginVertical: 30,
  },
  portadaLogoCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#10b981',
  },
  portadaClienteContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  portadaClienteName: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 8,
  },
  portadaClienteInfo: {
    fontSize: 14,
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 2,
  },
  portadaFooter: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 20,
  },
  portadaInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  portadaInfoColumn: {
    flex: 1,
  },
  portadaLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  portadaValue: {
    fontSize: 10,
    color: '#1f2937',
  },
  portadaCosto: {
    fontSize: 14,
    color: '#059669',
    fontWeight: 'bold',
  },
  // Estilos de página de productos
  reportTitleMain: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 6,
    fontFamily: 'System',
  },
  reportSubtitle: {
    fontSize: 15,
    color: '#000000',
    textAlign: 'center',
    marginBottom: 10,
    fontFamily: 'System',
    fontWeight: '500',
  },
  revNumber: {
    fontSize: 10,
    color: '#6b7280',
    textAlign: 'right',
    marginBottom: 12,
  },
  clientInfoSection: {
    marginBottom: 12,
  },
  evenRow: {
    backgroundColor: '#ffffff',
  },
  oddRow: {
    backgroundColor: '#f9fafb',
  },
  emptyRow: {
    minHeight: 30,
  },
  footerInfo: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  lineasText: {
    fontSize: 12,
    color: '#000000',
    flex: 1,
    fontWeight: '600',
    fontFamily: 'System',
  },
  totalesColumn: {
    alignItems: 'flex-end',
    flex: 1,
  },
  totalPaginaText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 3,
    fontFamily: 'System',
  },
  totalGeneralText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 3,
    fontFamily: 'System',
  },
  lineasTotalText: {
    fontSize: 11,
    color: '#000000',
    fontWeight: '500',
    fontFamily: 'System',
  },
  separatorLine: {
    height: 2,
    backgroundColor: '#000000',
    marginVertical: 8,
  },
  footerBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  footerLeftColumn: {
    flex: 1,
  },
  footerUserName: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 2,
  },
  footerPhone: {
    fontSize: 9,
    color: '#000000',
  },
  footerPageNumber: {
    fontSize: 9,
    color: '#000000',
    textAlign: 'right',
  },
  portadaCosto: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'right',
  },
})

export default InventoryReportModal
