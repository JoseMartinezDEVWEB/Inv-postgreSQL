// Script de depuración para limpiar datos corruptos del localStorage
// Ejecutar en la consola del navegador si hay problemas de autenticación

function clearCorruptedAuthData() {
  console.log('🧹 Limpiando datos de autenticación corruptos...')
  
  const token = localStorage.getItem('accessToken')
  const refreshToken = localStorage.getItem('refreshToken')
  const user = localStorage.getItem('user')
  
  console.log('Datos actuales en localStorage:')
  console.log('Token:', token)
  console.log('RefreshToken:', refreshToken)
  console.log('User:', user)
  
  // Verificar si hay datos corruptos
  const hasCorruptedData = 
    token === 'undefined' || 
    refreshToken === 'undefined' || 
    user === 'undefined' ||
    token === 'null' ||
    refreshToken === 'null' ||
    user === 'null'
  
  if (hasCorruptedData) {
    console.log('⚠️ Se encontraron datos corruptos, limpiando...')
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
    console.log('✅ Datos corruptos eliminados')
    console.log('🔄 Recarga la página para continuar')
  } else {
    console.log('✅ No se encontraron datos corruptos')
  }
}

// Función para verificar el estado de autenticación
function checkAuthStatus() {
  console.log('🔍 Verificando estado de autenticación...')
  
  const token = localStorage.getItem('accessToken')
  const refreshToken = localStorage.getItem('refreshToken')
  const user = localStorage.getItem('user')
  
  console.log('Estado actual:')
  console.log('- Token presente:', !!token)
  console.log('- RefreshToken presente:', !!refreshToken)
  console.log('- User presente:', !!user)
  
  if (token && refreshToken && user) {
    try {
      const userData = JSON.parse(user)
      console.log('- User data válido:', true)
      console.log('- User data:', userData)
    } catch (error) {
      console.log('- User data válido:', false)
      console.log('- Error:', error.message)
    }
  }
}

// Exportar funciones para uso en consola
window.clearCorruptedAuthData = clearCorruptedAuthData
window.checkAuthStatus = checkAuthStatus

console.log('🛠️ Scripts de depuración cargados:')
console.log('- clearCorruptedAuthData() - Limpia datos corruptos')
console.log('- checkAuthStatus() - Verifica estado de autenticación')