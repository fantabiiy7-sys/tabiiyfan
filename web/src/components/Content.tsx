import { useState, useRef, useEffect } from 'react';
import { useApp } from '../lib/store';
import { Link } from '../lib/router';
import { Icon, Badge, Loading, ErrorState, useAsync } from './ui';
import { itemPath, cx } from '../lib/util';
import { get, post } from '../lib/api';

import { safeUrl, type Blk } from '../lib/blocks';
export type { Blk };

export function Blocks({ blocks }: { blocks: Blk[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        if (typeof b === 'string') return <p key={i}>{b}</p>;
        if (Array.isArray(b)) return <ul key={i}>{b.map((x, j) => <li key={j}>{x}</li>)}</ul>;
        if ('ol' in b) return <ol key={i}>{b.ol.map((x, j) => <li key={j}>{x}</li>)}</ol>;
        if ('table' in b) return (
          <div className="table-wrap" key={i}><table><thead><tr>{b.table.head.map((h, j) => <th key={j} scope="col">{h}</th>)}</tr></thead>
            <tbody>{b.table.rows.map((r, j) => <tr key={j}>{r.map((c, k) => k === 0 ? <th key={k} scope="row">{c}</th> : <td key={k}>{c}</td>)}</tr>)}</tbody></table></div>
        );
        if ('note' in b) return <div className="callout" key={i} role="note"><Icon name="alert" size={18} /><div>{b.note}</div></div>;
        if ('formula' in b) return <pre className="formula" key={i}>{b.formula}</pre>;
        if ('image' in b) return safeUrl(b.image.src) ? <figure className="figure" key={i}><img src={b.image.src} alt={b.image.alt} loading="lazy" />{b.image.alt && <figcaption className="muted small">{b.image.alt}</figcaption>}</figure> : null;
        if ('video' in b) return safeUrl(b.video.src) ? <video key={i} className="video" controls preload="metadata" src={b.video.src} /> : null;
        if ('file' in b) return safeUrl(b.file.src) ? <p key={i}><a className="btn btn-sm" href={b.file.src} download><Icon name="download" size={14} />{b.file.label}</a></p> : null;
        return null;
      })}
    </>
  );
}

export function MaterialCard({ item }: { item: any }) {
  const { t, lang } = useApp();
  return (
    <article className="card material">
      <div className="card-badges">
        <Badge tone="kind">{t('kind.' + item.kind)}</Badge>
        {item.grade && <Badge>{t('common.gradeN', { n: item.grade })}</Badge>}
        {item.isDemo && <Badge tone="demo" title={t('demo.itemHint')}>{t('demo.label')}</Badge>}
      </div>
      <h3 className="card-title"><Link to={itemPath(item)}>{item.title}</Link></h3>
      {item.topic && <div className="card-topic"><Icon name="book" size={14} />{item.topic.title}</div>}
      {!!item.subjects.length && <ul className="chips" aria-label={t('common.subjects')}>{item.subjects.map((s: any) => <li key={s.slug} className="chip">{s.name}</li>)}</ul>}
      {item.summary && <p className="card-summary">{item.summary}</p>}
      {item.isFallbackLang && <p className="muted small"><Icon name="globe" size={13} /> {t('content.fallbackShort', { lang: t('lang.' + item.lang) })}</p>}
      <div className="card-actions">
        <Link to={itemPath(item)} className="btn btn-primary btn-sm">{t(item.kind === 'lesson' || item.kind === 'method' || item.kind === 'project' ? 'common.view' : 'common.open')}</Link>
        {item.hasProject && item.kind === 'lesson' && <Link to={itemPath(item) + '#interactive'} className="btn btn-sm"><Icon name="play" size={14} />{t('content.use')}</Link>}
        {item.fileUrl && <a href={item.fileUrl} className="btn btn-sm" download><Icon name="download" size={14} />{t('common.download')}</a>}
      </div>
    </article>
  );
}

export function CardGrid({ items }: { items: any[] }) { return <div className="grid cards">{items.map(i => <MaterialCard key={i.id} item={i} />)}</div>; }
export function CardSkeletons({ n = 6 }: { n?: number }) { return <div className="grid cards" aria-hidden="true">{Array.from({ length: n }, (_, i) => <div key={i} className="card skeleton"><span /><span /><span /></div>)}</div>; }

// Interaktiv material: alohida sandboxlangan iframe (allow-same-origin YO'Q)
export function Embed({ projectId, title, draft }: { projectId: number; title: string; draft?: boolean }) {
  const { t, lang } = useApp(); const box = useRef<HTMLDivElement>(null); const [fs, setFs] = useState(false); const [key, setKey] = useState(0);
  useEffect(() => { const h = () => setFs(!!document.fullscreenElement); document.addEventListener('fullscreenchange', h); return () => document.removeEventListener('fullscreenchange', h); }, []);
  return (
    <div className={cx('embed', fs && 'is-fs')} ref={box}>
      <div className="embed-bar">
        <span className="embed-title"><Icon name="play" size={16} />{title}</span>
        <span className="embed-actions">
          <button className="btn btn-sm" onClick={() => setKey(k => k + 1)}><Icon name="refresh" size={14} />{t('studio.refresh')}</button>
          <button className="btn btn-sm" onClick={() => (document.fullscreenElement ? document.exitFullscreen() : box.current?.requestFullscreen?.())}><Icon name="maximize" size={14} />{t('studio.fullscreen')}</button>
        </span>
      </div>
      <iframe key={key} title={title} src={`/embed/${projectId}?lang=${lang}${draft ? '&draft=1' : ''}`} sandbox="allow-scripts" referrerPolicy="no-referrer" loading="lazy" />
    </div>
  );
}

export function Quiz({ slug }: { slug: string }) {
  const { t, lang } = useApp();
  const q = useAsync(s => get<any>(`/api/assessments/${slug}?lang=${lang}`, s), [slug, lang]);
  const [ans, setAns] = useState<Record<string, number>>({}); const [res, setRes] = useState<any>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState<any>(null);
  if (q.loading) return <Loading />; if (q.error) return <ErrorState error={q.error} onRetry={q.reload} />;
  const data = q.data; if (!data.questions.length) return null;
  const submit = async () => { setBusy(true); setErr(null); try { setRes(await post(`/api/assessments/${slug}/check?lang=${lang}`, { answers: ans })); } catch (e) { setErr(e); } finally { setBusy(false); } };
  const answered = Object.keys(ans).length;
  return (
    <section className="quiz" aria-labelledby="quiz-h">
      <h2 id="quiz-h">{t('quiz.title')}</h2>
      {data.questions.map((qq: any, i: number) => {
        const r = res?.results.find((x: any) => x.id === qq.id);
        return (
          <fieldset key={qq.id} className={cx('qblock', r && (r.correct ? 'q-ok' : 'q-bad'))} disabled={!!res}>
            <legend>{i + 1}. {qq.text}</legend>
            {qq.options.map((o: string, k: number) => (
              <label key={k} className={cx('opt', r && k === r.correctIndex && 'opt-correct', r && !r.correct && ans[qq.id] === k && 'opt-wrong')}>
                <input type="radio" name={'q' + qq.id} checked={ans[qq.id] === k} onChange={() => setAns(a => ({ ...a, [qq.id]: k }))} /><span>{o}</span>
              </label>
            ))}
            {r && <p className="explain" role="status"><strong>{r.correct ? t('quiz.correct') : t('quiz.wrong')}</strong> {r.explanation}</p>}
          </fieldset>
        );
      })}
      {err && <ErrorState error={err} />}
      {!res ? <button className="btn btn-primary" disabled={busy || answered < data.questions.length} onClick={submit}>{t('quiz.check')}</button> : (
        <div className={cx('result', res.passed ? 'result-pass' : 'result-fail')} role="status">
          <strong>{t('quiz.score', { c: res.correct, n: res.total, p: res.percent })}</strong> — {res.passed ? t('quiz.passed') : t('quiz.failed', { p: data.passPercent })}
          <button className="btn btn-sm" onClick={() => { setAns({}); setRes(null); }}>{t('quiz.retry')}</button>
        </div>
      )}
      {answered < data.questions.length && !res && <p className="muted small">{t('quiz.answerAll')}</p>}
    </section>
  );
}
