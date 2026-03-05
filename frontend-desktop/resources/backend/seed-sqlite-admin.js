import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'database', 'inventario.db');

console.log('Connecting to SQLite:', dbPath);
const db = new Database(dbPath);

const email = 'admin@j4pro.com';
const password = 'Jose.1919';

try {
    // Check if table exists
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='usuarios'").get();
    if (!tableExists) {
        console.error('Table "usuarios" does not exist. Run the backend once to create it.');
        process.exit(1);
    }

    // Check if admin exists
    const existing = db.prepare("SELECT id FROM usuarios WHERE email = ?").get(email);

    if (existing) {
        console.log('Admin already exists in SQLite. Updating password...');
        const hash = bcrypt.hashSync(password, 10);
        db.prepare("UPDATE usuarios SET password = ?, activo = 1, rol = 'administrador' WHERE id = ?").run(hash, existing.id);
        console.log('Admin password updated.');
    } else {
        console.log('Creating admin in SQLite...');
        const hash = bcrypt.hashSync(password, 10);
        db.prepare("INSERT INTO usuarios (nombreUsuario, nombre, email, password, rol, activo) VALUES (?, ?, ?, ?, ?, ?)")
            .run('admin', 'Administrador J4 Pro', email, hash, 'administrador', 1);
        console.log('Admin created successfully.');
    }
} catch (error) {
    console.error('Error seeding SQLite admin:', error.message);
} finally {
    db.close();
}
