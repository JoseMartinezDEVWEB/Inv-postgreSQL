const db = require('./models');

async function checkUsers() {
    try {
        const users = await db.Usuario.findAll();
        console.log('--- USUARIOS EN DB ---');
        users.forEach(u => {
            console.log(`ID: ${u.id}, User: ${u.nombreUsuario}, Rol: '${u.rol}', Activo: ${u.activo}`);
        });
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkUsers();
