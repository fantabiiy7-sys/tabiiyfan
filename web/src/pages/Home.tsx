import { useState } from 'react';
import { useApp } from '../lib/store';
import { Link, navigate, useTitle } from '../lib/router';
import { get } from '../lib/api';
import { useAsync, Icon, Loading, ErrorState, Empty } from '../components/ui';
import { CardGrid } from '../components/Content';
import { fmtDate, KIND_PATH } from '../lib/util';
import { Sel } from './Catalog';

const KINDS_QUICK = ['lesson', 'method', 'video', 'lab', 'animation', 'assessment'];

export function Home() {
  const { t, lang, siteName, tagline, boot } = useApp(); useTitle(siteName);
  const home = useAsync(s => get<any>('/api/home?lang=' + lang, s), [lang]);
  const [f, setF] = useState({ grade: '', subject: '', topic: '', kind: 'lesson' });
  const topics = (boot?.topics ?? []).filter(x => !f.grade || String(x.grade) === f.grade);
  const go = (e: any) => { e.preventDefault(); const p = new URLSearchParams(); if (f.grade) p.set('grade', f.grade); if (f.subject) p.set('subject', f.subject); if (f.topic && f.kind !== 'method') p.set('topic', f.topic); const s = p.toString(); navigate(`/${KIND_PATH[f.kind]}${s ? '?' + s : ''}`); };
  const d = home.data;
  return (
    <div className="page home">
      <section className="hero">
        <div className="hero-text">
          <p className="eyebrow">{siteName}</p>
          <h1>{t('home.headline')}</h1>
          <p className="lead">{tagline && tagline !== t('home.headline') ? tagline + '. ' : ''}{t('home.purpose')}</p>
          <div className="hero-actions"><Link to="/lessons" className="btn btn-primary btn-lg">{t('home.cta.lessons')}</Link><Link to="/integration" className="btn btn-lg">{t('home.cta.integration')}</Link></div>
        </div>
        <div className="grade-cards">
          {[5, 6].map(g => (
            <Link key={g} to={`/lessons?grade=${g}`} className="grade-card" aria-label={t('home.gradeCardLabel', { n: g })}>
              <span className="grade-num">{g}</span><span className="grade-text"><strong>{t('common.gradeN', { n: g })}</strong><span>{t('home.gradeCardText')}</span></span><Icon name="chevron-right" />
            </Link>
          ))}
        </div>
      </section>

      <section className="quick" aria-label={t('home.quick')}>
        {[['lessons', 'book', 'lesson'], ['methods', 'users', 'method'], ['videos', 'video', 'video'], ['labs', 'flask', 'lab']].map(([p, ic, k]) => (
          <Link key={p} to={'/' + p} className="quick-card"><span className="quick-ic"><Icon name={ic} size={24} /></span><span><strong>{t('kind.' + k + '.plural')}</strong>{d && <small>{t('home.count', { n: d.counts[k] ?? 0 })}</small>}</span></Link>
        ))}
      </section>

      <section className="panel" aria-labelledby="hf">
        <h2 id="hf">{t('home.filterTitle')}</h2>
        <form className="filters-row" onSubmit={go}>
          <Sel id="h-kind" label={t('filters.kind')} value={f.kind} onChange={v => setF({ ...f, kind: v })} all={t('kind.lesson')} opts={KINDS_QUICK.filter(k => k !== 'lesson').map(k => [k, t('kind.' + k)])} />
          <Sel id="h-grade" label={t('filters.grade')} value={f.grade} onChange={v => setF({ ...f, grade: v, topic: '' })} all={t('filters.all')} opts={(boot?.grades ?? []).map(g => [String(g.id), g.name])} />
          <Sel id="h-subject" label={t('filters.subject')} value={f.subject} onChange={v => setF({ ...f, subject: v })} all={t('filters.all')} opts={(boot?.subjects ?? []).filter(s => !s.isCore).map(s => [s.slug, s.name])} />
          <Sel id="h-topic" label={t('filters.topic')} value={f.topic} onChange={v => setF({ ...f, topic: v })} all={t('filters.all')} opts={topics.map(x => [x.slug, x.title])} />
          <div className="field field-btn"><button className="btn btn-primary" type="submit"><Icon name="filter" size={16} />{t('home.filterGo')}</button></div>
        </form>
      </section>

      {home.loading && !d ? <Loading /> : home.error ? <ErrorState error={home.error} onRetry={home.reload} /> : d && <>
        <Block title={t('home.latest')} more="/lessons" items={d.latest} t={t} />
        <Block title={t('home.featured')} more="/lessons" items={d.featured} t={t} />
        <Block title={t('home.integration')} more="/integration" items={d.integration} t={t} lead={t('home.integrationLead')} />
        <Block title={t('home.popularMethods')} more="/methods" items={d.popularMethods} t={t} />
        <section className="split">
          <div className="panel" aria-labelledby="hn"><h2 id="hn"><Icon name="news" /> {t('home.news')}</h2>
            {!d.news.length ? <p className="muted">{t('home.newsEmpty')}</p> : d.news.map((n: any) => (
              <article key={n.id} className="news-item"><h3>{n.title}{n.isDemo && <span className="badge badge-demo">{t('demo.label')}</span>}</h3><time className="muted small">{fmtDate(n.publishedAt, lang)}</time>{n.body && <p>{n.body}</p>}</article>))}
          </div>
          <div className="panel" aria-labelledby="hr"><h2 id="hr"><Icon name="compass" /> {t('home.resources')}</h2>
            <ul className="res-list">
              <li><Link to="/teachers"><Icon name="school" size={18} /><span><strong>{t('res.template')}</strong><small>{t('res.templateText')}</small></span></Link></li>
              <li><Link to="/guides"><Icon name="compass" size={18} /><span><strong>{t('res.guides')}</strong><small>{t('res.guidesText')}</small></span></Link></li>
              <li><Link to="/methods"><Icon name="users" size={18} /><span><strong>{t('res.methods')}</strong><small>{t('res.methodsText')}</small></span></Link></li>
            </ul>
          </div>
        </section>
      </>}
    </div>
  );
}

function Block({ title, items, more, t, lead }: any) {
  if (!items?.length) return null;
  return (
    <section className="block"><div className="block-head"><div><h2>{title}</h2>{lead && <p className="muted">{lead}</p>}</div><Link to={more} className="btn btn-sm">{t('common.viewAll')}<Icon name="chevron-right" size={14} /></Link></div><CardGrid items={items.slice(0, 3)} /></section>
  );
}
