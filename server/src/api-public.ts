import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { GET, POST, json, rateLimit, setSessionCookie, type Ctx } from './http.js';
import { all, get, run, DATA_DIR } from './db.js';
import { login, logout, HttpError, requireActor, passwordProblem, hashPassword } from './auth.js';
import { can, ROLE_PERMISSIONS, PERMISSIONS } from './permissions.js';
import { listContent, loadFull, isLang, defaultLang, getSetting, KINDS } from './content.js';
import { buildDocument, buildCsp, parseHosts, IFRAME_SANDBOX } from './sandbox.js';
import { audit } from './audit.js';

const langOf = (c: Ctx) => { const l = c.url.searchParams.get('lang'); return isLang(l) ? l : defaultLang(); };
const num = (s: string | null, d: number, min = 1, max = 100) => { const n = parseInt(s ?? '', 10); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d; };
const secure = () => process.env.COOKIE_SECURE === '1';

function meInfo(c: Ctx) {
  const a = c.actor;
  return a ? { id: a.id, email: a.email, fullName: a.fullName, role: a.role, csrf: a.csrf, permissions: ROLE_PERMISSIONS[a.role] } : null;
}

// ---------- bootstrap ----------
GET('/api/bootstrap', (c) => {
  const lang = langOf(c);
  const nav = all('SELECT * FROM nav_items WHERE is_visible=1 ORDER BY sort_order, id');
  const shape = (n: any) => ({ id: n.id, key: n.key, path: n.path, icon: n.icon, label: n['label_' + lang] });
  const top = nav.filter(n => !n.parent_id).map(n => ({ ...shape(n), children: nav.filter(x => x.parent_id === n.id).map(shape) }));
  const settings: Record<string, string> = {};
  for (const r of all("SELECT key,value FROM platform_settings WHERE key IN ('brand_primary_light','brand_primary_dark','site_name_uz','site_name_ru','site_name_en','tagline_uz','tagline_ru','tagline_en','default_lang','demo_banner','contact_email')")) settings[r.key] = r.value;
  const overrides: Record<string, string> = {};
  for (const r of all('SELECT key,value FROM translations WHERE lang=?', lang)) overrides[r.key] = r.value;
  return {
    me: meInfo(c), nav: top, settings, overrides,
    grades: all('SELECT id,name_uz,name_ru,name_en FROM grades ORDER BY id').map(g => ({ id: g.id, name: g['name_' + lang] })),
    subjects: all('SELECT id,slug,name_uz,name_ru,name_en,is_core FROM subjects ORDER BY sort_order').map(s => ({ id: s.id, slug: s.slug, name: s['name_' + lang], isCore: !!s.is_core })),
    topics: all('SELECT id,grade_id,slug,title_uz,title_ru,title_en,section_uz,section_ru,section_en,is_verified FROM topics ORDER BY grade_id,sort_order')
      .map(t => ({ id: t.id, grade: t.grade_id, slug: t.slug, title: t['title_' + lang] || t.title_uz, section: t['section_' + lang] || t.section_uz, sectionKey: t.section_uz, verified: !!t.is_verified })),
    studioPolicy: can(c.actor?.role, 'studio.use') ? { sandbox: IFRAME_SANDBOX, hosts: parseHosts(getSetting('studio_allowed_hosts')), csp: buildCsp(parseHosts(getSetting('studio_allowed_hosts'))) } : null,
  };
});

// ---------- auth ----------
POST('/api/auth/login', (c) => {
  if (!rateLimit('login:' + c.ip, Number(process.env.LOGIN_RATE_MAX ?? 10), 60_000)) throw new HttpError(429, 'too_many_requests');
  const b = z.object({ email: z.string().email().max(200), password: z.string().min(1).max(200) }).safeParse(c.body);
  if (!b.success) throw new HttpError(400, 'invalid_input');
  const r = login(b.data.email, b.data.password, c.ip, String(c.req.headers['user-agent'] ?? ''));
  if (!r.ok) { audit(null, 'auth.login_failed', 'user', b.data.email, undefined, c.ip); throw new HttpError(r.error === 'account_locked' ? 423 : 401, r.error); }
  setSessionCookie(c.res, r.token, secure());
  audit(r.actor, 'auth.login', 'user', r.actor.id, undefined, c.ip);
  c.actor = r.actor;
  return { me: meInfo(c) };
}, { noCsrf: true });
POST('/api/auth/logout', (c) => {
  if (c.actor) { audit(c.actor, 'auth.logout', 'user', c.actor.id, undefined, c.ip); logout(c.actor.sessionId); }
  setSessionCookie(c.res, null, secure());
  return { ok: true };
});
GET('/api/auth/me', (c) => ({ me: meInfo(c) }));
POST('/api/auth/password', (c) => {
  const a = requireActor(c.actor, 'content.read_published');
  const b = z.object({ current: z.string(), next: z.string().max(200) }).safeParse(c.body);
  if (!b.success) throw new HttpError(400, 'invalid_input');
  const u = get('SELECT password_hash FROM users WHERE id=?', a.id)!;
  // dynamic import-free verify
  return import('./auth.js').then(m => {
    if (!m.verifyPassword(b.data.current, u.password_hash)) throw new HttpError(401, 'invalid_credentials');
    const prob = passwordProblem(b.data.next); if (prob) throw new HttpError(400, prob);
    run("UPDATE users SET password_hash=?, updated_at=datetime('now') WHERE id=?", hashPassword(b.data.next), a.id);
    audit(a, 'auth.password_changed', 'user', a.id, undefined, c.ip);
    return { ok: true };
  });
});

// ---------- public content ----------
GET('/api/content', (c) => {
  const s = c.url.searchParams;
  const kind = s.get('kind') ?? undefined;
  if (kind && !(KINDS as readonly string[]).includes(kind)) throw new HttpError(400, 'invalid_kind');
  return listContent({
    kind, grade: s.get('grade') ? num(s.get('grade'), 0, 5, 6) : undefined, topic: s.get('topic') ?? undefined, subject: s.get('subject') ?? undefined,
    q: s.get('q') ?? undefined, lang: langOf(c), lessonType: s.get('lessonType') ?? undefined, method: s.get('method') ?? undefined,
    format: s.get('format') ?? undefined, section: s.get('section') ?? undefined, page: num(s.get('page'), 1, 1, 10_000), pageSize: num(s.get('pageSize'), 12, 1, 48),
    sort: s.get('sort') ?? undefined,
  });
});
GET('/api/content/:slug', (c) => {
  const row = get('SELECT * FROM content_items WHERE slug=?', c.params.slug);
  if (!row) throw new HttpError(404, 'not_found');
  const admin = can(c.actor?.role, 'content.read_all');
  if ((row.status !== 'published' || row.is_hidden) && !admin) throw new HttpError(404, 'not_found');
  return loadFull(row, langOf(c), admin);
});

GET('/api/home', (c) => {
  const lang = langOf(c);
  let cfg: any = {}; try { cfg = JSON.parse(getSetting('home_config', '{}')); } catch { /* ignore */ }
  const latest = listContent({ lang, page: 1, pageSize: 6, sort: 'new' }).items;
  const bySlugs = (slugs: string[] = []) => slugs.map(s => get("SELECT * FROM content_items WHERE slug=? AND status='published' AND is_hidden=0", s)).filter(Boolean)
    .map(r => listContent({ lang, page: 1, pageSize: 48 }).items.find(i => i.slug === (r as any).slug)).filter(Boolean);
  const popularMethods = bySlugs(cfg.methodSlugs).length ? bySlugs(cfg.methodSlugs) : listContent({ lang, kind: 'method', page: 1, pageSize: 6 }).items;
  const featured = bySlugs(cfg.featuredLessonSlugs).length ? bySlugs(cfg.featuredLessonSlugs) : listContent({ lang, kind: 'lesson', page: 1, pageSize: 6 }).items;
  const integration = listContent({ lang, kind: 'lesson', page: 1, pageSize: 6 }).items.filter(i => i.subjects.length > 1);
  const counts = Object.fromEntries(all("SELECT kind, COUNT(*) n FROM content_items WHERE status='published' AND is_hidden=0 GROUP BY kind").map(r => [r.kind, r.n]));
  const news = all("SELECT * FROM announcements WHERE status='published' ORDER BY published_at DESC, id DESC LIMIT 4").map(a => ({
    id: a.id, title: a['title_' + lang] || a.title_uz, body: a['body_' + lang] || a.body_uz, publishedAt: a.published_at, isDemo: !!a.is_demo }));
  return { latest, featured, integration, popularMethods, counts, news, config: cfg };
});

GET('/api/search', (c) => {
  const q = (c.url.searchParams.get('q') ?? '').trim();
  if (q.length < 2) return { items: [], total: 0, page: 1, pageSize: 20, topics: [] };
  const lang = langOf(c);
  const r = listContent({ q, lang, page: num(c.url.searchParams.get('page'), 1, 1, 1000), pageSize: 20, kind: c.url.searchParams.get('kind') ?? undefined,
    grade: c.url.searchParams.get('grade') ? num(c.url.searchParams.get('grade'), 0, 5, 6) : undefined, subject: c.url.searchParams.get('subject') ?? undefined });
  const like = '%' + q.replace(/[\\%_]/g, m => '\\' + m) + '%';
  const topics = all(`SELECT slug,grade_id,title_uz,title_ru,title_en FROM topics WHERE title_uz LIKE ? ESCAPE '\\' OR title_ru LIKE ? ESCAPE '\\' OR title_en LIKE ? ESCAPE '\\' LIMIT 8`, like, like, like)
    .map(t => ({ slug: t.slug, grade: t.grade_id, title: t['title_' + lang] || t.title_uz }));
  return { ...r, topics };
});

// ---------- assessments: javob serverda tekshiriladi ----------
function loadAssessment(slug: string, c: Ctx) {
  const item = get("SELECT * FROM content_items WHERE slug=? AND kind='assessment'", slug);
  if (!item || ((item.status !== 'published' || item.is_hidden) && !can(c.actor?.role, 'content.read_all'))) throw new HttpError(404, 'not_found');
  const a = get('SELECT * FROM assessments WHERE content_id=?', item.id);
  const qs = a ? all('SELECT * FROM questions WHERE assessment_id=? ORDER BY sort_order,id', a.id) : [];
  return { item, a, qs };
}
GET('/api/assessments/:slug', (c) => {
  const lang = langOf(c); const { item, a, qs } = loadAssessment(c.params.slug, c);
  const full = loadFull(item, lang, false);
  return {
    slug: item.slug, title: full.title, summary: full.summary, passPercent: a?.pass_percent ?? 60, isDemo: !!item.is_demo,
    questions: qs.map(q => ({ id: q.id, text: q['q_' + lang] || q.q_uz, options: JSON.parse(q.options).map((o: any) => o[lang] || o.uz) })),
  };
});
POST('/api/assessments/:slug/check', (c) => {
  if (!rateLimit('assess:' + c.ip, 60, 60_000)) throw new HttpError(429, 'too_many_requests');
  const lang = langOf(c); const { a, qs } = loadAssessment(c.params.slug, c);
  const b = z.object({ answers: z.record(z.string(), z.number().int().min(0).max(20)) }).safeParse(c.body);
  if (!b.success) throw new HttpError(400, 'invalid_input');
  let correct = 0;
  const results = qs.map(q => {
    const given = b.data.answers[String(q.id)];
    const ok = given === q.correct_index; if (ok) correct++;
    return { id: q.id, correct: ok, correctIndex: q.correct_index, explanation: q['explanation_' + lang] || q.explanation_uz || '' };
  });
  const percent = qs.length ? Math.round((correct / qs.length) * 100) : 0;
  return { correct, total: qs.length, percent, passed: percent >= (a?.pass_percent ?? 60), results };
});

// ---------- embed: nashr qilingan interaktiv loyiha (sandbox + CSP) ----------
GET('/embed/:id', (c) => {
  const p = get('SELECT * FROM interactive_projects WHERE id=?', c.params.id);
  if (!p) throw new HttpError(404, 'not_found');
  const useDraft = c.url.searchParams.get('draft') === '1' && can(c.actor?.role, 'studio.use');
  let src: any = null;
  if (useDraft) src = p;
  else if (p.status === 'published' && p.published_version_id) src = get('SELECT * FROM project_versions WHERE id=?', p.published_version_id);
  if (!src) throw new HttpError(404, 'not_found');
  const hosts = parseHosts(getSetting('studio_allowed_hosts'));
  const doc = buildDocument({ html: src.html, css: src.css, js: src.js }, hosts, p.name);
  c.res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, max-age=60',
    'Content-Security-Policy': buildCsp(hosts) + '; sandbox allow-scripts', 'X-Content-Type-Options': 'nosniff',
  });
  c.res.end(doc);
});

// ---------- media: fayllarni xavfsiz berish ----------
GET('/media/:name', (c) => {
  const name = path.basename(c.params.name);
  const m = get('SELECT * FROM media_assets WHERE stored_name=?', name);
  const file = path.join(DATA_DIR, 'uploads', name);
  if (!m || !fs.existsSync(file)) throw new HttpError(404, 'not_found');
  const inline = /^(image\/(png|jpeg|webp|gif)|video\/(mp4|webm)|application\/pdf)$/.test(m.mime);
  c.res.writeHead(200, {
    'Content-Type': m.mime, 'Content-Length': m.size, 'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(m.filename)}`,
    'Cache-Control': 'public, max-age=86400',
  });
  fs.createReadStream(file).pipe(c.res);
});
export { json, PERMISSIONS };

// ---------- ommaviy tahrirlash tarixi (muallif va snapshot yashirin) ----------
GET('/api/content/:slug/history', (c) => {
  const row = get('SELECT id,status,is_hidden FROM content_items WHERE slug=?', c.params.slug);
  if (!row || ((row.status !== 'published' || row.is_hidden) && !can(c.actor?.role, 'content.read_all'))) throw new HttpError(404, 'not_found');
  return all('SELECT version_no, note, created_at FROM content_versions WHERE content_id=? ORDER BY version_no DESC LIMIT 30', row.id);
});
