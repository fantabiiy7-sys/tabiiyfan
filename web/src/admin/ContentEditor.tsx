import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../lib/store';
import { Link, navigate, useQuery, useTitle } from '../lib/router';
import { get, post, put, qs } from '../lib/api';
import { useAsync, Loading, ErrorState, StatusBadge, Icon, Field, Modal, Badge } from '../components/ui';
import { blocksToText, textToBlocks } from '../lib/blocks';
import { fmtDate, fmtBytes, itemPath } from '../lib/util';
import { LESSON_TYPES, FORMATS } from '../pages/Catalog';

const LANGS = ['uz', 'ru', 'en'] as const; type L = (typeof LANGS)[number];
const SECTION_KEYS: Record<string, string[]> = {
  lesson: Array.from({ length: 20 }, (_, i) => 's' + (i + 1)),
  method: ['purpose', 'applicability', 'steps', 'materials', 'timing', 'student', 'teacher', 'assessment'],
  lab: ['goal', 'howto', 'limits'], animation: ['goal', 'howto', 'limits'], project: ['goal', 'stages', 'outcomes', 'assessment'],
  video: ['description'], ebook: ['description'], assessment: ['goal'],
};
const TRANSITIONS: { from: string; to: string; perm: string }[] = [
  { from: 'draft', to: 'in_review', perm: 'content.submit' }, { from: 'in_review', to: 'draft', perm: 'content.review' }, { from: 'in_review', to: 'approved', perm: 'content.approve' },
  { from: 'approved', to: 'published', perm: 'content.publish' }, { from: 'published', to: 'archived', perm: 'content.archive' }, { from: 'draft', to: 'archived', perm: 'content.archive' },
  { from: 'archived', to: 'draft', perm: 'content.edit' }, { from: 'published', to: 'draft', perm: 'content.publish' },
];
interface Tr { title: string; summary: string; keywords: string; status: string; sections: Record<string, string>; exists: boolean }
interface Form {
  kind: string; grade: string; topicId: string; lessonType: string; durationMin: string; format: string; sourceLang: L; videoUrl: string; fileAssetId: string; interactiveProjectId: string;
  isDemo: boolean; isHidden: boolean; subjectIds: number[]; methodIds: number[]; tr: Record<L, Tr>;
}
const emptyTr = (): Tr => ({ title: '', summary: '', keywords: '', status: 'draft', sections: {}, exists: false });
const blank = (kind: string): Form => ({ kind, grade: '', topicId: '', lessonType: '', durationMin: '', format: 'html', sourceLang: 'uz', videoUrl: '', fileAssetId: '', interactiveProjectId: '', isDemo: false, isHidden: false, subjectIds: [], methodIds: [], tr: { uz: emptyTr(), ru: emptyTr(), en: emptyTr() } });

function fromServer(d: any): Form {
  const f = blank(d.kind);
  Object.assign(f, { grade: d.grade ? String(d.grade) : '', topicId: d.topicId ? String(d.topicId) : '', lessonType: d.lessonType ?? '', durationMin: d.durationMin ? String(d.durationMin) : '', format: d.format ?? '',
    sourceLang: d.sourceLang, videoUrl: d.videoUrl ?? '', fileAssetId: d.file ? String(d.file.id) : '', interactiveProjectId: d.interactiveProjectId ? String(d.interactiveProjectId) : '', isDemo: d.isDemo, isHidden: d.isHidden,
    subjectIds: d.subjectIds ?? [], methodIds: d.methodIds ?? [] });
  for (const l of LANGS) {
    const x = d.translationsFull?.[l]; if (!x) continue;
    const sections: Record<string, string> = {}; for (const s of x.body?.sections ?? []) sections[s.key] = blocksToText(s.blocks);
    f.tr[l] = { title: x.title, summary: x.summary ?? '', keywords: x.keywords ?? '', status: x.status, sections, exists: true };
  }
  return f;
}

export function ContentEditor({ id }: { id: string }) {
  const { t, lang, can, toast, confirm, boot } = useApp(); const [q] = useQuery();
  const isNew = id === 'new'; const kindParam = q.get('kind') ?? 'lesson';
  const item = useAsync(s => isNew ? Promise.resolve(null) : get<any>(`/api/admin/content/${id}?lang=${lang}`, s), [id]);
  const methods = useAsync(s => get<any>('/api/admin/content?kind=method&pageSize=50&lang=' + lang, s), [lang]);
  const projects = useAsync(s => can('studio.use') ? get<any[]>('/api/studio/projects', s) : Promise.resolve([]), []);
  const media = useAsync(s => can('media.upload') ? get<any[]>('/api/admin/media', s) : Promise.resolve([]), []);
  const reviews = useAsync(s => isNew ? Promise.resolve([]) : get<any[]>(`/api/admin/content/${id}/reviews`, s), [id, item.data?.status]);
  const versions = useAsync(s => isNew ? Promise.resolve([]) : get<any[]>(`/api/admin/content/${id}/versions`, s), [id, item.data?.updatedAt]);
  const [f, setF] = useState<Form | null>(isNew ? blank(kindParam) : null);
  const [tab, setTab] = useState<L>('uz'); const [dirty, setDirty] = useState(false); const [saving, setSaving] = useState(false); const [errs, setErrs] = useState<Record<string, string>>({});
  const [comment, setComment] = useState(''); const [mediaOpen, setMediaOpen] = useState(false); const focus = useRef<string | null>(null);
  useEffect(() => { if (item.data) { setF(fromServer(item.data)); setDirty(false); setTab(item.data.sourceLang); } }, [item.data]);
  useEffect(() => { if (!dirty) return; const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; }; window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h); }, [dirty]);
  useTitle(t('admin.editor') + ' — ' + t('site.short'));
  if (!isNew && !item.data && !item.error) return <Loading />; if (item.error) return <ErrorState error={item.error} onRetry={item.reload} />; if (!f) return <Loading />;
  const kind = f.kind; const keys = (() => { const base = SECTION_KEYS[kind] ?? ['goal']; const extra = new Set<string>(); for (const l of LANGS) for (const k of Object.keys(f.tr[l].sections)) if (!base.includes(k)) extra.add(k); return [...base, ...extra]; })();
  const set = (p: Partial<Form>) => { setF({ ...f, ...p }); setDirty(true); };
  const setTr = (l: L, p: Partial<Tr>) => { setF({ ...f, tr: { ...f.tr, [l]: { ...f.tr[l], ...p } } }); setDirty(true); };
  const topics = (boot?.topics ?? []).filter(x => !f.grade || String(x.grade) === f.grade);
  const secTitle = (k: string) => /^s\d+$/.test(k) ? `${k.slice(1)}. ${t('lesson.sec.' + k)}` : t((['purpose', 'applicability', 'steps', 'materials', 'timing', 'student', 'teacher', 'assessment'].includes(k) && kind === 'method' ? 'method.sec.' : 'sec.') + k);
  const status = item.data?.status as string | undefined;
  const canEditNow = isNew ? can('content.create') : can('content.edit') && (status !== 'published' || can('content.publish'));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!f.tr[f.sourceLang].title.trim()) e.title = t('admin.err.sourceTitle');
    if (f.durationMin && (!/^\d+$/.test(f.durationMin) || +f.durationMin < 1 || +f.durationMin > 240)) e.duration = t('admin.err.duration');
    if (f.videoUrl && !/^https:\/\/[^\s]+$/.test(f.videoUrl) && !f.videoUrl.startsWith('/media/')) e.videoUrl = t('admin.err.https');
    setErrs(e); return !Object.keys(e).length;
  };
  const save = async () => {
    if (!validate()) { toast(t('admin.err.fix'), 'error'); return; }
    const translations: any = {};
    for (const l of LANGS) { const x = f.tr[l]; if (!x.title.trim()) continue;
      const sections = keys.filter(k => x.sections[k]?.trim()).map(k => ({ key: k, blocks: textToBlocks(x.sections[k]) }));
      translations[l] = { title: x.title.trim(), summary: x.summary.trim() || undefined, keywords: x.keywords.trim() || undefined, body: { sections }, status: x.status }; }
    const body = { kind, grade: f.grade ? +f.grade : null, topicId: f.topicId ? +f.topicId : null, lessonType: f.lessonType || null, durationMin: f.durationMin ? +f.durationMin : null, format: f.format || null,
      sourceLang: f.sourceLang, videoUrl: f.videoUrl || null, fileAssetId: f.fileAssetId ? +f.fileAssetId : null, interactiveProjectId: f.interactiveProjectId ? +f.interactiveProjectId : null,
      isDemo: f.isDemo, isHidden: f.isHidden, subjectIds: f.subjectIds, methodIds: kind === 'lesson' ? f.methodIds : [], translations };
    setSaving(true);
    try {
      if (isNew) { const r = await post('/api/admin/content', body); setDirty(false); toast(t('common.saved'), 'success'); navigate('/admin/content/' + r.id, { replace: true }); }
      else { await put('/api/admin/content/' + id, body); setDirty(false); toast(t('common.saved'), 'success'); item.reload(); }
    } catch (e: any) { toast(e.code === 'forbidden' ? t('state.forbidden') : e.code === 'invalid_input' ? t('admin.err.invalid') + (e.message && e.message !== e.code ? ': ' + e.message : '') : t('state.error'), 'error'); } finally { setSaving(false); }
  };
  const transition = async (to: string) => {
    if (dirty && !(await confirm({ title: t('admin.unsavedTitle'), message: t('admin.unsavedMsg') }))) return;
    try { await post(`/api/admin/content/${id}/transition`, { to, comment: comment || undefined }); setComment(''); toast(t('admin.transitioned'), 'success'); item.reload(); } catch (e: any) { toast(e.code === 'forbidden' ? t('state.forbidden') : t('state.error'), 'error'); }
  };
  const restore = async (v: any) => {
    if (!(await confirm({ title: t('admin.restoreTitle'), message: t('admin.restoreMsg', { n: v.version_no }) }))) return;
    try { await post(`/api/admin/content/${id}/restore/${v.id}`); toast(t('admin.restored'), 'success'); item.reload(); } catch { toast(t('state.error'), 'error'); }
  };
  const insertMedia = (m: any) => {
    const url = '/media/' + m.stored_name; const snippet = m.mime.startsWith('image/') ? `![${m.alt_uz || m.filename}](${url})` : m.mime.startsWith('video/') ? `[[video:${url}]]` : `[[file:${url}|${m.filename}]]`;
    const [l, k] = (focus.current ?? `${tab}:${keys[0]}`).split(':') as [L, string]; const cur = f.tr[l].sections[k] ?? '';
    setTr(l, { sections: { ...f.tr[l].sections, [k]: (cur ? cur + '\n\n' : '') + snippet } }); setMediaOpen(false); toast(t('admin.mediaInserted'), 'success');
  };
  const allowed = TRANSITIONS.filter(x => x.from === status && can(x.perm));
  const tr = f.tr[tab];

  return (
    <div>
      <div className="admin-head">
        <div><p className="small muted"><Link to={'/admin/content?kind=' + kind}>{t('kind.' + kind + '.plural')}</Link> / {isNew ? t('common.create') : t('common.edit')}</p>
          <h1>{f.tr[f.sourceLang].title || (isNew ? t('admin.newItem', { k: t('kind.' + kind) }) : '…')}</h1>
          <div className="card-badges">{status && <StatusBadge status={status} />}<Badge tone="kind">{t('kind.' + kind)}</Badge>{f.isDemo && <Badge tone="demo">{t('demo.label')}</Badge>}{dirty && <Badge tone="warn">{t('admin.unsaved')}</Badge>}</div></div>
        <div className="actions">
          {!isNew && status === 'published' && <Link className="btn" to={itemPath({ kind, slug: item.data.slug })}><Icon name="eye" size={16} />{t('admin.viewPublic')}</Link>}
          {!isNew && status !== 'published' && <Link className="btn" to={itemPath({ kind, slug: item.data.slug })}><Icon name="eye" size={16} />{t('admin.preview')}</Link>}
          <button className="btn btn-primary" disabled={!canEditNow || saving || (!dirty && !isNew)} onClick={save}><Icon name="save" size={16} />{saving ? t('state.loading') : t('common.save')}</button>
        </div>
      </div>
      {!canEditNow && <div className="callout" role="note"><Icon name="lock" size={18} /><div>{status === 'published' ? t('admin.publishedLocked') : t('admin.readOnly')}</div></div>}

      <div className="editor-layout">
        <div>
          <section className="panel" aria-labelledby="ed-meta"><h2 id="ed-meta">{t('admin.params')}</h2>
            <fieldset disabled={!canEditNow} style={{ border: 0, padding: 0, margin: 0 }}>
              <div className="form-grid">
                <Field label={t('filters.grade')} htmlFor="e-grade"><select id="e-grade" value={f.grade} onChange={e => set({ grade: e.target.value, topicId: '' })}><option value="">{kind === 'method' ? t('admin.bothGrades') : '—'}</option>{(boot?.grades ?? []).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></Field>
                {kind !== 'method' && <Field label={t('filters.topic')} htmlFor="e-topic"><select id="e-topic" value={f.topicId} onChange={e => set({ topicId: e.target.value })}><option value="">—</option>{topics.map(x => <option key={x.id} value={x.id}>{x.title}</option>)}</select></Field>}
                {kind === 'lesson' && <Field label={t('filters.lessonType')} htmlFor="e-lt"><select id="e-lt" value={f.lessonType} onChange={e => set({ lessonType: e.target.value })}><option value="">—</option>{LESSON_TYPES.map(x => <option key={x} value={x}>{t('lessonType.' + x)}</option>)}</select></Field>}
                {kind === 'lesson' && <Field label={t('meta.duration')} htmlFor="e-dur" error={errs.duration}><input id="e-dur" type="number" min={1} max={240} value={f.durationMin} onChange={e => set({ durationMin: e.target.value })} /></Field>}
                <Field label={t('filters.format')} htmlFor="e-fmt"><select id="e-fmt" value={f.format} onChange={e => set({ format: e.target.value })}><option value="">—</option>{FORMATS.map(x => <option key={x} value={x}>{t('format.' + x)}</option>)}</select></Field>
                <Field label={t('admin.sourceLang')} htmlFor="e-sl" hint={t('admin.sourceLangHint')}><select id="e-sl" value={f.sourceLang} onChange={e => set({ sourceLang: e.target.value as L })}>{LANGS.map(l => <option key={l} value={l}>{t('lang.' + l)}</option>)}</select></Field>
                {(kind === 'video' || kind === 'lesson') && <Field label={t('admin.videoUrl')} htmlFor="e-vid" error={errs.videoUrl} hint={t('admin.videoHint')}><input id="e-vid" type="url" value={f.videoUrl} onChange={e => set({ videoUrl: e.target.value })} placeholder="https://… / /media/…mp4" /></Field>}
                {(kind === 'ebook' || kind === 'lesson' || kind === 'video') && <Field label={t('admin.file')} htmlFor="e-file"><select id="e-file" value={f.fileAssetId} onChange={e => set({ fileAssetId: e.target.value })}><option value="">—</option>{(media.data ?? []).map((m: any) => <option key={m.id} value={m.id}>{m.filename} ({fmtBytes(m.size)})</option>)}</select></Field>}
                {['lesson', 'lab', 'animation', 'assessment', 'project'].includes(kind) && can('studio.use') && <Field label={t('admin.studioProject')} htmlFor="e-proj" hint={t('admin.studioProjectHint')}><select id="e-proj" value={f.interactiveProjectId} onChange={e => set({ interactiveProjectId: e.target.value })}><option value="">—</option>{(projects.data ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.name} · {t('status.' + p.status)}</option>)}</select></Field>}
              </div>
              <fieldset><legend>{t('common.subjects')}</legend><div className="chips" style={{ gap: 10 }}>{(boot?.subjects ?? []).map(s => <label key={s.id} className="check" style={{ margin: 0 }}><input type="checkbox" checked={f.subjectIds.includes(s.id)} onChange={e => set({ subjectIds: e.target.checked ? [...f.subjectIds, s.id] : f.subjectIds.filter(x => x !== s.id) })} />{s.name}</label>)}</div></fieldset>
              {kind === 'lesson' && <fieldset><legend>{t('content.methodsUsed')}</legend><div className="chips" style={{ gap: 10 }}>{(methods.data?.items ?? []).map((m: any) => <label key={m.id} className="check" style={{ margin: 0 }}><input type="checkbox" checked={f.methodIds.includes(m.id)} onChange={e => set({ methodIds: e.target.checked ? [...f.methodIds, m.id] : f.methodIds.filter(x => x !== m.id) })} />{m.title}</label>)}</div></fieldset>}
              <label className="check"><input type="checkbox" checked={f.isDemo} onChange={e => set({ isDemo: e.target.checked })} />{t('admin.isDemo')}</label>
              <label className="check"><input type="checkbox" checked={f.isHidden} onChange={e => set({ isHidden: e.target.checked })} />{t('admin.isHidden')}</label>
            </fieldset>
          </section>

          <section className="panel" aria-labelledby="ed-content"><h2 id="ed-content">{t('admin.contentByLang')}</h2>
            <div className="lang-tabs" role="tablist">{LANGS.map(l => <button key={l} role="tab" aria-selected={tab === l} className={'btn btn-sm' + (tab === l ? ' btn-primary' : '')} onClick={() => setTab(l)}>{t('lang.' + l)}{f.tr[l].title && ' ✓'}{l === f.sourceLang && ' ★'}</button>)}</div>
            {!tr.title && !tr.exists && tab !== f.sourceLang && f.tr[f.sourceLang].title && (
              <div className="callout" role="note"><Icon name="globe" size={18} /><div>{t('admin.noTranslationYet')} <button className="btn btn-sm" disabled={!canEditNow} onClick={() => { const src = f.tr[f.sourceLang]; setTr(tab, { title: src.title, summary: src.summary, keywords: src.keywords, sections: { ...src.sections }, status: 'draft' }); }}>{t('admin.copyFromSource')}</button></div></div>)}
            <fieldset disabled={!canEditNow} style={{ border: 0, padding: 0, margin: 0 }}>
              <Field label={t('admin.title2')} htmlFor="e-title" error={tab === f.sourceLang ? errs.title : undefined}><input id="e-title" type="text" value={tr.title} maxLength={300} onChange={e => setTr(tab, { title: e.target.value })} /></Field>
              <Field label={t('admin.summary')} htmlFor="e-sum"><textarea id="e-sum" value={tr.summary} maxLength={2000} onChange={e => setTr(tab, { summary: e.target.value })} /></Field>
              <div className="form-grid"><Field label={t('admin.keywords')} htmlFor="e-kw"><input id="e-kw" type="text" value={tr.keywords} maxLength={500} onChange={e => setTr(tab, { keywords: e.target.value })} /></Field>
                <Field label={t('admin.trStatus')} htmlFor="e-trs"><select id="e-trs" value={tr.status} onChange={e => setTr(tab, { status: e.target.value })}>{['draft', 'machine', 'reviewed', 'final'].map(s => <option key={s} value={s}>{t('trstatus.' + s)}</option>)}</select></Field></div>
              <div className="block-head" style={{ margin: '16px 0 8px' }}><h3 style={{ margin: 0 }}>{t('admin.sections')}</h3>{can('media.upload') && <button className="btn btn-sm" onClick={() => setMediaOpen(true)}><Icon name="image" size={14} />{t('admin.insertMedia')}</button>}</div>
              <details className="small muted" style={{ marginBottom: 10 }}><summary>{t('admin.formatHelp')}</summary><pre className="formula">{t('admin.formatHelpText')}</pre></details>
              {keys.map(k => (
                <div className="sec-edit" key={k}><h3><label htmlFor={`sec-${tab}-${k}`}>{secTitle(k)}</label></h3>
                  <textarea id={`sec-${tab}-${k}`} value={tr.sections[k] ?? ''} onFocus={() => (focus.current = `${tab}:${k}`)} onChange={e => setTr(tab, { sections: { ...tr.sections, [k]: e.target.value } })} rows={Math.min(14, Math.max(3, (tr.sections[k] ?? '').split('\n').length + 1))} /></div>))}
            </fieldset>
          </section>
          {!isNew && kind === 'assessment' && can('content.edit') && <QuestionsEditor id={id} />}
        </div>

        <aside className="side-panel" aria-label={t('admin.workflow')}>
          {!isNew && status && (
            <section className="panel"><h2>{t('admin.workflow')}</h2><p><StatusBadge status={status} /></p>
              {!!allowed.length && <><div className="field"><label htmlFor="wf-c">{t('admin.comment')}</label><input id="wf-c" type="text" value={comment} onChange={e => setComment(e.target.value)} maxLength={500} /></div>
                <div className="content-actions" style={{ marginTop: 0 }}>{allowed.map(a => <button key={a.to} className={'btn btn-sm' + (a.to === 'approved' || a.to === 'published' ? ' btn-primary' : '')} onClick={() => transition(a.to)}>{t('admin.to.' + a.from + '.' + a.to)}</button>)}</div></>}
              {!allowed.length && <p className="muted small">{t('admin.noTransitions')}</p>}
              <dl className="meta-grid" style={{ gridTemplateColumns: '1fr', marginTop: 14 }}>
                <div><dt>{t('meta.author')}</dt><dd>{item.data.author ?? '—'}</dd></div><div><dt>{t('admin.reviewer')}</dt><dd>{item.data.reviewer ?? '—'}</dd></div><div><dt>{t('admin.approver')}</dt><dd>{item.data.approver ?? '—'}</dd></div><div><dt>{t('meta.updated')}</dt><dd>{fmtDate(item.data.updatedAt, lang, true)}</dd></div></dl>
              <p className="muted small">{t('admin.officialNote')}</p>
            </section>)}
          {!isNew && <section className="panel"><h2><Icon name="clock" size={18} /> {t('admin.reviewsLog')}</h2>
            {!reviews.data?.length ? <p className="muted small">{t('admin.noReviews')}</p> : <ul className="timeline small">{reviews.data.map((r: any, i: number) => <li key={i}><strong>{t('status.' + r.from_status)} → {t('status.' + r.to_status)}</strong><br />{r.actor} · <span className="muted">{fmtDate(r.created_at, lang, true)}</span>{r.comment && <><br />“{r.comment}”</>}</li>)}</ul>}</section>}
          {!isNew && <section className="panel"><h2><Icon name="history" size={18} /> {t('admin.versions')}</h2>
            {!versions.data?.length ? <p className="muted small">—</p> : <div style={{ maxHeight: 280, overflow: 'auto' }}>{versions.data.slice(0, 30).map((v: any) => <div className="ver" key={v.id}><div className="ver-top"><strong>v{v.version_no}</strong><span className="muted small">{fmtDate(v.created_at, lang, true)}</span></div><span className="small muted">{v.author ?? '—'}{v.note ? ' · ' + v.note : ''}</span>{can('content.edit') && canEditNow && <button className="btn btn-sm" onClick={() => restore(v)}><Icon name="undo" size={14} />{t('admin.restore')}</button>}</div>)}</div>}</section>}
        </aside>
      </div>
      {mediaOpen && <Modal title={t('admin.insertMedia')} onClose={() => setMediaOpen(false)} wide>
        {!media.data?.length ? <p className="muted">{t('admin.noMedia')} <Link to="/admin/media">{t('admin.n.media')}</Link></p> : <div className="media-grid">{media.data.map((m: any) => (
          <button key={m.id} className="media-item" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => insertMedia(m)}><div className="media-thumb">{m.mime.startsWith('image/') ? <img src={'/media/' + m.stored_name} alt={m.alt_uz || ''} /> : <Icon name={m.mime.startsWith('video/') ? 'video' : 'file'} size={36} />}</div><div className="media-meta"><strong>{m.filename}</strong><span className="muted">{fmtBytes(m.size)}</span></div></button>))}</div>}
      </Modal>}
    </div>
  );
}

function QuestionsEditor({ id }: { id: string }) {
  const { t, toast } = useApp();
  const r = useAsync(s => get<any>(`/api/admin/content/${id}/questions`, s), [id]);
  const [qs_, setQs] = useState<any[] | null>(null); const [pass, setPass] = useState(60); const [saving, setSaving] = useState(false);
  useEffect(() => { if (r.data) { setQs(r.data.questions); setPass(r.data.passPercent); } }, [r.data]);
  if (r.loading && !qs_) return <Loading />; if (r.error) return <ErrorState error={r.error} onRetry={r.reload} />; if (!qs_) return null;
  const upd = (i: number, p: any) => setQs(qs_.map((x, j) => j === i ? { ...x, ...p } : x));
  const save = async () => { setSaving(true); try { await put(`/api/admin/content/${id}/questions`, { passPercent: pass, questions: qs_.map(x => ({ q: clean(x.q), options: x.options.map(clean), correctIndex: x.correctIndex, explanation: clean(x.explanation ?? {}) })) }); toast(t('common.saved'), 'success'); r.reload(); } catch (e: any) { toast(t('admin.err.invalid') + (e.message && e.message !== e.code ? ': ' + e.message : ''), 'error'); } finally { setSaving(false); } };
  return (
    <section className="panel" aria-labelledby="qe-h"><div className="block-head"><h2 id="qe-h" style={{ margin: 0 }}>{t('admin.questions')}</h2><button className="btn btn-sm btn-primary" disabled={saving} onClick={save}><Icon name="save" size={14} />{t('admin.saveQuestions')}</button></div>
      <Field label={t('admin.passPercent')} htmlFor="qe-p"><input id="qe-p" type="number" min={1} max={100} value={pass} onChange={e => setPass(+e.target.value)} style={{ maxWidth: 120 }} /></Field>
      {qs_.map((x, i) => (
        <fieldset key={i}><legend>{i + 1}</legend>
          {(['uz', 'ru', 'en'] as const).map(l => <Field key={l} label={`${t('admin.question')} (${l.toUpperCase()})`} htmlFor={`q${i}${l}`}><input id={`q${i}${l}`} type="text" value={x.q[l] ?? ''} onChange={e => upd(i, { q: { ...x.q, [l]: e.target.value } })} /></Field>)}
          <p className="small muted">{t('admin.optionsHint')}</p>
          {x.options.map((o: any, k: number) => (
            <div key={k} className="row2" style={{ alignItems: 'end', gridTemplateColumns: 'auto 1fr 1fr 1fr auto' }}>
              <label className="check" title={t('admin.correct')}><input type="radio" name={'c' + i} checked={x.correctIndex === k} onChange={() => upd(i, { correctIndex: k })} /><span className="sr-only">{t('admin.correct')}</span></label>
              {(['uz', 'ru', 'en'] as const).map(l => <input key={l} type="text" aria-label={`${t('admin.option')} ${k + 1} ${l.toUpperCase()}`} placeholder={l.toUpperCase()} value={o[l] ?? ''} onChange={e => upd(i, { options: x.options.map((oo: any, kk: number) => kk === k ? { ...oo, [l]: e.target.value } : oo) })} />)}
              <button className="btn btn-sm btn-ghost" disabled={x.options.length <= 2} onClick={() => upd(i, { options: x.options.filter((_: any, kk: number) => kk !== k), correctIndex: Math.min(x.correctIndex, x.options.length - 2) })} aria-label={t('common.delete')}><Icon name="trash" size={14} /></button>
            </div>))}
          <div className="content-actions"><button className="btn btn-sm" disabled={x.options.length >= 8} onClick={() => upd(i, { options: [...x.options, { uz: '' }] })}><Icon name="plus" size={14} />{t('admin.addOption')}</button>
            <button className="btn btn-sm btn-ghost" onClick={() => setQs(qs_.filter((_, j) => j !== i))}><Icon name="trash" size={14} />{t('admin.removeQuestion')}</button></div>
          <Field label={t('admin.explanation') + ' (UZ)'} htmlFor={`ex${i}`}><input id={`ex${i}`} type="text" value={x.explanation?.uz ?? ''} onChange={e => upd(i, { explanation: { ...(x.explanation ?? {}), uz: e.target.value } })} /></Field>
        </fieldset>))}
      <button className="btn" onClick={() => setQs([...qs_, { q: { uz: '' }, options: [{ uz: '' }, { uz: '' }], correctIndex: 0, explanation: {} }])}><Icon name="plus" size={16} />{t('admin.addQuestion')}</button>
    </section>
  );
}
const clean = (o: Record<string, any>) => Object.fromEntries(Object.entries(o).filter(([, v]) => typeof v === 'string' && v.trim()).map(([k, v]) => [k, (v as string).trim()]));
void qs;
