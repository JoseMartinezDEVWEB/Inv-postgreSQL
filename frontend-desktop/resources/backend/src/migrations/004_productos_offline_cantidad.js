// Migración 004: Agregar columna cantidad a productos_offline
export const up = (db) => {
  console.log('📦 Ejecutando migración: 004_productos_offline_cantidad')
  
  // Verificar si la columna ya existe
  const tableInfo = db.prepare("PRAGMA table_info(productos_offline)").all()
  const hasCantidad = tableInfo.some(col => col.name === 'cantidad')
  
  if (!hasCantidad) {
    // Agregar columna cantidad
    db.exec(`
      ALTER TABLE productos_offline 
      ADD COLUMN cantidad INTEGER DEFAULT 1
    `)
    console.log('✅ Columna cantidad agregada a productos_offline')
  } else {
    console.log('ℹ️  Columna cantidad ya existe en productos_offline')
  }
  
  // También agregar sku y codigoBarras si no existen (por compatibilidad)
  const hasSku = tableInfo.some(col => col.name === 'sku')
  if (!hasSku) {
    db.exec(`
      ALTER TABLE productos_offline 
      ADD COLUMN sku TEXT
    `)
    console.log('✅ Columna sku agregada a productos_offline')
  }
  
  const hasCodigoBarras = tableInfo.some(col => col.name === 'codigoBarras')
  if (!hasCodigoBarras) {
    db.exec(`
      ALTER TABLE productos_offline 
      ADD COLUMN codigoBarras TEXT
    `)
    console.log('✅ Columna codigoBarras agregada a productos_offline')
  }
  
  console.log('✅ Migración 004_productos_offline_cantidad completada')
}

export const down = (db) => {
  console.log('⬇️ Revertiendo migración: 004_productos_offline_cantidad')
  
  // SQLite no soporta DROP COLUMN directamente, así que esto es informativo
  console.log('⚠️  SQLite no soporta DROP COLUMN. Si necesitas revertir, recrea la tabla.')
  console.log('✅ Migración 004_productos_offline_cantidad revertida (informativo)')
}



