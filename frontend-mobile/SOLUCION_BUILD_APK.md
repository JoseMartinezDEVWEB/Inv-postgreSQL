# Solución al Error de Build APK

## Problema Identificado

El build falló porque hay un directorio `android` nativo que tiene conflictos en la configuración de Gradle. Esto ocurre cuando se usa un proyecto "bare workflow" de Expo con código nativo.

## Errores Encontrados

1. **Conflicto de Package ID**: 
   - `app.json` tenía: `com.j4pro.gestor_inventario`
   - `android/app/build.gradle` tenía: `com.gestordeinventarioj4pro`
   - ✅ **CORREGIDO**: Ahora ambos usan `com.gestordeinventarioj4pro`

2. **Gradle Build Failed**: Error desconocido en la fase "Run gradlew"

## Soluciones Aplicadas

### 1. Sincronización de Package ID
- Actualizado `app.json` para usar el mismo package que el código nativo
- Agregado permiso `CAMERA` necesario para el escáner QR

### 2. Configuración Mejorada de EAS
- Agregados comandos Gradle específicos
- Configurado caché para builds más rápidos
- Especificada imagen `latest` para el build

## Opciones para Generar el APK

### Opción A: Build con Preview Profile (Recomendado)

```bash
eas build --platform android --profile preview
```

**Ventajas**:
- Más rápido que production
- Usa configuración optimizada
- Genera APK instalable

### Opción B: Limpiar y Rebuildar

Si el build sigue fallando, necesitas limpiar el caché:

```bash
# Limpiar node_modules y reinstalar
cd frontend-mobile
rm -rf node_modules
npm install

# Limpiar caché de Expo
npx expo start --clear

# Intentar build nuevamente
eas build --platform android --profile preview --clear-cache
```

### Opción C: Build Local (Si tienes Android Studio)

Si tienes Android Studio instalado y configurado:

```bash
cd android
./gradlew clean
./gradlew assembleRelease
```

El APK estará en: `android/app/build/outputs/apk/release/app-release.apk`

## Verificar el Error en los Logs

El error exacto se puede ver en:
https://expo.dev/accounts/jose1919/projects/gestor-inventario-j4-pro/builds/5d9bbb46-b723-44c5-be51-c7b00729f4dd#run-gradlew

Busca en los logs:
- Errores de compilación de Java/Kotlin
- Problemas con dependencias
- Errores de memoria

## Alternativa: Build sin Código Nativo

Si el problema persiste, podemos eliminar el directorio `android` temporalmente para usar managed workflow:

```bash
# Renombrar directorio android
mv android android.backup

# Limpiar configuración
rm -rf .expo node_modules
npm install

# Build con managed workflow
eas build --platform android --profile preview
```

## Configuración del Backend

⚠️ **Importante**: Recuerda configurar la URL correcta del backend antes del build.

Para build de **preview** (red local):
1. Obtén tu IP local: `ipconfig` o `ip addr`
2. Edita `eas.json` línea 24:
   ```json
   "EXPO_PUBLIC_API_URL": "http://TU_IP_LOCAL:3001/api"
   ```

Ejemplo con IP 192.168.1.150:
```json
"EXPO_PUBLIC_API_URL": "http://192.168.1.150:3001/api"
```

## Próximos Pasos

1. **Verifica tu IP local**:
   ```bash
   ipconfig
   ```

2. **Actualiza eas.json** con tu IP real

3. **Ejecuta el build**:
   ```bash
   eas build --platform android --profile preview
   ```

4. **Monitorea el progreso** en:
   - Terminal (muestra progreso en tiempo real)
   - https://expo.dev/accounts/jose1919/projects/gestor-inventario-j4-pro/builds

5. **Descarga el APK** cuando esté listo

## Si el Build Sigue Fallando

Comparte los logs del build para un diagnóstico más específico. Los errores comunes incluyen:

- **OutOfMemoryError**: Aumentar memoria en `gradle.properties`
- **Dependency conflict**: Actualizar versiones en `package.json`
- **NDK error**: Verificar versión de NDK en `build.gradle`
- **Hermes error**: Deshabilitar Hermes temporalmente

## Soporte

Si necesitas ayuda adicional:
1. Copia el output completo del error
2. Revisa los logs en el dashboard de Expo
3. Verifica que todas las dependencias estén instaladas correctamente
