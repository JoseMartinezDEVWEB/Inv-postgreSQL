const express = require('express');
const db = require('../models');
const { authenticateToken, authorizeRole } = require('./authRoutes');

const multer = require('multer');
const { processFile } = require('../utils/importProcessor');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const { emitNotification } = require('../utils/socketHandlers');

let io;
router.setIo = (socketIoInstance) => {
    io = socketIoInstance;
};

/**
 * Importar productos desde archivo XLSX o PDF (Usa IA)
 */
router.post('/generales/importar', authenticateToken, authorizeRole(['administrador', 'contable']), upload.single('archivo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ mensaje: 'No se ha subido ningún archivo' });
        }

        const apiKey = req.body.apiKey || process.env.GEMINI_API_KEY;
        const productosProcesados = await processFile(req.file.buffer, req.file.originalname, apiKey);

        if (!productosProcesados || productosProcesados.length === 0) {
            return res.status(400).json({ mensaje: 'No se encontraron productos en el archivo' });
        }

        const resultados = [];
        const errores = [];
        
        console.log(`🚀 Iniciando procesamiento de ${productosProcesados.length} productos...`);

        for (const p of productosProcesados) {
            try {
                // Lógica de "upsert" manual por nombre o código de barras
                let producto = null;
                
                // Asegurar que buscamos por STRING para evitar error: character varying = bigint
                if (p.codigoBarras && String(p.codigoBarras).trim() !== '') {
                    const codStr = String(p.codigoBarras).trim();
                    producto = await db.ProductoGeneral.findOne({ where: { codigoBarras: codStr } });
                }
                
                if (!producto && p.nombre && String(p.nombre).trim() !== '') {
                    const nomStr = String(p.nombre).trim();
                    producto = await db.ProductoGeneral.findOne({ where: { nombre: nomStr } });
                }

                if (producto) {
                    const oldValues = producto.toJSON();
                    await producto.update({
                        ...p,
                        activo: true
                    });
                    
                    // Registrar auditoría de actualización por importación
                    await db.AuditoriaMovimiento.create({
                        usuarioId: req.user.id,
                        productoGeneralId: producto.id,
                        tipoMovimiento: 'IMPORTACION',
                        detalles: { 
                            action: 'update_via_import',
                            old: oldValues,
                            new: producto.toJSON()
                        },
                        fecha: new Date(),
                        notas: 'Producto actualizado mediante importación'
                    });

                    resultados.push({ ...producto.toJSON(), _importStatus: 'updated' });
                } else {
                    const nuevo = await db.ProductoGeneral.create({
                        ...p,
                        activo: true,
                        creadoPorId: req.user.id,
                        tipoCreacion: 'importacion'
                    });

                    // Registrar auditoría de creación por importación
                    await db.AuditoriaMovimiento.create({
                        usuarioId: req.user.id,
                        productoGeneralId: nuevo.id,
                        tipoMovimiento: 'IMPORTACION',
                        detalles: { 
                            action: 'create_via_import',
                            data: nuevo.toJSON()
                        },
                        fecha: new Date(),
                        notas: 'Producto creado mediante importación'
                    });

                    resultados.push({ ...nuevo.toJSON(), _importStatus: 'created' });
                }
            } catch (pError) {
                console.error(`❌ Error procesando producto [${p.nombre || 'SIN NOMBRE'}]:`, pError.message);
                errores.push({
                    producto: p.nombre,
                    error: pError.message
                });
                // Continuamos con el siguiente producto
            }
        }

        const creados = resultados.filter(r => r._importStatus === 'created').length;
        const actualizados = resultados.filter(r => r._importStatus === 'updated').length;

        res.json({
            exito: true,
            mensaje: `Importación completada: ${creados} nuevos, ${actualizados} actualizados. ${errores.length > 0 ? `Se omitieron ${errores.length} productos por errores.` : ''}`,
            resumen: {
                totalProcesados: productosProcesados.length,
                creados,
                actualizados,
                fallidos: errores.length
            },
            productos: resultados,
            errores: errores.length > 0 ? errores : undefined
        });

    } catch (error) {
        console.error('Error fatal en importación:', error);
        res.status(500).json({ mensaje: 'Error al importar productos: ' + error.message });
    }
});

/**
 * Obtener todos los productos activos (Tabla Producto - Inventario Actual)
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const productos = await db.Producto.findAll({ where: { activo: true } });
        res.json(productos);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener productos: ' + error.message });
    }
});

/**
 * Productos Generales (Catálogo Maestro)
 */
const getProductosGenerales = async (req, res) => {
    try {
        const { limite = 50, pagina = 1, buscar = '', categoria = '' } = req.query;
        console.log(`🔍 API: Obtener productos generales - Pág: ${pagina}, Límite: ${limite}`);
        const offset = (pagina - 1) * limite;

        const where = { activo: true };
        if (buscar) {
            where[db.Sequelize.Op.or] = [
                { nombre: { [db.Sequelize.Op.iLike]: `%${buscar}%` } },
                { codigoBarras: { [db.Sequelize.Op.iLike]: `%${buscar}%` } }
            ];
        }
        if (categoria) {
            where.categoria = categoria;
        }

        const { count, rows } = await db.ProductoGeneral.findAndCountAll({
            where,
            limit: parseInt(limite),
            offset: parseInt(offset),
            order: [['nombre', 'ASC']]
        });

        res.json({
            datos: rows,
            paginacion: {
                total: count,
                totalRegistros: count,
                pagina: parseInt(pagina),
                limite: parseInt(limite),
                totalPaginas: Math.ceil(count / limite)
            }
        });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener productos generales: ' + error.message });
    }
};

router.get('/generales', authenticateToken, getProductosGenerales);

/**
 * Buscar producto por código de barras (Catálogo Maestro)
 */
router.get('/generales/buscar/codigo-barras/:codigo', authenticateToken, async (req, res) => {
    try {
        const { codigo } = req.params;
        const trimmedCodigo = (codigo || '').trim();
        console.log(`🔍 [BACKEND] Buscando código de barras: "${trimmedCodigo}"`);

        // 1. Intentar match exacto primero (con activo: true)
        let producto = await db.ProductoGeneral.findOne({
            where: { 
                codigoBarras: trimmedCodigo,
                activo: true
            }
        });

        // 2. Si no se encuentra, intentar con TRIM en la base de datos (por si hay espacios en el registro)
        if (!producto) {
            producto = await db.ProductoGeneral.findOne({
                where: db.sequelize.and(
                    db.sequelize.where(db.sequelize.fn('TRIM', db.sequelize.col('codigoBarras')), trimmedCodigo),
                    { activo: true }
                )
            });
        }

        // 3. Si sigue sin aparecer y el código buscado no tiene ceros a la izquierda, 
        // intentar buscar registros que tengan ceros a la izquierda (ej: "001049" vs "1049")
        if (!producto && /^\d+$/.test(trimmedCodigo)) {
            const pattern = '%' + trimmedCodigo;
            producto = await db.ProductoGeneral.findOne({
                where: {
                    codigoBarras: { [db.Sequelize.Op.like]: pattern },
                    activo: true
                }
            });
        }

        if (!producto) {
            console.log(`❌ [BACKEND] Producto no encontrado: "${trimmedCodigo}"`);
            return res.status(404).json({ mensaje: 'Producto no encontrado por código de barras' });
        }

        console.log(`✅ [BACKEND] Producto encontrado: ${producto.nombre}`);
        res.json({
            exito: true,
            datos: producto
        });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al buscar producto: ' + error.message });
    }
});

// Alias para compatibilidad con el móvil
router.get('/generales/buscar/codigo/:codigo', authenticateToken, async (req, res) => {
    try {
        const { codigo } = req.params;
        const trimmedCodigo = (codigo || '').trim();
        const producto = await db.ProductoGeneral.findOne({
            where: { 
                codigoBarras: trimmedCodigo,
                activo: true
            }
        });

        if (!producto) {
            return res.status(404).json({ mensaje: 'Producto no encontrado' });
        }

        res.json({
            exito: true,
            datos: producto
        });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al buscar producto: ' + error.message });
    }
});

router.get('/generales/categorias', authenticateToken, async (req, res) => {
    try {
        const categorias = await db.ProductoGeneral.findAll({
            attributes: [[db.Sequelize.fn('DISTINCT', db.Sequelize.col('categoria')), 'categoria']],
            where: { activo: true }
        });
        if (categorias.length === 0) {
            return res.json({ categorias: ['General', 'Alimentos General', 'Enlatados', 'Mercado', 'Embutidos', 'Carnes', 'Bebidas'] });
        }
        res.json({ categorias: categorias.map(c => c.categoria) });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener categorías: ' + error.message });
    }
});

router.post('/generales', authenticateToken, authorizeRole(['administrador', 'contable']), async (req, res) => {
    try {
        const { nombre, descripcion, categoria, unidad, costoBase, codigoBarras, proveedor, notas } = req.body;

        if (!nombre) {
            return res.status(400).json({ mensaje: 'El nombre es requerido' });
        }

        const producto = await db.ProductoGeneral.create({
            nombre,
            descripcion,
            categoria: categoria || 'General',
            unidad: unidad || 'unidad',
            costoBase: costoBase || 0,
            codigoBarras,
            proveedor,
            notas,
            activo: true,
            creadoPorId: req.user.id,
            tipoCreacion: 'usuario'
        });

        // Registrar auditoría de alta manual
        await db.AuditoriaMovimiento.create({
            usuarioId: req.user.id,
            productoGeneralId: producto.id,
            tipoMovimiento: 'ALTA',
            detalles: { action: 'manual_create', data: producto.toJSON() },
            fecha: new Date(),
            notas: 'Producto creado manualmente por el usuario'
        });

        // Notificar creación
        emitNotification(io, {
            titulo: '🆕 Nuevo Producto',
            mensaje: `${producto.nombre} agregado al catálogo por ${req.user.nombre}`,
            tipo: 'info'
        });

        if (io) {
            io.emit('producto_general_creado', { producto: producto.toJSON() });
        }

        res.status(201).json(producto);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al crear producto: ' + error.message });
    }
});

router.put('/generales/:id', authenticateToken, authorizeRole(['administrador', 'contable']), async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, descripcion, categoria, unidad, costoBase, codigoBarras, proveedor, notas } = req.body;

        const producto = await db.ProductoGeneral.findByPk(id);
        if (!producto) {
            return res.status(404).json({ mensaje: 'Producto no encontrado' });
        }

        const oldValues = producto.toJSON();
        await producto.update({ nombre, descripcion, categoria, unidad, costoBase, codigoBarras, proveedor, notas });

        // Registrar auditoría de modificación
        await db.AuditoriaMovimiento.create({
            usuarioId: req.user.id,
            productoGeneralId: producto.id,
            tipoMovimiento: 'MODIFICACION',
            detalles: { 
                action: 'manual_update', 
                old: oldValues, 
                new: producto.toJSON() 
            },
            fecha: new Date(),
            notas: 'Producto modificado manualmente por el usuario'
        });

        // Notificar modificación
        emitNotification(io, {
            titulo: '✏️ Producto Modificado',
            mensaje: `${producto.nombre} actualizado por ${req.user.nombre}`,
            tipo: 'warning'
        });

        res.json(producto);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al actualizar producto: ' + error.message });
    }
});

router.delete('/generales/:id', authenticateToken, authorizeRole(['administrador']), async (req, res) => {
    try {
        const { id } = req.params;

        const producto = await db.ProductoGeneral.findByPk(id);
        if (!producto) {
            return res.status(404).json({ mensaje: 'Producto no encontrado' });
        }

        await producto.update({ activo: false });

        // Registrar auditoría de baja
        await db.AuditoriaMovimiento.create({
            usuarioId: req.user.id,
            productoGeneralId: producto.id,
            tipoMovimiento: 'BAJA',
            detalles: { action: 'manual_delete', data: producto.toJSON() },
            fecha: new Date(),
            notas: 'Producto marcado como inactivo (eliminado)'
        });

        res.json({ message: 'Producto eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al eliminar producto: ' + error.message });
    }
});

/**
 * Productos por Cliente (Productos específicos de un negocio)
 */
router.get('/cliente/:clienteId', authenticateToken, async (req, res) => {
    try {
        const { clienteId } = req.params;
        const { buscar = '', limite = 20, pagina = 1 } = req.query;
        const offset = (pagina - 1) * limite;

        const where = { 
            clienteNegocioId: clienteId,
            activo: true 
        };

        if (buscar) {
            where.nombre = { [db.Sequelize.Op.iLike]: `%${buscar}%` };
        }

        const { count, rows } = await db.Producto.findAndCountAll({
            where,
            limit: parseInt(limite),
            offset: parseInt(offset),
            order: [['nombre', 'ASC']]
        });

        res.json({
            datos: {
                productos: rows,
                paginacion: {
                    total: count,
                    pagina: parseInt(pagina),
                    limite: parseInt(limite),
                    totalPaginas: Math.ceil(count / limite)
                }
            }
        });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener productos del cliente: ' + error.message });
    }
});

router.post('/cliente/:clienteId', authenticateToken, async (req, res) => {
    try {
        const { clienteId } = req.params;
        const { nombre, descripcion, costo, unidad, categoria, sku, proveedor } = req.body;

        if (!nombre) {
            return res.status(400).json({ mensaje: 'El nombre es requerido' });
        }

        // Verificar si ya existe un producto con el mismo nombre para este cliente
        const existente = await db.Producto.findOne({
            where: {
                nombre,
                clienteNegocioId: clienteId,
                activo: true
            }
        });

        if (existente) {
            return res.status(200).json({ 
                mensaje: 'Ya existe un producto con este nombre para este cliente',
                datos: existente 
            });
        }

        // ✅ NUEVO: También buscar/crear en ProductoGeneral para alimentar el catálogo global
        let productoGeneral = await db.ProductoGeneral.findOne({
            where: { nombre: nombre.trim() }
        });

        if (!productoGeneral && sku) {
            productoGeneral = await db.ProductoGeneral.findOne({
                where: { codigoBarras: sku }
            });
        }

        if (!productoGeneral) {
            productoGeneral = await db.ProductoGeneral.create({
                nombre: nombre.trim(),
                costoBase: costo || 0,
                codigoBarras: sku || '',
                unidad: unidad || 'unidad',
                categoria: categoria || 'General',
                descripcion: `Creado manualmente para cliente ID: ${clienteId}`,
                activo: true,
                tipoCreacion: 'manual_client_creation',
                creadoPorId: req.user.id
            });

            if (io) {
                io.emit('producto_general_creado', { producto: productoGeneral.toJSON() });
            }
        }

        const producto = await db.Producto.create({
            nombre,
            descripcion,
            costo,
            unidad,
            categoria,
            sku,
            clienteNegocioId: clienteId,
            activo: true
        });

        res.status(201).json({
            mensaje: 'Producto creado correctamente para el cliente y agregado al catálogo general',
            datos: producto
        });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al crear producto para el cliente: ' + error.message });
    }
});

module.exports = router;
