import { useMemo, useState } from 'react';
import { useApp } from '../lib/store';
import { useTitle } from '../lib/router';
import { get, put } from '../lib/api';
import { dictKeys, getDict, LANGS, type Lang } from '../lib/i18n';
import { useAsync, Loading, ErrorState, Pager, Icon } from '../components/ui';

const PAGE = 25;
export function I18nAdmin() {
  const { t, toast, reload } = useApp(); useTitle(t('admin.n.i18n'));
  const r = useAsync(s => get<any[]>('/api/admin/i18n', s), []);
  const [lang, setLang] = useState<Lang>('ru'); const [q, setQ] = useState(''); const [page, setPage] = useState(1); const [onlyChanged, setOnlyChanged] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const over = useMemo(() => { const m: Record<string, string> = {}; for (const x of r.data ?? []) if (x.lang === lang) m[x.key] = x.value; return m; }, [r.data, lang]);
  const keys = useMemo(() => dictKeys().filter(k => (!q || k.toLowerCase().includes(q.toLowerCase()) || (getDict(lang)[k] ?? '').toLowerCase().includes(q.toLowerCase()) || getDict('uz')[k].toLowerCase().includes(q.toLowerCase())) && (!onlyChanged || k in over)), [q, lang, onlyChanged, over]);
  const rows = keys.slice((page - 1) * PAGE, page * PAGE);
  if (r.loading && !r.data) return <Loading />; if (r.error) return <ErrorState error={r.error} onRetry={r.reload} />;
  const commit = async (k: string, v: string) => {
    const cur = over[k] ?? getDict(lang)[k] ?? ''; if (v === cur) { setDraft(({ [k]: _, ...rest }) => rest); return; }
    try { await put('/api/admin/i18n', { key: k, lang, value: v === getDict(lang)[k] ? '' : v }); toast(t('common.saved'), 'success'); setDraft(({ [k]: _, ...rest }) => rest); r.reload(); reload(); } catch { toast(t('state.error'), 'error'); }
  };
  const reset = async (k: string) => { try { await put('/api/admin/i18n', { key: k, lang, value: '' }); r.reload(); reload(); } catch { toast(t('state.error'), 'error'); } };
  const missing = dictKeys().filter(k => !getDict(lang)[k]).length;
  return (
    <div>
      <div className="admin-head"><h1>{t('admin.n.i18n')}</h1></div>
      <p className="muted">{t('admin.i18nNote')}</p>
      <div className="toolbar">
        <div className="field"><label htmlFor="i-l">{t('admin.lang')}</label><select id="i-l" value={lang} onChange={e => { setLang(e.target.value as Lang); setPage(1); }}>{LANGS.map(l => <option key={l} value={l}>{t('lang.' + l)}</option>)}</select></div>
        <div className="field grow"><label htmlFor="i-q">{t('filters.keyword')}</label><input id="i-q" type="search" value={q} onChange={e => { setQ(e.target.value); setPage(1); }} /></div>
        <label className="check"><input type="checkbox" checked={onlyChanged} onChange={e => { setOnlyChanged(e.target.checked); setPage(1); }} />{t('admin.onlyChanged')}</label>
      </div>
      <p className="small muted">{t('admin.keysTotal', { n: dictKeys().length })} · {t('admin.missingIn', { n: missing, l: t('lang.' + lang) })}</p>
      <div className="table-wrap"><table><thead><tr><th>{t('admin.key')}</th><th>UZ</th><th>{lang.toUpperCase()}</th><th /></tr></thead>
        <tbody>{rows.map(k => (
          <tr key={k}><td><code className="small">{k}</code></td><td className="small">{getDict('uz')[k]}</td>
            <td style={{ minWidth: 260 }}><input aria-label={`${k} ${lang}`} value={draft[k] ?? over[k] ?? getDict(lang)[k] ?? ''} onChange={e => setDraft({ ...draft, [k]: e.target.value })} onBlur={e => draft[k] !== undefined && commit(k, e.target.value)} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} /></td>
            <td>{k in over && <button className="btn btn-sm btn-ghost" onClick={() => reset(k)} title={t('admin.resetDefault')} aria-label={t('admin.resetDefault')}><Icon name="undo" size={14} /></button>}</td></tr>))}</tbody></table></div>
      <Pager page={page} pageSize={PAGE} total={keys.length} onPage={setPage} />
    </div>
  );
}
