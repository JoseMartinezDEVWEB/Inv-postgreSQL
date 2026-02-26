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
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
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

// Define associations
db.Usuario.hasMany(db.Inventario, { foreignKey: 'usuarioId' });
db.Inventario.belongsTo(db.Usuario, { foreignKey: 'usuarioId' });

db.Producto.hasMany(db.Inventario, { foreignKey: 'productoId' });
db.Inventario.belongsTo(db.Producto, { foreignKey: 'productoId' });

module.exports = db;
