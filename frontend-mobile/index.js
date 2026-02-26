// Punto de entrada para React Native
// Este archivo es necesario para generar el bundle de produccion
import 'expo/build/Expo.fx';
import { registerRootComponent } from 'expo';
import App from './App';

// registerRootComponent llama a AppRegistry.registerComponent('main', () => App);
// Tambien asegura que el entorno de Expo este configurado correctamente
registerRootComponent(App);








