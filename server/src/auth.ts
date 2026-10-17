import crypto from 'node:crypto';
import { all, get, run } from './db.js';
import { can, type Permission, type RoleKey } from './permissions.js';

const SESSION_HOURS = 12;
const MAX_FAILED = 5;
const LOCK_MIN = 15;

export interface Actor { id: number; email: string; fullName: string; role: RoleKey; csrf: string; sessionId: string }

export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('hex')}$${h.toString('hex')}`;
}
export function verifyPassword(pw: string, stored: string): boolean {
  const [alg, saltHex, hashHex] = stored.split('$');
  if (alg !== 'scrypt' || !saltHex || !hashHex) return false;
  const h = crypto.scryptSync(pw, Buffer.from(saltHex, 'hex'), 64, { N: 16384, r: 8, p: 1 });
  const expected = Buffer.from(hashHex, 'hex');
  return h.length === expected.length && crypto.timingSafeEqual(h, expected);
}
const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

export function passwordProblem(pw: string): string | null {
  if (pw.length < 10) return 'password_too_short';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'password_weak';
  return null;
}

export function login(email: string, password: string, ip: string, ua: string):
  { ok: true; token: string; actor: Actor } | { ok: false; error: string } {
  const u = get('SELECT u.*, r.key AS role_key FROM users u JOIN roles r ON r.id=u.role_id WHERE u.email=?', email);
  // bir xil vaqt sarflash uchun soxta tekshiruv
  if (!u) { verifyPassword(password, 'scrypt$00$00'); return { ok: false, error: 'invalid_credentials' }; }
  if (!u.is_active) return { ok: false, error: 'account_disabled' };
  if (u.locked_until && new Date(u.locked_until + 'Z') > new Date()) return { ok: false, error: 'account_locked' };
  if (!verifyPassword(password, u.password_hash)) {
    const failed = u.failed_logins + 1;
    if (failed >= MAX_FAILED) run("UPDATE users SET failed_logins=0, locked_until=datetime('now', ?) WHERE id=?", `+${LOCK_MIN} minutes`, u.id);
    else run('UPDATE users SET failed_logins=? WHERE id=?', failed, u.id);
    return { ok: false, error: 'invalid_credentials' };
  }
  run('UPDATE users SET failed_logins=0, locked_until=NULL WHERE id=?', u.id);
  const token = crypto.randomBytes(32).toString('base64url');
  const csrf = crypto.randomBytes(24).toString('base64url');
  run("INSERT INTO sessions(id,user_id,csrf,expires_at,ip,user_agent) VALUES(?,?,?,datetime('now', ?),?,?)",
    sha(token), u.id, csrf, `+${SESSION_HOURS} hours`, ip, ua.slice(0, 200));
  return { ok: true, token, actor: { id: u.id, email: u.email, fullName: u.full_name, role: u.role_key, csrf, sessionId: sha(token) } };
}

export function actorFromToken(token: string | undefined): Actor | null {
  if (!token) return null;
  const s = get(`SELECT s.id, s.csrf, u.id uid, u.email, u.full_name, u.is_active, r.key role_key
    FROM sessions s JOIN users u ON u.id=s.user_id JOIN roles r ON r.id=u.role_id
    WHERE s.id=? AND s.expires_at > datetime('now')`, sha(token));
  if (!s || !s.is_active) return null;
  return { id: s.uid, email: s.email, fullName: s.full_name, role: s.role_key, csrf: s.csrf, sessionId: s.id };
}
export function logout(sessionId: string) { run('DELETE FROM sessions WHERE id=?', sessionId); }
export function purgeExpiredSessions() { run("DELETE FROM sessions WHERE expires_at <= datetime('now')"); }

export class HttpError extends Error {
  constructor(public status: number, public code: string, message?: string) { super(message ?? code); }
}
export function require_(actor: Actor | null, perm: Permission): Actor | null {
  if (!can(actor?.role, perm)) throw new HttpError(actor ? 403 : 401, actor ? 'forbidden' : 'unauthenticated');
  return actor;
}
export function requireActor(actor: Actor | null, perm: Permission): Actor {
  if (!actor) throw new HttpError(401, 'unauthenticated');
  if (!can(actor.role, perm)) throw new HttpError(403, 'forbidden');
  return actor;
}
export { all };
