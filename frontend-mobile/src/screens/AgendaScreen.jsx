import React, { useMemo, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Modal as RNModal, Dimensions } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useQuery } from 'react-query'
import { sesionesApi } from '../services/api'

const { width } = Dimensions.get('window')

const pad = (n) => String(n).padStart(2, '0')
const fmtMonthKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
const fmtDate = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`

const getTz = () => {
  const offsetMinutes = -new Date().getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${sign}${hh}:${mm}`;
};

const AgendaScreen = ({ navigation }) => {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date()
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
    return d
  })
  const [selectedDate, setSelectedDate] = useState('')
  const [modalVisible, setModalVisible] = useState(false)

  const monthKey = useMemo(() => fmtMonthKey(currentMonth), [currentMonth])

  const { data: resumenData, isLoading: resumenLoading } = useQuery(
    ['agenda-resumen', monthKey],
    () => sesionesApi.getAgendaResumen({ mes: monthKey, tz: getTz() }),
    { select: (res) => res.data.datos }
  )

  const countsMap = useMemo(() => {
    const map = new Map()
    if (resumenData?.resumen) {
      resumenData.resumen.forEach((r) => map.set(r.fecha, r.total))
    }
    return map
  }, [resumenData])

  const { data: diaData, isLoading: diaLoading } = useQuery(
    ['agenda-dia', selectedDate],
    () => sesionesApi.getAgendaDia({ fecha: selectedDate, tz: getTz() }),
    { select: (res) => res.data.datos, enabled: !!selectedDate }
  )

  const days = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth() + 1
    const firstWeekday = new Date(year, month - 1, 1).getDay()
    const daysInMonth = new Date(year, month, 0).getDate()

    const prevMonthDays = firstWeekday
    const totalCells = Math.ceil((prevMonthDays + daysInMonth) / 7) * 7

    const cells = []
    for (let i = 0; i < totalCells; i += 1) {
      const dayNum = i - prevMonthDays + 1
      const inMonth = dayNum >= 1 && dayNum <= daysInMonth
      let dateStr = ''
      if (inMonth) {
        dateStr = fmtDate(year, month, dayNum)
      }
      const count = inMonth ? (countsMap.get(dateStr) || 0) : 0
      cells.push({ inMonth, dayNum: inMonth ? dayNum : '', dateStr, count })
    }
    return cells
  }, [currentMonth, countsMap])

  const goPrev = () => {
    const d = new Date(currentMonth)
    d.setMonth(d.getMonth() - 1)
    setCurrentMonth(d)
  }
  const goNext = () => {
    const d = new Date(currentMonth)
    d.setMonth(d.getMonth() + 1)
    setCurrentMonth(d)
  }

  const renderDay = (cell, idx) => (
    <TouchableOpacity
      key={idx}
      disabled={!cell.inMonth}
      onPress={() => {
        if (cell.inMonth && cell.count > 0) {
          setSelectedDate(cell.dateStr)
          setModalVisible(true)
        }
      }}
      style={[
        styles.dayCell,
        !cell.inMonth && styles.dayCellMuted,
      ]}
    >
      <View style={styles.dayHeader}>
        <Text style={[styles.dayNumber, !cell.inMonth && styles.dayNumberMuted]}>{cell.dayNum}</Text>
        {cell.inMonth && cell.count > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{cell.count}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  )

  const renderSesionItem = ({ item }) => (
    <View style={styles.sesionItem}>
      <View>
        <Text style={styles.sesionCliente}>{item.clienteNegocio?.nombre}</Text>
        <Text style={styles.sesionNumero}>{item.numeroSesion}</Text>
      </View>
      <TouchableOpacity
        style={styles.detailButton}
        onPress={() => {
          setModalVisible(false)
          navigation.navigate('Inventarios', { screen: 'InventarioDetalle', params: { sesionId: item._id } })
        }}
      >
        <Ionicons name="arrow-forward" size={18} color="#ffffff" />
        <Text style={styles.detailButtonText}>Detalle</Text>
      </TouchableOpacity>
    </View>
  )

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.navButton} onPress={goPrev}>
          <Ionicons name="chevron-back" size={22} color="#1e293b" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Ionicons name="calendar-outline" size={18} color="#1e293b" />
          <Text style={styles.headerTitle}>
            {currentMonth.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
          </Text>
        </View>
        <TouchableOpacity style={styles.navButton} onPress={goNext}>
          <Ionicons name="chevron-forward" size={22} color="#1e293b" />
        </TouchableOpacity>
      </View>

      {/* Weekdays */}
      <View style={styles.weekdays}>
        {['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].map((d) => (
          <Text key={d} style={styles.weekday}>{d}</Text>
        ))}
      </View>

      {/* Calendar grid */}
      <View style={styles.grid}>
        {days.map(renderDay)}
      </View>

      {resumenLoading && (
        <Text style={styles.loading}>Cargando...</Text>
      )}

      <RNModal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Inventarios del {selectedDate}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color="#374151" />
              </TouchableOpacity>
            </View>
            {diaLoading ? (
              <Text style={styles.loading}>Cargando...</Text>
            ) : (diaData?.sesiones?.length ? (
              <FlatList
                data={diaData.sesiones}
                renderItem={renderSesionItem}
                keyExtractor={(item, index) => item._id || item.id || `agenda-${index}`}
                contentContainerStyle={{ paddingVertical: 8 }}
              />
            ) : (
              <View style={styles.emptyBox}>
                <Ionicons name="document-outline" size={48} color="#cbd5e1" />
                <Text style={styles.emptyText}>No hay inventarios en este día</Text>
              </View>
            ))}
          </View>
        </View>
      </RNModal>
    </View>
  )
}

const CELL = (width - 40 - 12) / 7 // padding 20 + gap total ~12

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  navButton: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  headerTitleWrap: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { marginLeft: 8, fontSize: 18, fontWeight: '700', color: '#1e293b' },
  weekdays: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, paddingHorizontal: 2 },
  weekday: { width: CELL, textAlign: 'center', fontSize: 12, fontWeight: '600', color: '#64748b' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  dayCell: { width: CELL, height: CELL + 10, backgroundColor: '#ffffff', borderRadius: 10, padding: 8, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 6 },
  dayCellMuted: { backgroundColor: '#f1f5f9', borderColor: '#e5e7eb' },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayNumber: { fontSize: 14, fontWeight: '700', color: '#111827' },
  dayNumberMuted: { color: '#9ca3af' },
  countBadge: { paddingHorizontal: 6, paddingVertical: 2, backgroundColor: '#e0e7ff', borderRadius: 9999 },
  countBadgeText: { color: '#1e3a8a', fontSize: 11, fontWeight: '700' },
  loading: { textAlign: 'center', color: '#64748b', paddingVertical: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: '70%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  sesionItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  sesionCliente: { fontSize: 14, fontWeight: '600', color: '#1f2937' },
  sesionNumero: { fontSize: 12, color: '#6b7280' },
  detailButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e40af', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  detailButtonText: { color: '#fff', marginLeft: 6, fontSize: 12, fontWeight: '600' },
  emptyBox: { alignItems: 'center', paddingVertical: 20 },
  emptyText: { marginTop: 8, fontSize: 14, color: '#64748b' },
})

export default AgendaScreen
