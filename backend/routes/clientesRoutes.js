const express = require('express');
const db = require('../models');
const { authenticateToken } = require('./authRoutes');

const router = express.Router();

const getClientesNegocios = async (req, res) => {
    try {
        const { limite = 20, pagina = 1, buscar = '' } = req.query;
        const offset = (pagina - 1) * limite;

        const where = { activo: true };
        if (req.user.rol !== 'administrador') {
            where.contadorAsignadoId = req.user.id;
        }

        if (buscar) {
            where.nombre = { [db.Sequelize.Op.iLike]: `%${buscar}%` };
        }

        const { count, rows } = await db.ClienteNegocio.findAndCountAll({
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
        res.status(500).json({ mensaje: 'Error al obtener clientes: ' + error.message });
    }
};

router.get('/', authenticateToken, getClientesNegocios);

router.post('/', authenticateToken, async (req, res) => {
    try {
        const { nombre, telefono, direccion, contadorAsignadoId, notas } = req.body;

        if (!nombre) {
            return res.status(400).json({ mensaje: 'El nombre es requerido' });
        }

        const cliente = await db.ClienteNegocio.create({
            nombre,
            telefono,
            direccion,
            contadorAsignadoId: contadorAsignadoId || req.user.id,
            notas,
            activo: true,
            created_by: req.user.id
        });

        res.status(201).json(cliente);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al crear cliente: ' + error.message });
    }
});

router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, telefono, direccion, contadorAsignadoId, notas } = req.body;

        const cliente = await db.ClienteNegocio.findByPk(id);
        if (!cliente) {
            return res.status(404).json({ mensaje: 'Cliente no encontrado' });
        }

        await cliente.update({ nombre, telefono, direccion, contadorAsignadoId, notas });

        res.json(cliente);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al actualizar cliente: ' + error.message });
    }
});

router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const cliente = await db.ClienteNegocio.findByPk(id);
        if (!cliente) {
            return res.status(404).json({ mensaje: 'Cliente no encontrado' });
        }

        await cliente.update({ activo: false });

        res.json({ message: 'Cliente eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al eliminar cliente: ' + error.message });
    }
});

module.exports = router;
