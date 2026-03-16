const db = require('../models');
const { sequelize } = db;

async function fix() {
  try {
    await sequelize.query('ALTER TABLE "Usuarios" ALTER COLUMN rol DROP DEFAULT');
    console.log('OK: DEFAULT eliminado');
    
    await sequelize.query('ALTER TYPE "enum_Usuarios_rol" RENAME TO "enum_Usuarios_rol_old"');
    console.log('OK: Tipo renombrado');
    
    await sequelize.query("CREATE TYPE \"enum_Usuarios_rol\" AS ENUM ('administrador', 'contable', 'colaborador')");
    console.log('OK: Nuevo tipo creado');
    
    await sequelize.query('ALTER TABLE "Usuarios" ALTER COLUMN rol TYPE "enum_Usuarios_rol" USING rol::text::"enum_Usuarios_rol"');
    console.log('OK: Columna actualizada');
    
    await sequelize.query("ALTER TABLE \"Usuarios\" ALTER COLUMN rol SET DEFAULT 'colaborador'");
    console.log('OK: DEFAULT restaurado');
    
    await sequelize.query('DROP TYPE "enum_Usuarios_rol_old"');
    console.log('OK: Tipo viejo eliminado');
    
    console.log('DONE: enum_Usuarios_rol limpiado');
    process.exit(0);
  } catch(e) {
    console.error('ERROR:', e.message);
    process.exit(1);
  }
}

fix();
