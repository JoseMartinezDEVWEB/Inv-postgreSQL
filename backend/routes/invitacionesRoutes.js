const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../models');
const { authenticateToken, authorizeRole } = require('./authRoutes');

const router = express.Router();
let io; // Referencia a Socket.io que se inyectará desde server.js

console.log('✅ [Backend] Invitaciones router cargado con soporte para GET /qr/:id');

// Función para inyectar io
router.setIo = (socketIoInstance) => {
    io = socketIoInstance;
};

// --- ENDPOINTS DE INVITACIONES (Colaboradores) ---

router.get('/mis-invitaciones', authenticateToken, async (req, res) => {
    try {
        const userRol = (req.user.rol || '').toLowerCase();
        const where = { estado: 'pendiente' };
        if (userRol !== 'administrador') {
            where.creadaPorId = req.user.id;
        }

        const invitaciones = await db.Invitacion.findAll({
            where,
            order: [['createdAt', 'DESC']]
        });
        res.json({ datos: invitaciones });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener invitaciones: ' + error.message });
    }
});

router.get('/colaboradores', authenticateToken, async (req, res) => {
    try {
        const where = { rol: 'colaborador', activo: true };

        const colaboradores = await db.Usuario.findAll({
            where,
            attributes: ['id', 'nombre', 'email', 'rol', 'activo', 'createdAt']
        });
        res.json({ datos: colaboradores });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener colaboradores: ' + error.message });
    }
});

router.post('/qr', authenticateToken, async (req, res) => {
    try {
        const { rol = 'colaborador', nombre, email, expiraEnMinutos = 1440 } = req.body;

        const PORT = process.env.PORT || 4000;

        if (req.user.rol === 'colaborador') {
            return res.status(403).json({ mensaje: 'No tienes permisos para crear invitaciones' });
        }

        const codigoNumerico = Math.floor(100000 + Math.random() * 900000).toString();
        const codigoAlfanumerico = Math.random().toString(36).substring(2, 8).toUpperCase();

        const invitacion = await db.Invitacion.create({
            rol,
            nombre,
            email,
            codigo: codigoAlfanumerico,
            codigoNumerico,
            creadaPorId: req.user.id,
            expiraEn: new Date(Date.now() + expiraEnMinutos * 60 * 1000),
            estado: 'pendiente'
        });
        const serverIp = process.env.APP_HOST_URL || req.hostname || '127.0.0.1';

        const qrPayload = JSON.stringify({
            tipo: 'invitacion_j4_v2',
            url: `http://${serverIp}:${PORT}`,
            invitacionId: invitacion.uuid,
            codigo: codigoNumerico,
            rol: rol
        });

        await db.AuditoriaMovimiento.create({
            usuarioId: req.user.id,
            tipoMovimiento: 'INVITACION_CREADA',
            detalles: { 
                action: 'invite_create',
                invitacionId: invitacion.id,
                rol: rol,
                email: email
            },
            fecha: new Date(),
            notas: `Nueva invitación para colaborador (${rol}) generada por ${req.user.nombre}`
        });

        res.status(201).json({
            exito: true,
            datos: {
                ...invitacion.toJSON(),
                qrDataUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrPayload)}`
            }
        });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al generar QR: ' + error.message });
    }
});

router.get('/qr/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        let invitacion;

        if (id && id.length > 20) {
            invitacion = await db.Invitacion.findOne({ where: { uuid: id } });
        } else if (id) {
            invitacion = await db.Invitacion.findByPk(id);
        }

        if (!invitacion) {
            return res.status(404).json({ mensaje: 'Invitación no encontrada' });
        }

        const PORT = process.env.PORT || 4000;
        const serverIp = process.env.APP_HOST_URL || req.hostname || '127.0.0.1';

        const qrPayload = JSON.stringify({
            tipo: 'invitacion_j4_v2',
            url: `http://${serverIp}:${PORT}`,
            invitacionId: invitacion.uuid,
            codigo: invitacion.codigoNumerico,
            rol: invitacion.rol
        });

        res.json({
            exito: true,
            datos: {
                ...invitacion.toJSON(),
                qrDataUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrPayload)}`
            }
        });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener QR: ' + error.message });
    }
});

router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const invitacion = await db.Invitacion.findByPk(id);

        if (!invitacion) return res.status(404).json({ mensaje: 'Invitación no encontrada' });

        const userRol = (req.user.rol || '').toLowerCase();
        if (userRol !== 'administrador' && invitacion.creadaPorId !== req.user.id) {
            return res.status(403).json({ mensaje: 'No tienes permisos para borrar esta invitación' });
        }

        await invitacion.update({ estado: 'cancelada' });
        res.json({ message: 'Invitación eliminada' });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al eliminar invitación: ' + error.message });
    }
});

router.post('/solicitar', async (req, res) => {
    try {
        const { invitacionId, codigo, codigoNumerico, nombreColaborador, dispositivoInfo } = req.body;

        if (!invitacionId && !codigoNumerico) {
            return res.status(400).json({ mensaje: 'Se requiere escanear un QR o un código numérico' });
        }

        let invitacion;
        let nombreSugerido;

        if (codigoNumerico && !invitacionId) {
            if (!nombreColaborador) {
                return res.status(400).json({ mensaje: 'Se requiere tu nombre para ingresar con código manual' });
            }
            invitacion = await db.Invitacion.findOne({
                where: { codigoNumerico: codigoNumerico, estado: 'pendiente' }
            });
            nombreSugerido = nombreColaborador;
        } else {
            invitacion = await db.Invitacion.findOne({
                where: { uuid: invitacionId, codigoNumerico: codigo, estado: 'pendiente' }
            });
            nombreSugerido = invitacion ? invitacion.nombre : null;
        }

        if (!invitacion) {
            return res.status(404).json({ mensaje: 'Invitación o código no válido o ya consumido' });
        }

        if (new Date() > new Date(invitacion.expiraEn)) {
            await invitacion.update({ estado: 'expirada' });
            return res.status(410).json({ mensaje: 'La invitación o el código ha expirado' });
        }

        const solicitud = await db.SolicitudConexion.create({
            invitacionId: invitacion.id,
            adminId: invitacion.creadaPorId,
            colaboradorId: null,
            estado: 'pendiente',
            estadoConexion: 'desconectado',
            metadata: {
                dispositivoInfo,
                rolSolicitado: invitacion.rol,
                nombreSugerido: nombreSugerido || 'Colaborador'
            }
        });

        if (io) io.emit('solicitudes-pendientes-actualizadas');

        res.status(201).json({
            exito: true,
            mensaje: 'Solicitud enviada. Espera a que el administrador la acepte.',
            datos: { solicitudId: solicitud.id }
        });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al enviar solicitud: ' + error.message });
    }
});

router.get('/pendientes', authenticateToken, async (req, res) => {
    try {
        const userRol = (req.user.rol || '').toLowerCase();
        const isAdmin = userRol === 'administrador';
        const isManager = userRol === 'contable';

        if (!isAdmin && !isManager) {
            return res.status(403).json({ mensaje: 'No tienes permisos para ver solicitudes' });
        }

        const where = { estado: 'pendiente' };
        if (!isAdmin) {
            where.adminId = req.user.id;
        }

        const solicitudes = await db.SolicitudConexion.findAll({
            where,
            include: [
                { model: db.Usuario, as: 'colaborador', attributes: ['id', 'nombre', 'email'] },
                { model: db.Invitacion, attributes: ['id', 'nombre', 'email'] }
            ],
            order: [['createdAt', 'DESC']]
        });

        const mapeadas = solicitudes.map(s => {
            const data = s.toJSON();
            data.nombreColaborador = data.colaborador?.nombre ||
                data.Invitacion?.nombre ||
                data.metadata?.nombreSugerido ||
                'Desconocido';
            return data;
        });

        res.json({ datos: mapeadas });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener solicitudes: ' + error.message });
    }
});

router.get('/conectados', authenticateToken, async (req, res) => {
    try {
        const userRol = (req.user.rol || '').toLowerCase();
        const isAdmin = userRol === 'administrador';
        const isManager = userRol === 'contable';

        if (!isAdmin && !isManager) {
            return res.status(403).json({ mensaje: 'No tienes permisos para ver conectados' });
        }

        const where = { estado: 'aceptada' };
        if (!isAdmin) {
            where.adminId = req.user.id;
        }

        const conectados = await db.SolicitudConexion.findAll({
            where,
            include: [
                { model: db.Usuario, as: 'colaborador', attributes: ['id', 'nombre', 'email'] },
                { model: db.Invitacion, attributes: ['id', 'nombre', 'email'] }
            ],
            order: [
                ['estadoConexion', 'ASC'],
                ['ultimoPing', 'DESC'],
                ['updatedAt', 'DESC']
            ]
        });

        const mapeadas = conectados.map(c => {
            const data = c.toJSON();
            data.nombreColaborador = data.colaborador?.nombre ||
                data.Invitacion?.nombre ||
                data.metadata?.nombreSugerido ||
                'Desconocido';
            return data;
        });

        res.json({ datos: mapeadas });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener conectados: ' + error.message });
    }
});

router.post('/:id/aceptar', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { sesionInventarioId } = req.body;

        const solicitud = await db.SolicitudConexion.findByPk(id, {
            include: [{ model: db.Invitacion }]
        });

        if (!solicitud) return res.status(404).json({ mensaje: 'Solicitud no encontrada' });

        if (req.user.rol !== 'administrador' && solicitud.adminId !== req.user.id) {
            return res.status(403).json({ mensaje: 'No tienes permiso sobre esta solicitud' });
        }

        let updateData = {
            estado: 'aceptada',
            estadoConexion: 'conectado'
        };

        if (sesionInventarioId) {
            updateData.sesionInventarioId = sesionInventarioId;
        }

        if (solicitud.Invitacion && solicitud.Invitacion.email) {
            let usuario = await db.Usuario.findOne({ where: { email: solicitud.Invitacion.email } });

            if (!usuario) {
                const passwordHash = await bcrypt.hash(solicitud.Invitacion.codigoNumerico, 12);
                usuario = await db.Usuario.create({
                    nombreUsuario: solicitud.Invitacion.email.split('@')[0] + '.' + Date.now(),
                    nombre: solicitud.Invitacion.nombre || 'Colaborador',
                    email: solicitud.Invitacion.email,
                    password: passwordHash,
                    rol: solicitud.Invitacion.rol || 'colaborador',
                    activo: true,
                    codigoAcceso: solicitud.Invitacion.codigoNumerico
                });
            }

            updateData.colaboradorId = usuario.id;

            await solicitud.Invitacion.update({
                estado: 'consumida',
                consumidaPorId: usuario.id
            });
        }

        await solicitud.update(updateData);

        await db.AuditoriaMovimiento.create({
            usuarioId: req.user.id,
            tipoMovimiento: 'COLABORADOR_ACEPTADO',
            detalles: { 
                action: 'collab_accept',
                solicitudId: solicitud.id,
                sesionInventarioId,
                colaboradorId: updateData.colaboradorId
            },
            fecha: new Date(),
            notas: `Solicitud de conexión aceptada para sesión ${sesionInventarioId}`
        });

        if (io) {
            io.emit(`estado-solicitud-actualizado-${solicitud.id}`, {
                estado: updateData.estado,
                estadoConexion: updateData.estadoConexion
            });
            io.emit('solicitudes-pendientes-actualizadas');
        }

        res.json({
            message: 'Solicitud aceptada y usuario vinculado correctamente',
            datos: {
                solicitudId: solicitud.id,
                colaboradorId: updateData.colaboradorId
            }
        });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al aceptar solicitud: ' + error.message });
    }
});

router.post('/:id/rechazar', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const solicitud = await db.SolicitudConexion.findByPk(id);

        if (!solicitud) return res.status(404).json({ mensaje: 'Solicitud no encontrada' });

        if (req.user.rol !== 'administrador' && solicitud.adminId !== req.user.id) {
            return res.status(403).json({ mensaje: 'No tienes permiso sobre esta solicitud' });
        }

        await solicitud.update({ estado: 'rechazada', estadoConexion: 'desconectado' });

        if (io) {
            io.emit(`estado-solicitud-actualizado-${solicitud.id}`, {
                estado: 'rechazada',
                estadoConexion: 'desconectado'
            });
            io.emit('solicitudes-pendientes-actualizadas');
        }

        res.json({ message: 'Solicitud rechazada' });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al rechazar solicitud: ' + error.message });
    }
});

router.get('/estado/:solicitudId', async (req, res) => {
    try {
        const { solicitudId } = req.params;
        const solicitud = await db.SolicitudConexion.findByPk(solicitudId, {
            include: [{ model: db.Usuario, as: 'colaborador', attributes: ['nombre', 'email', 'rol'] }]
        });

        if (!solicitud) return res.status(404).json({ ok: false, mensaje: 'Solicitud no encontrada' });

        res.json({
            ok: true,
            estado: solicitud.estado,
            estadoConexion: solicitud.estadoConexion,
            sesionInventario: solicitud.sesionInventarioId,
            colaborador: solicitud.colaborador
        });
    } catch (error) {
        res.status(500).json({ ok: false, mensaje: error.message });
    }
});

router.post('/:id/ping', async (req, res) => {
    try {
        const solicitud = await db.SolicitudConexion.findByPk(req.params.id);
        if (!solicitud) return res.status(404).json({ mensaje: 'No vinculada' });

        await solicitud.update({ ultimoPing: new Date(), estadoConexion: 'conectado' });
        res.json({ ok: true, serverTime: new Date() });
    } catch (error) {
        res.status(500).json({ mensaje: error.message });
    }
});

router.post('/:id/conectar', async (req, res) => {
    try {
        const solicitud = await db.SolicitudConexion.findByPk(req.params.id);
        if (!solicitud) return res.status(404).json({ mensaje: 'No vinculada' });

        await solicitud.update({ estadoConexion: 'conectado', ultimoPing: new Date() });
        res.json({ ok: true, mensaje: 'Conectado al servidor' });
    } catch (error) {
        res.status(500).json({ mensaje: error.message });
    }
});

router.post('/:id/cerrar-sesion', async (req, res) => {
    try {
        const solicitud = await db.SolicitudConexion.findByPk(req.params.id);
        if (solicitud) {
            await solicitud.update({ estadoConexion: 'desconectado' });
        }
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ mensaje: error.message });
    }
});

router.get('/:id/productos-offline', async (req, res) => {
    try {
        const solicitud = await db.SolicitudConexion.findByPk(req.params.id);
        if (!solicitud) return res.status(404).json({ mensaje: 'No encontrada' });

        const metadata = solicitud.metadata || {};
        const productosOffline = metadata.productosOffline || [];
        res.json({ ok: true, datos: productosOffline });
    } catch (error) {
        res.status(500).json({ mensaje: error.message });
    }
});

router.post('/:id/productos-offline', async (req, res) => {
    try {
        const solicitud = await db.SolicitudConexion.findByPk(req.params.id);
        if (!solicitud) return res.status(404).json({ mensaje: 'No encontrada' });

        const metadata = solicitud.metadata || {};
        const existentes = metadata.productosOffline || [];

        const nuevoProducto = {
            id: req.body.temporalId || req.body.id || Date.now().toString(),
            nombre: req.body.nombre,
            cantidad: req.body.cantidad,
            costo: req.body.costo,
            unidad: req.body.unidad,
            categoria: req.body.categoria,
            codigoBarras: req.body.codigoBarras,
            sincronizado: false,
            timestamp: new Date()
        };

        const nuevaLista = [...existentes, nuevoProducto];

        await solicitud.update({
            metadata: {
                ...metadata,
                productosOffline: nuevaLista
            }
        });

        res.json({ ok: true, datos: nuevoProducto });
    } catch (error) {
        res.status(500).json({ mensaje: error.message });
    }
});

router.post('/:id/sincronizar', authenticateToken, async (req, res) => {
    try {
        const { temporalIds } = req.body;
        if (!temporalIds || !Array.isArray(temporalIds)) {
            return res.status(400).json({ mensaje: 'Ids temporales requeridos' });
        }

        const solicitud = await db.SolicitudConexion.findByPk(req.params.id);
        if (!solicitud) return res.status(404).json({ mensaje: 'No encontrada' });

        if (req.user.rol !== 'administrador' && solicitud.adminId !== req.user.id) {
            return res.status(403).json({ mensaje: 'No tienes permiso sobre esta solicitud' });
        }

        const metadata = solicitud.metadata || {};
        const existentes = metadata.productosOffline || [];

        const actualizados = existentes.map(prod => {
            if (temporalIds.includes(prod.id)) {
                return { ...prod, sincronizado: true };
            }
            return prod;
        });

        await solicitud.update({
            metadata: {
                ...metadata,
                productosOffline: actualizados
            }
        });

        res.json({ ok: true, mensaje: 'Productos marcados como sincronizados' });
    } catch (error) {
        res.status(500).json({ mensaje: error.message });
    }
});

/**
 * Endpoint de sincronización masiva para colaboradores
 * Procesa múltiples productos en una sola transacción gestionada
 */
router.post('/:id/batch-sync-productos', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { sesionInventarioId, productos } = req.body;

        if (!productos || !Array.isArray(productos) || !sesionInventarioId) {
            return res.status(400).json({ mensaje: 'Datos incompletos para la sincronización' });
        }

        const resultado = await db.sequelize.transaction(async (t) => {
            // 1. Resolver solicitud (soporte UUID e ID)
            let solicitud;
            if (id.length > 20) {
                solicitud = await db.SolicitudConexion.findOne({ where: { uuid: id }, transaction: t });
            } else {
                solicitud = await db.SolicitudConexion.findByPk(id, { transaction: t });
            }

            if (!solicitud) throw new Error('SOLICITUD_NOT_FOUND');

            // 2. Obtener sesión
            const sesion = await db.SesionInventario.findByPk(sesionInventarioId, { transaction: t });
            if (!sesion) throw new Error('SESION_NOT_FOUND');

            console.log(`🚀 Iniciando sincronización masiva para ${productos.length} productos. Colaborador: ${req.user.nombre}`);

            const temporalIdsExitosos = [];

            // 3. Procesar cada producto
            for (const item of productos) {
                try {
                    const { temporalId, productoData } = item;
                    if (!productoData) continue;

                    const { nombre, cantidad, costo, unidad, categoria, sku, codigoBarras } = productoData;
                    const finalCantidad = Number(cantidad) || 1;
                    const finalCosto = Number(costo) || 0;

                    // A. Buscar/Crear en ProductoGeneral
                    let productoGeneral = await db.ProductoGeneral.findOne({
                        where: { nombre: nombre.trim() },
                        transaction: t
                    });

                    if (!productoGeneral && (codigoBarras || sku)) {
                        productoGeneral = await db.ProductoGeneral.findOne({
                            where: { codigoBarras: codigoBarras || sku },
                            transaction: t
                        });
                    }

                    if (!productoGeneral) {
                        productoGeneral = await db.ProductoGeneral.create({
                            nombre: nombre.trim(),
                            costoBase: finalCosto,
                            codigoBarras: codigoBarras || sku || '',
                            unidad: unidad || 'unidad',
                            categoria: categoria || 'General',
                            descripcion: 'Sincronizado desde colaborador',
                            activo: true,
                            tipoCreacion: 'colaborador'
                        }, { transaction: t });
                    }

                    // B. Buscar/Crear en Producto
                    let productoCliente = await db.Producto.findOne({
                        where: { nombre: nombre.trim() },
                        transaction: t
                    });

                    if (!productoCliente && (codigoBarras || sku)) {
                        productoCliente = await db.Producto.findOne({
                            where: { sku: codigoBarras || sku },
                            transaction: t
                        });
                    }

                    if (!productoCliente) {
                        productoCliente = await db.Producto.create({
                            nombre: nombre.trim(),
                            costo: finalCosto,
                            sku: codigoBarras || sku || '',
                            unidad: unidad || 'unidad',
                            activo: true
                        }, { transaction: t });
                    }

                    // C. Crear o actualizar registro en ProductoContado
                    const [productoContado, created] = await db.ProductoContado.findOrCreate({
                        where: {
                            sesionInventarioId: sesionInventarioId,
                            nombreProducto: nombre.trim()
                        },
                        defaults: {
                            sesionInventarioId: sesionInventarioId,
                            productoClienteId: productoCliente.id,
                            cantidadContada: finalCantidad,
                            costoProducto: finalCosto,
                            nombreProducto: nombre.trim(),
                            skuProducto: codigoBarras || sku || '',
                            valorTotal: finalCantidad * finalCosto,
                            agregadoPorId: req.user.id
                        },
                        transaction: t
                    });

                    if (!created) {
                        const nuevaCantidad = Number(productoContado.cantidadContada) + finalCantidad;
                        await productoContado.update({
                            cantidadContada: nuevaCantidad,
                            costoProducto: finalCosto,
                            valorTotal: nuevaCantidad * finalCosto
                        }, { transaction: t });
                    }

                    temporalIdsExitosos.push(temporalId);
                } catch (prodError) {
                    console.error(`⚠️ Error al sincronizar producto individual:`, prodError.message);
                }
            }

            // 4. Marcar en la solicitud como sincronizados
            const metadata = solicitud.metadata || {};
            const existentes = metadata.productosOffline || [];
            const actualizados = existentes.map(prod => {
                const pId = prod.id || prod.temporalId;
                if (temporalIdsExitosos.includes(pId)) {
                    return { ...prod, sincronizado: true };
                }
                return prod;
            });

            await solicitud.update({
                metadata: { ...metadata, productosOffline: actualizados }
            }, { transaction: t });

            // 5. Auditoría
            await db.AuditoriaMovimiento.create({
                usuarioId: req.user.id,
                tipoMovimiento: 'SINCRONIZACION_MOVIL',
                detalles: { 
                    action: 'batch_sync',
                    solicitudId: solicitud.id,
                    sesionInventarioId,
                    totalProductos: temporalIdsExitosos.length
                },
                fecha: new Date(),
                notas: `Sincronización masiva de ${temporalIdsExitosos.length} productos`
            }, { transaction: t });

            return {
                exito: true,
                mensaje: `Sincronizados ${temporalIdsExitosos.length} de ${productos.length} productos`,
                procesados: temporalIdsExitosos.length,
                sesionInventarioId
            };
        });

        if (io && resultado.exito && resultado.sesionInventarioId) {
            io.emit('update_session_inventory', { sesionId: resultado.sesionInventarioId, timestamp: Date.now() });
        }
        res.json(resultado);
    } catch (error) {
        console.error('❌ Error Batch Sync:', error);
        if (error.message === 'SOLICITUD_NOT_FOUND') return res.status(404).json({ mensaje: 'Solicitud de conexión no encontrada' });
        if (error.message === 'SESION_NOT_FOUND') return res.status(404).json({ mensaje: 'Sesión de inventario no encontrada' });
        res.status(500).json({ mensaje: error.message });
    }
});

module.exports = router;
