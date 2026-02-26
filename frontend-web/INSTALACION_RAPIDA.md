# ⚡ Instalación Rápida - Versión Web 2.0.0

## 🚀 Pasos para Probar las Nuevas Funciones

### 1. Instalar Dependencias

```powershell
# Navegar a la carpeta web
cd c:\Users\ASUS\Desktop\new-appj4\frontend-web

# Instalar dependencias (incluye jsqr)
npm install
```

### 2. Iniciar Servidor de Desarrollo

```powershell
# Iniciar el servidor
npm run dev

# Debería abrir en:
# http://localhost:5173
```

### 3. Probar el Escáner QR

**Opción A: Con QR de prueba**

1. Abrir `http://localhost:5173/login`
2. Click en "Acceder como Colaborador"
3. Permitir acceso a cámara
4. Generar un QR de prueba desde `/invitaciones`

**Opción B: Con dispositivo móvil**

1. Usuario principal genera QR desde mobile
2. Mostrar QR en pantalla del móvil
3. Escanear desde la webcam del PC

### 4. Generar QR desde Web

```bash
# 1. Login normal
http://localhost:5173/login
Email: tu@email.com
Password: ******

# 2. Ir a Invitaciones
http://localhost:5173/invitaciones

# 3. Click "Generar Invitación"
- Rol: Colaborador
- Expiración: 1440 minutos (24h)

# 4. Descargar o mostrar QR
```

---

## 🎯 Prueba Rápida (5 minutos)

### Test 1: Botón Colaborador Visible

```bash
✅ Abrir http://localhost:5173/login
✅ Verificar botón morado "Acceder como Colaborador"
✅ Botón tiene ícono de QR
✅ Está debajo del botón "Iniciar sesión"
```

### Test 2: Escáner QR Funciona

```bash
✅ Click en "Acceder como Colaborador"
✅ Se abre modal morado
✅ Solicita permiso de cámara
✅ Se ve preview de la cámara
✅ Marco de escaneo visible
```

### Test 3: Generación de QR

```bash
✅ Login como usuario principal
✅ Ir a /invitaciones
✅ Click "Generar Invitación"
✅ Por defecto dice 1440 minutos
✅ QR se genera correctamente
✅ Se puede descargar
```

---

## 🐛 Solución Rápida de Problemas

### Error: "jsqr not found"

```bash
npm install jsqr
```

### Error: "Cannot access camera"

```bash
# 1. Usar HTTPS o localhost
# 2. Permitir cámara en navegador
# 3. Cerrar otras apps que usen cámara
```

### Error: "API not responding"

```bash
# Verificar que backend esté corriendo
cd ../backend
npm start

# Debe estar en puerto 3001
```

---

## 📋 Checklist Pre-Pruebas

- [ ] Backend corriendo en puerto 3001
- [ ] Frontend-web `npm install` ejecutado
- [ ] Frontend-web `npm run dev` corriendo
- [ ] Navegador Chrome/Firefox (no IE)
- [ ] Webcam conectada
- [ ] HTTPS o localhost

---

## 🎉 Si Todo Funciona

Verás:
- ✅ Botón colaborador en login
- ✅ Escáner QR se abre
- ✅ Cámara se activa
- ✅ QR se genera en 24h por defecto
- ✅ Versión 2.0.0 en package.json

---

## 📞 Ayuda

Si tienes problemas, revisa:
- `COLABORACION_QR_WEB.md` - Documentación completa
- Consola del navegador (F12)
- Logs del backend

---

**¡Listo para probar! 🚀**
