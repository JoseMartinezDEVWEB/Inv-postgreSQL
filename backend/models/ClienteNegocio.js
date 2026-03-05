module.exports = (sequelize, DataTypes) => {
    const ClienteNegocio = sequelize.define('ClienteNegocio', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        uuid: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            unique: true
        },
        nombre: {
            type: DataTypes.STRING,
            allowNull: false
        },
        telefono: {
            type: DataTypes.STRING,
            allowNull: true
        },
        direccion: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        contadorAsignadoId: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        business_id: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        configuracionInventario: {
            type: DataTypes.JSONB,
            defaultValue: { habilitado: true }
        },
        proximaVisita: {
            type: DataTypes.DATE,
            allowNull: true
        },
        notas: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        activo: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        estadisticas: {
            type: DataTypes.JSONB,
            defaultValue: {}
        },
        created_by: {
            type: DataTypes.INTEGER,
            allowNull: true
        }
    }, {
        tableName: 'clientes_negocios',
        timestamps: true
    });

    return ClienteNegocio;
};
