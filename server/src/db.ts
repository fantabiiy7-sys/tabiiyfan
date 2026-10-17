import { DatabaseSync } from 'node:sqlite';
import { SCHEMA } from './schema.js';
import { ROLES, PERMISSIONS, ROLE_PERMISSIONS } from './permissions.js';
import path from 'node:path';
import fs from 'node:fs';

export const DATA_DIR = process.env.DATA_DIR ?? path.resolve(process.cwd(), 'data');
fs.mkdirSync(path.join(DATA_DIR, 'uploads'), { recursive: true });

export const db = new DatabaseSync(process.env.DB_FILE ?? path.join(DATA_DIR, 'app.db'));
db.exec('PRAGMA journal_mode = WAL;');
db.exec(SCHEMA);

export type Row = Record<string, any>;
export const all = (sql: string, ...p: any[]): Row[] => db.prepare(sql).all(...p) as Row[];
export const get = (sql: string, ...p: any[]): Row | undefined => db.prepare(sql).get(...p) as Row | undefined;
export const run = (sql: string, ...p: any[]) => db.prepare(sql).run(...p);
export function tx<T>(fn: () => T): T {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
}

export function syncRolesAndPermissions() {
  tx(() => {
    for (const r of ROLES) run('INSERT INTO roles(key,name,level) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET name=excluded.name, level=excluded.level', r.key, r.name, r.level);
    for (const p of PERMISSIONS) run('INSERT OR IGNORE INTO permissions(key) VALUES(?)', p);
    run('DELETE FROM role_permissions');
    for (const [role, perms] of Object.entries(ROLE_PERMISSIONS))
      for (const p of perms)
        run('INSERT INTO role_permissions(role_id,permission_id) SELECT r.id,p.id FROM roles r, permissions p WHERE r.key=? AND p.key=?', role, p);
  });
}
syncRolesAndPermissions();
