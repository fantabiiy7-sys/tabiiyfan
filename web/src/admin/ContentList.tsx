import { useEffect, useState } from 'react';
import { useApp } from '../lib/store';
import { Link, useQuery, navigate } from '../lib/router';
import { get, qs, post, del } from '../lib/api';
import { useAsync, Loading, ErrorState, Empty, Pager, StatusBadge, Icon, Badge } from '../components/ui';
import { fmtDate } from '../lib/util';

const PAGE = 20;
export function ContentList() {
  const { t, lang, can, toast, confirm } = useApp(); const [q, setQ] = useQuery();
  const kind = q.get('kind') ?? 'lesson'; const status = q.get('status') ?? ''; const grade = q.get('grade') ?? ''; const text = q.get('q') ?? ''; const page = parseInt(q.get('page') ?? '1', 10) || 1;
  const [draft, setDraft] = useState(text); useEffect(() => { const h = setTimeout(() => { if (draft !== text) setQ({ q: draft, page: undefined }); }, 350); return () => clearTimeout(h); }, [draft]);
  const r = useAsync(s => get<any>('/api/admin/content' + qs({ kind, status, grade, q: text, page, pageSize: PAGE, lang }), s), [kind, status, grade, text, page, lang]);
  const remove = async (i: any) => { if (!(await confirm({ title: t('admin.deleteTitle'), message: t('admin.deleteMsg', { name: i.title }), danger: true, okLabel: t('common.delete') }))) return; try { await del('/api/admin/content/' + i.id); toast(t('common.deleted'), 'success'); r.reload(); } catch (e: any) { toast(e.code === 'forbidden' ? t('state.forbidden') : t('state.error'), 'error'); } };
  return (
    <div>
      <div className="admin-head"><h1>{t('kind.' + kind + '.plural')}</h1>{can('content.create') && <div className="actions"><Link className="btn btn-primary" to={`/admin/content/new?kind=${kind}`}><Icon name="plus" size={16} />{t('common.create')}</Link></div>}</div>
      <div className="toolbar">
        <div className="field grow"><label htmlFor="c-q">{t('filters.keyword')}</label><input id="c-q" type="search" value={draft} onChange={e => setDraft(e.target.value)} /></div>
        <div className="field"><label htmlFor="c-st">{t('admin.status')}</label><select id="c-st" value={status} onChange={e => setQ({ status: e.target.value, page: undefined })}><option value="">{t('filters.all')}</option>{['draft', 'in_review', 'approved', 'published', 'archived'].map(s => <option key={s} value={s}>{t('status.' + s)}</option>)}</select></div>
        <div className="field"><label htmlFor="c-g">{t('filters.grade')}</label><select id="c-g" value={grade} onChange={e => setQ({ grade: e.target.value, page: undefined })}><option value="">{t('filters.all')}</option><option value="5">5</option><option value="6">6</option></select></div>
      </div>
      {r.loading && !r.data ? <Loading /> : r.error ? <ErrorState error={r.error} onRetry={r.reload} /> : !r.data.items.length ? <Empty title={t('empty.noItems')} icon="folder" action={can('content.create') ? <Link className="btn btn-primary" to={`/admin/content/new?kind=${kind}`}>{t('common.create')}</Link> : null} /> : (
        <>
          <div className="table-wrap"><table><thead><tr><th>{t('admin.title2')}</th><th>{t('filters.grade')}</th><th>{t('admin.status')}</th><th>{t('admin.translations')}</th><th>{t('meta.updated')}</th><th><span className="sr-only">{t('common.actions')}</span></th></tr></thead>
            <tbody>{r.data.items.map((i: any) => (
              <tr key={i.id}><td className="cell-title"><Link to={'/admin/content/' + i.id}>{i.title}</Link>{i.isDemo && <> <Badge tone="demo">{t('demo.label')}</Badge></>}{i.isHidden && <> <Badge tone="warn">{t('admin.hidden')}</Badge></>}</td>
                <td>{i.grade ?? '—'}</td><td><StatusBadge status={i.status} /></td>
                <td>{['uz', 'ru', 'en'].map(l => <span key={l} className={'badge ' + (i.translations[l] ? (i.translations[l] === 'final' || i.translations[l] === 'reviewed' ? 'badge-ok' : 'badge-warn') : 'badge-bad')} style={{ marginRight: 4 }} title={i.translations[l] ? t('trstatus.' + i.translations[l]) : t('admin.noTranslation')}>{l.toUpperCase()}</span>)}</td>
                <td className="muted">{fmtDate(i.updatedAt, lang)}</td>
                <td><div className="td-actions"><Link to={'/admin/content/' + i.id} className="btn btn-sm"><Icon name="edit" size={14} />{t('common.edit')}</Link>{i.status === 'published' && <Link className="btn btn-sm" to={`/${({ lesson: 'lessons', method: 'methods', lab: 'labs', animation: 'animations', video: 'videos', ebook: 'ebooks', assessment: 'tests', project: 'projects' } as any)[i.kind]}/${i.slug}`}><Icon name="eye" size={14} /></Link>}{can('content.delete') && <button className="btn btn-sm btn-ghost" onClick={() => remove(i)} aria-label={t('common.delete')}><Icon name="trash" size={14} /></button>}</div></td></tr>))}</tbody></table></div>
          <Pager page={page} pageSize={PAGE} total={r.data.total} onPage={p => setQ({ page: p }, { replace: false })} />
        </>)}
    </div>
  );
}
void post; void navigate;
