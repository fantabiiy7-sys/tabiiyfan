import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { z } from 'zod';
import { GET, POST, PUT, DEL, rateLimit, type Ctx } from './http.js';
import { all, get, run, tx, DATA_DIR } from './db.js';
import { HttpError, requireActor, hashPassword, passwordProblem, type Actor } from './auth.js';
import { can, transitionPerm, ROLES, type Permission, type Status, type RoleKey } from './permissions.js';
import { listContent, loadFull, writeContent, changeStatus, saveVersion, snapshot, isLang, defaultLang, getSetting, KINDS, LANGS, safeParse, type Lang } from './content.js';
import { scanCode, parseHosts } from './sandbox.js';
import { audit } from './audit.js';

const need = (c: Ctx, p: Permission) => requireActor(c.actor, p);
const intp = (s: string) => { const n = parseInt(s, 10); if (!Number.isFinite(n)) throw new HttpError(400, 'invalid_id'); return n; };
const langOf = (c: Ctx): Lang => { const l = c.url.searchParams.get('lang'); return isLang(l) ? l : defaultLang(); };
const parse = <T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> => {
  const r = schema.safeParse(data); if (!r.success) throw new HttpError(400, 'invalid_input', r.error.issues.map(i => i.path.join('.') + ': ' + i.message).join('; ')); return r.data;
};

// ---------- dashboard ----------
GET('/api/admin/dashboard', (c) => {
  need(c, 'admin.access');
  return {
    byKind: all('SELECT kind, status, COUNT(*) n FROM content_items GROUP BY kind, status'),
    pendingReview: listContent({ lang: langOf(c), admin: true, status: 'in_review', page: 1, pageSize: 8 }).items,
    recentActivity: can(c.actor!.role, 'audit.read') ? all('SELECT id,actor_email,action,entity,entity_id,created_at FROM audit_logs ORDER BY id DESC LIMIT 10') : [],
    users: can(c.actor!.role, 'users.read') ? (get('SELECT COUNT(*) n FROM users')?.n ?? 0) : null,
    projects: get('SELECT COUNT(*) n FROM interactive_projects')?.n ?? 0,
    media: get('SELECT COUNT(*) n, COALESCE(SUM(size),0) bytes FROM media_assets'),
    demoCount: get('SELECT COUNT(*) n FROM content_items WHERE is_demo=1')?.n ?? 0,
  };
});

// ---------- content CRUD + workflow ----------
const TrSchema = z.object({ title: z.string().min(1).max(300), summary: z.string().max(2000).optional(), keywords: z.string().max(500).optional(), body: z.any().optional(), status: z.enum(['draft', 'machine', 'reviewed', 'final']).optional() });
const ContentSchema = z.object({
  kind: z.enum(KINDS), grade: z.number().int().min(5).max(6).nullable().optional(), topicId: z.number().int().nullable().optional(),
  lessonType: z.string().max(60).nullable().optional(), durationMin: z.number().int().min(1).max(240).nullable().optional(),
  format: z.string().max(30).nullable().optional(), sourceLang: z.enum(LANGS).optional(),
  videoUrl: z.string().url().max(500).nullable().optional(), fileAssetId: z.number().int().nullable().optional(),
  interactiveProjectId: z.number().int().nullable().optional(), isDemo: z.boolean().optional(), isHidden: z.boolean().optional(),
  subjectIds: z.array(z.number().int()).max(20).optional(), methodIds: z.array(z.number().int()).max(20).optional(),
  translations: z.object({ uz: TrSchema.optional(), ru: TrSchema.optional(), en: TrSchema.optional() }).optional(),
});

GET('/api/admin/content', (c) => {
  need(c, 'content.read_all'); const s = c.url.searchParams;
  return listContent({ lang: langOf(c), admin: true, kind: s.get('kind') ?? undefined, status: s.get('status') ?? undefined, q: s.get('q') ?? undefined,
    grade: s.get('grade') ? intp(s.get('grade')!) : undefined, page: Math.max(1, intp(s.get('page') ?? '1')), pageSize: Math.min(50, intp(s.get('pageSize') ?? '20')) });
});
GET('/api/admin/content/:id', (c) => {
  need(c, 'content.read_all');
  const row = get('SELECT * FROM content_items WHERE id=?', intp(c.params.id)); if (!row) throw new HttpError(404, 'not_found');
  return loadFull(row, langOf(c), true);
});
POST('/api/admin/content', (c) => {
  const a = need(c, 'content.create'); const b = parse(ContentSchema, c.body);
  if (!b.translations || !Object.values(b.translations).some(Boolean)) throw new HttpError(400, 'translation_required');
  const id = writeContent(null, b as any, a.id);
  audit(a, 'content.create', 'content', id, { kind: b.kind }, c.ip);
  return { id };
});
PUT('/api/admin/content/:id', (c) => {
  const a = need(c, 'content.edit'); const id = intp(c.params.id); const b = parse(ContentSchema, c.body);
  const row = get('SELECT status FROM content_items WHERE id=?', id); if (!row) throw new HttpError(404, 'not_found');
  if (row.status === 'published' && !can(a.role, 'content.publish')) throw new HttpError(403, 'forbidden', 'Nashr qilingan materialni tahrirlash uchun nashr ruxsati kerak');
  writeContent(id, b as any, a.id);
  audit(a, 'content.update', 'content', id, undefined, c.ip);
  return { id };
});
POST('/api/admin/content/:id/transition', (c) => {
  const a = need(c, 'admin.access'); const id = intp(c.params.id);
  const b = parse(z.object({ to: z.enum(['draft', 'in_review', 'approved', 'published', 'archived']), comment: z.string().max(1000).optional() }), c.body);
  const row = get('SELECT status FROM content_items WHERE id=?', id); if (!row) throw new HttpError(404, 'not_found');
  const perm = transitionPerm(row.status as Status, b.to);
  if (!perm) throw new HttpError(409, 'invalid_transition');
  need(c, perm);
  const r = changeStatus(id, b.to, a.id, b.comment);
  audit(a, 'content.' + b.to, 'content', id, { from: r.from, comment: b.comment }, c.ip);
  return r;
});
DEL('/api/admin/content/:id', (c) => {
  const a = need(c, 'content.delete'); const id = intp(c.params.id);
  run('DELETE FROM content_items WHERE id=?', id); audit(a, 'content.delete', 'content', id, undefined, c.ip); return { ok: true };
});
GET('/api/admin/content/:id/versions', (c) => {
  need(c, 'content.read_all');
  return all(`SELECT v.id,v.version_no,v.note,v.created_at,u.full_name author FROM content_versions v LEFT JOIN users u ON u.id=v.author_id WHERE v.content_id=? ORDER BY v.version_no DESC LIMIT 100`, intp(c.params.id));
});
GET('/api/admin/content/:id/reviews', (c) => {
  need(c, 'content.read_all');
  return all(`SELECT r.from_status,r.to_status,r.comment,r.created_at,u.full_name actor FROM content_reviews r JOIN users u ON u.id=r.actor_id WHERE r.content_id=? ORDER BY r.id DESC`, intp(c.params.id));
});
POST('/api/admin/content/:id/restore/:vid', (c) => {
  const a = need(c, 'content.edit'); const id = intp(c.params.id);
  const v = get('SELECT * FROM content_versions WHERE id=? AND content_id=?', intp(c.params.vid), id); if (!v) throw new HttpError(404, 'not_found');
  const snap = safeParse(v.snapshot); if (!snap) throw new HttpError(500, 'corrupt_snapshot');
  tx(() => {
    run('DELETE FROM content_translations WHERE content_id=?', id);
    for (const t of snap.translations) run('INSERT INTO content_translations(content_id,lang,title,summary,keywords,body,translation_status) VALUES(?,?,?,?,?,?,?)', id, t.lang, t.title, t.summary, t.keywords, t.body, t.translation_status);
    run('DELETE FROM content_subjects WHERE content_id=?', id); for (const s of snap.subjects) run('INSERT OR IGNORE INTO content_subjects VALUES(?,?)', id, s);
    run('DELETE FROM content_methods WHERE content_id=?', id); for (const m of snap.methods) run('INSERT OR IGNORE INTO content_methods VALUES(?,?)', id, m);
    const it = snap.item;
    run(`UPDATE content_items SET grade_id=?,topic_id=?,lesson_type=?,duration_min=?,format=?,video_url=?,interactive_project_id=?,updated_at=datetime('now') WHERE id=?`, it.grade_id, it.topic_id, it.lesson_type, it.duration_min, it.format, it.video_url, it.interactive_project_id, id);
    saveVersion(id, a.id, `restored v${v.version_no}`);
  });
  audit(a, 'content.restore', 'content', id, { version: v.version_no }, c.ip);
  return { ok: true };
});

// ---------- assessment savollari ----------
const QuestionSchema = z.object({
  q: z.object({ uz: z.string().min(1), ru: z.string().optional(), en: z.string().optional() }),
  options: z.array(z.object({ uz: z.string().min(1), ru: z.string().optional(), en: z.string().optional() })).min(2).max(8),
  correctIndex: z.number().int().min(0),
  explanation: z.object({ uz: z.string().optional(), ru: z.string().optional(), en: z.string().optional() }).optional(),
});
GET('/api/admin/content/:id/questions', (c) => {
  need(c, 'content.read_all');
  const a = get('SELECT * FROM assessments WHERE content_id=?', intp(c.params.id)); if (!a) return { passPercent: 60, questions: [] };
  return { passPercent: a.pass_percent, questions: all('SELECT * FROM questions WHERE assessment_id=? ORDER BY sort_order,id', a.id).map(q => ({
    q: { uz: q.q_uz, ru: q.q_ru, en: q.q_en }, options: JSON.parse(q.options), correctIndex: q.correct_index,
    explanation: { uz: q.explanation_uz, ru: q.explanation_ru, en: q.explanation_en } })) };
});
PUT('/api/admin/content/:id/questions', (c) => {
  const actor = need(c, 'content.edit'); const id = intp(c.params.id);
  const b = parse(z.object({ passPercent: z.number().int().min(1).max(100), questions: z.array(QuestionSchema).max(100) }), c.body);
  if (get('SELECT kind FROM content_items WHERE id=?', id)?.kind !== 'assessment') throw new HttpError(400, 'not_assessment');
  for (const q of b.questions) if (q.correctIndex >= q.options.length) throw new HttpError(400, 'invalid_correct_index');
  tx(() => {
    run('INSERT INTO assessments(content_id,pass_percent) VALUES(?,?) ON CONFLICT(content_id) DO UPDATE SET pass_percent=excluded.pass_percent', id, b.passPercent);
    const a = get('SELECT id FROM assessments WHERE content_id=?', id)!;
    run('DELETE FROM questions WHERE assessment_id=?', a.id);
    b.questions.forEach((q, i) => run(`INSERT INTO questions(assessment_id,sort_order,q_uz,q_ru,q_en,options,correct_index,explanation_uz,explanation_ru,explanation_en) VALUES(?,?,?,?,?,?,?,?,?,?)`,
      a.id, i, q.q.uz, q.q.ru ?? null, q.q.en ?? null, JSON.stringify(q.options), q.correctIndex, q.explanation?.uz ?? null, q.explanation?.ru ?? null, q.explanation?.en ?? null));
    run("UPDATE content_items SET updated_at=datetime('now') WHERE id=?", id);
  });
  audit(actor, 'assessment.update', 'content', id, { questions: b.questions.length }, c.ip);
  return { ok: true };
});

// ---------- HTML Studio ----------
const hostsNow = () => parseHosts(getSetting('studio_allowed_hosts'));
const ProjectSchema = z.object({
  name: z.string().min(1).max(150), html: z.string().max(400_000), css: z.string().max(200_000), js: z.string().max(400_000),
  blocks: z.any().optional(), mode: z.enum(['code', 'blocks']).optional(), isDemo: z.boolean().optional(),
});
GET('/api/studio/projects', (c) => {
  const a = need(c, 'studio.use');
  const scopeAll = can(a.role, 'content.approve') || a.role === 'super_admin';
  return all(`SELECT p.id,p.name,p.status,p.mode,p.is_demo,p.updated_at,p.published_version_id,u.full_name author
    FROM interactive_projects p LEFT JOIN users u ON u.id=p.author_id ${scopeAll ? '' : 'WHERE p.author_id=?'} ORDER BY p.updated_at DESC LIMIT 200`, ...(scopeAll ? [] : [a.id]));
});
function loadProject(a: Actor, id: number) {
  const p = get('SELECT * FROM interactive_projects WHERE id=?', id); if (!p) throw new HttpError(404, 'not_found');
  const scopeAll = can(a.role, 'content.approve') || a.role === 'super_admin';
  if (!scopeAll && p.author_id !== a.id) throw new HttpError(403, 'forbidden');
  return p;
}
function nextVersion(projectId: number) { return ((get('SELECT MAX(version_no) m FROM project_versions WHERE project_id=?', projectId)?.m as number) ?? 0) + 1; }
function addProjectVersion(p: any, kind: 'manual' | 'autosave' | 'published', authorId: number, note?: string) {
  const r = run('INSERT INTO project_versions(project_id,version_no,html,css,js,blocks,kind,note,author_id) VALUES(?,?,?,?,?,?,?,?,?)',
    p.id, nextVersion(p.id), p.html, p.css, p.js, p.blocks ?? null, kind, note ?? null, authorId);
  if (kind === 'autosave') run(`DELETE FROM project_versions WHERE project_id=? AND kind='autosave' AND id NOT IN (SELECT id FROM project_versions WHERE project_id=? AND kind='autosave' ORDER BY id DESC LIMIT 20)`, p.id, p.id);
  return Number(r.lastInsertRowid);
}
POST('/api/studio/projects', (c) => {
  const a = need(c, 'studio.use'); const b = parse(ProjectSchema.partial({ html: true, css: true, js: true }), c.body);
  const r = run('INSERT INTO interactive_projects(name,html,css,js,blocks,mode,is_demo,author_id) VALUES(?,?,?,?,?,?,?,?)',
    b.name, b.html ?? '', b.css ?? '', b.js ?? '', b.blocks ? JSON.stringify(b.blocks) : null, b.mode ?? 'code', b.isDemo ? 1 : 0, a.id);
  const id = Number(r.lastInsertRowid); addProjectVersion(get('SELECT * FROM interactive_projects WHERE id=?', id), 'manual', a.id, 'created');
  audit(a, 'studio.create', 'project', id, { name: b.name }, c.ip); return { id };
});
GET('/api/studio/projects/:id', (c) => {
  const a = need(c, 'studio.use'); const p = loadProject(a, intp(c.params.id));
  return { ...p, blocks: p.blocks ? safeParse(p.blocks) : null, findings: scanCode(p as any, hostsNow()),
    usedBy: all('SELECT c.id,c.slug,c.kind FROM content_items c WHERE c.interactive_project_id=?', p.id) };
});
PUT('/api/studio/projects/:id', (c) => {
  const a = need(c, 'studio.use'); const id = intp(c.params.id); loadProject(a, id);
  if (!rateLimit('studio-save:' + a.id, 120, 60_000)) throw new HttpError(429, 'too_many_requests');
  const b = parse(ProjectSchema.extend({ saveKind: z.enum(['manual', 'autosave']).optional(), note: z.string().max(200).optional() }), c.body);
  run(`UPDATE interactive_projects SET name=?,html=?,css=?,js=?,blocks=?,mode=?,is_demo=COALESCE(?,is_demo),updated_at=datetime('now') WHERE id=?`,
    b.name, b.html, b.css, b.js, b.blocks ? JSON.stringify(b.blocks) : null, b.mode ?? 'code', b.isDemo === undefined ? null : (b.isDemo ? 1 : 0), id);
  const vid = addProjectVersion(get('SELECT * FROM interactive_projects WHERE id=?', id), b.saveKind ?? 'manual', a.id, b.note);
  if ((b.saveKind ?? 'manual') === 'manual') audit(a, 'studio.save', 'project', id, undefined, c.ip);
  return { ok: true, versionId: vid, findings: scanCode(b, hostsNow()) };
});
DEL('/api/studio/projects/:id', (c) => {
  const a = need(c, 'studio.use'); const id = intp(c.params.id); const p = loadProject(a, id);
  if (p.status === 'published') throw new HttpError(409, 'unpublish_first');
  if (get('SELECT 1 FROM content_items WHERE interactive_project_id=?', id)) throw new HttpError(409, 'project_in_use');
  run('DELETE FROM interactive_projects WHERE id=?', id); audit(a, 'studio.delete', 'project', id, undefined, c.ip); return { ok: true };
});
GET('/api/studio/projects/:id/versions', (c) => {
  const a = need(c, 'studio.use'); const id = intp(c.params.id); loadProject(a, id);
  return all(`SELECT v.id,v.version_no,v.kind,v.note,v.created_at,u.full_name author,LENGTH(v.html)+LENGTH(v.css)+LENGTH(v.js) size
    FROM project_versions v LEFT JOIN users u ON u.id=v.author_id WHERE v.project_id=? ORDER BY v.version_no DESC LIMIT 100`, id);
});
GET('/api/studio/projects/:id/versions/:vid', (c) => {
  const a = need(c, 'studio.use'); const id = intp(c.params.id); loadProject(a, id);
  const v = get('SELECT * FROM project_versions WHERE id=? AND project_id=?', intp(c.params.vid), id); if (!v) throw new HttpError(404, 'not_found');
  return { ...v, blocks: v.blocks ? safeParse(v.blocks) : null };
});
POST('/api/studio/projects/:id/publish', (c) => {
  const a = need(c, 'studio.publish'); const id = intp(c.params.id); const p = loadProject(a, id);
  const findings = scanCode(p as any, hostsNow());
  const blocks = findings.filter(f => f.level === 'block');
  if (blocks.length) throw new HttpError(422, 'security_blocked', blocks.map(f => f.message).join(' | '));
  const vid = addProjectVersion(p, 'published', a.id, 'published');
  run("UPDATE interactive_projects SET status='published', published_version_id=?, updated_at=datetime('now') WHERE id=?", vid, id);
  audit(a, 'studio.publish', 'project', id, { versionId: vid }, c.ip);
  return { ok: true, versionId: vid, findings };
});
POST('/api/studio/projects/:id/unpublish', (c) => {
  const a = need(c, 'studio.publish'); const id = intp(c.params.id); loadProject(a, id);
  run("UPDATE interactive_projects SET status='draft', published_version_id=NULL WHERE id=?", id);
  audit(a, 'studio.unpublish', 'project', id, undefined, c.ip); return { ok: true };
});
POST('/api/studio/scan', (c) => {
  need(c, 'studio.use');
  const b = parse(z.object({ html: z.string().max(400_000), css: z.string().max(200_000), js: z.string().max(400_000) }), c.body);
  return { findings: scanCode(b, hostsNow()) };
});
// Dars sahifasiga joylashtirish
POST('/api/studio/projects/:id/attach', (c) => {
  const a = need(c, 'content.edit'); need(c, 'studio.use'); const id = intp(c.params.id); loadProject(a, id);
  const b = parse(z.object({ contentId: z.number().int().nullable() }), c.body);
  if (b.contentId == null) { run('UPDATE content_items SET interactive_project_id=NULL WHERE interactive_project_id=?', id); return { ok: true }; }
  if (!get('SELECT 1 FROM content_items WHERE id=?', b.contentId)) throw new HttpError(404, 'content_not_found');
  run("UPDATE content_items SET interactive_project_id=?, updated_at=datetime('now') WHERE id=?", id, b.contentId);
  saveVersion(b.contentId, a.id, `studio project #${id} attached`);
  audit(a, 'studio.attach', 'content', b.contentId, { projectId: id }, c.ip); return { ok: true };
});

// ---------- media ----------
const MEDIA: Record<string, { ext: string; magic?: (b: Buffer) => boolean }> = {
  'image/png': { ext: '.png', magic: b => b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) },
  'image/jpeg': { ext: '.jpg', magic: b => b[0] === 0xff && b[1] === 0xd8 },
  'image/gif': { ext: '.gif', magic: b => b.subarray(0, 3).toString() === 'GIF' },
  'image/webp': { ext: '.webp', magic: b => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP' },
  'application/pdf': { ext: '.pdf', magic: b => b.subarray(0, 4).toString() === '%PDF' },
  'video/mp4': { ext: '.mp4', magic: b => b.subarray(4, 8).toString() === 'ftyp' },
  'video/webm': { ext: '.webm', magic: b => b[0] === 0x1a && b[1] === 0x45 },
  'image/svg+xml': { ext: '.svg', magic: b => /<svg[\s>]/i.test(b.subarray(0, 2000).toString('utf8')) && !/<script|on\w+\s*=/i.test(b.toString('utf8')) },
};
GET('/api/admin/media', (c) => {
  need(c, 'media.upload');
  return all('SELECT m.id,m.filename,m.stored_name,m.mime,m.size,m.alt_uz,m.alt_ru,m.alt_en,m.created_at,u.full_name uploader FROM media_assets m LEFT JOIN users u ON u.id=m.uploader_id ORDER BY m.id DESC LIMIT 200');
});
POST('/api/admin/media', (c) => {
  const a = need(c, 'media.upload');
  if (!rateLimit('upload:' + a.id, 30, 60_000)) throw new HttpError(429, 'too_many_requests');
  const buf = c.rawBody; const mime = String(c.req.headers['content-type'] ?? '').split(';')[0].trim();
  const spec = MEDIA[mime]; if (!spec) throw new HttpError(415, 'unsupported_type');
  if (!buf || !buf.length) throw new HttpError(400, 'empty_file');
  if (buf.length > 10 * 1024 * 1024) throw new HttpError(413, 'file_too_large');
  if (spec.magic && !spec.magic(buf)) throw new HttpError(415, 'content_mismatch');
  const raw = decodeURIComponent(String(c.req.headers['x-filename'] ?? 'file' + spec.ext)).replace(/[\\/\0<>:"|?*]/g, '_').slice(0, 120);
  const stored = crypto.randomBytes(16).toString('hex') + spec.ext;
  fs.writeFileSync(path.join(DATA_DIR, 'uploads', stored), buf, { flag: 'wx' });
  const sha = crypto.createHash('sha256').update(buf).digest('hex');
  const alt = decodeURIComponent(String(c.req.headers['x-alt'] ?? '')).slice(0, 300) || null;
  const r = run('INSERT INTO media_assets(filename,stored_name,mime,size,sha256,alt_uz,uploader_id) VALUES(?,?,?,?,?,?,?)', raw, stored, mime, buf.length, sha, alt, a.id);
  audit(a, 'media.upload', 'media', Number(r.lastInsertRowid), { name: raw, size: buf.length }, c.ip);
  return { id: Number(r.lastInsertRowid), url: '/media/' + stored };
}, { raw: true });
PUT('/api/admin/media/:id', (c) => {
  const a = need(c, 'media.upload'); const b = parse(z.object({ altUz: z.string().max(300).optional(), altRu: z.string().max(300).optional(), altEn: z.string().max(300).optional() }), c.body);
  run('UPDATE media_assets SET alt_uz=?,alt_ru=?,alt_en=? WHERE id=?', b.altUz ?? null, b.altRu ?? null, b.altEn ?? null, intp(c.params.id));
  audit(a, 'media.update', 'media', c.params.id, undefined, c.ip); return { ok: true };
});
DEL('/api/admin/media/:id', (c) => {
  const a = need(c, 'media.manage'); const id = intp(c.params.id); const m = get('SELECT * FROM media_assets WHERE id=?', id); if (!m) throw new HttpError(404, 'not_found');
  if (get('SELECT 1 FROM content_items WHERE file_asset_id=?', id)) throw new HttpError(409, 'media_in_use');
  run('DELETE FROM media_assets WHERE id=?', id); try { fs.unlinkSync(path.join(DATA_DIR, 'uploads', m.stored_name)); } catch { /* ignore */ }
  audit(a, 'media.delete', 'media', id, undefined, c.ip); return { ok: true };
});

// ---------- taxonomy ----------
GET('/api/admin/taxonomy', (c) => { need(c, 'admin.access'); return { subjects: all('SELECT * FROM subjects ORDER BY sort_order'), topics: all('SELECT * FROM topics ORDER BY grade_id,sort_order') }; });
const SubjectSchema = z.object({ slug: z.string().regex(/^[a-z0-9-]{2,40}$/), nameUz: z.string().min(1), nameRu: z.string().min(1), nameEn: z.string().min(1), isCore: z.boolean().optional(), sortOrder: z.number().int().optional() });
POST('/api/admin/subjects', (c) => {
  const a = need(c, 'taxonomy.manage'); const b = parse(SubjectSchema, c.body);
  const r = run('INSERT INTO subjects(slug,name_uz,name_ru,name_en,is_core,sort_order) VALUES(?,?,?,?,?,?)', b.slug, b.nameUz, b.nameRu, b.nameEn, b.isCore ? 1 : 0, b.sortOrder ?? 99);
  audit(a, 'subject.create', 'subject', Number(r.lastInsertRowid), b, c.ip); return { id: Number(r.lastInsertRowid) };
});
PUT('/api/admin/subjects/:id', (c) => {
  const a = need(c, 'taxonomy.manage'); const b = parse(SubjectSchema.omit({ slug: true }), c.body);
  run('UPDATE subjects SET name_uz=?,name_ru=?,name_en=?,is_core=?,sort_order=? WHERE id=?', b.nameUz, b.nameRu, b.nameEn, b.isCore ? 1 : 0, b.sortOrder ?? 99, intp(c.params.id));
  audit(a, 'subject.update', 'subject', c.params.id, b, c.ip); return { ok: true };
});
DEL('/api/admin/subjects/:id', (c) => {
  const a = need(c, 'taxonomy.manage'); const id = intp(c.params.id);
  if (get('SELECT 1 FROM content_subjects WHERE subject_id=? LIMIT 1', id)) throw new HttpError(409, 'subject_in_use');
  run('DELETE FROM subjects WHERE id=?', id); audit(a, 'subject.delete', 'subject', id, undefined, c.ip); return { ok: true };
});
const TopicSchema = z.object({ gradeId: z.number().int().min(5).max(6), slug: z.string().regex(/^[a-z0-9-]{2,70}$/), sectionUz: z.string().optional(), sectionRu: z.string().optional(), sectionEn: z.string().optional(),
  titleUz: z.string().min(1), titleRu: z.string().optional(), titleEn: z.string().optional(), sortOrder: z.number().int().optional(), isVerified: z.boolean().optional() });
POST('/api/admin/topics', (c) => {
  const a = need(c, 'taxonomy.manage'); const b = parse(TopicSchema, c.body);
  // rasmiy dasturga moslikni faqat vakolatli shaxs belgilaydi
  const verified = b.isVerified && can(a.role, 'content.approve') ? 1 : 0;
  const r = run('INSERT INTO topics(grade_id,slug,section_uz,section_ru,section_en,title_uz,title_ru,title_en,sort_order,is_verified) VALUES(?,?,?,?,?,?,?,?,?,?)',
    b.gradeId, b.slug, b.sectionUz ?? null, b.sectionRu ?? null, b.sectionEn ?? null, b.titleUz, b.titleRu ?? null, b.titleEn ?? null, b.sortOrder ?? 99, verified);
  audit(a, 'topic.create', 'topic', Number(r.lastInsertRowid), b, c.ip); return { id: Number(r.lastInsertRowid) };
});
PUT('/api/admin/topics/:id', (c) => {
  const a = need(c, 'taxonomy.manage'); const b = parse(TopicSchema.omit({ slug: true, gradeId: true }), c.body);
  const verified = b.isVerified && can(a.role, 'content.approve') ? 1 : 0;
  run('UPDATE topics SET section_uz=?,section_ru=?,section_en=?,title_uz=?,title_ru=?,title_en=?,sort_order=?,is_verified=? WHERE id=?',
    b.sectionUz ?? null, b.sectionRu ?? null, b.sectionEn ?? null, b.titleUz, b.titleRu ?? null, b.titleEn ?? null, b.sortOrder ?? 99, verified, intp(c.params.id));
  audit(a, 'topic.update', 'topic', c.params.id, b, c.ip); return { ok: true };
});
DEL('/api/admin/topics/:id', (c) => {
  const a = need(c, 'taxonomy.manage'); const id = intp(c.params.id);
  run('DELETE FROM topics WHERE id=?', id); audit(a, 'topic.delete', 'topic', id, undefined, c.ip); return { ok: true };
});

// ---------- navigatsiya ----------
GET('/api/admin/nav', (c) => { need(c, 'nav.manage'); return all('SELECT * FROM nav_items ORDER BY COALESCE(parent_id,id), parent_id IS NOT NULL, sort_order, id'); });
const NavSchema = z.object({ parentId: z.number().int().nullable().optional(), key: z.string().regex(/^[a-z0-9_.-]{2,50}$/), path: z.string().max(200).nullable().optional(), icon: z.string().max(40).nullable().optional(),
  labelUz: z.string().min(1).max(80), labelRu: z.string().min(1).max(80), labelEn: z.string().min(1).max(80), sortOrder: z.number().int().optional(), isVisible: z.boolean().optional() });
POST('/api/admin/nav', (c) => {
  const a = need(c, 'nav.manage'); const b = parse(NavSchema, c.body);
  const r = run('INSERT INTO nav_items(parent_id,key,path,icon,label_uz,label_ru,label_en,sort_order,is_visible) VALUES(?,?,?,?,?,?,?,?,?)', b.parentId ?? null, b.key, b.path ?? null, b.icon ?? null, b.labelUz, b.labelRu, b.labelEn, b.sortOrder ?? 99, b.isVisible === false ? 0 : 1);
  audit(a, 'nav.create', 'nav', Number(r.lastInsertRowid), b, c.ip); return { id: Number(r.lastInsertRowid) };
});
PUT('/api/admin/nav/:id', (c) => {
  const a = need(c, 'nav.manage'); const b = parse(NavSchema.omit({ key: true }), c.body);
  if (b.parentId === intp(c.params.id)) throw new HttpError(400, 'invalid_parent');
  run('UPDATE nav_items SET parent_id=?,path=?,icon=?,label_uz=?,label_ru=?,label_en=?,sort_order=?,is_visible=? WHERE id=?', b.parentId ?? null, b.path ?? null, b.icon ?? null, b.labelUz, b.labelRu, b.labelEn, b.sortOrder ?? 99, b.isVisible === false ? 0 : 1, intp(c.params.id));
  audit(a, 'nav.update', 'nav', c.params.id, b, c.ip); return { ok: true };
});
DEL('/api/admin/nav/:id', (c) => { const a = need(c, 'nav.manage'); run('DELETE FROM nav_items WHERE id=?', intp(c.params.id)); audit(a, 'nav.delete', 'nav', c.params.id, undefined, c.ip); return { ok: true }; });

// ---------- tarjimalar (markazlashgan interfeys matnlari) ----------
GET('/api/admin/i18n', (c) => { need(c, 'i18n.manage'); return all('SELECT key,lang,value,updated_at FROM translations ORDER BY key,lang'); });
PUT('/api/admin/i18n', (c) => {
  const a = need(c, 'i18n.manage'); const b = parse(z.object({ key: z.string().regex(/^[a-zA-Z0-9_.-]{1,100}$/), lang: z.enum(LANGS), value: z.string().max(1000) }), c.body);
  if (!b.value) run('DELETE FROM translations WHERE key=? AND lang=?', b.key, b.lang);
  else run(`INSERT INTO translations(key,lang,value) VALUES(?,?,?) ON CONFLICT(key,lang) DO UPDATE SET value=excluded.value, updated_at=datetime('now')`, b.key, b.lang, b.value);
  audit(a, 'i18n.update', 'translation', b.key + ':' + b.lang, undefined, c.ip); return { ok: true };
});

// ---------- sozlamalar va bosh sahifa ----------
function lum(hex: string) { const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
function contrast(a: string, b: string) { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); }
const SETTING_KEYS = ['brand_primary_light', 'brand_primary_dark', 'site_name_uz', 'site_name_ru', 'site_name_en', 'tagline_uz', 'tagline_ru', 'tagline_en', 'default_lang', 'demo_banner', 'contact_email', 'studio_allowed_hosts', 'home_config'];
GET('/api/admin/settings', (c) => { need(c, 'settings.manage'); return Object.fromEntries(all('SELECT key,value FROM platform_settings').map(r => [r.key, r.value])); });
PUT('/api/admin/settings', (c) => {
  const a = need(c, 'settings.manage'); const b = parse(z.record(z.string(), z.string().max(5000)), c.body);
  tx(() => { for (const [k, v] of Object.entries(b)) {
    if (!SETTING_KEYS.includes(k)) throw new HttpError(400, 'unknown_setting', k);
    if (k === 'default_lang' && !isLang(v)) throw new HttpError(400, 'invalid_lang');
    if (k === 'studio_allowed_hosts' && v.trim() && parseHosts(v).length !== v.split(/[\s,]+/).filter(Boolean).length) throw new HttpError(400, 'invalid_hosts');
    if (k === 'home_config') { if (!safeParse(v)) throw new HttpError(400, 'invalid_json'); }
    if (k === 'brand_primary_light' || k === 'brand_primary_dark') {
      if (v !== '') {
        if (!/^#[0-9a-fA-F]{6}$/.test(v)) throw new HttpError(400, 'invalid_color');
        // WCAG AA: matn rangi fon bilan kamida 4.5:1 kontrast berishi kerak (yorug' mavzuda oq fonda, tungi mavzuda to'q fonda)
        const bg = k === 'brand_primary_light' ? '#ffffff' : '#16233a';
        if (contrast(v, bg) < 4.5) throw new HttpError(400, 'low_contrast', `kontrast ${contrast(v, bg).toFixed(2)}:1 < 4.5:1`);
      }
    }
    run(`INSERT INTO platform_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')`, k, v);
  } });
  audit(a, 'settings.update', 'settings', undefined, Object.keys(b), c.ip); return { ok: true };
});
PUT('/api/admin/home', (c) => {
  const a = need(c, 'home.manage'); const b = parse(z.object({ featuredLessonSlugs: z.array(z.string()).max(12), methodSlugs: z.array(z.string()).max(12) }), c.body);
  run(`INSERT INTO platform_settings(key,value) VALUES('home_config',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')`, JSON.stringify(b));
  audit(a, 'home.update', 'settings', 'home_config', b, c.ip); return { ok: true };
});

// ---------- e'lonlar ----------
const AnnSchema = z.object({ titleUz: z.string().min(1).max(200), titleRu: z.string().max(200).optional(), titleEn: z.string().max(200).optional(),
  bodyUz: z.string().max(4000).optional(), bodyRu: z.string().max(4000).optional(), bodyEn: z.string().max(4000).optional(), status: z.enum(['draft', 'published', 'archived']).optional(), isDemo: z.boolean().optional() });
GET('/api/admin/announcements', (c) => { need(c, 'announcements.manage'); return all('SELECT * FROM announcements ORDER BY id DESC LIMIT 100'); });
POST('/api/admin/announcements', (c) => {
  const a = need(c, 'announcements.manage'); const b = parse(AnnSchema, c.body);
  const r = run(`INSERT INTO announcements(title_uz,title_ru,title_en,body_uz,body_ru,body_en,status,is_demo,author_id,published_at) VALUES(?,?,?,?,?,?,?,?,?,CASE WHEN ?='published' THEN datetime('now') END)`,
    b.titleUz, b.titleRu ?? null, b.titleEn ?? null, b.bodyUz ?? null, b.bodyRu ?? null, b.bodyEn ?? null, b.status ?? 'draft', b.isDemo ? 1 : 0, a.id, b.status ?? 'draft');
  audit(a, 'announcement.create', 'announcement', Number(r.lastInsertRowid), undefined, c.ip); return { id: Number(r.lastInsertRowid) };
});
PUT('/api/admin/announcements/:id', (c) => {
  const a = need(c, 'announcements.manage'); const b = parse(AnnSchema, c.body); const id = intp(c.params.id);
  run(`UPDATE announcements SET title_uz=?,title_ru=?,title_en=?,body_uz=?,body_ru=?,body_en=?,status=?,is_demo=?,published_at=CASE WHEN ?='published' AND published_at IS NULL THEN datetime('now') ELSE published_at END WHERE id=?`,
    b.titleUz, b.titleRu ?? null, b.titleEn ?? null, b.bodyUz ?? null, b.bodyRu ?? null, b.bodyEn ?? null, b.status ?? 'draft', b.isDemo ? 1 : 0, b.status ?? 'draft', id);
  audit(a, 'announcement.update', 'announcement', id, undefined, c.ip); return { ok: true };
});
DEL('/api/admin/announcements/:id', (c) => { const a = need(c, 'announcements.manage'); run('DELETE FROM announcements WHERE id=?', intp(c.params.id)); audit(a, 'announcement.delete', 'announcement', c.params.id, undefined, c.ip); return { ok: true }; });

// ---------- foydalanuvchilar ----------
const roleLevel = (k: string) => ROLES.find(r => r.key === k)?.level ?? 0;
function canManageRole(a: Actor, target: string) { return a.role === 'super_admin' || roleLevel(target) < roleLevel(a.role); }
GET('/api/admin/users', (c) => {
  need(c, 'users.read');
  return all(`SELECT u.id,u.email,u.full_name,u.is_active,u.created_at,r.key role, r.name role_name FROM users u JOIN roles r ON r.id=u.role_id ORDER BY u.id DESC LIMIT 500`);
});
const UserSchema = z.object({ email: z.string().email().max(200), fullName: z.string().min(2).max(120), role: z.enum(ROLES.map(r => r.key) as [RoleKey, ...RoleKey[]]), password: z.string().max(200).optional(), isActive: z.boolean().optional() });
POST('/api/admin/users', (c) => {
  const a = need(c, 'users.manage'); const b = parse(UserSchema, c.body);
  if (!canManageRole(a, b.role)) throw new HttpError(403, 'role_not_allowed');
  if (!b.password) throw new HttpError(400, 'password_required');
  const prob = passwordProblem(b.password); if (prob) throw new HttpError(400, prob);
  if (get('SELECT 1 FROM users WHERE email=?', b.email)) throw new HttpError(409, 'email_exists');
  const r = run('INSERT INTO users(email,password_hash,full_name,role_id) VALUES(?,?,?,(SELECT id FROM roles WHERE key=?))', b.email, hashPassword(b.password), b.fullName, b.role);
  audit(a, 'user.create', 'user', Number(r.lastInsertRowid), { email: b.email, role: b.role }, c.ip); return { id: Number(r.lastInsertRowid) };
});
PUT('/api/admin/users/:id', (c) => {
  const a = need(c, 'users.manage'); const id = intp(c.params.id); const b = parse(UserSchema.partial(), c.body);
  const target = get('SELECT u.id, r.key role FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=?', id); if (!target) throw new HttpError(404, 'not_found');
  if (!canManageRole(a, target.role)) throw new HttpError(403, 'role_not_allowed');
  if (b.role && !canManageRole(a, b.role)) throw new HttpError(403, 'role_not_allowed');
  if (id === a.id && (b.isActive === false || (b.role && b.role !== a.role))) throw new HttpError(400, 'cannot_modify_self');
  if (b.password) { const prob = passwordProblem(b.password); if (prob) throw new HttpError(400, prob); run('UPDATE users SET password_hash=? WHERE id=?', hashPassword(b.password), id); run('DELETE FROM sessions WHERE user_id=?', id); }
  if (b.fullName) run('UPDATE users SET full_name=? WHERE id=?', b.fullName, id);
  if (b.role) run('UPDATE users SET role_id=(SELECT id FROM roles WHERE key=?) WHERE id=?', b.role, id);
  if (b.isActive !== undefined) { run('UPDATE users SET is_active=? WHERE id=?', b.isActive ? 1 : 0, id); if (!b.isActive) run('DELETE FROM sessions WHERE user_id=?', id); }
  run("UPDATE users SET updated_at=datetime('now') WHERE id=?", id);
  audit(a, 'user.update', 'user', id, { ...b, password: b.password ? '***' : undefined }, c.ip); return { ok: true };
});
GET('/api/admin/roles', (c) => {
  need(c, 'users.read');
  return ROLES.map(r => ({ ...r, permissions: all('SELECT p.key FROM role_permissions rp JOIN roles ro ON ro.id=rp.role_id JOIN permissions p ON p.id=rp.permission_id WHERE ro.key=? ORDER BY p.key', r.key).map(x => x.key) }));
});

// ---------- audit, zaxira ----------
GET('/api/admin/audit', (c) => {
  need(c, 'audit.read'); const s = c.url.searchParams; const where: string[] = []; const p: any[] = [];
  if (s.get('action')) { where.push('action LIKE ?'); p.push(s.get('action') + '%'); }
  if (s.get('actor')) { where.push('actor_email LIKE ?'); p.push('%' + s.get('actor') + '%'); }
  const page = Math.max(1, intp(s.get('page') ?? '1')); const W = where.length ? 'WHERE ' + where.join(' AND ') : '';
  return { total: get(`SELECT COUNT(*) n FROM audit_logs ${W}`, ...p)!.n, items: all(`SELECT * FROM audit_logs ${W} ORDER BY id DESC LIMIT 50 OFFSET ?`, ...p, (page - 1) * 50), page };
});
GET('/api/admin/export', (c) => {
  const a = need(c, 'backup.export');
  const tables = ['grades', 'subjects', 'topics', 'content_items', 'content_translations', 'content_subjects', 'content_methods', 'assessments', 'questions', 'interactive_projects', 'project_versions', 'announcements', 'nav_items', 'translations', 'platform_settings', 'media_assets'];
  const dump: Record<string, unknown> = { exportedAt: new Date().toISOString(), format: 'tabiiy-fan-export-v1' };
  for (const t of tables) dump[t] = all(`SELECT * FROM ${t}`);
  dump.users = all('SELECT u.id,u.email,u.full_name,r.key role,u.is_active,u.created_at FROM users u JOIN roles r ON r.id=u.role_id');
  audit(a, 'backup.export', 'system', undefined, undefined, c.ip);
  const body = JSON.stringify(dump);
  c.res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="tabiiy-fan-export-${new Date().toISOString().slice(0, 10)}.json"`, 'Cache-Control': 'no-store' });
  c.res.end(body);
});
export { snapshot };

// ---------- HTML Studio: jonli preview (srcdoc ota CSP ni meros qilgani uchun alohida manzildan beriladi) ----------
// Kod serverda BAJARILMAYDI: faqat vaqtincha saqlanib, sandbox + CSP sarlavhalari bilan qaytariladi.
import { buildDocument, buildCsp } from './sandbox.js';
const previews = new Map<string, { uid: number; html: string; css: string; js: string; exp: number }>();
function purgePreviews() { const now = Date.now(); for (const [k, v] of previews) if (v.exp < now) previews.delete(k); }
POST('/api/studio/preview', (c) => {
  const a = need(c, 'studio.use');
  if (!rateLimit('preview:' + a.id, 600, 60_000)) throw new HttpError(429, 'too_many_requests');
  const b = parse(z.object({ html: z.string().max(400_000), css: z.string().max(200_000), js: z.string().max(400_000) }), c.body);
  purgePreviews();
  let mine = 0; for (const v of previews.values()) if (v.uid === a.id) mine++;
  if (mine >= 30) { for (const [k, v] of previews) if (v.uid === a.id) { previews.delete(k); break; } }
  const id = crypto.randomBytes(16).toString('hex');
  previews.set(id, { uid: a.id, ...b, exp: Date.now() + 10 * 60_000 });
  return { url: `/embed/preview/${id}` };
});
GET('/embed/preview/:id', (c) => {
  const a = need(c, 'studio.use');
  const p = previews.get(c.params.id);
  if (!p || p.uid !== a.id || p.exp < Date.now()) throw new HttpError(404, 'not_found');
  const hosts = hostsNow();
  c.res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': buildCsp(hosts) + '; sandbox allow-scripts' });
  c.res.end(buildDocument(p, hosts, 'Preview'));
});

// ---------- umumiy versiyalar tarixi ----------
GET('/api/admin/versions', (c) => {
  need(c, 'content.read_all');
  return {
    content: all(`SELECT v.id,v.version_no,v.note,v.created_at,c.id content_id,c.kind,c.slug,u.full_name author,
        COALESCE((SELECT title FROM content_translations t WHERE t.content_id=c.id AND t.lang=c.source_lang), (SELECT title FROM content_translations t WHERE t.content_id=c.id LIMIT 1)) title
      FROM content_versions v JOIN content_items c ON c.id=v.content_id LEFT JOIN users u ON u.id=v.author_id ORDER BY v.id DESC LIMIT 100`),
    projects: all(`SELECT v.id,v.version_no,v.kind,v.note,v.created_at,p.id project_id,p.name,u.full_name author
      FROM project_versions v JOIN interactive_projects p ON p.id=v.project_id LEFT JOIN users u ON u.id=v.author_id WHERE v.kind!='autosave' ORDER BY v.id DESC LIMIT 100`),
  };
});
