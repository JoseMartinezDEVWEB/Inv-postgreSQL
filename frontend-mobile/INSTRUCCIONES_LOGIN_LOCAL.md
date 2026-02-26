# 🔐 Instrucciones de Login - Modo Local

## Usuario Administrador Predeterminado

La app viene con un usuario administrador creado por defecto:

```
Email/Usuario: admin@j4pro.com
Contraseña: Jose.1919
```

## Características del Login Local

✅ **Login por Email o Nombre de Usuario** - Puedes usar cualquiera de los dos  
✅ **Validación de Credenciales** - Las contraseñas se validan localmente  
✅ **Base de Datos SQLite** - Los usuarios se guardan en el dispositivo  
✅ **Funciona sin Internet** - No requiere conexión para autenticarse  
✅ **Fallback a API** - Si hay internet, puede intentar login remoto

## Flujo de Autenticación

1. **Prioridad 1: Login Local**
   - La app primero intenta autenticar con la base de datos local
   - Busca el usuario por email o nombre
   - Valida la contraseña

2. **Prioridad 2: Login Remoto** (solo si hay internet y el local falla)
   - Si el login local falla y hay conexión
   - Intenta autenticar con la API remota
   - Útil para sincronización con backend en la nube

## Crear Nuevos Usuarios

### Opción 1: Desde la App (Próximamente)
```
Menú → Usuarios → Crear Usuario
```

### Opción 2: Manualmente en el Código

Edita `src/services/localDb.js` y agrega en la función `init()`:

```javascript
await database.runAsync(
    `INSERT INTO usuarios (_id, nombre, email, password, rol, activo, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
        'user-custom-id',
        'Nombre Completo',
        'email@ejemplo.com',
        'contraseña123',
        'contador', // o 'administrador'
        1,
        new Date().toISOString(),
        new Date().toISOString()
    ]
);
```

## Roles Disponibles

- **administrador**: Acceso total a todas las funciones
- **contador**: Acceso a inventarios, productos y reportes
- **colaborador**: Acceso limitado (solo lectura)

## Validación de Formulario

- **Email/Usuario**: Campo requerido (sin validación de formato)
- **Contraseña**: Campo requerido (sin longitud mínima)

Esto permite flexibilidad en los nombres de usuario y contraseñas.

## Seguridad

⚠️ **IMPORTANTE**: En esta versión, las contraseñas se almacenan en texto plano en SQLite local.

Para producción, se recomienda:
1. Hashear las contraseñas con bcrypt o similar
2. Implementar límite de intentos de login
3. Agregar autenticación de dos factores (opcional)

## Modo Sin Conexión

El banner rojo "Sin conexión" **NO aparecerá** en el modo local, ya que la app está configurada para funcionar completamente offline.

## Solución de Problemas

### "Credenciales incorrectas"
- Verifica que estés usando: `admin@j4pro.com` / `Jose.1919`
- Asegúrate de escribir correctamente (distingue mayúsculas/minúsculas)
- Si persiste, reinstala la app para recrear la base de datos

### "Error al iniciar sesión"
- Verifica que la app tenga permisos de almacenamiento
- Reinstala la app si el problema persiste

### No puedo crear nuevos usuarios
- La funcionalidad de registro está deshabilitada por defecto
- Usa el usuario administrador predeterminado
- O crea usuarios manualmente en el código

## Migración de Usuarios

Si tienes usuarios en el backend remoto y quieres migrarlos al local:

1. Exportar usuarios desde el backend
2. Importar en la base de datos local
3. (Funcionalidad de importación próximamente)

---

**Versión**: 1.0.0  
**Última actualización**: Diciembre 30, 2025








