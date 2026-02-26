# Cómo instalar la APK de desarrollo en Android

## Problema: Google Play Protect bloquea la instalación

Cuando instalas una APK de desarrollo (no publicada en Play Store), Google Play Protect puede mostrar:
- "Se bloqueó la app dañina"
- "Es posible que esta app sea dañina"

**Esto es un FALSO POSITIVO** - tu app no es dañina, simplemente no está verificada por Google.

## Solución 1: Instalar desde el diálogo de bloqueo

1. Cuando aparezca el diálogo "Se bloqueó la app dañina"
2. Toca **"Más detalles"**
3. Busca y toca **"Instalar de todos modos"** o **"Instalar sin analizar"**
4. Confirma la instalación

## Solución 2: Desactivar Play Protect temporalmente

### Pasos:
1. Abre **Google Play Store**
2. Toca tu **foto de perfil** (arriba a la derecha)
3. Selecciona **"Play Protect"**
4. Toca el **ícono de engranaje** (configuración)
5. **Desactiva** "Analizar apps con Play Protect"
6. Instala tu APK
7. **IMPORTANTE**: Vuelve a activar Play Protect después de instalar

## Solución 3: Instalar via ADB (desarrolladores)

```bash
# Conectar el dispositivo por USB con depuración USB activada
adb install -r ruta/a/tu/app.apk
```

## ¿Por qué pasa esto?

Google Play Protect marca como potencialmente dañinas las apps que:
- No están publicadas en Play Store
- No están firmadas con una clave de producción verificada
- Solicitan permisos sensibles (cámara, bluetooth, ubicación, etc.)
- Son APKs de desarrollo/debug

## Para distribución final

Si vas a distribuir la app a usuarios finales, considera:
1. **Publicar en Google Play Store** (elimina este problema completamente)
2. **Usar firma de producción** con un keystore dedicado
3. **Distribuir via Firebase App Distribution** (tiene mejor soporte)

---
**Nota**: Este mensaje NO significa que tu app tenga malware. Es simplemente una medida de seguridad de Google para apps no verificadas.
