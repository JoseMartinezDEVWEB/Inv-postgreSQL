/**
 * Utilidades para trabajar con JWT
 */

/**
 * Decodifica un JWT sin verificar la firma
 * @param {string} token - El token JWT
 * @returns {object|null} - El payload decodificado o null si es inválido
 */
export const decodeJWT = (token) => {
  if (!token || typeof token !== 'string') {
    return null
  }

  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      return null
    }

    // Decodificar el payload (segunda parte)
    const payload = parts[1]
    
    // Reemplazar caracteres no-base64
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    
    // Añadir padding si es necesario
    const paddedBase64 = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=')
    
    // Decodificar de base64
    const jsonPayload = atob(paddedBase64)
    
    return JSON.parse(jsonPayload)
  } catch (error) {
    console.error('Error decodificando JWT:', error)
    return null
  }
}

/**
 * Verifica si un token JWT ha expirado
 * @param {string} token - El token JWT
 * @param {number} bufferSeconds - Segundos de buffer antes de la expiración (default 60)
 * @returns {boolean} - true si está expirado o inválido
 */
export const isTokenExpired = (token, bufferSeconds = 60) => {
  const decoded = decodeJWT(token)
  
  if (!decoded || !decoded.exp) {
    return true // Si no se puede decodificar o no tiene exp, considerarlo expirado
  }

  const now = Math.floor(Date.now() / 1000) // Timestamp actual en segundos
  const expiresAt = decoded.exp
  
  // Considerar expirado si falta menos del buffer (default 60 segundos)
  return now >= (expiresAt - bufferSeconds)
}

/**
 * Obtiene el tiempo restante hasta la expiración en segundos
 * @param {string} token - El token JWT
 * @returns {number} - Segundos hasta expiración, o -1 si ya expiró/es inválido
 */
export const getTokenTimeToExpire = (token) => {
  const decoded = decodeJWT(token)
  
  if (!decoded || !decoded.exp) {
    return -1
  }

  const now = Math.floor(Date.now() / 1000)
  const expiresAt = decoded.exp
  const timeLeft = expiresAt - now
  
  return timeLeft > 0 ? timeLeft : -1
}

/**
 * Obtiene información útil del token
 * @param {string} token - El token JWT
 * @returns {object|null} - Información del token o null
 */
export const getTokenInfo = (token) => {
  const decoded = decodeJWT(token)
  
  if (!decoded) {
    return null
  }

  const now = Math.floor(Date.now() / 1000)
  const timeToExpire = decoded.exp ? decoded.exp - now : null

  return {
    userId: decoded.id || decoded.sub || null,
    email: decoded.email || null,
    role: decoded.rol || decoded.role || null,
    issuedAt: decoded.iat ? new Date(decoded.iat * 1000) : null,
    expiresAt: decoded.exp ? new Date(decoded.exp * 1000) : null,
    timeToExpire: timeToExpire,
    isExpired: timeToExpire !== null ? timeToExpire <= 0 : true,
    payload: decoded,
  }
}

export default {
  decodeJWT,
  isTokenExpired,
  getTokenTimeToExpire,
  getTokenInfo,
}










