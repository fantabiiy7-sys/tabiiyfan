// Dars bo'limlari tuzilmasi (JSON bloklar) <-> oddiy matn formati. Muharrir matnni tahrirlaydi, bazaga bloklar saqlanadi.
// Format:  bo'sh qator — yangi paragraf | "- " — ro'yxat | "1. " — raqamli ro'yxat | "!> " — eslatma | "$$ " — formula
//          "| a | b |" qatorlari — jadval (birinchi qator sarlavha, "|---|" ajratgich ixtiyoriy)
//          "![alt](/media/x.png)" — rasm | "[[video:/media/x.mp4]]" — video | "[[file:/media/x.pdf|Nomi]]" — fayl
export type Blk = string | string[] | { ol: string[] } | { table: { head: string[]; rows: string[][] } } | { note: string } | { formula: string }
  | { image: { src: string; alt: string } } | { video: { src: string } } | { file: { src: string; label: string } };

export function blocksToText(blocks: Blk[] = []): string {
  return blocks.map(b => {
    if (typeof b === 'string') return b;
    if (Array.isArray(b)) return b.map(x => '- ' + x).join('\n');
    if ('ol' in b) return b.ol.map((x, i) => `${i + 1}. ${x}`).join('\n');
    if ('table' in b) return ['| ' + b.table.head.join(' | ') + ' |', '|' + b.table.head.map(() => '---').join('|') + '|', ...b.table.rows.map(r => '| ' + r.join(' | ') + ' |')].join('\n');
    if ('note' in b) return '!> ' + b.note;
    if ('formula' in b) return '$$ ' + b.formula;
    if ('image' in b) return `![${b.image.alt}](${b.image.src})`;
    if ('video' in b) return `[[video:${b.video.src}]]`;
    if ('file' in b) return `[[file:${b.file.src}|${b.file.label}]]`;
    return '';
  }).join('\n\n');
}

export function textToBlocks(text: string): Blk[] {
  const out: Blk[] = [];
  const chunks = text.replace(/\r\n/g, '\n').split(/\n{2,}/).map(c => c.trim()).filter(Boolean);
  for (const chunk of chunks) {
    const lines = chunk.split('\n').map(l => l.trimEnd());
    if (lines.every(l => /^\|.*\|$/.test(l.trim()))) {
      const cells = (l: string) => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const rows = lines.filter(l => !/^\|\s*:?-{2,}/.test(l.trim())).map(cells);
      if (rows.length) { out.push({ table: { head: rows[0], rows: rows.slice(1) } }); continue; }
    }
    if (lines.length === 1) {
      const l = lines[0]; let m: RegExpMatchArray | null;
      if ((m = l.match(/^!\[(.*)\]\((.+)\)$/))) { out.push({ image: { alt: m[1], src: m[2] } }); continue; }
      if ((m = l.match(/^\[\[video:(.+)\]\]$/))) { out.push({ video: { src: m[1] } }); continue; }
      if ((m = l.match(/^\[\[file:([^|\]]+)\|?(.*)\]\]$/))) { out.push({ file: { src: m[1], label: m[2] || m[1] } }); continue; }
    }
    if (lines.every(l => l.startsWith('- '))) { out.push(lines.map(l => l.slice(2))); continue; }
    if (lines.every(l => /^\d+\.\s/.test(l))) { out.push({ ol: lines.map(l => l.replace(/^\d+\.\s/, '')) }); continue; }
    if (lines.every(l => l.startsWith('!> '))) { out.push({ note: lines.map(l => l.slice(3)).join(' ') }); continue; }
    if (lines.every(l => l.startsWith('$$ '))) { out.push({ formula: lines.map(l => l.slice(3)).join('\n') }); continue; }
    // aralash: paragraf + ro'yxat bir chunkda bo'lsa, alohida bloklarga ajratamiz
    let buf: string[] = [];
    const flush = () => { if (buf.length) { out.push(buf.join(' ')); buf = []; } };
    let list: string[] = [];
    const flushList = () => { if (list.length) { out.push(list); list = []; } };
    for (const l of lines) { if (l.startsWith('- ')) { flush(); list.push(l.slice(2)); } else { flushList(); buf.push(l); } }
    flush(); flushList();
  }
  return out;
}

// Xavfsiz URL: faqat platformaning /media/ manzillari yoki https
export const safeUrl = (u: string) => /^\/media\/[A-Za-z0-9._-]+$/.test(u) || /^https:\/\/[^\s"'<>]+$/.test(u);
