const express = require('express');
const db = require('../models');
const { authenticateToken } = require('./authRoutes');

const router = express.Router();

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

router.post('/generales', authenticateToken, async (req, res) => {
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

        res.status(201).json(producto);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al crear producto: ' + error.message });
    }
});

router.put('/generales/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, descripcion, categoria, unidad, costoBase, codigoBarras, proveedor, notas } = req.body;

        const producto = await db.ProductoGeneral.findByPk(id);
        if (!producto) {
            return res.status(404).json({ mensaje: 'Producto no encontrado' });
        }

        await producto.update({ nombre, descripcion, categoria, unidad, costoBase, codigoBarras, proveedor, notas });

        res.json(producto);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al actualizar producto: ' + error.message });
    }
});

router.delete('/generales/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const producto = await db.ProductoGeneral.findByPk(id);
        if (!producto) {
            return res.status(404).json({ mensaje: 'Producto no encontrado' });
        }

        await producto.update({ activo: false });

        res.json({ message: 'Producto eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al eliminar producto: ' + error.message });
    }
});

module.exports = router;
