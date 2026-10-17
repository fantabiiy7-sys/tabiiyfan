// Netlify uchun yig'ish: frontend (statik) + server (bitta bundle) + tayyor baza
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const p = (...a) => path.join(root, ...a);
const banner = { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" };

// 1. Frontend -> web/dist
execFileSync('node', [p('scripts/build-web.mjs')], { stdio: 'inherit' });

// 2. Server -> bitta fayl (Netlify Function ichiga) va seed
const common = { bundle: true, platform: 'node', format: 'esm', target: 'node22', banner, logLevel: 'info' };
await build({ ...common, entryPoints: [p('server/src/index.ts')], outfile: p('netlify/lib/server.bundle.mjs') });
await build({ ...common, entryPoints: [p('server/src/seed.ts')], outfile: p('server/.build/seed.mjs') });

// 3. Baza: netlify/snapshot/app.db bo'lsa — o'sha (o'zingiz tayyorlagan), bo'lmasa namunaviy seed
const out = p('netlify/data');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'uploads'), { recursive: true });
const snap = p('netlify/snapshot');
if (fs.existsSync(path.join(snap, 'app.db'))) {
  console.log('Tayyor baza ishlatilmoqda: netlify/snapshot/app.db');
  fs.copyFileSync(path.join(snap, 'app.db'), path.join(out, 'app.db'));
  if (fs.existsSync(path.join(snap, 'uploads'))) fs.cpSync(path.join(snap, 'uploads'), path.join(out, 'uploads'), { recursive: true });
} else {
  console.log('Namunaviy kontent bilan baza yaratilmoqda…');
  execFileSync('node', ['--no-warnings', p('server/.build/seed.mjs')], {
    stdio: 'ignore',
    env: { ...process.env, DATA_DIR: out, ADMIN_PASSWORD: 'demo-' + crypto.randomBytes(12).toString('hex') + '1' },
  });
}
// WAL ni asosiy faylga birlashtirish (bitta fayl bo'lib qolsin)
const db = new DatabaseSync(path.join(out, 'app.db'));
db.exec('PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode = DELETE;');
db.close();
for (const f of ['app.db-wal', 'app.db-shm']) fs.rmSync(path.join(out, f), { force: true });
console.log('Netlify uchun tayyor.');
