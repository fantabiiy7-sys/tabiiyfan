import { useEffect, useState } from 'react';
import { useApp } from '../lib/store';
import { Link, useTitle, useLocation } from '../lib/router';
import { get } from '../lib/api';
import { useAsync, Icon, Badge, Loading, ErrorState, StatusBadge } from '../components/ui';
import { Blocks, Embed, Quiz, MaterialCard } from '../components/Content';
import { fmtDate, fmtBytes, KIND_PATH, cx } from '../lib/util';
import { NotFound } from './Static';

const SEC_TITLE = (t: any, key: string) => /^s\d+$/.test(key) ? t('lesson.sec.' + key) : t((key in METHOD_KEYS ? 'method.sec.' : 'sec.') + key);
const METHOD_KEYS: Record<string, 1> = { purpose: 1, applicability: 1, steps: 1, materials: 1, timing: 1, student: 1, teacher: 1, assessment: 1 };

export function ContentPage({ slug }: { slug: string }) {
  const { t, lang, can, boot } = useApp(); const loc = useLocation();
  const q = useAsync(s => get<any>(`/api/content/${slug}?lang=${lang}`, s), [slug, lang]);
  const hist = useAsync(s => get<any[]>(`/api/content/${slug}/history`, s).catch(() => []), [slug, q.data?.updatedAt]);
  const item = q.data;
  useTitle(item ? `${item.title} — ${t('site.short')}` : t('state.loading'));
  useEffect(() => { if (item && loc.full.includes('#interactive')) document.getElementById('interactive')?.scrollIntoView(); }, [item?.id]);
  if (q.loading && !item) return <div className="page"><Loading /></div>;
  if (q.error) return q.error.status === 404 ? <NotFound /> : <div className="page"><ErrorState error={q.error} onRetry={q.reload} /></div>;
  const sections: { key: string; blocks: any[] }[] = item.body?.sections ?? [];
  const kindPlural = '/' + KIND_PATH[item.kind];
  const showToc = sections.length > 5;
  const topicInfo = (boot?.topics ?? []).find(x => x.slug === item.topic?.slug);
  const trStatus = item.translations?.[item.lang];
  return (
    <div className="page content-page">
      <nav className="breadcrumbs" aria-label={t('a11y.breadcrumbs')}>
        <Link to="/">{t('nav.home')}</Link><Icon name="chevron-right" size={12} /><Link to={kindPlural}>{t('kind.' + item.kind + '.plural')}</Link><Icon name="chevron-right" size={12} /><span aria-current="page">{item.title}</span>
      </nav>
      <div className="print-only print-head"><strong>{t('site.name')}</strong> · {location.origin}{location.pathname} · {fmtDate(new Date().toISOString(), lang)}</div>
      <header className="content-head">
        <div className="card-badges">
          <Badge tone="kind">{t('kind.' + item.kind)}</Badge>{item.grade && <Badge>{t('common.gradeN', { n: item.grade })}</Badge>}
          {item.isDemo && <Badge tone="demo" title={t('demo.itemHint')}>{t('demo.label')}</Badge>}
          {item.status !== 'published' && <StatusBadge status={item.status} />}
        </div>
        <h1>{item.title}</h1>
        {item.summary && <p className="lead">{item.summary}</p>}
        <dl className="meta-grid">
          {item.grade && <Meta label={t('filters.grade')} v={t('common.gradeN', { n: item.grade })} />}
          {item.durationMin && <Meta label={t('meta.duration')} v={t('meta.minutes', { n: item.durationMin })} />}
          {item.lessonType && <Meta label={t('filters.lessonType')} v={t('lessonType.' + item.lessonType)} />}
          {item.topic && <Meta label={t('filters.topic')} v={<Link to={`/lessons?topic=${item.topic.slug}`}>{item.topic.title}</Link>} />}
          {item.format && <Meta label={t('filters.format')} v={t('format.' + item.format)} />}
          <Meta label={t('meta.updated')} v={fmtDate(item.updatedAt, lang)} />
          {item.author && <Meta label={t('meta.author')} v={item.author} />}
          {item.status === 'published' && item.approver && <Meta label={t('meta.approvedBy')} v={item.approver} />}
        </dl>
        {!!item.subjects.length && <ul className="chips" aria-label={t('common.subjects')}>{item.subjects.map((s: any) => <li key={s.slug}><Link to={`/${KIND_PATH[item.kind]}?subject=${s.slug}`} className="chip">{s.name}</Link></li>)}</ul>}
        <div className="content-actions no-print">
          <button className="btn" onClick={() => window.print()}><Icon name="printer" size={16} />{t('content.print')}</button>
          {item.file && <a className="btn btn-primary" href={'/media/' + item.file.stored_name} download><Icon name="download" size={16} />{t('common.download')} <small>({fmtBytes(item.file.size)})</small></a>}
          {item.project && <a className="btn" href="#interactive"><Icon name="play" size={16} />{t('content.use')}</a>}
          {can('content.edit') && <Link to={`/admin/content/${item.id}`} className="btn"><Icon name="edit" size={16} />{t('common.edit')}</Link>}
        </div>
        <p className="muted small no-print">{t('content.pdfHint')}</p>
      </header>

      {item.isDemo && <div className="callout callout-demo" role="note"><Icon name="info" size={18} /><div>{t('demo.contentNote')}</div></div>}
      {topicInfo && !topicInfo.verified && item.kind === 'lesson' && <div className="callout" role="note"><Icon name="alert" size={18} /><div>{t('content.unverifiedTopic')}</div></div>}
      {item.isFallbackLang && <div className="callout" role="note"><Icon name="globe" size={18} /><div>{t('content.fallback', { lang: t('lang.' + item.lang), source: t('lang.' + item.sourceLang) })}</div></div>}
      {trStatus && trStatus !== 'final' && trStatus !== 'reviewed' && !item.isFallbackLang && <div className="callout" role="note"><Icon name="globe" size={18} /><div>{t('content.translationDraft')}</div></div>}

      {item.project && (
        <section id="interactive" className="content-sec" aria-labelledby="int-h">
          <h2 id="int-h">{t('content.interactive')}</h2>
          <Embed projectId={item.project.id} title={item.project.name} draft={item.status !== 'published'} />
          <p className="muted small print-hide-note">{t('content.sandboxNote')}</p>
          <p className="print-only">{t('content.printEmbed')}</p>
        </section>
      )}
      {item.kind === 'video' && item.videoUrl && (
        <section className="content-sec"><h2>{t('kind.video')}</h2>
          {/\.(mp4|webm)(\?|$)/i.test(item.videoUrl) || item.videoUrl.startsWith('/media/') ? <video controls preload="metadata" src={item.videoUrl} className="video" /> : <a className="btn btn-primary" href={item.videoUrl} target="_blank" rel="noopener noreferrer"><Icon name="external" size={16} />{t('content.openVideo')}</a>}
        </section>
      )}
      {item.kind === 'assessment' && <Quiz slug={item.slug} />}

      <div className={cx('content-layout', showToc && 'with-toc')}>
        {showToc && (
          <nav className="toc no-print" aria-label={t('content.toc')}>
            <strong>{t('content.toc')}</strong>
            <ol>{sections.map(s => <li key={s.key}><a href={'#sec-' + s.key} onClick={e => { e.preventDefault(); document.getElementById('sec-' + s.key)?.scrollIntoView({ behavior: 'smooth' }); }}>{SEC_TITLE(t, s.key)}</a></li>)}</ol>
          </nav>
        )}
        <div className="content-body">
          {sections.map((s, i) => (
            <section key={s.key} id={'sec-' + s.key} className="content-sec"><h2><span className="sec-n">{/^s\d+$/.test(s.key) ? s.key.slice(1) : i + 1}</span>{SEC_TITLE(t, s.key)}</h2><Blocks blocks={s.blocks} /></section>
          ))}
          {!sections.length && item.kind !== 'assessment' && !item.project && !item.file && !item.videoUrl && <p className="muted">{t('content.noBody')}</p>}
        </div>
      </div>

      {!!item.methods?.length && (
        <section className="content-sec no-print"><h2>{t('content.methodsUsed')}</h2><div className="grid cards">{item.methods.map((m: any) => <MaterialCard key={m.id} item={m} />)}</div></section>
      )}
      <section className="content-sec no-print">
        <details className="history"><summary><Icon name="history" size={16} />{t('content.history')} <span className="muted">({item.versionCount})</span></summary>
          {hist.loading ? <Loading /> : !hist.data?.length ? <p className="muted">{t('content.historyEmpty')}</p> : (
            <ol className="hist-list">{hist.data.map((h: any) => <li key={h.version_no}><strong>v{h.version_no}</strong><time>{fmtDate(h.created_at, lang, true)}</time><span className="muted">{h.note ? t('hist.note.' + h.note, {}) !== 'hist.note.' + h.note ? t('hist.note.' + h.note) : h.note : ''}</span></li>)}</ol>)}
        </details>
      </section>
    </div>
  );
}
const Meta = ({ label, v }: any) => <div><dt>{label}</dt><dd>{v}</dd></div>;
