const express = require('express');
const db = require('../models');
const { authenticateToken } = require('./authRoutes');

const router = express.Router();

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
                    order: [['updatedAt', 'DESC']]
                }
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

        let cliente;
        if (String(clienteNegocioId).length > 10) {
            cliente = await db.ClienteNegocio.findOne({ where: { uuid: clienteNegocioId } });
        } else {
            cliente = await db.ClienteNegocio.findByPk(clienteNegocioId);
        }

        if (!cliente) {
            return res.status(404).json({ mensaje: 'Cliente no encontrado' });
        }

        const countSesiones = await db.SesionInventario.count();
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
        });

        const sesionCompleta = await db.SesionInventario.findByPk(sesion.id, {
            include: [
                { model: db.ClienteNegocio },
                { model: db.ProductoContado }
            ]
        });

        res.status(201).json(sesionCompleta);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al crear sesión: ' + error.message });
    }
});

router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { estado, datosFinancieros, totales, configuracion } = req.body;

        const sesion = await db.SesionInventario.findByPk(id);
        if (!sesion) {
            return res.status(404).json({ mensaje: 'Sesión no encontrada' });
        }

        await sesion.update({ estado, datosFinancieros, totales, configuracion });

        const sesionActualizada = await db.SesionInventario.findByPk(id, {
            include: [
                { model: db.ClienteNegocio },
                { model: db.ProductoContado }
            ]
        });

        res.json(sesionActualizada);
    } catch (error) {
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

module.exports = router;
