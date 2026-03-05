module.exports = (sequelize, DataTypes) => {
    const ProductoGeneral = sequelize.define('ProductoGeneral', {
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
        categoria: {
            type: DataTypes.STRING,
            defaultValue: 'General'
        },
        unidad: {
            type: DataTypes.STRING,
            defaultValue: 'unidad'
        },
        costoBase: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0.0
        },
        tipoContenedor: {
            type: DataTypes.STRING,
            defaultValue: 'ninguno'
        },
        tieneUnidadesInternas: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        unidadesInternas: {
            type: DataTypes.JSONB,
            defaultValue: {}
        },
        tipoPeso: {
            type: DataTypes.STRING,
            defaultValue: 'ninguno'
        },
        esProductoSecundario: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        productoPadreId: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        productoHijoId: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        proveedor: {
            type: DataTypes.STRING,
            allowNull: true
        },
        codigoBarras: {
            type: DataTypes.STRING,
            allowNull: true
        },
        notas: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        creadoPorId: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        tipoCreacion: {
            type: DataTypes.STRING,
            defaultValue: 'usuario'
        },
        activo: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        estadisticas: {
            type: DataTypes.JSONB,
            defaultValue: {}
        }
    }, {
        tableName: 'productos_generales',
        timestamps: true
    });

    return ProductoGeneral;
};
