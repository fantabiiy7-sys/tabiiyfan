import { useEffect, useState } from 'react';
import { useApp } from '../lib/store';
import { useQuery, useTitle } from '../lib/router';
import { get, post, put, del, qs } from '../lib/api';
import { useAsync, Loading, ErrorState, Empty, Icon, Field, Modal, Tabs, Badge } from '../components/ui';
import { fmtDate } from '../lib/util';

export function HomeAdmin() {
  const { t } = useApp(); const [q, setQ] = useQuery(); const tab = q.get('tab') === 'home' ? 'home' : 'news'; useTitle(t('admin.n.news'));
  return (<div><div className="admin-head"><h1>{tab === 'home' ? t('admin.n.home') : t('admin.n.news')}</h1></div>
    <Tabs value={tab} onChange={k => setQ({ tab: k === 'home' ? 'home' : undefined })} tabs={[{ key: 'news', label: t('admin.n.news') }, { key: 'home', label: t('admin.n.home') }]} />
    {tab === 'home' ? <HomeConfig /> : <News />}</div>);
}

function News() {
  const { t, lang, toast, confirm, reload } = useApp();
  const r = useAsync(s => get<any[]>('/api/admin/announcements', s), []);
  const [e, setE] = useState<any | null>(null); const [saving, setSaving] = useState(false);
  const f = (k: string, v: any) => setE({ ...e, [k]: v });
  const save = async () => {
    if (!e.title_uz?.trim()) { toast(t('admin.err.sourceTitle'), 'error'); return; }
    setSaving(true);
    const b = { titleUz: e.title_uz, titleRu: e.title_ru || undefined, titleEn: e.title_en || undefined, bodyUz: e.body_uz || undefined, bodyRu: e.body_ru || undefined, bodyEn: e.body_en || undefined, status: e.status, isDemo: !!e.is_demo };
    try { if (e.id) await put('/api/admin/announcements/' + e.id, b); else await post('/api/admin/announcements', b); toast(t('common.saved'), 'success'); setE(null); r.reload(); reload(); }
    catch (x: any) { toast(x.status === 403 ? t('state.forbidden') : t('state.error'), 'error'); } finally { setSaving(false); }
  };
  const remove = async (a: any) => { if (!(await confirm({ title: t('admin.deleteTitle'), message: t('admin.deleteMsg', { name: a.title_uz }), danger: true, okLabel: t('common.delete') }))) return; try { await del('/api/admin/announcements/' + a.id); toast(t('common.deleted'), 'success'); r.reload(); reload(); } catch { toast(t('state.error'), 'error'); } };
  return (<>
    <div className="actions" style={{ margin: '12px 0' }}><button className="btn btn-primary" onClick={() => setE({ title_uz: '', body_uz: '', status: 'draft', is_demo: 0 })}><Icon name="plus" size={16} />{t('common.create')}</button></div>
    {r.loading && !r.data ? <Loading /> : r.error ? <ErrorState error={r.error} onRetry={r.reload} /> : !r.data!.length ? <Empty title={t('empty.noItems')} icon="news" /> :
      <div className="table-wrap"><table><thead><tr><th>{t('admin.title2')}</th><th>{t('admin.status')}</th><th>{t('meta.updated')}</th><th /></tr></thead>
        <tbody>{r.data!.map(a => <tr key={a.id}><td className="cell-title">{a.title_uz}{a.is_demo ? <> <Badge tone="demo">{t('demo.label')}</Badge></> : null}</td><td><Badge tone={a.status === 'published' ? 'ok' : 'neutral'}>{t('status.' + a.status)}</Badge></td><td className="muted">{fmtDate(a.published_at ?? a.created_at, lang)}</td>
          <td className="row-actions"><button className="btn btn-sm" onClick={() => setE({ ...a })}>{t('common.edit')}</button><button className="btn btn-sm btn-ghost" onClick={() => remove(a)} aria-label={t('common.delete')}><Icon name="trash" size={14} /></button></td></tr>)}</tbody></table></div>}
    {e && <Modal wide title={e.id ? t('common.edit') : t('common.create')} onClose={() => setE(null)} footer={<><button className="btn" onClick={() => setE(null)}>{t('common.cancel')}</button><button className="btn btn-primary" disabled={saving} onClick={save}>{t('common.save')}</button></>}>
      {(['uz', 'ru', 'en'] as const).map(l => <div key={l}><Field label={`${t('admin.title2')} (${l.toUpperCase()})`} htmlFor={'nt' + l}><input id={'nt' + l} value={e['title_' + l] ?? ''} maxLength={200} onChange={x => f('title_' + l, x.target.value)} /></Field>
        <Field label={`${t('admin.text')} (${l.toUpperCase()})`} htmlFor={'nb' + l}><textarea id={'nb' + l} value={e['body_' + l] ?? ''} maxLength={4000} onChange={x => f('body_' + l, x.target.value)} /></Field></div>)}
      <Field label={t('admin.status')} htmlFor="ns"><select id="ns" value={e.status} onChange={x => f('status', x.target.value)}>{['draft', 'published', 'archived'].map(s => <option key={s} value={s}>{t('status.' + s)}</option>)}</select></Field>
      <label className="check"><input type="checkbox" checked={!!e.is_demo} onChange={x => f('is_demo', x.target.checked ? 1 : 0)} />{t('admin.isDemo')}</label>
    </Modal>}
  </>);
}

function HomeConfig() {
  const { t, lang, toast, reload } = useApp();
  const st = useAsync(s => get<Record<string, string>>('/api/admin/settings', s), []);
  const lessons = useAsync(s => get<any>('/api/content' + qs({ kind: 'lesson', pageSize: 50, lang }), s), [lang]);
  const methods = useAsync(s => get<any>('/api/content' + qs({ kind: 'method', pageSize: 50, lang }), s), [lang]);
  const [fl, setFl] = useState<string[]>([]); const [ms, setMs] = useState<string[]>([]);
  useEffect(() => { if (st.data) { try { const c = JSON.parse(st.data.home_config || '{}'); setFl(c.featuredLessonSlugs ?? []); setMs(c.methodSlugs ?? []); } catch { /* bo'sh */ } } }, [st.data]);
  if ((st.loading && !st.data) || (lessons.loading && !lessons.data)) return <Loading />; if (st.error) return <ErrorState error={st.error} onRetry={st.reload} />;
  const tog = (arr: string[], set: (a: string[]) => void, s: string, max: number) => set(arr.includes(s) ? arr.filter(x => x !== s) : arr.length >= max ? arr : [...arr, s]);
  const save = async () => { try { await put('/api/admin/home', { featuredLessonSlugs: fl, methodSlugs: ms }); toast(t('common.saved'), 'success'); reload(); } catch (x: any) { toast(x.status === 403 ? t('state.forbidden') : t('state.error'), 'error'); } };
  return (<section className="panel" style={{ marginTop: 12 }}><p className="muted small">{t('admin.homeNote')}</p>
    <fieldset><legend>{t('home.featured')} ({fl.length}/6)</legend>{(lessons.data?.items ?? []).map((i: any) => <label className="check" key={i.slug}><input type="checkbox" checked={fl.includes(i.slug)} onChange={() => tog(fl, setFl, i.slug, 6)} />{i.title}</label>)}</fieldset>
    <fieldset><legend>{t('home.methods')} ({ms.length}/6)</legend>{(methods.data?.items ?? []).map((i: any) => <label className="check" key={i.slug}><input type="checkbox" checked={ms.includes(i.slug)} onChange={() => tog(ms, setMs, i.slug, 6)} />{i.title}</label>)}</fieldset>
    <button className="btn btn-primary" onClick={save}><Icon name="save" size={16} />{t('common.save')}</button></section>);
}

export function NavAdmin() {
  const { t, toast, confirm, reload } = useApp(); useTitle(t('admin.n.nav'));
  const r = useAsync(s => get<any[]>('/api/admin/nav', s), []);
  const [e, setE] = useState<any | null>(null); const [err, setErr] = useState('');
  const f = (k: string, v: any) => setE({ ...e, [k]: v });
  const save = async () => {
    setErr('');
    const b = { parentId: e.parent_id ? +e.parent_id : null, path: e.path || null, icon: e.icon || null, labelUz: e.label_uz, labelRu: e.label_ru, labelEn: e.label_en, sortOrder: +e.sort_order || 99, isVisible: !!e.is_visible };
    try { if (e.id) await put('/api/admin/nav/' + e.id, b); else await post('/api/admin/nav', { ...b, key: e.key }); toast(t('common.saved'), 'success'); setE(null); r.reload(); reload(); }
    catch (x: any) { setErr(x.code === 'invalid_input' ? t('admin.err.invalid') : x.status === 403 ? t('state.forbidden') : t('admin.err.exists')); }
  };
  const remove = async (n: any) => { if (!(await confirm({ title: t('admin.deleteTitle'), message: t('admin.deleteMsg', { name: n.label_uz }), danger: true, okLabel: t('common.delete') }))) return; try { await del('/api/admin/nav/' + n.id); toast(t('common.deleted'), 'success'); r.reload(); reload(); } catch { toast(t('state.error'), 'error'); } };
  const toggle = async (n: any) => { try { await put('/api/admin/nav/' + n.id, { parentId: n.parent_id, path: n.path, icon: n.icon, labelUz: n.label_uz, labelRu: n.label_ru, labelEn: n.label_en, sortOrder: n.sort_order, isVisible: !n.is_visible }); r.reload(); reload(); } catch { toast(t('state.error'), 'error'); } };
  const top = (r.data ?? []).filter(n => !n.parent_id);
  return (<div><div className="admin-head"><h1>{t('admin.n.nav')}</h1><div className="actions"><button className="btn btn-primary" onClick={() => { setErr(''); setE({ key: '', label_uz: '', label_ru: '', label_en: '', path: '', icon: '', parent_id: '', sort_order: 99, is_visible: 1 }); }}><Icon name="plus" size={16} />{t('common.create')}</button></div></div>
    <p className="muted small">{t('admin.navNote')}</p>
    {r.loading && !r.data ? <Loading /> : r.error ? <ErrorState error={r.error} onRetry={r.reload} /> :
      <div className="table-wrap"><table><thead><tr><th>{t('admin.order')}</th><th>UZ</th><th>RU</th><th>EN</th><th>{t('admin.path')}</th><th>{t('admin.visible')}</th><th /></tr></thead>
        <tbody>{r.data!.map(n => <tr key={n.id}><td>{n.sort_order}</td><td style={{ paddingLeft: n.parent_id ? 28 : undefined }}>{n.parent_id ? '↳ ' : ''}{n.label_uz}</td><td>{n.label_ru}</td><td>{n.label_en}</td><td className="muted small">{n.path ?? '—'}</td>
          <td><button className="btn btn-sm" role="switch" aria-checked={!!n.is_visible} onClick={() => toggle(n)}>{n.is_visible ? t('common.yes') : t('common.no')}</button></td>
          <td className="row-actions"><button className="btn btn-sm" onClick={() => { setErr(''); setE({ ...n }); }}>{t('common.edit')}</button><button className="btn btn-sm btn-ghost" onClick={() => remove(n)} aria-label={t('common.delete')}><Icon name="trash" size={14} /></button></td></tr>)}</tbody></table></div>}
    {e && <Modal title={e.id ? t('common.edit') : t('common.create')} onClose={() => setE(null)} footer={<><button className="btn" onClick={() => setE(null)}>{t('common.cancel')}</button><button className="btn btn-primary" onClick={save}>{t('common.save')}</button></>}>
      {err && <div className="callout callout-bad" role="alert">{err}</div>}
      {!e.id && <Field label="key" htmlFor="n-k" hint="a-z, 0-9, _ . -"><input id="n-k" value={e.key} onChange={x => f('key', x.target.value)} /></Field>}
      {(['uz', 'ru', 'en'] as const).map(l => <Field key={l} label={l.toUpperCase()} htmlFor={'n-' + l}><input id={'n-' + l} value={e['label_' + l]} maxLength={80} onChange={x => f('label_' + l, x.target.value)} /></Field>)}
      <Field label={t('admin.path')} htmlFor="n-p"><input id="n-p" value={e.path ?? ''} onChange={x => f('path', x.target.value)} placeholder="/lessons" /></Field>
      <Field label={t('admin.icon')} htmlFor="n-i"><input id="n-i" value={e.icon ?? ''} onChange={x => f('icon', x.target.value)} /></Field>
      <Field label={t('admin.parent')} htmlFor="n-pa"><select id="n-pa" value={e.parent_id ?? ''} onChange={x => f('parent_id', x.target.value)}><option value="">—</option>{top.filter(x => x.id !== e.id).map(x => <option key={x.id} value={x.id}>{x.label_uz}</option>)}</select></Field>
      <Field label={t('admin.order')} htmlFor="n-o"><input id="n-o" type="number" value={e.sort_order} onChange={x => f('sort_order', x.target.value)} style={{ maxWidth: 120 }} /></Field>
      <label className="check"><input type="checkbox" checked={!!e.is_visible} onChange={x => f('is_visible', x.target.checked ? 1 : 0)} />{t('admin.visible')}</label>
    </Modal>}
  </div>);
}
