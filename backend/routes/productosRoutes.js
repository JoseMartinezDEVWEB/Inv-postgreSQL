const express = require('express');
const db = require('../models');
const { authenticateToken } = require('./authRoutes');

const multer = require('multer');
const { processFile } = require('../utils/importProcessor');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * Importar productos desde archivo XLSX o PDF (Usa IA)
 */
router.post('/generales/importar', authenticateToken, upload.single('archivo'), async (req, res) => {
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
        for (const p of productosProcesados) {
            // Lógica de "upsert" manual por nombre o código de barras
            let producto = null;
            
            if (p.codigoBarras) {
                producto = await db.ProductoGeneral.findOne({ where: { codigoBarras: p.codigoBarras } });
            }
            
            if (!producto && p.nombre) {
                producto = await db.ProductoGeneral.findOne({ where: { nombre: p.nombre } });
            }

            if (producto) {
                await producto.update({
                    ...p,
                    activo: true
                });
                resultados.push({ ...producto.toJSON(), _importStatus: 'updated' });
            } else {
                const nuevo = await db.ProductoGeneral.create({
                    ...p,
                    activo: true,
                    creadoPorId: req.user.id,
                    tipoCreacion: 'importacion'
                });
                resultados.push({ ...nuevo.toJSON(), _importStatus: 'created' });
            }
        }

        res.json({
            mensaje: `Importación completada: ${resultados.length} productos procesados`,
            productos: resultados
        });

    } catch (error) {
        console.error('Error en importación:', error);
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
