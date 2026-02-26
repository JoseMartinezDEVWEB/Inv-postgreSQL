# 📴 Modo Offline - Gestor de Inventario J4 Pro

## ¿Qué es el Modo Offline?

La versión **Offline** de la app funciona **completamente sin conexión a internet**. Todos los datos se almacenan localmente en el dispositivo usando SQLite.

## Características del Modo Offline

✅ **No requiere internet** - Funciona 100% sin conexión  
✅ **Base de datos local** - SQLite integrado en el dispositivo  
✅ **Login automático** - Sin validación remota  
✅ **Datos persistentes** - La información se guarda en tu dispositivo  
✅ **Independiente** - No depende de servidores externos

## ¿Cuándo usar Modo Offline?

- ✅ Trabajar en zonas sin internet
- ✅ Inventarios en almacenes remotos
- ✅ Evitar costos de datos móviles
- ✅ Máxima privacidad (datos solo en tu dispositivo)
- ✅ Uso personal/local sin necesidad de sincronización

## ¿Cuándo NO usar Modo Offline?

- ❌ Necesitas colaboración en tiempo real con otros usuarios
- ❌ Requieres sincronización entre dispositivos
- ❌ Quieres respaldos automáticos en la nube
- ❌ Necesitas acceder desde múltiples dispositivos

## Generar APK Offline

### Usando el script automatizado:

```bash
cd frontend-mobile
build-apk.bat
# Seleccionar opción 2: OFFLINE
```

### Comando directo:

```bash
cd frontend-mobile
npm run build:production-local
```

## Login en Modo Offline

- **Email**: Cualquier texto (no se valida)
- **Password**: Cualquier texto (no se valida)

El sistema te loguea automáticamente como "Usuario Offline" con permisos de administrador.

## Limitaciones

⚠️ **Sin sincronización**: Los datos NO se sincronizan con otros dispositivos  
⚠️ **Sin respaldo automático**: Debes hacer respaldos manuales  
⚠️ **Sin colaboración**: No puedes trabajar con otros usuarios en tiempo real  
⚠️ **Datos locales únicamente**: Si desinstalas la app, pierdes los datos

## Respaldos Manuales

Para respaldar tus datos:

1. Ir a **Configuración** en la app
2. Seleccionar **Exportar datos**
3. Guardar el archivo generado en lugar seguro

Para restaurar:

1. Ir a **Configuración**
2. Seleccionar **Importar datos**
3. Elegir el archivo de respaldo

## Migración de Offline a Cloud

Si inicialmente usas la versión offline y luego quieres migrar a la nube:

1. Exportar datos desde la app offline
2. Instalar la versión Cloud (Opción 1 o 4)
3. Crear cuenta en la nube
4. Importar los datos exportados

## Comparación: Offline vs Cloud

| Característica | Modo Offline | Modo Cloud |
|----------------|--------------|------------|
| Internet requerido | ❌ No | ✅ Sí |
| Colaboración | ❌ No | ✅ Sí |
| Sincronización | ❌ No | ✅ Sí |
| Múltiples dispositivos | ❌ No | ✅ Sí |
| Respaldo automático | ❌ No | ✅ Sí |
| Privacidad máxima | ✅ Sí | ⚠️ Moderada |
| Costo de datos | 💰 Gratis | 💰 Consume datos |
| Velocidad | ⚡ Muy rápida | 🌐 Depende de internet |

## Soporte Técnico

Para problemas con el modo offline:

1. Verificar que instalaste la versión correcta (production-local)
2. Revisar permisos de almacenamiento en Android
3. Asegurar espacio disponible en el dispositivo
4. Reinstalar la app si hay problemas persistentes

---

**Versión recomendada**: Si tienes internet estable, usa la versión Cloud para mejor colaboración y respaldos automáticos.








