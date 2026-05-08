const express = require('express');
const db = require('../models');
const { authenticateToken } = require('./authRoutes');

const router = express.Router();
let io;
router.setIo = (socketIoInstance) => {
    io = socketIoInstance;
};

/**
 * Endpoint para recibir datos desde la app móvil
 * Sincroniza Entidades resolviendo los IDs temporales (UUID) a PK (Integer)
 */
router.post('/sincronizar', authenticateToken, async (req, res) => {
    try {
        const {
            clientes = [],
            productos = [],
            sesiones = [],
            productos_contados = [],
            dispositivoId
        } = req.body;

        const resultado = await db.sequelize.transaction(async (t) => {
            const mapasId = {
                clientes: {},
                productos: {},
                sesiones: {}
            };
            let totalProcesados = 0;

            const solicitud = await db.SolicitudConexion.findOne({
                where: { colaboradorId: req.user.id, estado: 'aceptada' },
                transaction: t
            });

            const businessId = solicitud ? solicitud.adminId : req.user.id;

            // 1. Resolver y Sincronizar Clientes
            for (const cl of clientes) {
                const tmpId = cl._id || cl.id_uuid;
                if (!tmpId) continue;

                let dbCliente = await db.ClienteNegocio.findOne({
                    where: {
                        [db.Sequelize.Op.or]: [{ uuid: tmpId }, { nombre: cl.nombre }]
                    },
                    transaction: t
                });

                if (!dbCliente) {
                    dbCliente = await db.ClienteNegocio.create({
                        uuid: tmpId,
                        nombre: cl.nombre,
                        documento: cl.documento || '',
                        email: cl.email || '',
                        telefono: cl.telefono || '',
                        direccion: cl.direccion || '',
                        notas: cl.notas || '',
                        contadorAsignadoId: businessId,
                        business_id: businessId,
                        created_by: req.user.id
                    }, { transaction: t });
                } else {
                    await dbCliente.update({
                        nombre: cl.nombre,
                        notas: cl.notas,
                        documento: cl.documento || dbCliente.documento
                    }, { transaction: t });
                }
                mapasId.clientes[tmpId] = dbCliente.id;
                totalProcesados++;
            }

            // 2. Resolver y Sincronizar Productos
            for (const pr of productos) {
                const tmpId = pr._id || pr.id_uuid;
                if (!tmpId) continue;

                let dbProd = null;
                if (pr.codigoBarras) {
                    dbProd = await db.Producto.findOne({ where: { codigoBarras: pr.codigoBarras || pr.sku }, transaction: t });
                }
                if (!dbProd) {
                    dbProd = await db.Producto.findOne({ where: { nombre: pr.nombre }, transaction: t });
                }

                if (!dbProd) {
                    // ✅ NUEVO: También buscar/crear en ProductoGeneral para alimentar el catálogo global
                    let productoGeneral = await db.ProductoGeneral.findOne({
                        where: { nombre: pr.nombre.trim() },
                        transaction: t
                    });

                    if (!productoGeneral && pr.codigoBarras) {
                        productoGeneral = await db.ProductoGeneral.findOne({
                            where: { codigoBarras: pr.codigoBarras },
                            transaction: t
                        });
                    }

                    if (!productoGeneral) {
                        productoGeneral = await db.ProductoGeneral.create({
                            nombre: pr.nombre.trim(),
                            costoBase: pr.costo || 0,
                            codigoBarras: pr.codigoBarras || pr.sku || '',
                            unidad: pr.unidad || 'unidad',
                            categoria: pr.categoria || 'General',
                            descripcion: 'Sincronizado desde dispositivo móvil',
                            activo: true,
                            tipoCreacion: 'mobile_sync'
                        }, { transaction: t });

                        if (io) {
                            io.emit('producto_general_creado', { producto: productoGeneral.toJSON() });
                        }
                    }

                    dbProd = await db.Producto.create({
                        nombre: pr.nombre,
                        descripcion: pr.descripcion || '',
                        costo: pr.costo || 0,
                        unidad: pr.unidad || 'unidad',
                        sku: pr.sku || pr.codigoBarras,
                        activo: true
                    }, { transaction: t });
                }
                mapasId.productos[tmpId] = dbProd.id;
                totalProcesados++;
            }

            // 3. Resolver y Sincronizar Sesiones
            for (const ses of sesiones) {
                const tmpId = ses._id || ses.id_uuid;
                if (!tmpId) continue;

                let dbSes = await db.SesionInventario.findOne({ where: { numeroSesion: ses.numeroSesion }, transaction: t });

                let cId = ses.clienteNegocioId;
                if (mapasId.clientes[cId]) cId = mapasId.clientes[cId];

                if (!dbSes) {
                    dbSes = await db.SesionInventario.create({
                        numeroSesion: ses.numeroSesion,
                        clienteNegocioId: isNaN(parseInt(cId)) ? null : cId,
                        contadorId: businessId,
                        estado: ses.estado || 'en_progreso',
                        fecha: ses.fecha || new Date()
                    }, { transaction: t });
                } else {
                    await dbSes.update({ estado: ses.estado }, { transaction: t });
                }
                mapasId.sesiones[tmpId] = dbSes.id;
                totalProcesados++;
            }

            // 4. Resolver y Sincronizar Productos Contados
            for (const ct of productos_contados) {
                let sId = ct.sesionId;
                if (mapasId.sesiones[sId]) sId = mapasId.sesiones[sId];

                let pId = ct.productoId;
                if (mapasId.productos[pId]) pId = mapasId.productos[pId];

                if (!sId || isNaN(parseInt(sId))) continue;

                await db.ProductoContado.create({
                    sesionInventarioId: sId,
                    productoClienteId: isNaN(parseInt(pId)) ? null : pId,
                    nombreProducto: ct.nombreProducto || 'Producto Sincronizado',
                    skuProducto: ct.skuProducto || '',
                    cantidadContada: ct.cantidad || 0,
                    costoProducto: ct.costo || 0,
                    agregadoPorId: req.user.id
                }, { transaction: t });
                totalProcesados++;
            }

            return {
                procesados: totalProcesados,
                resolucionIds: mapasId,
                serverTimestamp: Date.now()
            };
        });

        res.json({
            exito: true,
            mensaje: 'Sincronización robusta completada con éxito',
            datos: resultado
        });

    } catch (error) {
        console.error('Error Sync Adapter:', error);
        res.status(500).json({
            exito: false,
            mensaje: 'Error de validación al sincronizar UUID/Integer: ' + error.message,
            error: error.message
        });
    }
});

/**
 * Endpoint para que Desktop/Web envíen inventario a colaboradores mobile vía WebSocket
 * Autenticación: header x-broadcast-key (clave pre-compartida, no JWT)
 */
router.post('/broadcast-inventory', async (req, res) => {
    const key = req.headers['x-broadcast-key'];
    if (!key || key !== process.env.BROADCAST_API_KEY) {
        return res.status(401).json({ error: 'No autorizado' });
    }

    const { productos, enviadoPor } = req.body;
    if (!Array.isArray(productos) || productos.length === 0) {
        return res.status(400).json({ error: 'Sin productos para enviar' });
    }

    if (!io) {
        return res.status(503).json({ error: 'Socket.io no disponible' });
    }

    const sala = io.sockets.adapter.rooms.get('sala_colaboradores');
    const count = sala?.size || 0;

    const payload = {
        productos,
        enviadoPor: enviadoPor || { id: 0, nombre: 'Sistema' },
        timestamp: new Date().toISOString()
    };

    io.to('sala_colaboradores').emit('send_inventory', payload);

    return res.json({
        success: true,
        count,
        message: `Inventario de ${productos.length} productos enviado a ${count} colaborador(es)`
    });
});

module.exports = router;
