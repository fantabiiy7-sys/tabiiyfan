export const cx = (...a: any[]) => a.filter(Boolean).join(' ');
export function parseDbDate(s?: string | null): Date | null { if (!s) return null; const d = new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z'); return isNaN(+d) ? null : d; }
const LOC: Record<string, string> = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-GB' };
export function fmtDate(s: string | null | undefined, lang: string, withTime = false) {
  const d = parseDbDate(s); if (!d) return '—';
  if (lang === 'uz') { // brauzerlarda uz-UZ oy nomlari bo'lmasligi mumkin
    const M = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
    const two = (n: number) => String(n).padStart(2, '0');
    return `${d.getDate()}-${M[d.getMonth()]}, ${d.getFullYear()}` + (withTime ? `, ${two(d.getHours())}:${two(d.getMinutes())}` : '');
  }
  try { return new Intl.DateTimeFormat(LOC[lang] ?? 'en-GB', { year: 'numeric', month: 'long', day: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) }).format(d); } catch { return d.toISOString().slice(0, 10); }
}
export function fmtBytes(n: number) { if (n < 1024) return n + ' B'; if (n < 1048576) return (n / 1024).toFixed(1) + ' KB'; return (n / 1048576).toFixed(1) + ' MB'; }
export function debounce<T extends (...a: any[]) => void>(fn: T, ms: number) { let h: any; const d = ((...a: any[]) => { clearTimeout(h); h = setTimeout(() => fn(...a), ms); }) as T & { cancel(): void }; d.cancel = () => clearTimeout(h); return d; }
export const KIND_PATH: Record<string, string> = { lesson: 'lessons', method: 'methods', lab: 'labs', animation: 'animations', video: 'videos', ebook: 'ebooks', assessment: 'tests', project: 'projects' };
export const PATH_KIND: Record<string, string> = Object.fromEntries(Object.entries(KIND_PATH).map(([k, v]) => [v, k]));
export const itemPath = (i: { kind: string; slug: string }) => `/${KIND_PATH[i.kind] ?? 'lessons'}/${i.slug}`;
export const safeLS = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  del(k: string) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};
