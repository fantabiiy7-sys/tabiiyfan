import { useEffect, useMemo, useRef } from 'react';
import hljs from 'highlight.js/lib/core';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import javascript from 'highlight.js/lib/languages/javascript';
hljs.registerLanguage('xml', xml); hljs.registerLanguage('css', css); hljs.registerLanguage('javascript', javascript);
const LANG = { html: 'xml', css: 'css', js: 'javascript' } as const;

// Yengil kod muharriri: shaffof textarea + ostidagi rangli <pre>. Undo/redo brauzerning o'z stekida ishlaydi (execCommand).
export function CodeBox({ value, kind, onChange, label, taRef, onSave, onRun, escHint }: { value: string; kind: 'html' | 'css' | 'js'; onChange: (v: string) => void; label: string; taRef: any; onSave?: () => void; onRun?: () => void; escHint: string }) {
  const pre = useRef<HTMLPreElement>(null); const gut = useRef<HTMLDivElement>(null); const escaped = useRef(false);
  const html = useMemo(() => { try { return hljs.highlight(value + '\n', { language: LANG[kind], ignoreIllegals: true }).value; } catch { return value.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string)); } }, [value, kind]);
  const lines = useMemo(() => { const n = value.split('\n').length; let s = ''; for (let i = 1; i <= n; i++) s += i + '\n'; return s; }, [value]);
  const sync = () => { const ta = taRef.current; if (!ta) return; if (pre.current) { pre.current.scrollTop = ta.scrollTop; pre.current.scrollLeft = ta.scrollLeft; } if (gut.current) gut.current.scrollTop = ta.scrollTop; };
  useEffect(sync, [value]);
  const onKey = (e: any) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); onSave?.(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); onRun?.(); return; }
    if (e.key === 'Escape') { escaped.current = true; return; }
    if (e.key === 'Tab' && !escaped.current && !e.shiftKey) { e.preventDefault(); document.execCommand('insertText', false, '  '); return; }
    if (e.key === 'Tab') { escaped.current = false; return; }       // Esc dan keyingi Tab fokusni chiqaradi (klaviatura tuzog'i yo'q)
    escaped.current = false;
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {                  // avtomatik chekinish
      const ta = e.target as HTMLTextAreaElement; const before = ta.value.slice(0, ta.selectionStart); const indent = /(^|\n)([ \t]*)[^\n]*$/.exec(before)?.[2] ?? '';
      if (indent) { e.preventDefault(); document.execCommand('insertText', false, '\n' + indent); }
    }
  };
  return (
    <div className="codebox">
      <div className="gutter" ref={gut} aria-hidden="true"><pre style={{ position: 'static', padding: 0, margin: 0, background: 'none', overflow: 'visible' }}>{lines}</pre></div>
      <pre ref={pre} aria-hidden="true"><code className="hljs" dangerouslySetInnerHTML={{ __html: html }} style={{ background: 'none', padding: 0 }} /></pre>
      <textarea ref={taRef} value={value} onChange={e => onChange(e.target.value)} onScroll={sync} onKeyDown={onKey} spellCheck={false} autoCapitalize="off" autoComplete="off" autoCorrect="off" aria-label={label} aria-describedby="code-esc-hint" wrap="off" />
      <span id="code-esc-hint" className="sr-only">{escHint}</span>
    </div>
  );
}
