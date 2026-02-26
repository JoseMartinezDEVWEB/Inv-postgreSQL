import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useQueryClient } from 'react-query';
import { showMessage } from 'react-native-flash-message';
import api from '../services/api';

/**
 * Modal para importar inventarios desde archivos PDF en React Native
 * Permite seleccionar uno o varios PDFs y procesarlos offline
 * 
 * @param {Object} props - Propiedades del componente
 * @param {boolean} props.visible - Si el modal está visible
 * @param {Function} props.onClose - Función para cerrar el modal
 * @param {Object} props.cliente - Cliente seleccionado
 */
const ImportarPDFModal = ({ visible, onClose, cliente, onVerSesion }) => {
  const [pasoActual, setPasoActual] = useState(1);
  const [archivos, setArchivos] = useState([]);
  const [procesando, setProcesando] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [resultado, setResultado] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [reintentoHecho, setReintentoHecho] = useState(false);
  const queryClient = useQueryClient();

  /**
   * Formatea el tamaño del archivo
   */
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const handleGuardarCambios = async () => {
    try {
      const id = resultado?.sesion?._id;
      if (!id) return;
      setGuardando(true);
      const resp = await api.patch(`/sesiones-inventario/${id}/completar`);
      if (resp.data?.exito) {
        showMessage({ message: 'Sesión guardada', type: 'success' });
        setResultado((prev) => ({
          ...prev,
          sesion: resp.data?.datos?.sesion || prev?.sesion,
        }));
        queryClient.invalidateQueries(['sesiones', cliente._id]);
      } else {
        throw new Error(resp.data?.mensaje || 'No se pudo guardar la sesión');
      }
    } catch (e) {
      const msg = e.response?.data?.mensaje || e.message || 'Error al guardar cambios';
      showMessage({ message: msg, type: 'danger' });
    } finally {
      setGuardando(false);
    }
  };

  /**
   * Maneja la selección de archivos PDF
   */
  const handleSelectFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (result.type === 'success') {
        // DocumentPicker puede devolver un solo archivo o un array
        const files = result.assets || [result];
        
        // Validar que sean PDFs o Excel
        const archivosValidos = files.filter(file => 
          file.mimeType === 'application/pdf' || 
          file.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
          file.mimeType === 'application/vnd.ms-excel' ||
          file.name?.endsWith('.pdf') ||
          file.name?.endsWith('.xlsx') ||
          file.name?.endsWith('.xls')
        );

        if (archivosValidos.length !== files.length) {
          showMessage({
            message: 'Solo se permiten archivos PDF, XLSX o XLS',
            type: 'warning',
          });
        }

        if (archivosValidos.length > 10) {
          showMessage({
            message: 'Máximo 10 archivos permitidos',
            type: 'warning',
          });
          return;
        }

        setArchivos(archivosValidos);
        setResultado(null);
      }
    } catch (error) {
      console.error('Error al seleccionar archivos:', error);
      showMessage({
        message: 'Error al seleccionar archivos',
        type: 'danger',
      });
    }
  };

  /**
   * Elimina un archivo de la lista
   */
  const handleRemoveFile = (index) => {
    setArchivos(prev => prev.filter((_, i) => i !== index));
  };

  /**
   * Procesa los archivos PDF
   */
  const handleProcesar = async () => {
    setProcesando(true);
    setError(null);
    setProgreso(0);

    try {
      // Crear FormData con los archivos
      const formData = new FormData();
      archivos.forEach((archivo) => {
        formData.append('files', {
          uri: archivo.uri,
          type: archivo.mimeType || 'application/pdf',
          name: archivo.name,
        });
      });
      
      // Agregar fecha del inventario si está disponible
      if (fechaInventario) {
        formData.append('fechaInventario', fechaInventario);
      }

      // Progreso simulado inicial (hasta 30%)
      let simulado = 0;
      const timer = setInterval(() => {
        simulado += 10;
        if (simulado <= 30) setProgreso(simulado);
      }, 300);

      // Petición usando instancia api (agrega token y baseURL automáticamente)
      const response = await api.post(
        `/clientes-negocios/${cliente._id}/importar-pdf`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            'X-Client-Type': 'mobile',
          },
          onUploadProgress: (evt) => {
            // RN puede no soportarlo; si existe, actualizamos real
            if (evt && evt.total) {
              clearInterval(timer);
              const percent = Math.round((evt.loaded * 100) / evt.total);
              setProgreso(Math.max(30, percent));
            }
          },
        }
      );

      clearInterval(timer);

      if (response.data?.exito) {
        setProgreso(100);
        const extraDelayMs = 1500 + Math.min(10, archivos.length) * 500;
        await new Promise((r) => setTimeout(r, extraDelayMs));
        setResultado(response.data.datos);
        setPasoActual(3);
        queryClient.invalidateQueries('clientes');
        queryClient.invalidateQueries(['sesiones', cliente._id]);
      } else {
        throw new Error(response.data?.mensaje || 'Error al importar PDFs');
      }
    } catch (err) {
      console.error('Error al importar PDFs:', err);
      const mensaje = err.response?.data?.mensaje || err.message || 'Error al importar PDFs';
      const msgLower = (mensaje || '').toLowerCase();
      const esDependenciaPython = err?.response?.status === 503 || msgLower.includes('pdfplumber') || msgLower.includes('procesador de pdf');
      if (!reintentoHecho && esDependenciaPython) {
        setReintentoHecho(true);
        showMessage({ message: 'Preparando procesador de PDF en el servidor. Reintentando...', type: 'info' });
        await new Promise((r) => setTimeout(r, 1800));
        return await handleProcesar();
      }
      setError(mensaje);
      showMessage({ message: mensaje, type: 'danger' });
    } finally {
      setProcesando(false);
    }
  };

  const handleSiguientePaso = () => {
    if (pasoActual === 1) {
      if (archivos.length === 0) {
        showMessage({ message: 'Seleccione al menos un archivo (PDF, XLSX o XLS)', type: 'warning' });
        return;
      }
      if (!fechaInventario || fechaInventario.trim() === '') {
        showMessage({ message: 'Debe especificar la fecha del inventario', type: 'warning' });
        return;
      }
      // Validar formato de fecha
      const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!fechaRegex.test(fechaInventario)) {
        showMessage({ message: 'Formato de fecha inválido. Use YYYY-MM-DD', type: 'warning' });
        return;
      }
      setPasoActual(2);
      setTimeout(() => handleProcesar(), 400);
    }
  };

  /**
   * Resetea el modal
   */
  const handleClose = () => {
    setPasoActual(1);
    setArchivos([]);
    setResultado(null);
    setProgreso(0);
    setProcesando(false);
    setError(null);
    setReintentoHecho(false);
    setFechaInventario(new Date().toISOString().split('T')[0]);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Importar Inventario desde Archivo</Text>
            <TouchableOpacity onPress={handleClose} disabled={procesando}>
              <Ionicons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Stepper */}
            <View style={styles.stepperRow}>
              {/* Paso 1 */}
              <View style={styles.stepItem}>
                <View style={[styles.stepCircle, pasoActual >= 1 ? styles.stepActive : styles.stepInactive]}>
                  <Text style={styles.stepNumber}>{pasoActual > 1 ? '✓' : '1'}</Text>
                </View>
                <Text style={[styles.stepLabel, pasoActual >= 1 ? styles.stepLabelActive : styles.stepLabelInactive]}>Seleccionar PDF</Text>
              </View>
              <View style={[styles.stepConnector, pasoActual >= 2 ? styles.stepActive : styles.stepInactive]} />
              {/* Paso 2 */}
              <View style={styles.stepItem}>
                <View style={[styles.stepCircle, pasoActual >= 2 ? styles.stepActive : styles.stepInactive]}>
                  <Text style={styles.stepNumber}>{pasoActual > 2 ? '✓' : '2'}</Text>
                </View>
                <Text style={[styles.stepLabel, pasoActual >= 2 ? styles.stepLabelActive : styles.stepLabelInactive]}>Procesar y Revisar</Text>
              </View>
              <View style={[styles.stepConnector, pasoActual >= 3 ? styles.stepActive : styles.stepInactive]} />
              {/* Paso 3 */}
              <View style={styles.stepItem}>
                <View style={[styles.stepCircle, pasoActual >= 3 ? styles.stepActive : styles.stepInactive]}>
                  <Text style={styles.stepNumber}>3</Text>
                </View>
                <Text style={[styles.stepLabel, pasoActual >= 3 ? styles.stepLabelActive : styles.stepLabelInactive]}>Confirmar Importación</Text>
              </View>
            </View>

            {/* Error */}
            {error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={18} color="#dc2626" style={{ marginRight: 8 }} />
                <Text style={styles.errorText}>Error al procesar archivos: {error}</Text>
              </View>
            )}
            {/* Información del cliente */}
            <View style={styles.clienteInfo}>
              <Text style={styles.clienteLabel}>Cliente</Text>
              <Text style={styles.clienteNombre}>{cliente?.nombre}</Text>
            </View>

            {/* PASO 1: Selección */}
            {pasoActual === 1 && (
              <>
                <TouchableOpacity
                  style={styles.selectButton}
                  onPress={handleSelectFiles}
                  disabled={procesando}
                >
                  <Ionicons name="cloud-upload-outline" size={48} color="#3b82f6" />
                  <Text style={styles.selectButtonText}>
                    Seleccionar archivos (PDF, XLSX, XLS)
                  </Text>
                  <Text style={styles.selectButtonSubtext}>
                    Máximo 10 archivos, 50MB cada uno
                  </Text>
                </TouchableOpacity>

                {/* Campo de fecha del inventario */}
                <View style={styles.dateContainer}>
                  <View style={styles.dateHeader}>
                    <Ionicons name="calendar-outline" size={20} color="#3b82f6" />
                    <Text style={styles.dateLabel}>Fecha del Inventario Original *</Text>
                  </View>
                  <Text style={styles.dateDescription}>
                    Especifique la fecha en que se realizó originalmente este inventario
                  </Text>
                  <TextInput
                    style={styles.dateInput}
                    value={fechaInventario}
                    onChangeText={setFechaInventario}
                    placeholder="YYYY-MM-DD (ej: 2026-01-15)"
                    placeholderTextColor="#94a3b8"
                    keyboardType="default"
                  />
                  <Text style={styles.dateHint}>
                    Formato: Año-Mes-Día (ej: 2026-01-15)
                  </Text>
                </View>

                {/* Lista de archivos seleccionados */}
                {archivos.length > 0 && (
                  <View style={styles.filesContainer}>
                    <Text style={styles.filesTitle}>
                      Archivos seleccionados ({archivos.length})
                    </Text>
                    {archivos.map((archivo, index) => (
                      <View key={index} style={styles.fileItem}>
                        <View style={styles.fileInfo}>
                          <Ionicons name="document-text" size={24} color="#ef4444" />
                          <View style={styles.fileDetails}>
                            <Text style={styles.fileName} numberOfLines={1}>
                              {archivo.name}
                            </Text>
                            <Text style={styles.fileSize}>
                              {formatFileSize(archivo.size || 0)}
                            </Text>
                          </View>
                        </View>
                        <TouchableOpacity
                          onPress={() => handleRemoveFile(index)}
                          disabled={procesando}
                        >
                          <Ionicons name="close-circle" size={24} color="#94a3b8" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {/* Instrucciones */}
                {!procesando && archivos.length === 0 && (
                  <View style={styles.instructionsContainer}>
                    <Ionicons name="information-circle" size={24} color="#f59e0b" />
                    <View style={styles.instructionsContent}>
                      <Text style={styles.instructionsTitle}>Instrucciones:</Text>
                      <Text style={styles.instructionsItem}>
                        • Seleccione uno o varios archivos PDF de inventario
                      </Text>
                      <Text style={styles.instructionsItem}>
                        • El sistema procesará automáticamente los PDFs
                      </Text>
                      <Text style={styles.instructionsItem}>
                        • Se ignorará la primera página de cada archivo
                      </Text>
                      <Text style={styles.instructionsItem}>
                        • Se extraerá: Balance General, Distribución de Saldo y
                        Listado de Mercancías
                      </Text>
                      <Text style={styles.instructionsItem}>
                        • Los productos se agregarán o actualizarán automáticamente
                      </Text>
                      <Text style={styles.instructionsItem}>
                        • Se creará una nueva sesión de inventario completada
                      </Text>
                    </View>
                  </View>
                )}
              </>
            )}

            {/* PASO 2: Procesando */}
            {pasoActual === 2 && (
              <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                <View style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 8, borderColor: '#bfdbfe', borderTopColor: '#2563eb', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <Ionicons name="document-text" size={36} color="#2563eb" />
                </View>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 8 }}>Procesando archivos...</Text>
                <Text style={{ fontSize: 13, color: '#475569', marginBottom: 16 }}>Analizando y extrayendo datos del inventario</Text>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${progreso}%` }]} />
                </View>
                <Text style={styles.progressPercent}>{progreso}%</Text>
              </View>
            )}

            {/* PASO 3: Resultado */}
            {pasoActual === 3 && (
              <View style={styles.resultContainer}>
                <View style={styles.successIcon}>
                  <Ionicons name="checkmark-circle" size={64} color="#22c55e" />
                </View>

                <View style={styles.successInfo}>
                  <Text style={styles.successTitle}>✅ Importación Exitosa</Text>

                  <View style={styles.resultItem}>
                    <Text style={styles.resultLabel}>Cliente:</Text>
                    <Text style={styles.resultValue}>
                      {resultado.resumen?.cliente}
                    </Text>
                  </View>

                  <View style={styles.resultItem}>
                    <Text style={styles.resultLabel}>Fecha:</Text>
                    <Text style={styles.resultValue}>
                      {new Date(resultado.resumen?.fecha).toLocaleDateString()}
                    </Text>
                  </View>

                  <View style={styles.resultItem}>
                    <Text style={styles.resultLabel}>Productos:</Text>
                    <Text style={styles.resultValue}>
                      {resultado.resumen?.totalProductos || resultado.resumen?.productosCreados || 0}
                    </Text>
                  </View>

                  <View style={styles.resultItem}>
                    <Text style={styles.resultLabel}>Total General:</Text>
                    <Text style={styles.resultValue}>
                      $
                      {(resultado.resumen?.totalGeneral || 0).toLocaleString('es-DO', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </Text>
                  </View>

                  <View style={styles.resultItem}>
                    <Text style={styles.resultLabel}>Archivos procesados:</Text>
                    <Text style={styles.resultValue}>
                    {resultado.resumen?.archivosProcesados ?? resultado.resumen?.archivosProcessados}
                  </Text>
                </View>

                  <View style={styles.resultItem}>
                    <Text style={styles.resultLabel}>Sesión:</Text>
                    <Text style={styles.resultValue}>
                      {resultado.sesion?.numeroSesion}
                    </Text>
                  </View>
                </View>

                {/* Balance General */}
                {resultado.resumen?.balanceGeneral && (
                  <View style={styles.balanceContainer}>
                    <Text style={styles.balanceTitle}>Balance General</Text>
                    <View style={styles.balanceGrid}>
                      <View style={styles.balanceItem}><Text style={styles.balanceLabel}>Efectivo:</Text><Text style={styles.balanceValue}>${(resultado.resumen.balanceGeneral.efectivo_caja_banco || 0).toLocaleString()}</Text></View>
                      <View style={styles.balanceItem}><Text style={styles.balanceLabel}>Ctas. por Cobrar:</Text><Text style={styles.balanceValue}>${(resultado.resumen.balanceGeneral.cuentas_por_cobrar || 0).toLocaleString()}</Text></View>
                      <View style={styles.balanceItem}><Text style={styles.balanceLabel}>Inventario:</Text><Text style={styles.balanceValue}>${(resultado.resumen.balanceGeneral.valor_inventario || 0).toLocaleString()}</Text></View>
                      <View style={styles.balanceItem}><Text style={styles.balanceLabel}>Activos Fijos:</Text><Text style={styles.balanceValue}>${(resultado.resumen.balanceGeneral.activos_fijos || 0).toLocaleString()}</Text></View>
                      <View style={styles.balanceItem}><Text style={styles.balanceLabel}>Deuda a Negocio:</Text><Text style={styles.balanceValue}>${(resultado.resumen.balanceGeneral.deuda_a_negocio || 0).toLocaleString()}</Text></View>
                      <View style={styles.balanceItem}><Text style={styles.balanceLabel}>Total Corrientes:</Text><Text style={styles.balanceValue}>${(resultado.resumen.balanceGeneral.total_corrientes || 0).toLocaleString()}</Text></View>
                      <View style={styles.balanceItem}><Text style={styles.balanceLabel}>Total Fijos:</Text><Text style={styles.balanceValue}>${(resultado.resumen.balanceGeneral.total_fijos || 0).toLocaleString()}</Text></View>
                      <View style={styles.balanceItem}><Text style={styles.balanceLabel}>Total Activos:</Text><Text style={styles.balanceValue}>${(resultado.resumen.balanceGeneral.total_activos || 0).toLocaleString()}</Text></View>
                      <View style={styles.balanceItem}><Text style={styles.balanceLabel}>Ctas. por Pagar:</Text><Text style={styles.balanceValue}>${(resultado.resumen.balanceGeneral.cuentas_por_pagar || 0).toLocaleString()}</Text></View>
                      <View style={styles.balanceItem}><Text style={styles.balanceLabel}>Total Pasivos:</Text><Text style={styles.balanceValue}>${(resultado.resumen.balanceGeneral.total_pasivos || 0).toLocaleString()}</Text></View>
                      <View style={styles.balanceItem}><Text style={styles.balanceLabel}>Capital Contable:</Text><Text style={styles.balanceValue}>${(resultado.resumen.balanceGeneral.capital_contable || 0).toLocaleString()}</Text></View>
                      <View style={styles.balanceItem}><Text style={styles.balanceLabel}>Pasivos + Capital:</Text><Text style={styles.balanceValue}>${(resultado.resumen.balanceGeneral.total_pasivos_mas_capital || 0).toLocaleString()}</Text></View>
                      <View style={styles.balanceItem}><Text style={styles.balanceLabel}>Ventas del Mes:</Text><Text style={styles.balanceValue}>${(resultado.resumen.balanceGeneral.ventas_del_mes || 0).toLocaleString()}</Text></View>
                      <View style={styles.balanceItem}><Text style={styles.balanceLabel}>Gastos Generales:</Text><Text style={styles.balanceValue}>${(resultado.resumen.balanceGeneral.gastos_generales || 0).toLocaleString()}</Text></View>
                      <View style={styles.balanceItem}><Text style={styles.balanceLabel}>Utilidad Neta:</Text><Text style={styles.balanceValue}>${(resultado.resumen.balanceGeneral.utilidad_neta || 0).toLocaleString()}</Text></View>
                      <View style={styles.balanceItem}><Text style={styles.balanceLabel}>% Neto:</Text><Text style={styles.balanceValue}>{resultado.resumen.balanceGeneral.porcentaje_neto ?? 0}%</Text></View>
                      <View style={styles.balanceItem}><Text style={styles.balanceLabel}>% Bruto:</Text><Text style={styles.balanceValue}>{resultado.resumen.balanceGeneral.porcentaje_bruto ?? 0}%</Text></View>
                    </View>
                  </View>
                )}

                {/* Distribución de saldo - Mostrar solo si hay datos */}
                {resultado.resumen?.distribucionSaldo && Object.keys(resultado.resumen.distribucionSaldo).length > 0 && (
                  <View style={[styles.balanceContainer, { marginTop: 12 }] }>
                    <Text style={styles.balanceTitle}>Distribución de saldo</Text>
                    <View style={styles.balanceGrid}>
                      <View style={styles.balanceItem}><Text style={styles.balanceLabel}>Efectivo/Caja/Banco:</Text><Text style={styles.balanceValue}>${(resultado.resumen.distribucionSaldo.efectivo_caja_banco || 0).toLocaleString()}</Text></View>
                      <View style={styles.balanceItem}><Text style={styles.balanceLabel}>Inventario:</Text><Text style={styles.balanceValue}>${(resultado.resumen.distribucionSaldo.inventario_mercancia || 0).toLocaleString()}</Text></View>
                      <View style={styles.balanceItem}><Text style={styles.balanceLabel}>Activos Fijos:</Text><Text style={styles.balanceValue}>${(resultado.resumen.distribucionSaldo.activos_fijos || 0).toLocaleString()}</Text></View>
                      <View style={styles.balanceItem}><Text style={styles.balanceLabel}>Ctas. por Cobrar:</Text><Text style={styles.balanceValue}>${(resultado.resumen.distribucionSaldo.cuentas_por_cobrar || 0).toLocaleString()}</Text></View>
                      <View style={styles.balanceItem}><Text style={styles.balanceLabel}>Ctas. por Pagar:</Text><Text style={styles.balanceValue}>${(resultado.resumen.distribucionSaldo.cuentas_por_pagar || 0).toLocaleString()}</Text></View>
                      <View style={styles.balanceItem}><Text style={styles.balanceLabel}>Otros:</Text><Text style={styles.balanceValue}>${(resultado.resumen.distribucionSaldo.otros || 0).toLocaleString()}</Text></View>
                    </View>
                  </View>
                )}
              </View>
            )}
          </ScrollView>

          {/* Footer por paso */}
          <View style={styles.modalFooter}>
            {pasoActual === 1 && (
              <>
                <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={handleClose}>
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.importButton, archivos.length === 0 && styles.disabledButton]}
                  onPress={handleSiguientePaso}
                  disabled={archivos.length === 0}
                >
                  <Text style={styles.importButtonText}>Siguiente</Text>
                </TouchableOpacity>
              </>
            )}

            {pasoActual === 2 && (
              <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={handleClose} disabled={procesando}>
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
            )}

            {pasoActual === 3 && (
              <>
                <TouchableOpacity
                  style={[styles.button, styles.importButton, (!resultado?.sesion?._id || guardando) && styles.disabledButton]}
                  onPress={handleGuardarCambios}
                  disabled={!resultado?.sesion?._id || guardando}
                >
                  <Text style={styles.importButtonText}>{guardando ? 'Guardando...' : 'Guardar cambios'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={() => {
                    const id = resultado?.sesion?._id;
                    if (id && typeof onVerSesion === 'function') {
                      onVerSesion(id, resultado?.sesion);
                    } else {
                      showMessage({ message: resultado?.sesion?.numeroSesion ? `Sesión ${resultado.sesion.numeroSesion}` : 'Sesión no disponible', type: 'info' });
                    }
                  }}
                  disabled={!resultado?.sesion?._id}
                >
                  <Text style={styles.cancelButtonText}>Ver sesión</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.button, styles.importButton]} onPress={handleClose}>
                  <Text style={styles.importButtonText}>Cerrar</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  modalContent: {
    padding: 20,
  },
  clienteInfo: {
    backgroundColor: '#dbeafe',
    borderWidth: 1,
    borderColor: '#93c5fd',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  clienteLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 4,
  },
  clienteNombre: {
    fontSize: 16,
    color: '#1e3a8a',
  },
  dateContainer: {
    marginBottom: 20,
    backgroundColor: '#f0f9ff',
    borderWidth: 2,
    borderColor: '#3b82f6',
    borderRadius: 12,
    padding: 16,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  dateLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e40af',
  },
  dateDescription: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 12,
    lineHeight: 18,
  },
  dateInput: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#3b82f6',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: '#1e293b',
    fontWeight: '600',
  },
  dateHint: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 6,
    fontStyle: 'italic',
  },
  selectButton: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    marginBottom: 20,
  },
  selectButtonText: {
    fontSize: 16,
    color: '#475569',
    marginTop: 12,
    fontWeight: '600',
  },
  selectButtonSubtext: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  filesContainer: {
    marginBottom: 20,
  },
  filesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  fileItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  fileDetails: {
    marginLeft: 12,
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  fileSize: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  progressContainer: {
    marginTop: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3b82f6',
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
  },
  progressFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  progressFooterText: {
    fontSize: 12,
    color: '#64748b',
    marginLeft: 8,
  },
  instructionsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fbbf24',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  instructionsContent: {
    marginLeft: 12,
    flex: 1,
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 8,
  },
  instructionsItem: {
    fontSize: 12,
    color: '#78350f',
    marginBottom: 4,
    lineHeight: 18,
  },
  resultContainer: {
    alignItems: 'center',
  },
  successIcon: {
    marginBottom: 20,
  },
  successInfo: {
    backgroundColor: '#d1fae5',
    borderWidth: 1,
    borderColor: '#6ee7b7',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#065f46',
    marginBottom: 16,
  },
  resultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  resultLabel: {
    fontSize: 14,
    color: '#047857',
  },
  resultValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#064e3b',
  },
  balanceContainer: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 16,
    width: '100%',
  },
  balanceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  balanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  balanceItem: {
    width: '48%',
    marginBottom: 8,
  },
  balanceLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  balanceValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginTop: 2,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#f1f5f9',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
  },
  importButton: {
    backgroundColor: '#3b82f6',
  },
  importButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  disabledButton: {
    backgroundColor: '#cbd5e1',
  },
});

export default ImportarPDFModal;
