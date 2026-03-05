const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./models');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Configuración de Middlewares
app.use(cors()); // Permitir peticiones desde otros dominios (frontend)
app.use(express.json()); // Permitir el procesamiento de JSON en el cuerpo de las peticiones

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET;

// Lógica de WebSockets para Colaboradores
let colaboradoresActivos = new Map();

io.on('connection', (socket) => {
    console.log('📱 Nuevo colaborador conectado:', socket.id);

    socket.on('join-session', (userData) => {
        colaboradoresActivos.set(socket.id, {
            ...userData,
            idSocket: socket.id,
            ultimaActividad: new Date()
        });
        io.emit('colaboradores-actualizados', Array.from(colaboradoresActivos.values()));
    });

    socket.on('disconnect', () => {
        colaboradoresActivos.delete(socket.id);
        io.emit('colaboradores-actualizados', Array.from(colaboradoresActivos.values()));
        console.log('👋 Colaborador desconectado');
    });
});

// Endpoint de Salud para Electron
app.get('/api/salud', (req, res) => {
    res.json({ status: 'ok', message: 'Servidor PostgreSQL + Socket.io activo' });
});

/**
 * Endpoint de información de red para el móvil - PÚBLICO
 * El móvil llama a este endpoint SIN TOKEN para verificar que el servidor
 * escaneado es un servidor J4 Pro válido. Por eso NO requiere autenticación.
 */
app.get('/api/red/info', async (req, res) => {
    try {
        const os = require('os');
        const networkInterfaces = os.networkInterfaces();
        let ip = '127.0.0.1';

        // Intentar encontrar la IP de la red local (LAN)
        for (const interfaceName in networkInterfaces) {
            const networkInterface = networkInterfaces[interfaceName];
            for (const details of networkInterface) {
                if (details.family === 'IPv4' && !details.internal) {
                    ip = details.address;
                    break;
                }
            }
            if (ip !== '127.0.0.1') break;
        }

        const port = PORT;
        // Payload compacto para evitar problemas de tamaño/codificación en QR
        const qrPayload = JSON.stringify({
            t: 'cfg', // tipo: config
            url: `http://${ip}:${port}`,
            apiUrl: `http://${ip}:${port}/api`,
            j4pro_url: `http://${ip}:${port}` // Mantener por compatibilidad con app actual
        });

        res.json({
            ok: true,
            ip,
            port,
            apiUrl: `http://${ip}:${port}/api`,
            qrPayload,
            qrDataUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrPayload)}&charset-source=UTF-8`
        });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener info de red', error: error.message });
    }
});

/**
 * Middleware para autenticar el token JWT
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        console.log('⚠️ Token no proporcionado');
        return res.status(401).json({ mensaje: 'Token no proporcionado', error: 'Token no proporcionado' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.log('❌ Token inválido o expirado:', err.message);
            return res.status(403).json({ mensaje: 'Token inválido o expirado', error: 'Token inválido o expirado' });
        }
        req.user = user;
        next();
    });
}

// --- ENDPOINTS DE AUTENTICACIÓN ---

/**
 * Endpoint de Login
 * Recibe credencial (email o nombreUsuario) y contraseña
 */
app.post('/api/auth/login', async (req, res) => {
    const { credencial, password } = req.body;
    try {
        // Buscar usuario por email o nombre de usuario
        const usuario = await db.Usuario.findOne({
            where: {
                [db.Sequelize.Op.or]: [{ email: credencial }, { nombreUsuario: credencial }],
                activo: true
            }
        });

        if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado', error: 'Usuario no encontrado' });

        // Verificar la contraseña
        const validPassword = await bcrypt.compare(password, usuario.password);
        if (!validPassword) return res.status(401).json({ mensaje: 'Contraseña incorrecta', error: 'Contraseña incorrecta' });

        // Generar Token JWT válido por 24 horas
        const accessToken = jwt.sign(
            { id: usuario.id, rol: usuario.rol, nombre: usuario.nombre },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Generar Refresh Token válido por 7 días
        const refreshToken = jwt.sign(
            { id: usuario.id, type: 'refresh' },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            accessToken,
            refreshToken,
            token: accessToken, // Alias para compatibilidad
            usuario: {
                id: usuario.id,
                nombre: usuario.nombre,
                rol: usuario.rol,
                email: usuario.email
            }
        });
    } catch (error) {
        console.error('❌ Error en login:', error.message, error.stack);
        res.status(500).json({ mensaje: 'Error en el inicio de sesión: ' + error.message, error: 'Error en el inicio de sesión: ' + error.message });
    }
});

/**
 * Endpoint de diagnóstico del perfil actual
 */
app.get('/api/mi-perfil', authenticateToken, (req, res) => {
    res.json({
        mensaje: 'Perfil recuperado con éxito',
        usuario: req.user
    });
});

// --- ENDPOINTS DE PRODUCTOS ---

/**
 * Obtener todos los productos activos (Tabla Producto - Inventario Actual)
 */
app.get('/api/productos', authenticateToken, async (req, res) => {
    try {
        const productos = await db.Producto.findAll({ where: { activo: true } });
        res.json(productos);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener productos: ' + error.message, error: 'Error al obtener productos: ' + error.message });
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
            productos: rows,
            paginacion: {
                total: count,
                totalRegistros: count,
                pagina: parseInt(pagina),
                limite: parseInt(limite),
                totalPaginas: Math.ceil(count / limite)
            }
        });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener productos generales: ' + error.message, error: 'Error al obtener productos generales: ' + error.message });
    }
};

app.get('/api/productos/generales', authenticateToken, getProductosGenerales);
app.get('/api/productos_generales', authenticateToken, getProductosGenerales); // Alias

app.get('/api/productos/generales/categorias', authenticateToken, async (req, res) => {
    try {
        const categorias = await db.ProductoGeneral.findAll({
            attributes: [[db.Sequelize.fn('DISTINCT', db.Sequelize.col('categoria')), 'categoria']],
            where: { activo: true }
        });
        // Si no hay categorías en la BD, devolver las por defecto
        if (categorias.length === 0) {
            return res.json(['General', 'Alimentos General', 'Enlatados', 'Mercado', 'Embutidos', 'Carnes', 'Bebidas']);
        }
        res.json(categorias.map(c => c.categoria));
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener categorías: ' + error.message, error: 'Error al obtener categorías: ' + error.message });
    }
});

// --- ENDPOINTS DE CLIENTES ---

const getClientesNegocios = async (req, res) => {
    try {
        const { limite = 20, pagina = 1, buscar = '' } = req.query;
        const offset = (pagina - 1) * limite;

        const where = { activo: true };
        // Si no es admin, solo ver sus clientes asignados
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
        res.status(500).json({ mensaje: 'Error al obtener clientes: ' + error.message, error: 'Error al obtener clientes: ' + error.message });
    }
};

app.get('/api/clientes-negocios', authenticateToken, getClientesNegocios);
app.get('/api/clientes_negocios', authenticateToken, getClientesNegocios); // Alias

// --- ENDPOINTS DE SESIONES ---

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
        res.status(500).json({ mensaje: 'Error al obtener sesiones: ' + error.message, error: 'Error al obtener sesiones: ' + error.message });
    }
};

app.get('/api/sesiones-inventario', authenticateToken, getSesionesInventario);
app.get('/api/sesiones_inventario', authenticateToken, getSesionesInventario); // Alias

app.get('/api/reportes/estadisticas', authenticateToken, async (req, res) => {
    try {
        const totalClientes = await db.ClienteNegocio.count({ where: { activo: true } });
        const totalSesiones = await db.SesionInventario.count();

        const sesiones = await db.SesionInventario.findAll({
            attributes: ['totales']
        });

        let valorTotalInventarios = 0;
        sesiones.forEach(s => {
            if (s.totales && s.totales.valorTotalInventario) {
                valorTotalInventarios += parseFloat(s.totales.valorTotalInventario);
            }
        });

        res.json({
            estadisticasGenerales: {
                totalClientes,
                totalSesiones,
                valorTotalInventarios
            }
        });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener estadísticas: ' + error.message, error: 'Error al obtener estadísticas: ' + error.message });
    }
});

// --- ENDPOINTS DE USUARIOS ---

// Obtener subordinados (colaboradores) del contable actual
app.get('/api/usuarios/subordinados', authenticateToken, async (req, res) => {
    try {
        const userRol = (req.user.rol || '').toLowerCase();
        if (userRol !== 'contable' && userRol !== 'contador' && userRol !== 'administrador') {
            return res.status(403).json({ mensaje: 'No tienes permisos para ver subordinados', error: 'No tienes permisos para ver subordinados' });
        }

        let whereCondition = { activo: true };

        // Administrador puede ver contadores y colaboradores
        if (userRol === 'administrador') {
            whereCondition.rol = ['contador', 'colaborador'];
        } else {
            // Contador/Contable solo ve colaboradores
            whereCondition.rol = 'colaborador';
        }

        const usuarios = await db.Usuario.findAll({
            where: whereCondition,
            attributes: ['id', 'nombreUsuario', 'nombre', 'email', 'rol', 'activo', 'createdAt']
        });
        res.json({ datos: usuarios });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener subordinados: ' + error.message, error: 'Error al obtener subordinados: ' + error.message });
    }
});

app.get('/api/usuarios', authenticateToken, async (req, res) => {
    try {
        const userRol = (req.user.rol || '').toLowerCase();
        if (userRol !== 'administrador') {
            return res.status(403).json({ mensaje: 'Solo administradores pueden ver usuarios', error: 'Solo administradores pueden ver usuarios' });
        }
        const usuarios = await db.Usuario.findAll({
            where: { activo: true },
            attributes: ['id', 'nombreUsuario', 'nombre', 'email', 'rol', 'activo', 'createdAt']
        });
        res.json(usuarios);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener usuarios: ' + error.message, error: 'Error al obtener usuarios: ' + error.message });
    }
});

app.post('/api/usuarios', authenticateToken, async (req, res) => {
    try {
        const rolCreador = (req.user.rol || '').toLowerCase();
        let { nombreUsuario, nombre, email, password, rol } = req.body;

        if (!nombre || !email || !password || !rol) {
            return res.status(400).json({ mensaje: 'Todos los campos son requeridos', error: 'Todos los campos son requeridos' });
        }

        if (!nombreUsuario) {
            nombreUsuario = nombre.replace(/\s+/g, '.').toLowerCase() + '.' + Date.now();
        }

        const targetRol = (rol || '').toLowerCase();

        if (rolCreador === 'colaborador') {
            return res.status(403).json({ mensaje: 'No tienes permisos para crear usuarios', error: 'No tienes permisos para crear usuarios' });
        }

        if (rolCreador === 'contador' && targetRol !== 'colaborador') {
            return res.status(403).json({ mensaje: 'Solo puedes crear usuarios colaboradores', error: 'Solo puedes crear usuarios colaboradores' });
        }

        if (rolCreador === 'administrador' && targetRol === 'administrador') {
            return res.status(403).json({ mensaje: 'No puedes crear usuarios con rol administrador', error: 'No puedes crear usuarios con rol administrador' });
        }

        if ((targetRol === 'contador' || targetRol === 'administrador') && rolCreador !== 'administrador') {
            return res.status(403).json({ mensaje: 'No tienes permisos para crear este tipo de usuario', error: 'No tienes permisos para crear este tipo de usuario' });
        }

        const existe = await db.Usuario.findOne({ where: { email } });
        if (existe) {
            return res.status(400).json({ mensaje: 'El email ya está registrado', error: 'El email ya está registrado' });
        }

        const hash = await bcrypt.hash(password, 12);
        const usuario = await db.Usuario.create({
            nombreUsuario,
            nombre,
            email,
            password: hash,
            rol,
            activo: true
        });

        res.status(201).json({
            id: usuario.id,
            nombreUsuario: usuario.nombreUsuario,
            nombre: usuario.nombre,
            email: usuario.email,
            rol: usuario.rol
        });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al crear usuario: ' + error.message, error: 'Error al crear usuario: ' + error.message });
    }
});

app.put('/api/usuarios/:id', authenticateToken, async (req, res) => {
    try {
        const userRol = (req.user.rol || '').toLowerCase();
        if (userRol !== 'administrador') {
            return res.status(403).json({ mensaje: 'Solo administradores pueden editar usuarios', error: 'Solo administradores pueden editar usuarios' });
        }
        const { id } = req.params;
        const { nombreUsuario, nombre, email, rol, password } = req.body;

        const usuario = await db.Usuario.findByPk(id);
        if (!usuario) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado', error: 'Usuario no encontrado' });
        }

        const updateData = { nombreUsuario, nombre, email, rol };
        if (password) {
            updateData.password = await bcrypt.hash(password, 12);
        }

        await usuario.update(updateData);

        res.json({
            id: usuario.id,
            nombreUsuario: usuario.nombreUsuario,
            nombre: usuario.nombre,
            email: usuario.email,
            rol: usuario.rol
        });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al actualizar usuario: ' + error.message, error: 'Error al actualizar usuario: ' + error.message });
    }
});

app.delete('/api/usuarios/:id', authenticateToken, async (req, res) => {
    try {
        const userRol = (req.user.rol || '').toLowerCase();
        if (userRol !== 'administrador') {
            return res.status(403).json({ mensaje: 'Solo administradores pueden eliminar usuarios', error: 'Solo administradores pueden eliminar usuarios' });
        }
        const { id } = req.params;

        const usuario = await db.Usuario.findByPk(id);
        if (!usuario) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado', error: 'Usuario no encontrado' });
        }

        await usuario.update({ activo: false });

        res.json({ message: 'Usuario eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al eliminar usuario: ' + error.message, error: 'Error al eliminar usuario: ' + error.message });
    }
});

// --- ENDPOINTS DE CLIENTES ---

app.post('/api/clientes-negocios', authenticateToken, async (req, res) => {
    try {
        const { nombre, telefono, direccion, contadorAsignadoId, notas } = req.body;

        if (!nombre) {
            return res.status(400).json({ mensaje: 'El nombre es requerido', error: 'El nombre es requerido' });
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
        res.status(500).json({ mensaje: 'Error al crear cliente: ' + error.message, error: 'Error al crear cliente: ' + error.message });
    }
});

app.put('/api/clientes-negocios/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, telefono, direccion, contadorAsignadoId, notas } = req.body;

        const cliente = await db.ClienteNegocio.findByPk(id);
        if (!cliente) {
            return res.status(404).json({ mensaje: 'Cliente no encontrado', error: 'Cliente no encontrado' });
        }

        await cliente.update({ nombre, telefono, direccion, contadorAsignadoId, notas });

        res.json(cliente);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al actualizar cliente: ' + error.message, error: 'Error al actualizar cliente: ' + error.message });
    }
});

app.delete('/api/clientes-negocios/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const cliente = await db.ClienteNegocio.findByPk(id);
        if (!cliente) {
            return res.status(404).json({ mensaje: 'Cliente no encontrado', error: 'Cliente no encontrado' });
        }

        await cliente.update({ activo: false });

        res.json({ message: 'Cliente eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al eliminar cliente: ' + error.message, error: 'Error al eliminar cliente: ' + error.message });
    }
});

// --- ENDPOINTS DE PRODUCTOS GENERALES ---

app.post('/api/productos/generales', authenticateToken, async (req, res) => {
    try {
        const { nombre, descripcion, categoria, unidad, costoBase, codigoBarras, proveedor, notas } = req.body;

        if (!nombre) {
            return res.status(400).json({ mensaje: 'El nombre es requerido', error: 'El nombre es requerido' });
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
        res.status(500).json({ mensaje: 'Error al crear producto: ' + error.message, error: 'Error al crear producto: ' + error.message });
    }
});

app.put('/api/productos/generales/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, descripcion, categoria, unidad, costoBase, codigoBarras, proveedor, notas } = req.body;

        const producto = await db.ProductoGeneral.findByPk(id);
        if (!producto) {
            return res.status(404).json({ mensaje: 'Producto no encontrado', error: 'Producto no encontrado' });
        }

        await producto.update({ nombre, descripcion, categoria, unidad, costoBase, codigoBarras, proveedor, notas });

        res.json(producto);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al actualizar producto: ' + error.message, error: 'Error al actualizar producto: ' + error.message });
    }
});

app.delete('/api/productos/generales/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const producto = await db.ProductoGeneral.findByPk(id);
        if (!producto) {
            return res.status(404).json({ mensaje: 'Producto no encontrado', error: 'Producto no encontrado' });
        }

        await producto.update({ activo: false });

        res.json({ message: 'Producto eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al eliminar producto: ' + error.message, error: 'Error al eliminar producto: ' + error.message });
    }
});

// --- ENDPOINTS DE SESIONES DE INVENTARIO ---

app.post('/api/sesiones-inventario', authenticateToken, async (req, res) => {
    try {
        const { clienteNegocioId, configuracion } = req.body;

        if (!clienteNegocioId) {
            return res.status(400).json({ mensaje: 'El cliente es requerido', error: 'El cliente es requerido' });
        }

        let cliente;
        // Si es un UUID de 24+ caracteres, buscar por uuid, sino por id numérico
        if (String(clienteNegocioId).length > 10) {
            cliente = await db.ClienteNegocio.findOne({ where: { uuid: clienteNegocioId } });
        } else {
            cliente = await db.ClienteNegocio.findByPk(clienteNegocioId);
        }

        if (!cliente) {
            return res.status(404).json({ mensaje: 'Cliente no encontrado', error: 'Cliente no encontrado' });
        }

        const countSesiones = await db.SesionInventario.count();
        const numeroSesion = `INV-${Date.now()}-${countSesiones + 1}`;

        const sesion = await db.SesionInventario.create({
            clienteNegocioId: cliente.id, // Usar el ID numérico del cliente
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
            include: [{ model: db.ClienteNegocio }]
        });

        res.status(201).json(sesionCompleta);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al crear sesión: ' + error.message, error: 'Error al crear sesión: ' + error.message });
    }
});

app.put('/api/sesiones-inventario/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { estado, datosFinancieros, totales, configuracion } = req.body;

        const sesion = await db.SesionInventario.findByPk(id);
        if (!sesion) {
            return res.status(404).json({ mensaje: 'Sesión no encontrada', error: 'Sesión no encontrada' });
        }

        await sesion.update({ estado, datosFinancieros, totales, configuracion });

        const sesionActualizada = await db.SesionInventario.findByPk(id, {
            include: [{ model: db.ClienteNegocio }]
        });

        res.json(sesionActualizada);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al actualizar sesión: ' + error.message, error: 'Error al actualizar sesión: ' + error.message });
    }
});

app.patch('/api/sesiones-inventario/:id/completar', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const sesion = await db.SesionInventario.findByPk(id);
        if (!sesion) {
            return res.status(404).json({ mensaje: 'Sesión no encontrada', error: 'Sesión no encontrada' });
        }

        await sesion.update({ estado: 'completada' });

        res.json({ message: 'Sesión completada', sesion });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al completar sesión: ' + error.message, error: 'Error al completar sesión: ' + error.message });
    }
});

app.patch('/api/sesiones-inventario/:id/cancelar', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const sesion = await db.SesionInventario.findByPk(id);
        if (!sesion) {
            return res.status(404).json({ mensaje: 'Sesión no encontrada', error: 'Sesión no encontrada' });
        }

        await sesion.update({ estado: 'cancelada' });

        res.json({ message: 'Sesión cancelada', sesion });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al cancelar sesión: ' + error.message, error: 'Error al cancelar sesión: ' + error.message });
    }
});

// --- ENDPOINTS DE AGENDA ---

app.get('/api/sesiones-inventario/agenda/resumen', authenticateToken, async (req, res) => {
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
        res.status(500).json({ mensaje: 'Error al obtener agenda: ' + error.message, error: 'Error al obtener agenda: ' + error.message });
    }
});

// --- ENDPOINTS DE INVITACIONES (Colaboradores) ---

app.get('/api/invitaciones/mis-invitaciones', authenticateToken, async (req, res) => {
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
        res.status(500).json({ mensaje: 'Error al obtener invitaciones: ' + error.message, error: 'Error al obtener invitaciones: ' + error.message });
    }
});

app.get('/api/invitaciones/colaboradores', authenticateToken, async (req, res) => {
    try {
        // En esta arquitectura, los colaboradores son Usuarios vinculados
        // Podríamos filtrar subordinados o por rol
        const where = { rol: 'colaborador', activo: true };

        const colaboradores = await db.Usuario.findAll({
            where,
            attributes: ['id', 'nombre', 'email', 'rol', 'activo', 'createdAt']
        });
        res.json({ datos: colaboradores });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener colaboradores: ' + error.message, error: 'Error al obtener colaboradores: ' + error.message });
    }
});

app.post('/api/invitaciones/qr', authenticateToken, async (req, res) => {
    try {
        const { rol = 'colaborador', nombre, email, expiraEnMinutos = 1440 } = req.body;

        // Validar permisos
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

        const qrPayload = JSON.stringify({
            invitacionId: invitacion.uuid,
            codigo: codigoNumerico,
            serverIp: '10.0.0.41',
            port: PORT
        });

        res.status(201).json({
            exito: true,
            datos: {
                ...invitacion.toJSON(),
                qrDataUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrPayload)}`
            }
        });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al generar QR: ' + error.message, error: 'Error al generar QR: ' + error.message });
    }
});

app.delete('/api/invitaciones/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const invitacion = await db.Invitacion.findByPk(id);

        if (!invitacion) return res.status(404).json({ mensaje: 'Invitación no encontrada' });

        const userRol = (req.user.rol || '').toLowerCase();
        // Solo el creador o admin puede borrar
        if (userRol !== 'administrador' && invitacion.creadaPorId !== req.user.id) {
            return res.status(403).json({ mensaje: 'No tienes permisos para borrar esta invitación' });
        }

        await invitacion.update({ estado: 'cancelada' });
        res.json({ message: 'Invitación eliminada' });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al eliminar invitación: ' + error.message, error: 'Error al eliminar invitación: ' + error.message });
    }
});

// --- ENDPOINTS DE SOLICITUDES DE CONEXIÓN ---

/**
 * Solicitar conexión desde dispositivo móvil (Público)
 */
app.post('/api/solicitudes-conexion/solicitar', async (req, res) => {
    try {
        const { invitacionId, codigo, dispositivoInfo } = req.body;

        if (!invitacionId || !codigo) {
            return res.status(400).json({ mensaje: 'Invitación y código requeridos' });
        }

        // Buscar invitación válida
        const invitacion = await db.Invitacion.findOne({
            where: {
                uuid: invitacionId,
                codigoNumerico: codigo,
                estado: 'pendiente'
            }
        });

        if (!invitacion) {
            return res.status(404).json({ mensaje: 'Invitación no válida o ya consumida' });
        }

        if (new Date() > new Date(invitacion.expiraEn)) {
            await invitacion.update({ estado: 'expirada' });
            return res.status(410).json({ mensaje: 'La invitación ha expirado' });
        }

        // Crear solicitud
        const solicitud = await db.SolicitudConexion.create({
            invitacionId: invitacion.id,
            adminId: invitacion.creadaPorId,
            colaboradorId: null, // Se asigna al aceptar si no tiene cuenta
            estado: 'pendiente',
            estadoConexion: 'desconectado',
            metadata: {
                dispositivoInfo,
                rolSolicitado: invitacion.rol,
                nombreSugerido: invitacion.nombre
            }
        });

        res.status(201).json({
            exito: true,
            mensaje: 'Solicitud enviada. Espera a que el administrador la acepte.',
            datos: { solicitudId: solicitud.id }
        });
    } catch (error) {
        console.error('Error al solicitar conexión:', error);
        res.status(500).json({ mensaje: 'Error al enviar solicitud: ' + error.message });
    }
});

app.get('/api/solicitudes-conexion/pendientes', authenticateToken, async (req, res) => {
    try {
        const userRol = (req.user.rol || '').toLowerCase();
        const isAdmin = userRol === 'administrador';
        const isManager = userRol === 'contador' || userRol === 'contable';

        // Permitir a Administradores y Contadores ver solicitudes
        if (!isAdmin && !isManager) {
            console.log(`🚫 Acceso denegado a /pendientes para rol: [${req.user.rol}]`);
            return res.status(403).json({ mensaje: 'No tienes permisos para ver solicitudes', error: 'No tienes permisos para ver solicitudes' });
        }

        const where = { estado: 'pendiente' };
        if (!isAdmin) {
            where.adminId = req.user.id;
        }

        const solicitudes = await db.SolicitudConexion.findAll({
            where,
            include: [{ model: db.Usuario, as: 'colaborador', attributes: ['id', 'nombre', 'email'] }],
            order: [['createdAt', 'DESC']]
        });

        res.json({ datos: solicitudes });
    } catch (error) {
        console.error('❌ Error al obtener solicitudes pendientes:', error.message, error.stack);
        res.status(500).json({ mensaje: 'Error al obtener solicitudes: ' + error.message, error: 'Error al obtener solicitudes: ' + error.message });
    }
});

app.get('/api/solicitudes-conexion/conectados', authenticateToken, async (req, res) => {
    try {
        const userRol = (req.user.rol || '').toLowerCase();
        const isAdmin = userRol === 'administrador';
        const isManager = userRol === 'contador' || userRol === 'contable';

        if (!isAdmin && !isManager) {
            return res.status(403).json({ mensaje: 'No tienes permisos para ver conectados', error: 'No tienes permisos para ver conectados' });
        }

        const where = { estado: 'aceptada' }; // O 'conectado' si queremos filtrar por conexión activa
        if (!isAdmin) {
            where.adminId = req.user.id;
        }

        const conectados = await db.SolicitudConexion.findAll({
            where,
            include: [{ model: db.Usuario, as: 'colaborador', attributes: ['id', 'nombre', 'email'] }]
        });

        res.json({ datos: conectados });
    } catch (error) {
        console.error('❌ Error al obtener colaboradores conectados:', error.message, error.stack);
        res.status(500).json({ mensaje: 'Error al obtener conectados: ' + error.message, error: 'Error al obtener conectados: ' + error.message });
    }
});

app.post('/api/solicitudes-conexion/:id/aceptar', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { sesionInventarioId } = req.body;

        const solicitud = await db.SolicitudConexion.findByPk(id, {
            include: [{ model: db.Invitacion }]
        });

        if (!solicitud) return res.status(404).json({ mensaje: 'Solicitud no encontrada' });

        // Validar propiedad: Administrador o el Contador que creó la invitación
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

        // Si la invitación tiene email, buscamos o creamos la cuenta de usuario para el colaborador
        if (solicitud.Invitacion && solicitud.Invitacion.email) {
            let usuario = await db.Usuario.findOne({ where: { email: solicitud.Invitacion.email } });

            if (!usuario) {
                // Generamos un usuario automáticamente si no existe
                const passwordHash = await bcrypt.hash(solicitud.Invitacion.codigoNumerico, 12);
                usuario = await db.Usuario.create({
                    nombreUsuario: solicitud.Invitacion.email.split('@')[0] + '.' + Date.now(),
                    nombre: solicitud.Invitacion.nombre || 'Colaborador',
                    email: solicitud.Invitacion.email,
                    password: passwordHash,
                    rol: solicitud.Invitacion.rol || 'colaborador',
                    activo: true,
                    codigoAcceso: solicitud.Invitacion.codigoNumerico // Usar el PIN del QR como acceso rápido
                });
            }

            updateData.colaboradorId = usuario.id;

            // Marcar invitación como consumida
            await solicitud.Invitacion.update({
                estado: 'consumida',
                consumidaPorId: usuario.id
            });
        }

        await solicitud.update(updateData);

        res.json({
            message: 'Solicitud aceptada y usuario vinculado correctamente',
            datos: {
                solicitudId: solicitud.id,
                colaboradorId: updateData.colaboradorId
            }
        });
    } catch (error) {
        console.error('❌ Error al aceptar solicitud:', error.message, error.stack);
        res.status(500).json({ mensaje: 'Error al aceptar solicitud: ' + error.message, error: 'Error al aceptar solicitud: ' + error.message });
    }
});

app.post('/api/solicitudes-conexion/:id/rechazar', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const solicitud = await db.SolicitudConexion.findByPk(id);

        if (!solicitud) return res.status(404).json({ mensaje: 'Solicitud no encontrada' });

        if (req.user.rol !== 'administrador' && solicitud.adminId !== req.user.id) {
            return res.status(403).json({ mensaje: 'No tienes permiso sobre esta solicitud' });
        }

        await solicitud.update({ estado: 'rechazada', estadoConexion: 'desconectado' });
        res.json({ message: 'Solicitud rechazada' });
    } catch (error) {
        console.error('❌ Error al rechazar solicitud:', error.message, error.stack);
        res.status(500).json({ mensaje: 'Error al rechazar solicitud: ' + error.message, error: 'Error al rechazar solicitud: ' + error.message });
    }
});

/**
 * Endpoints dinámicos para el flujo móvil
 */

app.get('/api/solicitudes-conexion/estado/:solicitudId', async (req, res) => {
    try {
        const { solicitudId } = req.params;
        const solicitud = await db.SolicitudConexion.findByPk(solicitudId, {
            include: [{ model: db.Usuario, as: 'colaborador', attributes: ['nombre', 'email', 'rol'] }]
        });

        if (!solicitud) return res.status(404).json({ ok: false, mensaje: 'Solicitud no encontrada' });

        res.json({
            ok: true,
            estado: solicitud.estado, // pendiente, aceptada, rechazada
            colaborador: solicitud.colaborador
        });
    } catch (error) {
        res.status(500).json({ ok: false, mensaje: error.message });
    }
});

app.post('/api/solicitudes-conexion/:id/ping', async (req, res) => {
    try {
        const solicitud = await db.SolicitudConexion.findByPk(req.params.id);
        if (!solicitud) return res.status(404).json({ mensaje: 'No vinculada' });

        await solicitud.update({ ultimoPing: new Date(), estadoConexion: 'conectado' });
        res.json({ ok: true, serverTime: new Date() });
    } catch (error) {
        res.status(500).json({ mensaje: error.message });
    }
});

app.post('/api/solicitudes-conexion/:id/conectar', async (req, res) => {
    try {
        const solicitud = await db.SolicitudConexion.findByPk(req.params.id);
        if (!solicitud) return res.status(404).json({ mensaje: 'No vinculada' });

        await solicitud.update({ estadoConexion: 'conectado', ultimoPing: new Date() });
        res.json({ ok: true, mensaje: 'Conectado al servidor' });
    } catch (error) {
        res.status(500).json({ mensaje: error.message });
    }
});

app.post('/api/solicitudes-conexion/:id/cerrar-sesion', async (req, res) => {
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

// --- ENDPOINT DE SINCRONIZACIÓN (MÓVIL) ---

/**
 * Endpoint para recibir datos desde la app móvil
 * Sincroniza Entidades resolviendo los IDs temporales (UUID) de SQLite a PK (Integer) de Postgres
 */
app.post('/api/sincronizar', authenticateToken, async (req, res) => {
    const {
        clientes = [],
        productos = [],
        sesiones = [],
        productos_contados = [],
        dispositivoId
    } = req.body;

    // Usamos una transacción para asegurar integridad referencial
    const t = await db.sequelize.transaction();

    try {
        const mapasId = {
            clientes: {},
            productos: {},
            sesiones: {}
        };
        let totalProcesados = 0;

        // Obtener el contexto de negocio (adminId) relacionado al colaborador
        const solicitud = await db.SolicitudConexion.findOne({
            where: { colaboradorId: req.user.id, estado: 'aceptada' }
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
                    contadorId: businessId, // Asociar al manager del colaborador
                    estado: ses.estado || 'en_progreso',
                    fecha: ses.fecha || new Date()
                }, { transaction: t });
            } else {
                await dbSes.update({ estado: ses.estado }, { transaction: t });
            }
            mapasId.sesiones[tmpId] = dbSes.id;
            totalProcesados++;
        }

        // 4. Resolver y Sincronizar Productos Contados (Asignados a una Sesión)
        for (const ct of productos_contados) {
            let sId = ct.sesionId;
            if (mapasId.sesiones[sId]) sId = mapasId.sesiones[sId];

            let pId = ct.productoId;
            if (mapasId.productos[pId]) pId = mapasId.productos[pId];

            if (!sId || isNaN(parseInt(sId))) continue; // Ignoramos si no se pudo atar la sesión

            await db.ProductoContado.create({
                sesionInventarioId: sId,
                productoClienteId: isNaN(parseInt(pId)) ? null : pId,
                nombreProducto: ct.nombreProducto || 'Producto Sincronizado',
                skuProducto: ct.skuProducto || '',
                cantidadContada: ct.cantidad || 0,
                costoProducto: ct.costo || 0,
                agregadoPorId: req.user.id // Mantener quién lo contó realmente
            }, { transaction: t });
            totalProcesados++;
        }

        // Confirmar transaccionalidad total
        await t.commit();

        // Retornar el mapa para que SQLite actualice sus IDs temporales (Mitigación del Choque DB)
        res.json({
            exito: true,
            mensaje: 'Sincronización robusta completada con éxito',
            datos: {
                procesados: totalProcesados,
                resolucionIds: mapasId, // Enviar mapa de IDs para confirmación en frontend
                serverTimestamp: Date.now()
            }
        });

    } catch (error) {
        await t.rollback();
        console.error('Error Sync Adapter:', error);
        res.status(500).json({
            exito: false,
            mensaje: 'Error de validación al sincronizar UUID/Integer: ' + error.message,
            error: error.message
        });
    }
});

// Sincronizar modelos con la base de datos PostgreSQL y arrancar el servidor
// 'force: false' evita borrar datos existentes al reiniciar el servidor
db.sequelize.sync({ alter: true }).then(() => {
    server.listen(PORT, () => {
        console.log(`🚀 Servidor de Inventario PostgreSQL + Socket.io iniciado en el puerto ${PORT}`);
    });
}).catch(err => {
    console.error('❌ Error fatal al conectar con PostgreSQL:', err);
});

