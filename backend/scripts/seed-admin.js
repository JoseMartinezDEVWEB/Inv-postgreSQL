/**
 * Script para crear usuario administrador en PostgreSQL
 * Admin: admin@j4pro.com / Jose.1919
 * 
 * Uso: node scripts/seed-admin.js
 */

const bcrypt = require('bcryptjs');
const db = require('../models');

async function seedAdmin() {
    try {
        await db.sequelize.authenticate();
        console.log('✅ Conexión con PostgreSQL establecida.');

        await db.sequelize.sync({ force: false });

        const email = 'admin@j4pro.com';
        const password = 'Jose.1919';

        // Verificar si ya existe
        const existente = await db.Usuario.findOne({ where: { email } });
        if (existente) {
            console.log('⚠️  El usuario admin ya existe:', email);
            console.log('   Actualizando contraseña...');
            const hash = await bcrypt.hash(password, 12);
            await existente.update({
                password: hash,
                rol: 'administrador',
                activo: true
            });
            console.log('✅ Contraseña actualizada correctamente.');
            process.exit(0);
        }

        const hash = await bcrypt.hash(password, 12);

        const admin = await db.Usuario.create({
            nombre: 'Administrador J4 Pro',
            email,
            nombreUsuario: 'admin',
            password: hash,
            rol: 'administrador',
            activo: true
        });

        console.log('✅ Usuario administrador creado:');
        console.log('   Email:    ', email);
        console.log('   Password: ', password);
        console.log('   ID:       ', admin.id);
        process.exit(0);
    } catch (error) {
        console.error('❌ Error al crear usuario admin:', error.message);
        process.exit(1);
    }
}

seedAdmin();
