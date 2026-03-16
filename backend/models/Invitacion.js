module.exports = (sequelize, DataTypes) => {
    const Invitacion = sequelize.define('Invitacion', {
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
        rol: {
            type: DataTypes.ENUM('contable', 'colaborador'),
            allowNull: false
        },
        codigo: {
            type: DataTypes.STRING,
            unique: true,
            allowNull: false
        },
        codigoNumerico: {
            type: DataTypes.STRING(6),
            allowNull: true
        },
        nombre: {
            type: DataTypes.STRING,
            allowNull: true
        },
        email: {
            type: DataTypes.STRING,
            allowNull: true
        },
        estado: {
            type: DataTypes.ENUM('pendiente', 'consumida', 'expirada', 'cancelada'),
            defaultValue: 'pendiente'
        },
        expiraEn: {
            type: DataTypes.DATE,
            allowNull: false
        },
        creadaPorId: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        consumidaPorId: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        metadata: {
            type: DataTypes.JSONB,
            defaultValue: {}
        }
    });

    return Invitacion;
};
