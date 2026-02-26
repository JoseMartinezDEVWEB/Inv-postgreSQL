# Instrucciones para Generar APK - Gestor de Inventario J4 Pro

## Requisitos Previos

1. **Node.js** instalado (v18 o superior)
2. **Cuenta de Expo** (gratuita) - [https://expo.dev/signup](https://expo.dev/signup)
3. **EAS CLI** instalado globalmente:
   ```bash
   npm install -g eas-cli
   ```

## Configuración del Backend

Antes de generar el APK, debes configurar la URL del servidor backend.

### Opción 1: Servidor Local en tu Red

Si tu backend está en tu computadora local:

1. Obtén tu dirección IP local:
   ```bash
   ipconfig
   ```
   Busca la dirección IPv4 (ej: 192.168.1.100)

2. Edita `eas.json` y reemplaza `192.168.1.100` con tu IP:
   ```json
   "EXPO_PUBLIC_API_URL": "http://TU_IP_LOCAL:3001/api"
   ```

3. Asegúrate de que el backend esté corriendo:
   ```bash
   cd ../backend
   npm run dev
   ```

### Opción 2: Servidor en la Nube

Si tienes el backend desplegado en un servidor:

1. Edita `eas.json` y usa la URL del servidor:
   ```json
   "EXPO_PUBLIC_API_URL": "https://tu-dominio.com/api"
   ```

## Pasos para Generar el APK

### 1. Instalar Dependencias

```bash
cd frontend-mobile
npm install
```

### 2. Iniciar Sesión en Expo

```bash
eas login
```

Ingresa tus credenciales de Expo.

### 3. Configurar el Proyecto (primera vez)

```bash
eas build:configure
```

### 4. Generar el APK

Para build de **producción** (recomendado para distribución):

```bash
eas build --platform android --profile production
```

Para build de **preview** (testing interno):

```bash
eas build --platform android --profile preview
```

Para build de **development** (debugging):

```bash
eas build --platform android --profile development
```

### 5. Esperar el Build

El proceso toma aproximadamente 10-20 minutos. EAS te mostrará:
- Progreso en tiempo real
- URL para ver el estado del build
- Link de descarga cuando esté listo

### 6. Descargar el APK

Una vez completado, puedes:

1. Descargar desde el link proporcionado en la terminal
2. O visitar [https://expo.dev/accounts/tu-usuario/projects/gestor-inventario-j4-pro/builds](https://expo.dev/accounts/tu-usuario/projects/gestor-inventario-j4-pro/builds)

## Instalación en Dispositivos Android

1. **Transferir el APK** al dispositivo:
   - USB
   - Email
   - Google Drive
   - AirDrop (si el dispositivo lo soporta)

2. **Habilitar instalación de origen desconocido**:
   - Configuración > Seguridad > Orígenes desconocidos (Android < 8)
   - Configuración > Apps > Acceso especial > Instalar apps desconocidas (Android 8+)

3. **Instalar el APK**:
   - Abrir el archivo APK
   - Seguir las instrucciones en pantalla
   - Aceptar permisos

## Perfiles de Build Disponibles

### `development`
- Para debugging
- Incluye herramientas de desarrollo
- Apunta a: `http://10.0.2.2:3001/api` (emulador)

### `preview`
- Para testing interno
- Build optimizado
- Apunta a: `http://192.168.1.100:3001/api` (configurable)

### `production`
- Para distribución final
- APK optimizado y comprimido
- Apunta a: `http://192.168.1.100:3001/api` (configurable)

### `production-aab`
- Para Google Play Store
- Genera App Bundle en lugar de APK
- Optimización automática por dispositivo

## Solución de Problemas

### Error: "Invalid Credentials"
```bash
eas logout
eas login
```

### Error: "Project not configured"
```bash
eas build:configure
```

### Error: "Build failed"
- Verifica que todas las dependencias estén instaladas
- Revisa los logs en la URL proporcionada
- Asegúrate que app.json esté correctamente configurado

### La app no se conecta al backend
1. Verifica que el backend esté corriendo
2. Comprueba que la URL en `eas.json` sea correcta
3. Verifica que el firewall permita conexiones al puerto 3001
4. Si usas IP local, asegúrate de estar en la misma red

## Actualizar la App

Para generar una nueva versión:

1. Actualiza la versión en `app.json`:
   ```json
   "version": "1.0.1"
   ```

2. Genera un nuevo build:
   ```bash
   eas build --platform android --profile production
   ```

3. Distribuye el nuevo APK

## Distribución

### Distribución Interna
- Comparte el APK directamente
- Usa servicios como Firebase App Distribution

### Google Play Store
1. Genera App Bundle:
   ```bash
   eas build --platform android --profile production-aab
   ```
2. Sube el AAB a Google Play Console
3. Completa la información de la app
4. Envía para revisión

## URLs Importantes

- **Expo Dashboard**: https://expo.dev
- **Documentación EAS Build**: https://docs.expo.dev/build/introduction/
- **Estado de Builds**: https://expo.dev/accounts/[tu-usuario]/projects/gestor-inventario-j4-pro/builds

## Notas Importantes

1. **Primera vez**: El primer build puede tomar más tiempo
2. **Límites gratuitos**: Expo ofrece builds gratuitos con límites mensuales
3. **Caché**: Los builds siguientes son más rápidos gracias al caché
4. **Internet**: Necesitas una conexión estable durante el build
5. **MongoDB**: Asegúrate que la base de datos esté accesible para el backend
