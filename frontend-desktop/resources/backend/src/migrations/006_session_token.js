export const up = (db) => {
  // Agregar sessionToken a solicitudes_conexion para el flujo de colaborador mobile
  const cols = db.prepare("PRAGMA table_info(solicitudes_conexion)").all()
  const hasToken = cols.some(c => c.name === 'sessionToken')
  if (!hasToken) {
    db.exec("ALTER TABLE solicitudes_conexion ADD COLUMN sessionToken TEXT")
    console.log('  ✓ Columna sessionToken añadida a solicitudes_conexion')
  }
}

export const down = (db) => {
  // SQLite no soporta DROP COLUMN en versiones antiguas — no revertimos
}
