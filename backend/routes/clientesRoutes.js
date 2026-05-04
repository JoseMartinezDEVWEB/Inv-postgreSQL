const express = require('express');
const multer = require('multer');
const db = require('../models');
const { authenticateToken } = require('./authRoutes');
const { processFile } = require('../utils/importProcessor');

const router = express.Router();

// Multer: almacena archivos en memoria para procesarlos sin escribir al disco
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB por archivo
    fileFilter: (_req, file, cb) => {
        const allowed = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel'
        ];
        const allowedExt = ['.pdf', '.xlsx', '.xls'];
        const ext = '.' + file.originalname.split('.').pop().toLowerCase();
        if (allowed.includes(file.mimetype) || allowedExt.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de archivo no permitido. Use PDF, XLSX o XLS.'));
        }
    }
});

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
        res.status(500).json({ exito: false, mensaje: 'Error al obtener clientes: ' + error.message });
    }
};

router.get('/', authenticateToken, getClientesNegocios);

router.post('/', authenticateToken, async (req, res) => {
    try {
        const { nombre, telefono, direccion, contadorAsignadoId, notas } = req.body;

        if (!nombre || nombre.trim().length < 3) {
            return res.status(400).json({ exito: false, mensaje: 'El nombre es requerido y debe tener al menos 3 caracteres' });
        }

        const cliente = await db.ClienteNegocio.create({
            nombre: nombre.trim(),
            telefono: telefono ? telefono.trim() : null,
            direccion: direccion ? direccion.trim() : null,
            contadorAsignadoId: contadorAsignadoId || req.user.id,
            notas: notas ? notas.trim() : null,
            activo: true,
            created_by: req.user.id
        });

        res.status(201).json({ exito: true, datos: cliente, mensaje: 'Cliente creado correctamente' });
    } catch (error) {
        res.status(500).json({ exito: false, mensaje: 'Error al crear cliente: ' + error.message });
    }
});

router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({ exito: false, mensaje: 'ID de cliente inválido' });
        }

        const { nombre, telefono, direccion, contadorAsignadoId, notas } = req.body;

        const cliente = await db.ClienteNegocio.findByPk(id);
        if (!cliente) {
            return res.status(404).json({ exito: false, mensaje: 'Cliente no encontrado' });
        }

        await cliente.update({ 
            nombre: nombre ? nombre.trim() : cliente.nombre, 
            telefono: telefono !== undefined ? (telefono ? telefono.trim() : null) : cliente.telefono, 
            direccion: direccion !== undefined ? (direccion ? direccion.trim() : null) : cliente.direccion, 
            contadorAsignadoId: contadorAsignadoId || cliente.contadorAsignadoId, 
            notas: notas !== undefined ? (notas ? notas.trim() : null) : cliente.notas 
        });

        res.json({ exito: true, datos: cliente, mensaje: 'Cliente actualizado correctamente' });
    } catch (error) {
        res.status(500).json({ exito: false, mensaje: 'Error al actualizar cliente: ' + error.message });
    }
});

router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({ exito: false, mensaje: 'ID de cliente inválido' });
        }

        const cliente = await db.ClienteNegocio.findByPk(id);
        if (!cliente) {
            return res.status(404).json({ exito: false, mensaje: 'Cliente no encontrado' });
        }

        await cliente.update({ activo: false });

        res.json({ exito: true, mensaje: 'Cliente eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ exito: false, mensaje: 'Error al eliminar cliente: ' + error.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTACIÓN DESDE PDF / XLSX
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /clientes-negocios/importar-pdf/estado
 * Preflight: el frontend lo llama para verificar que el servidor de IA
 * está disponible antes de enviar los archivos.
 */
router.get('/importar-pdf/estado', authenticateToken, (_req, res) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(503).json({
                exito: false,
                datos: { ready: false, razon: 'GEMINI_API_KEY no configurada en el servidor' }
            });
        }
        res.json({ exito: true, datos: { ready: true } });
    } catch (error) {
        res.status(500).json({ exito: false, mensaje: error.message });
    }
});

/**
 * POST /clientes-negocios/:id/importar-pdf
 * Recibe hasta 10 archivos (PDF / XLSX / XLS), los procesa con IA,
 * crea una SesionInventario y guarda los productos extraídos.
 */
router.post('/:id/importar-pdf', authenticateToken, upload.array('files', 10), async (req, res) => {
    try {
        const clienteId = req.params.id;
        const files = req.files;
        const fechaInventario = req.body.fechaInventario || new Date().toISOString().split('T')[0];

        if (!files || files.length === 0) {
            return res.status(400).json({ exito: false, mensaje: 'No se recibieron archivos' });
        }

        // Verificar que el cliente existe
        const id = parseInt(clienteId);
        if (isNaN(id)) {
            return res.status(400).json({ exito: false, mensaje: 'ID de cliente inválido' });
        }

        const cliente = await db.ClienteNegocio.findByPk(id);
        if (!cliente) {
            return res.status(404).json({ exito: false, mensaje: 'Cliente no encontrado' });
        }

        const apiKey = process.env.GEMINI_API_KEY;

        // Procesar cada archivo y acumular productos
        const todosLosProductos = [];
        const erroresArchivos = [];

        // Procesar cada archivo y acumular productos en paralelo para máxima eficiencia
        const promesasProcesamiento = files.map(async (file) => {
            try {
                return await processFile(file.buffer, file.originalname, apiKey);
            } catch (err) {
                console.error(`❌ Error procesando archivo ${file.originalname}:`, err.message);
                erroresArchivos.push({ archivo: file.originalname, error: err.message });
                return [];
            }
        });

        const resultadosProductos = await Promise.all(promesasProcesamiento);
        resultadosProductos.forEach(productos => {
            todosLosProductos.push(...productos);
        });

        if (todosLosProductos.length === 0 && erroresArchivos.length > 0) {
            return res.status(422).json({
                exito: false,
                mensaje: 'No se pudieron extraer productos de ningún archivo',
                errores: erroresArchivos
            });
        }

        // Crear la SesionInventario dentro de una transacción
        const resultado = await db.sequelize.transaction(async (t) => {
            const countSesiones = await db.SesionInventario.count({ transaction: t });
            const numeroSesion = `IMP-${Date.now()}-${countSesiones + 1}`;

            const totalGeneral = todosLosProductos.reduce((sum, p) => {
                const cantidad = parseFloat(p.cantidadContada ?? p.cantidad ?? 1) || 0;
                const costo = parseFloat(p.costoBase ?? p.costo ?? p.precio ?? 0) || 0;
                return sum + (cantidad * costo);
            }, 0);

            const sesion = await db.SesionInventario.create({
                clienteNegocioId: cliente.id,
                contadorId: req.user.id,
                numeroSesion,
                fecha: new Date(fechaInventario),
                configuracion: { 
                    importadoDesdeArchivo: true, 
                    archivos: files.map(f => f.originalname),
                    timestamp: new Date().toISOString()
                },
                estado: 'completada',
                totales: {
                    valorTotalInventario: totalGeneral,
                    totalProductosContados: todosLosProductos.length,
                    totalActivos: totalGeneral,
                    totalPasivos: 0,
                    capitalContable: totalGeneral
                }
            }, { transaction: t });

            // Guardar cada producto como ProductoContado
            const productosGuardados = [];
            for (const p of todosLosProductos) {
                const cantidad = parseFloat(p.cantidadContada ?? p.cantidad ?? 0) || 0;
                const costo = parseFloat(p.costoBase ?? p.costo ?? p.precio ?? 0) || 0;

                const pc = await db.ProductoContado.create({
                    sesionInventarioId: sesion.id,
                    nombreProducto: (p.nombre || p.Producto || 'Producto sin nombre').substring(0, 255),
                    unidadProducto: (p.unidad || 'unidad').substring(0, 50),
                    costoProducto: costo,
                    skuProducto: p.codigoBarras ? String(p.codigoBarras).substring(0, 100) : null,
                    cantidadContada: cantidad,
                    valorTotal: cantidad * costo,
                    notas: (p.descripcion || p.categoria || '').substring(0, 500),
                    agregadoPorId: req.user.id,
                    aprobado: true
                }, { transaction: t });
                productosGuardados.push(pc);
            }

            return { sesion, productosGuardados, totalGeneral };
        });

        res.json({
            exito: true,
            datos: {
                sesion: {
                    _id: resultado.sesion.id,
                    id: resultado.sesion.id,
                    numeroSesion: resultado.sesion.numeroSesion
                },
                resumen: {
                    cliente: cliente.nombre,
                    fecha: fechaInventario,
                    totalProductos: resultado.productosGuardados.length,
                    totalGeneral: resultado.totalGeneral,
                    archivosProcesados: files.length,
                    erroresArchivos: erroresArchivos.length > 0 ? erroresArchivos : undefined
                }
            },
            mensaje: `Importación completada: ${resultado.productosGuardados.length} productos en ${files.length} archivo(s)`
        });

    } catch (error) {
        console.error('Error en importar-pdf:', error);
        res.status(500).json({ exito: false, mensaje: 'Error al procesar la importación: ' + error.message });
    }
});

module.exports = router;
