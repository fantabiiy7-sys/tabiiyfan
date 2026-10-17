// Vizual bloklar → HTML/CSS/JS. Barcha matnlar escape qilinadi; URL lar faqat https:, data:image yoki #-havola bo'lishi mumkin.
export type BlockType = 'heading' | 'text' | 'image' | 'video' | 'html' | 'quiz' | 'animation' | 'file' | 'table' | 'columns';
export interface Blk {
  id: string; type: BlockType;
  text?: string; level?: number;            // heading, text
  url?: string; alt?: string; caption?: string; // image, video, file
  code?: string;                            // html
  q?: string; options?: string; correct?: number; checkText?: string; okText?: string; badText?: string; // quiz
  anim?: 'pulse' | 'spin' | 'fade' | 'slide'; label?: string; // animation
  rows?: string;                            // table
  left?: string; right?: string;            // columns
}
export const BLOCK_TYPES: BlockType[] = ['heading', 'text', 'image', 'video', 'html', 'quiz', 'animation', 'file', 'table', 'columns'];
export const esc = (s = '') => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
export const safeUrl = (u = '') => { const s = u.trim(); return /^(https:\/\/[^\s"'<>]+|data:(image\/(png|jpeg|gif|webp)|video\/(mp4|webm));base64,[a-z0-9+/=]+|#[\w-]*)$/i.test(s) ? s : ''; };
const para = (s = '') => s.split(/\n{2,}/).map(p => p.trim()).filter(Boolean).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('\n');

const BASE_CSS = `:root{--ink:#14233b;--muted:#4b5b73;--line:#cfd8e6;--bg:#fff;--soft:#f1f5fb;--pri:#1f5fa8}
body{background:var(--bg);color:var(--ink)}
.page{max-width:820px;margin:0 auto;padding:20px 16px}
.page>*{margin:0 0 18px}
h1,h2,h3{line-height:1.25}
img,video{max-width:100%;height:auto;border-radius:8px}
figure{margin:0}figcaption{color:var(--muted);font-size:.9rem;margin-top:6px}
table{border-collapse:collapse;width:100%}th,td{border:1px solid var(--line);padding:8px 10px;text-align:left}th{background:var(--soft)}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:20px}@media(max-width:560px){.cols{grid-template-columns:1fr}}
.quiz{border:1px solid var(--line);border-radius:10px;padding:14px 16px;background:var(--soft)}
.quiz label{display:block;padding:6px 0;cursor:pointer}.quiz button{background:var(--pri);color:#fff;border:0;border-radius:8px;padding:9px 16px;font:inherit;cursor:pointer;margin-top:8px}
.quiz .fb{margin:10px 0 0;font-weight:600}.quiz .fb.ok{color:#116b34}.quiz .fb.bad{color:#9b1c1c}
.anim{display:grid;place-items:center;min-height:120px;background:var(--soft);border-radius:10px;font-size:1.4rem;font-weight:700}
.anim span{display:inline-block;padding:14px 22px;background:var(--pri);color:#fff;border-radius:12px}
.a-pulse span{animation:pulse 1.6s ease-in-out infinite}.a-spin span{animation:spin 3s linear infinite}.a-fade span{animation:fade 2.2s ease-in-out infinite}.a-slide span{animation:slide 2.4s ease-in-out infinite}
@keyframes pulse{50%{transform:scale(1.15)}}@keyframes spin{to{transform:rotate(360deg)}}@keyframes fade{50%{opacity:.2}}@keyframes slide{50%{transform:translateX(60px)}}
@media(prefers-reduced-motion:reduce){.anim span{animation:none!important}}
.file a{display:inline-block;padding:8px 14px;border:1px solid var(--pri);border-radius:8px;color:var(--pri);font-weight:600;text-decoration:none}`;
const QUIZ_JS = `document.querySelectorAll('.quiz').forEach(function(q){var b=q.querySelector('button'),f=q.querySelector('.fb'),c=+q.getAttribute('data-correct');
b.addEventListener('click',function(){var s=q.querySelector('input:checked');if(!s){f.textContent=q.getAttribute('data-pick');f.className='fb';return}
var ok=+s.value===c;f.textContent=ok?q.getAttribute('data-ok'):q.getAttribute('data-bad');f.className='fb '+(ok?'ok':'bad')})});`;

export function compileBlocks(blocks: Blk[]): { html: string; css: string; js: string } {
  let hasQuiz = false;
  const out = blocks.map((b, i) => {
    switch (b.type) {
      case 'heading': { const l = Math.min(3, Math.max(1, b.level ?? 2)); return `<h${l}>${esc(b.text)}</h${l}>`; }
      case 'text': return para(b.text);
      case 'image': { const u = safeUrl(b.url); return u ? `<figure><img src="${esc(u)}" alt="${esc(b.alt)}">${b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : ''}</figure>` : `<!-- rasm: URL yaroqsiz -->`; }
      case 'video': { const u = safeUrl(b.url); return u ? `<figure><video src="${esc(u)}" controls preload="metadata" aria-label="${esc(b.alt || b.caption)}"></video>${b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : ''}</figure>` : `<!-- video: URL yaroqsiz -->`; }
      case 'html': return b.code ?? '';
      case 'quiz': {
        hasQuiz = true; const opts = (b.options ?? '').split('\n').map(s => s.trim()).filter(Boolean);
        return `<section class="quiz" data-correct="${b.correct ?? 0}" data-ok="${esc(b.okText)}" data-bad="${esc(b.badText)}" data-pick="${esc(b.checkText)}…"><h3>${esc(b.q)}</h3>\n${opts.map((o, k) => `<label><input type="radio" name="q${i}" value="${k}"> ${esc(o)}</label>`).join('\n')}\n<button type="button">${esc(b.checkText)}</button><p class="fb" role="status" aria-live="polite"></p></section>`;
      }
      case 'animation': return `<div class="anim a-${b.anim ?? 'pulse'}" role="img" aria-label="${esc(b.label)}"><span aria-hidden="true">${esc(b.label)}</span></div>`;
      case 'file': { const u = safeUrl(b.url); return u ? `<p class="file"><a href="${esc(u)}" download>${esc(b.label || b.url)}</a></p>` : `<!-- fayl: URL yaroqsiz -->`; }
      case 'table': {
        const rows = (b.rows ?? '').split('\n').map(r => r.trim()).filter(Boolean).map(r => r.split('|').map(c => c.trim())); if (!rows.length) return '';
        return `<table>${b.caption ? `<caption>${esc(b.caption)}</caption>` : ''}<thead><tr>${rows[0].map(c => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.slice(1).map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      }
      case 'columns': return `<div class="cols"><div>${para(b.left)}</div><div>${para(b.right)}</div></div>`;
    }
  }).filter(Boolean);
  return { html: `<main class="page">\n${out.join('\n')}\n</main>`, css: BASE_CSS, js: hasQuiz ? QUIZ_JS : '' };
}
