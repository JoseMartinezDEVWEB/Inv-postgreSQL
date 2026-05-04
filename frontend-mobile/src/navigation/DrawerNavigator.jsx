import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';

// Screens
import DashboardScreen from '../screens/DashboardScreen';
import ClientesScreen from '../screens/ClientesScreen';
import InventarioStackNavigator from './InventarioStackNavigator';
import ProductosGeneralesScreen from '../screens/ProductosGeneralesScreen';
import AgendaScreen from '../screens/AgendaScreen';
import UsuariosScreen from '../screens/UsuariosScreen';
import InvitacionesScreen from '../screens/InvitacionesScreen';
import RecepcionBLEScreen from '../screens/RecepcionBLEScreen';
import colors from '../theme/colors';
import { useAuth } from '../context/AuthContext';

// Custom Drawer Content
import CustomDrawerContent from './CustomDrawerContent';
import SyncStatusIndicator from '../components/SyncStatusIndicator';

const Drawer = createDrawerNavigator();

/**
 * Helper: devuelve drawerItemStyle que oculta el item si no tiene permiso.
 * React Navigation requiere que TODOS los screens estén siempre montados;
 * renderizar <Screen> condicionalmente causa pantallas en blanco y crashes.
 */
const getScreenStyle = (hasPermission) => ({
  drawerItemStyle: hasPermission ? {} : { display: 'none', height: 0 },
});

const DrawerNavigator = () => {
  const { hasPermission } = useAuth();

  const screenOptions = {
    headerStyle: {
      backgroundColor: colors.primary[800],
    },
    headerTintColor: '#fff',
    headerTitleStyle: {
      fontWeight: 'bold',
    },
    headerRight: () => <SyncStatusIndicator />,
    drawerActiveBackgroundColor: '#e0e7ff',
    drawerActiveTintColor: colors.primary[800],
    drawerInactiveTintColor: '#374151',
    drawerLabelStyle: {
      marginLeft: -20,
      fontSize: 15,
    },
  };

  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={screenOptions}
    >
      {/* Dashboard: visible para todos los roles autenticados */}
      <Drawer.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: 'Dashboard',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />

      {/* Clientes: solo roles con permiso 'clients' */}
      <Drawer.Screen
        name="Clientes"
        component={ClientesScreen}
        options={{
          ...getScreenStyle(hasPermission('clients')),
          title: 'Clientes',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />

      {/* Inventarios: roles con permiso 'inventory' (incluye colaborador) */}
      <Drawer.Screen
        name="Inventarios"
        component={InventarioStackNavigator}
        options={{
          ...getScreenStyle(hasPermission('inventory')),
          title: 'Inventarios',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="cart-outline" size={size} color={color} />
          ),
        }}
      />

      {/* Productos Generales: roles con permiso 'products' */}
      <Drawer.Screen
        name="ProductosGenerales"
        component={ProductosGeneralesScreen}
        options={{
          ...getScreenStyle(hasPermission('products')),
          title: 'Productos',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="cube-outline" size={size} color={color} />
          ),
        }}
      />

      {/* Agenda: roles con permiso 'reports' */}
      <Drawer.Screen
        name="Agenda"
        component={AgendaScreen}
        options={{
          ...getScreenStyle(hasPermission('reports')),
          title: 'Agenda',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />

      {/* Usuarios: solo Administrador (permiso 'all') */}
      <Drawer.Screen
        name="Usuarios"
        component={UsuariosScreen}
        options={{
          ...getScreenStyle(hasPermission('all')),
          title: 'Usuarios',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="people-circle-outline" size={size} color={color} />
          ),
        }}
      />

      {/* Invitaciones: roles con permiso 'inventory' */}
      <Drawer.Screen
        name="Invitaciones"
        component={InvitacionesScreen}
        options={{
          ...getScreenStyle(hasPermission('inventory')),
          title: 'Invitaciones',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="qr-code-outline" size={size} color={color} />
          ),
        }}
      />

      {/* Recepción BLE: roles con permiso 'inventory' */}
      <Drawer.Screen
        name="RecepcionBLE"
        component={RecepcionBLEScreen}
        options={{
          ...getScreenStyle(hasPermission('inventory')),
          title: 'Recibir por Bluetooth',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="bluetooth" size={size} color={color} />
          ),
        }}
      />
    </Drawer.Navigator>
  );
};

export default DrawerNavigator;
