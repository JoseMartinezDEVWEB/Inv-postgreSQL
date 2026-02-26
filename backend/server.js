const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./models');
require('dotenv').config();

const app = express();

// Configuración de Middlewares
app.use(cors()); // Permitir peticiones desde otros dominios (frontend)
app.use(express.json()); // Permitir el procesamiento de JSON en el cuerpo de las peticiones

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Middleware para autenticar el token JWT
 * Verifica que el cliente envíe un token válido en la cabecera Authorization
 */
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Token no proporcionado' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token inválido o expirado' });
        req.user = user;
        next();
    });
};

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

        if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

        // Verificar la contraseña
        const validPassword = await bcrypt.compare(password, usuario.password);
        if (!validPassword) return res.status(401).json({ error: 'Contraseña incorrecta' });

        // Generar Token JWT válido por 24 horas
        const token = jwt.sign(
            { id: usuario.id, rol: usuario.rol, nombre: usuario.nombre },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            usuario: {
                id: usuario.id,
                nombre: usuario.nombre,
                rol: usuario.rol,
                email: usuario.email
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Error en el inicio de sesión: ' + error.message });
    }
});

// --- ENDPOINTS DE PRODUCTOS ---

/**
 * Obtener todos los productos activos
 */
app.get('/api/productos', authenticateToken, async (req, res) => {
    try {
        const productos = await db.Producto.findAll({ where: { activo: true } });
        res.json(productos);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener productos: ' + error.message });
    }
});

// --- ENDPOINT DE SINCRONIZACIÓN (MÓVIL) ---

/**
 * Endpoint para recibir datos desde la app móvil
 * Permite guardar registros de inventario capturados offline
 */
app.post('/api/sincronizar', authenticateToken, async (req, res) => {
    const { registros } = req.body; // Array de registros provenientes del dispositivo móvil

    if (!Array.isArray(registros)) {
        return res.status(400).json({ error: 'El formato de los registros es inválido (debe ser un array)' });
    }

    // Usamos una transacción para asegurar que se guarden todos o ninguno
    const t = await db.sequelize.transaction();

    try {
        const resultados = [];
        for (const reg of registros) {
            // Guardar cada registro de inventario enviado por el colaborador
            const nuevoRegistro = await db.Inventario.create({
                cantidad: reg.cantidad,
                tipoMovimiento: reg.tipoMovimiento || 'conteo',
                productoId: reg.productoId,
                usuarioId: req.user.id, // ID extraído del token JWT
                fecha: reg.fecha || new Date(),
                notas: reg.notas || 'Sincronizado desde móvil',
                dispositivoId: reg.dispositivoId
            }, { transaction: t });

            resultados.push(nuevoRegistro);
        }

        // Confirmar cambios en la base de datos
        await t.commit();
        res.json({
            mensaje: 'Sincronización completada con éxito',
            totalProcesados: resultados.length
        });
    } catch (error) {
        // Si algo falla, revertimos los cambios para mantener la integridad
        await t.rollback();
        res.status(500).json({ error: 'Error en la sincronización: ' + error.message });
    }
});

// Sincronizar modelos con la base de datos PostgreSQL y arrancar el servidor
// 'force: false' evita borrar datos existentes al reiniciar el servidor
db.sequelize.sync({ force: false }).then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Servidor de Inventario PostgreSQL iniciado en el puerto ${PORT}`);
    });
}).catch(err => {
    console.error('❌ Error fatal al conectar con PostgreSQL:', err);
});
