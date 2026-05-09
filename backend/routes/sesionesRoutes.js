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
        const { limite = 20, pagina = 1, buscar = '' } = req.query;
        const offset = (pagina - 1) * limite;

        const where = {};
        if (req.user.rol !== 'administrador') {
            where.contadorId = req.user.id;
        }

        // Búsqueda por número de sesión si se especifica
        if (buscar) {
            where.numeroSesion = { [db.Sequelize.Op.iLike]: `%${buscar}%` };
        }

        const { count, rows } = await db.SesionInventario.findAndCountAll({
            where,
            include: [{ 
                model: db.ClienteNegocio, 
                as: 'clienteNegocio',
                attributes: ['id', 'nombre', 'telefono', 'direccion']
            }],
            limit: parseInt(limite),
            offset: parseInt(offset),
            order: [['createdAt', 'DESC']]
        });

        res.json({
            exito: true,
            datos: {
                sesiones: rows,
                paginacion: {
                    total: count,
                    totalRegistros: count,
                    pagina: parseInt(pagina),
                    limite: parseInt(limite),
                    totalPaginas: Math.ceil(count / limite)
                }
            }
        });
    } catch (error) {
        res.status(500).json({ exito: false, mensaje: 'Error al obtener sesiones: ' + error.message });
    }
};

router.get('/', authenticateToken, getSesionesInventario);

// ─────────────────────────────────────────────────────────────────────────────
// RUTAS ESPECÍFICAS - Deben registrarse ANTES de la ruta /:id para evitar
// que Express interprete 'agenda', 'cliente', etc. como IDs
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// AGENDA - Rutas de calendario
// ─────────────────────────────────────────────────────────────────────────────

router.get('/agenda/resumen', authenticateToken, async (req, res) => {
    try {
        const { mes } = req.query;

        let where = {};
        if (mes) {
            const [year, month] = mes.split('-');
            const startDate = new Date(`${year}-${month.padStart(2,'0')}-01T00:00:00.000Z`);
            const nextMonth = month === '12' ? `${parseInt(year)+1}-01` : `${year}-${String(parseInt(month)+1).padStart(2,'0')}`;
            const endDate = new Date(`${nextMonth}-01T00:00:00.000Z`);
            where.fecha = {
                [db.Sequelize.Op.gte]: startDate,
                [db.Sequelize.Op.lt]: endDate
            };
        }

        const sesiones = await db.SesionInventario.findAll({
            where,
            attributes: ['id', 'fecha'],
            order: [['fecha', 'ASC']]
        });

        // Agrupar por fecha YYYY-MM-DD
        const byDate = {};
        sesiones.forEach(s => {
            if (!s.fecha) return;
            const dateKey = new Date(s.fecha).toISOString().slice(0, 10);
            byDate[dateKey] = (byDate[dateKey] || 0) + 1;
        });

        const resumen = Object.entries(byDate).map(([fecha, total]) => ({ fecha, total }));

        res.json({ exito: true, datos: { resumen } });
    } catch (error) {
        res.status(500).json({ exito: false, mensaje: 'Error al obtener agenda: ' + error.message });
    }
});

router.get('/agenda/dia', authenticateToken, async (req, res) => {
    try {
        const { fecha } = req.query;
        if (!fecha) return res.status(400).json({ exito: false, mensaje: 'Falta el parámetro fecha' });

        const startDate = new Date(fecha + 'T00:00:00.000Z');
        const endDate = new Date(fecha + 'T23:59:59.999Z');

        const sesiones = await db.SesionInventario.findAll({
            where: {
                fecha: { [db.Sequelize.Op.between]: [startDate, endDate] }
            },
            include: [{ model: db.ClienteNegocio, as: 'clienteNegocio', attributes: ['id', 'nombre', 'telefono'] }],
            order: [['fecha', 'ASC']]
        });

        const result = sesiones.map(s => ({
            id: s.id,
            numeroSesion: s.numeroSesion,
            estado: s.estado,
            fecha: s.fecha,
            totales: s.totales,
            clienteNegocio: s.clienteNegocio ? { 
                id: s.clienteNegocio.id, 
                nombre: s.clienteNegocio.nombre,
                telefono: s.clienteNegocio.telefono
            } : null
        }));

        res.json({ exito: true, datos: { sesiones: result } });
    } catch (error) {
        res.status(500).json({ exito: false, mensaje: 'Error al obtener sesiones del día: ' + error.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// SESIONES POR CLIENTE
// ─────────────────────────────────────────────────────────────────────────────

router.get('/cliente/:clienteId', authenticateToken, async (req, res) => {
    try {
        const { clienteId } = req.params;
        const { limite = 50, pagina = 1, estado, fechaDesde, fechaHasta } = req.query;
        const offset = (pagina - 1) * limite;

        const where = { clienteNegocioId: clienteId };
        if (estado && estado !== 'todos') {
            where.estado = estado;
        }
        if (fechaDesde || fechaHasta) {
            where.fecha = {};
            if (fechaDesde) where.fecha[db.Sequelize.Op.gte] = new Date(fechaDesde + 'T00:00:00.000Z');
            if (fechaHasta) where.fecha[db.Sequelize.Op.lte] = new Date(fechaHasta + 'T23:59:59.999Z');
        }

        const { count, rows } = await db.SesionInventario.findAndCountAll({
            where,
            include: [{ 
                model: db.ClienteNegocio, 
                as: 'clienteNegocio',
                attributes: ['id', 'nombre', 'telefono', 'direccion']
            }],
            limit: parseInt(limite),
            offset: parseInt(offset),
            order: [['createdAt', 'DESC']]
        });

        res.json({
            exito: true,
            datos: {
                sesiones: rows,
                paginacion: {
                    total: count,
                    totalRegistros: count,
                    pagina: parseInt(pagina),
                    limite: parseInt(limite),
                    totalPaginas: Math.ceil(count / limite)
                }
            }
        });
    } catch (error) {
        res.status(500).json({ exito: false, mensaje: 'Error al obtener sesiones del cliente: ' + error.message });
    }
});

/**
 * Obtener la sesión completada anterior a una sesión específica para un cliente
 */
router.get('/cliente/:clienteId/ultima-previa/:sesionIdActual', authenticateToken, async (req, res) => {
    try {
        const { clienteId, sesionIdActual } = req.params;

        const sesionActual = await db.SesionInventario.findByPk(sesionIdActual);
        if (!sesionActual) {
            return res.status(404).json({ exito: false, mensaje: 'Sesión actual no encontrada' });
        }

        const sesionPrevia = await db.SesionInventario.findOne({
            where: {
                clienteNegocioId: clienteId,
                estado: 'completada',
                createdAt: { [db.Sequelize.Op.lt]: sesionActual.createdAt }
            },
            order: [['createdAt', 'DESC']]
        });

        res.json({
            exito: true,
            datos: sesionPrevia || null
        });
    } catch (error) {
        res.status(500).json({ exito: false, mensaje: 'Error al obtener sesión previa: ' + error.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// DETALLE DE UNA SESIÓN ESPECÍFICA (DEBE IR DESPUÉS DE LAS RUTAS ESPECÍFICAS)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Obtener detalles de una sesión específica
 */
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const sesion = await db.SesionInventario.findByPk(id, {
            include: [
                { model: db.ClienteNegocio, as: 'clienteNegocio' },
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
                    { model: db.ClienteNegocio, as: 'clienteNegocio' },
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
            const { estado, datosFinancieros, totales, configuracion, fechaProximoInventario } = req.body;

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
                configuracion: configuracion || sesion.configuracion,
                fechaProximoInventario: fechaProximoInventario !== undefined ? fechaProximoInventario : sesion.fechaProximoInventario
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
                    { model: db.ClienteNegocio, as: 'clienteNegocio' },
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

        // ✅ NUEVO: Buscar si el producto ya existe en la sesión para SUMARLO (Idempotencia)
        let productoContado = await db.ProductoContado.findOne({
            where: {
                sesionInventarioId: id,
                [db.Sequelize.Op.or]: [
                    { productoClienteId: productoClienteId },
                    { nombreProducto: productoBase.nombre }
                ]
            }
        });

        if (productoContado) {
            // Si ya existe, sumar cantidades y actualizar costo
            const nuevaCantidad = (Number(productoContado.cantidadContada) || 0) + (Number(cantidadContada) || 0);
            await productoContado.update({
                cantidadContada: nuevaCantidad,
                costoProducto: productoBase.costo,
                valorTotal: nuevaCantidad * (productoBase.costo || 0),
                notas: notas ? `${productoContado.notas}\n${notas}`.trim() : productoContado.notas,
                updatedAt: new Date() // Forzar actualización de fecha para que suba en la lista
            });

            if (io) io.emit('update_session_inventory', { 
                sesionId: id, 
                timestamp: Date.now(),
                action: 'update',
                producto: productoContado
            });
            return res.status(200).json(productoContado);
        }

        // Si no existe, crear nuevo registro
        productoContado = await db.ProductoContado.create({
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
