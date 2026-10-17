import type { IncomingMessage, ServerResponse } from 'node:http';
import { actorFromToken, HttpError, type Actor } from './auth.js';

export interface Ctx {
  req: IncomingMessage; res: ServerResponse; url: URL; params: Record<string, string>;
  actor: Actor | null; ip: string; body: any; rawBody?: Buffer;
}
export type Handler = (c: Ctx) => unknown | Promise<unknown>;
interface Route { method: string; re: RegExp; keys: string[]; h: Handler; raw?: boolean; noCsrf?: boolean }
const routes: Route[] = [];

export function route(method: string, pattern: string, h: Handler, opts: { raw?: boolean; noCsrf?: boolean } = {}) {
  const keys: string[] = [];
  const re = new RegExp('^' + pattern.replace(/:([a-zA-Z]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
  routes.push({ method, re, keys, h, raw: opts.raw, noCsrf: opts.noCsrf });
}
export const GET = (p: string, h: Handler) => route('GET', p, h);
export const POST = (p: string, h: Handler, o?: { raw?: boolean; noCsrf?: boolean }) => route('POST', p, h, o);
export const PUT = (p: string, h: Handler) => route('PUT', p, h);
export const DEL = (p: string, h: Handler) => route('DELETE', p, h);

export const COOKIE = 'tf_session';
export function parseCookies(h: string | undefined): Record<string, string> {
  const o: Record<string, string> = {};
  for (const part of (h ?? '').split(';')) { const i = part.indexOf('='); if (i > 0) o[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); }
  return o;
}
export function setSessionCookie(res: ServerResponse, token: string | null, secure: boolean) {
  const base = `${COOKIE}=${token ?? ''}; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
  res.setHeader('Set-Cookie', token ? `${base}; Max-Age=${12 * 3600}` : `${base}; Max-Age=0`);
}

export function json(res: ServerResponse, status: number, data: unknown) {
  const b = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(b), 'Cache-Control': 'no-store' });
  res.end(b);
}

// Oddiy xotirada tezlik cheklovi (bitta jarayon uchun). Ko'p serverli joylashtirishda Redis/reverse proxy ishlatilsin.
const buckets = new Map<string, { n: number; t: number }>();
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now(); const b = buckets.get(key);
  if (!b || now - b.t > windowMs) { buckets.set(key, { n: 1, t: now }); return true; }
  b.n++; return b.n <= max;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of buckets) if (now - v.t > 3_600_000) buckets.delete(k); }, 600_000).unref();

export const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  // Asosiy ilova CSP: faqat o'z skriptlari; sandbox iframe lar o'z CSP siga ega
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self'; frame-src 'self' blob: data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'",
};

export async function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = []; let n = 0;
  for await (const c of req) { n += (c as Buffer).length; if (n > limit) throw new HttpError(413, 'payload_too_large'); chunks.push(c as Buffer); }
  return Buffer.concat(chunks);
}

export async function dispatch(req: IncomingMessage, res: ServerResponse, url: URL, ip: string): Promise<boolean> {
  const method = req.method ?? 'GET';
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = r.re.exec(url.pathname); if (!m) continue;
    const params: Record<string, string> = {};
    r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
    const token = parseCookies(req.headers.cookie)[COOKIE];
    const actor = actorFromToken(token);
    // CSRF: o'zgartiruvchi so'rovlar uchun sessiya tokeni sarlavhada bo'lishi shart (login bundan mustasno)
    if (method !== 'GET' && method !== 'HEAD' && actor && !r.noCsrf) {
      if (req.headers['x-csrf-token'] !== actor.csrf) throw new HttpError(403, 'csrf');
    }
    if (method !== 'GET' && method !== 'HEAD') {
      const origin = req.headers.origin;
      if (origin && new URL(origin).host !== req.headers.host) throw new HttpError(403, 'bad_origin');
    }
    let body: any = undefined; let rawBody: Buffer | undefined;
    if (method === 'POST' || method === 'PUT') {
      const ct = String(req.headers['content-type'] ?? '');
      if (ct.startsWith('application/json')) {
        const buf = await readBody(req, 5 * 1024 * 1024);
        try { body = buf.length ? JSON.parse(buf.toString('utf8')) : {}; } catch { throw new HttpError(400, 'bad_json'); }
      } else if (r.raw) rawBody = await readBody(req, 12 * 1024 * 1024);
    }
    const out = await r.h({ req, res, url, params, actor, ip, body, rawBody });
    if (!res.headersSent && out !== undefined) json(res, 200, out);
    return true;
  }
  return false;
}
