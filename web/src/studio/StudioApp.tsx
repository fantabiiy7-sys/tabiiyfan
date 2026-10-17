import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../lib/store';
import { Link, navigate, useQuery, useTitle } from '../lib/router';
import { get, post, put, del, qs } from '../lib/api';
import { useAsync, Loading, ErrorState, Empty, Icon, Field, Modal, Badge, StatusBadge } from '../components/ui';
import { TopBar } from '../components/Layout';
import { fmtDate, itemPath } from '../lib/util';
import { CodeBox } from './CodeBox';
import { BlocksEditor } from './BlocksEditor';
import { compileBlocks, type Blk } from './compile';
import { formatCode, checkJs, checkCss, type Problem } from './tools';

const TEMPLATE = { html: '<main>\n  <h1>Salom!</h1>\n  <p>Bu yerda interaktiv material yarating.</p>\n  <button id="btn">Bosing</button>\n  <p id="out" role="status"></p>\n</main>\n', css: 'main { max-width: 640px; margin: 0 auto; padding: 24px 16px; }\nbutton { padding: 10px 18px; font: inherit; }\n', js: "var n = 0;\ndocument.getElementById('btn').addEventListener('click', function () {\n  n++;\n  document.getElementById('out').textContent = 'Bosishlar soni: ' + n;\n});\n" };

export default function StudioApp() {
  const { t, me, can, boot } = useApp(); const [q] = useQuery(); useTitle('HTML Studio — ' + t('site.short'));
  if (!boot) return <Loading />;
  const body = !me ? <div className="page narrow"><div className="panel"><h1>HTML Studio</h1><p>{t('state.needLogin')}</p><Link className="btn btn-primary" to="/login?next=/studio">{t('login.title')}</Link></div></div>
    : !can('studio.use') ? <div className="page narrow"><div className="panel"><h1>HTML Studio</h1><p>{t('state.forbidden')}</p><Link className="btn" to="/">{t('nav.home')}</Link></div></div>
    : q.get('project') ? <Editor key={q.get('project')} id={q.get('project')!} /> : <ProjectList />;
  return <div className="studio"><a className="skip-link" href="#studio-main">{t('a11y.skip')}</a><TopBar /><main id="studio-main" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto' }} tabIndex={-1}>{body}</main></div>;
}

function ProjectList() {
  const { t, lang, toast, confirm } = useApp();
  const r = useAsync(s => get<any[]>('/api/studio/projects', s), []);
  const [open, setOpen] = useState(false); const [name, setName] = useState(''); const [mode, setMode] = useState<'code' | 'blocks'>('code'); const [busy, setBusy] = useState(false);
  const create = async (e: any) => {
    e.preventDefault(); if (!name.trim()) return; setBusy(true);
    try {
      const body = mode === 'code' ? { name: name.trim(), ...TEMPLATE, mode } : { name: name.trim(), ...compileBlocks([{ id: 'a', type: 'heading', text: name.trim(), level: 1 }, { id: 'b', type: 'text', text: '' }]), mode, blocks: [{ id: 'a', type: 'heading', text: name.trim(), level: 1 }, { id: 'b', type: 'text', text: '' }] };
      const x = await post('/api/studio/projects', body); navigate('/studio?project=' + x.id);
    } catch { toast(t('state.error'), 'error'); } finally { setBusy(false); }
  };
  const remove = async (p: any) => {
    if (!(await confirm({ title: t('admin.deleteTitle'), message: t('admin.deleteMsg', { name: p.name }), danger: true, okLabel: t('common.delete') }))) return;
    try { await del('/api/studio/projects/' + p.id); toast(t('common.deleted'), 'success'); r.reload(); } catch (e: any) { toast(e.code === 'unpublish_first' ? t('studio.err.unpublishFirst') : e.code === 'project_in_use' ? t('studio.err.inUse') : t('state.error'), 'error'); }
  };
  return (
    <div className="page">
      <div className="admin-head"><h1>HTML Studio</h1><div className="actions"><button className="btn btn-primary" onClick={() => setOpen(true)}><Icon name="plus" size={16} />{t('studio.newProject')}</button></div></div>
      <div className="callout" role="note"><Icon name="shield" size={18} /><div>{t('studio.securityNote')}</div></div>
      {r.loading && !r.data ? <Loading /> : r.error ? <ErrorState error={r.error} onRetry={r.reload} /> : !r.data!.length ? <Empty title={t('studio.empty')} icon="code" action={<button className="btn btn-primary" onClick={() => setOpen(true)}>{t('studio.newProject')}</button>} /> :
        <div className="table-wrap"><table><thead><tr><th>{t('admin.title2')}</th><th>{t('studio.mode')}</th><th>{t('admin.status')}</th><th>{t('meta.author')}</th><th>{t('meta.updated')}</th><th><span className="sr-only">{t('common.actions')}</span></th></tr></thead>
          <tbody>{r.data!.map(p => <tr key={p.id}><td className="cell-title"><Link to={'/studio?project=' + p.id}>{p.name}</Link>{p.is_demo ? <> <Badge tone="demo">{t('demo.label')}</Badge></> : null}</td><td>{t('studio.mode.' + p.mode)}</td><td><StatusBadge status={p.status} /></td><td>{p.author ?? '—'}</td><td className="muted">{fmtDate(p.updated_at, lang, true)}</td>
            <td className="row-actions"><Link className="btn btn-sm" to={'/studio?project=' + p.id}>{t('common.edit')}</Link><button className="btn btn-sm btn-ghost" onClick={() => remove(p)} aria-label={t('common.delete')}><Icon name="trash" size={14} /></button></td></tr>)}</tbody></table></div>}
      {open && <Modal title={t('studio.newProject')} onClose={() => setOpen(false)} footer={<><button className="btn" onClick={() => setOpen(false)}>{t('common.cancel')}</button><button className="btn btn-primary" form="np-form" disabled={busy || !name.trim()}>{t('common.create')}</button></>}>
        <form id="np-form" onSubmit={create}><Field label={t('studio.projectName')} htmlFor="np-n"><input id="np-n" value={name} maxLength={150} onChange={e => setName(e.target.value)} required /></Field>
          <fieldset><legend>{t('studio.mode')}</legend>
            <label className="check"><input type="radio" name="mode" checked={mode === 'code'} onChange={() => setMode('code')} />{t('studio.mode.code')} — <span className="muted">{t('studio.mode.codeHint')}</span></label>
            <label className="check"><input type="radio" name="mode" checked={mode === 'blocks'} onChange={() => setMode('blocks')} />{t('studio.mode.blocks')} — <span className="muted">{t('studio.mode.blocksHint')}</span></label></fieldset></form>
      </Modal>}
    </div>
  );
}

type Tab = 'html' | 'css' | 'js';
interface State { name: string; html: string; css: string; js: string; mode: 'code' | 'blocks'; blocks: Blk[] }
const snap = (s: State) => JSON.stringify([s.name, s.html, s.css, s.js, s.mode, s.mode === 'blocks' ? s.blocks : null]);

function Editor({ id }: { id: string }) {
  const { t, lang, can, toast, confirm } = useApp();
  const proj = useAsync(s => get<any>('/api/studio/projects/' + id, s), [id]);
  const media = useAsync(s => can('media.upload') ? get<any[]>('/api/admin/media', s) : Promise.resolve([]), []);
  const [s, setS] = useState<State | null>(null); const [tab, setTab] = useState<Tab>('html'); const [view, setView] = useState<'split' | 'code' | 'preview'>('split'); const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [fs, setFs] = useState(false); const [auto, setAuto] = useState(true); const [saved, setSaved] = useState(''); const [savedAt, setSavedAt] = useState<{ at: Date; kind: string } | null>(null); const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('draft'); const [usedBy, setUsedBy] = useState<any[]>([]); const [findings, setFindings] = useState<any[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]); const [runtime, setRuntime] = useState<{ message: string; line?: number }[]>([]);
  const [previewUrl, setPreviewUrl] = useState(''); const [drawer, setDrawer] = useState(false); const [attach, setAttach] = useState(false);
  const refs = { html: useRef<HTMLTextAreaElement>(null), css: useRef<HTMLTextAreaElement>(null), js: useRef<HTMLTextAreaElement>(null) };
  const frame = useRef<HTMLIFrameElement>(null); const stateRef = useRef<State | null>(null); stateRef.current = s;

  useEffect(() => {
    const p = proj.data; if (!p) return;
    const st: State = { name: p.name, html: p.html, css: p.css, js: p.js, mode: p.mode, blocks: p.blocks ?? [] };
    setS(st); setSaved(snap(st)); setStatus(p.status); setUsedBy(p.usedBy ?? []); setFindings(p.findings ?? []);
  }, [proj.data]);
  const dirty = !!s && snap(s) !== saved;
  useEffect(() => { if (!dirty) return; const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; }; window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h); }, [dirty]);

  // ---- saqlash ----
  const save = useCallback(async (kind: 'manual' | 'autosave' = 'manual', note?: string) => {
    const c = stateRef.current; if (!c) return false;
    setSaving(true);
    try {
      const x = await put('/api/studio/projects/' + id, { name: c.name.trim() || 'Untitled', html: c.html, css: c.css, js: c.js, mode: c.mode, blocks: c.mode === 'blocks' ? c.blocks : undefined, saveKind: kind, note });
      setSaved(snap(c)); setSavedAt({ at: new Date(), kind }); setFindings(x.findings ?? []); if (kind === 'manual') toast(t('common.saved'), 'success'); return true;
    } catch (e: any) { toast(e.status === 429 ? t('state.tooMany') : e.status === 403 ? t('state.forbidden') : t('state.error'), 'error'); return false; } finally { setSaving(false); }
  }, [id, t]);
  useEffect(() => { if (!auto) return; const h = setInterval(() => { if (stateRef.current && snap(stateRef.current) !== savedRef.current) save('autosave'); }, 20_000); return () => clearInterval(h); }, [auto, save]);
  const savedRef = useRef(''); savedRef.current = saved;

  // ---- preview ----
  const run = useCallback(async () => {
    const c = stateRef.current; if (!c) return; setRuntime([]);
    try { const x = await post('/api/studio/preview', { html: c.html, css: c.css, js: c.js }); setPreviewUrl(x.url); } catch (e: any) { toast(e.status === 429 ? t('state.tooMany') : t('state.error'), 'error'); }
  }, [t]);
  const key = s ? s.html + '\u0000' + s.css + '\u0000' + s.js : '';
  useEffect(() => { if (!s || !auto) return; const h = setTimeout(run, 700); return () => clearTimeout(h); }, [key, auto]);
  useEffect(() => { if (s && !previewUrl) run(); }, [!!s]);
  useEffect(() => {
    const h = (e: MessageEvent) => { if (e.source !== frame.current?.contentWindow) return; const d = e.data; if (d && d.__studio === 'error') setRuntime(r => [...r.slice(-19), { message: String(d.message).slice(0, 300), line: d.line }]); };
    window.addEventListener('message', h); return () => window.removeEventListener('message', h);
  }, []);
  useEffect(() => { if (!fs) return; const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setFs(false); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [fs]);

  // ---- sintaksis tekshiruvi va xavfsizlik skaneri (debounce) ----
  useEffect(() => {
    if (!s || s.mode !== 'code') { setProblems([]); return; }
    let alive = true; const h = setTimeout(async () => {
      const [j, c] = await Promise.all([checkJs(s.js), checkCss(s.css)]);
      if (alive) setProblems(p => [...p.filter(x => x.kind === 'html'), ...(j ? [j] : []), ...(c ? [c] : [])]);
      try { const f = await post('/api/studio/scan', { html: s.html, css: s.css, js: s.js }); if (alive) setFindings(f.findings); } catch { /* skaner ixtiyoriy */ }
    }, 900);
    return () => { alive = false; clearTimeout(h); };
  }, [s?.html, s?.css, s?.js, s?.mode]);

  if (proj.loading && !s) return <Loading />; if (proj.error) return <div className="page"><ErrorState error={proj.error} onRetry={proj.reload} /></div>; if (!s) return null;
  const set = (p: Partial<State>) => setS({ ...s, ...p });
  const setBlocks = (b: Blk[]) => { const c = compileBlocks(b); setS({ ...s, blocks: b, ...c }); };
  const fmt = async () => {
    try {
      const out = await formatCode(tab, s[tab]); setProblems(p => p.filter(x => x.kind !== tab));
      const ta = refs[tab].current; if (ta && out !== s[tab]) { ta.focus(); ta.select(); if (!document.execCommand('insertText', false, out)) set({ [tab]: out } as any); }
      toast(t('studio.formatted'), 'success');
    } catch (e: any) { const loc = e.loc?.start ?? e.loc; setProblems(p => [...p.filter(x => x.kind !== tab), { kind: tab, line: loc?.line, col: loc?.column, message: String(e.message).split('\n')[0] }]); toast(t('studio.err.format'), 'error'); }
  };
  const undo = (redo = false) => { const ta = refs[tab].current; ta?.focus(); document.execCommand(redo ? 'redo' : 'undo'); };
  const toCode = async () => { if (await confirm({ title: t('studio.toCodeTitle'), message: t('studio.toCodeMsg') })) set({ mode: 'code' }); };
  const publish = async () => {
    if (dirty && !(await save('manual'))) return;
    if (!(await confirm({ title: t('studio.publishTitle'), message: t('studio.publishMsg') }))) return;
    try { const x = await post(`/api/studio/projects/${id}/publish`, {}); setStatus('published'); setFindings(x.findings ?? findings); toast(t('studio.published'), 'success'); }
    catch (e: any) { toast(e.code === 'security_blocked' ? t('studio.err.blocked') + ': ' + e.message : e.status === 403 ? t('state.forbidden') : t('state.error'), 'error'); }
  };
  const unpublish = async () => { try { await post(`/api/studio/projects/${id}/unpublish`, {}); setStatus('draft'); toast(t('studio.unpublished'), 'success'); } catch { toast(t('state.error'), 'error'); } };
  const blockFindings = findings.filter(f => f.level === 'block');
  const jsProblem = problems.find(p => p.kind === 'js'); const cssProblem = problems.find(p => p.kind === 'css');
  const allProblems = [...problems.map(p => ({ lvl: 'error', text: `${p.kind.toUpperCase()}${p.line ? ` ${p.line}:${p.col ?? 1}` : ''} — ${p.message}` })), ...runtime.map(r => ({ lvl: 'error', text: `${t('studio.runtime')}${r.line ? ` ${r.line}` : ''} — ${r.message}` })), ...findings.map(f => ({ lvl: f.level === 'block' ? 'error' : 'warn', text: (f.level === 'block' ? t('studio.blocked') : t('studio.warning')) + ' — ' + f.message }))];

  return (
    <>
      <div className="studio-bar" role="toolbar" aria-label={t('studio.toolbar')}>
        <Link className="btn btn-sm btn-ghost" to="/studio"><Icon name="chevron-left" size={16} />{t('studio.projects')}</Link>
        <label className="sr-only" htmlFor="pname">{t('studio.projectName')}</label>
        <input id="pname" className="name-input" value={s.name} maxLength={150} onChange={e => set({ name: e.target.value })} />
        <StatusBadge status={status} />
        <span className={'save-state' + (dirty ? ' dirty' : '')} role="status" aria-live="polite">{saving ? t('state.loading') : dirty ? t('studio.unsaved') : savedAt ? `${t('studio.savedAt', { time: savedAt.at.toLocaleTimeString(lang), kind: t('studio.kind.' + savedAt.kind) })}` : t('studio.allSaved')}</span>
        <span className="sep" />
        {s.mode === 'code' && <>
          <button className="btn btn-sm" onClick={() => undo()} title="Ctrl+Z"><Icon name="undo" size={16} />{t('studio.undo')}</button>
          <button className="btn btn-sm" onClick={() => undo(true)} title="Ctrl+Y"><Icon name="redo" size={16} />{t('studio.redo')}</button>
          <button className="btn btn-sm" onClick={fmt}><Icon name="list" size={16} />{t('studio.format')}</button></>}
        {s.mode === 'blocks' && <button className="btn btn-sm" onClick={toCode}><Icon name="code" size={16} />{t('studio.toCode')}</button>}
        <span className="spacer" />
        <label className="check" style={{ margin: 0 }}><input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} />{t('studio.auto')}</label>
        <button className="btn btn-sm" onClick={() => setDrawer(true)}><Icon name="history" size={16} />{t('studio.versions')}</button>
        {can('content.edit') && <button className="btn btn-sm" onClick={() => setAttach(true)}><Icon name="link" size={16} />{t('studio.attach')}</button>}
        <button className="btn btn-sm btn-primary" onClick={() => save('manual')} disabled={saving} title="Ctrl+S"><Icon name="save" size={16} />{t('common.save')}</button>
        {can('studio.publish') && (status === 'published' ? <button className="btn btn-sm" onClick={unpublish}>{t('studio.unpublish')}</button> : <button className="btn btn-sm" onClick={publish} disabled={!!blockFindings.length || !!jsProblem} title={blockFindings.length ? t('studio.err.blocked') : undefined}>{t('studio.publish')}</button>)}
        <div className="seg" role="group" aria-label={t('studio.layout')}>{(['code', 'split', 'preview'] as const).map(v => <button key={v} aria-pressed={view === v} onClick={() => setView(v)} title={t('studio.view.' + v)}><Icon name={v === 'code' ? 'code' : v === 'split' ? 'columns' : 'eye'} size={16} /><span className="sr-only">{t('studio.view.' + v)}</span></button>)}</div>
      </div>
      <div className={'studio-body' + (view !== 'split' ? ' preview-only' : '')}>
        {view !== 'preview' && (
          <section className="pane" aria-label={t('studio.editor')}>
            {s.mode === 'code' ? <>
              <div className="pane-head"><div className="code-tabs" role="tablist" aria-label={t('studio.files')}>{(['html', 'css', 'js'] as const).map(k => <button key={k} role="tab" aria-selected={tab === k} className={'code-tab' + (tab === k ? ' active' : '')} onClick={() => setTab(k)}>{k === 'js' ? 'JavaScript' : k.toUpperCase()}{problems.some(p => p.kind === k) && <><span className="err-dot" aria-hidden="true" /><span className="sr-only"> ({t('studio.hasErrors')})</span></>}</button>)}</div></div>
              <CodeBox key={tab} value={s[tab]} kind={tab} onChange={v => set({ [tab]: v } as any)} label={`${tab.toUpperCase()} ${t('studio.code')}`} taRef={refs[tab]} onSave={() => save('manual')} onRun={run} escHint={t('studio.escHint')} />
            </> : <BlocksEditor blocks={s.blocks} onChange={setBlocks} media={media.data ?? []} />}
            <details className="problems" open={allProblems.some(p => p.lvl === 'error')}><summary><Icon name="alert" size={16} />{t('studio.problems')} ({allProblems.length})</summary>
              {!allProblems.length ? <p className="muted small" style={{ padding: '0 12px 8px' }}>{t('studio.noProblems')}</p> : <ul>{allProblems.map((p, i) => <li key={i} className={p.lvl}><Badge tone={p.lvl === 'error' ? 'bad' : 'warn'}>{p.lvl === 'error' ? t('studio.error') : t('studio.warning')}</Badge><span>{p.text}</span></li>)}</ul>}</details>
          </section>)}
        {view !== 'code' && (
          <section className={'preview-pane' + (fs ? ' is-fs' : '')} aria-label={t('studio.preview')}>
            <div className="pane-head">
              <button className="btn btn-sm" onClick={run}><Icon name="refresh" size={16} />{t('studio.refresh')}</button>
              <div className="seg" role="group" aria-label={t('studio.device')}>{([['desktop', 'monitor'], ['tablet', 'tablet'], ['mobile', 'phone']] as const).map(([d, ic]) => <button key={d} aria-pressed={device === d} onClick={() => setDevice(d)} title={t('studio.device.' + d)}><Icon name={ic} size={16} /><span className="sr-only">{t('studio.device.' + d)}</span></button>)}</div>
              <span style={{ flex: 1 }} />
              <button className="btn btn-sm" onClick={() => setFs(!fs)} aria-pressed={fs}><Icon name="maximize" size={16} />{fs ? t('studio.exitFs') : t('studio.fullscreen')}</button>
            </div>
            <div className="preview-stage"><div className={'device ' + device}>{previewUrl ? <iframe ref={frame} src={previewUrl} title={t('studio.preview')} sandbox="allow-scripts" referrerPolicy="no-referrer" /> : <Loading />}</div></div>
            {!!runtime.length && <div className="console" role="log" aria-label={t('studio.console')}>{runtime.map((r, i) => <div key={i} className="e">✖ {r.message}{r.line ? ` (${r.line})` : ''}</div>)}</div>}
          </section>)}
      </div>
      {drawer && <Versions id={id} onClose={() => setDrawer(false)} dirty={dirty} onLoad={v => { setS({ ...s, html: v.html, css: v.css, js: v.js, mode: v.blocks ? 'blocks' : s.mode === 'blocks' && !v.blocks ? 'code' : s.mode, blocks: v.blocks ?? [] }); setDrawer(false); toast(t('studio.versionLoaded'), 'info'); }} />}
      {attach && <Attach id={id} usedBy={usedBy} onClose={() => setAttach(false)} onDone={() => { setAttach(false); proj.reload(); }} />}
    </>
  );
  void cssProblem;
}

function Versions({ id, onClose, onLoad, dirty }: { id: string; onClose: () => void; onLoad: (v: any) => void; dirty: boolean }) {
  const { t, lang, confirm, toast } = useApp(); const r = useAsync(s => get<any[]>(`/api/studio/projects/${id}/versions`, s), [id]);
  const load = async (v: any) => {
    if (dirty && !(await confirm({ title: t('studio.restoreTitle'), message: t('studio.restoreMsg') }))) return;
    try { onLoad(await get(`/api/studio/projects/${id}/versions/${v.id}`)); } catch { toast(t('state.error'), 'error'); }
  };
  return (
    <aside className="drawer" role="dialog" aria-modal="false" aria-label={t('studio.versions')}>
      <div className="drawer-head"><h2>{t('studio.versions')}</h2><button className="icon-btn" onClick={onClose} aria-label={t('common.close')}><Icon name="x" /></button></div>
      <div style={{ overflow: 'auto', padding: '0 16px 16px' }}>
        <p className="small muted">{t('studio.versionsNote')}</p>
        {r.loading && !r.data ? <Loading /> : r.error ? <ErrorState error={r.error} onRetry={r.reload} /> : r.data!.map(v => (
          <div className="ver" key={v.id}><div className="ver-top"><strong>v{v.version_no}</strong><Badge tone={v.kind === 'published' ? 'ok' : v.kind === 'manual' ? 'info' : 'neutral'}>{t('studio.kind.' + v.kind)}</Badge><span className="muted small">{fmtDate(v.created_at, lang, true)}</span></div>
            <span className="small muted">{v.author ?? '—'}{v.note ? ' · ' + v.note : ''} · {Math.round(v.size / 102.4) / 10} KB</span>
            <div><button className="btn btn-sm" onClick={() => load(v)}><Icon name="undo" size={14} />{t('studio.loadVersion')}</button></div></div>))}
      </div>
    </aside>
  );
}

function Attach({ id, usedBy, onClose, onDone }: { id: string; usedBy: any[]; onClose: () => void; onDone: () => void }) {
  const { t, lang, toast } = useApp(); const [kind, setKind] = useState('lesson'); const [sel, setSel] = useState('');
  const r = useAsync(s => get<any>('/api/admin/content' + qs({ kind, pageSize: 50, lang }), s), [kind, lang]);
  const go = async (contentId: number | null) => { try { await post(`/api/studio/projects/${id}/attach`, { contentId }); toast(t('common.saved'), 'success'); onDone(); } catch (e: any) { toast(e.status === 403 ? t('state.forbidden') : t('state.error'), 'error'); } };
  return (
    <Modal title={t('studio.attach')} onClose={onClose} footer={<><button className="btn" onClick={onClose}>{t('common.cancel')}</button><button className="btn btn-primary" disabled={!sel} onClick={() => go(+sel)}>{t('studio.attachDo')}</button></>}>
      <p className="muted small">{t('studio.attachNote')}</p>
      {!!usedBy.length && <div className="callout" role="note"><Icon name="link" size={18} /><div>{t('studio.usedBy')}: {usedBy.map((u, i) => <span key={u.id}>{i > 0 && ', '}<Link to={'/admin/content/' + u.id}>{u.slug}</Link></span>)} <button className="btn btn-sm btn-ghost" onClick={() => go(null)}>{t('studio.detach')}</button></div></div>}
      <Field label={t('filters.type')} htmlFor="at-k"><select id="at-k" value={kind} onChange={e => { setKind(e.target.value); setSel(''); }}>{['lesson', 'lab', 'animation', 'assessment', 'project'].map(k => <option key={k} value={k}>{t('kind.' + k)}</option>)}</select></Field>
      <Field label={t('studio.targetMaterial')} htmlFor="at-s">{r.loading && !r.data ? <Loading /> : <select id="at-s" value={sel} onChange={e => setSel(e.target.value)}><option value="">—</option>{(r.data?.items ?? []).map((i: any) => <option key={i.id} value={i.id}>{i.title}</option>)}</select>}</Field>
    </Modal>
  );
  void itemPath;
}
