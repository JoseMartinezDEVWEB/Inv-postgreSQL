/**
 * Migración 003: Campos de Sincronización y Roles
 * Añade campos para sincronización bidireccional Offline-First:
 * - uuid: Identificador único generado por el cliente
 * - business_id: ID del negocio/admin principal (para filtrar datos por empresa)
 * - created_by: Usuario que creó el registro
 * - updated_at: Timestamp de última actualización (para detectar cambios)
 */

export const up = (db) => {
  console.log('  📦 Añadiendo campos de sincronización a tablas...')

  // Helper para añadir columna si no existe
  const addColumnIfNotExists = (table, column, definition) => {
    try {
      const info = db.prepare(`PRAGMA table_info(${table})`).all()
      if (!info.some(c => c.name === column)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
        console.log(`    ✓ Columna ${column} añadida a ${table}`)
      } else {
        console.log(`    - Columna ${column} ya existe en ${table}`)
      }
    } catch (e) {
      console.log(`    ⚠ Error añadiendo ${column} a ${table}: ${e.message}`)
    }
  }

  // ========== TABLA: clientes_negocios ==========
  addColumnIfNotExists('clientes_negocios', 'uuid', 'TEXT UNIQUE')
  addColumnIfNotExists('clientes_negocios', 'business_id', 'INTEGER')
  addColumnIfNotExists('clientes_negocios', 'created_by', 'INTEGER')
  addColumnIfNotExists('clientes_negocios', 'created_at', 'INTEGER')
  addColumnIfNotExists('clientes_negocios', 'updated_at', 'INTEGER')

  // ========== TABLA: productos_cliente ==========
  addColumnIfNotExists('productos_cliente', 'uuid', 'TEXT UNIQUE')
  addColumnIfNotExists('productos_cliente', 'business_id', 'INTEGER')
  addColumnIfNotExists('productos_cliente', 'created_by', 'INTEGER')
  addColumnIfNotExists('productos_cliente', 'created_at', 'INTEGER')
  addColumnIfNotExists('productos_cliente', 'updated_at', 'INTEGER')

  // ========== TABLA: sesiones_inventario ==========
  addColumnIfNotExists('sesiones_inventario', 'uuid', 'TEXT UNIQUE')
  addColumnIfNotExists('sesiones_inventario', 'business_id', 'INTEGER')
  addColumnIfNotExists('sesiones_inventario', 'created_by', 'INTEGER')
  addColumnIfNotExists('sesiones_inventario', 'updated_at', 'INTEGER')

  // ========== TABLA: productos_contados ==========
  addColumnIfNotExists('productos_contados', 'uuid', 'TEXT UNIQUE')

  // ========== TABLA: usuarios (para roles) ==========
  addColumnIfNotExists('usuarios', 'business_id', 'INTEGER')

  // ========== Crear índices para optimizar consultas ==========
  console.log('  📊 Creando índices de sincronización...')
  
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_clientes_business ON clientes_negocios(business_id)`)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_clientes_updated ON clientes_negocios(updated_at)`)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_clientes_uuid ON clientes_negocios(uuid)`)
    
    db.exec(`CREATE INDEX IF NOT EXISTS idx_productos_business ON productos_cliente(business_id)`)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_productos_updated ON productos_cliente(updated_at)`)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_productos_uuid ON productos_cliente(uuid)`)
    
    db.exec(`CREATE INDEX IF NOT EXISTS idx_sesiones_business ON sesiones_inventario(business_id)`)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_sesiones_updated ON sesiones_inventario(updated_at)`)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_sesiones_uuid ON sesiones_inventario(uuid)`)
    
    db.exec(`CREATE INDEX IF NOT EXISTS idx_productos_contados_uuid ON productos_contados(uuid)`)
    
    console.log('    ✓ Índices creados exitosamente')
  } catch (e) {
    console.log(`    ⚠ Algunos índices ya existen: ${e.message}`)
  }

  // ========== Actualizar registros existentes con business_id ==========
  console.log('  🔄 Actualizando registros existentes con business_id...')
  
  try {
    // Para clientes, el business_id es el contadorAsignadoId o el contablePrincipalId del contador
    db.exec(`
      UPDATE clientes_negocios 
      SET business_id = COALESCE(
        (SELECT COALESCE(u.contablePrincipalId, u.id) FROM usuarios u WHERE u.id = clientes_negocios.contadorAsignadoId),
        contadorAsignadoId
      ),
      created_by = COALESCE(created_by, contadorAsignadoId),
      updated_at = COALESCE(updated_at, strftime('%s', 'now') * 1000)
      WHERE business_id IS NULL
    `)

    // Para productos_cliente
    db.exec(`
      UPDATE productos_cliente 
      SET business_id = COALESCE(
        (SELECT business_id FROM clientes_negocios cn WHERE cn.id = productos_cliente.clienteNegocioId),
        clienteNegocioId
      ),
      updated_at = COALESCE(updated_at, strftime('%s', 'now') * 1000)
      WHERE business_id IS NULL
    `)

    // Para sesiones_inventario
    db.exec(`
      UPDATE sesiones_inventario 
      SET business_id = COALESCE(
        (SELECT COALESCE(u.contablePrincipalId, u.id) FROM usuarios u WHERE u.id = sesiones_inventario.contadorId),
        contadorId
      ),
      created_by = COALESCE(created_by, contadorId),
      updated_at = COALESCE(updated_at, strftime('%s', 'now') * 1000)
      WHERE business_id IS NULL
    `)

    // Para usuarios (subordinados heredan business_id de su contable principal)
    db.exec(`
      UPDATE usuarios 
      SET business_id = COALESCE(contablePrincipalId, id)
      WHERE business_id IS NULL
    `)

    console.log('    ✓ Registros actualizados con business_id')
  } catch (e) {
    console.log(`    ⚠ Error actualizando registros: ${e.message}`)
  }

  // ========== Generar UUIDs para registros existentes sin UUID ==========
  console.log('  🔑 Generando UUIDs para registros existentes...')
  
  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }

  const tablesWithUUID = [
    'clientes_negocios',
    'productos_cliente', 
    'sesiones_inventario',
    'productos_contados'
  ]

  for (const table of tablesWithUUID) {
    try {
      const records = db.prepare(`SELECT id FROM ${table} WHERE uuid IS NULL`).all()
      if (records.length > 0) {
        const updateStmt = db.prepare(`UPDATE ${table} SET uuid = ? WHERE id = ?`)
        for (const record of records) {
          updateStmt.run(generateUUID(), record.id)
        }
        console.log(`    ✓ ${records.length} UUIDs generados para ${table}`)
      }
    } catch (e) {
      console.log(`    ⚠ Error generando UUIDs para ${table}: ${e.message}`)
    }
  }

  console.log('  ✅ Migración 003 completada')
}

export const down = (db) => {
  console.log('  🔄 Revirtiendo migración 003...')
  
  // SQLite no soporta DROP COLUMN directamente en versiones antiguas
  // Por seguridad, no eliminamos columnas, solo los índices
  
  try {
    db.exec('DROP INDEX IF EXISTS idx_clientes_business')
    db.exec('DROP INDEX IF EXISTS idx_clientes_updated')
    db.exec('DROP INDEX IF EXISTS idx_clientes_uuid')
    db.exec('DROP INDEX IF EXISTS idx_productos_business')
    db.exec('DROP INDEX IF EXISTS idx_productos_updated')
    db.exec('DROP INDEX IF EXISTS idx_productos_uuid')
    db.exec('DROP INDEX IF EXISTS idx_sesiones_business')
    db.exec('DROP INDEX IF EXISTS idx_sesiones_updated')
    db.exec('DROP INDEX IF EXISTS idx_sesiones_uuid')
    db.exec('DROP INDEX IF EXISTS idx_productos_contados_uuid')
    console.log('  ✓ Índices eliminados')
  } catch (e) {
    console.log(`  ⚠ Error eliminando índices: ${e.message}`)
  }

  console.log('  ⚠ Nota: Las columnas añadidas no se eliminan por seguridad')
}



