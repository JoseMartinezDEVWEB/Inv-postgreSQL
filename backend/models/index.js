const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: 'postgres',
        logging: false,
        pool: {
            max: 20,          // Aumentado de 5 a 20 para soportar alta concurrencia
            min: 2,           // Mantener mínimo 2 conexiones calientes
            acquire: 60000,   // Tiempo max para obtener una conexión del pool
            idle: 15000,      // Tiempo antes de liberar una conexión inactiva
            evict: 5000       // Intervalo para remover conexiones muertas
        },
        retry: {
            max: 3            // Reintentar hasta 3 veces en caso de error de conexión
        }
    }
);

const db = {};
db.Sequelize = Sequelize;
db.sequelize = sequelize;

// Import models
db.Usuario = require('./Usuario')(sequelize, Sequelize);
db.Producto = require('./Producto')(sequelize, Sequelize);
db.Inventario = require('./Inventario')(sequelize, Sequelize);
db.ProductoGeneral = require('./ProductoGeneral')(sequelize, Sequelize);
db.ClienteNegocio = require('./ClienteNegocio')(sequelize, Sequelize);
db.SesionInventario = require('./SesionInventario')(sequelize, Sequelize);
db.ProductoContado = require('./ProductoContado')(sequelize, Sequelize);
db.Invitacion = require('./Invitacion')(sequelize, Sequelize);
db.SolicitudConexion = require('./SolicitudConexion')(sequelize, Sequelize);
db.AuditoriaMovimiento = require('./AuditoriaMovimiento')(sequelize, Sequelize);

// Define associations

// Usuarios
db.Usuario.hasMany(db.Inventario, { foreignKey: 'usuarioId' });
db.Inventario.belongsTo(db.Usuario, { foreignKey: 'usuarioId' });

db.Usuario.hasMany(db.ClienteNegocio, { foreignKey: 'contadorAsignadoId' });
db.ClienteNegocio.belongsTo(db.Usuario, { foreignKey: 'contadorAsignadoId' });

db.Usuario.hasMany(db.SesionInventario, { foreignKey: 'contadorId' });
db.SesionInventario.belongsTo(db.Usuario, { foreignKey: 'contadorId' });

// Clientes y Sesiones
db.ClienteNegocio.hasMany(db.SesionInventario, { foreignKey: 'clienteNegocioId' });
db.SesionInventario.belongsTo(db.ClienteNegocio, { foreignKey: 'clienteNegocioId' });

db.ClienteNegocio.hasMany(db.Producto, { foreignKey: 'clienteNegocioId' });
db.Producto.belongsTo(db.ClienteNegocio, { foreignKey: 'clienteNegocioId' });

// Sesiones y Productos Contados
db.SesionInventario.hasMany(db.ProductoContado, { foreignKey: 'sesionInventarioId', as: 'productosContados' });
db.ProductoContado.belongsTo(db.SesionInventario, { foreignKey: 'sesionInventarioId', as: 'sesion' });

db.Producto.hasMany(db.Inventario, { foreignKey: 'productoId' });
db.Inventario.belongsTo(db.Producto, { foreignKey: 'productoId' });

// Invitaciones
db.Usuario.hasMany(db.Invitacion, { foreignKey: 'creadaPorId', as: 'invitacionesCreadas' });
db.Invitacion.belongsTo(db.Usuario, { foreignKey: 'creadaPorId', as: 'creador' });
db.Usuario.hasOne(db.Invitacion, { foreignKey: 'consumidaPorId', as: 'invitacionConsumida' });
db.Invitacion.belongsTo(db.Usuario, { foreignKey: 'consumidaPorId', as: 'consumidor' });

// Solicitudes de Conexión
db.Usuario.hasMany(db.SolicitudConexion, { foreignKey: { name: 'colaboradorId', allowNull: true }, as: 'solicitudesEnviadas' });
db.SolicitudConexion.belongsTo(db.Usuario, { foreignKey: { name: 'colaboradorId', allowNull: true }, as: 'colaborador' });
db.Usuario.hasMany(db.SolicitudConexion, { foreignKey: 'adminId', as: 'solicitudesRecibidas' });
db.SolicitudConexion.belongsTo(db.Usuario, { foreignKey: 'adminId', as: 'admin' });
db.SesionInventario.hasMany(db.SolicitudConexion, { foreignKey: 'sesionInventarioId' });
db.SolicitudConexion.belongsTo(db.SesionInventario, { foreignKey: 'sesionInventarioId' });

db.Invitacion.hasMany(db.SolicitudConexion, { foreignKey: 'invitacionId' });
db.SolicitudConexion.belongsTo(db.Invitacion, { foreignKey: 'invitacionId' });

// Auditoría
db.Usuario.hasMany(db.AuditoriaMovimiento, { foreignKey: 'usuarioId' });
db.AuditoriaMovimiento.belongsTo(db.Usuario, { foreignKey: 'usuarioId' });

db.ProductoGeneral.hasMany(db.AuditoriaMovimiento, { foreignKey: 'productoGeneralId' });
db.AuditoriaMovimiento.belongsTo(db.ProductoGeneral, { foreignKey: 'productoGeneralId' });

module.exports = db;
