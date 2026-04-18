module.exports = (sequelize, DataTypes) => {
    const AuditoriaMovimiento = sequelize.define('AuditoriaMovimiento', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        usuarioId: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        productoGeneralId: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        tipoMovimiento: {
            type: DataTypes.STRING,
            allowNull: false
        },
        detalles: {
            type: DataTypes.JSONB,
            allowNull: true,
            defaultValue: {}
        },
        fecha: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        notas: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    }, {
        tableName: 'auditoria_movimientos',
        timestamps: false
    });

    return AuditoriaMovimiento;
};
