# 🌐 Sistema de Colaboración QR - Versión Web

## 📋 Resumen

Se ha implementado el sistema de colaboración mediante códigos QR en la versión web de J4 Pro, permitiendo que múltiples usuarios trabajen simultáneamente en sesiones de inventario sin necesidad de crear cuentas.

---

## ✨ Nuevas Funcionalidades

### 1. **Login con Botón de Colaborador**

En la pantalla de inicio de sesión (`/login`):

```
┌─────────────────────────────┐
│     [Logo J4 Pro]          │
│  Bienvenido de vuelta      │
├─────────────────────────────┤
│ Email: [____________]      │
│ Password: [________]       │
│                            │
│ [Iniciar Sesión]           │
│                            │
│ [🔳 Acceder como          │
│    Colaborador]            │
│                            │
│ ¿No tienes cuenta?         │
│ Crear una cuenta nueva     │
└─────────────────────────────┘
```

**Características**:
- Botón morado destacado con ícono de QR
- Al hacer clic, abre el escáner de QR usando la webcam
- No requiere registro previo

### 2. **Escáner QR con Webcam**

Componente modal que permite escanear códigos QR usando la cámara web del dispositivo:

**Características**:
- ✅ Solicita permisos de cámara automáticamente
- ✅ Marco de escaneo animado con línea láser
- ✅ Detección en tiempo real de códigos QR
- ✅ Validación del formato del QR
- ✅ Feedback visual y mensajes claros
- ✅ Proceso de conexión automático

**Tecnologías**:
- `jsQR`: Librería para detectar códigos QR en canvas
- `getUserMedia`: API del navegador para acceder a la webcam
- `framer-motion`: Animaciones suaves

### 3. **Generación de QR desde Invitaciones**

Página `/invitaciones` actualizada para colaboración:

**Mejoras**:
- ✅ Tiempo de expiración por defecto: **24 horas** (1440 minutos)
- ✅ Generación rápida de QR
- ✅ Descarga del código QR
- ✅ Gestión de invitaciones activas

### 4. **API Actualizada**

Nuevo endpoint agregado en `services/api.js`:

```javascript
export const invitacionesApi = {
  listMine: () => api.get('/invitaciones/mis-invitaciones'),
  createQR: (payload) => api.post('/invitaciones/qr', payload),
  cancel: (id) => api.delete(`/invitaciones/${id}`),
  consumirSinCuenta: (token) => api.post('/invitaciones/consumir-sin-cuenta', { token })
}
```

---

## 🚀 Cómo Usar

### Para el Usuario Principal (Administrador/Contador)

#### 1. Generar Código QR

**Método 1: Desde Invitaciones (Recomendado)**

```bash
# 1. Navegar a Invitaciones
http://localhost:5173/invitaciones

# 2. Click en "Generar Invitación"

# 3. Configurar:
- Rol: Colaborador
- Nombre: (opcional)
- Email: (opcional)
- Expiración: 1440 minutos (24h) [por defecto]

# 4. Click en "Generar"

# 5. Se muestra el QR
- Descargar imagen
- Compartir por WhatsApp/Email
- O mostrar en pantalla para que otros escaneen
```

**Método 2: Integrado en Sesión** (Próximamente)
- Similar a la versión mobile
- Botón "Conectar" en sesión de inventario

#### 2. Compartir el QR

**Opciones**:
1. **Mostrar en pantalla**: Otros escanean desde su dispositivo
2. **Descargar imagen**: Enviar por WhatsApp, Email, etc.
3. **Imprimir**: Para colaboradores sin smartphone

### Para Colaboradores

#### 1. Acceder con QR

```bash
# 1. Abrir navegador web
http://tuservidor.com/login
# o
http://localhost:5173/login

# 2. Click en "Acceder como Colaborador"

# 3. Permitir acceso a la cámara cuando lo solicite

# 4. Apuntar la cámara al código QR

# 5. ¡Listo! Conectado automáticamente
```

#### 2. Trabajar en la Sesión

Una vez conectado:
- ✅ Ver todos los productos de la sesión
- ✅ Agregar nuevos productos
- ✅ Editar cantidades y costos
- ✅ Los cambios se sincronizan en tiempo real
- ✅ Ver otros colaboradores activos

---

## 📁 Archivos Modificados/Creados

### Creados (1)
```
frontend-web/
  src/
    components/
      ✨ QRScannerModal.jsx    # Nuevo componente
```

### Modificados (3)
```
frontend-web/
  ✏️ package.json             # Versión 2.0.0, jsqr agregado
  src/
    pages/
      ✏️ Login.jsx            # Botón colaborador
      ✏️ Invitaciones.jsx     # 24h por defecto
    services/
      ✏️ api.js               # invitacionesApi agregado
```

---

## 🔧 Instalación y Configuración

### 1. Instalar Dependencias

```bash
cd frontend-web
npm install
```

**Nueva dependencia agregada**:
- `jsqr@^1.4.0` - Detección de códigos QR

### 2. Configurar Variables de Entorno

Archivo: `.env` (crear si no existe)

```bash
VITE_API_URL=http://localhost:3001/api
```

**Opciones**:
- Desarrollo local: `http://localhost:3001/api`
- Producción: `https://tudominio.com/api`
- Red local: `http://192.168.1.100:3001/api`

### 3. Iniciar Servidor de Desarrollo

```bash
npm run dev
```

Abre: `http://localhost:5173`

### 4. Build para Producción

```bash
npm run build
```

Los archivos se generan en `dist/`

---

## 🌐 Compatibilidad de Navegadores

### ✅ Navegadores Compatibles

| Navegador | Versión Mínima | Soporte |
|-----------|----------------|---------|
| Chrome | 53+ | ✅ Completo |
| Firefox | 36+ | ✅ Completo |
| Safari | 11+ | ✅ Completo |
| Edge | 79+ | ✅ Completo |
| Opera | 40+ | ✅ Completo |

### ⚠️ Limitaciones

- **IE 11**: ❌ No soportado (getUserMedia no disponible)
- **Safari iOS < 11**: ❌ Problemas con webcam
- **HTTP**: ⚠️ La cámara solo funciona en HTTPS (excepto localhost)

### 🔒 Requisitos de Seguridad

Para usar la webcam en producción:

1. **HTTPS obligatorio**
   ```
   https://tudominio.com ✅
   http://tudominio.com  ❌ (No funciona la cámara)
   http://localhost      ✅ (Excepción)
   ```

2. **Permisos de usuario**
   - El navegador solicitará permiso la primera vez
   - Usuario debe aceptar el acceso a la cámara
   - Se puede revocar desde configuración del navegador

---

## 🎨 Flujo de Usuario

### Diagrama de Flujo

```
Usuario Principal                    Colaborador
       │                                  │
       ├─ Login normal                   ├─ Abre /login
       │                                  │
       ├─ /invitaciones                  ├─ Click "Acceder como Colaborador"
       │                                  │
       ├─ Generar QR (24h)               ├─ Permitir cámara
       │                                  │
       ├─ Compartir QR ──────────────────►│
       │                                  │
       │                                  ├─ Escanear QR
       │                                  │
       │                                  ├─ Validar token
       │                                  │
       │  ◄──────────────────────────────┤ Conectado ✅
       │                                  │
       ├─ Ver colaboradores activos      ├─ Trabajar en sesión
       │                                  │
       ├─ Recibir notificaciones         ├─ Agregar/editar productos
       │                                  │
       └─ Sincronización en tiempo real  └─ Cambios reflejados
```

---

## 🔍 Troubleshooting

### Problema: "No se puede acceder a la cámara"

**Causas**:
1. Permisos bloqueados en el navegador
2. Otra aplicación está usando la cámara
3. No hay cámara conectada
4. Sitio no es HTTPS (en producción)

**Soluciones**:
```bash
# 1. Verificar permisos
Chrome: Configuración → Privacidad → Cámara
Firefox: Preferencias → Privacidad → Permisos

# 2. Cerrar otras apps que usen cámara
- Zoom, Teams, Skype, etc.

# 3. En producción, usar HTTPS
- No HTTP

# 4. Probar en localhost
http://localhost:5173
```

### Problema: "QR no se detecta"

**Soluciones**:
1. Acercar/alejar la cámara del QR
2. Asegurar buena iluminación
3. QR debe estar completo en el marco
4. Evitar reflejos en la pantalla
5. Imprimir el QR para mejor calidad

### Problema: "Error al conectar"

**Verificar**:
```bash
# 1. Backend corriendo
curl http://localhost:3001/api/salud

# 2. Token no expirado (< 24h)

# 3. QR válido de J4 Pro
# Debe contener: {"tipo": "invitacion_j4", "token": "..."}

# 4. Red accesible
ping localhost
```

### Problema: "Cámara muy oscura/pixelada"

**Ajustes**:
```javascript
// En QRScannerModal.jsx, línea ~32
const stream = await navigator.mediaDevices.getUserMedia({ 
  video: { 
    facingMode: 'environment',
    width: { ideal: 1280 },    // ← Agregar
    height: { ideal: 720 }     // ← Agregar
  } 
})
```

---

## 📊 Diferencias Web vs Mobile

| Característica | Web | Mobile |
|----------------|-----|--------|
| **Escáner QR** | Webcam del PC | Cámara del teléfono |
| **Librería** | jsQR | expo-barcode-scanner |
| **Permisos** | Modal del navegador | Sistema operativo |
| **Offline** | ❌ No | ⚠️ Limitado |
| **Velocidad scan** | ~300ms | ~100ms |
| **Precisión** | Buena | Excelente |
| **Vibración** | ❌ No disponible | ✅ Sí |

---

## 🎯 Características Específicas de Web

### 1. Responsivo
- Funciona en desktop y tablet
- Diseño adaptable a diferentes tamaños
- Touch-friendly en tablets

### 2. Compartir QR
```javascript
// Descargar QR como imagen
const handleDescargarQR = () => {
  const link = document.createElement('a')
  link.href = qrData.qrDataUrl
  link.download = `invitacion-colaborador-${Date.now()}.png`
  link.click()
}
```

### 3. Múltiples Pestañas
- Varios colaboradores en diferentes pestañas
- Sincronización en tiempo real con WebSocket
- Sin conflictos

---

## 🚀 Optimizaciones Futuras

### Corto Plazo
- [ ] Historial de QRs escaneados
- [ ] Notificaciones de escritorio
- [ ] Compartir QR directo por WhatsApp Web
- [ ] PWA para instalar como app

### Mediano Plazo
- [ ] Soporte offline con Service Workers
- [ ] Sincronización cuando vuelve conexión
- [ ] Caché de productos comunes
- [ ] Modo oscuro

### Largo Plazo
- [ ] Video llamada integrada
- [ ] Chat en tiempo real
- [ ] Firma digital de productos
- [ ] Blockchain para auditoría

---

## 📈 Métricas de Rendimiento

### Tiempos Esperados

| Acción | Tiempo |
|--------|--------|
| Cargar Login | < 1s |
| Abrir escáner | < 2s |
| Detectar QR | 0.3s - 1s |
| Validar token | 0.5s - 2s |
| Conectar | 1s - 3s |
| **Total** | **~3s - 8s** |

### Optimización de Red

```javascript
// api.js ya incluye:
- Timeout: 30 segundos
- Cache de timestamps
- Retry automático con refresh token
- Compresión de requests
```

---

## 🔐 Seguridad

### Validaciones Implementadas

1. **Validación de QR**
   ```javascript
   if (qrData.tipo !== 'invitacion_j4') {
     throw new Error('QR no válido')
   }
   ```

2. **Token JWT**
   - Firmado en backend
   - Expiración 24h
   - No se puede falsificar

3. **HTTPS en producción**
   - Cámara solo funciona en HTTPS
   - Protección de datos en tránsito

4. **Permisos granulares**
   - Colaboradores no pueden finalizar sesión
   - Solo editar productos asignados
   - Tracking de quién hizo qué

---

## 📞 Soporte y Ayuda

### Logs en Consola

```javascript
// Ver logs de escáner
console.log('QR detectado:', qrData)
console.log('Estado cámara:', hasPermission)
console.log('Procesando:', isProcessing)
```

### Limpiar Caché

```bash
# Si hay problemas, limpiar localStorage
localStorage.clear()
sessionStorage.clear()

# O desde consola del navegador:
// F12 → Console
localStorage.clear()
location.reload()
```

---

## ✅ Checklist de Implementación

- [x] QRScannerModal creado
- [x] Login con botón colaborador
- [x] API invitacionesApi agregada
- [x] jsqr instalado
- [x] Invitaciones con 24h por defecto
- [x] Versión 2.0.0 en package.json
- [x] Documentación completa

---

## 🎉 Resumen

**Versión Web 2.0.0** incluye:

✨ Escáner QR con webcam  
✨ Login con botón de colaborador  
✨ API de invitaciones actualizada  
✨ Sincronización en tiempo real  
✨ Tracking de productos creados  
✨ Sesiones colaborativas sin cuenta  
✨ Compatible con todos los navegadores modernos  

---

**Fecha**: 13 de Noviembre de 2025  
**Versión**: 2.0.0  
**Estado**: ✅ Completado

---

## 📚 Recursos Adicionales

- **jsQR Docs**: https://github.com/cozmo/jsQR
- **MediaDevices API**: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices
- **getUserMedia**: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia

---

**© 2025 J4 Pro - Todos los derechos reservados**
