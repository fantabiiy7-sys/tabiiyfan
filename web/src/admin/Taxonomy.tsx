import { useState } from 'react';
import { useApp } from '../lib/store';
import { useQuery, useTitle } from '../lib/router';
import { get, post, put, del } from '../lib/api';
import { useAsync, Loading, ErrorState, Empty, Icon, Field, Modal, Tabs, Badge } from '../components/ui';

export function Taxonomy() {
  const { t, can, toast, confirm, reload } = useApp(); const [q, setQ] = useQuery(); const tab = q.get('tab') === 'subjects' ? 'subjects' : 'topics';
  const r = useAsync(s => get<any>('/api/admin/taxonomy', s), []);
  const [edit, setEdit] = useState<any | null>(null); const [saving, setSaving] = useState(false); const [err, setErr] = useState('');
  useTitle(t('admin.n.taxonomy'));
  const canVerify = can('content.approve');
  const errMsg = (e: any) => e.code === 'subject_in_use' ? t('admin.err.inUse') : e.code === 'invalid_input' ? t('admin.err.invalid') : e.code === 'forbidden' ? t('state.forbidden') : /UNIQUE/i.test(e.message || '') ? t('admin.err.exists') : t('state.error');
  const save = async () => {
    setSaving(true); setErr('');
    try {
      const e = edit;
      if (tab === 'subjects') {
        const b = { nameUz: e.name_uz, nameRu: e.name_ru, nameEn: e.name_en, isCore: !!e.is_core, sortOrder: +e.sort_order || 99 };
        if (e.id) await put('/api/admin/subjects/' + e.id, b); else await post('/api/admin/subjects', { ...b, slug: e.slug });
      } else {
        const b = { sectionUz: e.section_uz || undefined, sectionRu: e.section_ru || undefined, sectionEn: e.section_en || undefined, titleUz: e.title_uz, titleRu: e.title_ru || undefined, titleEn: e.title_en || undefined, sortOrder: +e.sort_order || 99, isVerified: !!e.is_verified };
        if (e.id) await put('/api/admin/topics/' + e.id, b); else await post('/api/admin/topics', { ...b, gradeId: +e.grade_id, slug: e.slug });
      }
      toast(t('common.saved'), 'success'); setEdit(null); r.reload(); reload();
    } catch (x: any) { setErr(errMsg(x)); } finally { setSaving(false); }
  };
  const remove = async (kind: 'subjects' | 'topics', row: any) => {
    if (!(await confirm({ title: t('admin.deleteTitle'), message: t('admin.deleteMsg', { name: row.title_uz ?? row.name_uz }), danger: true, okLabel: t('common.delete') }))) return;
    try { await del(`/api/admin/${kind}/${row.id}`); toast(t('common.deleted'), 'success'); r.reload(); reload(); } catch (x: any) { toast(errMsg(x), 'error'); }
  };
  const f = (k: string, v: any) => setEdit({ ...edit, [k]: v });
  return (
    <div>
      <div className="admin-head"><h1>{t('admin.n.taxonomy')}</h1>
        <div className="actions"><button className="btn btn-primary" onClick={() => { setErr(''); setEdit(tab === 'subjects' ? { name_uz: '', name_ru: '', name_en: '', slug: '', is_core: 0, sort_order: 99 } : { grade_id: 5, slug: '', title_uz: '', sort_order: 99, is_verified: 0 }); }}><Icon name="plus" size={16} />{t('common.create')}</button></div></div>
      <div className="callout" role="note"><Icon name="info" size={18} /><div>{t('admin.topicsDemoNote')}</div></div>
      <Tabs value={tab} onChange={k => setQ({ tab: k })} tabs={[{ key: 'topics', label: t('admin.topics'), count: r.data?.topics.length }, { key: 'subjects', label: t('common.subjects'), count: r.data?.subjects.length }]} />
      {r.loading && !r.data ? <Loading /> : r.error ? <ErrorState error={r.error} onRetry={r.reload} /> : tab === 'subjects' ? (
        !r.data.subjects.length ? <Empty title={t('empty.noItems')} /> :
        <div className="table-wrap"><table><thead><tr><th>UZ</th><th>RU</th><th>EN</th><th>slug</th><th>{t('admin.core')}</th><th><span className="sr-only">{t('common.actions')}</span></th></tr></thead>
          <tbody>{r.data.subjects.map((s: any) => <tr key={s.id}><td>{s.name_uz}</td><td>{s.name_ru}</td><td>{s.name_en}</td><td className="muted">{s.slug}</td><td>{s.is_core ? <Badge tone="ok">✓</Badge> : '—'}</td>
            <td className="row-actions"><button className="btn btn-sm" onClick={() => { setErr(''); setEdit({ ...s }); }}>{t('common.edit')}</button><button className="btn btn-sm btn-ghost" onClick={() => remove('subjects', s)} aria-label={t('common.delete')}><Icon name="trash" size={14} /></button></td></tr>)}</tbody></table></div>
      ) : (
        !r.data.topics.length ? <Empty title={t('empty.noItems')} /> :
        <div className="table-wrap"><table><thead><tr><th>{t('filters.grade')}</th><th>{t('admin.title2')}</th><th>{t('filters.section')}</th><th>{t('admin.verified')}</th><th><span className="sr-only">{t('common.actions')}</span></th></tr></thead>
          <tbody>{r.data.topics.map((x: any) => <tr key={x.id}><td>{x.grade_id}</td><td className="cell-title">{x.title_uz}</td><td className="muted">{x.section_uz ?? '—'}</td><td>{x.is_verified ? <Badge tone="ok">{t('admin.verified')}</Badge> : <Badge tone="warn">{t('admin.sample')}</Badge>}</td>
            <td className="row-actions"><button className="btn btn-sm" onClick={() => { setErr(''); setEdit({ ...x }); }}>{t('common.edit')}</button><button className="btn btn-sm btn-ghost" onClick={() => remove('topics', x)} aria-label={t('common.delete')}><Icon name="trash" size={14} /></button></td></tr>)}</tbody></table></div>
      )}
      {edit && <Modal title={edit.id ? t('common.edit') : t('common.create')} onClose={() => setEdit(null)} footer={<><button className="btn" onClick={() => setEdit(null)}>{t('common.cancel')}</button><button className="btn btn-primary" disabled={saving} onClick={save}>{t('common.save')}</button></>}>
        {err && <div className="callout callout-bad" role="alert">{err}</div>}
        {tab === 'subjects' ? <>
          {!edit.id && <Field label="slug" htmlFor="t-slug" hint="a-z, 0-9, -"><input id="t-slug" value={edit.slug} onChange={e => f('slug', e.target.value)} /></Field>}
          <Field label="UZ" htmlFor="t-nu"><input id="t-nu" value={edit.name_uz} onChange={e => f('name_uz', e.target.value)} /></Field>
          <Field label="RU" htmlFor="t-nr"><input id="t-nr" value={edit.name_ru} onChange={e => f('name_ru', e.target.value)} /></Field>
          <Field label="EN" htmlFor="t-ne"><input id="t-ne" value={edit.name_en} onChange={e => f('name_en', e.target.value)} /></Field>
          <label className="check"><input type="checkbox" checked={!!edit.is_core} onChange={e => f('is_core', e.target.checked ? 1 : 0)} />{t('admin.core')}</label>
        </> : <>
          {!edit.id && <><Field label={t('filters.grade')} htmlFor="t-g"><select id="t-g" value={edit.grade_id} onChange={e => f('grade_id', e.target.value)}><option value="5">5</option><option value="6">6</option></select></Field>
            <Field label="slug" htmlFor="t-slug" hint="a-z, 0-9, -"><input id="t-slug" value={edit.slug} onChange={e => f('slug', e.target.value)} /></Field></>}
          <Field label={t('admin.title2') + ' (UZ)'} htmlFor="t-tu"><input id="t-tu" value={edit.title_uz} onChange={e => f('title_uz', e.target.value)} /></Field>
          <Field label={t('admin.title2') + ' (RU)'} htmlFor="t-tr"><input id="t-tr" value={edit.title_ru ?? ''} onChange={e => f('title_ru', e.target.value)} /></Field>
          <Field label={t('admin.title2') + ' (EN)'} htmlFor="t-te"><input id="t-te" value={edit.title_en ?? ''} onChange={e => f('title_en', e.target.value)} /></Field>
          <Field label={t('filters.section') + ' (UZ)'} htmlFor="t-su"><input id="t-su" value={edit.section_uz ?? ''} onChange={e => f('section_uz', e.target.value)} /></Field>
          <Field label={t('filters.section') + ' (RU)'} htmlFor="t-sr"><input id="t-sr" value={edit.section_ru ?? ''} onChange={e => f('section_ru', e.target.value)} /></Field>
          <Field label={t('filters.section') + ' (EN)'} htmlFor="t-se"><input id="t-se" value={edit.section_en ?? ''} onChange={e => f('section_en', e.target.value)} /></Field>
          <label className="check"><input type="checkbox" disabled={!canVerify} checked={!!edit.is_verified} onChange={e => f('is_verified', e.target.checked ? 1 : 0)} />{t('admin.verifiedLabel')}</label>
          {!canVerify && <p className="small muted">{t('admin.verifyOnlyApprover')}</p>}
        </>}
        <Field label={t('admin.order')} htmlFor="t-o"><input id="t-o" type="number" value={edit.sort_order ?? 99} onChange={e => f('sort_order', e.target.value)} style={{ maxWidth: 120 }} /></Field>
      </Modal>}
    </div>
  );
}
