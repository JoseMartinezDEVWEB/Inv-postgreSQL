const { Sequelize } = require('sequelize');
require('dotenv').config({ path: 'c:/Users/ASUS/Desktop/Inv-postgreSQL/backend/.env' });

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: 'postgres',
        logging: console.log
    }
);

async function convertToString() {
    try {
        await sequelize.authenticate();
        console.log('Connected to DB');
        
        // Change column type from ENUM to STRING
        // This requires casting in Postgres if the ENUM was strict
        await sequelize.query('ALTER TABLE auditoria_movimientos ALTER COLUMN "tipoMovimiento" TYPE VARCHAR(255)');
        console.log('Column type changed to VARCHAR(255)');
        
    } catch (error) {
        console.error('Error changing column type:', error);
    } finally {
        await sequelize.close();
    }
}

convertToString();
