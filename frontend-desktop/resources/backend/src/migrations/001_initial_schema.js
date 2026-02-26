// Migración inicial - Crea todas las tablas del sistema
export const up = (db) => {
  console.log('📦 Ejecutando migración: 001_initial_schema')

  // Tabla: usuarios
  db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombreUsuario TEXT UNIQUE,
      nombre TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      telefono TEXT,
      rol TEXT CHECK(rol IN ('contable', 'contador', 'colaborador', 'administrador')) NOT NULL DEFAULT 'colaborador',
      contablePrincipalId INTEGER,
      activo INTEGER DEFAULT 1,
      ultimoAcceso DATETIME,
      -- Configuración (almacenado como JSON)
      configuracion TEXT DEFAULT '{}',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (contablePrincipalId) REFERENCES usuarios(id) ON DELETE SET NULL
    );
  `)

  // Índices para usuarios
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
    CREATE INDEX IF NOT EXISTS idx_usuarios_nombreUsuario ON usuarios(nombreUsuario);
    CREATE INDEX IF NOT EXISTS idx_usuarios_contablePrincipal ON usuarios(contablePrincipalId);
    CREATE INDEX IF NOT EXISTS idx_usuarios_activo ON usuarios(activo);
  `)

  // Tabla: refresh_tokens (separada para mejor gestión)
  db.exec(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuarioId INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      creadoEn DATETIME DEFAULT CURRENT_TIMESTAMP,
      expiraEn DATETIME NOT NULL,
      FOREIGN KEY (usuarioId) REFERENCES usuarios(id) ON DELETE CASCADE
    );
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_usuario ON refresh_tokens(usuarioId);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expira ON refresh_tokens(expiraEn);
  `)

  // Tabla: clientes_negocios
  db.exec(`
    CREATE TABLE IF NOT EXISTS clientes_negocios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      telefono TEXT NOT NULL,
      direccion TEXT NOT NULL,
      activo INTEGER DEFAULT 1,
      -- Configuración de inventario (JSON)
      configuracionInventario TEXT DEFAULT '{}',
      proximaVisita TEXT,
      contadorAsignadoId INTEGER NOT NULL,
      -- Estadísticas (JSON)
      estadisticas TEXT DEFAULT '{}',
      notas TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (contadorAsignadoId) REFERENCES usuarios(id) ON DELETE CASCADE
    );
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_clientes_contador ON clientes_negocios(contadorAsignadoId);
    CREATE INDEX IF NOT EXISTS idx_clientes_activo ON clientes_negocios(activo);
    CREATE INDEX IF NOT EXISTS idx_clientes_nombre ON clientes_negocios(nombre);
  `)

  // Tabla: productos_generales
  db.exec(`
    CREATE TABLE IF NOT EXISTS productos_generales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT UNIQUE NOT NULL,
      descripcion TEXT,
      categoria TEXT CHECK(categoria IN (
        'General', 'Alimentos General', 'Enlatados', 'Mercado', 
        'Embutidos', 'Carnes', 'Bebidas', 'Desechables', 
        'Electricidad', 'Dulce'
      )) DEFAULT 'General',
      unidad TEXT CHECK(unidad IN (
        'unidad', 'faldo', 'cajon', 'saco', 'pieza', 'kg', 'lb', 
        'gr', 'litro', 'ml', 'metro', 'cm', 'caja', 'paquete', 
        'docena', 'par', 'otro'
      )) DEFAULT 'unidad',
      costoBase REAL DEFAULT 0,
      tipoContenedor TEXT CHECK(tipoContenedor IN (
        'ninguno', 'caja', 'paquete', 'saco', 'fardo', 'cajon'
      )) DEFAULT 'ninguno',
      tieneUnidadesInternas INTEGER DEFAULT 0,
      -- Unidades internas (JSON)
      unidadesInternas TEXT DEFAULT '{}',
      tipoPeso TEXT CHECK(tipoPeso IN ('ninguno', 'lb', 'kg', 'gr')) DEFAULT 'ninguno',
      esProductoSecundario INTEGER DEFAULT 0,
      productoPadreId INTEGER,
      productoHijoId INTEGER,
      proveedor TEXT,
      activo INTEGER DEFAULT 1,
      codigoBarras TEXT,
      notas TEXT,
      creadoPorId INTEGER,
      tipoCreacion TEXT CHECK(tipoCreacion IN (
        'usuario', 'colaborador_temporal', 'sistema', 'importacion'
      )) DEFAULT 'usuario',
      -- Estadísticas (JSON)
      estadisticas TEXT DEFAULT '{}',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (productoPadreId) REFERENCES productos_generales(id) ON DELETE SET NULL,
      FOREIGN KEY (productoHijoId) REFERENCES productos_generales(id) ON DELETE SET NULL,
      FOREIGN KEY (creadoPorId) REFERENCES usuarios(id) ON DELETE SET NULL
    );
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_productos_generales_nombre ON productos_generales(nombre);
    CREATE INDEX IF NOT EXISTS idx_productos_generales_categoria ON productos_generales(categoria);
    CREATE INDEX IF NOT EXISTS idx_productos_generales_activo ON productos_generales(activo);
    CREATE INDEX IF NOT EXISTS idx_productos_generales_codigoBarras ON productos_generales(codigoBarras);
    CREATE INDEX IF NOT EXISTS idx_productos_generales_creador ON productos_generales(creadoPorId);
  `)

  // Tabla: productos_cliente
  db.exec(`
    CREATE TABLE IF NOT EXISTS productos_cliente (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      costo REAL NOT NULL DEFAULT 0,
      unidad TEXT NOT NULL,
      sku TEXT,
      activo INTEGER DEFAULT 1,
      clienteNegocioId INTEGER NOT NULL,
      categoria TEXT DEFAULT 'General',
      tipoContenedor TEXT DEFAULT 'ninguno',
      tieneUnidadesInternas INTEGER DEFAULT 0,
      unidadesInternas TEXT DEFAULT '{}',
      tipoPeso TEXT DEFAULT 'ninguno',
      esProductoSecundario INTEGER DEFAULT 0,
      productoPadreId INTEGER,
      productoHijoId INTEGER,
      codigoBarras TEXT,
      proveedor TEXT,
      creadoPorId INTEGER,
      tipoCreacion TEXT DEFAULT 'usuario',
      -- Estadísticas (JSON)
      estadisticas TEXT DEFAULT '{}',
      -- Configuración (JSON)
      configuracion TEXT DEFAULT '{}',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (clienteNegocioId) REFERENCES clientes_negocios(id) ON DELETE CASCADE,
      FOREIGN KEY (productoPadreId) REFERENCES productos_cliente(id) ON DELETE SET NULL,
      FOREIGN KEY (productoHijoId) REFERENCES productos_cliente(id) ON DELETE SET NULL,
      FOREIGN KEY (creadoPorId) REFERENCES usuarios(id) ON DELETE SET NULL
    );
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_productos_cliente_cliente ON productos_cliente(clienteNegocioId);
    CREATE INDEX IF NOT EXISTS idx_productos_cliente_activo ON productos_cliente(activo);
    CREATE INDEX IF NOT EXISTS idx_productos_cliente_nombre ON productos_cliente(nombre);
    CREATE INDEX IF NOT EXISTS idx_productos_cliente_categoria ON productos_cliente(categoria);
    CREATE INDEX IF NOT EXISTS idx_productos_cliente_sku ON productos_cliente(sku);
    CREATE INDEX IF NOT EXISTS idx_productos_cliente_codigoBarras ON productos_cliente(codigoBarras);
  `)

  // Tabla: sesiones_inventario
  db.exec(`
    CREATE TABLE IF NOT EXISTS sesiones_inventario (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clienteNegocioId INTEGER NOT NULL,
      contadorId INTEGER NOT NULL,
      fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      estado TEXT CHECK(estado IN (
        'iniciada', 'en_progreso', 'completada', 'cancelada'
      )) DEFAULT 'iniciada',
      -- Datos financieros (JSON)
      datosFinancieros TEXT DEFAULT '{}',
      -- Totales (JSON)
      totales TEXT DEFAULT '{}',
      notas TEXT,
      duracionMinutos INTEGER DEFAULT 0,
      numeroSesion TEXT UNIQUE NOT NULL,
      version INTEGER DEFAULT 1,
      timerEnMarcha INTEGER DEFAULT 0,
      timerAcumuladoSegundos INTEGER DEFAULT 0,
      timerUltimoInicio DATETIME,
      -- Configuración (JSON)
      configuracion TEXT DEFAULT '{}',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (clienteNegocioId) REFERENCES clientes_negocios(id) ON DELETE CASCADE,
      FOREIGN KEY (contadorId) REFERENCES usuarios(id) ON DELETE CASCADE
    );
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sesiones_cliente ON sesiones_inventario(clienteNegocioId);
    CREATE INDEX IF NOT EXISTS idx_sesiones_contador ON sesiones_inventario(contadorId);
    CREATE INDEX IF NOT EXISTS idx_sesiones_fecha ON sesiones_inventario(fecha);
    CREATE INDEX IF NOT EXISTS idx_sesiones_estado ON sesiones_inventario(estado);
    CREATE INDEX IF NOT EXISTS idx_sesiones_numero ON sesiones_inventario(numeroSesion);
  `)

  // Tabla: sesiones_colaboradores
  db.exec(`
    CREATE TABLE IF NOT EXISTS sesiones_colaboradores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sesionInventarioId INTEGER NOT NULL,
      usuarioId INTEGER NOT NULL,
      rol TEXT CHECK(rol IN ('contador', 'colaborador')) DEFAULT 'colaborador',
      unidoEn DATETIME DEFAULT CURRENT_TIMESTAMP,
      activo INTEGER DEFAULT 1,
      FOREIGN KEY (sesionInventarioId) REFERENCES sesiones_inventario(id) ON DELETE CASCADE,
      FOREIGN KEY (usuarioId) REFERENCES usuarios(id) ON DELETE CASCADE,
      UNIQUE(sesionInventarioId, usuarioId)
    );
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sesiones_colaboradores_sesion ON sesiones_colaboradores(sesionInventarioId);
    CREATE INDEX IF NOT EXISTS idx_sesiones_colaboradores_usuario ON sesiones_colaboradores(usuarioId);
  `)

  // Tabla: productos_contados
  db.exec(`
    CREATE TABLE IF NOT EXISTS productos_contados (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sesionInventarioId INTEGER NOT NULL,
      productoClienteId INTEGER NOT NULL,
      nombreProducto TEXT NOT NULL,
      unidadProducto TEXT NOT NULL,
      costoProducto REAL NOT NULL DEFAULT 0,
      skuProducto TEXT,
      cantidadContada REAL NOT NULL DEFAULT 0,
      valorTotal REAL DEFAULT 0,
      notas TEXT,
      agregadoPorId INTEGER,
      requiereAprobacion INTEGER DEFAULT 0,
      aprobado INTEGER DEFAULT 1,
      aprobadoPorId INTEGER,
      aprobadoEn DATETIME,
      -- Discrepancia (JSON)
      discrepancia TEXT DEFAULT '{}',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sesionInventarioId) REFERENCES sesiones_inventario(id) ON DELETE CASCADE,
      FOREIGN KEY (productoClienteId) REFERENCES productos_cliente(id) ON DELETE CASCADE,
      FOREIGN KEY (agregadoPorId) REFERENCES usuarios(id) ON DELETE SET NULL,
      FOREIGN KEY (aprobadoPorId) REFERENCES usuarios(id) ON DELETE SET NULL
    );
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_productos_contados_sesion ON productos_contados(sesionInventarioId);
    CREATE INDEX IF NOT EXISTS idx_productos_contados_producto ON productos_contados(productoClienteId);
    CREATE INDEX IF NOT EXISTS idx_productos_contados_agregado ON productos_contados(agregadoPorId);
  `)

  // Tabla: invitaciones
  db.exec(`
    CREATE TABLE IF NOT EXISTS invitaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contableId INTEGER NOT NULL,
      codigoQR TEXT UNIQUE NOT NULL,
      estado TEXT CHECK(estado IN (
        'activa', 'usada', 'expirada', 'cancelada'
      )) DEFAULT 'activa',
      expiraEn DATETIME NOT NULL,
      usadaEn DATETIME,
      usadaPor TEXT,
      -- Metadata (JSON)
      metadata TEXT DEFAULT '{}',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (contableId) REFERENCES usuarios(id) ON DELETE CASCADE
    );
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_invitaciones_contable ON invitaciones(contableId);
    CREATE INDEX IF NOT EXISTS idx_invitaciones_codigo ON invitaciones(codigoQR);
    CREATE INDEX IF NOT EXISTS idx_invitaciones_estado ON invitaciones(estado);
    CREATE INDEX IF NOT EXISTS idx_invitaciones_expira ON invitaciones(expiraEn);
  `)

  // Tabla: solicitudes_conexion
  db.exec(`
    CREATE TABLE IF NOT EXISTS solicitudes_conexion (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contableId INTEGER NOT NULL,
      nombreColaborador TEXT NOT NULL,
      estado TEXT CHECK(estado IN (
        'pendiente', 'aceptada', 'rechazada', 'desconectada'
      )) DEFAULT 'pendiente',
      codigoConexion TEXT UNIQUE NOT NULL,
      expiraEn DATETIME,
      aceptadaEn DATETIME,
      rechazadaEn DATETIME,
      desconectadaEn DATETIME,
      -- Metadata (JSON)
      metadata TEXT DEFAULT '{}',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (contableId) REFERENCES usuarios(id) ON DELETE CASCADE
    );
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_solicitudes_contable ON solicitudes_conexion(contableId);
    CREATE INDEX IF NOT EXISTS idx_solicitudes_codigo ON solicitudes_conexion(codigoConexion);
    CREATE INDEX IF NOT EXISTS idx_solicitudes_estado ON solicitudes_conexion(estado);
  `)

  // Tabla: productos_offline
  db.exec(`
    CREATE TABLE IF NOT EXISTS productos_offline (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      solicitudConexionId INTEGER NOT NULL,
      nombre TEXT NOT NULL,
      costo REAL DEFAULT 0,
      unidad TEXT,
      categoria TEXT,
      sincronizado INTEGER DEFAULT 0,
      productoClienteId INTEGER,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (solicitudConexionId) REFERENCES solicitudes_conexion(id) ON DELETE CASCADE,
      FOREIGN KEY (productoClienteId) REFERENCES productos_cliente(id) ON DELETE SET NULL
    );
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_productos_offline_solicitud ON productos_offline(solicitudConexionId);
    CREATE INDEX IF NOT EXISTS idx_productos_offline_sincronizado ON productos_offline(sincronizado);
  `)

  // Tabla: historial_sesiones
  db.exec(`
    CREATE TABLE IF NOT EXISTS historial_sesiones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sesionId INTEGER NOT NULL,
      usuarioId INTEGER NOT NULL,
      accion TEXT NOT NULL,
      descripcion TEXT,
      -- Metadata (JSON)
      metadata TEXT DEFAULT '{}',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sesionId) REFERENCES sesiones_inventario(id) ON DELETE CASCADE,
      FOREIGN KEY (usuarioId) REFERENCES usuarios(id) ON DELETE CASCADE
    );
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_historial_sesion ON historial_sesiones(sesionId);
    CREATE INDEX IF NOT EXISTS idx_historial_usuario ON historial_sesiones(usuarioId);
    CREATE INDEX IF NOT EXISTS idx_historial_fecha ON historial_sesiones(createdAt);
  `)

  // Triggers para actualizar updatedAt automáticamente
  const tablesWithUpdatedAt = [
    'usuarios',
    'clientes_negocios',
    'productos_generales',
    'productos_cliente',
    'sesiones_inventario',
    'productos_contados',
    'invitaciones',
    'solicitudes_conexion',
  ]

  tablesWithUpdatedAt.forEach(table => {
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_${table}_timestamp
      AFTER UPDATE ON ${table}
      FOR EACH ROW
      BEGIN
        UPDATE ${table} SET updatedAt = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
    `)
  })

  console.log('✅ Migración 001_initial_schema completada')
}

export const down = (db) => {
  console.log('⬇️ Revertiendo migración: 001_initial_schema')

  // Eliminar triggers
  const tablesWithUpdatedAt = [
    'usuarios',
    'clientes_negocios',
    'productos_generales',
    'productos_cliente',
    'sesiones_inventario',
    'productos_contados',
    'invitaciones',
    'solicitudes_conexion',
  ]

  tablesWithUpdatedAt.forEach(table => {
    db.exec(`DROP TRIGGER IF EXISTS update_${table}_timestamp;`)
  })

  // Eliminar tablas en orden inverso (respetando foreign keys)
  const tables = [
    'historial_sesiones',
    'productos_offline',
    'solicitudes_conexion',
    'invitaciones',
    'productos_contados',
    'sesiones_colaboradores',
    'sesiones_inventario',
    'productos_cliente',
    'productos_generales',
    'clientes_negocios',
    'refresh_tokens',
    'usuarios',
  ]

  tables.forEach(table => {
    db.exec(`DROP TABLE IF EXISTS ${table};`)
  })

  console.log('✅ Migración 001_initial_schema revertida')
}
