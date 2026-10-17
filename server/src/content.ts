import { all, get, run, tx, type Row } from './db.js';
import { HttpError } from './auth.js';
import type { Status } from './permissions.js';

export const KINDS = ['lesson', 'method', 'lab', 'animation', 'video', 'ebook', 'assessment', 'project'] as const;
export type Kind = (typeof KINDS)[number];
export const LANGS = ['uz', 'ru', 'en'] as const;
export type Lang = (typeof LANGS)[number];
export const isLang = (x: any): x is Lang => LANGS.includes(x);

export function getSetting(key: string, fallback = ''): string {
  return get('SELECT value FROM platform_settings WHERE key=?', key)?.value ?? fallback;
}
export const defaultLang = (): Lang => { const l = getSetting('default_lang', 'uz'); return isLang(l) ? l : 'uz'; };

export function slugify(s: string): string {
  const map: Record<string, string> = { "o‘": 'o', "g‘": 'g', "oʻ": 'o', "gʻ": 'g', 'ў': 'u', 'қ': 'q', 'ғ': 'g', 'ҳ': 'h' };
  let t = s.toLowerCase();
  for (const [k, v] of Object.entries(map)) t = t.split(k).join(v);
  const ru: Record<string, string> = { а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sch',ы:'y',э:'e',ю:'yu',я:'ya' };
  t = t.replace(/[а-яё]/g, c => ru[c] ?? '');
  return t.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'item';
}
export function uniqueSlug(base: string): string {
  let s = slugify(base), i = 2;
  while (get('SELECT 1 FROM content_items WHERE slug=?', s)) s = `${slugify(base)}-${i++}`;
  return s;
}

export interface ListQuery {
  kind?: string; grade?: number; topic?: string; subject?: string; q?: string; lang: Lang;
  lessonType?: string; method?: string; format?: string; section?: string; status?: string;
  admin?: boolean; page: number; pageSize: number; demo?: boolean; sort?: string;
}

const like = (s: string) => '%' + s.replace(/[\\%_]/g, m => '\\' + m) + '%';

function pickTranslation(trs: Row[], lang: Lang) {
  const dl = defaultLang();
  const tr = trs.find(t => t.lang === lang) ?? trs.find(t => t.lang === dl) ?? trs[0];
  return { tr, fallback: !!tr && tr.lang !== lang };
}

export function listContent(q: ListQuery) {
  const where: string[] = []; const p: any[] = [];
  if (!q.admin) { where.push("c.status='published'", 'c.is_hidden=0'); }
  else if (q.status) { where.push('c.status=?'); p.push(q.status); }
  if (q.kind && (KINDS as readonly string[]).includes(q.kind)) { where.push('c.kind=?'); p.push(q.kind); }
  if (q.grade) { where.push('(c.grade_id=? OR c.grade_id IS NULL)'); p.push(q.grade); }
  if (q.topic) { where.push('c.topic_id=(SELECT id FROM topics WHERE slug=?)'); p.push(q.topic); }
  if (q.section) { where.push('c.topic_id IN (SELECT id FROM topics WHERE section_uz=?)'); p.push(q.section); }
  if (q.subject) { where.push('EXISTS (SELECT 1 FROM content_subjects cs JOIN subjects s ON s.id=cs.subject_id WHERE cs.content_id=c.id AND s.slug=?)'); p.push(q.subject); }
  if (q.method) { where.push('EXISTS (SELECT 1 FROM content_methods cm JOIN content_items m ON m.id=cm.method_id WHERE cm.content_id=c.id AND m.slug=?)'); p.push(q.method); }
  if (q.lessonType) { where.push('c.lesson_type=?'); p.push(q.lessonType); }
  if (q.format) { where.push('c.format=?'); p.push(q.format); }
  if (q.demo !== undefined) { where.push('c.is_demo=?'); p.push(q.demo ? 1 : 0); }
  if (q.q?.trim()) {
    const l = like(q.q.trim().slice(0, 80));
    where.push(`(EXISTS (SELECT 1 FROM content_translations t WHERE t.content_id=c.id AND (t.title LIKE ? ESCAPE '\\' OR t.summary LIKE ? ESCAPE '\\' OR t.keywords LIKE ? ESCAPE '\\'))
      OR c.topic_id IN (SELECT id FROM topics WHERE title_uz LIKE ? ESCAPE '\\' OR title_ru LIKE ? ESCAPE '\\' OR title_en LIKE ? ESCAPE '\\'))`);
    p.push(l, l, l, l, l, l);
  }
  const W = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = get(`SELECT COUNT(*) n FROM content_items c ${W}`, ...p)!.n as number;
  const order = q.sort === 'title' ? 'c.slug ASC' : q.sort === 'old' ? 'c.updated_at ASC' : 'c.updated_at DESC, c.id DESC';
  const rows = all(`SELECT c.* FROM content_items c ${W} ORDER BY ${order} LIMIT ? OFFSET ?`, ...p, q.pageSize, (q.page - 1) * q.pageSize);
  return { items: rows.map(r => shapeItem(r, q.lang)), total, page: q.page, pageSize: q.pageSize };
}

export function shapeItem(c: Row, lang: Lang) {
  const trs = all('SELECT lang,title,summary,keywords,translation_status,updated_at FROM content_translations WHERE content_id=?', c.id);
  const { tr, fallback } = pickTranslation(trs, lang);
  const topic = c.topic_id ? get('SELECT slug,title_uz,title_ru,title_en,section_uz,section_ru,section_en,is_verified FROM topics WHERE id=?', c.topic_id) : undefined;
  const subjects = all('SELECT s.slug,s.name_uz,s.name_ru,s.name_en FROM content_subjects cs JOIN subjects s ON s.id=cs.subject_id WHERE cs.content_id=? ORDER BY s.sort_order', c.id);
  return {
    id: c.id, slug: c.slug, kind: c.kind, grade: c.grade_id, status: c.status, isDemo: !!c.is_demo, isHidden: !!c.is_hidden,
    lessonType: c.lesson_type, durationMin: c.duration_min, format: c.format, sourceLang: c.source_lang,
    title: tr?.title ?? c.slug, summary: tr?.summary ?? '', keywords: tr?.keywords ?? '',
    lang: tr?.lang ?? null, isFallbackLang: fallback, availableLangs: trs.map(t => t.lang),
    translations: Object.fromEntries(trs.map(t => [t.lang, t.translation_status])),
    topic: topic ? { slug: topic.slug, title: topic['title_' + lang] || topic.title_uz, section: topic['section_' + lang] || topic.section_uz, verified: !!topic.is_verified } : null,
    subjects: subjects.map(s => ({ slug: s.slug, name: s['name_' + lang] })),
    hasProject: !!c.interactive_project_id && !!get("SELECT 1 FROM interactive_projects WHERE id=? AND status='published'", c.interactive_project_id),
    hasVideo: !!c.video_url, hasFile: !!c.file_asset_id,
    fileUrl: c.file_asset_id ? (() => { const m = get('SELECT stored_name FROM media_assets WHERE id=?', c.file_asset_id); return m ? '/media/' + m.stored_name : null; })() : null,
    updatedAt: c.updated_at, publishedAt: c.published_at,
  };
}

export function loadFull(c: Row, lang: Lang, admin: boolean) {
  const base = shapeItem(c, lang);
  const trs = all('SELECT * FROM content_translations WHERE content_id=?', c.id);
  const { tr } = pickTranslation(trs, lang);
  const methods = all(`SELECT m.id,m.slug FROM content_methods cm JOIN content_items m ON m.id=cm.method_id WHERE cm.content_id=? AND m.status='published'`, c.id)
    .map(m => shapeItem(get('SELECT * FROM content_items WHERE id=?', m.id)!, lang));
  const people = (id: number | null) => id ? get('SELECT id,full_name FROM users WHERE id=?', id) : undefined;
  let project: Row | undefined;
  if (c.interactive_project_id) {
    project = get('SELECT id,name,status,published_version_id FROM interactive_projects WHERE id=?', c.interactive_project_id);
    if (project && !admin && (project.status !== 'published' || !project.published_version_id)) project = undefined;
  }
  return {
    ...base,
    body: tr?.body ? safeParse(tr.body) : null,
    videoUrl: c.video_url,
    file: c.file_asset_id ? get('SELECT id,filename,mime,size,stored_name FROM media_assets WHERE id=?', c.file_asset_id) : null,
    project: project ? { id: project.id, name: project.name } : null,
    methods,
    author: people(c.author_id)?.full_name ?? null,
    reviewer: people(c.reviewer_id)?.full_name ?? null,
    approver: people(c.approver_id)?.full_name ?? null,
    translationsFull: admin ? Object.fromEntries(trs.map(t => [t.lang, { title: t.title, summary: t.summary, keywords: t.keywords, body: t.body ? safeParse(t.body) : null, status: t.translation_status, updatedAt: t.updated_at }])) : undefined,
    subjectIds: admin ? all('SELECT subject_id FROM content_subjects WHERE content_id=?', c.id).map(r => r.subject_id) : undefined,
    methodIds: admin ? all('SELECT method_id FROM content_methods WHERE content_id=?', c.id).map(r => r.method_id) : undefined,
    topicId: admin ? c.topic_id : undefined,
    interactiveProjectId: admin ? c.interactive_project_id : undefined,
    versionCount: (get('SELECT COUNT(*) n FROM content_versions WHERE content_id=?', c.id)?.n as number) ?? 0,
    sourceTranslationStatus: trs.find(t => t.lang === c.source_lang)?.translation_status ?? null,
  };
}
export function safeParse(s: string) { try { return JSON.parse(s); } catch { return null; } }

export interface ContentInput {
  kind: Kind; grade?: number | null; topicId?: number | null; lessonType?: string | null; durationMin?: number | null;
  format?: string | null; sourceLang?: Lang; videoUrl?: string | null; fileAssetId?: number | null; interactiveProjectId?: number | null;
  isDemo?: boolean; isHidden?: boolean; subjectIds?: number[]; methodIds?: number[];
  translations?: Partial<Record<Lang, { title: string; summary?: string; keywords?: string; body?: unknown; status?: string }>>;
}

export function snapshot(id: number) {
  const c = get('SELECT * FROM content_items WHERE id=?', id)!;
  return {
    item: c,
    translations: all('SELECT lang,title,summary,keywords,body,translation_status FROM content_translations WHERE content_id=?', id),
    subjects: all('SELECT subject_id FROM content_subjects WHERE content_id=?', id).map(r => r.subject_id),
    methods: all('SELECT method_id FROM content_methods WHERE content_id=?', id).map(r => r.method_id),
  };
}
export function saveVersion(id: number, authorId: number, note?: string) {
  const n = ((get('SELECT MAX(version_no) m FROM content_versions WHERE content_id=?', id)?.m as number) ?? 0) + 1;
  run('INSERT INTO content_versions(content_id,version_no,snapshot,author_id,note) VALUES(?,?,?,?,?)', id, n, JSON.stringify(snapshot(id)), authorId, note ?? null);
  return n;
}

export function writeContent(id: number | null, input: ContentInput, authorId: number): number {
  return tx(() => {
    let cid = id;
    const vals = [input.grade ?? null, input.topicId ?? null, input.lessonType ?? null, input.durationMin ?? null, input.format ?? null,
      input.sourceLang ?? 'uz', input.videoUrl ?? null, input.fileAssetId ?? null, input.interactiveProjectId ?? null, input.isDemo ? 1 : 0, input.isHidden ? 1 : 0];
    if (cid == null) {
      const firstTitle = Object.values(input.translations ?? {})[0]?.title ?? input.kind;
      const slug = uniqueSlug(input.translations?.[input.sourceLang ?? 'uz']?.title ?? firstTitle);
      const r = run(`INSERT INTO content_items(kind,slug,grade_id,topic_id,lesson_type,duration_min,format,source_lang,video_url,file_asset_id,interactive_project_id,is_demo,is_hidden,author_id)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, input.kind, slug, ...vals, authorId);
      cid = Number(r.lastInsertRowid);
    } else {
      run(`UPDATE content_items SET grade_id=?,topic_id=?,lesson_type=?,duration_min=?,format=?,source_lang=?,video_url=?,file_asset_id=?,interactive_project_id=?,is_demo=?,is_hidden=?,updated_at=datetime('now') WHERE id=?`, ...vals, cid);
    }
    if (input.translations) for (const [lang, t] of Object.entries(input.translations)) {
      if (!t) continue;
      run(`INSERT INTO content_translations(content_id,lang,title,summary,keywords,body,translation_status) VALUES(?,?,?,?,?,?,?)
        ON CONFLICT(content_id,lang) DO UPDATE SET title=excluded.title,summary=excluded.summary,keywords=excluded.keywords,body=excluded.body,translation_status=excluded.translation_status,updated_at=datetime('now')`,
        cid, lang, t.title, t.summary ?? null, t.keywords ?? null, t.body !== undefined ? JSON.stringify(t.body) : null, t.status ?? 'draft');
    }
    if (input.subjectIds) { run('DELETE FROM content_subjects WHERE content_id=?', cid); for (const s of new Set(input.subjectIds)) run('INSERT INTO content_subjects(content_id,subject_id) VALUES(?,?)', cid, s); }
    if (input.methodIds) { run('DELETE FROM content_methods WHERE content_id=?', cid); for (const m of new Set(input.methodIds)) run('INSERT INTO content_methods(content_id,method_id) VALUES(?,?)', cid, m); }
    saveVersion(cid, authorId, id == null ? 'created' : 'edited');
    return cid;
  });
}

export function changeStatus(id: number, to: Status, actorId: number, comment?: string) {
  const c = get('SELECT * FROM content_items WHERE id=?', id);
  if (!c) throw new HttpError(404, 'not_found');
  const from = c.status as Status;
  tx(() => {
    const sets = ["status=?", "updated_at=datetime('now')"]; const p: any[] = [to];
    if (to === 'approved') { sets.push('approver_id=?'); p.push(actorId); }
    if (to === 'in_review') { sets.push('reviewer_id=NULL', 'approver_id=NULL'); }
    if (to === 'published') { sets.push("published_at=datetime('now')"); if (!c.approver_id) { sets.push('approver_id=?'); p.push(actorId); } }
    run(`UPDATE content_items SET ${sets.join(',')} WHERE id=?`, ...p, id);
    if (to === 'draft' && from === 'in_review') run('UPDATE content_items SET reviewer_id=? WHERE id=?', actorId, id);
    run('INSERT INTO content_reviews(content_id,from_status,to_status,actor_id,comment) VALUES(?,?,?,?,?)', id, from, to, actorId, comment ?? null);
    saveVersion(id, actorId, `status: ${from} → ${to}`);
  });
  return { from, to };
}
