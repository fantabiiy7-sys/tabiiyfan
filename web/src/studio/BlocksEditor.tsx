import { useState } from 'react';
import { useApp } from '../lib/store';
import { get } from '../lib/api';
import { Icon, Field } from '../components/ui';
import { BLOCK_TYPES, type Blk, type BlockType, safeUrl } from './compile';

const ICON: Record<BlockType, string> = { heading: 'type', text: 'list', image: 'image', video: 'video', html: 'code', quiz: 'quiz', animation: 'sparkles', file: 'file', table: 'table', columns: 'columns' };
const uid = () => Math.random().toString(36).slice(2, 9);

export function BlocksEditor({ blocks, onChange, media }: { blocks: Blk[]; onChange: (b: Blk[]) => void; media: any[] }) {
  const { t, toast } = useApp(); const [add, setAdd] = useState<BlockType>('text');
  const fresh = (type: BlockType): Blk => ({ id: uid(), type, ...(({
    heading: { text: '', level: 2 }, text: { text: '' }, image: { url: '', alt: '', caption: '' }, video: { url: '', alt: '', caption: '' }, html: { code: '<p></p>' },
    quiz: { q: '', options: '\n', correct: 0, checkText: t('studio.q.check'), okText: t('studio.q.ok'), badText: t('studio.q.bad') },
    animation: { anim: 'pulse', label: '' }, file: { url: '', label: '' }, table: { rows: 'A | B\n1 | 2', caption: '' }, columns: { left: '', right: '' },
  } as any)[type]) });
  const upd = (i: number, p: Partial<Blk>) => onChange(blocks.map((b, j) => j === i ? { ...b, ...p } : b));
  const move = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= blocks.length) return; const c = [...blocks]; [c[i], c[j]] = [c[j], c[i]]; onChange(c); };
  const fromLibrary = async (i: number, id: string) => {
    const m = media.find(x => String(x.id) === id); if (!m) return;
    if (m.size > 350_000) { toast(t('studio.err.tooBig'), 'error'); return; }
    try {
      const blob = await (await fetch('/media/' + m.stored_name)).blob();
      const url: string = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(blob); });
      upd(i, { url, alt: blocks[i].alt || m.alt_uz || '' }); toast(t('studio.embedded'), 'info');
    } catch { toast(t('state.error'), 'error'); }
  };
  return (
    <div className="blocks-wrap">
      <div className="callout" role="note"><Icon name="info" size={18} /><div>{t('studio.blocksNote')}</div></div>
      {!blocks.length && <p className="muted">{t('studio.noBlocks')}</p>}
      {blocks.map((b, i) => {
        const id = (s: string) => `b${b.id}-${s}`;
        return (
          <section className="blk" key={b.id} aria-label={`${i + 1}. ${t('studio.block.' + b.type)}`}>
            <div className="blk-head"><Icon name={ICON[b.type]} size={16} /><strong>{i + 1}. {t('studio.block.' + b.type)}</strong><span style={{ flex: 1 }} />
              <button className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label={t('studio.moveUp')}><Icon name="arrow-up" size={16} /></button>
              <button className="icon-btn" disabled={i === blocks.length - 1} onClick={() => move(i, 1)} aria-label={t('studio.moveDown')}><Icon name="arrow-down" size={16} /></button>
              <button className="icon-btn" onClick={() => onChange([...blocks.slice(0, i + 1), { ...b, id: uid() }, ...blocks.slice(i + 1)])} aria-label={t('studio.duplicate')}><Icon name="copy" size={16} /></button>
              <button className="icon-btn" onClick={() => onChange(blocks.filter((_, j) => j !== i))} aria-label={t('common.delete')}><Icon name="trash" size={16} /></button></div>
            <div className="blk-body">
              {b.type === 'heading' && <><Field label={t('admin.text')} htmlFor={id('t')}><input id={id('t')} value={b.text ?? ''} onChange={e => upd(i, { text: e.target.value })} /></Field>
                <Field label={t('studio.level')} htmlFor={id('l')}><select id={id('l')} value={b.level} onChange={e => upd(i, { level: +e.target.value })}>{[1, 2, 3].map(l => <option key={l} value={l}>H{l}</option>)}</select></Field></>}
              {b.type === 'text' && <Field label={t('admin.text')} htmlFor={id('t')} hint={t('studio.paraHint')}><textarea id={id('t')} value={b.text ?? ''} onChange={e => upd(i, { text: e.target.value })} /></Field>}
              {(b.type === 'image' || b.type === 'video') && <>
                <Field label="URL" htmlFor={id('u')} hint={b.type === 'image' ? t('studio.imgHint') : t('studio.vidHint')}><input id={id('u')} value={b.url && b.url.startsWith('data:') ? `(${t('studio.embeddedData')}, ${Math.round(b.url.length / 1365)} KB)` : b.url ?? ''} readOnly={!!b.url?.startsWith('data:')} onChange={e => upd(i, { url: e.target.value })} placeholder="https://…" aria-invalid={!!b.url && !safeUrl(b.url)} />
                  {b.url?.startsWith('data:') && <button className="btn btn-sm btn-ghost" onClick={() => upd(i, { url: '' })}>{t('studio.clear')}</button>}</Field>
                {b.type === 'image' && !!media.length && <Field label={t('studio.fromLibrary')} htmlFor={id('m')}><select id={id('m')} value="" onChange={e => fromLibrary(i, e.target.value)}><option value="">—</option>{media.filter(m => m.mime.startsWith('image/') && m.mime !== 'image/svg+xml').map(m => <option key={m.id} value={m.id}>{m.filename}</option>)}</select></Field>}
                <Field label={b.type === 'image' ? t('admin.altText') : t('studio.vidLabel')} htmlFor={id('a')}><input id={id('a')} value={b.alt ?? ''} onChange={e => upd(i, { alt: e.target.value })} /></Field>
                <Field label={t('studio.caption')} htmlFor={id('c')}><input id={id('c')} value={b.caption ?? ''} onChange={e => upd(i, { caption: e.target.value })} /></Field></>}
              {b.type === 'html' && <Field label="HTML" htmlFor={id('h')} hint={t('studio.htmlHint')}><textarea id={id('h')} className="mono" rows={6} value={b.code ?? ''} onChange={e => upd(i, { code: e.target.value })} /></Field>}
              {b.type === 'quiz' && <>
                <Field label={t('admin.question')} htmlFor={id('q')}><input id={id('q')} value={b.q ?? ''} onChange={e => upd(i, { q: e.target.value })} /></Field>
                <Field label={t('studio.optionsLines')} htmlFor={id('o')}><textarea id={id('o')} rows={4} value={b.options ?? ''} onChange={e => upd(i, { options: e.target.value })} /></Field>
                <Field label={t('studio.correctNo')} htmlFor={id('k')} hint={t('studio.quizWarn')}><input id={id('k')} type="number" min={1} max={Math.max(1, (b.options ?? '').split('\n').filter(s => s.trim()).length)} value={(b.correct ?? 0) + 1} onChange={e => upd(i, { correct: Math.max(0, (+e.target.value || 1) - 1) })} style={{ maxWidth: 100 }} /></Field>
                <div className="form-grid"><Field label={t('studio.q.checkLabel')} htmlFor={id('c1')}><input id={id('c1')} value={b.checkText ?? ''} onChange={e => upd(i, { checkText: e.target.value })} /></Field>
                  <Field label={t('studio.q.okLabel')} htmlFor={id('c2')}><input id={id('c2')} value={b.okText ?? ''} onChange={e => upd(i, { okText: e.target.value })} /></Field>
                  <Field label={t('studio.q.badLabel')} htmlFor={id('c3')}><input id={id('c3')} value={b.badText ?? ''} onChange={e => upd(i, { badText: e.target.value })} /></Field></div></>}
              {b.type === 'animation' && <div className="form-grid"><Field label={t('studio.animType')} htmlFor={id('an')}><select id={id('an')} value={b.anim} onChange={e => upd(i, { anim: e.target.value as any })}>{['pulse', 'spin', 'fade', 'slide'].map(a => <option key={a} value={a}>{t('studio.anim.' + a)}</option>)}</select></Field>
                <Field label={t('studio.animLabel')} htmlFor={id('al')}><input id={id('al')} value={b.label ?? ''} onChange={e => upd(i, { label: e.target.value })} /></Field></div>}
              {b.type === 'file' && <><Field label="URL" htmlFor={id('u')} hint={t('studio.fileHint')}><input id={id('u')} value={b.url ?? ''} onChange={e => upd(i, { url: e.target.value })} placeholder="https://…" /></Field>
                <Field label={t('studio.fileLabel')} htmlFor={id('fl')}><input id={id('fl')} value={b.label ?? ''} onChange={e => upd(i, { label: e.target.value })} /></Field></>}
              {b.type === 'table' && <><Field label={t('studio.tableRows')} htmlFor={id('r')} hint={t('studio.tableHint')}><textarea id={id('r')} className="mono" rows={5} value={b.rows ?? ''} onChange={e => upd(i, { rows: e.target.value })} /></Field>
                <Field label={t('studio.caption')} htmlFor={id('c')}><input id={id('c')} value={b.caption ?? ''} onChange={e => upd(i, { caption: e.target.value })} /></Field></>}
              {b.type === 'columns' && <div className="form-grid"><Field label={t('studio.colLeft')} htmlFor={id('cl')}><textarea id={id('cl')} value={b.left ?? ''} onChange={e => upd(i, { left: e.target.value })} /></Field>
                <Field label={t('studio.colRight')} htmlFor={id('cr')}><textarea id={id('cr')} value={b.right ?? ''} onChange={e => upd(i, { right: e.target.value })} /></Field></div>}
            </div>
          </section>);
      })}
      <div className="toolbar" style={{ position: 'sticky', bottom: 0 }}>
        <div className="field"><label htmlFor="add-type">{t('studio.addBlock')}</label><select id="add-type" value={add} onChange={e => setAdd(e.target.value as BlockType)}>{BLOCK_TYPES.map(k => <option key={k} value={k}>{t('studio.block.' + k)}</option>)}</select></div>
        <button className="btn btn-primary" onClick={() => onChange([...blocks, fresh(add)])}><Icon name="plus" size={16} />{t('common.add')}</button>
      </div>
    </div>
  );
}
void get;
