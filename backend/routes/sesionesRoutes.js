const express = require('express');
const db = require('../models');
const { authenticateToken } = require('./authRoutes');

const router = express.Router();
const { emitNotification } = require('../utils/socketHandlers');

let io;
router.setIo = (socketIoInstance) => {
    io = socketIoInstance;
};

const getSesionesInventario = async (req, res) => {
    try {
        const { limite = 20, pagina = 1 } = req.query;
        const offset = (pagina - 1) * limite;

        const where = {};
        if (req.user.rol !== 'administrador') {
            where.contadorId = req.user.id;
        }

        const { count, rows } = await db.SesionInventario.findAndCountAll({
            where,
            include: [{ model: db.ClienteNegocio }],
            limit: parseInt(limite),
            offset: parseInt(offset),
            order: [['createdAt', 'DESC']]
        });

        res.json({
            sesiones: rows,
            paginacion: {
                total: count,
                pagina: parseInt(pagina),
                limite: parseInt(limite),
                totalPaginas: Math.ceil(count / limite)
            }
        });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener sesiones: ' + error.message });
    }
};

router.get('/', authenticateToken, getSesionesInventario);

/**
 * Obtener detalles de una sesión específica
 */
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const sesion = await db.SesionInventario.findByPk(id, {
            include: [
                { model: db.ClienteNegocio },
                { 
                    model: db.ProductoContado,
                    as: 'productosContados'
                }
            ],
            order: [
                [{ model: db.ProductoContado, as: 'productosContados' }, 'updatedAt', 'DESC']
            ]
        });

        if (!sesion) {
            return res.status(404).json({ mensaje: 'Sesión no encontrada' });
        }

        // Verificar permisos
        if (req.user.rol !== 'administrador' && sesion.contadorId !== req.user.id) {
            return res.status(403).json({ mensaje: 'No tienes permiso para acceder a esta sesión' });
        }

        res.json(sesion);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener detalles de la sesión: ' + error.message });
    }
});

router.post('/', authenticateToken, async (req, res) => {
    try {
        const { clienteNegocioId, configuracion } = req.body;

        if (!clienteNegocioId) {
            return res.status(400).json({ mensaje: 'El cliente es requerido' });
        }

        const sesionCompleta = await db.sequelize.transaction(async (t) => {
            let cliente;
            if (String(clienteNegocioId).length > 10) {
                cliente = await db.ClienteNegocio.findOne({ where: { uuid: clienteNegocioId }, transaction: t });
            } else {
                cliente = await db.ClienteNegocio.findByPk(clienteNegocioId, { transaction: t });
            }

            if (!cliente) {
                throw new Error('CLIENTE_NOT_FOUND');
            }

            const countSesiones = await db.SesionInventario.count({ transaction: t });
            const numeroSesion = `INV-${Date.now()}-${countSesiones + 1}`;

            const sesion = await db.SesionInventario.create({
                clienteNegocioId: cliente.id,
                contadorId: req.user.id,
                numeroSesion,
                configuracion: configuracion || {},
                estado: 'iniciada',
                totales: {
                    valorTotalInventario: 0,
                    totalProductosContados: 0,
                    totalActivos: 0,
                    totalPasivos: 0,
                    capitalContable: 0
                }
            }, { transaction: t });

            // Auditoría: sesión creada
            await db.AuditoriaMovimiento.create({
                usuarioId: req.user.id,
                tipoMovimiento: 'SESION_INICIADA',
                detalles: { 
                    action: 'session_create',
                    sesionId: sesion.id,
                    numeroSesion: sesion.numeroSesion,
                    cliente: cliente.nombre 
                },
                fecha: new Date(),
                notas: `Nueva sesión de inventario iniciada para ${cliente.nombre}`
            }, { transaction: t });

            // Notificar creación (fuera de la transacción pero después de éxito)
            setImmediate(() => {
                emitNotification(io, {
                    titulo: '📊 Nueva Sesión',
                    mensaje: `Inventario ${numeroSesion} iniciado para ${cliente.nombre}`,
                    tipo: 'success'
                });
            });

            return await db.SesionInventario.findByPk(sesion.id, {
                include: [
                    { model: db.ClienteNegocio },
                    { model: db.ProductoContado, as: 'productosContados' }
                ],
                order: [
                    [{ model: db.ProductoContado, as: 'productosContados' }, 'updatedAt', 'DESC']
                ],
                transaction: t
            });
        });

        res.status(201).json(sesionCompleta);
    } catch (error) {
        if (error.message === 'CLIENTE_NOT_FOUND') {
            return res.status(404).json({ mensaje: 'Cliente no encontrado' });
        }
        res.status(500).json({ mensaje: 'Error al crear sesión: ' + error.message });
    }
});

router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { estado, datosFinancieros, totales, configuracion } = req.body;

        const sesionActualizada = await db.sequelize.transaction(async (t) => {
            const sesion = await db.SesionInventario.findByPk(id, { 
                lock: t.LOCK.UPDATE,
                transaction: t 
            });
            
            if (!sesion) throw new Error('SESION_NOT_FOUND');

            const oldStatus = sesion.estado;
            const oldNumero = sesion.numeroSesion;

            await sesion.update({ 
                estado: estado || sesion.estado, 
                datosFinancieros: datosFinancieros || sesion.datosFinancieros, 
                totales: totales || sesion.totales, 
                configuracion: configuracion || sesion.configuracion 
            }, { transaction: t });

            // Auditoría: sesión actualizada (dentro de la transacción para consistencia)
            await db.AuditoriaMovimiento.create({
                usuarioId: req.user.id,
                tipoMovimiento: 'SESION_MODIFICADA',
                detalles: { 
                    action: 'session_update',
                    sesionId: id,
                    estadoAnterior: oldStatus,
                    nuevoEstado: estado || oldStatus,
                    cambios: { datosFinancieros, totales, configuracion }
                },
                fecha: new Date(),
                notas: `Datos de sesión ${oldNumero} actualizados`
            }, { transaction: t });

            return await db.SesionInventario.findByPk(id, {
                include: [
                    { model: db.ClienteNegocio },
                    { model: db.ProductoContado, as: 'productosContados' }
                ],
                order: [
                    [{ model: db.ProductoContado, as: 'productosContados' }, 'updatedAt', 'DESC']
                ],
                transaction: t
            });
        });

        res.json(sesionActualizada);
    } catch (error) {
        if (error.message === 'SESION_NOT_FOUND') {
            return res.status(404).json({ mensaje: 'Sesión no encontrada' });
        }
        res.status(500).json({ mensaje: 'Error al actualizar sesión: ' + error.message });
    }
});

router.patch('/:id/completar', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const sesion = await db.SesionInventario.findByPk(id);
        if (!sesion) {
            return res.status(404).json({ mensaje: 'Sesión no encontrada' });
        }

        await sesion.update({ estado: 'completada' });

        // Auditoría: sesión completada
        await db.AuditoriaMovimiento.create({
            usuarioId: req.user.id,
            tipoMovimiento: 'SESION_COMPLETADA',
            detalles: { 
                action: 'session_complete',
                sesionId: sesion.id,
                numeroSesion: sesion.numeroSesion
            },
            fecha: new Date(),
            notas: `Sesión de inventario ${sesion.numeroSesion} finalizada y validada`
        });

        // Notificar completitud
        emitNotification(io, {
            titulo: '✅ Sesión Finalizada',
            mensaje: `El inventario ${sesion.numeroSesion} ha sido completado por ${req.user.nombre}`,
            tipo: 'success'
        });

        res.json({ message: 'Sesión completada', sesion });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al completar sesión: ' + error.message });
    }
});

router.patch('/:id/cancelar', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const sesion = await db.SesionInventario.findByPk(id);
        if (!sesion) {
            return res.status(404).json({ mensaje: 'Sesión no encontrada' });
        }

        await sesion.update({ estado: 'cancelada' });

        // Auditoría: sesión cancelada
        await db.AuditoriaMovimiento.create({
            usuarioId: req.user.id,
            tipoMovimiento: 'SESION_CANCELADA',
            detalles: { 
                action: 'session_cancel',
                sesionId: sesion.id,
                numeroSesion: sesion.numeroSesion
            },
            fecha: new Date(),
            notas: `Sesión de inventario ${sesion.numeroSesion} cancelada`
        });

        res.json({ message: 'Sesión cancelada', sesion });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al cancelar sesión: ' + error.message });
    }
});

router.get('/agenda/resumen', authenticateToken, async (req, res) => {
    try {
        const { mes } = req.query;

        let where = {};
        if (mes) {
            const [year, month] = mes.split('-');
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0);
            where.fecha = {
                [db.Sequelize.Op.between]: [startDate, endDate]
            };
        }

        const sesiones = await db.SesionInventario.findAll({
            where,
            include: [{ model: db.ClienteNegocio }],
            order: [['fecha', 'ASC']]
        });

        const resumen = sesiones.map(s => ({
            id: s.id,
            fecha: s.fecha,
            numeroSesion: s.numeroSesion,
            estado: s.estado,
            cliente: s.ClienteNegocio ? s.ClienteNegocio.nombre : 'Sin cliente'
        }));

        res.json(resumen);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener agenda: ' + error.message });
    }
});

/**
 * Gestión de productos dentro de una sesión
 */
router.post('/:id/productos', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { productoClienteId, cantidadContada, notas } = req.body;

        const sesion = await db.SesionInventario.findByPk(id);
        if (!sesion) {
            return res.status(404).json({ mensaje: 'Sesión no encontrada' });
        }

        const productoBase = await db.Producto.findByPk(productoClienteId);
        if (!productoBase) {
            return res.status(404).json({ mensaje: 'Producto base no encontrado' });
        }

        // Crear registro en ProductoContado
        const productoContado = await db.ProductoContado.create({
            sesionInventarioId: id,
            productoClienteId,
            nombreProducto: productoBase.nombre,
            unidadProducto: productoBase.unidad,
            costoProducto: productoBase.costo,
            skuProducto: productoBase.sku,
            cantidadContada: cantidadContada || 0,
            valorTotal: (cantidadContada || 0) * (productoBase.costo || 0),
            notas: notas || '',
            agregadoPorId: req.user.id
        });

        if (io) io.emit('update_session_inventory', { 
            sesionId: id, 
            timestamp: Date.now(),
            action: 'add',
            producto: productoContado
        });
        res.status(201).json(productoContado);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al agregar producto a la sesión: ' + error.message });
    }
});

router.put('/:id/productos/:productId', authenticateToken, async (req, res) => {
    try {
        const { id, productId } = req.params;
        const { cantidadContada, costoProducto, notas } = req.body;

        const producto = await db.ProductoContado.findOne({
            where: { id: productId, sesionInventarioId: id }
        });

        if (!producto) {
            return res.status(404).json({ mensaje: 'Producto no encontrado en esta sesión' });
        }

        const nuevaCantidad = cantidadContada !== undefined ? cantidadContada : producto.cantidadContada;
        const nuevoCosto = costoProducto !== undefined ? costoProducto : producto.costoProducto;

        await producto.update({
            cantidadContada: nuevaCantidad,
            costoProducto: nuevoCosto,
            valorTotal: nuevaCantidad * nuevoCosto,
            notas: notas !== undefined ? notas : producto.notas
        });

        if (io) io.emit('update_session_inventory', { 
            sesionId: id, 
            timestamp: Date.now(),
            action: 'update',
            producto: producto 
        });
        res.json(producto);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al actualizar producto en la sesión: ' + error.message });
    }
});

router.delete('/:id/productos/:productId', authenticateToken, async (req, res) => {
    try {
        const { id, productId } = req.params;

        const deleted = await db.ProductoContado.destroy({
            where: { id: productId, sesionInventarioId: id }
        });

        if (!deleted) {
            return res.status(404).json({ mensaje: 'Producto no encontrado en esta sesión' });
        }

        if (io) io.emit('update_session_inventory', { 
            sesionId: id, 
            timestamp: Date.now(),
            action: 'delete',
            productoId: productId
        });
        res.json({ message: 'Producto eliminado de la sesión' });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al eliminar producto de la sesión: ' + error.message });
    }
});

/**
 * Control del temporizador (Timer)
 */
router.patch('/:id/timer/pause', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const sesion = await db.SesionInventario.findByPk(id);

        if (!sesion) return res.status(404).json({ mensaje: 'Sesión no encontrada' });

        if (sesion.timerEnMarcha) {
            const ahora = new Date();
            const inicio = new Date(sesion.timerUltimoInicio);
            const diffSegundos = Math.floor((ahora - inicio) / 1000);
            
            await sesion.update({
                timerEnMarcha: false,
                timerAcumuladoSegundos: (sesion.timerAcumuladoSegundos || 0) + diffSegundos
            });
        }

        res.json({ timerEnMarcha: false, timerAcumuladoSegundos: sesion.timerAcumuladoSegundos });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al pausar timer: ' + error.message });
    }
});

router.patch('/:id/timer/resume', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const sesion = await db.SesionInventario.findByPk(id);

        if (!sesion) return res.status(404).json({ mensaje: 'Sesión no encontrada' });

        if (!sesion.timerEnMarcha) {
            await sesion.update({
                timerEnMarcha: true,
                timerUltimoInicio: new Date()
            });
        }

        res.json({ timerEnMarcha: true, timerUltimoInicio: sesion.timerUltimoInicio });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al reanudar timer: ' + error.message });
    }
});

/**
 * Gestión financiera de la sesión
 */
router.put('/:id/financieros', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { datosFinancieros } = req.body;

        const sesion = await db.SesionInventario.findByPk(id);
        if (!sesion) return res.status(404).json({ mensaje: 'Sesión no encontrada' });

        await sesion.update({ datosFinancieros });

        res.json(sesion);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al actualizar datos financieros: ' + error.message });
    }
});

module.exports = router;
