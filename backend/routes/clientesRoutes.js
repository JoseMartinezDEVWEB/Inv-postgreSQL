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
            where[db.Sequelize.Op.or] = [
                { nombre: { [db.Sequelize.Op.iLike]: `%${buscar}%` } },
                { telefono: { [db.Sequelize.Op.iLike]: `%${buscar}%` } }
            ];
        }

        const { count, rows } = await db.ClienteNegocio.findAndCountAll({
            where,
            limit: parseInt(limite),
            offset: parseInt(offset),
            order: [['nombre', 'ASC']]
        });

        // Enriquecer cada cliente con estadísticas de inventarios
        const clientesConEstadisticas = await Promise.all(rows.map(async (cliente) => {
            const clienteJson = cliente.toJSON();

            try {
                // Contar total de sesiones de inventario para este cliente
                const totalInventarios = await db.SesionInventario.count({
                    where: { clienteNegocioId: cliente.id }
                });

                // Obtener la fecha del último inventario
                const ultimaSesion = await db.SesionInventario.findOne({
                    where: { clienteNegocioId: cliente.id },
                    attributes: ['fecha', 'createdAt'],
                    order: [['createdAt', 'DESC']]
                });

                clienteJson.estadisticas = {
                    totalInventarios,
                    ultimoInventario: ultimaSesion ? (ultimaSesion.fecha || ultimaSesion.createdAt) : null
                };
            } catch (statError) {
                clienteJson.estadisticas = { totalInventarios: 0, ultimoInventario: null };
            }

            return clienteJson;
        }));

        res.json({
            datos: clientesConEstadisticas,
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
// IMPORTACIÓN PASO A PASO (productos → balance → distribución)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /clientes-negocios/:id/importar/productos
 * Recibe UN archivo (PDF/XLSX/XLS) con la lista de productos.
 * Crea una nueva SesionInventario y guarda los productos.
 * Retorna { sesionId, numeroSesion, totalProductos, totalGeneral, tipo }
 */
router.post('/:id/importar/productos', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        const clienteId = parseInt(req.params.id);
        if (isNaN(clienteId)) return res.status(400).json({ exito: false, mensaje: 'ID de cliente inválido' });

        const file = req.file;
        if (!file) return res.status(400).json({ exito: false, mensaje: 'No se recibió ningún archivo' });

        const cliente = await db.ClienteNegocio.findByPk(clienteId);
        if (!cliente) return res.status(404).json({ exito: false, mensaje: 'Cliente no encontrado' });

        const fechaInventario = req.body.fechaInventario || new Date().toISOString().split('T')[0];
        const apiKey = process.env.GEMINI_API_KEY;

        console.log(`[Import/Productos] ${file.originalname} para cliente ${clienteId}`);
        const resultado = await processFile(file.buffer, file.originalname, apiKey, 'productos');

        if (!resultado.productos || resultado.productos.length === 0) {
            return res.status(422).json({
                exito: false,
                mensaje: 'No se encontraron productos en el archivo. Verifique que sea el reporte de inventario correcto.'
            });
        }

        const totalGeneral = resultado.productos.reduce((sum, p) => {
            const cantidad = parseFloat(p.cantidadContada ?? p.cantidad ?? 0) || 0;
            const costo    = parseFloat(p.costoBase ?? p.costo ?? 0) || 0;
            return sum + (p.valorTotal ?? (cantidad * costo));
        }, 0);

        const sesion = await db.sequelize.transaction(async (t) => {
            const countSesiones = await db.SesionInventario.count({ transaction: t });
            const numeroSesion  = `IMP-${Date.now()}-${countSesiones + 1}`;

            const s = await db.SesionInventario.create({
                clienteNegocioId: cliente.id,
                contadorId: req.user.id,
                numeroSesion,
                fecha: new Date(fechaInventario),
                configuracion: {
                    importadoDesdeArchivo: true,
                    archivoProductos: file.originalname,
                    timestamp: new Date().toISOString(),
                },
                estado: 'completada',
                totales: {
                    valorTotalInventario: totalGeneral,
                    totalProductosContados: resultado.productos.length,
                }
            }, { transaction: t });

            for (const p of resultado.productos) {
                const cantidad = parseFloat(p.cantidadContada ?? p.cantidad ?? 0) || 0;
                const costo    = parseFloat(p.costoBase ?? p.costo ?? 0) || 0;
                const total    = p.valorTotal ?? (cantidad * costo);
                await db.ProductoContado.create({
                    sesionInventarioId: s.id,
                    nombreProducto: (p.nombre || 'Producto sin nombre').substring(0, 255),
                    unidadProducto: (p.unidad || 'unidad').substring(0, 50),
                    costoProducto: costo,
                    skuProducto: p.codigoBarras ? String(p.codigoBarras).substring(0, 100) : null,
                    cantidadContada: cantidad,
                    valorTotal: total,
                    notas: (p.descripcion || p.categoria || '').substring(0, 500),
                    agregadoPorId: req.user.id,
                    aprobado: true
                }, { transaction: t });
            }

            return s;
        });

        res.json({
            exito: true,
            datos: {
                sesionId: sesion.id,
                numeroSesion: sesion.numeroSesion,
                totalProductos: resultado.productos.length,
                totalGeneral,
                tipo: resultado.tipo,
            }
        });
    } catch (error) {
        console.error('[Import/Productos] Error:', error.message);
        res.status(500).json({ exito: false, mensaje: 'Error al importar productos: ' + error.message });
    }
});

/**
 * PATCH /clientes-negocios/:id/sesiones/:sesionId/importar-balance
 * Recibe UN archivo con el Balance General y actualiza la sesión existente.
 * Retorna { balance }
 */
router.patch('/:id/sesiones/:sesionId/importar-balance', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        const sesionId = parseInt(req.params.sesionId);
        if (isNaN(sesionId)) return res.status(400).json({ exito: false, mensaje: 'ID de sesión inválido' });

        const file = req.file;
        if (!file) return res.status(400).json({ exito: false, mensaje: 'No se recibió ningún archivo' });

        const sesion = await db.SesionInventario.findByPk(sesionId);
        if (!sesion) return res.status(404).json({ exito: false, mensaje: 'Sesión no encontrada' });

        const apiKey = process.env.GEMINI_API_KEY;
        console.log(`[Import/Balance] ${file.originalname} para sesión ${sesionId}`);
        const resultado = await processFile(file.buffer, file.originalname, apiKey, 'balance');

        if (!resultado.balance) {
            return res.status(422).json({
                exito: false,
                mensaje: 'No se encontraron datos de Balance General en el archivo. Verifique que sea el archivo correcto.'
            });
        }

        const b = resultado.balance;
        const configuracionActual = sesion.configuracion || {};
        const totalesActuales     = sesion.totales || {};

        await sesion.update({
            configuracion: {
                ...configuracionActual,
                archivoBalance: file.originalname,
                balanceGeneral: b,
            },
            totales: {
                ...totalesActuales,
                totalActivos:        b.total_activos        ?? totalesActuales.totalActivos,
                totalPasivos:        b.total_pasivos        ?? totalesActuales.totalPasivos,
                capitalContable:     b.capital_contable     ?? totalesActuales.capitalContable,
                utilidadNeta:        b.utilidad_neta        ?? totalesActuales.utilidadNeta,
                utilidadBruta:       b.utilidad_bruta       ?? totalesActuales.utilidadBruta,
                ventasDelMes:        b.ventas_del_mes       ?? totalesActuales.ventasDelMes,
                gastos:              b.gastos_generales     ?? totalesActuales.gastos,
                efectivoCajaBanco:   b.efectivo_caja_banco  ?? totalesActuales.efectivoCajaBanco,
                cuentasPorCobrar:    b.cuentas_por_cobrar   ?? totalesActuales.cuentasPorCobrar,
                activosFijos:        b.activos_fijos        ?? totalesActuales.activosFijos ?? 0,
                valorTotalInventario: b.valor_inventario    ?? totalesActuales.valorTotalInventario,
            }
        });

        res.json({ exito: true, datos: { balance: b } });
    } catch (error) {
        console.error('[Import/Balance] Error:', error.message);
        res.status(500).json({ exito: false, mensaje: 'Error al importar balance: ' + error.message });
    }
});

/**
 * PATCH /clientes-negocios/:id/sesiones/:sesionId/importar-distribucion
 * Recibe UN archivo con la Distribución de Saldo y actualiza la sesión existente.
 * Retorna { distribucion }
 */
router.patch('/:id/sesiones/:sesionId/importar-distribucion', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        const sesionId = parseInt(req.params.sesionId);
        if (isNaN(sesionId)) return res.status(400).json({ exito: false, mensaje: 'ID de sesión inválido' });

        const file = req.file;
        if (!file) return res.status(400).json({ exito: false, mensaje: 'No se recibió ningún archivo' });

        const sesion = await db.SesionInventario.findByPk(sesionId);
        if (!sesion) return res.status(404).json({ exito: false, mensaje: 'Sesión no encontrada' });

        const apiKey = process.env.GEMINI_API_KEY;
        console.log(`[Import/Distribucion] ${file.originalname} para sesión ${sesionId}`);
        const resultado = await processFile(file.buffer, file.originalname, apiKey, 'distribucion');

        if (!resultado.distribucion) {
            return res.status(422).json({
                exito: false,
                mensaje: 'No se encontraron datos de Distribución de Saldo en el archivo. Verifique que sea el archivo correcto.'
            });
        }

        const configuracionActual = sesion.configuracion || {};

        await sesion.update({
            configuracion: {
                ...configuracionActual,
                archivoDistribucion: file.originalname,
                distribucionSaldo: resultado.distribucion,
            }
        });

        res.json({ exito: true, datos: { distribucion: resultado.distribucion } });
    } catch (error) {
        console.error('[Import/Distribucion] Error:', error.message);
        res.status(500).json({ exito: false, mensaje: 'Error al importar distribución: ' + error.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTACIÓN LEGACY (un solo endpoint, múltiples archivos)
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
 * Recibe hasta 10 archivos (PDF / XLSX / XLS), los procesa con parser estructurado
 * (o IA como fallback), crea una SesionInventario y guarda productos + datos financieros.
 *
 * Archivos se procesan SECUENCIALMENTE para evitar saturación de la API de IA.
 */
router.post('/:id/importar-pdf', authenticateToken, upload.array('files', 10), async (req, res) => {
    try {
        const clienteId = req.params.id;
        const files = req.files;
        const fechaInventario = req.body.fechaInventario || new Date().toISOString().split('T')[0];

        if (!files || files.length === 0) {
            return res.status(400).json({ exito: false, mensaje: 'No se recibieron archivos' });
        }

        const id = parseInt(clienteId);
        if (isNaN(id)) {
            return res.status(400).json({ exito: false, mensaje: 'ID de cliente inválido' });
        }

        const cliente = await db.ClienteNegocio.findByPk(id);
        if (!cliente) {
            return res.status(404).json({ exito: false, mensaje: 'Cliente no encontrado' });
        }

        const apiKey = process.env.GEMINI_API_KEY;

        const todosLosProductos = [];
        const erroresArchivos = [];
        let balanceFinal = null;
        let distribucionFinal = null;

        // Procesar archivos SECUENCIALMENTE para evitar rate-limiting de IA
        for (const file of files) {
            try {
                console.log(`[Import] Procesando: ${file.originalname}`);
                const resultado = await processFile(file.buffer, file.originalname, apiKey);

                // Acumular productos
                if (resultado.productos && resultado.productos.length > 0) {
                    todosLosProductos.push(...resultado.productos);
                    console.log(`[Import] ${file.originalname}: ${resultado.productos.length} productos (tipo: ${resultado.tipo})`);
                } else {
                    console.log(`[Import] ${file.originalname}: sin productos (tipo: ${resultado.tipo})`);
                }

                // Tomar los datos financieros del primer archivo que los tenga
                if (resultado.balance && !balanceFinal) {
                    balanceFinal = resultado.balance;
                    console.log(`[Import] Balance General extraído de: ${file.originalname}`);
                }
                if (resultado.distribucion && !distribucionFinal) {
                    distribucionFinal = resultado.distribucion;
                    console.log(`[Import] Distribución de saldo extraída de: ${file.originalname}`);
                }
            } catch (err) {
                console.error(`❌ Error procesando ${file.originalname}:`, err.message);
                erroresArchivos.push({ archivo: file.originalname, error: err.message });
            }
        }

        if (todosLosProductos.length === 0 && !balanceFinal && erroresArchivos.length === files.length) {
            return res.status(422).json({
                exito: false,
                mensaje: 'No se pudieron extraer datos de ningún archivo',
                errores: erroresArchivos
            });
        }

        // Calcular totales del inventario
        const totalGeneral = todosLosProductos.reduce((sum, p) => {
            const cantidad = parseFloat(p.cantidadContada ?? p.cantidad ?? 0) || 0;
            const costo    = parseFloat(p.costoBase ?? p.costo ?? 0) || 0;
            // Use valorTotal from structured parser if available and consistent
            if (p.valorTotal && Math.abs(p.valorTotal - cantidad * costo) < 0.05) {
                return sum + p.valorTotal;
            }
            return sum + (cantidad * costo);
        }, 0);

        // Construir totales de la sesión incluyendo balance si fue extraído
        const totalesSesion = {
            valorTotalInventario: balanceFinal?.valor_inventario ?? totalGeneral,
            totalProductosContados: todosLosProductos.length,
            totalActivos: balanceFinal?.total_activos ?? totalGeneral,
            totalPasivos: balanceFinal?.total_pasivos ?? 0,
            capitalContable: balanceFinal?.capital_contable ?? totalGeneral,
            utilidadNeta: balanceFinal?.utilidad_neta,
            utilidadBruta: balanceFinal?.utilidad_bruta,
            ventasDelMes: balanceFinal?.ventas_del_mes,
            gastos: balanceFinal?.gastos_generales,
            efectivoCajaBanco: balanceFinal?.efectivo_caja_banco,
            cuentasPorCobrar: balanceFinal?.cuentas_por_cobrar,
            activosFijos: balanceFinal?.activos_fijos ?? 0,
        };

        // Crear sesión y guardar productos en una transacción
        const resultado = await db.sequelize.transaction(async (t) => {
            const countSesiones = await db.SesionInventario.count({ transaction: t });
            const numeroSesion = `IMP-${Date.now()}-${countSesiones + 1}`;

            const sesion = await db.SesionInventario.create({
                clienteNegocioId: cliente.id,
                contadorId: req.user.id,
                numeroSesion,
                fecha: new Date(fechaInventario),
                configuracion: {
                    importadoDesdeArchivo: true,
                    archivos: files.map(f => f.originalname),
                    timestamp: new Date().toISOString(),
                    balanceGeneral: balanceFinal || undefined,
                    distribucionSaldo: distribucionFinal || undefined
                },
                estado: 'completada',
                totales: totalesSesion
            }, { transaction: t });

            const productosGuardados = [];
            for (const p of todosLosProductos) {
                const cantidad = parseFloat(p.cantidadContada ?? p.cantidad ?? 0) || 0;
                const costo    = parseFloat(p.costoBase ?? p.costo ?? 0) || 0;
                const total    = p.valorTotal ?? (cantidad * costo);

                const pc = await db.ProductoContado.create({
                    sesionInventarioId: sesion.id,
                    nombreProducto: (p.nombre || 'Producto sin nombre').substring(0, 255),
                    unidadProducto: (p.unidad || 'unidad').substring(0, 50),
                    costoProducto: costo,
                    skuProducto: p.codigoBarras ? String(p.codigoBarras).substring(0, 100) : null,
                    cantidadContada: cantidad,
                    valorTotal: total,
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
                    erroresArchivos: erroresArchivos.length > 0 ? erroresArchivos : undefined,
                    balanceGeneral: balanceFinal || undefined,
                    distribucionSaldo: distribucionFinal || undefined
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
