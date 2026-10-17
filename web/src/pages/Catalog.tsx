import { useEffect, useState } from 'react';
import { useApp } from '../lib/store';
import { useQuery, useTitle } from '../lib/router';
import { get, qs } from '../lib/api';
import { useAsync, Empty, ErrorState, Pager, Icon } from '../components/ui';
import { CardGrid, CardSkeletons } from '../components/Content';

export const LESSON_TYPES = ['new_knowledge', 'consolidation', 'lab', 'project', 'inquiry', 'integrated'];
export const FORMATS = ['html', 'pdf', 'video', 'text'];
const PAGE = 12;

export function Catalog({ kind }: { kind: string }) {
  const { t, lang, boot } = useApp(); const [q, setQ] = useQuery();
  useTitle(t('kind.' + kind + '.plural') + ' — ' + t('site.short'));
  const grade = q.get('grade') ?? ''; const subject = q.get('subject') ?? ''; const topic = q.get('topic') ?? ''; const lessonType = q.get('lessonType') ?? '';
  const method = q.get('method') ?? ''; const format = q.get('format') ?? ''; const sort = q.get('sort') ?? ''; const text = q.get('q') ?? ''; const page = Math.max(1, parseInt(q.get('page') ?? '1', 10) || 1);
  const [draft, setDraft] = useState(text); useEffect(() => setDraft(text), [text]);
  useEffect(() => { const h = setTimeout(() => { if (draft !== text) setQ({ q: draft, page: undefined }); }, 350); return () => clearTimeout(h); }, [draft]);
  const methods = useAsync(s => kind === 'lesson' ? get<any>(`/api/content?kind=method&pageSize=48&lang=${lang}`, s) : Promise.resolve({ items: [] }), [kind, lang]);
  const list = useAsync(s => get<any>('/api/content' + qs({ kind, grade, subject, topic, lessonType, method, format, sort, q: text, page, pageSize: PAGE, lang }), s), [kind, grade, subject, topic, lessonType, method, format, sort, text, page, lang]);
  const topics = (boot?.topics ?? []).filter(x => !grade || String(x.grade) === grade);
  const active = [grade, subject, topic, lessonType, method, format, text].filter(Boolean).length;
  const set = (k: string, v: string) => setQ({ [k]: v, page: undefined, ...(k === 'grade' ? { topic: undefined } : {}) });
  const pageTitle = t('kind.' + kind + '.plural');
  return (
    <div className="page">
      <header className="page-head"><h1>{grade && kind === 'lesson' ? t('catalog.lessonsGrade', { n: grade }) : pageTitle}</h1><p className="lead">{t('kind.' + kind + '.lead')}</p></header>
      <section className="filters" aria-label={t('filters.title')}>
        <div className="filters-row">
          <div className="field grow"><label htmlFor="f-q">{t('filters.keyword')}</label>
            <div className="input-icon"><Icon name="search" size={16} /><input id="f-q" type="search" value={draft} onChange={e => setDraft(e.target.value)} placeholder={t('filters.keywordPh')} /></div></div>
          <Sel id="f-grade" label={t('filters.grade')} value={grade} onChange={v => set('grade', v)} all={t('filters.all')} opts={(boot?.grades ?? []).map(g => [String(g.id), g.name])} />
          <Sel id="f-subject" label={t('filters.subject')} value={subject} onChange={v => set('subject', v)} all={t('filters.all')} opts={(boot?.subjects ?? []).filter(s => !s.isCore).map(s => [s.slug, s.name])} />
          {kind !== 'method' && <Sel id="f-topic" label={t('filters.topic')} value={topic} onChange={v => set('topic', v)} all={t('filters.all')} opts={topics.map(x => [x.slug, x.title])} />}
        </div>
        <div className="filters-row">
          {kind === 'lesson' && <Sel id="f-type" label={t('filters.lessonType')} value={lessonType} onChange={v => set('lessonType', v)} all={t('filters.all')} opts={LESSON_TYPES.map(x => [x, t('lessonType.' + x)])} />}
          {kind === 'lesson' && <Sel id="f-method" label={t('filters.method')} value={method} onChange={v => set('method', v)} all={t('filters.all')} opts={(methods.data?.items ?? []).map((m: any) => [m.slug, m.title])} />}
          <Sel id="f-format" label={t('filters.format')} value={format} onChange={v => set('format', v)} all={t('filters.all')} opts={FORMATS.map(x => [x, t('format.' + x)])} />
          <Sel id="f-sort" label={t('filters.sort')} value={sort} onChange={v => set('sort', v)} all={t('sort.new')} opts={[['old', t('sort.old')], ['title', t('sort.title')]]} />
          {active > 0 && <button className="btn btn-ghost filters-clear" onClick={() => setQ({ grade: undefined, subject: undefined, topic: undefined, lessonType: undefined, method: undefined, format: undefined, q: undefined, sort: undefined, page: undefined })}><Icon name="x" size={14} />{t('filters.clear')}</button>}
        </div>
      </section>
      <div className="result-meta" aria-live="polite">{list.data && t('catalog.found', { n: list.data.total })}</div>
      {list.loading && !list.data ? <CardSkeletons /> : list.error ? <ErrorState error={list.error} onRetry={list.reload} /> :
        !list.data?.items.length ? <Empty title={active ? t('empty.noResults') : t('empty.noItems')} text={active ? t('empty.tryChange') : t('empty.noItemsHint')} action={active ? <button className="btn" onClick={() => setQ({ grade: undefined, subject: undefined, topic: undefined, lessonType: undefined, method: undefined, format: undefined, q: undefined, page: undefined })}>{t('filters.clear')}</button> : null} /> :
        <div className={list.loading ? 'dim' : ''}><CardGrid items={list.data.items} /><Pager page={page} pageSize={PAGE} total={list.data.total} onPage={p => setQ({ page: p }, { replace: false })} /></div>}
    </div>
  );
}

export function Sel({ id, label, value, onChange, all, opts }: { id: string; label: string; value: string; onChange: (v: string) => void; all: string; opts: [string, string][] }) {
  return (
    <div className="field"><label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={e => onChange(e.target.value)}><option value="">{all}</option>{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
  );
}
