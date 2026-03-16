const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../models');
const { authenticateToken } = require('./authRoutes');

const router = express.Router();
let io; // Referencia a Socket.io que se inyectará desde server.js

// Función para inyectar io
router.setIo = (socketIoInstance) => {
    io = socketIoInstance;
};

// --- ENDPOINTS DE INVITACIONES (Colaboradores) ---

router.get('/mis-invitaciones', authenticateToken, async (req, res) => {
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
        res.status(500).json({ mensaje: 'Error al obtener invitaciones: ' + error.message });
    }
});

router.get('/colaboradores', authenticateToken, async (req, res) => {
    try {
        const where = { rol: 'colaborador', activo: true };

        const colaboradores = await db.Usuario.findAll({
            where,
            attributes: ['id', 'nombre', 'email', 'rol', 'activo', 'createdAt']
        });
        res.json({ datos: colaboradores });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener colaboradores: ' + error.message });
    }
});

router.post('/qr', authenticateToken, async (req, res) => {
    try {
        const { rol = 'colaborador', nombre, email, expiraEnMinutos = 1440 } = req.body;

        // El puerto se debe obtener del env o req
        const PORT = process.env.PORT || 4000;

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
            serverIp: '10.0.0.41', // Idealmente sacar de var de entorno o request
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
        res.status(500).json({ mensaje: 'Error al generar QR: ' + error.message });
    }
});

router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const invitacion = await db.Invitacion.findByPk(id);

        if (!invitacion) return res.status(404).json({ mensaje: 'Invitación no encontrada' });

        const userRol = (req.user.rol || '').toLowerCase();
        if (userRol !== 'administrador' && invitacion.creadaPorId !== req.user.id) {
            return res.status(403).json({ mensaje: 'No tienes permisos para borrar esta invitación' });
        }

        await invitacion.update({ estado: 'cancelada' });
        res.json({ message: 'Invitación eliminada' });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al eliminar invitación: ' + error.message });
    }
});

// --- ENDPOINTS DE SOLICITUDES DE CONEXIÓN ---

router.post('/solicitar', async (req, res) => {
    try {
        const { invitacionId, codigo, codigoNumerico, nombreColaborador, dispositivoInfo } = req.body;

        if (!invitacionId && !codigoNumerico) {
            return res.status(400).json({ mensaje: 'Se requiere escanear un QR o un código numérico' });
        }

        let invitacion;
        let nombreSugerido;

        if (codigoNumerico && !invitacionId) {
            if (!nombreColaborador) {
                return res.status(400).json({ mensaje: 'Se requiere tu nombre para ingresar con código manual' });
            }
            invitacion = await db.Invitacion.findOne({
                where: { codigoNumerico: codigoNumerico, estado: 'pendiente' }
            });
            nombreSugerido = nombreColaborador;
        } else {
            invitacion = await db.Invitacion.findOne({
                where: { uuid: invitacionId, codigoNumerico: codigo, estado: 'pendiente' }
            });
            nombreSugerido = invitacion ? invitacion.nombre : null;
        }

        if (!invitacion) {
            return res.status(404).json({ mensaje: 'Invitación o código no válido o ya consumido' });
        }

        if (new Date() > new Date(invitacion.expiraEn)) {
            await invitacion.update({ estado: 'expirada' });
            return res.status(410).json({ mensaje: 'La invitación o el código ha expirado' });
        }

        const solicitud = await db.SolicitudConexion.create({
            invitacionId: invitacion.id,
            adminId: invitacion.creadaPorId,
            colaboradorId: null,
            estado: 'pendiente',
            estadoConexion: 'desconectado',
            metadata: {
                dispositivoInfo,
                rolSolicitado: invitacion.rol,
                nombreSugerido: nombreSugerido || 'Colaborador'
            }
        });

        if (io) io.emit('solicitudes-pendientes-actualizadas');

        res.status(201).json({
            exito: true,
            mensaje: 'Solicitud enviada. Espera a que el administrador la acepte.',
            datos: { solicitudId: solicitud.id }
        });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al enviar solicitud: ' + error.message });
    }
});

router.get('/pendientes', authenticateToken, async (req, res) => {
    try {
        const userRol = (req.user.rol || '').toLowerCase();
        const isAdmin = userRol === 'administrador';
        const isManager = userRol === 'contable' || userRol === 'contable';

        if (!isAdmin && !isManager) {
            return res.status(403).json({ mensaje: 'No tienes permisos para ver solicitudes' });
        }

        const where = { estado: 'pendiente' };
        if (!isAdmin) {
            where.adminId = req.user.id;
        }

        const solicitudes = await db.SolicitudConexion.findAll({
            where,
            include: [
                { model: db.Usuario, as: 'colaborador', attributes: ['id', 'nombre', 'email'] },
                { model: db.Invitacion, attributes: ['id', 'nombre', 'email'] }
            ],
            order: [['createdAt', 'DESC']]
        });

        const mapeadas = solicitudes.map(s => {
            const data = s.toJSON();
            data.nombreColaborador = data.colaborador?.nombre ||
                data.Invitacion?.nombre ||
                data.metadata?.nombreSugerido ||
                'Desconocido';
            return data;
        });

        res.json({ datos: mapeadas });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener solicitudes: ' + error.message });
    }
});

router.get('/conectados', authenticateToken, async (req, res) => {
    try {
        const userRol = (req.user.rol || '').toLowerCase();
        const isAdmin = userRol === 'administrador';
        const isManager = userRol === 'contable' || userRol === 'contable';

        if (!isAdmin && !isManager) {
            return res.status(403).json({ mensaje: 'No tienes permisos para ver conectados' });
        }

        const where = { estado: 'aceptada' };
        if (!isAdmin) {
            where.adminId = req.user.id;
        }

        const conectados = await db.SolicitudConexion.findAll({
            where,
            include: [
                { model: db.Usuario, as: 'colaborador', attributes: ['id', 'nombre', 'email'] },
                { model: db.Invitacion, attributes: ['id', 'nombre', 'email'] }
            ]
        });

        const mapeadas = conectados.map(c => {
            const data = c.toJSON();
            data.nombreColaborador = data.colaborador?.nombre ||
                data.Invitacion?.nombre ||
                data.metadata?.nombreSugerido ||
                'Desconocido';
            return data;
        });

        res.json({ datos: mapeadas });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener conectados: ' + error.message });
    }
});

router.post('/:id/aceptar', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { sesionInventarioId } = req.body;

        const solicitud = await db.SolicitudConexion.findByPk(id, {
            include: [{ model: db.Invitacion }]
        });

        if (!solicitud) return res.status(404).json({ mensaje: 'Solicitud no encontrada' });

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

        if (solicitud.Invitacion && solicitud.Invitacion.email) {
            let usuario = await db.Usuario.findOne({ where: { email: solicitud.Invitacion.email } });

            if (!usuario) {
                const passwordHash = await bcrypt.hash(solicitud.Invitacion.codigoNumerico, 12);
                usuario = await db.Usuario.create({
                    nombreUsuario: solicitud.Invitacion.email.split('@')[0] + '.' + Date.now(),
                    nombre: solicitud.Invitacion.nombre || 'Colaborador',
                    email: solicitud.Invitacion.email,
                    password: passwordHash,
                    rol: solicitud.Invitacion.rol || 'colaborador',
                    activo: true,
                    codigoAcceso: solicitud.Invitacion.codigoNumerico
                });
            }

            updateData.colaboradorId = usuario.id;

            await solicitud.Invitacion.update({
                estado: 'consumida',
                consumidaPorId: usuario.id
            });
        }

        await solicitud.update(updateData);

        if (io) {
            io.emit(`estado-solicitud-actualizado-${solicitud.id}`, {
                estado: updateData.estado,
                estadoConexion: updateData.estadoConexion
            });
            io.emit('solicitudes-pendientes-actualizadas');
        }

        res.json({
            message: 'Solicitud aceptada y usuario vinculado correctamente',
            datos: {
                solicitudId: solicitud.id,
                colaboradorId: updateData.colaboradorId
            }
        });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al aceptar solicitud: ' + error.message });
    }
});

router.post('/:id/rechazar', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const solicitud = await db.SolicitudConexion.findByPk(id);

        if (!solicitud) return res.status(404).json({ mensaje: 'Solicitud no encontrada' });

        if (req.user.rol !== 'administrador' && solicitud.adminId !== req.user.id) {
            return res.status(403).json({ mensaje: 'No tienes permiso sobre esta solicitud' });
        }

        await solicitud.update({ estado: 'rechazada', estadoConexion: 'desconectado' });

        if (io) {
            io.emit(`estado-solicitud-actualizado-${solicitud.id}`, {
                estado: 'rechazada',
                estadoConexion: 'desconectado'
            });
            io.emit('solicitudes-pendientes-actualizadas');
        }

        res.json({ message: 'Solicitud rechazada' });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al rechazar solicitud: ' + error.message });
    }
});

router.get('/estado/:solicitudId', async (req, res) => {
    try {
        const { solicitudId } = req.params;
        const solicitud = await db.SolicitudConexion.findByPk(solicitudId, {
            include: [{ model: db.Usuario, as: 'colaborador', attributes: ['nombre', 'email', 'rol'] }]
        });

        if (!solicitud) return res.status(404).json({ ok: false, mensaje: 'Solicitud no encontrada' });

        res.json({
            ok: true,
            estado: solicitud.estado,
            estadoConexion: solicitud.estadoConexion,
            sesionInventario: solicitud.sesionInventarioId,
            colaborador: solicitud.colaborador
        });
    } catch (error) {
        res.status(500).json({ ok: false, mensaje: error.message });
    }
});

router.post('/:id/ping', async (req, res) => {
    try {
        const solicitud = await db.SolicitudConexion.findByPk(req.params.id);
        if (!solicitud) return res.status(404).json({ mensaje: 'No vinculada' });

        await solicitud.update({ ultimoPing: new Date(), estadoConexion: 'conectado' });
        res.json({ ok: true, serverTime: new Date() });
    } catch (error) {
        res.status(500).json({ mensaje: error.message });
    }
});

router.post('/:id/conectar', async (req, res) => {
    try {
        const solicitud = await db.SolicitudConexion.findByPk(req.params.id);
        if (!solicitud) return res.status(404).json({ mensaje: 'No vinculada' });

        await solicitud.update({ estadoConexion: 'conectado', ultimoPing: new Date() });
        res.json({ ok: true, mensaje: 'Conectado al servidor' });
    } catch (error) {
        res.status(500).json({ mensaje: error.message });
    }
});

router.post('/:id/cerrar-sesion', async (req, res) => {
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

router.get('/:id/productos-offline', async (req, res) => {
    try {
        const solicitud = await db.SolicitudConexion.findByPk(req.params.id);
        if (!solicitud) return res.status(404).json({ mensaje: 'No encontrada' });

        const metadata = solicitud.metadata || {};
        const productosOffline = metadata.productosOffline || [];
        res.json({ ok: true, datos: productosOffline });
    } catch (error) {
        res.status(500).json({ mensaje: error.message });
    }
});

router.post('/:id/productos-offline', async (req, res) => {
    try {
        const solicitud = await db.SolicitudConexion.findByPk(req.params.id);
        if (!solicitud) return res.status(404).json({ mensaje: 'No encontrada' });

        const metadata = solicitud.metadata || {};
        const existentes = metadata.productosOffline || [];

        const nuevoProducto = {
            id: req.body.temporalId || req.body.id || Date.now().toString(),
            nombre: req.body.nombre,
            cantidad: req.body.cantidad,
            costo: req.body.costo,
            unidad: req.body.unidad,
            categoria: req.body.categoria,
            codigoBarras: req.body.codigoBarras,
            sincronizado: false,
            timestamp: new Date()
        };

        const nuevaLista = [...existentes, nuevoProducto];

        await solicitud.update({
            metadata: {
                ...metadata,
                productosOffline: nuevaLista
            }
        });

        res.json({ ok: true, datos: nuevoProducto });
    } catch (error) {
        res.status(500).json({ mensaje: error.message });
    }
});

router.post('/:id/sincronizar', authenticateToken, async (req, res) => {
    try {
        const { temporalIds } = req.body;
        if (!temporalIds || !Array.isArray(temporalIds)) {
            return res.status(400).json({ mensaje: 'Ids temporales requeridos' });
        }

        const solicitud = await db.SolicitudConexion.findByPk(req.params.id);
        if (!solicitud) return res.status(404).json({ mensaje: 'No encontrada' });

        if (req.user.rol !== 'administrador' && solicitud.adminId !== req.user.id) {
            return res.status(403).json({ mensaje: 'No tienes permiso sobre esta solicitud' });
        }

        const metadata = solicitud.metadata || {};
        const existentes = metadata.productosOffline || [];

        const actualizados = existentes.map(prod => {
            if (temporalIds.includes(prod.id)) {
                return { ...prod, sincronizado: true };
            }
            return prod;
        });

        await solicitud.update({
            metadata: {
                ...metadata,
                productosOffline: actualizados
            }
        });

        res.json({ ok: true, mensaje: 'Productos marcados como sincronizados' });
    } catch (error) {
        res.status(500).json({ mensaje: error.message });
    }
});

module.exports = router;
