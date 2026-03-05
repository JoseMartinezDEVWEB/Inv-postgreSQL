module.exports = (sequelize, DataTypes) => {
    const SolicitudConexion = sequelize.define('SolicitudConexion', {
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
        colaboradorId: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        adminId: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        invitacionId: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        sesionInventarioId: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        estado: {
            type: DataTypes.ENUM('pendiente', 'aceptada', 'rechazada', 'finalizada'),
            defaultValue: 'pendiente'
        },
        estadoConexion: {
            type: DataTypes.ENUM('conectado', 'desconectado'),
            defaultValue: 'desconectado'
        },
        ultimoPing: {
            type: DataTypes.DATE,
            allowNull: true
        },
        dispositivoId: {
            type: DataTypes.STRING,
            allowNull: true
        },
        metadata: {
            type: DataTypes.JSONB,
            defaultValue: {}
        }
    });

    return SolicitudConexion;
};
