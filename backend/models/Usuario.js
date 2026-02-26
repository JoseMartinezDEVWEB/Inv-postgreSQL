module.exports = (sequelize, DataTypes) => {
    // Definición del modelo Usuario
    const Usuario = sequelize.define('Usuario', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        nombreUsuario: {
            type: DataTypes.STRING,
            unique: true,
            allowNull: false
        },
        nombre: {
            type: DataTypes.STRING,
            allowNull: false
        },
        email: {
            type: DataTypes.STRING,
            unique: true,
            allowNull: false,
            validate: {
                isEmail: true // Validación de formato de correo
            }
        },
        password: {
            type: DataTypes.STRING,
            allowNull: false
        },
        rol: {
            type: DataTypes.ENUM('administrador', 'contador', 'colaborador'),
            defaultValue: 'colaborador' // Rol por defecto
        },
        activo: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        codigoAcceso: {
            type: DataTypes.STRING,
            allowNull: true // Código para acceso rápido/offline del colaborador
        }
    });

    return Usuario;
};
