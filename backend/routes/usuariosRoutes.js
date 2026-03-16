const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../models');
const { authenticateToken } = require('./authRoutes');

const router = express.Router();

// Obtener subordinados (colaboradores) del contable actual
router.get('/subordinados', authenticateToken, async (req, res) => {
    try {
        const userRol = (req.user.rol || '').toLowerCase();
        if (userRol !== 'contable' && userRol !== 'contable' && userRol !== 'administrador') {
            return res.status(403).json({ mensaje: 'No tienes permisos para ver subordinados' });
        }

        let whereCondition = { activo: true };

        if (userRol === 'administrador') {
            whereCondition.rol = ['contable', 'colaborador'];
        } else {
            whereCondition.rol = 'colaborador';
        }

        const usuarios = await db.Usuario.findAll({
            where: whereCondition,
            attributes: ['id', 'nombreUsuario', 'nombre', 'email', 'rol', 'activo', 'createdAt']
        });
        res.json({ datos: usuarios });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener subordinados: ' + error.message });
    }
});

router.get('/', authenticateToken, async (req, res) => {
    try {
        const userRol = (req.user.rol || '').toLowerCase();
        if (userRol !== 'administrador') {
            return res.status(403).json({ mensaje: 'Solo administradores pueden ver usuarios' });
        }
        const usuarios = await db.Usuario.findAll({
            where: { activo: true },
            attributes: ['id', 'nombreUsuario', 'nombre', 'email', 'rol', 'activo', 'createdAt']
        });
        res.json(usuarios);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener usuarios: ' + error.message });
    }
});

router.post('/', authenticateToken, async (req, res) => {
    try {
        const rolCreador = (req.user.rol || '').toLowerCase();
        let { nombreUsuario, nombre, email, password, rol } = req.body;

        if (!nombre || !email || !password || !rol) {
            return res.status(400).json({ mensaje: 'Todos los campos son requeridos' });
        }

        if (!nombreUsuario) {
            nombreUsuario = nombre.replace(/\s+/g, '.').toLowerCase() + '.' + Date.now();
        }

        const targetRol = (rol || '').toLowerCase();

        if (rolCreador === 'colaborador') {
            return res.status(403).json({ mensaje: 'No tienes permisos para crear usuarios' });
        }

        if (rolCreador === 'contable' && targetRol !== 'colaborador') {
            return res.status(403).json({ mensaje: 'Solo puedes crear usuarios colaboradores' });
        }

        if (rolCreador === 'administrador' && targetRol === 'administrador') {
            return res.status(403).json({ mensaje: 'No puedes crear usuarios con rol administrador' });
        }

        if ((targetRol === 'contable' || targetRol === 'administrador') && rolCreador !== 'administrador') {
            return res.status(403).json({ mensaje: 'No tienes permisos para crear este tipo de usuario' });
        }

        const existe = await db.Usuario.findOne({ where: { email } });
        if (existe) {
            return res.status(400).json({ mensaje: 'El email ya está registrado' });
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
        res.status(500).json({ mensaje: 'Error al crear usuario: ' + error.message });
    }
});

router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const userRol = (req.user.rol || '').toLowerCase();
        if (userRol !== 'administrador') {
            return res.status(403).json({ mensaje: 'Solo administradores pueden editar usuarios' });
        }
        const { id } = req.params;
        const { nombreUsuario, nombre, email, rol, password } = req.body;

        const usuario = await db.Usuario.findByPk(id);
        if (!usuario) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado' });
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
        res.status(500).json({ mensaje: 'Error al actualizar usuario: ' + error.message });
    }
});

router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const userRol = (req.user.rol || '').toLowerCase();
        if (userRol !== 'administrador') {
            return res.status(403).json({ mensaje: 'Solo administradores pueden eliminar usuarios' });
        }
        const { id } = req.params;

        const usuario = await db.Usuario.findByPk(id);
        if (!usuario) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        }

        await usuario.update({ activo: false });

        res.json({ message: 'Usuario eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al eliminar usuario: ' + error.message });
    }
});

module.exports = router;
