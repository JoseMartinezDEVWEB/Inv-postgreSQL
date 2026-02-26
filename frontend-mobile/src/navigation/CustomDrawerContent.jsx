import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const CustomDrawerContent = (props) => {
  const { user, logout } = useAuth();

  return (
    <LinearGradient colors={['#1e3a8a', '#1e40af', '#1d4ed8']} style={styles.container}>
      <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: 0 }}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.nombre?.charAt(0)?.toUpperCase()}</Text>
          </View>
          <Text style={styles.userName}>{user?.nombre}</Text>
          <Text style={styles.userRole}>{user?.rol}</Text>
        </View>

        <View style={styles.drawerItemsContainer}>
          <DrawerItemList {...props} />
        </View>
      </DrawerContentScrollView>

      <TouchableOpacity style={styles.footer} onPress={logout}>
        <Ionicons name="log-out-outline" size={22} color="#9ca3af" />
        <Text style={styles.footerText}>Cerrar Sesión</Text>
      </TouchableOpacity>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#3b82f6',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e3a8a',
  },
  userName: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  userRole: {
    color: '#93c5fd',
    fontSize: 14,
    textTransform: 'capitalize',
  },
  drawerItemsContainer: {
    backgroundColor: '#fff',
    paddingTop: 10,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#3b82f6',
    backgroundColor: '#1e3a8a',
  },
  footerText: {
    marginLeft: 15,
    color: '#9ca3af',
    fontSize: 15,
    fontWeight: '500',
  },
});

export default CustomDrawerContent;
