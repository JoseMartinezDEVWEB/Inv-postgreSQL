const { Client } = require('pg');
require('dotenv').config();

/**
 * Asegura que la base de datos configurada exista en el servidor PostgreSQL.
 * Si no existe, la crea automáticamente.
 */
async function ensureDatabaseExists() {
    const dbName = process.env.DB_NAME || 'inventario_db';
    const config = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'admin123',
        database: 'postgres' // Conectamos a la base por defecto
    };

    const client = new Client(config);

    try {
        await client.connect();
        
        // Verificar si la base de datos existe
        const res = await client.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]);
        
        if (res.rowCount === 0) {
            console.log(`📡 Base de datos "${dbName}" no encontrada. Creándola...`);
            // CREATE DATABASE no permite parámetros, hay que usar string literal (seguro aquí porque viene de env)
            await client.query(`CREATE DATABASE "${dbName}"`);
            console.log(`✅ Base de datos "${dbName}" creada con éxito.`);
        } else {
            console.log(`✅ Base de datos "${dbName}" detectada.`);
        }
    } catch (error) {
        if (error.code === '28P01') {
            console.error('❌ Error de autenticación en PostgreSQL. Verifica el usuario/contraseña en .env');
        } else if (error.code === 'ECONNREFUSED') {
            console.error('❌ No se pudo conectar a PostgreSQL. ¿Está el servicio iniciado?');
        } else {
            console.error('⚠️ Error al asegurar existencia de base de datos:', error.message);
        }
        // No lanzamos el error para permitir que Sequelize intente conectar de todas formas
        // (esto da mejor feedback de error después)
    } finally {
        await client.end();
    }
}

module.exports = { ensureDatabaseExists };
