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

async function fixEnum() {
    try {
        await sequelize.authenticate();
        console.log('Connected to DB');
        
        // This is the raw query to add the ENUM value
        // Note: IF NOT EXISTS is not supported for ADD VALUE in some PG versions, 
        // but we'll try or use a safer approach.
        try {
            await sequelize.query('ALTER TYPE "enum_auditoria_movimientos_tipoMovimiento" ADD VALUE \'SINCRONIZACION_MOVIL\'');
            console.log('ENUM value added successfully');
        } catch (e) {
            if (e.message.includes('already exists')) {
                console.log('ENUM value already exists');
            } else {
                throw e;
            }
        }
        
    } catch (error) {
        console.error('Error fixing ENUM:', error);
    } finally {
        await sequelize.close();
    }
}

fixEnum();
