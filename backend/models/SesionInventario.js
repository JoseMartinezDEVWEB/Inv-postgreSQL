module.exports = (sequelize, DataTypes) => {
    const SesionInventario = sequelize.define('SesionInventario', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        clienteNegocioId: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        contadorId: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        numeroSesion: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        fecha: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        estado: {
            type: DataTypes.ENUM('iniciada', 'en_progreso', 'completada', 'cancelada'),
            defaultValue: 'iniciada'
        },
        configuracion: {
            type: DataTypes.JSONB,
            defaultValue: {}
        },
        datosFinancieros: {
            type: DataTypes.JSONB,
            defaultValue: {}
        },
        totales: {
            type: DataTypes.JSONB,
            defaultValue: {
                valorTotalInventario: 0,
                totalProductosContados: 0,
                totalActivos: 0,
                totalPasivos: 0,
                capitalContable: 0
            }
        },
        duracionMinutos: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        timerEnMarcha: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        timerAcumuladoSegundos: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        timerUltimoInicio: {
            type: DataTypes.DATE,
            allowNull: true
        },
        fechaProximoInventario: {
            type: DataTypes.DATE,
            allowNull: true
        }
    }, {
        tableName: 'sesiones_inventario',
        timestamps: true
    });

    return SesionInventario;
};
