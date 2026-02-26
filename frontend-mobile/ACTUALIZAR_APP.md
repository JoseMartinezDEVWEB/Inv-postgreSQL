# 📲 Guía para Actualizar la App Móvil

## 🎯 Versión Actualizada: 2.0.0

Esta guía te ayudará a generar un nuevo instalador con las funciones de colaboración QR.

---

## ✅ Paso 1: Verificar que Todo Esté Listo

Antes de compilar, asegúrate de:

```bash
# 1. Estar en la carpeta correcta
cd c:\Users\ASUS\Desktop\new-appj4\frontend-mobile

# 2. Verificar que las dependencias estén instaladas
npm install

# 3. Verificar versión actualizada
# Debe mostrar version: "2.0.0" y versionCode: 2
```

---

## 🚀 Opción 1: Build con EAS (RECOMENDADO)

### Para APK de Producción

```bash
# 1. Iniciar sesión en EAS (si no lo has hecho)
npx eas login

# 2. Generar APK de producción
npx eas build --platform android --profile production

# Esto tomará entre 5-15 minutos
# Al finalizar, recibirás un link para descargar el APK
```

**Resultado**:
- ✅ APK optimizado y firmado
- ✅ Tamaño reducido (~40-60 MB)
- ✅ Listo para producción
- ✅ Link de descarga: `https://expo.dev/accounts/.../*.apk`

### Para APK de Prueba Rápida

```bash
# APK más rápido pero más pesado
npx eas build --platform android --profile preview
```

---

## 💻 Opción 2: Build Local (Más Rápido, Requiere Android Studio)

Si tienes Android Studio configurado:

```bash
# 1. Instalar herramientas de Expo
npm install -g @expo/ngrok

# 2. Generar APK localmente
npx expo run:android --variant release

# El APK se generará en:
# android/app/build/outputs/apk/release/app-release.apk
```

**Ventaja**: Más rápido (2-5 minutos)  
**Desventaja**: Requiere Android Studio instalado

---

## 📱 Paso 2: Instalar la Nueva Versión en el Dispositivo

### Método A: Desde Link de EAS

1. **Recibe el link por email o cópialo de la terminal**
   ```
   https://expo.dev/artifacts/eas/abc123.../builds/xyz789.../app.apk
   ```

2. **Abre el link en el dispositivo**
   - Desde el navegador del teléfono
   - O escanea el QR que aparece en terminal

3. **Instala el APK**
   - Permitir instalar desde fuentes desconocidas
   - Presionar "Instalar"
   - Android detectará que es una actualización

### Método B: Por Cable USB

1. **Conectar dispositivo por USB**
   ```bash
   # Verificar que el dispositivo esté conectado
   adb devices
   ```

2. **Copiar APK al dispositivo**
   ```bash
   # Si usaste EAS, primero descarga el APK
   # Luego:
   adb install -r ruta/al/nuevo.apk
   
   # -r = reemplazar versión anterior
   ```

3. **Listo**
   - La app se actualizará automáticamente

### Método C: Compartir por WhatsApp/Drive

1. **Descargar el APK**
   - Desde el link de EAS

2. **Subir a Google Drive o enviar por WhatsApp**
   - Compartir con los dispositivos que necesitan actualizar

3. **En cada dispositivo**:
   - Descargar el APK
   - Permitir instalar desde fuentes desconocidas
   - Instalar
   - Android reconocerá que es una actualización

---

## 🔧 Configurar URL del Backend

**IMPORTANTE**: Antes de compilar, verifica la URL de tu backend en `eas.json`:

```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_API_URL": "http://192.168.1.100:3001/api"
        // ☝️ CAMBIAR ESTA IP por la de tu servidor
      }
    }
  }
}
```

### Opciones de URL:

1. **Servidor Local (misma red WiFi)**:
   ```
   EXPO_PUBLIC_API_URL: "http://192.168.1.100:3001/api"
   ```
   - Reemplaza `192.168.1.100` con la IP de tu PC
   - Encontrar IP: `ipconfig` (Windows) o `ifconfig` (Mac/Linux)

2. **Servidor en Internet**:
   ```
   EXPO_PUBLIC_API_URL: "https://tudominio.com/api"
   ```

3. **Servidor Local con Ngrok** (para pruebas):
   ```bash
   # En la carpeta backend
   ngrok http 3001
   
   # Copia la URL que da ngrok:
   EXPO_PUBLIC_API_URL: "https://abc123.ngrok.io/api"
   ```

---

## 📋 Checklist Pre-Build

Antes de generar el APK, verifica:

- [ ] ✅ `app.json` tiene version "2.0.0"
- [ ] ✅ `app.json` tiene versionCode 2
- [ ] ✅ URL del backend correcta en `eas.json`
- [ ] ✅ Todos los archivos guardados
- [ ] ✅ `npm install` ejecutado sin errores
- [ ] ✅ Backend corriendo y accesible

---

## 🎬 Comandos Completos (Copy & Paste)

### Build de Producción con EAS

```powershell
# 1. Navegar a la carpeta
cd c:\Users\ASUS\Desktop\new-appj4\frontend-mobile

# 2. Login en EAS (solo primera vez)
npx eas login

# 3. Build
npx eas build --platform android --profile production

# 4. Esperar a que termine (5-15 min)

# 5. Descargar APK del link que te dan
# https://expo.dev/artifacts/...

# 6. Instalar en dispositivo
# Opción A: Abrir link en el teléfono
# Opción B: adb install -r nuevo.apk
```

### Build Rápido para Pruebas

```powershell
cd c:\Users\ASUS\Desktop\new-appj4\frontend-mobile
npx eas build --platform android --profile preview --non-interactive
```

---

## 🔄 Diferencias Entre Versiones

### Versión Anterior (1.0.0)
- Login básico
- Sesiones de inventario
- Agregar productos manualmente

### Nueva Versión (2.0.0) ✨
- ✅ **Botón "Acceder como Colaborador"** en login
- ✅ **Escáner QR** para conectar sin cuenta
- ✅ **Generación de QR** en sesión de inventario
- ✅ **Colaboración en tiempo real** con múltiples dispositivos
- ✅ **Notificaciones** cuando colaboradores se conectan
- ✅ **Tracking de productos** (quién creó qué)
- ✅ **Lista de colaboradores activos**
- ✅ Iconos actualizados
- ✅ UI mejorada

---

## ❓ Preguntas Frecuentes

### ¿La actualización borrará mis datos?
**No**. Los datos están en el backend, no en la app. Al actualizar, los datos se mantienen.

### ¿Necesito desinstalar la versión anterior?
**No**. Android detectará que es una actualización y la instalará sobre la anterior.

### ¿Todos los dispositivos deben actualizar?
**Sí**, para usar las funciones de colaboración QR, todos deben tener la versión 2.0.0.

### ¿Puedo seguir usando la app vieja mientras actualizo?
Sí, pero no tendrás las nuevas funciones de colaboración.

### ¿Cuánto tarda el build?
- **EAS**: 5-15 minutos
- **Local**: 2-5 minutos (requiere Android Studio)

### ¿Cuánto pesa el APK?
- **Producción (optimizado)**: 40-60 MB
- **Preview**: 60-80 MB

---

## 🐛 Solución de Problemas

### Error: "eas command not found"
```bash
npm install -g eas-cli
```

### Error: "No credentials configured"
```bash
npx eas login
# Ingresa tu email y contraseña de Expo
```

### Error: "Build failed"
```bash
# Limpiar cache y reintentar
npx eas build:cancel
npx eas build --platform android --profile production --clear-cache
```

### Error al instalar: "App not installed"
```bash
# Desinstalar versión anterior manualmente
adb uninstall com.j4pro.gestorinventario

# Luego instalar nueva
adb install nuevo.apk
```

### APK muy pesado (>100 MB)
```bash
# Usar perfil de producción en vez de preview
npx eas build --platform android --profile production
```

---

## 📊 Verificar la Actualización

Después de instalar, verifica:

1. **Abrir la app**
2. **Verificar versión**:
   - En "Acerca de" o "Configuración"
   - Debe decir "Versión 2.0.0"

3. **Probar nuevas funciones**:
   - [ ] En login, hay botón "Acceder como Colaborador"
   - [ ] Logo actualizado en splash screen
   - [ ] Sin texto "J4 Pro" duplicado
   - [ ] En sesión, botón "Conectar" genera QR

---

## 🎯 Resumen Rápido

```bash
# 1. Actualizar versiones (YA HECHO ✅)
# version: "2.0.0"
# versionCode: 2

# 2. Build
cd frontend-mobile
npx eas build --platform android --profile production

# 3. Esperar link de descarga

# 4. Instalar en dispositivo
# - Abrir link en teléfono, o
# - adb install -r nuevo.apk

# 5. ¡Listo! 🎉
```

---

## 📞 Soporte Adicional

Si tienes problemas:
1. Revisar logs de EAS: `npx eas build:list`
2. Verificar configuración: `cat app.json`
3. Probar build local si EAS falla
4. Verificar que backend esté accesible desde red

---

**Versión de esta guía**: 2.0.0  
**Fecha**: 13 de Noviembre de 2025  
**Autor**: Sistema J4 Pro
