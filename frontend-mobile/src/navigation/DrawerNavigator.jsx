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
      {hasPermission('clients') && (
        <Drawer.Screen
          name="Clientes"
          component={ClientesScreen}
          options={{
            title: 'Clientes',
            drawerIcon: ({ color, size }) => (
              <Ionicons name="people-outline" size={size} color={color} />
            ),
          }}
        />
      )}
      {hasPermission('inventory') && (
        <Drawer.Screen
          name="Inventarios"
          component={InventarioStackNavigator}
          options={{
            title: 'Inventarios',
            drawerIcon: ({ color, size }) => (
              <Ionicons name="cart-outline" size={size} color={color} />
            ),
          }}
        />
      )}
      {hasPermission('products') && (
        <Drawer.Screen
          name="ProductosGenerales"
          component={ProductosGeneralesScreen}
          options={{
            title: 'Productos',
            drawerIcon: ({ color, size }) => (
              <Ionicons name="cube-outline" size={size} color={color} />
            ),
          }}
        />
      )}
      {hasPermission('reports') && (
        <Drawer.Screen
          name="Agenda"
          component={AgendaScreen}
          options={{
            title: 'Agenda',
            drawerIcon: ({ color, size }) => (
              <Ionicons name="calendar-outline" size={size} color={color} />
            ),
          }}
        />
      )}
      {hasPermission('all') && ( // Solo Administrador
        <Drawer.Screen
          name="Usuarios"
          component={UsuariosScreen}
          options={{
            title: 'Usuarios',
            drawerIcon: ({ color, size }) => (
              <Ionicons name="people-circle-outline" size={size} color={color} />
            ),
          }}
        />
      )}
      {hasPermission('inventory') && (
        <>
          <Drawer.Screen
            name="Invitaciones"
            component={InvitacionesScreen}
            options={{
              title: 'Invitaciones',
              drawerIcon: ({ color, size }) => (
                <Ionicons name="qr-code-outline" size={size} color={color} />
              ),
            }}
          />
          <Drawer.Screen
            name="RecepcionBLE"
            component={RecepcionBLEScreen}
            options={{
              title: 'Recibir por Bluetooth',
              drawerIcon: ({ color, size }) => (
                <Ionicons name="bluetooth" size={size} color={color} />
              ),
            }}
          />
        </>
      )}
    </Drawer.Navigator>
  );
};

export default DrawerNavigator;
