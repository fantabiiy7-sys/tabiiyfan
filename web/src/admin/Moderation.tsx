import { useState } from 'react';
import { useApp } from '../lib/store';
import { Link } from '../lib/router';
import { get, post, qs } from '../lib/api';
import { useAsync, Loading, ErrorState, Empty, Icon, Badge } from '../components/ui';
import { fmtDate } from '../lib/util';

export function Moderation() {
  const { t, lang, can, toast } = useApp();
  const rv = useAsync(s => get<any>('/api/admin/content' + qs({ status: 'in_review', pageSize: 50, lang }), s), [lang]);
  const ap = useAsync(s => get<any>('/api/admin/content' + qs({ status: 'approved', pageSize: 50, lang }), s), [lang]);
  const [comment, setComment] = useState<Record<number, string>>({}); const [busy, setBusy] = useState<number | null>(null);
  const act = async (id: number, to: string) => {
    setBusy(id); try { await post(`/api/admin/content/${id}/transition`, { to, comment: comment[id] || undefined }); toast(t('admin.transitioned'), 'success'); rv.reload(); ap.reload(); }
    catch (e: any) { toast(e.code === 'forbidden' ? t('state.forbidden') : t('state.error'), 'error'); } finally { setBusy(null); }
  };
  const Card = ({ i, stage }: any) => (
    <article className="panel">
      <div className="card-badges"><Badge tone="kind">{t('kind.' + i.kind)}</Badge>{i.grade && <Badge>{t('common.gradeN', { n: i.grade })}</Badge>}{i.isDemo && <Badge tone="demo">{t('demo.label')}</Badge>}</div>
      <h3><Link to={'/admin/content/' + i.id}>{i.title}</Link></h3><p className="muted small">{t('meta.updated')}: {fmtDate(i.updatedAt, lang, true)}</p>
      <div className="field"><label htmlFor={'cm' + i.id}>{t('admin.comment')}</label><input id={'cm' + i.id} type="text" value={comment[i.id] ?? ''} onChange={e => setComment({ ...comment, [i.id]: e.target.value })} maxLength={500} /></div>
      <div className="content-actions">
        <Link className="btn btn-sm" to={'/admin/content/' + i.id}><Icon name="eye" size={14} />{t('admin.openForReview')}</Link>
        {stage === 'in_review' && <><button className="btn btn-sm" disabled={busy === i.id} onClick={() => act(i.id, 'draft')}>{t('admin.returnToDraft')}</button>{can('content.approve') ? <button className="btn btn-sm btn-primary" disabled={busy === i.id} onClick={() => act(i.id, 'approved')}><Icon name="check-circle" size={14} />{t('admin.approve')}</button> : <span className="muted small">{t('admin.noApproveRight')}</span>}</>}
        {stage === 'approved' && (can('content.publish') ? <button className="btn btn-sm btn-primary" disabled={busy === i.id} onClick={() => act(i.id, 'published')}><Icon name="upload" size={14} />{t('admin.publish')}</button> : <span className="muted small">{t('admin.noPublishRight')}</span>)}
      </div>
    </article>
  );
  return (
    <div>
      <div className="admin-head"><div><h1>{t('admin.n.moderation')}</h1><p className="muted">{t('admin.moderationLead')}</p></div></div>
      <h2>{t('status.in_review')} {rv.data && <span className="tab-count">{rv.data.total}</span>}</h2>
      {rv.loading && !rv.data ? <Loading /> : rv.error ? <ErrorState error={rv.error} onRetry={rv.reload} /> : !rv.data.items.length ? <Empty icon="check-circle" title={t('admin.nothingPending')} /> : <div className="grid cards">{rv.data.items.map((i: any) => <Card key={i.id} i={i} stage="in_review" />)}</div>}
      <h2 style={{ marginTop: 28 }}>{t('status.approved')} {ap.data && <span className="tab-count">{ap.data.total}</span>}</h2>
      {ap.loading && !ap.data ? <Loading /> : ap.error ? <ErrorState error={ap.error} onRetry={ap.reload} /> : !ap.data.items.length ? <p className="muted">{t('admin.nothingApproved')}</p> : <div className="grid cards">{ap.data.items.map((i: any) => <Card key={i.id} i={i} stage="approved" />)}</div>}
      <p className="muted small" style={{ marginTop: 24 }}>{t('admin.officialNote')}</p>
    </div>
  );
}
