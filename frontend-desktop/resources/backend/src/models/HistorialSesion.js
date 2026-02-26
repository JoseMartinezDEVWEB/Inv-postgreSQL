import dbManager from '../config/database.js'

class HistorialSesion {
  // Registrar evento en historial
  static registrar(datos) {
    const db = dbManager.getDatabase()

    const {
      sesionId,
      usuarioId,
      accion,
      descripcion = null,
      metadata = {},
    } = datos

    const stmt = db.prepare(`
      INSERT INTO historial_sesiones (sesionId, usuarioId, accion, descripcion, metadata)
      VALUES (?, ?, ?, ?, ?)
    `)

    const info = stmt.run(
      sesionId,
      usuarioId,
      accion,
      descripcion,
      JSON.stringify(metadata)
    )

    return info.lastInsertRowid
  }

  // Obtener historial de una sesión
  static obtenerPorSesion(sesionId, limite = 100) {
    const db = dbManager.getDatabase()

    const stmt = db.prepare(`
      SELECT 
        h.*,
        u.nombre as nombreUsuario,
        u.email as emailUsuario
      FROM historial_sesiones h
      INNER JOIN usuarios u ON h.usuarioId = u.id
      WHERE h.sesionId = ?
      ORDER BY h.createdAt DESC
      LIMIT ?
    `)

    const historial = stmt.all(sesionId, limite)

    return historial.map(evento => ({
      ...evento,
      metadata: JSON.parse(evento.metadata || '{}'),
    }))
  }

  // Obtener historial de un usuario
  static obtenerPorUsuario(usuarioId, limite = 50) {
    const db = dbManager.getDatabase()

    const stmt = db.prepare(`
      SELECT 
        h.*,
        si.numeroSesion,
        cn.nombre as nombreCliente
      FROM historial_sesiones h
      INNER JOIN sesiones_inventario si ON h.sesionId = si.id
      INNER JOIN clientes_negocios cn ON si.clienteNegocioId = cn.id
      WHERE h.usuarioId = ?
      ORDER BY h.createdAt DESC
      LIMIT ?
    `)

    const historial = stmt.all(usuarioId, limite)

    return historial.map(evento => ({
      ...evento,
      metadata: JSON.parse(evento.metadata || '{}'),
    }))
  }
}

export default HistorialSesion
