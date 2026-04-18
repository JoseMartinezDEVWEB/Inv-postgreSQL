module.exports = (sequelize, DataTypes) => {
    // Definición del modelo Producto
    const Producto = sequelize.define('Producto', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        nombre: {
            type: DataTypes.STRING,
            allowNull: false
        },
        descripcion: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        costo: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0.0
        },
        unidad: {
            type: DataTypes.STRING,
            defaultValue: 'unidad' // Ej: 'kg', 'lb', 'caja'
        },
        sku: {
            type: DataTypes.STRING,
            allowNull: true
        },
        categoria: {
            type: DataTypes.STRING,
            defaultValue: 'General'
        },
        clienteNegocioId: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        activo: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        }
    });

    return Producto;
};
