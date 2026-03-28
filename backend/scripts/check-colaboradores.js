const { Usuario, SolicitudConexion } = require('../models');

async function check() {
    try {
        const colaboradores = await Usuario.findAll({ where: { rol: 'colaborador' } });
        console.log('--- COLABORADORES ---');
        colaboradores.forEach(c => console.log(`ID: ${c.id}, Nombre: ${c.nombre}, Email: ${c.email}, Activo: ${c.activo}`));

        const solicitudes = await SolicitudConexion.findAll({ where: { estado: 'aceptada' } });
        console.log('\n--- SOLICITUDES ACEPTADAS ---');
        solicitudes.forEach(s => console.log(`ID: ${s.id}, ColaboradorID: ${s.colaboradorId}, EstadoConexion: ${s.estadoConexion}, UltimoPing: ${s.ultimoPing}`));
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
