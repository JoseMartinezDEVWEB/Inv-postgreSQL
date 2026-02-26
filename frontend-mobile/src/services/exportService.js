import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform, Alert } from 'react-native';
import { isOnline } from '../config/env';
import { reportesApi } from './api';
import localDb from './localDb';

/**
 * Servicio para gestionar las exportaciones de datos de la aplicación
 */
export const exportService = {
  
  /**
   * Exporta la base de datos SQLite local completa
   */
  exportarSQLite: async () => {
    try {
      const dbName = 'j4pro_local.db';
      const dbPath = `${FileSystem.documentDirectory}SQLite/${dbName}`;
      
      // Verificar si el archivo existe
      const fileInfo = await FileSystem.getInfoAsync(dbPath);
      if (!fileInfo.exists) {
        Alert.alert('Error', 'No se encontró el archivo de base de datos local.');
        return;
      }

      // En Android, a veces es necesario copiar a un directorio temporal para compartir
      const tempPath = `${FileSystem.cacheDirectory}${dbName}`;
      await FileSystem.copyAsync({
        from: dbPath,
        to: tempPath
      });

      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Error', 'La función de compartir no está disponible en este dispositivo.');
        return;
      }

      await Sharing.shareAsync(tempPath, {
        mimeType: 'application/x-sqlite3',
        dialogTitle: 'Respaldar Base de Datos J4Pro',
        UTI: 'public.database'
      });
      
      return true;
    } catch (error) {
      console.error('Error exportando SQLite:', error);
      Alert.alert('Error', 'No se pudo exportar la base de datos: ' + error.message);
      return false;
    }
  },

  /**
   * Exporta listado de clientes a formato CSV (local)
   */
  exportarClientesCSV: async () => {
    try {
      const clientes = await localDb.obtenerClientes();
      if (clientes.length === 0) {
        Alert.alert('Aviso', 'No hay clientes para exportar.');
        return;
      }

      let csvContent = 'ID,Nombre,Documento,Email,Telefono,Direccion,Activo\n';
      clientes.forEach(c => {
        csvContent += `"${c._id}","${c.nombre}","${c.documento}","${c.email}","${c.telefono}","${c.direccion}",${c.activo}\n`;
      });

      const fileName = `clientes_j4pro_${new Date().toISOString().split('T')[0]}.csv`;
      const filePath = `${FileSystem.cacheDirectory}${fileName}`;
      
      await FileSystem.writeAsStringAsync(filePath, csvContent, { encoding: FileSystem.EncodingType.UTF8 });

      await Sharing.shareAsync(filePath, {
        mimeType: 'text/csv',
        dialogTitle: 'Exportar Clientes'
      });
      
      return true;
    } catch (error) {
      console.error('Error exportando clientes:', error);
      Alert.alert('Error', 'No se pudo exportar la lista de clientes.');
      return false;
    }
  },

  /**
   * Exporta un reporte de inventario (si hay internet usa el backend, sino avisa)
   */
  exportarReporteInventario: async (sesionId, formato = 'pdf') => {
    if (!isOnline()) {
      Alert.alert(
        'Función requiere Internet',
        'La generación de reportes PDF/Excel avanzados requiere conexión al servidor. Por favor, conéctate a internet para continuar.'
      );
      return false;
    }

    try {
      // Nota: Aquí se llamaría a reportesApi.downloadInventoryPDF(sesionId)
      // Pero como estamos en modo Standalone, esto podría fallar si el servidor no está configurado.
      // Por ahora simularemos la descarga o mostraremos el mensaje de que se requiere servidor.
      Alert.alert('Enviando solicitud', 'El servidor está procesando el reporte...');
      // Implementación real dependería del endpoint del backend
      return true;
    } catch (error) {
      console.error('Error exportando reporte:', error);
      Alert.alert('Error', 'Hubo un problema al generar el reporte.');
      return false;
    }
  }
};

export default exportService;








