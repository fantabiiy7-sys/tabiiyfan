import { run } from './db.js';
import type { Actor } from './auth.js';
export function audit(actor: Actor | null, action: string, entity?: string, entityId?: string | number, detail?: unknown, ip?: string) {
  run('INSERT INTO audit_logs(actor_id,actor_email,action,entity,entity_id,detail,ip) VALUES(?,?,?,?,?,?,?)',
    actor?.id ?? null, actor?.email ?? null, action, entity ?? null, entityId != null ? String(entityId) : null,
    detail !== undefined ? JSON.stringify(detail).slice(0, 4000) : null, ip ?? null);
}
