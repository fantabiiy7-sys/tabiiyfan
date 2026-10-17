import { useState } from 'react';
import { useApp } from '../lib/store';
import { Link, useTitle } from '../lib/router';
import { get, qs } from '../lib/api';
import { useAsync, Loading, ErrorState, Empty, Pager, Icon } from '../components/ui';
import { fmtDate } from '../lib/util';

export function System({ which }: { which: string }) {
  if (which === 'audit') return <Audit />; if (which === 'versions') return <Versions />; return <Backup />;
}
function Audit() {
  const { t, lang } = useApp(); useTitle(t('admin.n.audit'));
  const [page, setPage] = useState(1); const [action, setAction] = useState(''); const [actor, setActor] = useState(''); const [f, setF] = useState({ action: '', actor: '' });
  const r = useAsync(s => get<any>('/api/admin/audit' + qs({ page, ...f }), s), [page, f]);
  return (<div><div className="admin-head"><h1>{t('admin.n.audit')}</h1></div>
    <form className="toolbar" onSubmit={e => { e.preventDefault(); setPage(1); setF({ action, actor }); }}>
      <div className="field"><label htmlFor="au-a">{t('admin.action')}</label><input id="au-a" value={action} onChange={e => setAction(e.target.value)} placeholder="content." /></div>
      <div className="field"><label htmlFor="au-u">{t('admin.actor')}</label><input id="au-u" value={actor} onChange={e => setActor(e.target.value)} /></div>
      <button className="btn btn-primary">{t('filters.apply')}</button></form>
    {r.loading && !r.data ? <Loading /> : r.error ? <ErrorState error={r.error} onRetry={r.reload} /> : !r.data.items.length ? <Empty title={t('empty.noItems')} icon="clock" /> : <>
      <div className="table-wrap"><table><thead><tr><th>{t('admin.time')}</th><th>{t('admin.actor')}</th><th>{t('admin.action')}</th><th>{t('admin.object')}</th><th>IP</th></tr></thead>
        <tbody>{r.data.items.map((a: any) => <tr key={a.id}><td className="muted small">{fmtDate(a.created_at, lang, true)}</td><td>{a.actor_email ?? '—'}</td><td><code>{a.action}</code></td><td className="small">{a.entity}{a.entity_id ? ' #' + a.entity_id : ''}</td><td className="muted small">{a.ip ?? ''}</td></tr>)}</tbody></table></div>
      <Pager page={page} pageSize={50} total={r.data.total} onPage={setPage} /></>}</div>);
}
function Versions() {
  const { t, lang } = useApp(); useTitle(t('admin.n.versions'));
  const r = useAsync(s => get<any>('/api/admin/versions', s), []);
  if (r.loading && !r.data) return <Loading />; if (r.error) return <ErrorState error={r.error} onRetry={r.reload} />;
  return (<div><div className="admin-head"><h1>{t('admin.n.versions')}</h1></div>
    <section className="panel"><h2>{t('admin.contentVersions')}</h2>{!r.data.content.length ? <p className="muted">—</p> :
      <div className="table-wrap"><table><thead><tr><th>{t('admin.title2')}</th><th>v</th><th>{t('meta.author')}</th><th>{t('admin.time')}</th><th>{t('admin.note')}</th></tr></thead>
        <tbody>{r.data.content.map((v: any) => <tr key={v.id}><td><Link to={'/admin/content/' + v.content_id}>{v.title ?? v.slug}</Link></td><td>v{v.version_no}</td><td>{v.author ?? '—'}</td><td className="muted small">{fmtDate(v.created_at, lang, true)}</td><td className="small">{v.note ?? ''}</td></tr>)}</tbody></table></div>}</section>
    <section className="panel"><h2>{t('admin.projectVersions')}</h2>{!r.data.projects.length ? <p className="muted">—</p> :
      <div className="table-wrap"><table><thead><tr><th>{t('admin.studioProject')}</th><th>v</th><th>{t('meta.author')}</th><th>{t('admin.time')}</th><th>{t('admin.note')}</th></tr></thead>
        <tbody>{r.data.projects.map((v: any) => <tr key={v.id}><td><Link to={'/studio?project=' + v.project_id}>{v.name}</Link></td><td>v{v.version_no}</td><td>{v.author ?? '—'}</td><td className="muted small">{fmtDate(v.created_at, lang, true)}</td><td className="small">{v.note ?? v.kind}</td></tr>)}</tbody></table></div>}</section></div>);
}
function Backup() {
  const { t } = useApp(); useTitle(t('admin.n.backup'));
  return (<div><div className="admin-head"><h1>{t('admin.n.backup')}</h1></div>
    <section className="panel"><h2>{t('admin.exportJson')}</h2><p className="muted">{t('admin.exportNote')}</p>
      <a className="btn btn-primary" href="/api/admin/export" download><Icon name="download" size={16} />{t('admin.exportBtn')}</a></section>
    <section className="panel"><h2>{t('admin.fullBackup')}</h2><p className="muted">{t('admin.fullBackupNote')}</p><pre className="formula">node scripts/backup.mjs   # data/app.db + data/uploads → backups/</pre></section></div>);
}
