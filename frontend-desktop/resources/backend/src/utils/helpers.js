// Funciones auxiliares útiles

// Respuesta exitosa estandarizada
export const respuestaExito = (datos, mensaje = 'Operación exitosa') => {
  return {
    exito: true,
    mensaje,
    datos,
  }
}

// Respuesta de error estandarizada
export const respuestaError = (mensaje = 'Error en la operación', detalles = null) => {
  return {
    exito: false,
    mensaje,
    ...(detalles && { detalles }),
  }
}

// Validar formato de email
export const esEmailValido = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return regex.test(email)
}

// Sanitizar nombre de usuario
export const sanitizarNombreUsuario = (nombre) => {
  return nombre
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
}

// Generar código aleatorio
export const generarCodigoAleatorio = (longitud = 8) => {
  const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let codigo = ''
  for (let i = 0; i < longitud; i++) {
    codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length))
  }
  return codigo
}

// Formatear fecha para SQL
export const formatearFechaSQL = (fecha) => {
  if (!fecha) return null
  const d = new Date(fecha)
  return d.toISOString()
}

// Parsear JSON seguro
export const parsearJSON = (json, valorPorDefecto = {}) => {
  try {
    return JSON.parse(json)
  } catch (error) {
    return valorPorDefecto
  }
}

// Calcular tiempo transcurrido en formato legible
export const tiempoTranscurrido = (fechaInicio, fechaFin = new Date()) => {
  const diff = Math.abs(new Date(fechaFin) - new Date(fechaInicio))
  const minutos = Math.floor(diff / 60000)
  const horas = Math.floor(minutos / 60)
  const dias = Math.floor(horas / 24)

  if (dias > 0) return `${dias} día${dias > 1 ? 's' : ''}`
  if (horas > 0) return `${horas} hora${horas > 1 ? 's' : ''}`
  if (minutos > 0) return `${minutos} minuto${minutos > 1 ? 's' : ''}`
  return 'Recién'
}

// Redondear a 2 decimales
export const redondear = (numero, decimales = 2) => {
  return Math.round(numero * Math.pow(10, decimales)) / Math.pow(10, decimales)
}

// Paginar resultados
export const calcularPaginacion = (total, pagina, limite) => {
  return {
    total,
    pagina: parseInt(pagina),
    limite: parseInt(limite),
    totalPaginas: Math.ceil(total / limite),
    tienePaginaAnterior: pagina > 1,
    tienePaginaSiguiente: pagina < Math.ceil(total / limite),
  }
}

// Extraer campos permitidos de un objeto
export const extraerCampos = (objeto, camposPermitidos) => {
  const resultado = {}
  camposPermitidos.forEach(campo => {
    if (objeto.hasOwnProperty(campo)) {
      resultado[campo] = objeto[campo]
    }
  })
  return resultado
}

// Validar ID numérico
export const esIdValido = (id) => {
  const numId = parseInt(id)
  return !isNaN(numId) && numId > 0
}
