import bcrypt from 'bcryptjs'
import dbManager from '../config/database.js'

class Usuario {
  // Crear nuevo usuario
  static crear(datos) {
    const db = dbManager.getDatabase()

    const {
      nombre,
      email,
      password,
      telefono,
      rol = 'colaborador',
      contablePrincipalId = null,
      configuracion = {},
      limiteColaboradores = null,
    } = datos

    // Generar nombreUsuario automáticamente si no se proporciona
    // Usar la parte antes del @ del email, o el nombre en minúsculas sin espacios
    let nombreUsuario = datos.nombreUsuario
    if (!nombreUsuario) {
      if (email) {
        nombreUsuario = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '')
      } else if (nombre) {
        nombreUsuario = nombre.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
      } else {
        nombreUsuario = 'user_' + Date.now()
      }
    }

    // Verificar si el nombreUsuario ya existe y agregar sufijo si es necesario
    let finalNombreUsuario = nombreUsuario
    let contador = 1
    while (Usuario.buscarPorNombreUsuario(finalNombreUsuario)) {
      finalNombreUsuario = `${nombreUsuario}${contador}`
      contador++
    }

    // Hash del password
    const passwordHash = bcrypt.hashSync(password, 10)

    const limite = (rol === 'contador' && limiteColaboradores != null) ? Number(limiteColaboradores) : null

    const stmt = db.prepare(`
      INSERT INTO usuarios (
        nombreUsuario, nombre, email, password, telefono, rol, 
        contablePrincipalId, configuracion, limiteColaboradores
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const info = stmt.run(
      finalNombreUsuario,
      nombre,
      email,
      passwordHash,
      telefono || null,
      rol,
      contablePrincipalId,
      JSON.stringify(configuracion),
      limite
    )

    // Si es colaborador, generar código de acceso
    const nuevoUsuario = Usuario.buscarPorId(info.lastInsertRowid)
    
    if (rol === 'colaborador') {
      // Generar código de 6 dígitos
      const codigoAcceso = String(Math.floor(100000 + Math.random() * 900000))
      nuevoUsuario.codigoAcceso = codigoAcceso
    }

    return nuevoUsuario
  }

  // Buscar usuario por ID
  static buscarPorId(id) {
    const db = dbManager.getDatabase()
    const stmt = db.prepare(`
      SELECT 
        id, nombreUsuario, nombre, email, telefono, rol, 
        contablePrincipalId, activo, ultimoAcceso, configuracion,
        limiteColaboradores, createdAt, updatedAt
      FROM usuarios WHERE id = ?
    `)
    const usuario = stmt.get(id)

    if (usuario) {
      usuario.configuracion = JSON.parse(usuario.configuracion || '{}')
      delete usuario.password
      // Alias para compatibilidad con frontend que espera _id
      usuario._id = usuario.id
    }

    return usuario
  }

  // Buscar usuario por credencial (email o nombre de usuario)
  static buscarPorCredencial(credencial) {
    const db = dbManager.getDatabase()
    const stmt = db.prepare(`
      SELECT * FROM usuarios WHERE (email = ? OR nombreUsuario = ?) AND activo = 1
    `)
    const usuario = stmt.get(credencial, credencial)

    if (usuario) {
      usuario.configuracion = JSON.parse(usuario.configuracion || '{}')
      // Alias para compatibilidad con frontend que espera _id
      usuario._id = usuario.id
    }

    return usuario
  }

  // Buscar usuario por email
  static buscarPorEmail(email) {
    const db = dbManager.getDatabase()
    const stmt = db.prepare(`
      SELECT * FROM usuarios WHERE email = ? AND activo = 1
    `)
    const usuario = stmt.get(email)

    if (usuario) {
      usuario.configuracion = JSON.parse(usuario.configuracion || '{}')
      // Alias para compatibilidad con frontend que espera _id
      usuario._id = usuario.id
    }

    return usuario
  }

  // Buscar por nombre de usuario
  static buscarPorNombreUsuario(nombreUsuario) {
    const db = dbManager.getDatabase()
    const stmt = db.prepare(`
      SELECT * FROM usuarios WHERE nombreUsuario = ? AND activo = 1
    `)
    const usuario = stmt.get(nombreUsuario)

    if (usuario) {
      usuario.configuracion = JSON.parse(usuario.configuracion || '{}')
      // Alias para compatibilidad con frontend que espera _id
      usuario._id = usuario.id
    }

    return usuario
  }

  // Contar colaboradores (rol=colaborador) de un contador/contable
  static contarColaboradores(contadorId) {
    const db = dbManager.getDatabase()
    const stmt = db.prepare(`
      SELECT COUNT(*) as total FROM usuarios
      WHERE contablePrincipalId = ? AND rol = 'colaborador' AND activo = 1
    `)
    return (stmt.get(contadorId)?.total) || 0
  }

  // Buscar todos los usuarios activos
  static buscarActivos() {
    const db = dbManager.getDatabase()
    const stmt = db.prepare(`
      SELECT 
        id, nombreUsuario, nombre, email, telefono, rol, 
        contablePrincipalId, activo, ultimoAcceso,
        createdAt, updatedAt
      FROM usuarios WHERE activo = 1
      ORDER BY nombre
    `)
    return stmt.all()
  }

  // Buscar subordinados de un contable
  static buscarSubordinados(contableId) {
    const db = dbManager.getDatabase()
    const stmt = db.prepare(`
      SELECT 
        id, nombreUsuario, nombre, email, telefono, rol, 
        contablePrincipalId, activo, ultimoAcceso, limiteColaboradores,
        createdAt, updatedAt
      FROM usuarios 
      WHERE contablePrincipalId = ? AND activo = 1
      ORDER BY nombre
    `)
    return stmt.all(contableId)
  }

  // Verificar si un usuario es subordinado de otro
  static esSubordinado(usuarioId, contableId) {
    const db = dbManager.getDatabase()
    const stmt = db.prepare(`
      SELECT COUNT(*) as count
      FROM usuarios
      WHERE id = ? AND contablePrincipalId = ? AND activo = 1
    `)
    const result = stmt.get(usuarioId, contableId)
    return result.count > 0
  }

  // Actualizar usuario
  static actualizar(id, datos) {
    const db = dbManager.getDatabase()

    const campos = []
    const valores = []

    if (datos.nombreUsuario !== undefined) {
      campos.push('nombreUsuario = ?')
      valores.push(datos.nombreUsuario)
    }
    if (datos.nombre !== undefined) {
      campos.push('nombre = ?')
      valores.push(datos.nombre)
    }
    if (datos.email !== undefined) {
      campos.push('email = ?')
      valores.push(datos.email)
    }
    if (datos.telefono !== undefined) {
      campos.push('telefono = ?')
      valores.push(datos.telefono)
    }
    if (datos.rol !== undefined) {
      campos.push('rol = ?')
      valores.push(datos.rol)
    }
    if (datos.contablePrincipalId !== undefined) {
      campos.push('contablePrincipalId = ?')
      valores.push(datos.contablePrincipalId)
    }
    if (datos.configuracion !== undefined) {
      campos.push('configuracion = ?')
      valores.push(JSON.stringify(datos.configuracion))
    }
    if (datos.limiteColaboradores !== undefined) {
      campos.push('limiteColaboradores = ?')
      valores.push(datos.limiteColaboradores == null ? null : Number(datos.limiteColaboradores))
    }

    if (campos.length === 0) {
      return Usuario.buscarPorId(id)
    }

    valores.push(id)

    const stmt = db.prepare(`
      UPDATE usuarios 
      SET ${campos.join(', ')}
      WHERE id = ?
    `)

    stmt.run(...valores)
    return Usuario.buscarPorId(id)
  }

  // Actualizar contraseña
  static actualizarPassword(id, nuevoPassword) {
    const db = dbManager.getDatabase()
    const passwordHash = bcrypt.hashSync(nuevoPassword, 10)

    const stmt = db.prepare('UPDATE usuarios SET password = ? WHERE id = ?')
    stmt.run(passwordHash, id)

    return true
  }

  // Comparar contraseña
  static compararPassword(passwordPlano, passwordHash) {
    return bcrypt.compareSync(passwordPlano, passwordHash)
  }

  // Desactivar usuario
  static desactivar(id) {
    const db = dbManager.getDatabase()
    const stmt = db.prepare('UPDATE usuarios SET activo = 0 WHERE id = ?')
    stmt.run(id)
    return true
  }

  // Activar usuario
  static activar(id) {
    const db = dbManager.getDatabase()
    const stmt = db.prepare('UPDATE usuarios SET activo = 1 WHERE id = ?')
    stmt.run(id)
    return Usuario.buscarPorId(id)
  }

  // Actualizar último acceso
  static actualizarUltimoAcceso(id) {
    const db = dbManager.getDatabase()
    const stmt = db.prepare(`
      UPDATE usuarios 
      SET ultimoAcceso = CURRENT_TIMESTAMP 
      WHERE id = ?
    `)
    stmt.run(id)
  }

  // ===== GESTIÓN DE REFRESH TOKENS =====

  // Agregar refresh token
  static agregarRefreshToken(usuarioId, token, expiraEn) {
    const db = dbManager.getDatabase()
    const stmt = db.prepare(`
      INSERT INTO refresh_tokens (usuarioId, token, expiraEn)
      VALUES (?, ?, ?)
    `)
    stmt.run(usuarioId, token, expiraEn)
  }

  // Buscar refresh token
  static buscarRefreshToken(token) {
    const db = dbManager.getDatabase()
    const stmt = db.prepare(`
      SELECT rt.*, u.id as usuarioId, u.email, u.rol, u.nombre
      FROM refresh_tokens rt
      INNER JOIN usuarios u ON rt.usuarioId = u.id
      WHERE rt.token = ? AND u.activo = 1
    `)
    return stmt.get(token)
  }

  // Remover refresh token específico
  static removerRefreshToken(token) {
    const db = dbManager.getDatabase()
    const stmt = db.prepare('DELETE FROM refresh_tokens WHERE token = ?')
    stmt.run(token)
  }

  // Remover todos los refresh tokens de un usuario
  static removerTodosRefreshTokens(usuarioId) {
    const db = dbManager.getDatabase()
    const stmt = db.prepare('DELETE FROM refresh_tokens WHERE usuarioId = ?')
    stmt.run(usuarioId)
  }

  // Limpiar tokens expirados
  static limpiarTokensExpirados() {
    const db = dbManager.getDatabase()
    const stmt = db.prepare(`
      DELETE FROM refresh_tokens 
      WHERE expiraEn < datetime('now')
    `)
    const info = stmt.run()
    return info.changes
  }

  // Obtener estadísticas
  static obtenerEstadisticas() {
    const db = dbManager.getDatabase()
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN activo = 1 THEN 1 ELSE 0 END) as activos,
        SUM(CASE WHEN rol = 'administrador' THEN 1 ELSE 0 END) as administradores,
        SUM(CASE WHEN rol = 'contable' OR rol = 'contador' THEN 1 ELSE 0 END) as contables,
        SUM(CASE WHEN rol = 'colaborador' THEN 1 ELSE 0 END) as colaboradores
      FROM usuarios
    `)
    return stmt.get()
  }
}

export default Usuario
