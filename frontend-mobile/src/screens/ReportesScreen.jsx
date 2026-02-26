import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useQuery } from 'react-query'
import { reportesApi, sesionesApi } from '../services/api'
import { showMessage } from 'react-native-flash-message'

const { width } = Dimensions.get('window')

const ReportesScreen = ({ navigation }) => {
  const [selectedPeriod, setSelectedPeriod] = useState('30') // días

  // Obtener estadísticas de reportes
  const { data: statsData, isLoading: statsLoading } = useQuery(
    ['reportes-stats', selectedPeriod],
    () => {
      const fechaFin = new Date()
      const fechaInicio = new Date()
      fechaInicio.setDate(fechaInicio.getDate() - parseInt(selectedPeriod))
      
      return reportesApi.getStats({
        fechaInicio: fechaInicio.toISOString().split('T')[0],
        fechaFin: fechaFin.toISOString().split('T')[0],
      })
    },
    {
      select: (data) => data.data,
    }
  )

  // Obtener sesiones completadas para reportes
  const { data: sesionesData, isLoading: sesionesLoading } = useQuery(
    'sesiones-completadas',
    () => sesionesApi.getAll({ limite: 20, pagina: 1 }),
    {
      select: (data) => data.data.sesiones.filter(s => s.estado === 'completada'),
    }
  )

  // Descargar reporte
  const downloadReport = async (sesionId, type) => {
    try {
      showMessage({
        message: 'Descargando reporte...',
        type: 'info',
      })
      
      // En una aplicación real, aquí implementarías la descarga
      // Por ahora solo mostramos un mensaje
      setTimeout(() => {
        showMessage({
          message: 'Reporte descargado',
          description: `${type}_${sesionId}.pdf`,
          type: 'success',
        })
      }, 2000)
    } catch (error) {
      showMessage({
        message: 'Error al descargar',
        description: 'No se pudo descargar el reporte',
        type: 'danger',
      })
    }
  }

  // Tarjetas de estadísticas
  const statCards = [
    {
      title: 'Total Sesiones',
      value: statsData?.estadisticasGenerales?.totalSesiones || 0,
      icon: 'bar-chart',
      color: '#3b82f6',
    },
    {
      title: 'Valor Total',
      value: `$${(statsData?.estadisticasGenerales?.valorTotalInventarios || 0).toLocaleString()}`,
      icon: 'trending-up',
      color: '#22c55e',
    },
    {
      title: 'Productos Contados',
      value: statsData?.estadisticasGenerales?.totalProductosContados || 0,
      icon: 'cube',
      color: '#f59e0b',
    },
    {
      title: 'Valor Promedio',
      value: `$${(statsData?.estadisticasGenerales?.valorPromedioInventario || 0).toLocaleString()}`,
      icon: 'calculator',
      color: '#ef4444',
    },
  ]

  // Renderizar item de sesión para reportes
  const renderSesion = ({ item }) => (
    <View style={styles.sesionCard}>
      <View style={styles.sesionHeader}>
        <View style={styles.sesionInfo}>
          <Text style={styles.sesionNumero}>{item.numeroSesion}</Text>
          <Text style={styles.sesionFecha}>
            {new Date(item.fecha).toLocaleDateString()}
          </Text>
        </View>
        <View style={styles.sesionStats}>
          <Text style={styles.sesionValue}>
            ${item.totales?.valorTotalInventario?.toLocaleString() || '0'}
          </Text>
          <Text style={styles.sesionProducts}>
            {item.totales?.totalProductosContados || 0} productos
          </Text>
        </View>
      </View>
      
      <Text style={styles.clienteNombre}>{item.clienteNegocio?.nombre}</Text>
      
      <View style={styles.reportActions}>
        <TouchableOpacity
          style={[styles.reportButton, styles.balanceButton]}
          onPress={() => downloadReport(item._id, 'balance')}
        >
          <Ionicons name="document-text" size={20} color="#ffffff" />
          <Text style={styles.reportButtonText}>Balance</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.reportButton, styles.inventoryButton]}
          onPress={() => downloadReport(item._id, 'inventory')}
        >
          <Ionicons name="list" size={20} color="#ffffff" />
          <Text style={styles.reportButtonText}>Inventario</Text>
        </TouchableOpacity>
      </View>
    </View>
  )

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Reportes</Text>
        <View style={styles.periodSelector}>
          <TouchableOpacity
            style={[styles.periodButton, selectedPeriod === '7' && styles.periodButtonActive]}
            onPress={() => setSelectedPeriod('7')}
          >
            <Text style={[styles.periodButtonText, selectedPeriod === '7' && styles.periodButtonTextActive]}>
              7d
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodButton, selectedPeriod === '30' && styles.periodButtonActive]}
            onPress={() => setSelectedPeriod('30')}
          >
            <Text style={[styles.periodButtonText, selectedPeriod === '30' && styles.periodButtonTextActive]}>
              30d
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodButton, selectedPeriod === '90' && styles.periodButtonActive]}
            onPress={() => setSelectedPeriod('90')}
          >
            <Text style={[styles.periodButtonText, selectedPeriod === '90' && styles.periodButtonTextActive]}>
              90d
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tarjetas de estadísticas */}
      <View style={styles.statsContainer}>
        <Text style={styles.sectionTitle}>Estadísticas</Text>
        <View style={styles.statsGrid}>
          {statCards.map((card, index) => (
            <View key={index} style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: card.color }]}>
                <Ionicons name={card.icon} size={24} color="#ffffff" />
              </View>
              <View style={styles.statContent}>
                <Text style={styles.statValue}>{card.value}</Text>
                <Text style={styles.statTitle}>{card.title}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Lista de sesiones para reportes */}
      <View style={styles.reportsContainer}>
        <Text style={styles.sectionTitle}>Sesiones Completadas</Text>
        <FlatList
          data={sesionesData || []}
          renderItem={renderSesion}
          keyExtractor={(item, index) => item._id || item.id || `reporte-${index}`}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshing={sesionesLoading}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="document-outline" size={64} color="#cbd5e1" />
              <Text style={styles.emptyText}>No hay sesiones completadas</Text>
            </View>
          }
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 4,
  },
  periodButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  periodButtonActive: {
    backgroundColor: '#3b82f6',
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
  },
  periodButtonTextActive: {
    color: '#ffffff',
  },
  statsContainer: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 15,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: (width - 60) / 2,
    backgroundColor: '#ffffff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 2,
  },
  statTitle: {
    fontSize: 12,
    color: '#64748b',
  },
  reportsContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  listContainer: {
    paddingBottom: 20,
  },
  sesionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sesionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  sesionInfo: {
    flex: 1,
  },
  sesionNumero: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 5,
  },
  sesionFecha: {
    fontSize: 14,
    color: '#64748b',
  },
  sesionStats: {
    alignItems: 'flex-end',
  },
  sesionValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 2,
  },
  sesionProducts: {
    fontSize: 12,
    color: '#64748b',
  },
  clienteNombre: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 15,
  },
  reportActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  reportButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 5,
  },
  balanceButton: {
    backgroundColor: '#3b82f6',
  },
  inventoryButton: {
    backgroundColor: '#22c55e',
  },
  reportButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 5,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 15,
  },
})

export default ReportesScreen



