import NetInfo from '@react-native-community/netinfo'
import axios from 'axios'

// Crear instancia limpia de axios para descubrimiento de red (sin interceptores ni baseURL global)
// Esto evita conflictos con la configuración de api.js
const cleanAxios = axios.create({
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
  },
})

/**
 * Servicio de Descubrimiento de Red Local
 * Permite encontrar el servidor backend en la red local
 */
class NetworkDiscoveryService {
  constructor() {
    this.servidoresEncontrados = []
    this.isScanning = false
  }

  /**
   * Obtener la IP local del dispositivo
   */
  async obtenerIPLocal() {
    try {
      const state = await NetInfo.fetch()

      if (!state.isConnected) {
        throw new Error('No hay conexión de red')
      }

      // Obtener detalles de la conexión
      const ipAddress = state.details?.ipAddress
      const subnet = state.details?.subnet

      return {
        ip: ipAddress,
        subnet: subnet,
        tipo: state.type, // wifi, cellular, etc.
      }
    } catch (error) {
      console.error('Error obteniendo IP local:', error)
      return null
    }
  }

  /**
   * Escanear red local en busca del servidor
   * Busca en el rango 192.168.x.1-254 en los puertos comunes
   */
  async escanearRedLocal(
    puertos = [4500, 4000, 4001, 4002, 4003, 4004, 4005, 4006, 4007, 4008, 4009, 4010, 3000, 3001, 5000, 8000, 8080, 8081]
  ) {
    if (this.isScanning) {
      console.log('⚠️ Ya hay un escaneo en curso')
      return this.servidoresEncontrados
    }

    this.isScanning = true
    this.servidoresEncontrados = []

    console.log('🔍 Iniciando escaneo de red local...')

    try {
      const infoRed = await this.obtenerIPLocal()

      if (!infoRed || !infoRed.ip) {
        throw new Error('No se pudo obtener la IP local')
      }

      // Extraer los primeros 3 octetos de la IP (ej: 192.168.1)
      const partes = infoRed.ip.split('.')
      const baseIP = `${partes[0]}.${partes[1]}.${partes[2]}`

      console.log(`📡 Base IP detectada: ${baseIP}.x`)

      // IPs comunes a probar primero (routers y servidores típicos)
      const ipsComunes = [1, 100, 101, 102, 10, 20, 50]

      // Agregar la IP actual del dispositivo a la lista
      const currentLastOctet = parseInt(partes[3])
      if (!ipsComunes.includes(currentLastOctet)) {
        ipsComunes.push(currentLastOctet)
      }

      // Probar IPs comunes primero
      for (const lastOctet of ipsComunes) {
        if (!this.isScanning) break

        const ip = `${baseIP}.${lastOctet}`
        await this.probarServidor(ip, puertos)
      }

      console.log(`✅ Escaneo completado: ${this.servidoresEncontrados.length} servidor(es) encontrado(s)`)
      return this.servidoresEncontrados
    } catch (error) {
      console.error('❌ Error escaneando red:', error)
      return []
    } finally {
      this.isScanning = false
    }
  }

  /**
   * Probar si hay un servidor en una IP:puerto específico
   */
  async probarServidor(ip, puertos) {
    for (const puerto of puertos) {
      if (!this.isScanning) break

      try {
        const url = `http://${ip}:${puerto}/api/info-conexion`

        // Timeout corto para no esperar mucho
        // IMPORTANTE: Usar cleanAxios para evitar conflictos con interceptores de api.js
        const response = await cleanAxios.get(url, {
          timeout: 2000,
          validateStatus: () => true, // Aceptar cualquier status
        })

        if (response.status === 200 && response.data?.ok) {
          const info = response.data || {}
          const puertoReal = Number(info.puerto) || puerto
          console.log(`✅ Servidor encontrado: ${ip}:${puertoReal}`)

          this.servidoresEncontrados.push({
            ip,
            puerto: puertoReal,
            url: `http://${ip}:${puertoReal}`,
            nombre: 'Servidor J4 Pro (Desktop)',
            version: info.nodeEnv || 'Desconocida',
            timestamp: new Date().toISOString(),
          })

          return true
        }
      } catch (error) {
        // Silenciar errores de conexión (esperados para IPs sin servidor)
        // Solo logear si no es error de timeout o conexión
        if (error.code !== 'ECONNABORTED' && error.code !== 'ETIMEDOUT') {
          // console.log(`⚠️ Error probando ${ip}:${puerto}:`, error.message)
        }
      }
    }

    return false
  }

  /**
   * Detener escaneo en curso
   */
  detenerEscaneo() {
    console.log('⏸️ Deteniendo escaneo de red...')
    this.isScanning = false
  }

  /**
   * Probar conexión directa a una IP específica
   */
  async probarConexionDirecta(ip, puerto = 3000) {
    try {
      const url = `http://${ip}:${puerto}/api/info-conexion`

      // IMPORTANTE: Usar cleanAxios para evitar conflictos con interceptores de api.js
      const response = await cleanAxios.get(url, {
        timeout: 5000,
      })

      if (response.status === 200 && response.data?.ok) {
        const puertoReal = Number(response.data.puerto) || puerto
        console.log(`✅ Conexión exitosa a ${ip}:${puertoReal}`)
        return {
          exito: true,
          servidor: {
            ip,
            puerto: puertoReal,
            url: `http://${ip}:${puertoReal}`,
            nombre: 'Servidor J4 Pro (Desktop)',
            version: response.data.nodeEnv || 'Desconocida',
          },
        }
      }

      return { exito: false, error: 'Respuesta inválida del servidor' }
    } catch (error) {
      console.error(`❌ Error conectando a ${ip}:${puerto}:`, error.message)
      return { exito: false, error: error.message }
    }
  }

  /**
   * Obtener servidores encontrados en el último escaneo
   */
  obtenerServidoresEncontrados() {
    return this.servidoresEncontrados
  }

  /**
   * Limpiar lista de servidores encontrados
   */
  limpiarServidores() {
    this.servidoresEncontrados = []
  }

  /**
   * Verificar si un servidor específico sigue disponible
   */
  async verificarDisponibilidad(servidor) {
    try {
      // IMPORTANTE: Usar cleanAxios para evitar conflictos con interceptores de api.js
      const response = await cleanAxios.get(`${servidor.url}/api/salud`, {
        timeout: 3000,
      })

      return response.status === 200
    } catch (error) {
      return false
    }
  }
}

// Exportar instancia singleton
const networkDiscoveryService = new NetworkDiscoveryService()

export default networkDiscoveryService










