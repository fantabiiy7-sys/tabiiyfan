import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { dispatch, json, SECURITY_HEADERS, rateLimit } from './http.js';
import { HttpError, purgeExpiredSessions } from './auth.js';
import { run } from './db.js';
import './api-public.js';
import './api-admin.js';

const PORT = Number(process.env.PORT ?? 3000);
const WEB_DIR = process.env.WEB_DIR ?? path.resolve(process.cwd(), 'web/dist');
const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2', '.map': 'application/json', '.webmanifest': 'application/manifest+json' };

function clientIp(req: http.IncomingMessage): string {
  // Reverse proxy ortida ishlaganda TRUST_PROXY=1 qo'ying
  if (process.env.TRUST_PROXY === '1') { const x = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim(); if (x) return x; }
  return req.socket.remoteAddress ?? 'unknown';
}

function serveStatic(url: URL, res: http.ServerResponse): boolean {
  let rel = decodeURIComponent(url.pathname);
  if (rel.includes('\0')) return false;
  let file = path.join(WEB_DIR, path.normalize(rel));
  if (!file.startsWith(WEB_DIR)) return false;
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    if (path.extname(rel)) return false;
    file = path.join(WEB_DIR, 'index.html');            // SPA fallback
    if (!fs.existsSync(file)) return false;
  }
  const ext = path.extname(file);
  const hashed = /-[A-Z0-9]{8}\.(js|css)$/.test(path.basename(file));
  res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream', 'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache' });
  fs.createReadStream(file).pipe(res);
  return true;
}

export const server = http.createServer(async (req, res) => {
  const ip = clientIp(req);
  const url = new URL(req.url ?? '/', 'http://localhost');
  // /embed va /media o'z CSP sarlavhalarini o'rnatadi; qolganlariga umumiy sarlavhalar
  const own = url.pathname.startsWith('/embed/') || url.pathname.startsWith('/media/');
  if (!own) for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
  if (url.pathname.startsWith('/embed/')) res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  try {
    if (!rateLimit('global:' + ip, 600, 60_000)) throw new HttpError(429, 'too_many_requests');
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/embed/') || url.pathname.startsWith('/media/')) {
      if (await dispatch(req, res, url, ip)) return;
      throw new HttpError(404, 'not_found');
    }
    if (req.method === 'GET' || req.method === 'HEAD') { if (serveStatic(url, res)) return; }
    throw new HttpError(404, 'not_found');
  } catch (e: any) {
    if (res.headersSent) { res.end(); return; }
    if (e instanceof HttpError) { json(res, e.status, { error: e.code, message: e.message !== e.code ? e.message : undefined }); return; }
    console.error('[error]', e);
    try { run('INSERT INTO error_logs(message,stack,path) VALUES(?,?,?)', String(e?.message ?? e).slice(0, 500), String(e?.stack ?? '').slice(0, 3000), url.pathname); } catch { /* ignore */ }
    json(res, 500, { error: 'server_error' });
  }
});

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file://').href || process.env.START_SERVER === '1') {
  purgeExpiredSessions(); setInterval(purgeExpiredSessions, 3_600_000).unref();
  server.listen(PORT, process.env.HOST ?? '0.0.0.0', () => console.log(`Tabiiy fan serveri: http://localhost:${PORT}`));
}
