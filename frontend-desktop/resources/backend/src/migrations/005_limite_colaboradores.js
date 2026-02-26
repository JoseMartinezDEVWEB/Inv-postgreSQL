// Migración: límite de colaboradores para usuarios con rol contador
// El admin puede asignar a cada contador cuántos colaboradores puede tener en su equipo.
export const up = (db) => {
  console.log('📦 Ejecutando migración: 005_limite_colaboradores')

  const tableInfo = db.prepare("PRAGMA table_info(usuarios)").all()
  const hasLimite = tableInfo.some(col => col.name === 'limiteColaboradores')
  if (!hasLimite) {
    db.exec(`
      ALTER TABLE usuarios ADD COLUMN limiteColaboradores INTEGER DEFAULT NULL
    `)
    console.log('✅ Columna limiteColaboradores agregada a usuarios')
  } else {
    console.log('ℹ️ Columna limiteColaboradores ya existe')
  }

  console.log('✅ Migración 005_limite_colaboradores completada')
}

export const down = (db) => {
  console.log('⬇️ Revirtiendo migración: 005_limite_colaboradores')
  // SQLite no soporta DROP COLUMN en versiones antiguas; se deja la columna.
  console.log('ℹ️ SQLite: omitiendo DROP COLUMN limiteColaboradores')
  console.log('✅ Migración 005_limite_colaboradores revertida')
}
