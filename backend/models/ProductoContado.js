module.exports = (sequelize, DataTypes) => {
    const ProductoContado = sequelize.define('ProductoContado', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        sesionInventarioId: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        productoClienteId: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        nombreProducto: {
            type: DataTypes.STRING,
            allowNull: false
        },
        unidadProducto: {
            type: DataTypes.STRING,
            defaultValue: 'unidad'
        },
        costoProducto: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0.0
        },
        skuProducto: {
            type: DataTypes.STRING,
            allowNull: true
        },
        cantidadContada: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0.0
        },
        valorTotal: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0.0
        },
        notas: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        agregadoPorId: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        requiereAprobacion: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        aprobado: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        discrepancia: {
            type: DataTypes.JSONB,
            defaultValue: {}
        }
    }, {
        tableName: 'productos_contados',
        timestamps: true
    });

    return ProductoContado;
};
