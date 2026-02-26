module.exports = (sequelize, DataTypes) => {
    // Definición del modelo Inventario (Movimientos y conteos)
    const Inventario = sequelize.define('Inventario', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        cantidad: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        tipoMovimiento: {
            type: DataTypes.ENUM('entrada', 'salida', 'conteo'),
            defaultValue: 'conteo'
        },
        fecha: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        notas: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        dispositivoId: {
            type: DataTypes.STRING, // Identificador de la tablet/celular que capturó el dato
            allowNull: true
        }
    }, {
        tableName: 'inventarios' // Nombre de la tabla en plural
    });

    return Inventario;
};
