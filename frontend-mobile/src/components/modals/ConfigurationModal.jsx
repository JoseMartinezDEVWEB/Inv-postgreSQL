import React, { useState } from 'react'
import { View, Text, Modal, TouchableOpacity, ScrollView, TextInput, Switch, Alert, ActivityIndicator } from 'react-native'
import { Picker } from '@react-native-picker/picker'
import { StyleSheet } from 'react-native'
import Ionicons from 'react-native-vector-icons/Ionicons'
import { useLoader } from '../../context/LoaderContext'
import exportService from '../../services/exportService'
import { isOnline } from '../../config/env'

const ConfigurationModal = ({ visible, onClose }) => {
  const { showAnimation } = useLoader()
  const [activeTab, setActiveTab] = useState('general')
  
  // Estados para configuración general
  const [generalConfig, setGeneralConfig] = useState({
    unidadPredeterminada: 'unidad',
    alertaStockMinimo: '10',
    redondeoPrecios: 'sin-redondeo',
    activarNotificaciones: false,
    guardarAutomaticamente: true,
    mostrarCodigosBarras: false
  })

  // Estados para distribución de saldo
  const [distribucionData, setDistribucionData] = useState({
    numeroSocios: 2,
    fechaDesde: new Date().toISOString().split('T')[0],
    fechaHasta: new Date().toISOString().split('T')[0],
    socios: [
      { nombre: '', porcentaje: 50, utilidadAcumulada: 0, utilidadPeriodo: 0, cuentaAdeudada: 0 },
      { nombre: '', porcentaje: 50, utilidadAcumulada: 0, utilidadPeriodo: 0, cuentaAdeudada: 0 }
    ]
  })

  // Estados para datos del contador
  const [contadorData, setContadorData] = useState({
    nombreContador: '',
    numeroLicencia: '',
    telefono: '',
    email: '',
    direccion: '',
    fechaRevision: new Date().toISOString().split('T')[0]
  })

  // Estados para descarga/impresión
  const [downloadData, setDownloadData] = useState({
    formato: 'PDF',
    tipoDocumento: 'completo',
    incluirPrecios: true,
    incluirTotales: true,
    incluirBalance: true,
    fechaPersonalizada: false,
    fechaDocumento: new Date().toISOString().split('T')[0]
  })

  // Estados para gestión de empleados
  const [empleadosData, setEmpleadosData] = useState({
    empleados: [],
    incluirEnReporte: true
  })

  const tabs = [
    { id: 'general', title: 'General', icon: 'settings-outline', color: '#64748b' },
    { id: 'distribucion', title: 'Distribución', icon: 'calculator-outline', color: '#10b981' },
    { id: 'contador', title: 'Contador', icon: 'calendar-outline', color: '#f59e0b' },
    { id: 'empleados', title: 'Empleados', icon: 'people-outline', color: '#3b82f6' },
    { id: 'descargar', title: 'Descargar', icon: 'download-outline', color: '#06b6d4' },
    { id: 'respaldar', title: 'Respaldar', icon: 'cloud-upload-outline', color: '#8b5cf6' }
  ]

  const [isExporting, setIsExporting] = useState(false)

  const updateSocio = (index, field, value) => {
    const newSocios = [...distribucionData.socios]
    newSocios[index] = { ...newSocios[index], [field]: value }
    setDistribucionData({ ...distribucionData, socios: newSocios })
  }

  const updateNumeroSocios = (num) => {
    const newSocios = Array(num).fill().map((_, i) => 
      distribucionData.socios[i] || { 
        nombre: '', 
        porcentaje: 100/num, 
        utilidadAcumulada: 0, 
        utilidadPeriodo: 0, 
        cuentaAdeudada: 0 
      }
    )
    setDistribucionData({ ...distribucionData, numeroSocios: num, socios: newSocios })
  }

  const handleSave = () => {
    showAnimation('config', 1200)
    Alert.alert(
      'Configuración Guardada',
      'Los cambios han sido guardados exitosamente.',
      [{ text: 'OK', onPress: onClose }]
    )
  }

  const handleDownload = () => {
    showAnimation('export', 4000)
    Alert.alert(
      'Descarga Iniciada',
      `Generando archivo ${downloadData.formato}...`,
      [{ text: 'OK' }]
    )
  }

  const handlePrint = () => {
    showAnimation('print', 4000)
    Alert.alert(
      'Impresión Iniciada',
      'Enviando documento a la impresora...',
      [{ text: 'OK' }]
    )
  }

  // Funciones para gestionar empleados
  const agregarEmpleado = () => {
    const nuevoEmpleado = {
      id: Date.now(),
      nombre: '',
      salario: 0,
      deuda: 0,
      fechaIngreso: new Date().toISOString().split('T')[0],
      activo: true,
      notas: ''
    }
    setEmpleadosData({
      ...empleadosData,
      empleados: [...empleadosData.empleados, nuevoEmpleado]
    })
  }

  const actualizarEmpleado = (index, field, value) => {
    const nuevosEmpleados = [...empleadosData.empleados]
    nuevosEmpleados[index] = { ...nuevosEmpleados[index], [field]: value }
    setEmpleadosData({ ...empleadosData, empleados: nuevosEmpleados })
  }

  const eliminarEmpleado = (index) => {
    Alert.alert(
      'Confirmar Eliminación',
      '¿Está seguro de eliminar este empleado?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            const nuevosEmpleados = empleadosData.empleados.filter((_, i) => i !== index)
            setEmpleadosData({ ...empleadosData, empleados: nuevosEmpleados })
          }
        }
      ]
    )
  }

  const calcularTotalNomina = () => {
    return empleadosData.empleados
      .filter(emp => emp.activo)
      .reduce((sum, emp) => sum + (parseFloat(emp.salario) || 0), 0)
  }

  const formatearMoneda = (monto) => {
    return `RD$ ${parseFloat(monto || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <ScrollView style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Configuración General del Inventario</Text>
            
            <View style={styles.formSection}>
              <Text style={styles.label}>Unidad Predeterminada</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={generalConfig.unidadPredeterminada}
                  style={styles.picker}
                  onValueChange={(value) => setGeneralConfig({...generalConfig, unidadPredeterminada: value})}
                >
                  <Picker.Item label="Unidad" value="unidad" />
                  <Picker.Item label="Kilogramos" value="kg" />
                  <Picker.Item label="Litros" value="litros" />
                  <Picker.Item label="Metros" value="metros" />
                  <Picker.Item label="Cajas" value="cajas" />
                </Picker>
              </View>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.label}>Alerta Stock Mínimo</Text>
              <TextInput
                style={styles.input}
                value={generalConfig.alertaStockMinimo}
                onChangeText={(value) => setGeneralConfig({...generalConfig, alertaStockMinimo: value})}
                keyboardType="numeric"
                placeholder="10"
              />
            </View>

            <View style={styles.formSection}>
              <Text style={styles.label}>Redondeo de Precios</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={generalConfig.redondeoPrecios}
                  style={styles.picker}
                  onValueChange={(value) => setGeneralConfig({...generalConfig, redondeoPrecios: value})}
                >
                  <Picker.Item label="Sin redondeo" value="sin-redondeo" />
                  <Picker.Item label="2 decimales" value="2-decimales" />
                  <Picker.Item label="0 decimales" value="0-decimales" />
                </Picker>
              </View>
            </View>

            <View style={styles.switchSection}>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Activar Notificaciones</Text>
                <Switch
                  value={generalConfig.activarNotificaciones}
                  onValueChange={(value) => setGeneralConfig({...generalConfig, activarNotificaciones: value})}
                  trackColor={{ false: '#e5e7eb', true: '#64748b' }}
                  thumbColor={generalConfig.activarNotificaciones ? '#ffffff' : '#f4f3f4'}
                />
              </View>
              
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Guardar automáticamente</Text>
                <Switch
                  value={generalConfig.guardarAutomaticamente}
                  onValueChange={(value) => setGeneralConfig({...generalConfig, guardarAutomaticamente: value})}
                  trackColor={{ false: '#e5e7eb', true: '#64748b' }}
                  thumbColor={generalConfig.guardarAutomaticamente ? '#ffffff' : '#f4f3f4'}
                />
              </View>
              
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Mostrar códigos de barras</Text>
                <Switch
                  value={generalConfig.mostrarCodigosBarras}
                  onValueChange={(value) => setGeneralConfig({...generalConfig, mostrarCodigosBarras: value})}
                  trackColor={{ false: '#e5e7eb', true: '#64748b' }}
                  thumbColor={generalConfig.mostrarCodigosBarras ? '#ffffff' : '#f4f3f4'}
                />
              </View>
            </View>
          </ScrollView>
        )

      case 'distribucion':
        return (
          <ScrollView style={styles.tabContent}>
            <View style={styles.sectionHeader}>
              <Ionicons name="calculator-outline" size={20} color="#10b981" />
              <Text style={[styles.sectionTitle, { color: '#10b981', marginLeft: 8 }]}>Distribución de Saldo</Text>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.label}>Número de Socios</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={distribucionData.numeroSocios}
                  style={styles.picker}
                  onValueChange={(value) => updateNumeroSocios(parseInt(value))}
                >
                  {[2,3,4,5,6].map(n => (
                    <Picker.Item key={n} label={`${n} socios`} value={n} />
                  ))}
                </Picker>
              </View>
            </View>

            <View style={styles.dateRow}>
              <View style={styles.dateField}>
                <Text style={styles.label}>Fecha Desde</Text>
                <TextInput
                  style={styles.input}
                  value={distribucionData.fechaDesde}
                  onChangeText={(value) => setDistribucionData({...distribucionData, fechaDesde: value})}
                  placeholder="YYYY-MM-DD"
                />
              </View>
              <View style={styles.dateField}>
                <Text style={styles.label}>Fecha Hasta</Text>
                <TextInput
                  style={styles.input}
                  value={distribucionData.fechaHasta}
                  onChangeText={(value) => setDistribucionData({...distribucionData, fechaHasta: value})}
                  placeholder="YYYY-MM-DD"
                />
              </View>
            </View>

            <Text style={styles.subsectionTitle}>Distribución por Socios</Text>
            {distribucionData.socios.map((socio, index) => (
              <View key={index} style={styles.socioCard}>
                <Text style={styles.socioTitle}>Socio {index + 1}</Text>
                
                <View style={styles.formSection}>
                  <Text style={styles.label}>Nombre</Text>
                  <TextInput
                    style={styles.input}
                    value={socio.nombre}
                    onChangeText={(value) => updateSocio(index, 'nombre', value)}
                    placeholder="Nombre del Socio"
                  />
                </View>

                <View style={styles.formSection}>
                  <Text style={styles.label}>Porcentaje (%)</Text>
                  <TextInput
                    style={styles.input}
                    value={socio.porcentaje.toString()}
                    onChangeText={(value) => updateSocio(index, 'porcentaje', parseFloat(value) || 0)}
                    keyboardType="numeric"
                    placeholder="50"
                  />
                </View>
              </View>
            ))}
          </ScrollView>
        )

      case 'contador':
        return (
          <ScrollView style={styles.tabContent}>
            <View style={styles.sectionHeader}>
              <Ionicons name="calendar-outline" size={20} color="#f59e0b" />
              <Text style={[styles.sectionTitle, { color: '#f59e0b', marginLeft: 8 }]}>Datos del Contador</Text>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.label}>Nombre del Contador</Text>
              <TextInput
                style={styles.input}
                value={contadorData.nombreContador}
                onChangeText={(value) => setContadorData({...contadorData, nombreContador: value})}
                placeholder="Nombre completo"
              />
            </View>

            <View style={styles.formSection}>
              <Text style={styles.label}>Número de Licencia</Text>
              <TextInput
                style={styles.input}
                value={contadorData.numeroLicencia}
                onChangeText={(value) => setContadorData({...contadorData, numeroLicencia: value})}
                placeholder="Ej: CPA-12345"
              />
            </View>

            <View style={styles.formSection}>
              <Text style={styles.label}>Teléfono</Text>
              <TextInput
                style={styles.input}
                value={contadorData.telefono}
                onChangeText={(value) => setContadorData({...contadorData, telefono: value})}
                placeholder="(809) 000-0000"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.formSection}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={contadorData.email}
                onChangeText={(value) => setContadorData({...contadorData, email: value})}
                placeholder="contador@email.com"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.formSection}>
              <Text style={styles.label}>Dirección</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={contadorData.direccion}
                onChangeText={(value) => setContadorData({...contadorData, direccion: value})}
                placeholder="Dirección completa"
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.formSection}>
              <Text style={styles.label}>Fecha de Revisión</Text>
              <TextInput
                style={styles.input}
                value={contadorData.fechaRevision}
                onChangeText={(value) => setContadorData({...contadorData, fechaRevision: value})}
                placeholder="YYYY-MM-DD"
              />
            </View>
          </ScrollView>
        )

      case 'empleados':
        return (
          <ScrollView style={styles.tabContent}>
            <View style={styles.sectionHeader}>
              <Ionicons name="people-outline" size={20} color="#3b82f6" />
              <Text style={[styles.sectionTitle, { color: '#3b82f6', marginLeft: 8 }]}>Gestión de Empleados</Text>
            </View>

            {empleadosData.empleados.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={64} color="#d1d5db" />
                <Text style={styles.emptyStateTitle}>No hay empleados registrados</Text>
                <Text style={styles.emptyStateText}>Agrega empleados para gestionar la nómina</Text>
              </View>
            ) : (
              <>
                {/* Resumen de nómina */}
                <View style={styles.nominaResumen}>
                  <View style={styles.nominaHeader}>
                    <View>
                      <Text style={styles.nominaTitle}>Total Nómina del Período</Text>
                      <Text style={styles.nominaSubtitle}>
                        {empleadosData.empleados.filter(e => e.activo).length} empleado(s) activo(s)
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.nominaTotal}>{formatearMoneda(calcularTotalNomina())}</Text>
                      <Text style={styles.nominaNote}>Se suma a gastos</Text>
                    </View>
                  </View>

                  {/* Checkbox para incluir en reporte */}
                  <View style={styles.checkboxContainer}>
                    <Switch
                      value={empleadosData.incluirEnReporte}
                      onValueChange={(value) => setEmpleadosData({...empleadosData, incluirEnReporte: value})}
                      trackColor={{ false: '#e5e7eb', true: '#3b82f6' }}
                      thumbColor={empleadosData.incluirEnReporte ? '#ffffff' : '#f4f3f4'}
                    />
                    <View style={styles.checkboxTextContainer}>
                      <Text style={styles.checkboxLabel}>Incluir detalle de nómina en el reporte</Text>
                      <Text style={styles.checkboxDescription}>
                        {empleadosData.incluirEnReporte 
                          ? 'Los empleados aparecerán en el reporte' 
                          : 'Solo se mostrará el total en gastos'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Lista de empleados */}
                {empleadosData.empleados.map((empleado, index) => (
                  <View key={empleado.id} style={styles.empleadoCard}>
                    <View style={styles.empleadoHeader}>
                      <View style={styles.empleadoTitleContainer}>
                        <View style={[styles.statusDot, { backgroundColor: empleado.activo ? '#10b981' : '#9ca3af' }]} />
                        <Text style={styles.empleadoTitle}>Empleado {index + 1}</Text>
                      </View>
                      <TouchableOpacity onPress={() => eliminarEmpleado(index)} style={styles.deleteButton}>
                        <Ionicons name="trash-outline" size={20} color="#ef4444" />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.formSection}>
                      <Text style={styles.label}>Nombre Completo *</Text>
                      <TextInput
                        style={styles.input}
                        value={empleado.nombre}
                        onChangeText={(value) => actualizarEmpleado(index, 'nombre', value)}
                        placeholder="Ej: Juan Pérez"
                      />
                    </View>

                    <View style={styles.formSection}>
                      <Text style={styles.label}>Salario Mensual *</Text>
                      <TextInput
                        style={styles.input}
                        value={empleado.salario.toString()}
                        onChangeText={(value) => actualizarEmpleado(index, 'salario', parseFloat(value) || 0)}
                        keyboardType="numeric"
                        placeholder="0.00"
                      />
                    </View>

                    <View style={styles.formSection}>
                      <Text style={styles.label}>Deuda del Empleado</Text>
                      <TextInput
                        style={styles.input}
                        value={empleado.deuda.toString()}
                        onChangeText={(value) => actualizarEmpleado(index, 'deuda', parseFloat(value) || 0)}
                        keyboardType="numeric"
                        placeholder="0.00"
                      />
                      {empleado.deuda > 0 && (
                        <Text style={styles.salarioNeto}>
                          Salario neto: {formatearMoneda(parseFloat(empleado.salario || 0) - parseFloat(empleado.deuda || 0))}
                        </Text>
                      )}
                    </View>

                    <View style={styles.formSection}>
                      <Text style={styles.label}>Fecha de Ingreso</Text>
                      <TextInput
                        style={styles.input}
                        value={empleado.fechaIngreso}
                        onChangeText={(value) => actualizarEmpleado(index, 'fechaIngreso', value)}
                        placeholder="YYYY-MM-DD"
                      />
                    </View>

                    <View style={styles.formSection}>
                      <Text style={styles.label}>Notas</Text>
                      <TextInput
                        style={[styles.input, styles.textArea]}
                        value={empleado.notas}
                        onChangeText={(value) => actualizarEmpleado(index, 'notas', value)}
                        placeholder="Información adicional..."
                        multiline
                        numberOfLines={2}
                      />
                    </View>

                    <View style={styles.switchRow}>
                      <Text style={styles.switchLabel}>Empleado activo</Text>
                      <Switch
                        value={empleado.activo}
                        onValueChange={(value) => actualizarEmpleado(index, 'activo', value)}
                        trackColor={{ false: '#e5e7eb', true: '#10b981' }}
                        thumbColor={empleado.activo ? '#ffffff' : '#f4f3f4'}
                      />
                    </View>
                    {!empleado.activo && (
                      <Text style={styles.inactiveWarning}>
                        Inactivo - No se suma a gastos
                      </Text>
                    )}
                  </View>
                ))}

                {/* Información adicional */}
                <View style={styles.infoBox}>
                  <View style={styles.infoHeader}>
                    <Ionicons name="information-circle-outline" size={20} color="#f59e0b" />
                    <Text style={styles.infoTitle}>Información Importante</Text>
                  </View>
                  <Text style={styles.infoText}>• Los salarios de empleados activos se suman a los gastos del mes</Text>
                  <Text style={styles.infoText}>• Las deudas se restan del salario para calcular el pago neto</Text>
                  <Text style={styles.infoText}>• Esta información se incluirá en el reporte de inventario</Text>
                  <Text style={styles.infoText}>• Marca como inactivo a empleados que ya no trabajen</Text>
                </View>
              </>
            )}

            {/* Botón para agregar empleado */}
            <TouchableOpacity style={styles.addEmpleadoButton} onPress={agregarEmpleado}>
              <Ionicons name="add-circle-outline" size={24} color="#ffffff" />
              <Text style={styles.addEmpleadoText}>Agregar Empleado</Text>
            </TouchableOpacity>
          </ScrollView>
        )

      case 'descargar':
        return (
          <ScrollView style={styles.tabContent}>
            <View style={styles.sectionHeader}>
              <Ionicons name="download-outline" size={20} color="#06b6d4" />
              <Text style={[styles.sectionTitle, { color: '#06b6d4', marginLeft: 8 }]}>Descargar/Imprimir Inventario</Text>
            </View>

            <View style={styles.infoBox}>
              <Ionicons name="wifi-outline" size={20} color="#f59e0b" />
              <Text style={styles.infoText}>
                ⚠️ Las funciones de descarga en PDF/Excel profesional requieren conexión a internet.
              </Text>
            </View>
            
            <Text style={styles.subsectionTitle}>Opciones de Descarga</Text>
            
            <View style={styles.formSection}>
              <Text style={styles.label}>Formato</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={downloadData.formato}
                  style={styles.picker}
                  onValueChange={(value) => setDownloadData({...downloadData, formato: value})}
                >
                  <Picker.Item label="PDF" value="PDF" />
                  <Picker.Item label="Excel (.xlsx)" value="Excel" />
                  <Picker.Item label="Word (.docx)" value="Word" />
                  <Picker.Item label="CSV" value="CSV" />
                </Picker>
              </View>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.label}>Tipo de Documento</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={downloadData.tipoDocumento}
                  style={styles.picker}
                  onValueChange={(value) => setDownloadData({...downloadData, tipoDocumento: value})}
                >
                  <Picker.Item label="Inventario Completo" value="completo" />
                  <Picker.Item label="Solo Lista de Productos" value="productos" />
                  <Picker.Item label="Solo Reporte Financiero" value="reporte" />
                  <Picker.Item label="Solo Balance General" value="balance" />
                </Picker>
              </View>
            </View>

            <View style={styles.switchSection}>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Incluir precios y costos</Text>
                <Switch
                  value={downloadData.incluirPrecios}
                  onValueChange={(value) => setDownloadData({...downloadData, incluirPrecios: value})}
                  trackColor={{ false: '#e5e7eb', true: '#06b6d4' }}
                  thumbColor={downloadData.incluirPrecios ? '#ffffff' : '#f4f3f4'}
                />
              </View>
              
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Incluir totales</Text>
                <Switch
                  value={downloadData.incluirTotales}
                  onValueChange={(value) => setDownloadData({...downloadData, incluirTotales: value})}
                  trackColor={{ false: '#e5e7eb', true: '#06b6d4' }}
                  thumbColor={downloadData.incluirTotales ? '#ffffff' : '#f4f3f4'}
                />
              </View>
              
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Incluir balance general</Text>
                <Switch
                  value={downloadData.incluirBalance}
                  onValueChange={(value) => setDownloadData({...downloadData, incluirBalance: value})}
                  trackColor={{ false: '#e5e7eb', true: '#06b6d4' }}
                  thumbColor={downloadData.incluirBalance ? '#ffffff' : '#f4f3f4'}
                />
              </View>
            </View>

            <Text style={styles.subsectionTitle}>Configuración de Fecha</Text>
            
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Usar fecha personalizada</Text>
              <Switch
                value={downloadData.fechaPersonalizada}
                onValueChange={(value) => setDownloadData({...downloadData, fechaPersonalizada: value})}
                trackColor={{ false: '#e5e7eb', true: '#06b6d4' }}
                thumbColor={downloadData.fechaPersonalizada ? '#ffffff' : '#f4f3f4'}
              />
            </View>

            {downloadData.fechaPersonalizada && (
              <View style={styles.formSection}>
                <Text style={styles.label}>Fecha del Documento</Text>
                <TextInput
                  style={styles.input}
                  value={downloadData.fechaDocumento}
                  onChangeText={(value) => setDownloadData({...downloadData, fechaDocumento: value})}
                  placeholder="YYYY-MM-DD"
                />
              </View>
            )}

            <View style={styles.previewSection}>
              <Text style={styles.previewTitle}>Vista Previa</Text>
              <Text style={styles.previewText}>
                COL. PEÑA_Inventario_2025-10-29.pdf
              </Text>
            </View>

            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.downloadButton} onPress={handleDownload}>
                <Ionicons name="download-outline" size={20} color="#ffffff" />
                <Text style={styles.downloadButtonText}>Descargar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.printButton} onPress={handlePrint}>
                <Ionicons name="print-outline" size={20} color="#ffffff" />
                <Text style={styles.printButtonText}>Imprimir</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )

      case 'respaldar':
        return (
          <ScrollView style={styles.tabContent}>
            <View style={styles.sectionHeader}>
              <Ionicons name="cloud-upload-outline" size={20} color="#8b5cf6" />
              <Text style={[styles.sectionTitle, { color: '#8b5cf6', marginLeft: 8 }]}>Respaldo de Datos (Admin)</Text>
            </View>

            <Text style={styles.descriptionText}>
              Utilice estas opciones para asegurar sus datos locales y exportar información importante.
            </Text>

            <View style={styles.backupGrid}>
              <TouchableOpacity 
                style={[styles.backupCard, { borderColor: '#8b5cf6' }]} 
                onPress={async () => {
                  setIsExporting(true);
                  await exportService.exportarSQLite();
                  setIsExporting(false);
                }}
                disabled={isExporting}
              >
                <Ionicons name="database-outline" size={32} color="#8b5cf6" />
                <Text style={styles.backupCardTitle}>Base de Datos Completa</Text>
                <Text style={styles.backupCardDesc}>Archivo .db local (SQLite)</Text>
                {isExporting && <ActivityIndicator size="small" color="#8b5cf6" style={{marginTop: 8}} />}
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.backupCard, { borderColor: '#10b981' }]} 
                onPress={async () => {
                  setIsExporting(true);
                  await exportService.exportarClientesCSV();
                  setIsExporting(false);
                }}
                disabled={isExporting}
              >
                <Ionicons name="people-outline" size={32} color="#10b981" />
                <Text style={styles.backupCardTitle}>Lista de Clientes</Text>
                <Text style={styles.backupCardDesc}>Formato CSV para Excel</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.backupCard, { borderColor: '#3b82f6' }]} 
                onPress={() => {
                  if (!isOnline()) {
                    Alert.alert('Sin Internet', 'Para generar reportes PDF avanzados debe estar conectado al servidor.');
                    return;
                  }
                  Alert.alert('Próximamente', 'Seleccione la sesión de inventario desde el historial para exportar su reporte.');
                }}
              >
                <Ionicons name="document-text-outline" size={32} color="#3b82f6" />
                <Text style={styles.backupCardTitle}>Reportes de Inventario</Text>
                <Text style={styles.backupCardDesc}>Requiere Internet (PDF/Excel)</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={20} color="#f59e0b" />
              <Text style={styles.infoText}>
                El respaldo de la base de datos incluye: Clientes, Productos, Usuarios e Historial de Inventarios realizados.
              </Text>
            </View>
          </ScrollView>
        )

      default:
        return null
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Configuración de Inventario</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
            {tabs.map((tab) => (
              <TouchableOpacity
                key={tab.id}
                style={[
                  styles.tab,
                  activeTab === tab.id && { ...styles.activeTab, borderBottomColor: tab.color }
                ]}
                onPress={() => setActiveTab(tab.id)}
              >
                <Ionicons 
                  name={tab.icon} 
                  size={16} 
                  color={activeTab === tab.id ? tab.color : '#6b7280'} 
                />
                <Text style={[
                  styles.tabText,
                  activeTab === tab.id && { color: tab.color }
                ]}>
                  {tab.title}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {renderTabContent()}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>Guardar Configuración</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  closeButton: {
    padding: 4,
  },
  tabContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tabScroll: {
    paddingHorizontal: 20,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
    marginLeft: 6,
  },
  content: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickActionCard: {
    width: '48%',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  quickActionIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickActionText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginTop: 20,
    marginBottom: 12,
  },
  formSection: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1f2937',
    backgroundColor: '#ffffff',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#ffffff',
  },
  picker: {
    height: 50,
  },
  switchSection: {
    marginTop: 16,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  switchLabel: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dateField: {
    flex: 1,
    marginHorizontal: 4,
  },
  socioCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  socioTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  previewSection: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 16,
    marginTop: 20,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  previewText: {
    fontSize: 14,
    color: '#6366f1',
    fontFamily: 'monospace',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  downloadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#06b6d4',
    paddingVertical: 12,
    borderRadius: 8,
    marginRight: 8,
  },
  downloadButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  printButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6b7280',
    paddingVertical: 12,
    borderRadius: 8,
    marginLeft: 8,
  },
  printButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    marginRight: 8,
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#6b7280',
    alignItems: 'center',
    marginLeft: 8,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Estilos para empleados
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 16,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
  },
  nominaResumen: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  nominaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  nominaTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
  },
  nominaSubtitle: {
    fontSize: 12,
    color: '#3b82f6',
    marginTop: 4,
  },
  nominaTotal: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e3a8a',
    textAlign: 'right',
  },
  nominaNote: {
    fontSize: 11,
    color: '#3b82f6',
    marginTop: 2,
    textAlign: 'right',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#bfdbfe',
  },
  checkboxTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  checkboxLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e40af',
  },
  checkboxDescription: {
    fontSize: 12,
    color: '#3b82f6',
    marginTop: 4,
  },
  empleadoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  empleadoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  empleadoTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  empleadoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  deleteButton: {
    padding: 6,
  },
  salarioNeto: {
    fontSize: 12,
    color: '#f59e0b',
    marginTop: 6,
    fontWeight: '500',
  },
  inactiveWarning: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 8,
    fontStyle: 'italic',
  },
  infoBox: {
    backgroundColor: '#fffbeb',
    borderRadius: 8,
    padding: 12,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
    marginLeft: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#92400e',
    lineHeight: 18,
    flex: 1,
  },
  descriptionText: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 20,
  },
  backupGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 20,
  },
  backupCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  backupCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 8,
  },
  backupCardDesc: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
  },
  addEmpleadoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 20,
    marginBottom: 20,
  },
  addEmpleadoText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
})

export default ConfigurationModal
