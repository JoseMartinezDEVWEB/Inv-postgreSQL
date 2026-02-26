import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import InventariosScreen from '../screens/InventariosScreen';
import InventarioDetalleScreen from '../screens/InventarioDetalleScreen';

const Stack = createStackNavigator();

const InventarioStackNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="InventariosList" component={InventariosScreen} />
      <Stack.Screen name="InventarioDetalle" component={InventarioDetalleScreen} />
    </Stack.Navigator>
  );
};

export default InventarioStackNavigator;
