const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../models');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

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
            return res.status(401).json({ mensaje: 'Token inválido o expirado', error: 'Token inválido o expirado' });
        }
        req.user = user;
        next(); // ← Bug crítico corregido: faltaba llamar a next() aquí
    });
}

/**
 * Middleware para autorizar por roles especificos
 */
function authorizeRole(roles = []) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ mensaje: 'No autenticado' });
        }
        
        const userRol = (req.user.rol || '').toLowerCase();
        const allowedRoles = Array.isArray(roles) ? roles.map(r => r.toLowerCase()) : [roles.toLowerCase()];

        if (!allowedRoles.includes(userRol) && userRol !== 'administrador') {
            return res.status(403).json({ 
                mensaje: `Permiso denegado. Se requiere uno de los siguientes roles: ${allowedRoles.join(', ')}` 
            });
        }
        next();
    };
}

/**
 * Endpoint de Login
 */
router.post('/login', async (req, res) => {
    const { credencial, password } = req.body;
    try {
        const usuario = await db.Usuario.findOne({
            where: {
                [db.Sequelize.Op.or]: [{ email: credencial }, { nombreUsuario: credencial }],
                activo: true
            }
        });

        if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado' });

        const validPassword = await bcrypt.compare(password, usuario.password);
        if (!validPassword) return res.status(401).json({ mensaje: 'Contraseña incorrecta' });

        const accessToken = jwt.sign(
            { id: usuario.id, rol: usuario.rol, nombre: usuario.nombre },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        const refreshToken = jwt.sign(
            { id: usuario.id, type: 'refresh' },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            accessToken,
            refreshToken,
            token: accessToken,
            usuario: {
                id: usuario.id,
                nombre: usuario.nombre,
                rol: usuario.rol,
                email: usuario.email
            }
        });
    } catch (error) {
        console.error('❌ Error en login:', error.message);
        res.status(500).json({ mensaje: 'Error en el inicio de sesión: ' + error.message });
    }
});

// Endpoint de diagnóstico del perfil actual
router.get('/mi-perfil', authenticateToken, (req, res) => {
    res.json({
        mensaje: 'Perfil recuperado con éxito',
        usuario: req.user
    });
});

module.exports = {
    authRoutes: router,
    authenticateToken,
    authorizeRole
};
