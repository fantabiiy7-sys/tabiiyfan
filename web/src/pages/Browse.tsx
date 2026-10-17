import { useState } from 'react';
import { useApp } from '../lib/store';
import { Link, useQuery, useTitle } from '../lib/router';
import { get, qs } from '../lib/api';
import { useAsync, Empty, ErrorState, Loading, Pager, Icon, Badge } from '../components/ui';
import { CardGrid, CardSkeletons } from '../components/Content';
import { itemPath } from '../lib/util';

export function Topics() {
  const { t, boot } = useApp(); useTitle(t('topics.title') + ' — ' + t('site.short'));
  const counts = useAsync(s => get<any>('/api/content?kind=lesson&pageSize=48', s), []);
  const topics = boot?.topics ?? [];
  const lessonsBy = (slug: string) => (counts.data?.items ?? []).filter((i: any) => i.topic?.slug === slug).length;
  return (
    <div className="page">
      <header className="page-head"><h1>{t('topics.title')}</h1><p className="lead">{t('topics.lead')}</p></header>
      {(boot?.grades ?? []).map(g => {
        const bySection: Record<string, typeof topics> = {};
        topics.filter(x => x.grade === g.id).forEach(x => { (bySection[x.section || '—'] ||= []).push(x); });
        return (
          <section key={g.id} className="block" aria-labelledby={'g' + g.id}>
            <h2 id={'g' + g.id}>{g.name}</h2>
            {!Object.keys(bySection).length ? <Empty title={t('empty.noTopics')} icon="book" /> : Object.entries(bySection).map(([sec, list]) => (
              <div key={sec} className="topic-sec"><h3>{sec}</h3>
                <ul className="topic-list">{list.map(x => (
                  <li key={x.slug}><Link to={`/lessons?topic=${x.slug}`} className="topic-link"><span className="topic-title">{x.title}</span>
                    <span className="muted small">{counts.loading ? '…' : t('topics.lessonsCount', { n: lessonsBy(x.slug) })}</span>
                    {!x.verified && <Badge tone="warn" title={t('topics.unverifiedHint')}>{t('topics.unverified')}</Badge>}</Link></li>))}</ul>
              </div>))}
          </section>
        );
      })}
      <p className="muted small">{t('topics.note')}</p>
    </div>
  );
}

export function Integration() {
  const { t, lang, boot } = useApp(); useTitle(t('integration.title') + ' — ' + t('site.short'));
  const [q, setQ] = useQuery(); const subject = q.get('subject') ?? ''; const page = parseInt(q.get('page') ?? '1', 10) || 1;
  const subjects = (boot?.subjects ?? []).filter(s => !s.isCore);
  const all = useAsync(s => get<any>('/api/content?kind=lesson&pageSize=48&lang=' + lang, s), [lang]);
  const list = useAsync(s => get<any>('/api/content' + qs({ kind: 'lesson', subject, page, pageSize: 9, lang }), s), [subject, page, lang]);
  const countFor = (slug: string) => (all.data?.items ?? []).filter((i: any) => i.subjects.some((x: any) => x.slug === slug)).length;
  return (
    <div className="page">
      <header className="page-head"><h1>{t('integration.title')}</h1><p className="lead">{t('integration.lead')}</p></header>
      <ul className="subject-grid" aria-label={t('integration.directions')}>
        {subjects.map(s => (
          <li key={s.slug}><button className={'subject-card' + (subject === s.slug ? ' active' : '')} aria-pressed={subject === s.slug} onClick={() => setQ({ subject: subject === s.slug ? undefined : s.slug, page: undefined })}>
            <strong>{t('integration.with', { s: s.name })}</strong><span className="muted small">{all.loading ? '…' : t('topics.lessonsCount', { n: countFor(s.slug) })}</span></button></li>
        ))}
      </ul>
      <section className="block" aria-live="polite">
        {list.loading && !list.data ? <CardSkeletons n={3} /> : list.error ? <ErrorState error={list.error} onRetry={list.reload} /> :
          !list.data.items.length ? <Empty title={t('empty.noResults')} text={t('integration.empty')} /> : <><CardGrid items={list.data.items} /><Pager page={page} pageSize={9} total={list.data.total} onPage={p => setQ({ page: p }, { replace: false })} /></>}
      </section>
    </div>
  );
}

export function SearchPage() {
  const { t, lang, boot } = useApp(); const [q, setQ] = useQuery(); const text = q.get('q') ?? ''; const kind = q.get('kind') ?? ''; const grade = q.get('grade') ?? ''; const subject = q.get('subject') ?? ''; const page = parseInt(q.get('page') ?? '1', 10) || 1;
  useTitle(t('search.title') + (text ? ': ' + text : '') + ' — ' + t('site.short'));
  const [draft, setDraft] = useState(text);
  const r = useAsync(s => text.trim().length >= 2 ? get<any>('/api/search' + qs({ q: text, kind, grade, subject, page, lang }), s) : Promise.resolve(null), [text, kind, grade, subject, page, lang]);
  return (
    <div className="page">
      <header className="page-head"><h1>{t('search.title')}</h1></header>
      <form className="filters search-form" role="search" onSubmit={e => { e.preventDefault(); setQ({ q: draft, page: undefined }, { replace: false }); }}>
        <div className="filters-row">
          <div className="field grow"><label htmlFor="s-q">{t('search.label')}</label><div className="input-icon"><Icon name="search" size={16} /><input id="s-q" type="search" value={draft} onChange={e => setDraft(e.target.value)} autoFocus={!text} placeholder={t('search.placeholder')} /></div></div>
          <div className="field"><label htmlFor="s-kind">{t('filters.kind')}</label><select id="s-kind" value={kind} onChange={e => setQ({ kind: e.target.value, page: undefined })}><option value="">{t('filters.all')}</option>{['lesson', 'method', 'lab', 'animation', 'video', 'ebook', 'assessment', 'project'].map(k => <option key={k} value={k}>{t('kind.' + k)}</option>)}</select></div>
          <div className="field"><label htmlFor="s-grade">{t('filters.grade')}</label><select id="s-grade" value={grade} onChange={e => setQ({ grade: e.target.value, page: undefined })}><option value="">{t('filters.all')}</option>{(boot?.grades ?? []).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
          <div className="field"><label htmlFor="s-sub">{t('filters.subject')}</label><select id="s-sub" value={subject} onChange={e => setQ({ subject: e.target.value, page: undefined })}><option value="">{t('filters.all')}</option>{(boot?.subjects ?? []).filter(s => !s.isCore).map(s => <option key={s.slug} value={s.slug}>{s.name}</option>)}</select></div>
          <div className="field field-btn"><button className="btn btn-primary" type="submit">{t('search.go')}</button></div>
        </div>
      </form>
      <div aria-live="polite">
        {text.trim().length < 2 ? <Empty title={t('search.hint')} text={t('search.hintText')} /> : r.loading && !r.data ? <Loading /> : r.error ? <ErrorState error={r.error} onRetry={r.reload} /> : r.data && (
          <>
            <div className="result-meta">{t('search.found', { n: r.data.total, q: text })}</div>
            {!!r.data.topics?.length && <section className="block"><h2 className="h3">{t('search.topicsFound')}</h2><ul className="chips">{r.data.topics.map((x: any) => <li key={x.slug}><Link className="chip chip-link" to={`/lessons?topic=${x.slug}`}>{x.title} · {t('common.gradeN', { n: x.grade })}</Link></li>)}</ul></section>}
            {!r.data.items.length ? <Empty title={t('search.noResults', { q: text })} text={t('search.noResultsHint')} action={<Link className="btn" to="/lessons">{t('search.browseAll')}</Link>} /> : <><CardGrid items={r.data.items} /><Pager page={page} pageSize={r.data.pageSize} total={r.data.total} onPage={p => setQ({ page: p }, { replace: false })} /></>}
          </>)}
      </div>
    </div>
  );
}
