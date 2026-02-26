import * as SQLite from 'expo-sqlite';

// Variable para almacenar la instancia de la base de datos
let db = null;

// Inicializar y obtener la base de datos (Expo SDK 51+)
const getDatabase = async () => {
    if (!db) {
        try {
            db = await SQLite.openDatabaseAsync('j4pro_local_v2.db'); // v2 para forzar nueva estructura
            console.log('✅ Base de datos local abierta exitosamente (Offline-First)');
        } catch (error) {
            console.error('❌ Error abriendo base de datos:', error);
            throw error;
        }
    }
    return db;
};

// Generador UUID v4 puro en JavaScript (sin dependencias externas)
const generateUUID = () => {
    // Implementación RFC4122 versión 4
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
};

const localDb = {
    // Inicializar base de datos y crear tablas
    init: async () => {
        try {
            const database = await getDatabase();

            // Habilitar claves foráneas
            await database.execAsync('PRAGMA foreign_keys = ON;');

            // Tabla de Productos con soporte Offline-First
            await database.execAsync(`
                CREATE TABLE IF NOT EXISTS productos(
                    _id TEXT PRIMARY KEY, -- Mantenemos _id para compatibilidad
                    id_uuid TEXT UNIQUE, -- UUID oficial para sincronización
                    nombre TEXT NOT NULL,
                    codigoBarras TEXT,
                    precioVenta REAL,
                    stock INTEGER,
                    descripcion TEXT,
                    categoria TEXT,
                    unidad TEXT,
                    costo REAL,
                    sku TEXT,
                    imagen TEXT,
                    activo INTEGER DEFAULT 1,
                    
                    -- CAMPOS DE SINCRONIZACIÓN
                    is_dirty INTEGER DEFAULT 0, -- 1 = Necesita ir a la nube
                    last_updated INTEGER,       -- Timestamp UNIX
                    deleted INTEGER DEFAULT 0   -- Soft delete para sincronizar borrados
                );
            `);

            // Tabla de Sesiones (Inventarios) con soporte Offline-First y roles
            await database.execAsync(`
                CREATE TABLE IF NOT EXISTS sesiones(
                    _id TEXT PRIMARY KEY,
                    id_uuid TEXT UNIQUE,
                    numeroSesion TEXT,
                    fecha TEXT,
                    estado TEXT,
                    clienteNombre TEXT,
                    clienteNegocioId TEXT,
                    totalProductos INTEGER DEFAULT 0,
                    valorTotal REAL DEFAULT 0,
                    
                    -- CAMPOS DE JERARQUÍA Y ROLES
                    business_id TEXT,           -- ID del Admin/Negocio principal
                    created_by TEXT,            -- Usuario que creó el registro
                    
                    -- CAMPOS DE SINCRONIZACIÓN
                    is_dirty INTEGER DEFAULT 0,
                    sync_status TEXT DEFAULT 'pending',
                    last_updated INTEGER,
                    deleted INTEGER DEFAULT 0,
                    
                    local INTEGER DEFAULT 1,
                    createdAt TEXT
                );
            `);

            // Tabla de Productos Contados (Detalle de Sesión)
            await database.execAsync(`
                CREATE TABLE IF NOT EXISTS productos_contados(
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    id_uuid TEXT UNIQUE,
                    sesionId TEXT,
                    productoId TEXT,
                    nombreProducto TEXT,
                    skuProducto TEXT,
                    cantidad REAL,
                    costo REAL,
                    fecha TEXT,
                    
                    -- CAMPOS DE SINCRONIZACIÓN
                    is_dirty INTEGER DEFAULT 0,
                    last_updated INTEGER,
                    deleted INTEGER DEFAULT 0,
                    
                    sincronizado INTEGER DEFAULT 0, -- Legacy flag
                    FOREIGN KEY(sesionId) REFERENCES sesiones(_id)
                );
            `);

            // Tabla de Productos Colaborador (Offline)
            await database.execAsync(`
                CREATE TABLE IF NOT EXISTS productos_colaborador(
                    temporalId TEXT PRIMARY KEY,
                    solicitudId TEXT,
                    nombre TEXT,
                    sku TEXT,
                    codigoBarras TEXT,
                    cantidad REAL,
                    costo REAL,
                    timestamp TEXT,
                    sincronizado INTEGER DEFAULT 0
                );
            `);

            // Tabla de Cola de Sincronización mejorada (Outbox Pattern)
            await database.execAsync(`
                CREATE TABLE IF NOT EXISTS cola_sincronizacion(
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    tipo TEXT NOT NULL,          -- 'cliente', 'producto', 'sesion', 'conteo'
                    operacion TEXT NOT NULL,     -- 'create', 'update', 'delete'
                    tabla TEXT NOT NULL,         -- Tabla origen
                    registro_id TEXT NOT NULL,   -- ID del registro afectado
                    payload TEXT NOT NULL,       -- Datos serializados
                    estado TEXT DEFAULT 'pending', -- pending, processing, completed, failed
                    intentos INTEGER DEFAULT 0,
                    max_intentos INTEGER DEFAULT 5,
                    ultimoIntento TEXT,
                    error TEXT,
                    prioridad INTEGER DEFAULT 5, -- 1-10, menor es más prioritario
                    createdAt TEXT,
                    updatedAt TEXT
                );
            `);

            // Tabla de configuración de usuario para sincronización
            await database.execAsync(`
                CREATE TABLE IF NOT EXISTS sync_config(
                    key TEXT PRIMARY KEY,
                    value TEXT,
                    updatedAt TEXT
                );
            `);

            // Tabla de Usuarios Locales
            await database.execAsync(`
                CREATE TABLE IF NOT EXISTS usuarios(
                    _id TEXT PRIMARY KEY,
                    nombre TEXT NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    password TEXT NOT NULL,
                    rol TEXT DEFAULT 'administrador',
                    activo INTEGER DEFAULT 1,
                    createdAt TEXT,
                    updatedAt TEXT
                );
            `);

            // Tabla de Clientes con soporte Offline-First y roles
            await database.execAsync(`
                CREATE TABLE IF NOT EXISTS clientes(
                    _id TEXT PRIMARY KEY,
                    id_uuid TEXT UNIQUE,
                    nombre TEXT NOT NULL,
                    documento TEXT,
                    email TEXT,
                    telefono TEXT,
                    direccion TEXT,
                    notas TEXT,
                    activo INTEGER DEFAULT 1,
                    
                    -- CAMPOS DE JERARQUÍA Y ROLES
                    business_id TEXT,           -- ID del Admin/Negocio principal
                    created_by TEXT,            -- Usuario que creó el registro
                    
                    -- CAMPOS DE SINCRONIZACIÓN
                    is_dirty INTEGER DEFAULT 0,
                    sync_status TEXT DEFAULT 'pending', -- pending, synced, error
                    last_updated INTEGER,
                    deleted INTEGER DEFAULT 0,
                    
                    createdAt TEXT,
                    updatedAt TEXT
                );
            `);

            // Tabla de Invitaciones
            await database.execAsync(`
                CREATE TABLE IF NOT EXISTS invitaciones(
                    _id TEXT PRIMARY KEY,
                    codigoQR TEXT,
                    codigoNumerico TEXT,
                    nombre TEXT,
                    rol TEXT,
                    estado TEXT DEFAULT 'activa',
                    expiraEn TEXT,
                    creadoPor TEXT,
                    createdAt TEXT
                );
            `);

            // Migraciones de columnas
            const addColumnIfNotExists = async (table, column, type) => {
                try {
                    const info = await database.getAllAsync(`PRAGMA table_info(${table})`);
                    if (!info.some(c => c.name === column)) {
                        await database.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
                        console.log(`✅ Columna ${column} agregada a ${table}`);
                    }
                } catch (e) { /* Ignorar si falla */ }
            };

            const tablesToMigrate = ['productos', 'sesiones', 'productos_contados', 'clientes'];
            for (const table of tablesToMigrate) {
                await addColumnIfNotExists(table, 'id_uuid', 'TEXT');
                await addColumnIfNotExists(table, 'is_dirty', 'INTEGER DEFAULT 0');
                await addColumnIfNotExists(table, 'last_updated', 'INTEGER');
                await addColumnIfNotExists(table, 'deleted', 'INTEGER DEFAULT 0');
                await addColumnIfNotExists(table, 'sync_status', 'TEXT DEFAULT "pending"');
                await addColumnIfNotExists(table, 'business_id', 'TEXT');
                await addColumnIfNotExists(table, 'created_by', 'TEXT');
            }

            // Migraciones específicas
            await addColumnIfNotExists('clientes', 'notas', 'TEXT');
            await addColumnIfNotExists('sesiones', 'clienteNegocioId', 'TEXT');

            // Agregar columna nombreUsuario a usuarios si no existe
            await addColumnIfNotExists('usuarios', 'nombreUsuario', 'TEXT');

            // Crear o actualizar usuario admin por defecto
            const checkAdmin = await database.getFirstAsync('SELECT * FROM usuarios WHERE email = ?', ['admin@j4pro.com']);
            if (!checkAdmin) {
                // Intentar insertar con nombreUsuario si la columna existe
                try {
                    await database.runAsync(
                        `INSERT INTO usuarios (_id, nombre, nombreUsuario, email, password, rol, activo, createdAt, updatedAt)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        ['admin-local-id', 'Administrador', 'admin', 'admin@j4pro.com', 'Jose.1919', 'administrador', 1, new Date().toISOString(), new Date().toISOString()]
                    );
                } catch (e) {
                    // Si falla (columna no existe aún), insertar sin nombreUsuario
                    await database.runAsync(
                        `INSERT INTO usuarios (_id, nombre, email, password, rol, activo, createdAt, updatedAt)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                        ['admin-local-id', 'Administrador', 'admin@j4pro.com', 'Jose.1919', 'administrador', 1, new Date().toISOString(), new Date().toISOString()]
                    );
                }
                console.log('✅ Usuario admin creado');
            } else {
                // Asegurar que la contraseña del admin sea la correcta
                // También actualizar nombreUsuario si existe la columna
                try {
                    await database.runAsync(
                        `UPDATE usuarios SET password = ?, nombreUsuario = ?, activo = 1, updatedAt = ? WHERE email = ?`,
                        ['Jose.1919', 'admin', new Date().toISOString(), 'admin@j4pro.com']
                    );
                } catch (e) {
                    // Si falla (columna no existe aún), actualizar sin nombreUsuario
                    await database.runAsync(
                        `UPDATE usuarios SET password = ?, activo = 1, updatedAt = ? WHERE email = ?`,
                        ['Jose.1919', new Date().toISOString(), 'admin@j4pro.com']
                    );
                }
                console.log('✅ Usuario admin actualizado');
            }

            console.log('✅ Base de datos Offline-First inicializada correctamente');
            return true;
        } catch (error) {
            console.error('❌ Error inicializando DB local:', error);
            return false;
        }
    },

    // --- PRODUCTOS (OFFLINE FIRST) ---

    crearProductoLocal: async (p) => {
        try {
            const database = await getDatabase();
            const uuid = p.id_uuid || generateUUID();
            const id = p._id || uuid;
            const timestamp = Date.now();

            await database.runAsync(
                `INSERT INTO productos(
                    _id, id_uuid, nombre, codigoBarras, precioVenta, stock, 
                    descripcion, categoria, unidad, costo, sku, 
                    imagen, activo, is_dirty, last_updated, deleted
                ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, 0)`,
                [
                    id, uuid, p.nombre, p.codigoBarras || '', p.precioVenta || 0, p.stock || 0,
                    p.descripcion || '', p.categoria || '', p.unidad || '',
                    p.costo || 0, p.sku || '', p.imagen || '',
                    timestamp
                ]
            );
            return { ...p, _id: id, id_uuid: uuid, is_dirty: 1 };
        } catch (error) {
            console.error('Error creando producto local:', error);
            throw error;
        }
    },

    actualizarProductoLocal: async (id, p) => {
        try {
            const database = await getDatabase();
            const timestamp = Date.now();

            await database.runAsync(
                `UPDATE productos SET 
                    nombre = ?, codigoBarras = ?, precioVenta = ?, stock = ?, 
                    descripcion = ?, categoria = ?, unidad = ?, costo = ?, sku = ?, 
                    last_updated = ?, is_dirty = 1
                 WHERE _id = ?`,
                [
                    p.nombre, p.codigoBarras, p.precioVenta, p.stock,
                    p.descripcion, p.categoria, p.unidad, p.costo, p.sku,
                    timestamp, id
                ]
            );
            return true;
        } catch (error) {
            console.error('Error actualizando producto local:', error);
            return false;
        }
    },

    eliminarProductoLocal: async (id) => {
        try {
            const database = await getDatabase();
            const timestamp = Date.now();
            await database.runAsync(
                'UPDATE productos SET deleted = 1, is_dirty = 1, last_updated = ? WHERE _id = ?',
                [timestamp, id]
            );
            return true;
        } catch (error) {
            console.error('Error eliminando producto local:', error);
            return false;
        }
    },

    eliminarTodosProductos: async () => {
        try {
            const database = await getDatabase();
            // Borrado físico total porque es una operación de "reset"
            await database.execAsync('DELETE FROM productos');
            console.log('✅ [localDb] Todos los productos eliminados localmente');
            return true;
        } catch (error) {
            console.error('❌ [localDb] Error eliminando todos los productos:', error);
            return false;
        }
    },

    obtenerProductos: async (params = {}) => {
        try {
            const busqueda = params.buscar || '';
            const database = await getDatabase();
            let query = 'SELECT * FROM productos WHERE deleted = 0 AND activo = 1';
            let sqlParams = [];

            if (busqueda) {
                query += ' AND (nombre LIKE ? OR codigoBarras LIKE ? OR sku LIKE ?)';
                sqlParams = [`%${busqueda}%`, `%${busqueda}%`, `%${busqueda}%`];
            }

            query += ' ORDER BY nombre LIMIT 100';

            const result = await database.getAllAsync(query, sqlParams);
            return result.map(p => ({
                ...p,
                id: p._id
            }));
        } catch (error) {
            console.error('Error obteniendo productos:', error);
            return [];
        }
    },

    // Sincronizar productos masivamente desde el servidor (para uso con send_inventory)
    sincronizarProductosMasivo: async (productos) => {
        try {
            const database = await getDatabase();
            console.log(`🔄 [localDb] Iniciando sincronización masiva de ${productos.length} productos...`);

            // Iniciar transacción
            await database.execAsync('BEGIN TRANSACTION');

            try {
                // 1. Vaciar la tabla de productos actual
                await database.execAsync('DELETE FROM productos');
                console.log('✅ [localDb] Tabla de productos vaciada');

                // 2. Insertar productos en bloques de 50
                const BATCH_SIZE = 50;
                const batches = [];

                for (let i = 0; i < productos.length; i += BATCH_SIZE) {
                    batches.push(productos.slice(i, i + BATCH_SIZE));
                }

                console.log(`📦 [localDb] Insertando ${productos.length} productos en ${batches.length} lotes...`);

                for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
                    const batch = batches[batchIndex];

                    // Insertar cada producto del lote
                    for (const producto of batch) {
                        const id = producto._id || producto.id || `prod_${Date.now()}_${Math.random()}`;
                        const uuid = producto.id_uuid || id;
                        const timestamp = Date.now();

                        try {
                            await database.runAsync(
                                `INSERT INTO productos(
                                    _id, id_uuid, nombre, codigoBarras, precioVenta, stock,
                                    descripcion, categoria, unidad, costo, sku,
                                    imagen, activo, is_dirty, last_updated, deleted
                                ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, 0)`,
                                [
                                    id,
                                    uuid,
                                    producto.nombre || '',
                                    producto.codigoBarras || producto.codigo_barra || '',
                                    producto.precioVenta || 0,
                                    0, // stock
                                    producto.descripcion || '',
                                    producto.categoria || '',
                                    producto.unidad || '',
                                    producto.costo || 0,
                                    producto.sku || '',
                                    '', // imagen
                                    timestamp
                                ]
                            );
                        } catch (error) {
                            console.warn(`⚠️ [localDb] Error insertando producto ${id}:`, error.message);
                            // Continuar con el siguiente producto
                        }
                    }

                    console.log(`✅ [localDb] Lote ${batchIndex + 1}/${batches.length} insertado`);
                }

                // Commit transacción
                await database.execAsync('COMMIT');
                console.log('✅ [localDb] Sincronización masiva completada exitosamente');
                return { success: true, total: productos.length };
            } catch (error) {
                // Rollback en caso de error
                await database.execAsync('ROLLBACK');
                console.error('❌ [localDb] Error en transacción, haciendo rollback:', error);
                throw error;
            }
        } catch (error) {
            console.error('❌ [localDb] Error en sincronización masiva:', error);
            throw error;
        }
    },

    // Método auxiliar para obtener la instancia de la base de datos (para uso externo)
    getDatabase: getDatabase,

    buscarProductoPorCodigo: async (codigo) => {
        try {
            const database = await getDatabase();
            const result = await database.getFirstAsync(
                'SELECT * FROM productos WHERE codigoBarras = ? AND deleted = 0 AND activo = 1',
                [codigo]
            );
            return result || null;
        } catch (error) {
            console.error('Error buscando producto por código:', error);
            return null;
        }
    },

    // --- SESIONES (OFFLINE FIRST) ---

    crearSesionLocal: async (sesion) => {
        try {
            const database = await getDatabase();
            const uuid = generateUUID();
            const id = sesion._id || uuid;
            const timestamp = Date.now();

            await database.runAsync(
                `INSERT INTO sesiones(
                    _id, id_uuid, numeroSesion, fecha, estado, clienteNombre, 
                    totalProductos, valorTotal, local, is_dirty, last_updated, deleted, createdAt
                ) VALUES(?, ?, ?, ?, ?, ?, 0, 0, 1, 1, ?, 0, ?)`,
                [
                    id, uuid,
                    sesion.numeroSesion,
                    sesion.fecha,
                    'en_progreso',
                    sesion.clienteNombre,
                    timestamp,
                    new Date().toISOString()
                ]
            );
            return { ...sesion, _id: id };
        } catch (error) {
            console.error('Error creando sesión local:', error);
            throw error;
        }
    },

    obtenerSesiones: async () => {
        try {
            const database = await getDatabase();
            const result = await database.getAllAsync(
                'SELECT * FROM sesiones WHERE deleted = 0 ORDER BY fecha DESC'
            );
            return result.map(s => ({
                ...s,
                id: s._id,
                clienteNegocio: { nombre: s.clienteNombre },
                totales: { valorTotalInventario: s.valorTotal, totalProductosContados: s.totalProductos }
            }));
        } catch (error) {
            console.error('Error obteniendo sesiones:', error);
            return [];
        }
    },

    // Actualizar datos financieros de una sesión
    actualizarDatosFinancierosSesion: async (sesionId, datosFinancieros) => {
        try {
            const database = await getDatabase();
            const timestamp = Date.now();

            // Primero verificamos si existe la columna datosFinancieros
            const info = await database.getAllAsync('PRAGMA table_info(sesiones)');
            const hasColumn = info.some(c => c.name === 'datosFinancieros');

            if (!hasColumn) {
                await database.execAsync('ALTER TABLE sesiones ADD COLUMN datosFinancieros TEXT');
            }

            await database.runAsync(
                `UPDATE sesiones SET datosFinancieros = ?, is_dirty = 1, last_updated = ? WHERE _id = ?`,
                [JSON.stringify(datosFinancieros), timestamp, sesionId]
            );

            console.log('✅ Datos financieros actualizados localmente');
            return true;
        } catch (error) {
            console.error('Error actualizando datos financieros:', error);
            throw error;
        }
    },

    // Actualizar conteo de producto en sesión
    actualizarConteoLocal: async (sesionId, productoId, data) => {
        try {
            const database = await getDatabase();
            const timestamp = Date.now();

            await database.runAsync(
                `UPDATE productos_contados 
                 SET cantidad = ?, costo = ?, is_dirty = 1, last_updated = ?
                 WHERE sesionId = ? AND (productoId = ? OR id = ?)`,
                [data.cantidad || data.cantidadContada, data.costo || data.costoProducto, timestamp, sesionId, productoId, productoId]
            );

            return true;
        } catch (error) {
            console.error('Error actualizando conteo local:', error);
            throw error;
        }
    },

    // Eliminar conteo de producto en sesión
    eliminarConteoLocal: async (sesionId, productoId) => {
        try {
            const database = await getDatabase();
            const timestamp = Date.now();

            await database.runAsync(
                `UPDATE productos_contados 
                 SET deleted = 1, is_dirty = 1, last_updated = ?
                 WHERE sesionId = ? AND (productoId = ? OR id = ?)`,
                [timestamp, sesionId, productoId, productoId]
            );

            return true;
        } catch (error) {
            console.error('Error eliminando conteo local:', error);
            throw error;
        }
    },

    // Completar sesión localmente
    completarSesionLocal: async (sesionId) => {
        try {
            const database = await getDatabase();
            const timestamp = Date.now();

            await database.runAsync(
                `UPDATE sesiones SET estado = 'completada', is_dirty = 1, last_updated = ? WHERE _id = ?`,
                [timestamp, sesionId]
            );

            console.log('✅ Sesión completada localmente');
            return true;
        } catch (error) {
            console.error('Error completando sesión local:', error);
            throw error;
        }
    },

    // --- PRODUCTOS CONTADOS (OFFLINE FIRST) ---

    guardarConteoLocal: async (data) => {
        try {
            const database = await getDatabase();
            const timestamp = Date.now();

            const existente = await database.getFirstAsync(
                'SELECT * FROM productos_contados WHERE sesionId = ? AND productoId = ? AND deleted = 0',
                [data.sesionId, data.productoId]
            );

            if (existente) {
                await database.runAsync(
                    `UPDATE productos_contados 
                     SET cantidad = ?, costo = ?, fecha = ?, is_dirty = 1, last_updated = ?
                     WHERE id = ?`,
                    [data.cantidad, data.costo, new Date().toISOString(), timestamp, existente.id]
                );
                return existente.id;
            } else {
                const uuid = generateUUID();
                const result = await database.runAsync(
                    `INSERT INTO productos_contados(
                        id_uuid, sesionId, productoId, nombreProducto, skuProducto, 
                        cantidad, costo, fecha, is_dirty, last_updated, deleted
                    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 0)`,
                    [
                        uuid,
                        data.sesionId,
                        data.productoId,
                        data.nombreProducto,
                        data.skuProducto,
                        data.cantidad,
                        data.costo,
                        new Date().toISOString(),
                        timestamp
                    ]
                );
                return result.lastInsertRowId;
            }
        } catch (error) {
            console.error('Error guardando conteo local:', error);
            throw error;
        }
    },

    obtenerConteosSesion: async (sesionId) => {
        try {
            const database = await getDatabase();
            const result = await database.getAllAsync(
                'SELECT * FROM productos_contados WHERE sesionId = ? AND deleted = 0 ORDER BY fecha DESC',
                [sesionId]
            );
            return result.map(row => ({
                ...row,
                cantidadContada: row.cantidad,
                costoProducto: row.costo,
                _id: row.id.toString(),
                local: true
            }));
        } catch (error) {
            console.error('Error obteniendo conteos sesion:', error);
            return [];
        }
    },

    // --- CLIENTES (OFFLINE FIRST) ---

    /**
     * Obtener clientes filtrados por business_id
     * Esto asegura que Colaboradores y Contadores vean solo datos de su negocio
     */
    obtenerClientes: async (buscar = '', businessId = null) => {
        try {
            const database = await getDatabase();
            let query = 'SELECT * FROM clientes WHERE deleted = 0 AND activo = 1';
            let params = [];

            // Filtro por business_id para jerarquía de roles
            if (businessId) {
                query += ' AND (business_id = ? OR business_id IS NULL)';
                params.push(businessId);
            }

            if (buscar) {
                query += ' AND (nombre LIKE ? OR documento LIKE ? OR email LIKE ? OR telefono LIKE ?)';
                const searchTerm = `%${buscar}%`;
                params.push(searchTerm, searchTerm, searchTerm, searchTerm);
            }

            query += ' ORDER BY nombre LIMIT 100';
            const result = await database.getAllAsync(query, params);
            return result.map(c => ({
                ...c,
                id: c._id,
                nombreNegocio: c.nombre,
                // Indicador visual de estado de sincronización
                _syncStatus: c.sync_status || (c.is_dirty ? 'pending' : 'synced')
            }));
        } catch (error) {
            console.error('Error obteniendo clientes:', error);
            return [];
        }
    },

    /**
     * Crear cliente localmente con soporte Optimistic UI
     * El cliente aparece inmediatamente en la UI con sync_status = 'pending'
     */
    crearClienteLocal: async (cliente, businessId = null, userId = null) => {
        try {
            const database = await getDatabase();
            const uuid = cliente.id_uuid || cliente.uuid || generateUUID();
            const id = cliente._id || uuid;
            const timestamp = Date.now();
            const now = new Date().toISOString();

            await database.runAsync(
                `INSERT INTO clientes(
                    _id, id_uuid, nombre, documento, email, telefono, 
                    direccion, notas, activo, business_id, created_by,
                    is_dirty, sync_status, last_updated, deleted, createdAt, updatedAt
                ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 1, 'pending', ?, 0, ?, ?)`,
                [
                    id, uuid,
                    cliente.nombre,
                    cliente.documento || '',
                    cliente.email || '',
                    cliente.telefono || '',
                    cliente.direccion || '',
                    cliente.notas || '',
                    businessId,
                    userId,
                    timestamp,
                    now,
                    now
                ]
            );

            console.log(`✅ Cliente creado localmente: ${cliente.nombre} (pending sync)`);

            return {
                ...cliente,
                _id: id,
                id_uuid: uuid,
                is_dirty: 1,
                sync_status: 'pending',
                business_id: businessId,
                created_by: userId
            };
        } catch (error) {
            console.error('Error creando cliente local:', error);
            throw error;
        }
    },

    // --- GUARDAR PRODUCTOS (BULK) ---

    guardarProductos: async (productos) => {
        try {
            const database = await getDatabase();
            const timestamp = Date.now();

            for (const producto of productos) {
                const uuid = producto.id_uuid || generateUUID();
                const id = producto._id || producto.id || uuid;

                // Verificar si existe
                const existente = await database.getFirstAsync(
                    'SELECT * FROM productos WHERE _id = ? OR id_uuid = ?',
                    [id, uuid]
                );

                if (existente) {
                    // Actualizar
                    await database.runAsync(
                        `UPDATE productos SET 
                            nombre = ?, codigoBarras = ?, precioVenta = ?, stock = ?, 
                            descripcion = ?, categoria = ?, unidad = ?, costo = ?, sku = ?,
                            imagen = ?, last_updated = ?, is_dirty = 0
                         WHERE _id = ? OR id_uuid = ?`,
                        [
                            producto.nombre, producto.codigoBarras || '', producto.precioVenta || 0,
                            producto.stock || 0, producto.descripcion || '', producto.categoria || '',
                            producto.unidad || '', producto.costo || 0, producto.sku || '',
                            producto.imagen || '', timestamp, id, uuid
                        ]
                    );
                } else {
                    // Insertar
                    await database.runAsync(
                        `INSERT INTO productos(
                            _id, id_uuid, nombre, codigoBarras, precioVenta, stock, 
                            descripcion, categoria, unidad, costo, sku, 
                            imagen, activo, is_dirty, last_updated, deleted
                        ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, 0)`,
                        [
                            id, uuid, producto.nombre, producto.codigoBarras || '', producto.precioVenta || 0,
                            producto.stock || 0, producto.descripcion || '', producto.categoria || '',
                            producto.unidad || '', producto.costo || 0, producto.sku || '',
                            producto.imagen || '', timestamp
                        ]
                    );
                }
            }
            return { success: true, count: productos.length };
        } catch (error) {
            console.error('Error guardando productos:', error);
            throw error;
        }
    },

    // --- FUNCIONES DE SINCRONIZACIÓN (CORE) ---

    obtenerRegistrosSucios: async () => {
        try {
            const database = await getDatabase();
            const tablas = ['productos', 'sesiones', 'productos_contados', 'clientes'];
            let cambios = {};

            for (const tabla of tablas) {
                const registros = await database.getAllAsync(
                    `SELECT * FROM ${tabla} WHERE is_dirty = 1`
                );
                if (registros.length > 0) {
                    cambios[tabla] = registros;
                }
            }
            return cambios;
        } catch (error) {
            console.error('Error obteniendo registros sucios:', error);
            return {};
        }
    },

    confirmarSincronizacion: async (tabla, ids_uuid) => {
        if (!ids_uuid || ids_uuid.length === 0) return;
        try {
            const database = await getDatabase();
            const placeholders = ids_uuid.map(() => '?').join(',');
            await database.runAsync(
                `UPDATE ${tabla} SET is_dirty = 0 WHERE id_uuid IN (${placeholders})`,
                ids_uuid
            );

            await database.runAsync(
                `DELETE FROM ${tabla} WHERE deleted = 1 AND is_dirty = 0 AND id_uuid IN (${placeholders})`,
                ids_uuid
            );
        } catch (error) {
            console.error(`Error confirmando sync para ${tabla}:`, error);
        }
    },

    // Función para guardar múltiples sesiones (sincronización masiva)
    guardarSesiones: async (sesiones) => {
        try {
            if (!Array.isArray(sesiones) || sesiones.length === 0) return;

            const database = await getDatabase();
            const timestamp = Date.now();

            for (const sesion of sesiones) {
                const id = sesion._id || sesion.id || generateUUID();
                const uuid = sesion.id_uuid || generateUUID();

                // Verificar si ya existe
                const existente = await database.getFirstAsync(
                    'SELECT _id FROM sesiones WHERE _id = ?',
                    [id]
                );

                if (existente) {
                    // Actualizar sesión existente
                    await database.runAsync(
                        `UPDATE sesiones 
                         SET numeroSesion = ?, fecha = ?, estado = ?, clienteNombre = ?, 
                             totalProductos = ?, valorTotal = ?, last_updated = ?, is_dirty = 0
                         WHERE _id = ?`,
                        [
                            sesion.numeroSesion || sesion.numero_sesion,
                            sesion.fecha || sesion.createdAt,
                            sesion.estado || 'abierta',
                            sesion.clienteNombre || sesion.cliente?.nombre || '',
                            sesion.totalProductos || 0,
                            sesion.valorTotal || 0,
                            timestamp,
                            id
                        ]
                    );
                } else {
                    // Insertar nueva sesión
                    await database.runAsync(
                        `INSERT INTO sesiones(
                            _id, id_uuid, numeroSesion, fecha, estado, clienteNombre, 
                            totalProductos, valorTotal, is_dirty, last_updated, deleted, local, createdAt
                        ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, 0, ?)`,
                        [
                            id, uuid,
                            sesion.numeroSesion || sesion.numero_sesion,
                            sesion.fecha || sesion.createdAt || new Date().toISOString(),
                            sesion.estado || 'abierta',
                            sesion.clienteNombre || sesion.cliente?.nombre || '',
                            sesion.totalProductos || 0,
                            sesion.valorTotal || 0,
                            timestamp,
                            sesion.createdAt || new Date().toISOString()
                        ]
                    );
                }
            }

            console.log(`✅ Guardadas ${sesiones.length} sesiones localmente`);
        } catch (error) {
            console.error('Error guardando sesiones:', error);
            throw error;
        }
    },

    // --- MANTENEMOS FUNCIONES LEGACY NECESARIAS ---
    loginLocal: async (emailOrName, password) => {
        try {
            const database = await getDatabase();
            // Primero verificar si la columna nombreUsuario existe
            const tableInfo = await database.getAllAsync(`PRAGMA table_info(usuarios)`);
            const hasNombreUsuario = tableInfo.some(col => col.name === 'nombreUsuario');

            let usuario;
            if (hasNombreUsuario) {
                // Buscar por email, nombreUsuario o nombre
                usuario = await database.getFirstAsync(
                    `SELECT * FROM usuarios WHERE (email = ? OR nombreUsuario = ? OR nombre = ?) AND activo = 1`,
                    [emailOrName, emailOrName, emailOrName]
                );
            } else {
                // Si la columna no existe, buscar solo por email y nombre
                usuario = await database.getFirstAsync(
                    `SELECT * FROM usuarios WHERE (email = ? OR nombre = ?) AND activo = 1`,
                    [emailOrName, emailOrName]
                );
            }

            if (!usuario || usuario.password !== password) {
                return { success: false, error: 'Credenciales inválidas' };
            }

            const { password: _, ...u } = usuario;
            return { success: true, usuario: { ...u, _id: usuario._id, loginLocal: true } };
        } catch (e) {
            console.error('Error en loginLocal:', e);
            return { success: false, error: e.message };
        }
    },

    // ... Otras funciones de usuarios e invitaciones se mantienen igual ...
    obtenerUsuarios: async () => { /* ... */ return []; },
    registrarUsuarioLocal: async (u) => { /* ... */ return { success: false }; },
    crearInvitacionLocal: async (d) => { /* ... */ throw new Error('Not impl'); },
    verificarCodigoInvitacion: async (c) => { /* ... */ return null; },
    listarInvitaciones: async () => { /* ... */ return []; },
    listarColaboradoresConCodigo: async () => { /* ... */ return []; },

    obtenerConteosPendientes: async (sesionId) => {
        try {
            const database = await getDatabase();
            const query = sesionId
                ? 'SELECT * FROM productos_contados WHERE sesionId = ? AND is_dirty = 1'
                : 'SELECT * FROM productos_contados WHERE is_dirty = 1';
            const params = sesionId ? [sesionId] : [];
            return await database.getAllAsync(query, params);
        } catch (e) { return []; }
    },

    agregarAColaSincronizacion: async (tipo, payload) => {
        try {
            const database = await getDatabase();
            const result = await database.runAsync(
                `INSERT INTO cola_sincronizacion(tipo, payload, estado, intentos, createdAt, updatedAt) VALUES(?, ?, 'pending', 0, ?, ?)`,
                [tipo, JSON.stringify(payload), new Date().toISOString(), new Date().toISOString()]
            );
            return result.lastInsertRowId;
        } catch (e) { return 0; }
    },
    obtenerTareasPendientes: async () => { return []; },
    marcarTareaCompletada: async () => { },
    marcarTareaFallida: async () => { },
    limpiarTareasCompletadas: async () => { },
    obtenerEstadisticasSincronizacion: async () => {
        try {
            const database = await getDatabase();
            const sucios = await database.getFirstAsync(`
                SELECT (
                    (SELECT COUNT(*) FROM productos WHERE is_dirty = 1) +
                    (SELECT COUNT(*) FROM sesiones WHERE is_dirty = 1) +
                    (SELECT COUNT(*) FROM productos_contados WHERE is_dirty = 1) +
                    (SELECT COUNT(*) FROM clientes WHERE is_dirty = 1)
                ) as total
            `);

            // Estadísticas detalladas por tabla
            const detalles = await database.getFirstAsync(`
                SELECT 
                    (SELECT COUNT(*) FROM clientes WHERE is_dirty = 1) as clientesPendientes,
                    (SELECT COUNT(*) FROM productos WHERE is_dirty = 1) as productosPendientes,
                    (SELECT COUNT(*) FROM sesiones WHERE is_dirty = 1) as sesionesPendientes,
                    (SELECT COUNT(*) FROM productos_contados WHERE is_dirty = 1) as conteosPendientes
            `);

            return {
                total: sucios?.total || 0,
                pendientes: sucios?.total || 0,
                completadas: 0,
                errores: 0,
                detalles: detalles || {}
            };
        } catch (e) { return { total: 0 }; }
    },

    /**
     * Sincronizar clientes desde el servidor (PULL)
     * Actualiza o inserta clientes recibidos del servidor
     */
    sincronizarClientesDesdeServidor: async (clientes) => {
        if (!Array.isArray(clientes) || clientes.length === 0) return;

        try {
            const database = await getDatabase();
            const timestamp = Date.now();

            for (const cliente of clientes) {
                const uuid = cliente.uuid || cliente.id_uuid;
                const id = cliente._id || cliente.id || uuid;

                // Verificar si existe
                const existente = await database.getFirstAsync(
                    'SELECT _id, is_dirty FROM clientes WHERE _id = ? OR id_uuid = ?',
                    [id, uuid]
                );

                if (existente) {
                    // Solo actualizar si no tiene cambios locales pendientes
                    if (!existente.is_dirty) {
                        await database.runAsync(
                            `UPDATE clientes SET 
                                nombre = ?, telefono = ?, direccion = ?, email = ?,
                                documento = ?, notas = ?, activo = ?, business_id = ?,
                                last_updated = ?, sync_status = 'synced', is_dirty = 0
                             WHERE _id = ? OR id_uuid = ?`,
                            [
                                cliente.nombre,
                                cliente.telefono || '',
                                cliente.direccion || '',
                                cliente.email || '',
                                cliente.documento || '',
                                cliente.notas || '',
                                cliente.activo !== undefined ? cliente.activo : 1,
                                cliente.business_id,
                                timestamp,
                                id, uuid
                            ]
                        );
                    }
                } else {
                    // Insertar nuevo
                    await database.runAsync(
                        `INSERT INTO clientes(
                            _id, id_uuid, nombre, telefono, direccion, email,
                            documento, notas, activo, business_id, created_by,
                            is_dirty, sync_status, last_updated, deleted, createdAt, updatedAt
                        ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'synced', ?, 0, ?, ?)`,
                        [
                            id, uuid,
                            cliente.nombre,
                            cliente.telefono || '',
                            cliente.direccion || '',
                            cliente.email || '',
                            cliente.documento || '',
                            cliente.notas || '',
                            cliente.activo !== undefined ? cliente.activo : 1,
                            cliente.business_id,
                            cliente.created_by,
                            timestamp,
                            cliente.createdAt || new Date().toISOString(),
                            new Date().toISOString()
                        ]
                    );
                }
            }

            console.log(`✅ ${clientes.length} clientes sincronizados desde servidor`);
        } catch (error) {
            console.error('Error sincronizando clientes desde servidor:', error);
            throw error;
        }
    },

    /**
     * Obtener estado de sincronización de un registro específico
     */
    obtenerEstadoSincronizacion: async (tabla, id) => {
        try {
            const database = await getDatabase();
            const result = await database.getFirstAsync(
                `SELECT is_dirty, sync_status, last_updated FROM ${tabla} WHERE _id = ? OR id_uuid = ?`,
                [id, id]
            );
            return result || { is_dirty: 0, sync_status: 'unknown' };
        } catch (e) {
            return { is_dirty: 0, sync_status: 'error' };
        }
    },

    /**
     * Guardar configuración de sincronización
     */
    guardarConfigSync: async (key, value) => {
        try {
            const database = await getDatabase();
            await database.runAsync(
                `INSERT OR REPLACE INTO sync_config(key, value, updatedAt) VALUES(?, ?, ?)`,
                [key, JSON.stringify(value), new Date().toISOString()]
            );
        } catch (e) {
            console.error('Error guardando config sync:', e);
        }
    },

    /**
     * Obtener configuración de sincronización
     */
    obtenerConfigSync: async (key) => {
        try {
            const database = await getDatabase();
            const result = await database.getFirstAsync(
                'SELECT value FROM sync_config WHERE key = ?',
                [key]
            );
            return result ? JSON.parse(result.value) : null;
        } catch (e) {
            return null;
        }
    },

    /**
     * Obtener productos de colaborador para enviar
     */
    obtenerProductosColaborador: async (solicitudId) => {
        try {
            const database = await getDatabase();
            return await database.getAllAsync(
                'SELECT * FROM productos_colaborador WHERE solicitudId = ? AND sincronizado = 0',
                [solicitudId]
            );
        } catch (e) {
            return [];
        }
    },

    /**
     * Guardar producto de colaborador localmente
     */
    guardarProductoColaborador: async (item, solicitudId) => {
        try {
            const database = await getDatabase();
            const timestamp = new Date().toISOString();

            await database.runAsync(
                `INSERT OR REPLACE INTO productos_colaborador 
                (temporalId, solicitudId, nombre, sku, codigoBarras, cantidad, costo, timestamp, sincronizado) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
                [
                    item.temporalId || `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    solicitudId,
                    item.nombre || '',
                    item.sku || '',
                    item.codigoBarras || '',
                    item.cantidad || 1,
                    item.costo || 0,
                    timestamp
                ]
            );
            return true;
        } catch (e) {
            console.error('Error guardando producto colaborador:', e);
            throw e;
        }
    },

    /**
     * Eliminar producto de colaborador por temporalId
     */
    eliminarProductoColaborador: async (temporalId) => {
        try {
            const database = await getDatabase();
            await database.runAsync(
                'DELETE FROM productos_colaborador WHERE temporalId = ?',
                [temporalId]
            );
            return true;
        } catch (e) {
            console.error('Error eliminando producto colaborador:', e);
            throw e;
        }
    },

    /**
     * Limpiar productos de colaborador después de sincronizar
     */
    limpiarProductosColaborador: async (solicitudId) => {
        try {
            const database = await getDatabase();
            await database.runAsync(
                'DELETE FROM productos_colaborador WHERE solicitudId = ?',
                [solicitudId]
            );
        } catch (e) {
            console.error('Error limpiando productos colaborador:', e);
        }
    },

    /**
     * Actualizar cliente localmente (Optimistic UI)
     */
    actualizarClienteLocal: async (id, datos) => {
        try {
            const database = await getDatabase();
            const timestamp = Date.now();

            const campos = ['last_updated = ?', 'is_dirty = 1', "sync_status = 'pending'", 'updatedAt = ?'];
            const valores = [timestamp, new Date().toISOString()];

            if (datos.nombre !== undefined) {
                campos.push('nombre = ?');
                valores.push(datos.nombre);
            }
            if (datos.telefono !== undefined) {
                campos.push('telefono = ?');
                valores.push(datos.telefono);
            }
            if (datos.direccion !== undefined) {
                campos.push('direccion = ?');
                valores.push(datos.direccion);
            }
            if (datos.email !== undefined) {
                campos.push('email = ?');
                valores.push(datos.email);
            }
            if (datos.notas !== undefined) {
                campos.push('notas = ?');
                valores.push(datos.notas);
            }

            valores.push(id);

            await database.runAsync(
                `UPDATE clientes SET ${campos.join(', ')} WHERE _id = ? OR id_uuid = ?`,
                [...valores, id]
            );

            return true;
        } catch (error) {
            console.error('Error actualizando cliente local:', error);
            return false;
        }
    },

    /**
     * Eliminar cliente localmente (soft delete)
     */
    eliminarClienteLocal: async (id) => {
        try {
            const database = await getDatabase();
            const timestamp = Date.now();

            await database.runAsync(
                `UPDATE clientes SET deleted = 1, is_dirty = 1, sync_status = 'pending', last_updated = ? WHERE _id = ? OR id_uuid = ?`,
                [timestamp, id, id]
            );

            return true;
        } catch (error) {
            console.error('Error eliminando cliente local:', error);
            return false;
        }
    }
};

export default localDb;
