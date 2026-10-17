// Zaxira: bazaning izchil nusxasi (VACUUM INTO) + yuklangan fayllar → backups/<vaqt>/
import fs from 'node:fs'; import path from 'node:path'; import { DatabaseSync } from 'node:sqlite';
const root = path.resolve(import.meta.dirname, '..'); const data = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(root, 'data');
const dbFile = process.env.DB_FILE ? path.resolve(process.env.DB_FILE) : path.join(data, 'app.db');
const out = path.join(process.env.BACKUP_DIR ? path.resolve(process.env.BACKUP_DIR) : path.join(root, 'backups'), new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(out, { recursive: true });
const db = new DatabaseSync(dbFile, { readOnly: true }); db.exec(`VACUUM INTO '${path.join(out, 'app.db').replace(/'/g, "''")}'`); db.close();
const up = path.join(data, 'uploads'); if (fs.existsSync(up)) fs.cpSync(up, path.join(out, 'uploads'), { recursive: true });
console.log('Zaxira tayyor:', out, '\nTiklash: serverni to‘xtating, app.db va uploads/ ni DATA_DIR ga qaytarib qo‘ying.');
