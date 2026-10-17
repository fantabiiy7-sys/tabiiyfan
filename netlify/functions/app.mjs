// Netlify Function: mavjud Node serverni (server/src) o'ramasi.
// DEMO REJIMI: baza paket ichida tayyor holda keladi va faqat o'qish uchun ishlatiladi.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(os.tmpdir(), 'tabiiy-data');

let ready;
function boot() {
  const candidates = [path.resolve(here, '../data'), path.join(process.env.LAMBDA_TASK_ROOT ?? '/var/task', 'netlify/data')];
  const src = candidates.find((d) => fs.existsSync(path.join(d, 'app.db')));
  if (!src) throw new Error('netlify/data/app.db topilmadi (build bosqichi ishlamagan)');
  fs.mkdirSync(DATA, { recursive: true });
  fs.copyFileSync(path.join(src, 'app.db'), path.join(DATA, 'app.db'));
  if (fs.existsSync(path.join(src, 'uploads'))) fs.cpSync(path.join(src, 'uploads'), path.join(DATA, 'uploads'), { recursive: true });
  process.env.DATA_DIR = DATA;
  process.env.COOKIE_SECURE = '1';
  process.env.TRUST_PROXY = '1';
  return import('../lib/server.bundle.mjs').then(
    ({ server }) => new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port))),
  );
}

// Demo rejimida faqat o'qish; yagona istisno — test javobini tekshirish (bazaga yozmaydi)
const allowedWrite = /^\/api\/assessments\/[^/]+\/check\/?$/;

export default async (req, context) => {
  const url = new URL(req.url);
  const method = req.method;
  const isRead = method === 'GET' || method === 'HEAD';
  if (!isRead && !allowedWrite.test(url.pathname)) {
    return Response.json({ error: 'readonly_demo', message: 'Bu demo versiya: faqat ko‘rish rejimi' }, { status: 403 });
  }
  ready ??= boot();
  const port = await ready;
  const body = isRead ? undefined : Buffer.from(await req.arrayBuffer());
  const headers = Object.fromEntries(req.headers);
  headers.host = url.host;
  headers['x-forwarded-for'] = context?.ip ?? headers['x-nf-client-connection-ip'] ?? '';
  delete headers['content-length'];
  if (body) headers['content-length'] = String(body.length);

  return new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port, method, path: url.pathname + url.search, headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const h = new Headers();
        for (let i = 0; i < res.rawHeaders.length; i += 2) {
          const k = res.rawHeaders[i].toLowerCase();
          if (k === 'transfer-encoding' || k === 'connection' || k === 'keep-alive') continue;
          h.append(res.rawHeaders[i], res.rawHeaders[i + 1]);
        }
        const status = res.statusCode ?? 500;
        const empty = method === 'HEAD' || [204, 205, 304].includes(status);
        resolve(new Response(empty ? null : Buffer.concat(chunks), { status, headers: h }));
      });
    });
    r.on('error', reject);
    if (body) r.write(body);
    r.end();
  });
};

export const config = { path: ['/api/*', '/embed/*', '/media/*'] };
