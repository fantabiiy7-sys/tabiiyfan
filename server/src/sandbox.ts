// HTML Studio xavfsizligi: CSP yaratish va kodni statik skanerlash.
// Kod hech qachon serverda bajarilmaydi. Preview va nashr etilgan material sandboxlangan iframe (allow-scripts, allow-same-origin YO'Q) ichida ishlaydi.
export interface Finding { level: 'block' | 'warn'; code: string; message: string }

export const IFRAME_SANDBOX = 'allow-scripts';

export function parseHosts(s: string | undefined): string[] {
  return (s ?? '').split(/[\s,]+/).map(x => x.trim().toLowerCase()).filter(h => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(h));
}

export function buildCsp(allowedHosts: string[]): string {
  const hosts = allowedHosts.map(h => `https://${h}`).join(' ');
  return [
    "default-src 'none'",
    `script-src 'unsafe-inline' ${hosts}`.trim(),
    "style-src 'unsafe-inline'",
    `img-src data: blob: ${hosts}`.trim(),
    `media-src data: blob: ${hosts}`.trim(),
    "font-src data:",
    "connect-src 'none'",
    "frame-src 'none'",
    "object-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
  ].join('; ');
}

export function buildDocument(p: { html: string; css: string; js: string }, allowedHosts: string[], title = 'Preview'): string {
  const csp = buildCsp(allowedHosts);
  const safeJs = p.js.replace(/<\/script/gi, '<\\/script');
  const safeCss = p.css.replace(/<\/style/gi, '<\\/style');
  return `<!doctype html><html lang="uz"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title.replace(/[<>&"]/g, '')}</title>
<style>html,body{margin:0;padding:0}body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.5}${safeCss}</style>
</head><body>${p.html}
<script>window.addEventListener('error',function(e){try{parent.postMessage({__studio:'error',message:String(e.message),line:e.lineno,col:e.colno},'*')}catch(_){}});
window.addEventListener('unhandledrejection',function(e){try{parent.postMessage({__studio:'error',message:'Promise: '+String(e.reason)},'*')}catch(_){}});</script>
<script>${safeJs}</script></body></html>`;
}

export function scanCode(p: { html: any; css: any; js: any }, allowedHosts: string[]): Finding[] {
  const out: Finding[] = [];
  const add = (level: Finding['level'], code: string, message: string) => { if (!out.some(f => f.code === code)) out.push({ level, code, message }); };
  const hostOf = (u: string) => { try { return new URL(u, 'https://x.invalid').host.toLowerCase(); } catch { return ''; } };
  const isAllowed = (u: string) => { const h = hostOf(u); return h !== 'x.invalid' && allowedHosts.includes(h); };
  const isExternal = (u: string) => /^(https?:)?\/\//i.test(u.trim());
  for (const m of p.html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']?([^"'\s>]+)/gi))
    if (isExternal(m[1]) && !isAllowed(m[1])) add('block', 'external-script', `Ruxsat etilmagan tashqi skript: ${m[1]}`);
  for (const m of p.html.matchAll(/<(iframe|frame|object|embed)\b/gi)) add('block', 'embed-tag', `<${m[1]}> ruxsat etilmaydi`);
  if (/<form\b[^>]*\baction\s*=/i.test(p.html)) add('block', 'form-action', "<form action> ruxsat etilmaydi (ma'lumot yuborish bloklangan)");
  if (/<meta\b[^>]*http-equiv\s*=\s*["']?refresh/i.test(p.html)) add('block', 'meta-refresh', '<meta refresh> ruxsat etilmaydi');
  if (/<base\b/i.test(p.html)) add('block', 'base-tag', '<base> ruxsat etilmaydi');
  if (/<link\b[^>]*\bhref\s*=\s*["']?https?:/i.test(p.html)) add('block', 'external-link', 'Tashqi <link> resurslari bloklangan');
  if (/@import\s+(url\()?["']?https?:/i.test(p.css)) add('block', 'css-import', 'CSS @import orqali tashqi resurs ruxsat etilmaydi');
  for (const m of p.html.matchAll(/\son[a-z]+\s*=/gi)) { add('warn', 'inline-handler', 'Inline hodisa atributlari (onclick...) topildi — addEventListener tavsiya etiladi'); break; }
  if (/\beval\s*\(|new\s+Function\s*\(/.test(p.js)) add('warn', 'eval', 'eval / new Function ishlatilgan');
  if (/document\.cookie/.test(p.js)) add('warn', 'cookie', 'document.cookie sandboxda ishlamaydi');
  if (/\b(localStorage|sessionStorage|indexedDB)\b/.test(p.js)) add('warn', 'storage', 'Sandbox ichida brauzer xotirasi mavjud emas');
  if (/\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b/.test(p.js)) add('warn', 'network', "Tarmoq so'rovlari CSP tomonidan bloklanadi (connect-src 'none')");
  if (/\b(window\.)?(top|parent)\s*\.\s*(location|document|postMessage)/.test(p.js)) add('warn', 'frame-escape', "Ota oynaga murojaat sandbox tomonidan cheklanadi");
  if (/\bimport\s*\(|\bimport\s+.+from\s+["']https?:/.test(p.js)) add('block', 'dynamic-import', 'Tashqi modul import qilish ruxsat etilmaydi');
  if (/importScripts|new\s+Worker\s*\(/.test(p.js)) add('warn', 'worker', 'Worker ishlatilishi cheklangan');
  return out;
}
