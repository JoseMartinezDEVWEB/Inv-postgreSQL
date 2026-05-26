const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const BACKUP_DIR = path.join(__dirname, '../../database/backups');

// Asegurar que el directorio de respaldos exista
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const getPgOptions = () => {
    return {
        env: {
            ...process.env,
            PGPASSWORD: String(process.env.DB_PASSWORD)
        }
    };
};

const getDbUrl = () => {
    const user = process.env.DB_USER;
    const host = process.env.DB_HOST;
    const port = process.env.DB_PORT || 5432;
    const dbName = process.env.DB_NAME;
    return `postgresql://${user}@${host}:${port}/${dbName}`;
};

// Crear un respaldo usando pg_dump
router.post('/crear', async (req, res) => {
    try {
        const { etiqueta } = req.body;
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `backup_pg_${etiqueta ? etiqueta + '_' : ''}${ts}.sql`;
        const backupFilePath = path.join(BACKUP_DIR, filename);
        // Ejecutar pg_dump para generar el respaldo
        const command = `pg_dump -F p -f "${backupFilePath}" ${getDbUrl()}`;
        await execPromise(command, getPgOptions());
        // Obtener tamaño del archivo creado
        const { size } = fs.statSync(backupFilePath);
        res.json({
            ok: true,
            backup: {
                nombre: filename,
                fecha: new Date().toISOString(),
                tamaño: size,
                tipo: 'pg_dump'
            }
        });
    } catch (error) {
        console.error('Error creando respaldo:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

router.get('/descargar/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        const filePath = path.join(BACKUP_DIR, filename);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ ok: false, error: 'Archivo no encontrado' });
        }
        res.download(filePath, filename);
    } catch (error) {
        console.error('Error descargando respaldo:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

router.delete('/eliminar/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        const filePath = path.join(BACKUP_DIR, filename);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ ok: false, error: 'Archivo no encontrado' });
        }
        fs.unlinkSync(filePath);
        res.json({ ok: true, mensaje: 'Respaldo eliminado' });
    } catch (error) {
        console.error('Error eliminando respaldo:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

router.get('/listar', async (req, res) => {
    try {
        const files = fs.readdirSync(BACKUP_DIR);
        const backups = files.map(f => {
            const stats = fs.statSync(path.join(BACKUP_DIR, f));
            return {
                nombre: f,
                fecha: stats.birthtime,
                tamaño: stats.size,
                tipo: path.extname(f).replace('.', '')
            };
        });
        res.json({ ok: true, backups, directorio: BACKUP_DIR });
    } catch (error) {
        console.error('Error listando respaldos:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});
router.post('/restaurar', async (req, res) => {
    try {
        const { filepath } = req.body;
        if (!filepath || !fs.existsSync(filepath)) {
            return res.status(404).json({ ok: false, error: 'Archivo de respaldo no encontrado' });
        }
        const command = `psql ${getDbUrl()} -f "${filepath}"`;
        await execPromise(command, getPgOptions());
        res.json({ ok: true, mensaje: 'Base de datos restaurada correctamente' });
    } catch (error) {
        console.error('Error restaurando respaldo:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

module.exports = router;
