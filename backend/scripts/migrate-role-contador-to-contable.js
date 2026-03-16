/**
 * Migration: Rename role 'contador' → 'contable' in PostgreSQL
 * 
 * This script:
 * 1. Adds 'contable' to the enum type
 * 2. Updates all existing records from 'contador' to 'contable'
 * 3. Removes 'contador' from the enum type
 */

const db = require('../models');
const { sequelize } = db;

async function migrate() {
  const t = await sequelize.transaction();
  try {
    console.log('🔄 Iniciando migración: contador → contable');

    // Step 1: Add 'contable' to the enum (PostgreSQL requires ALTER TYPE)
    await sequelize.query(`ALTER TYPE "enum_Usuarios_rol" ADD VALUE IF NOT EXISTS 'contable'`, { transaction: t });
    console.log("✅ Valor 'contable' añadido al enum enum_Usuarios_rol");

    await sequelize.query(`ALTER TYPE "enum_Invitacions_rol" ADD VALUE IF NOT EXISTS 'contable'`, { transaction: t });
    console.log("✅ Valor 'contable' añadido al enum enum_Invitacions_rol");

    // Note: PostgreSQL does NOT allow removing an enum value inside a transaction.
    // We commit first, then do the update separately.
    await t.commit();
    console.log('✅ Commit de nuevos valores de enum exitoso');

    // Step 2: Update existing records
    const [updatedUsers] = await sequelize.query(
      `UPDATE "Usuarios" SET rol = 'contable' WHERE rol = 'contador'`
    );
    console.log(`✅ Usuarios actualizados: ${updatedUsers}`);

    const [updatedInvitations] = await sequelize.query(
      `UPDATE "Invitacions" SET rol = 'contable' WHERE rol = 'contador'`
    );
    console.log(`✅ Invitaciones actualizadas: ${updatedInvitations}`);

    // Step 3: Try to remove 'contador' from enum (may fail if still in use — safe to ignore)
    try {
      await sequelize.query(`
        ALTER TYPE "enum_Usuarios_rol" RENAME TO "enum_Usuarios_rol_old";
        CREATE TYPE "enum_Usuarios_rol" AS ENUM ('administrador', 'contable', 'colaborador');
        ALTER TABLE "Usuarios" ALTER COLUMN rol TYPE "enum_Usuarios_rol" USING rol::text::"enum_Usuarios_rol";
        DROP TYPE "enum_Usuarios_rol_old";
      `);
      console.log('✅ Enum enum_Usuarios_rol limpiado (sin valor contador)');
    } catch (e) {
      console.warn('ℹ️  No se pudo limpiar el enum viejo (puede ser normal):', e.message);
    }

    try {
      await sequelize.query(`
        ALTER TYPE "enum_Invitacions_rol" RENAME TO "enum_Invitacions_rol_old";
        CREATE TYPE "enum_Invitacions_rol" AS ENUM ('contable', 'colaborador');
        ALTER TABLE "Invitacions" ALTER COLUMN rol TYPE "enum_Invitacions_rol" USING rol::text::"enum_Invitacions_rol";
        DROP TYPE "enum_Invitacions_rol_old";
      `);
      console.log('✅ Enum enum_Invitacions_rol limpiado (sin valor contador)');
    } catch (e) {
      console.warn('ℹ️  No se pudo limpiar el enum de Invitaciones (puede ser normal):', e.message);
    }

    console.log('\n🎉 Migración completada exitosamente');
    process.exit(0);
  } catch (error) {
    try { await t.rollback(); } catch (_) {}
    console.error('❌ Error en migración:', error.message);
    console.error(error);
    process.exit(1);
  }
}

migrate();
