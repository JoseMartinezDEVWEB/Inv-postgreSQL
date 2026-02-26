import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../context/AuthContext'
import { useLoader } from '../context/LoaderContext'
import { useQueryClient, useQuery } from 'react-query'
import { clientesApi, sesionesApi, reportesApi, handleApiResponse } from '../services/api'

const { width } = Dimensions.get('window')

const DashboardScreen = ({ navigation }) => {
  const { user } = useAuth()
  const { showLoader } = useLoader()
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = React.useState(false)

  const onRefresh = React.useCallback(() => {
    setRefreshing(true)
    showLoader(800)
    queryClient.invalidateQueries()
    setTimeout(() => setRefreshing(false), 900)
  }, [queryClient, showLoader])

  // Obtener estadísticas de clientes
  const { data: totalClientes = 0 } = useQuery(
    'clientes-stats',
    async () => {
      const response = await clientesApi.getAll({ limite: 1, pagina: 1 })
      const datos = handleApiResponse(response)
      return datos.paginacion?.total || datos.paginacion?.totalRegistros || 0
    },
    { retry: 1 }
  )

  // Obtener sesiones
  const { data: sesionesData } = useQuery(
    'sesiones-recientes',
    async () => {
      const response = await sesionesApi.getAll({ limite: 50, pagina: 1 })
      return handleApiResponse(response)
    },
    { retry: 1 }
  )

  // Obtener estadísticas de reportes
  const { data: reportesData } = useQuery(
    'reportes-stats',
    async () => {
      const response = await reportesApi.getStats()
      return handleApiResponse(response)
    },
    { retry: 1 }
  )

  // Calcular estadísticas
  const sesionesActivas = sesionesData?.sesiones?.filter(
    s => s.estado === 'iniciada' || s.estado === 'en_progreso'
  ).length || 0

  const sesionesCompletadas = reportesData?.estadisticasGenerales?.totalSesiones || 
                              sesionesData?.sesiones?.filter(s => s.estado === 'completada').length || 0

  const valorTotal = reportesData?.estadisticasGenerales?.valorTotalInventarios || 0

  // Actividades recientes (últimas sesiones)
  const actividadesRecientes = sesionesData?.sesiones?.slice(0, 5).map(sesion => {
    const tipo = sesion.estado === 'completada' ? 'completada' : sesion.estado === 'en_progreso' ? 'en_progreso' : 'iniciada'
    const icono = tipo === 'completada' ? 'checkmark-circle' : tipo === 'en_progreso' ? 'time' : 'play-circle'
    const color = tipo === 'completada' ? '#22c55e' : tipo === 'en_progreso' ? '#f59e0b' : '#3b82f6'
    const titulo = tipo === 'completada' ? 'Sesión completada' : tipo === 'en_progreso' ? 'Sesión en progreso' : 'Sesión iniciada'
    
    return {
      id: sesion._id || sesion.id,
      tipo,
      icono,
      color,
      titulo,
      descripcion: `Cliente: ${sesion.clienteNegocio?.nombre || 'Sin cliente'} - Valor: $${(sesion.totales?.valorTotalInventario || 0).toLocaleString()}`,
      tiempo: new Date(sesion.updatedAt || sesion.createdAt).toLocaleDateString('es-ES', { 
        day: 'numeric', 
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
  }) || []

  // Tarjetas de estadísticas
  const statCards = [
    {
      title: 'Total Clientes',
      value: totalClientes.toString(),
      icon: 'people',
      color: '#3b82f6',
      gradient: ['#3b82f6', '#2563eb'],
    },
    {
      title: 'Sesiones Activas',
      value: sesionesActivas.toString(),
      icon: 'time',
      color: '#f59e0b',
      gradient: ['#f59e0b', '#d97706'],
    },
    {
      title: 'Sesiones Completadas',
      value: sesionesCompletadas.toString(),
      icon: 'checkmark-circle',
      color: '#22c55e',
      gradient: ['#22c55e', '#16a34a'],
    },
    {
      title: 'Valor Total',
      value: `$${valorTotal.toLocaleString()}`,
      icon: 'cash',
      color: '#ef4444',
      gradient: ['#ef4444', '#dc2626'],
    },
  ]

  // Acciones rápidas
  const quickActions = [
    {
      title: 'Nueva Sesión',
      icon: 'add-circle',
      color: '#3b82f6',
      onPress: () => navigation.navigate('Inventarios'),
    },
    {
      title: 'Ver Clientes',
      icon: 'people',
      color: '#22c55e',
      onPress: () => navigation.navigate('Clientes'),
    },
    {
      title: 'Agenda',
      icon: 'calendar-outline',
      color: '#f59e0b',
      onPress: () => navigation.navigate('Agenda'),
    },
  ]

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
    >
      {/* Header */}
      <LinearGradient
        colors={['#3b82f6', '#2563eb']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.greeting}>¡Hola, {user?.nombre || 'Usuario'}!</Text>
            <Text style={styles.subtitle}>Aquí tienes un resumen de tu actividad</Text>
          </View>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => navigation.navigate('Perfil')}
          >
            <Ionicons name="person" size={24} color="#3b82f6" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Tarjetas de estadísticas */}
      <View style={styles.statsContainer}>
        <Text style={styles.sectionTitle}>Estadísticas</Text>
        <View style={styles.statsGrid}>
          {statCards.map((card, index) => (
            <TouchableOpacity key={index} style={styles.statCard}>
              <LinearGradient
                colors={card.gradient}
                style={styles.statCardGradient}
              >
                <View style={styles.statCardContent}>
                  <View style={styles.statCardIcon}>
                    <Ionicons name={card.icon} size={24} color="#ffffff" />
                  </View>
                  <View style={styles.statCardText}>
                    <Text style={styles.statCardValue}>{card.value}</Text>
                    <Text style={styles.statCardTitle}>{card.title}</Text>
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Acciones rápidas */}
      <View style={styles.actionsContainer}>
        <Text style={styles.sectionTitle}>Acciones Rápidas</Text>
        <View style={styles.actionsGrid}>
          {quickActions.map((action, index) => (
            <TouchableOpacity
              key={index}
              style={styles.actionCard}
              onPress={action.onPress}
            >
              <View style={[styles.actionIcon, { backgroundColor: action.color }]}>
                <Ionicons name={action.icon} size={24} color="#ffffff" />
              </View>
              <Text style={styles.actionTitle}>{action.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Actividades recientes */}
      <View style={styles.activitiesContainer}>
        <Text style={styles.sectionTitle}>Actividades Recientes</Text>
        <View style={styles.activitiesList}>
          {actividadesRecientes.length === 0 ? (
            <View style={styles.emptyActivities}>
              <Ionicons name="document-text-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyActivitiesText}>No hay actividades recientes</Text>
            </View>
          ) : (
            actividadesRecientes.map((actividad) => (
              <View key={actividad.id} style={styles.activityItem}>
                <View style={[styles.activityIcon, { backgroundColor: actividad.color }]}>
                  <Ionicons name={actividad.icono} size={20} color="#ffffff" />
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityTitle}>{actividad.titulo}</Text>
                  <Text style={styles.activityDescription}>{actividad.descripcion}</Text>
                  <Text style={styles.activityTime}>{actividad.tiempo}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  profileButton: {
    width: 50,
    height: 50,
    backgroundColor: '#ffffff',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginBottom: 15,
    borderRadius: 15,
    overflow: 'hidden',
  },
  statCardGradient: {
    padding: 20,
  },
  statCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statCardIcon: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  statCardText: {
    flex: 1,
  },
  statCardValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 2,
  },
  statCardTitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  actionsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  actionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    textAlign: 'center',
  },
  activitiesContainer: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  activitiesList: {
    backgroundColor: '#ffffff',
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  activityDescription: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 12,
    color: '#94a3b8',
  },
  emptyActivities: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyActivitiesText: {
    marginTop: 12,
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
})

export default DashboardScreen



