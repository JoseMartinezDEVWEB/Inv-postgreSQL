# 📱 Instrucciones de Configuración - App Mobile J4 Pro

## 🔧 Problema Resuelto

El error `Use process(css).then(cb) to work with async plugins` ha sido corregido actualizando la configuración de Metro bundler para excluir archivos CSS y PostCSS que causan conflictos con React Native.

## ✅ Cambios Realizados

### 1. **Actualización de Metro Config** (`metro.config.js`)
- Se excluyeron archivos CSS/SCSS/SASS del bundler
- Se optimizó la configuración para React Native

### 2. **Corrección de URLs de Backend** 
- **WebSocket**: Ahora usa la URL correcta `http://192.168.1.10:3001` en lugar de `localhost`
- **API**: Configuración consistente con la misma URL

### 3. **Mejora de Estructura App.jsx**
- Integración correcta con `AuthProvider` existente
- Flujo de navegación bien definido para autenticados/no autenticados
- Soporte para todas las pantallas

---

## 🚀 Pasos para Ejecutar la App

### Requisito 1: Backend debe estar funcionando

```bash
# En la carpeta backend/
npm install
npm run dev
```

✅ Verificar que el backend esté corriendo en:
- **Puerto**: 3001
- **URL**: http://192.168.1.10:3001/api
- **WebSocket**: http://192.168.1.10:3001

### Requisito 2: MongoDB debe estar corriendo

```bash
# MongoDB debe estar en: mongodb://localhost:27017
# O usa MongoDB Atlas si está configurado en las variables de entorno
```

### Paso 1: Instalar dependencias

```bash
cd frontend-mobile
npm install
```

### Paso 2: Limpiar cachés (si hay errores)

```bash
npx expo start --clear
```

### Paso 3: Ejecutar en Android

```bash
npx expo start --android
```

O en iOS:
```bash
npx expo start --ios
```

---

## 🔍 Verificación de Conexión

### Ver logs de la app:
Después de que se abra la app en el emulador/dispositivo, deberías ver en la consola:

```
🔧 Configuración de API:
   URL Base: http://192.168.1.10:3001/api

🔌 Intentando conectar a: http://192.168.1.10:3001
✅ Conectado al servidor WebSocket
```

### Si hay problemas de conexión:

1. **Verificar que el backend está corriendo:**
   ```bash
   curl http://192.168.1.10:3001/api/salud
   # Deberías obtener: {"exito": true, "mensaje": "Backend funcionando"}
   ```

2. **Verificar que puedes acceder desde el emulador Android:**
   ```bash
   adb shell ping 192.168.1.10
   ```

3. **Si tienes problemas con la IP:**
   - En tu PC, abre PowerShell y escribe: `ipconfig`
   - Busca la IP en "Adaptador de Ethernet" o "Conexión de área local"
   - Actualiza la URL en `frontend-mobile/src/services/api.js`
   - Actualiza la URL en `frontend-mobile/src/services/websocket.js`

---

## 🔐 Credenciales de Prueba

Después de que el backend esté corriendo y MongoDB se haya inicializado con datos, deberías tener:

**Usuario Admin:**
- Email: `admin@j4pro.com`
- Contraseña: `Admin@123` (o la que hayas configurado)

Consulta `backend/USUARIO_ADMIN.md` para más detalles.

---

## 📡 Verificación de Endpoints del Backend

Los siguientes endpoints deben estar disponibles:

### Autenticación:
- `POST /api/auth/login` - Login
- `POST /api/auth/registro` - Registro
- `POST /api/auth/refresh` - Refrescar token
- `POST /api/auth/logout` - Logout

### Salud:
- `GET /api/salud` - Estado del backend
- `GET /api/salud/db` - Estado de MongoDB
- `GET /api/salud/sistema` - Info del sistema

### Clientes:
- `GET /api/clientes-negocios` - Listar clientes
- `GET /api/clientes-negocios/:id` - Obtener cliente
- `POST /api/clientes-negocios` - Crear cliente

### Sesiones:
- `GET /api/sesiones-inventario` - Listar sesiones
- `POST /api/sesiones-inventario` - Crear sesión
- `PATCH /api/sesiones-inventario/:id/completar` - Completar sesión

### Productos:
- `GET /api/productos` - Listar productos
- `GET /api/productos/codigo-barras/:barcode` - Por código de barras

### Reportes:
- `GET /api/reportes/balance/:sesionId` - Balance
- `GET /api/reportes/inventario/:sesionId` - Inventario

---

## 🐛 Solución de Problemas

### Error: "Cannot connect to backend"

**Solución:**
1. Verifica que el backend está corriendo: `npm run dev` en la carpeta backend
2. Verifica la IP correcta de tu máquina
3. En el emulador Android, usa: `10.0.2.2` en lugar de `localhost`

Ejemplo para emulador Android:
```javascript
// En frontend-mobile/src/services/api.js
const API_BASE_URL = 'http://10.0.2.2:3001/api'
```

### Error: "Use process(css).then(cb) to work with async plugins"

**✅ Ya está resuelto** - Se actualizó `metro.config.js`

### Error: "WebSocket connection failed"

**Solución:**
1. Verifica CORS en el backend (`backend/src/servidor.js`)
2. Asegúrate de que tu URL está en la lista de `origen` permitidas

---

## 📝 Configuración de Entorno

Crear archivo `.env` en `frontend-mobile/`:

```env
REACT_APP_API_URL=http://192.168.1.10:3001/api
NODE_ENV=development
```

O consulta `.env.example` para ver las opciones disponibles.

---

## 🔗 Estructura de Conexión

```
┌─ Frontend Mobile (App.jsx)
│  ├─ AuthContext (Gestión de autenticación)
│  ├─ API Service (axios) → Backend:3001/api
│  └─ WebSocket Service → Backend:3001 (socket.io)
│
└─ Backend Node.js:3001
   ├─ Express API
   ├─ Socket.IO (WebSocket)
   └─ MongoDB (localhost:27017)
```

---

## ✨ Características Implementadas

- ✅ Autenticación con JWT
- ✅ Almacenamiento seguro de tokens (Keychain)
- ✅ Reconexión automática de WebSocket
- ✅ Manejo de errores robusto
- ✅ Soporte para offline mode (en desarrollo)
- ✅ Navegación estructurada

---

## 📞 Contacto / Soporte

Si tienes problemas, verifica:
1. Los logs en la consola de Expo
2. Que el backend esté corriendo (`npm run dev`)
3. Que MongoDB esté corriendo
4. La configuración de URLs en los archivos de servicios

¡Listo! 🚀



