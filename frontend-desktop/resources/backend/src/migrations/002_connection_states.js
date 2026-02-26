// Migración para estados de conexión mejorados y cola de productos
export const up = (db) => {
  console.log('📦 Ejecutando migración: 002_connection_states')

  // Agregar columnas para estado de conexión en tiempo real
  try {
    db.exec(`ALTER TABLE solicitudes_conexion ADD COLUMN estadoConexion TEXT DEFAULT 'desconectado'`)
  } catch (e) {
    if (!e.message.includes('duplicate column')) throw e
  }

  try {
    db.exec(`ALTER TABLE solicitudes_conexion ADD COLUMN ultimoPing DATETIME`)
  } catch (e) {
    if (!e.message.includes('duplicate column')) throw e
  }

  try {
    db.exec(`ALTER TABLE solicitudes_conexion ADD COLUMN ultimaConexion DATETIME`)
  } catch (e) {
    if (!e.message.includes('duplicate column')) throw e
  }

  // Tabla: cola_productos_colaborador - Para gestionar envíos de productos por colaborador
  db.exec(`
    CREATE TABLE IF NOT EXISTS cola_productos_colaborador (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      solicitudConexionId INTEGER NOT NULL,
      sesionInventarioId INTEGER,
      estado TEXT CHECK(estado IN (
        'pendiente', 'en_revision', 'aceptado', 'rechazado', 'parcial'
      )) DEFAULT 'pendiente',
      totalProductos INTEGER DEFAULT 0,
      productosAceptados INTEGER DEFAULT 0,
      productosRechazados INTEGER DEFAULT 0,
      enviadoEn DATETIME DEFAULT CURRENT_TIMESTAMP,
      revisadoEn DATETIME,
      aceptadoEn DATETIME,
      rechazadoEn DATETIME,
      notas TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (solicitudConexionId) REFERENCES solicitudes_conexion(id) ON DELETE CASCADE
    );
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_cola_productos_solicitud ON cola_productos_colaborador(solicitudConexionId);
    CREATE INDEX IF NOT EXISTS idx_cola_productos_sesion ON cola_productos_colaborador(sesionInventarioId);
    CREATE INDEX IF NOT EXISTS idx_cola_productos_estado ON cola_productos_colaborador(estado);
  `)

  // Agregar columna para asociar producto_offline a una cola específica
  try {
    db.exec(`ALTER TABLE productos_offline ADD COLUMN colaId INTEGER REFERENCES cola_productos_colaborador(id)`)
  } catch (e) {
    if (!e.message.includes('duplicate column')) throw e
  }

  try {
    db.exec(`ALTER TABLE productos_offline ADD COLUMN estadoRevision TEXT DEFAULT 'pendiente'`)
  } catch (e) {
    if (!e.message.includes('duplicate column')) throw e
  }

  try {
    db.exec(`ALTER TABLE productos_offline ADD COLUMN cantidad REAL DEFAULT 1`)
  } catch (e) {
    if (!e.message.includes('duplicate column')) throw e
  }

  try {
    db.exec(`ALTER TABLE productos_offline ADD COLUMN codigoBarras TEXT`)
  } catch (e) {
    if (!e.message.includes('duplicate column')) throw e
  }

  try {
    db.exec(`ALTER TABLE productos_offline ADD COLUMN sku TEXT`)
  } catch (e) {
    if (!e.message.includes('duplicate column')) throw e
  }

  console.log('✅ Migración 002_connection_states completada')
}

export const down = (db) => {
  // No eliminar columnas en down para preservar datos
  db.exec(`DROP TABLE IF EXISTS cola_productos_colaborador`)
  console.log('⬇️ Migración 002_connection_states revertida')
}





