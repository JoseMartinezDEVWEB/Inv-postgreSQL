import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Modal, TextInput, ActivityIndicator, Image, Alert, ScrollView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { invitacionesApi, handleApiError } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { showMessage } from 'react-native-flash-message'
import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'

const InvitacionesScreen = () => {
  const { hasRole, user } = useAuth()
  const queryClient = useQueryClient()

  const [modalGenerar, setModalGenerar] = useState(false)
  const [modalQR, setModalQR] = useState(false)
  const [qrData, setQrData] = useState(null)
  const [form, setForm] = useState({ rol: 'colaborador', email: '', nombre: '', expiraEnMinutos: 1440 }) // Por defecto 24h

  const { data, isLoading, isFetching } = useQuery(
    ['mis-invitaciones'],
    () => invitacionesApi.listMine(),
    { select: (r) => r.data.datos || [], enabled: hasRole('contable') || hasRole('administrador') || hasRole('contador'), onError: handleApiError }
  )

  const { data: colaboradores, isLoading: loadingColab, refetch: refetchColab } = useQuery(
    ['colaboradores'],
    () => invitacionesApi.listarColaboradores(),
    { select: (r) => r.data.datos || [], enabled: hasRole('contable') || hasRole('administrador') || hasRole('contador'), onError: handleApiError }
  )

  const genMutation = useMutation((payload) => invitacionesApi.createQR(payload), {
    onSuccess: (r) => {
      const d = r.data.datos
      setQrData(d)
      setModalGenerar(false)
      setModalQR(true)
      showMessage({ message: 'Invitación generada', type: 'success' })
      queryClient.invalidateQueries(['mis-invitaciones'])
      queryClient.invalidateQueries(['colaboradores'])
    },
    onError: handleApiError,
  })

  const toggleMutation = useMutation((id) => invitacionesApi.toggleColaborador(id), {
    onSuccess: (r) => {
      showMessage({ message: r.data.mensaje, type: 'success' })
      queryClient.invalidateQueries(['colaboradores'])
    },
    onError: handleApiError,
  })

  const handleMostrarQR = async (id) => {
    try {
      const res = await invitacionesApi.obtenerQRColaborador(id)
      setQrData(res.data.datos)
      setModalQR(true)
    } catch (err) {
      handleApiError(err)
    }
  }

  const cancelMutation = useMutation((id) => invitacionesApi.cancel(id), {
    onSuccess: () => {
      showMessage({ message: 'Invitación cancelada', type: 'success' })
      queryClient.invalidateQueries(['mis-invitaciones'])
    },
    onError: handleApiError,
  })

  const handleGuardarQR = async () => {
    try {
      if (!qrData?.qrDataUrl) return
      const dataUrl = qrData.qrDataUrl
      const base64 = dataUrl.replace(/^data:image\/(png|jpeg);base64,/, '')
      const fileUri = FileSystem.cacheDirectory + `invitacion-${qrData.rol}-${Date.now()}.png`
      await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 })
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri)
      } else {
        showMessage({ message: 'QR guardado en caché', type: 'info' })
      }
    } catch (e) {
      handleApiError(e)
    }
  }

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{item.nombre || '-'}</Text>
        <Text style={styles.meta}>{item.email || '-'}</Text>
        <View style={styles.rowBetween}>
          <Text style={styles.meta}>Rol: {item.rol}</Text>
          <Text style={[styles.badge, item.estado === 'pendiente' ? styles.badgePending : item.estado === 'consumida' ? styles.badgeOk : item.estado === 'expirada' ? styles.badgeError : styles.badgeGray]}>
            {item.estado}
          </Text>
        </View>
        <Text style={styles.meta}>Expira: {new Date(item.expiraEn).toLocaleString()}</Text>
      </View>
      {item.estado === 'pendiente' && (
        <TouchableOpacity style={styles.iconButton} onPress={() => {
          Alert.alert('Confirmar', '¿Cancelar invitación?', [
            { text: 'No', style: 'cancel' },
            { text: 'Sí, cancelar', style: 'destructive', onPress: () => cancelMutation.mutate(item._id) },
          ])
        }}>
          <Ionicons name="close-circle-outline" size={22} color="#ef4444" />
        </TouchableOpacity>
      )}
    </View>
  )

  if (!hasRole('contable') && !hasRole('administrador') && !hasRole('contador')) {
    return (
      <View style={styles.center}>
        <Text style={styles.info}>No tienes permisos para acceder a esta sección</Text>
      </View>
    )
  }

  const countColab = (colaboradores || []).filter(c => c.rol === 'colaborador').length
  const limiteColab = user?.limiteColaboradores
  const showLimite = hasRole('contador') && limiteColab != null

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Invitaciones QR</Text>
          {showLimite && (
            <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12, marginTop: 2 }}>Colaboradores: {countColab}/{limiteColab}</Text>
          )}
        </View>
        {(hasRole('contable') || hasRole('administrador') || hasRole('contador')) && (
          <TouchableOpacity style={styles.addButton} onPress={() => setModalGenerar(true)}>
            <Ionicons name="qr-code-outline" size={18} color="#fff" />
            <Text style={styles.addButtonText}>Generar</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* Invitaciones */}
        <Text style={styles.sectionTitle}>Invitaciones Generadas</Text>
        {isLoading || isFetching ? (
          <ActivityIndicator size="large" color="#1e40af" style={{ marginVertical: 20 }} />
        ) : (data || []).length === 0 ? (
          <Text style={styles.info}>No hay invitaciones generadas</Text>
        ) : (
          (data || []).map((item) => (
            <View key={item._id} style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.nombre || '-'}</Text>
                <Text style={styles.meta}>{item.email || '-'}</Text>
                <View style={styles.rowBetween}>
                  <Text style={styles.meta}>Rol: {item.rol}</Text>
                  <Text style={[styles.badge, item.estado === 'pendiente' ? styles.badgePending : item.estado === 'consumida' ? styles.badgeOk : item.estado === 'expirada' ? styles.badgeError : styles.badgeGray]}>
                    {item.estado}
                  </Text>
                </View>
                <Text style={styles.meta}>Expira: {new Date(item.expiraEn).toLocaleString()}</Text>
              </View>
              {item.estado === 'pendiente' && (hasRole('contable') || hasRole('administrador') || hasRole('contador')) && (
                <TouchableOpacity style={styles.iconButton} onPress={() => {
                  Alert.alert('Confirmar', '¿Cancelar invitación?', [
                    { text: 'No', style: 'cancel' },
                    { text: 'Sí, cancelar', style: 'destructive', onPress: () => cancelMutation.mutate(item._id) },
                  ])
                }}>
                  <Ionicons name="close-circle-outline" size={22} color="#ef4444" />
                </TouchableOpacity>
              )}
            </View>
          ))
        )}

        {/* Colaboradores */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Colaboradores Activos</Text>
        {loadingColab ? (
          <ActivityIndicator size="large" color="#1e40af" style={{ marginVertical: 20 }} />
        ) : (colaboradores || []).length === 0 ? (
          <Text style={styles.info}>No hay colaboradores registrados</Text>
        ) : (
          (colaboradores || []).map((colab) => (
            <View key={colab._id} style={styles.card}>
              <View style={{ flex: 1 }}>
                <View style={styles.rowBetween}>
                  <Text style={styles.name}>{colab.nombre || 'Sin nombre'}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {/* Estado de conexión */}
                    <View style={[
                      styles.badge,
                      colab.estadoConexion === 'conectado' ? styles.badgeOk :
                        colab.estadoConexion === 'esperando_reconexion' ? styles.badgePending :
                          styles.badgeGray
                    ]}>
                      <Ionicons
                        name={colab.estadoConexion === 'conectado' ? 'wifi' : colab.estadoConexion === 'esperando_reconexion' ? 'wifi-outline' : 'cloud-offline-outline'}
                        size={12}
                        color={colab.estadoConexion === 'conectado' ? '#166534' : colab.estadoConexion === 'esperando_reconexion' ? '#854d0e' : '#374151'}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={{ fontSize: 10, fontWeight: '700' }}>
                        {colab.estadoConexion === 'conectado' ? 'Conectado' :
                          colab.estadoConexion === 'esperando_reconexion' ? 'Reconectando' : 'Desconectado'}
                      </Text>
                    </View>
                    {/* Estado activo/inactivo */}
                    <TouchableOpacity onPress={() => toggleMutation.mutate(colab._id)}>
                      <View style={[styles.badge, colab.activo ? styles.badgeOk : styles.badgeGray]}>
                        <Text style={{ fontSize: 10, fontWeight: '700' }}>{colab.activo ? 'Activo' : 'Inactivo'}</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.codeBox}>
                  <Text style={styles.codeLabel}>Código:</Text>
                  <Text style={styles.codeText}>{colab.codigoNumerico}</Text>
                </View>
                <Text style={styles.meta}>
                  Última conexión: {colab.ultimaConexion ? new Date(colab.ultimaConexion).toLocaleString() : 'Nunca'}
                </Text>
              </View>
              <TouchableOpacity style={styles.iconButton} onPress={() => handleMostrarQR(colab._id)}>
                <Ionicons name="qr-code" size={28} color="#7c3aed" />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      {/* Modal Generar */}
      <Modal visible={modalGenerar} animationType="slide" onRequestClose={() => setModalGenerar(false)}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Generar Invitación</Text>
          <View style={styles.roleRow}>
            <TouchableOpacity onPress={() => setForm({ ...form, rol: 'colaborador' })} style={[styles.roleChip, form.rol === 'colaborador' ? styles.roleChipActive : null]}>
              <Text style={[styles.roleChipText, form.rol === 'colaborador' ? styles.roleChipTextActive : null]}>Colaborador</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setForm({ ...form, rol: 'contador' })} style={[styles.roleChip, form.rol === 'contador' ? styles.roleChipActive : null]}>
              <Text style={[styles.roleChipText, form.rol === 'contador' ? styles.roleChipTextActive : null]}>Contador</Text>
            </TouchableOpacity>
          </View>
          <TextInput style={styles.input} placeholder="Nombre (opcional)" value={form.nombre} onChangeText={(t) => setForm({ ...form, nombre: t })} />
          <TextInput style={styles.input} placeholder="Email (opcional)" keyboardType="email-address" value={form.email} onChangeText={(t) => setForm({ ...form, email: t })} />
          <View style={styles.durationRow}>
            {[
              { minutos: 1440, label: '24h' },      // 1 día
              { minutos: 10080, label: '7 días' },   // 7 días
              { minutos: 21600, label: '15 días' },  // 15 días
              { minutos: 43200, label: '1 mes' },    // 1 mes (30 días)
              { minutos: 129600, label: '3 meses' }, // 3 meses (90 días)
              { minutos: 259200, label: '6 meses' }, // 6 meses (180 días)
              { minutos: 518400, label: '12 meses' } // 12 meses (360 días)
            ].map(({ minutos, label }) => (
              <TouchableOpacity
                key={minutos}
                onPress={() => setForm({ ...form, expiraEnMinutos: minutos })}
                style={[styles.durationChip, form.expiraEnMinutos === minutos ? styles.durationChipActive : null]}
              >
                <Text style={[styles.durationText, form.expiraEnMinutos === minutos ? styles.durationTextActive : null]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.row}>
            <TouchableOpacity style={[styles.button, styles.cancel]} onPress={() => setModalGenerar(false)}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.primary]} onPress={() => genMutation.mutate(form)} disabled={genMutation.isLoading}>
              <Text style={styles.primaryText}>{genMutation.isLoading ? 'Generando...' : 'Generar'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal QR */}
      <Modal visible={modalQR} animationType="slide" onRequestClose={() => setModalQR(false)}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Código QR Generado</Text>
          {qrData ? (
            <>
              <View style={{ alignItems: 'center', marginVertical: 10 }}>
                <View style={{ backgroundColor: '#fff', padding: 10, borderRadius: 8 }}>
                  <Image source={{ uri: qrData.qrDataUrl }} style={{ width: 256, height: 256 }} />
                </View>
              </View>
              <View style={styles.codigoContainer}>
                <Text style={styles.codigoTitle}>Código de Acceso</Text>
                <View style={styles.codigoBox2}>
                  <Text style={styles.codigoNumerico}>{qrData.codigoNumerico}</Text>
                </View>
                <Text style={styles.codigoSubtitle}>Comparte este código de 6 dígitos</Text>
              </View>
              <View style={{ backgroundColor: '#eff6ff', padding: 10, borderRadius: 8 }}>
                <Text style={{ color: '#1e40af', fontWeight: '700', marginBottom: 4 }}>Información:</Text>
                <Text style={{ color: '#1e3a8a' }}>Nombre: {qrData.nombre || 'Sin especificar'}</Text>
                <Text style={{ color: '#1e3a8a' }}>Rol: {qrData.rol}</Text>
                <Text style={{ color: '#1e3a8a' }}>Expira: {new Date(qrData.expiraEn).toLocaleString()}</Text>
                {qrData.duracionMinutos && <Text style={{ color: '#1e3a8a' }}>Duración: {qrData.duracionMinutos} minutos</Text>}
              </View>
              <View style={styles.row}>
                <TouchableOpacity style={[styles.button, styles.primary]} onPress={handleGuardarQR}>
                  <Text style={styles.primaryText}>Compartir/Guardar QR</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.button, styles.cancel]} onPress={() => { setModalQR(false); setQrData(null) }}>
                  <Text style={styles.cancelText}>Cerrar</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <ActivityIndicator size="large" color="#1e40af" />
          )}
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#1e40af' },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  addButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2563eb', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  addButtonText: { color: '#fff', marginLeft: 6, fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb', flexDirection: 'row' },
  name: { fontSize: 16, fontWeight: '700', color: '#111827' },
  meta: { fontSize: 12, color: '#6b7280' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  iconButton: { padding: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, color: '#111827', fontSize: 11, fontWeight: '700' },
  badgePending: { backgroundColor: '#fef9c3', color: '#854d0e' },
  badgeOk: { backgroundColor: '#dcfce7', color: '#166534' },
  badgeError: { backgroundColor: '#fee2e2', color: '#991b1b' },
  badgeGray: { backgroundColor: '#e5e7eb', color: '#374151' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  info: { color: '#64748b' },
  modalContent: { flex: 1, padding: 16, backgroundColor: '#f8fafc' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 12 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },
  button: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, marginLeft: 8 },
  cancel: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb' },
  cancelText: { color: '#374151', fontWeight: '600' },
  primary: { backgroundColor: '#2563eb' },
  primaryText: { color: '#fff', fontWeight: '700' },
  roleRow: { flexDirection: 'row', marginBottom: 10 },
  roleChip: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8, backgroundColor: '#fff' },
  roleChipActive: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  roleChipText: { color: '#374151', fontWeight: '600' },
  roleChipTextActive: { color: '#1d4ed8' },
  durationRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  durationChip: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 16, paddingHorizontal: 8, paddingVertical: 6, marginHorizontal: 3, marginBottom: 6, backgroundColor: '#fff', minWidth: 70 },
  durationChipActive: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  durationText: { color: '#374151', fontWeight: '600', fontSize: 12, textAlign: 'center' },
  durationTextActive: { color: '#1d4ed8' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
  codeBox: { backgroundColor: '#f3e8ff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, flexDirection: 'row', alignItems: 'center', marginVertical: 6 },
  codeLabel: { fontSize: 12, color: '#6b21a8', fontWeight: '600', marginRight: 8 },
  codeText: { fontSize: 18, fontFamily: 'monospace', fontWeight: '700', color: '#7c3aed', letterSpacing: 3 },
  codigoContainer: { backgroundColor: '#f5f3ff', padding: 16, borderRadius: 12, borderWidth: 2, borderColor: '#e9d5ff', marginVertical: 10 },
  codigoTitle: { fontSize: 16, fontWeight: '700', color: '#6b21a8', textAlign: 'center', marginBottom: 8 },
  codigoBox2: { backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 8 },
  codigoNumerico: { fontSize: 32, fontFamily: 'monospace', fontWeight: '700', color: '#7c3aed', textAlign: 'center', letterSpacing: 8 },
  codigoSubtitle: { fontSize: 12, color: '#6b21a8', textAlign: 'center' },
})

export default InvitacionesScreen
