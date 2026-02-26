import React, { useState, useMemo, useEffect } from 'react'
import { View, Text, Modal, TouchableOpacity, TextInput, FlatList, ActivityIndicator, StyleSheet, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { productosApi, sesionesApi, handleApiError } from '../../services/api'
import { showMessage } from 'react-native-flash-message'

const ProductosGeneralesModal = ({ visible, onClose, sesionId, clienteId }) => {
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [selected, setSelected] = useState({}) // {id: true}

  useEffect(() => {
    if (!visible) {
      setSearchTerm('')
      setSelected({})
    }
  }, [visible])

  const { data, isLoading } = useQuery(
    ['productos-generales', searchTerm],
    () => productosApi.getAll({ buscar: searchTerm, limite: 50 }),
    {
      enabled: visible,
      select: (response) => response.data.datos?.productos || response.data.productos || [],
      onError: handleApiError,
      staleTime: 30000,
    }
  )

  const toggleSelect = (id) => {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const selectedIds = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected])

  const asignarMutation = useMutation(
    async () => {
      if (!clienteId) throw new Error('No se encontró el cliente de la sesión')
      if (!sesionId) throw new Error('No se encontró la sesión')
      // Asignar productos generales al cliente
      const resp = await productosApi.asignarGenerales(clienteId, selectedIds)
      const productosCreados = resp.data?.datos?.productosCreados || []

      if (!Array.isArray(productosCreados) || productosCreados.length === 0) {
        // Si el backend no devuelve lista, intentar agregar directamente seleccionados como productos del cliente
        await Promise.all(
          selectedIds.map((id) =>
            sesionesApi.addProduct(sesionId, {
              producto: id,
              cantidadContada: 0,
            })
          )
        )
        return { count: selectedIds.length }
      }

      // Agregar cada producto creado a la sesión
      await Promise.all(
        productosCreados.map((p) =>
          sesionesApi.addProduct(sesionId, {
            producto: p._id,
            cantidadContada: 0,
            notas: `Agregado desde productos generales: ${p.nombre}`,
          })
        )
      )

      return { count: productosCreados.length }
    },
    {
      onSuccess: ({ count }) => {
        queryClient.invalidateQueries(['sesion', sesionId])
        queryClient.invalidateQueries(['productos-generales'])
        showMessage({ message: `${count} producto(s) agregados a la sesión`, type: 'success' })
        onClose && onClose()
      },
      onError: handleApiError,
    }
  )

  const handleAdd = () => {
    if (selectedIds.length === 0) {
      showMessage({ message: 'Selecciona al menos un producto', type: 'warning' })
      return
    }
    asignarMutation.mutate()
  }

  const renderItem = ({ item }) => {
    const checked = !!selected[item._id]
    return (
      <TouchableOpacity style={[styles.item, checked && styles.itemActive]} onPress={() => toggleSelect(item._id)}>
        <View style={[styles.itemIcon, checked ? styles.itemIconActive : styles.itemIconInactive]}>
          <Ionicons name="cube-outline" size={18} color={checked ? '#2563eb' : '#64748b'} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.itemName, checked && { color: '#111827' }]}>{item.nombre}</Text>
          <Text style={styles.itemMeta}>{item.categoria || 'Sin categoría'} • {item.unidad || 'unidad'}</Text>
        </View>
        <View>
          <Text style={styles.itemCost}>${(item.costoBase || 0).toLocaleString()}</Text>
          <View style={[styles.checkbox, checked && styles.checkboxChecked]} />
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Productos Generales</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color="#64748b" style={{ marginRight: 8 }} />
            <TextInput
              placeholder="Buscar productos..."
              placeholderTextColor="#94a3b8"
              value={searchTerm}
              onChangeText={setSearchTerm}
              style={styles.searchInput}
            />
          </View>

          {isLoading ? (
            <ActivityIndicator size="large" color="#1e40af" style={{ marginTop: 20 }} />
          ) : (
            <FlatList
              data={data || []}
              keyExtractor={(item) => item._id}
              renderItem={renderItem}
              contentContainerStyle={{ paddingBottom: 20 }}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', marginTop: 40 }}>
                  <Text style={{ color: '#64748b' }}>No se encontraron productos</Text>
                </View>
              }
            />
          )}

          <View style={styles.footer}>
            <Text style={styles.selectedCount}>{selectedIds.length} seleccionado(s)</Text>
            <View style={{ flexDirection: 'row' }}>
              <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose} disabled={asignarMutation.isLoading}>
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={handleAdd} disabled={asignarMutation.isLoading}>
                <Ionicons name="add-circle-outline" size={18} color="#fff" />
                <Text style={styles.primaryButtonText}>Agregar a Sesión</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  container: { height: '85%', backgroundColor: '#f8fafc', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title: { fontSize: 18, fontWeight: '700', color: '#1f2937' },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10 },
  searchInput: { flex: 1, fontSize: 16, color: '#1f2937' },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 8 },
  itemActive: { borderColor: '#93c5fd', backgroundColor: '#eff6ff' },
  itemIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  itemIconInactive: { backgroundColor: '#f1f5f9' },
  itemIconActive: { backgroundColor: '#dbeafe' },
  itemName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  itemMeta: { fontSize: 12, color: '#64748b' },
  itemCost: { fontSize: 12, color: '#1e40af', fontWeight: '700' },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: '#94a3b8', marginTop: 6 },
  checkboxChecked: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  selectedCount: { color: '#64748b' },
  button: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, marginLeft: 8, flexDirection: 'row', alignItems: 'center' },
  cancelButton: { borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  cancelButtonText: { color: '#374151', fontWeight: '600' },
  primaryButton: { backgroundColor: '#2563eb' },
  primaryButtonText: { color: '#fff', fontWeight: '700', marginLeft: 6 },
})

export default ProductosGeneralesModal
