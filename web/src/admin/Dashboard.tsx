import { useApp } from '../lib/store';
import { Link } from '../lib/router';
import { get } from '../lib/api';
import { useAsync, Loading, ErrorState, Icon, Empty } from '../components/ui';
import { fmtDate, fmtBytes } from '../lib/util';

const KINDS = ['lesson', 'method', 'lab', 'animation', 'video', 'ebook', 'assessment', 'project'];
export function Dashboard() {
  const { t, lang, can, me } = useApp();
  const d = useAsync(s => get<any>('/api/admin/dashboard?lang=' + lang, s), [lang]);
  if (d.loading && !d.data) return <Loading />; if (d.error) return <ErrorState error={d.error} onRetry={d.reload} />;
  const x = d.data; const cnt = (k: string, st?: string) => x.byKind.filter((r: any) => r.kind === k && (!st || r.status === st)).reduce((a: number, r: any) => a + r.n, 0);
  const total = (st: string) => x.byKind.filter((r: any) => r.status === st).reduce((a: number, r: any) => a + r.n, 0);
  return (
    <div>
      <div className="admin-head"><div><h1>{t('admin.n.dashboard')}</h1><p className="muted">{t('admin.welcome', { name: me?.fullName ?? '' })}</p></div>
        <div className="actions">{can('content.create') && <Link className="btn btn-primary" to="/admin/content/new?kind=lesson"><Icon name="plus" size={16} />{t('admin.newLesson')}</Link>}{can('studio.use') && <Link className="btn" to="/studio"><Icon name="code" size={16} />HTML Studio</Link>}</div></div>
      <div className="stat-grid">
        <div className="stat"><b>{total('published')}</b><span>{t('status.published')}</span></div>
        <div className="stat"><b>{total('in_review')}</b><span>{t('status.in_review')}</span></div>
        <div className="stat"><b>{total('draft')}</b><span>{t('status.draft')}</span></div>
        <div className="stat"><b>{x.projects}</b><span>{t('admin.studioProjects')}</span></div>
        {x.users !== null && <div className="stat"><b>{x.users}</b><span>{t('admin.n.users')}</span></div>}
        <div className="stat"><b>{x.media.n}</b><span>{t('admin.n.media')} · {fmtBytes(x.media.bytes)}</span></div>
      </div>
      {x.demoCount > 0 && <div className="callout callout-demo" role="note"><Icon name="info" size={18} /><div>{t('admin.demoNote', { n: x.demoCount })}</div></div>}
      <div className="split">
        <section className="panel"><h2>{t('admin.byKind')}</h2>
          <div className="table-wrap"><table><thead><tr><th>{t('filters.kind')}</th><th>{t('status.published')}</th><th>{t('status.in_review')}</th><th>{t('status.draft')}</th></tr></thead>
            <tbody>{KINDS.map(k => <tr key={k}><th scope="row"><Link to={'/admin/content?kind=' + k}>{t('kind.' + k + '.plural')}</Link></th><td>{cnt(k, 'published')}</td><td>{cnt(k, 'in_review')}</td><td>{cnt(k, 'draft')}</td></tr>)}</tbody></table></div></section>
        <section className="panel"><h2><Icon name="check-circle" /> {t('admin.awaiting')}</h2>
          {!x.pendingReview.length ? <p className="muted">{t('admin.nothingPending')}</p> : <ul className="timeline">{x.pendingReview.map((i: any) => <li key={i.id}><Link to={'/admin/content/' + i.id}>{i.title}</Link> <span className="muted small">· {t('kind.' + i.kind)}</span></li>)}</ul>}
          {can('content.review') && <Link to="/admin/moderation" className="btn btn-sm">{t('admin.n.moderation')}</Link>}
        </section>
      </div>
      {can('audit.read') && <section className="panel"><h2><Icon name="clock" /> {t('admin.recent')}</h2>
        {!x.recentActivity.length ? <Empty title={t('empty.noItems')} icon="clock" /> : <div className="table-wrap"><table><tbody>{x.recentActivity.map((a: any) => <tr key={a.id}><td><code>{a.action}</code></td><td>{a.actor_email ?? '—'}</td><td className="muted">{fmtDate(a.created_at, lang, true)}</td></tr>)}</tbody></table></div>}
      </section>}
    </div>
  );
}
