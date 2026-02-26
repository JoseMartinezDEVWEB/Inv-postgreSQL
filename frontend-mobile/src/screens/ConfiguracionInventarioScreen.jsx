import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { showMessage } from 'react-native-flash-message';
import { Picker } from '@react-native-picker/picker';
import { Switch } from 'react-native';

const { width } = Dimensions.get('window');

const ConfiguracionInventarioScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('general');

  const [distribucionData, setDistribucionData] = useState({
    totalUtilidadesNetas: 0,
    numeroSocios: 2,
    socios: [
      { nombre: '', porcentaje: 50, utilidadPeriodo: 0, utilidadAcumulada: 0, cuentaAdeudada: 0 },
      { nombre: '', porcentaje: 50, utilidadPeriodo: 0, utilidadAcumulada: 0, cuentaAdeudada: 0 }
    ],
    fechaDesde: '',
    fechaHasta: '',
    comentarios: '',
  });

  const agregarSocio = () => {
    if (distribucionData.numeroSocios >= 6) {
      showMessage({ message: 'Máximo 6 socios permitidos', type: 'warning' });
      return;
    }
    const nuevoNumero = distribucionData.numeroSocios + 1;
    const porcentajeBase = Math.floor(100 / nuevoNumero);
    const nuevosPocentajes = distribucionData.socios.map(() => porcentajeBase);
    setDistribucionData(prev => ({
      ...prev,
      numeroSocios: nuevoNumero,
      socios: [
        ...prev.socios.map((socio, index) => ({ ...socio, porcentaje: nuevosPocentajes[index] })),
        { nombre: '', porcentaje: porcentajeBase, utilidadPeriodo: 0, utilidadAcumulada: 0, cuentaAdeudada: 0 }
      ]
    }));
  };

  const eliminarSocio = (index) => {
    if (distribucionData.numeroSocios <= 2) {
      showMessage({ message: 'Mínimo 2 socios requeridos', type: 'warning' });
      return;
    }
    const nuevosSocios = distribucionData.socios.filter((_, i) => i !== index);
    const nuevoNumero = distribucionData.numeroSocios - 1;
    const porcentajeBase = Math.floor(100 / nuevoNumero);
    setDistribucionData(prev => ({
      ...prev,
      numeroSocios: nuevoNumero,
      socios: nuevosSocios.map(socio => ({ ...socio, porcentaje: porcentajeBase }))
    }));
  };

  const actualizarSocio = (index, campo, valor) => {
    setDistribucionData(prev => ({
      ...prev,
      socios: prev.socios.map((socio, i) => i === index ? { ...socio, [campo]: valor } : socio)
    }));
  };

  const calcularUtilidades = () => {
    const totalUtilidades = parseFloat(distribucionData.totalUtilidadesNetas) || 0;
    setDistribucionData(prev => ({
      ...prev,
      socios: prev.socios.map(socio => ({ ...socio, utilidadPeriodo: (totalUtilidades * socio.porcentaje) / 100 }))
    }));
  };

  const handleSaveDistribucion = () => {
    const totalPorcentaje = distribucionData.socios.reduce((sum, socio) => sum + socio.porcentaje, 0);
    if (totalPorcentaje !== 100) {
      showMessage({ message: 'La suma de porcentajes debe ser 100%', type: 'danger' });
      return;
    }
    const sociosSinNombre = distribucionData.socios.filter(socio => !socio.nombre.trim());
    if (sociosSinNombre.length > 0) {
      showMessage({ message: 'Todos los socios deben tener nombre', type: 'danger' });
      return;
    }
    showMessage({ message: 'Distribución guardada exitosamente', type: 'success' });
  };

  const [contadorData, setContadorData] = useState({
    costoContador: 0,
    fechaInventario: new Date().toISOString().split('T')[0],
    periodicidad: 'mensual',
    proximaFecha: '',
    notas: '',
  });

  const periodicidadOptions = [
    { label: 'Mensual', value: 'mensual', meses: 1 },
    { label: 'Bimestral', value: 'bimestral', meses: 2 },
    { label: 'Trimestral', value: 'trimestral', meses: 3 },
    { label: 'Semestral', value: 'semestral', meses: 6 },
    { label: 'Anual', value: 'anual', meses: 12 }
  ];

  useEffect(() => {
    if (contadorData.fechaInventario && contadorData.periodicidad) {
      calcularProximaFecha();
    }
  }, [contadorData.fechaInventario, contadorData.periodicidad]);

  const calcularProximaFecha = () => {
    const fechaActual = new Date(contadorData.fechaInventario);
    const periodicidad = periodicidadOptions.find(p => p.value === contadorData.periodicidad);
    if (fechaActual && periodicidad) {
      const proximaFecha = new Date(fechaActual);
      proximaFecha.setMonth(proximaFecha.getMonth() + periodicidad.meses);
      setContadorData(prev => ({ ...prev, proximaFecha: proximaFecha.toISOString().split('T')[0] }));
    }
  };

  const handleSaveContador = () => {
    if (!contadorData.costoContador || contadorData.costoContador <= 0) {
      showMessage({ message: 'Ingresa un costo válido para el contador', type: 'danger' });
      return;
    }
    if (!contadorData.fechaInventario) {
      showMessage({ message: 'Selecciona la fecha del inventario', type: 'danger' });
      return;
    }
    showMessage({ message: 'Datos del contador guardados', type: 'success' });
  };

  const updateContadorField = (field, value) => {
    setContadorData(prev => ({ ...prev, [field]: value }));
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  const calcularCostoPorDia = () => {
    const periodicidad = periodicidadOptions.find(p => p.value === contadorData.periodicidad);
    if (periodicidad && contadorData.costoContador) {
      const diasEnPeriodo = periodicidad.meses * 30;
      return (contadorData.costoContador / diasEnPeriodo).toFixed(2);
    }
    return '0.00';
  };

  const [exportConfig, setExportConfig] = useState({
    formato: 'pdf',
    tipoDocumento: 'completo',
    incluirPrecios: true,
    incluirTotales: true,
    incluirBalanceGeneral: true,
    nombreArchivo: '',
  });

  const formatoOptions = [
    { value: 'pdf', label: 'PDF', icon: 'document-text', color: '#ef4444' },
    { value: 'excel', label: 'Excel', icon: 'grid', color: '#22c55e' },
  ];

  const tipoDocumentoOptions = [
    { value: 'completo', label: 'Documento Completo' },
    { value: 'productos', label: 'Solo Productos' },
    { value: 'reporte', label: 'Solo Reporte' },
  ];

  const updateExportConfig = (field, value) => {
    setExportConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleExport = () => {
    showMessage({ message: `Exportando en formato ${exportConfig.formato}...`, type: 'info' });
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'general':
        return <Text>Contenido de General</Text>;
      case 'distribucion':
        return (
          <ScrollView>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Configuración General</Text>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Total Utilidades Netas</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.00"
                  keyboardType="numeric"
                  value={distribucionData.totalUtilidadesNetas.toString()}
                  onChangeText={(text) => setDistribucionData(prev => ({ ...prev, totalUtilidadesNetas: parseFloat(text) || 0 }))}
                />
              </View>
              <TouchableOpacity style={styles.calculateButton} onPress={calcularUtilidades}>
                <Ionicons name="calculator" size={20} color="#ffffff" />
                <Text style={styles.calculateButtonText}>Calcular Utilidades</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Socios ({distribucionData.numeroSocios})</Text>
                <TouchableOpacity style={styles.addSocioButton} onPress={agregarSocio}>
                  <Ionicons name="add" size={20} color="#22c55e" />
                  <Text style={styles.addSocioText}>Agregar</Text>
                </TouchableOpacity>
              </View>
              {distribucionData.socios.map((socio, index) => (
                <View key={index} style={styles.socioCard}>
                  <View style={styles.socioHeader}>
                    <Text style={styles.socioTitle}>Socio {index + 1}</Text>
                    {distribucionData.numeroSocios > 2 && (
                      <TouchableOpacity style={styles.deleteSocioButton} onPress={() => eliminarSocio(index)}>
                        <Ionicons name="trash" size={16} color="#ef4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={styles.socioInputs}>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Nombre</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Nombre del socio"
                        value={socio.nombre}
                        onChangeText={(text) => actualizarSocio(index, 'nombre', text)}
                      />
                    </View>
                    <View style={styles.inputRow}>
                      <View style={styles.inputHalf}>
                        <Text style={styles.inputLabel}>Porcentaje (%)</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="0"
                          keyboardType="numeric"
                          value={socio.porcentaje.toString()}
                          onChangeText={(text) => actualizarSocio(index, 'porcentaje', parseFloat(text) || 0)}
                        />
                      </View>
                      <View style={styles.inputHalf}>
                        <Text style={styles.inputLabel}>Utilidad Período</Text>
                        <TextInput
                          style={[styles.input, styles.readOnlyInput]}
                          placeholder="0.00"
                          value={socio.utilidadPeriodo.toFixed(2)}
                          editable={false}
                        />
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </View>
            <TouchableOpacity style={styles.saveButton} onPress={handleSaveDistribucion}>
              <Text style={styles.saveButtonText}>Guardar Distribución</Text>
            </TouchableOpacity>
          </ScrollView>
        );
      case 'contador':
        return (
          <ScrollView>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Información del Contador</Text>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Costo del Contador</Text>
                <View style={styles.currencyInput}>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput
                    style={[styles.input, styles.currencyInputField]}
                    placeholder="0.00"
                    keyboardType="numeric"
                    value={contadorData.costoContador.toString()}
                    onChangeText={(text) => updateContadorField('costoContador', parseFloat(text) || 0)}
                  />
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Fecha del Inventario</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  value={contadorData.fechaInventario}
                  onChangeText={(text) => updateContadorField('fechaInventario', text)}
                />
                <Text style={styles.dateHelper}>{formatDate(contadorData.fechaInventario)}</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Periodicidad</Text>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Frecuencia de Inventarios</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={contadorData.periodicidad}
                    onValueChange={(value) => updateContadorField('periodicidad', value)}
                    style={styles.picker}
                  >
                    {periodicidadOptions.map((option) => (
                      <Picker.Item key={option.value} label={option.label} value={option.value} />
                    ))}
                  </Picker>
                </View>
              </View>
            </View>

            <TouchableOpacity style={styles.saveButton} onPress={handleSaveContador}>
              <Text style={styles.saveButtonText}>Guardar Configuración</Text>
            </TouchableOpacity>
          </ScrollView>
        );
      case 'exportar':
        return (
          <ScrollView>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Formato de Archivo</Text>
              <View style={styles.formatGrid}>
                {formatoOptions.map((formato) => (
                  <TouchableOpacity
                    key={formato.value}
                    style={[
                      styles.formatCard,
                      exportConfig.formato === formato.value && styles.formatCardSelected
                    ]}
                    onPress={() => updateExportConfig('formato', formato.value)}
                  >
                    <Ionicons
                      name={formato.icon}
                      size={24}
                      color={exportConfig.formato === formato.value ? '#ffffff' : formato.color}
                    />
                    <Text style={[
                      styles.formatLabel,
                      exportConfig.formato === formato.value && styles.formatLabelSelected
                    ]}>
                      {formato.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tipo de Documento</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={exportConfig.tipoDocumento}
                  onValueChange={(value) => updateExportConfig('tipoDocumento', value)}
                  style={styles.picker}
                >
                  {tipoDocumentoOptions.map((option) => (
                    <Picker.Item key={option.value} label={option.label} value={option.value} />
                  ))}
                </Picker>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Opciones de Contenido</Text>
              <View style={styles.optionRow}>
                <Text style={styles.optionLabel}>Incluir Precios</Text>
                <Switch
                  value={exportConfig.incluirPrecios}
                  onValueChange={(value) => updateExportConfig('incluirPrecios', value)}
                />
              </View>
              <View style={styles.optionRow}>
                <Text style={styles.optionLabel}>Incluir Totales</Text>
                <Switch
                  value={exportConfig.incluirTotales}
                  onValueChange={(value) => updateExportConfig('incluirTotales', value)}
                />
              </View>
              <View style={styles.optionRow}>
                <Text style={styles.optionLabel}>Incluir Balance General</Text>
                <Switch
                  value={exportConfig.incluirBalanceGeneral}
                  onValueChange={(value) => updateExportConfig('incluirBalanceGeneral', value)}
                />
              </View>
            </View>

            <TouchableOpacity style={styles.saveButton} onPress={handleExport}>
              <Text style={styles.saveButtonText}>Exportar</Text>
            </TouchableOpacity>
          </ScrollView>
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#3b82f6', '#2563eb']} style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Configuración de Inventario</Text>
      </LinearGradient>

      <View style={styles.tabContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'general' && styles.activeTab]}
            onPress={() => setActiveTab('general')}
          >
            <Ionicons name="settings-outline" size={20} color={activeTab === 'general' ? '#ffffff' : '#3b82f6'} />
            <Text style={[styles.tabText, activeTab === 'general' && styles.activeTabText]}>General</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'distribucion' && styles.activeTab]}
            onPress={() => setActiveTab('distribucion')}
          >
            <Ionicons name="pie-chart-outline" size={20} color={activeTab === 'distribucion' ? '#ffffff' : '#3b82f6'} />
            <Text style={[styles.tabText, activeTab === 'distribucion' && styles.activeTabText]}>Distribución</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'contador' && styles.activeTab]}
            onPress={() => setActiveTab('contador')}
          >
            <Ionicons name="calendar-outline" size={20} color={activeTab === 'contador' ? '#ffffff' : '#3b82f6'} />
            <Text style={[styles.tabText, activeTab === 'contador' && styles.activeTabText]}>Contador</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'exportar' && styles.activeTab]}
            onPress={() => setActiveTab('exportar')}
          >
            <Ionicons name="download-outline" size={20} color={activeTab === 'exportar' ? '#ffffff' : '#3b82f6'} />
            <Text style={[styles.tabText, activeTab === 'exportar' && styles.activeTabText]}>Exportar</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView style={styles.contentContainer}>
        {renderContent()}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  tabContainer: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: '#e0e7ff',
  },
  activeTab: {
    backgroundColor: '#3b82f6',
  },
  tabText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#3b82f6',
  },
  activeTabText: {
    color: '#ffffff',
  },
  contentContainer: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  inputGroup: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#ffffff',
  },
  readOnlyInput: {
    backgroundColor: '#f9fafb',
    color: '#6b7280',
  },
  calculateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  calculateButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  addSocioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  addSocioText: {
    color: '#22c55e',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 5,
  },
  socioCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  socioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  socioTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  deleteSocioButton: {
    padding: 5,
  },
  socioInputs: {
    gap: 10,
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inputHalf: {
    flex: 1,
    marginHorizontal: 5,
  },
  saveButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  currencyInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#ffffff',
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#374151',
    paddingHorizontal: 12,
  },
  currencyInputField: {
    flex: 1,
    borderWidth: 0,
    paddingLeft: 0,
  },
  dateHelper: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 5,
    fontStyle: 'italic',
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
  formatGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  formatCard: {
    width: '48%',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  formatCardSelected: {
    backgroundColor: '#06b6d4',
    borderColor: '#0891b2',
  },
  formatLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginTop: 8,
  },
  formatLabelSelected: {
    color: '#ffffff',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  optionLabel: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
});

export default ConfiguracionInventarioScreen;
