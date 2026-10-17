// Tarjimalarni tekshiradi: (1) kodda ishlatilgan har bir t('kalit') uz lug'atida bor; (2) ru/en kalitlari uz bilan bir xil; (3) {o'zgaruvchi} lar mos.
import fs from 'node:fs'; import path from 'node:path'; import { build } from 'esbuild';
const root = path.resolve(import.meta.dirname, '..'); const src = path.join(root, 'web/src');
const tmp = path.join(root, 'data/.i18n-check'); fs.mkdirSync(tmp, { recursive: true });
const d = {}; for (const l of ['uz', 'ru', 'en']) { const f = path.join(tmp, l + '.mjs'); await build({ entryPoints: [path.join(src, 'i18n', l + '.ts')], outfile: f, format: 'esm', logLevel: 'silent' }); d[l] = (await import(f + '?' + Date.now()))[l]; }
let bad = 0; const err = m => { bad++; console.error('✖ ' + m); };
const keys = new Set(Object.keys(d.uz));
for (const l of ['ru', 'en']) { for (const k of keys) if (!(k in d[l])) err(`${l}: yetishmaydi — ${k}`); for (const k of Object.keys(d[l])) if (!keys.has(k)) err(`${l}: ortiqcha — ${k}`); }
const vars = s => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
for (const k of keys) for (const l of ['ru', 'en']) if (d[l][k] !== undefined && vars(d[l][k]) !== vars(d.uz[k])) err(`${l}: {o'zgaruvchilar} mos emas — ${k}`);
for (const k of keys) for (const l of ['uz', 'ru', 'en']) if (!String(d[l][k] ?? '').trim()) err(`${l}: bo'sh — ${k}`);
const files = []; (function walk(p) { for (const e of fs.readdirSync(p, { withFileTypes: true })) { const f = path.join(p, e.name); if (e.isDirectory()) { if (e.name !== 'i18n') walk(f); } else if (/\.tsx?$/.test(e.name)) files.push(f); } })(src);
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(/(?<![\w.$])t\(\s*(['"`])([^'"`$]+)\1\s*[,)+]/g)) {
    const k = m[2]; if (k.startsWith('/')) continue;
    if (/\.$/.test(k)) { if (![...keys].some(x => x.startsWith(k))) err(`${path.relative(root, f)}: prefiks uchun kalit yo'q — ${k}`); }
    else if (!keys.has(k)) err(`${path.relative(root, f)}: lug'atda yo'q — ${k}`);
  }
}

// Dinamik kalitlar (kod ichida 'prefiks' + qiymat ko'rinishida yig'iladi)
const KINDS = ['lesson', 'method', 'lab', 'animation', 'video', 'ebook', 'assessment', 'project'];
const DYN = {
  'kind.': KINDS, 'status.': ['draft', 'in_review', 'approved', 'published', 'archived'], 'trstatus.': ['draft', 'machine', 'reviewed', 'final'], 'lang.': ['uz', 'ru', 'en'],
  'role.': ['super_admin', 'republic_editor', 'regional_moderator', 'district_moderator', 'school_admin', 'teacher', 'student', 'guest'],
  'lessonType.': ['new_knowledge', 'consolidation', 'lab', 'project', 'inquiry', 'integrated'], 'format.': ['html', 'pdf', 'video', 'text'],
  'lesson.sec.': Array.from({ length: 20 }, (_, i) => 's' + (i + 1)), 'method.sec.': ['purpose', 'applicability', 'steps', 'materials', 'timing', 'student', 'teacher', 'assessment'],
  'sec.': ['goal', 'howto', 'limits', 'stages', 'outcomes', 'assessment', 'description'], 'hist.note.': ['created', 'edited'],
  'admin.n.': [...KINDS.filter(k => k !== 'lesson'), 'lessons', 'dashboard', 'moderation', 'taxonomy', 'integration', 'news', 'media', 'home', 'nav', 'i18n', 'settings', 'users', 'roles', 'audit', 'versions', 'backup'],
  'studio.anim.': ['pulse', 'spin', 'fade', 'slide'], 'studio.block.': ['heading', 'text', 'image', 'video', 'html', 'quiz', 'animation', 'file', 'table', 'columns'],
  'studio.device.': ['desktop', 'tablet', 'mobile'], 'studio.kind.': ['manual', 'autosave', 'published'], 'studio.mode.': ['code', 'blocks'], 'studio.view.': ['code', 'split', 'preview'],
};
for (const [p, vs] of Object.entries(DYN)) for (const v of vs) if (!keys.has(p + v)) err(`dinamik kalit yo'q — ${p}${v}`);
for (const k of KINDS) for (const x of ['plural', 'lead']) if (!keys.has(`kind.${k}.${x}`)) err(`yo'q — kind.${k}.${x}`);
for (const [a, b] of [['draft', 'in_review'], ['in_review', 'draft'], ['in_review', 'approved'], ['approved', 'published'], ['published', 'archived'], ['draft', 'archived'], ['archived', 'draft'], ['published', 'draft']]) if (!keys.has(`admin.to.${a}.${b}`)) err(`yo'q — admin.to.${a}.${b}`);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(bad ? `\n${bad} ta muammo` : `✔ ${keys.size} kalit, 3 til mos`); process.exit(bad ? 1 : 0);
