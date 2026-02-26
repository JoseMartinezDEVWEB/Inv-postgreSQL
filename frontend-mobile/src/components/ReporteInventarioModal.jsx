import React, { useState } from 'react';
import { View, Text, Modal, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const ReporteInventarioModal = ({ visible, onClose, sesion, cliente }) => {
    if (!sesion) return null;

    const handlePrint = async () => {
        try {
            const html = `
        <html>
          <head>
            <style>
              body { font-family: Helvetica, sans-serif; padding: 20px; }
              .header { text-align: center; margin-bottom: 20px; }
              .title { font-size: 24px; font-weight: bold; color: #0f766e; }
              .subtitle { font-size: 14px; color: #666; margin-bottom: 10px; }
              .client-info { margin-bottom: 30px; text-align: center; border: 1px solid #eee; padding: 15px; border-radius: 8px; }
              .client-name { font-size: 20px; font-weight: bold; margin-bottom: 5px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border-bottom: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f3f4f6; }
              .text-right { text-align: right; }
              .footer { margin-top: 30px; font-size: 12px; color: #999; text-align: center; }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="title">REPORTE DE INVENTARIO</div>
              <div class="subtitle">Generado el ${new Date().toLocaleDateString()}</div>
            </div>
            
            <div class="client-info">
              <div class="subtitle">Inventario elaborado por: ADMINISTRADOR</div>
              <div class="client-name">${cliente?.nombre || sesion.clienteNegocio?.nombre || 'CLIENTE'}</div>
              <div>${cliente?.telefono || sesion.clienteNegocio?.telefono || ''}</div>
              <div>${cliente?.direccion || sesion.clienteNegocio?.direccion || ''}</div>
            </div>

            <h3>Detalle de Productos</h3>
            <table>
              <tr>
                <th>Producto</th>
                <th class="text-right">Cant.</th>
                <th class="text-right">Costo</th>
                <th class="text-right">Total</th>
              </tr>
              ${sesion.productosContados?.map(p => `
                <tr>
                  <td>${p.nombreProducto}</td>
                  <td class="text-right">${p.cantidadContada}</td>
                  <td class="text-right">$${(p.costoProducto || 0).toLocaleString()}</td>
                  <td class="text-right">$${((p.cantidadContada || 0) * (p.costoProducto || 0)).toLocaleString()}</td>
                </tr>
              `).join('')}
              <tr style="font-weight: bold; background-color: #f0fdf4;">
                <td>TOTAL</td>
                <td class="text-right">${sesion.totales?.totalProductosContados || 0}</td>
                <td></td>
                <td class="text-right">$${(sesion.totales?.valorTotalInventario || 0).toLocaleString()}</td>
              </tr>
            </table>
            
            <div class="footer">
              Reporte generado desde App Móvil
            </div>
          </body>
        </html>
      `;

            const { uri } = await Print.printToFileAsync({ html });
            await Sharing.shareAsync(uri);
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'No se pudo generar el PDF');
        }
    };

    return (
        <Modal visible={visible} animationType="slide">
            <View style={styles.container}>
                {/* Header Teal */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.headerTitle}>Reporte de Inventario</Text>
                        <Text style={styles.headerSubtitle}>#{sesion.numeroSesion}</Text>
                    </View>
                    <View style={styles.headerActions}>
                        <TouchableOpacity onPress={handlePrint} style={styles.iconBtn}>
                            <Ionicons name="print-outline" size={24} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
                            <Ionicons name="close-circle-outline" size={28} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>

                <ScrollView contentContainerStyle={styles.content}>
                    <View style={styles.card}>
                        <Text style={styles.labelCenter}>Inventario de Mercancia elaborado por:</Text>
                        <Text style={styles.adminName}>ADMINISTRADOR</Text>

                        <View style={styles.divider} />

                        <Text style={styles.clientName}>{cliente?.nombre || sesion.clienteNegocio?.nombre}</Text>
                        <Text style={styles.clientDetail}>{cliente?.telefono || sesion.clienteNegocio?.telefono}</Text>
                        <Text style={styles.clientDetail}>{cliente?.direccion || sesion.clienteNegocio?.direccion}</Text>

                        <View style={styles.divider} />

                        <Text style={styles.sectionTitle}>Resumen</Text>
                        <View style={styles.row}>
                            <Text>Total Productos:</Text>
                            <Text style={styles.value}>{sesion.totales?.totalProductosContados || 0}</Text>
                        </View>
                        <View style={styles.row}>
                            <Text>Valor Total:</Text>
                            <Text style={styles.valueBold}>${(sesion.totales?.valorTotalInventario || 0).toLocaleString()}</Text>
                        </View>
                    </View>

                    <TouchableOpacity style={styles.printBtn} onPress={handlePrint}>
                        <Text style={styles.printBtnText}>Imprimir / Descargar PDF</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    header: { backgroundColor: '#0f766e', padding: 20, paddingTop: 50, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
    headerSubtitle: { color: '#ccfbf1', fontSize: 14 },
    headerActions: { flexDirection: 'row', gap: 15 },
    iconBtn: { padding: 4 },
    content: { padding: 20 },
    card: { backgroundColor: '#fff', borderRadius: 12, padding: 20, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5, marginBottom: 20 },
    labelCenter: { textAlign: 'center', color: '#666', marginBottom: 5 },
    adminName: { textAlign: 'center', fontSize: 18, fontWeight: 'bold', color: '#333' },
    divider: { height: 1, backgroundColor: '#eee', marginVertical: 15 },
    clientName: { textAlign: 'center', fontSize: 24, fontWeight: 'bold', color: '#0f766e', marginBottom: 5, textTransform: 'uppercase' },
    clientDetail: { textAlign: 'center', color: '#666' },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10, marginTop: 10 },
    row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    value: { fontSize: 16 },
    valueBold: { fontSize: 16, fontWeight: 'bold', color: '#0f766e' },
    printBtn: { backgroundColor: '#0f766e', padding: 15, borderRadius: 10, alignItems: 'center' },
    printBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});

export default ReporteInventarioModal;
