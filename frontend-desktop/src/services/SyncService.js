import api from './api'

/**
 * Servicio de Sincronización para Desktop (Electron)
 * Maneja la sincronización entre el cliente y el servidor
 * 
 * Arquitectura Desktop:
 * 1. IndexedDB como almacenamiento local
 * 2. Sincronización bidireccional con el servidor
 * 3. Cola de operaciones pendientes
 */

// Nombre de la base de datos IndexedDB
const DB_NAME = 'j4pro_desktop_db'
const DB_VERSION = 2

// Stores (tablas) de IndexedDB
const STORES = {
  clientes: 'clientes',
  productos: 'productos',
  sesiones: 'sesiones',
  productos_contados: 'productos_contados',
  sync_queue: 'sync_queue',
  config: 'config'
}

class SyncService {
  constructor() {
    this.db = null
    this.isProcessing = false
    this.isPulling = false
    this.syncInterval = null
    this.pullInterval = null
    this.listeners = []
    this.deviceId = null
    this.lastSyncTimestamp = 0
    this.businessId = null
    this.isOnline = navigator.onLine
  }

  /**
   * Inicializar el servicio de sincronización
   */
  async initialize(userId, businessId) {
    console.log('🔄 Inicializando SyncService Desktop...')
    
    this.businessId = businessId
    
    // Abrir/crear base de datos IndexedDB
    await this.openDatabase()
    
    // Generar o recuperar deviceId único
    let deviceId = await this.getConfig('device_id')
    if (!deviceId) {
      deviceId = `desktop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      await this.setConfig('device_id', deviceId)
    }
    this.deviceId = deviceId
    
    // Recuperar último timestamp de sincronización
    const lastSync = await this.getConfig('last_sync_timestamp')
    this.lastSyncTimestamp = lastSync || 0
    
    console.log(`   💻 Device ID: ${this.deviceId}`)
    console.log(`   🏢 Business ID: ${this.businessId}`)
    console.log(`   ⏰ Última sync: ${new Date(this.lastSyncTimestamp).toLocaleString()}`)
    
    // Escuchar cambios de conexión
    window.addEventListener('online', () => {
      this.isOnline = true
      console.log('📶 Conexión recuperada')
      this.syncWithCloud()
    })
    window.addEventListener('offline', () => {
      this.isOnline = false
      console.log('📴 Conexión perdida')
    })
  }

  /**
   * Abrir base de datos IndexedDB
   */
  async openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      
      request.onerror = () => reject(request.error)
      
      request.onsuccess = () => {
        this.db = request.result
        console.log('✅ IndexedDB abierta')
        resolve(this.db)
      }
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result
        
        // Crear stores si no existen
        if (!db.objectStoreNames.contains(STORES.clientes)) {
          const store = db.createObjectStore(STORES.clientes, { keyPath: '_id' })
          store.createIndex('id_uuid', 'id_uuid', { unique: true })
          store.createIndex('is_dirty', 'is_dirty')
          store.createIndex('business_id', 'business_id')
        }
        
        if (!db.objectStoreNames.contains(STORES.productos)) {
          const store = db.createObjectStore(STORES.productos, { keyPath: '_id' })
          store.createIndex('id_uuid', 'id_uuid', { unique: true })
          store.createIndex('is_dirty', 'is_dirty')
          store.createIndex('business_id', 'business_id')
        }
        
        if (!db.objectStoreNames.contains(STORES.sesiones)) {
          const store = db.createObjectStore(STORES.sesiones, { keyPath: '_id' })
          store.createIndex('id_uuid', 'id_uuid', { unique: true })
          store.createIndex('is_dirty', 'is_dirty')
          store.createIndex('business_id', 'business_id')
        }
        
        if (!db.objectStoreNames.contains(STORES.productos_contados)) {
          const store = db.createObjectStore(STORES.productos_contados, { keyPath: 'id', autoIncrement: true })
          store.createIndex('id_uuid', 'id_uuid', { unique: true })
          store.createIndex('sesionId', 'sesionId')
          store.createIndex('is_dirty', 'is_dirty')
        }
        
        if (!db.objectStoreNames.contains(STORES.sync_queue)) {
          const store = db.createObjectStore(STORES.sync_queue, { keyPath: 'id', autoIncrement: true })
          store.createIndex('estado', 'estado')
          store.createIndex('tipo', 'tipo')
        }
        
        if (!db.objectStoreNames.contains(STORES.config)) {
          db.createObjectStore(STORES.config, { keyPath: 'key' })
        }
        
        console.log('✅ Stores de IndexedDB creados')
      }
    })
  }

  /**
   * Iniciar el motor de sincronización
   */
  start() {
    console.log('🚀 Iniciando motor de sincronización Desktop...')
    
    // Intervalo de push (cada 30 segundos)
    this.syncInterval = setInterval(() => {
      if (this.isOnline) this.syncWithCloud()
    }, 30000)

    // Intervalo de pull (cada 2 minutos)
    this.pullInterval = setInterval(() => {
      if (this.isOnline) this.pullUpdates()
    }, 120000)

    // Sincronización inicial
    setTimeout(() => {
      if (this.isOnline) this.syncWithCloud()
    }, 2000)
  }

  /**
   * Detener el motor de sincronización
   */
  stop() {
    console.log('⏹️ Deteniendo motor de sincronización Desktop...')
    if (this.syncInterval) clearInterval(this.syncInterval)
    if (this.pullInterval) clearInterval(this.pullInterval)
  }

  // ========== OPERACIONES DE INDEXEDDB ==========

  async getConfig(key) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORES.config, 'readonly')
      const store = tx.objectStore(STORES.config)
      const request = store.get(key)
      request.onsuccess = () => resolve(request.result?.value)
      request.onerror = () => reject(request.error)
    })
  }

  async setConfig(key, value) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORES.config, 'readwrite')
      const store = tx.objectStore(STORES.config)
      const request = store.put({ key, value, updatedAt: Date.now() })
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getAll(storeName) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly')
      const store = tx.objectStore(storeName)
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
  }

  async getDirtyRecords(storeName) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly')
      const store = tx.objectStore(storeName)
      const index = store.index('is_dirty')
      const request = index.getAll(1)
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
  }

  async put(storeName, record) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite')
      const store = tx.objectStore(storeName)
      const request = store.put(record)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async delete(storeName, key) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite')
      const store = tx.objectStore(storeName)
      const request = store.delete(key)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  // ========== SINCRONIZACIÓN ==========

  /**
   * PUSH: Enviar cambios locales al servidor
   */
  async syncWithCloud() {
    if (this.isProcessing || !this.isOnline) return
    
    this.isProcessing = true
    console.log('☁️ Iniciando PUSH de sincronización Desktop...')

    try {
      // Verificar conexión con el backend
      try {
        await api.get('/salud', { timeout: 5000 })
      } catch (e) {
        console.log('⚠️ Backend no disponible')
        this.isProcessing = false
        return
      }

      // Obtener registros sucios
      const cambios = {}
      
      const clientesDirty = await this.getDirtyRecords(STORES.clientes)
      if (clientesDirty.length > 0) cambios.clientes = clientesDirty
      
      const productosDirty = await this.getDirtyRecords(STORES.productos)
      if (productosDirty.length > 0) cambios.productos = productosDirty
      
      const sesionesDirty = await this.getDirtyRecords(STORES.sesiones)
      if (sesionesDirty.length > 0) cambios.sesiones = sesionesDirty
      
      const conteosDirty = await this.getDirtyRecords(STORES.productos_contados)
      if (conteosDirty.length > 0) cambios.productos_contados = conteosDirty

      const tablas = Object.keys(cambios)
      if (tablas.length === 0) {
        console.log('✅ Nada pendiente de sincronizar')
        this.isProcessing = false
        return
      }

      console.log(`📦 Cambios pendientes: ${tablas.join(', ')}`)

      // Enviar al servidor
      const response = await api.post('/sync/batch', {
        changes: cambios,
        deviceId: this.deviceId,
        timestamp: Date.now()
      })

      if (response.data.exito) {
        // Marcar como sincronizados
        for (const tabla of tablas) {
          for (const record of cambios[tabla]) {
            record.is_dirty = 0
            record.sync_status = 'synced'
            await this.put(STORES[tabla] || tabla, record)
          }
        }
        
        this.lastSyncTimestamp = response.data.datos.serverTimestamp || Date.now()
        await this.setConfig('last_sync_timestamp', this.lastSyncTimestamp)
        
        console.log('✅ PUSH completado')
        this.notificarListeners({ tipo: 'sync_success', direction: 'push' })
      }

    } catch (error) {
      console.error('❌ Error en PUSH:', error.message)
      this.notificarListeners({ tipo: 'sync_error', error: error.message })
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * PULL: Descargar cambios del servidor
   */
  async pullUpdates() {
    if (this.isPulling || !this.isOnline) return

    this.isPulling = true
    console.log('📥 Iniciando PULL Desktop...')

    try {
      const response = await api.get('/sync/pull', {
        params: {
          lastSync: this.lastSyncTimestamp,
          tables: 'clientes,productos,sesiones'
        }
      })

      if (response.data.exito) {
        const { updates, serverTimestamp } = response.data.datos
        let totalUpdates = 0

        // Aplicar actualizaciones
        if (updates.clientes) {
          for (const cliente of updates.clientes) {
            const existing = await this.getByUUID(STORES.clientes, cliente.uuid || cliente.id_uuid)
            if (!existing || !existing.is_dirty) {
              await this.put(STORES.clientes, {
                ...cliente,
                _id: cliente._id || cliente.id,
                id_uuid: cliente.uuid || cliente.id_uuid,
                is_dirty: 0,
                sync_status: 'synced'
              })
              totalUpdates++
            }
          }
        }

        if (updates.productos) {
          for (const producto of updates.productos) {
            const existing = await this.getByUUID(STORES.productos, producto.uuid || producto.id_uuid)
            if (!existing || !existing.is_dirty) {
              await this.put(STORES.productos, {
                ...producto,
                _id: producto._id || producto.id,
                id_uuid: producto.uuid || producto.id_uuid,
                is_dirty: 0,
                sync_status: 'synced'
              })
              totalUpdates++
            }
          }
        }

        if (updates.sesiones) {
          for (const sesion of updates.sesiones) {
            const existing = await this.getByUUID(STORES.sesiones, sesion.uuid || sesion.id_uuid)
            if (!existing || !existing.is_dirty) {
              await this.put(STORES.sesiones, {
                ...sesion,
                _id: sesion._id || sesion.id,
                id_uuid: sesion.uuid || sesion.id_uuid,
                is_dirty: 0,
                sync_status: 'synced'
              })
              totalUpdates++
            }
          }
        }

        this.lastSyncTimestamp = serverTimestamp
        await this.setConfig('last_sync_timestamp', serverTimestamp)

        if (totalUpdates > 0) {
          console.log(`✅ PULL completado: ${totalUpdates} registros`)
          this.notificarListeners({ tipo: 'sync_success', direction: 'pull', count: totalUpdates })
        }
      }

    } catch (error) {
      console.error('❌ Error en PULL:', error.message)
    } finally {
      this.isPulling = false
    }
  }

  async getByUUID(storeName, uuid) {
    if (!uuid) return null
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly')
      const store = tx.objectStore(storeName)
      const index = store.index('id_uuid')
      const request = index.get(uuid)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  // ========== OPERACIONES CRUD CON OPTIMISTIC UI ==========

  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }

  /**
   * Crear cliente localmente (Optimistic UI)
   */
  async createClienteLocal(clienteData) {
    const uuid = this.generateUUID()
    const id = uuid
    const timestamp = Date.now()

    const cliente = {
      ...clienteData,
      _id: id,
      id_uuid: uuid,
      is_dirty: 1,
      sync_status: 'pending',
      business_id: this.businessId,
      last_updated: timestamp,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    await this.put(STORES.clientes, cliente)
    
    // Disparar sync en segundo plano
    if (this.isOnline) {
      setTimeout(() => this.syncWithCloud(), 100)
    }

    return cliente
  }

  /**
   * Obtener estadísticas de sincronización
   */
  async obtenerEstadisticas() {
    const clientesDirty = await this.getDirtyRecords(STORES.clientes)
    const productosDirty = await this.getDirtyRecords(STORES.productos)
    const sesionesDirty = await this.getDirtyRecords(STORES.sesiones)
    
    return {
      pendientes: clientesDirty.length + productosDirty.length + sesionesDirty.length,
      clientes: clientesDirty.length,
      productos: productosDirty.length,
      sesiones: sesionesDirty.length,
      lastSync: this.lastSyncTimestamp,
      isOnline: this.isOnline
    }
  }

  // ========== LISTENERS ==========
  
  addListener(callback) {
    this.listeners.push(callback)
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback)
    }
  }

  notificarListeners(evento) {
    this.listeners.forEach(cb => {
      try { cb(evento) } catch (e) { console.error(e) }
    })
  }
}

// Exportar instancia singleton
const syncService = new SyncService()
export default syncService



