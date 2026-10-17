import { useEffect, useState } from 'react';
import { useApp } from '../lib/store';
import { useTitle } from '../lib/router';
import { get, put } from '../lib/api';
import { useAsync, Loading, ErrorState, Field, Icon } from '../components/ui';

const KEYS = ['site_name_uz', 'site_name_ru', 'site_name_en', 'tagline_uz', 'tagline_ru', 'tagline_en', 'default_lang', 'demo_banner', 'contact_email', 'studio_allowed_hosts', 'brand_primary_light', 'brand_primary_dark'];
export function SettingsAdmin() {
  const { t, toast, reload } = useApp(); useTitle(t('admin.n.settings'));
  const r = useAsync(s => get<Record<string, string>>('/api/admin/settings', s), []);
  const [v, setV] = useState<Record<string, string>>({}); const [err, setErr] = useState(''); const [saving, setSaving] = useState(false);
  useEffect(() => { if (r.data) setV(Object.fromEntries(KEYS.map(k => [k, r.data![k] ?? '']))); }, [r.data]);
  if (r.loading && !r.data) return <Loading />; if (r.error) return <ErrorState error={r.error} onRetry={r.reload} />;
  const s = (k: string) => (e: any) => setV({ ...v, [k]: e.target.value });
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setErr('');
    try { await put('/api/admin/settings', v); toast(t('common.saved'), 'success'); r.reload(); reload(); }
    catch (x: any) { setErr(x.code === 'low_contrast' ? t('admin.err.contrast') + ' (' + x.message + ')' : x.code === 'invalid_color' ? t('admin.err.color') : x.code === 'invalid_hosts' ? t('admin.err.hosts') : x.status === 403 ? t('state.forbidden') : t('state.error')); }
    finally { setSaving(false); }
  };
  const color = (k: string, label: string) => (
    <Field label={label} htmlFor={k} hint={t('admin.colorHint')}><div style={{ display: 'flex', gap: 8 }}>
      <input type="color" aria-label={label} value={/^#[0-9a-f]{6}$/i.test(v[k]) ? v[k] : '#1f5fa8'} onChange={s(k)} style={{ width: 48, padding: 2 }} />
      <input id={k} value={v[k]} onChange={s(k)} placeholder="#RRGGBB" maxLength={7} /><button type="button" className="btn btn-sm btn-ghost" onClick={() => setV({ ...v, [k]: '' })}>{t('admin.resetDefault')}</button></div></Field>);
  return (
    <form onSubmit={save}>
      <div className="admin-head"><h1>{t('admin.n.settings')}</h1><div className="actions"><button className="btn btn-primary" disabled={saving}><Icon name="save" size={16} />{t('common.save')}</button></div></div>
      {err && <div className="callout callout-bad" role="alert">{err}</div>}
      <section className="panel"><h2>{t('admin.general')}</h2><div className="form-grid">
        {(['uz', 'ru', 'en'] as const).map(l => <Field key={l} label={`${t('admin.siteName')} (${l.toUpperCase()})`} htmlFor={'sn' + l}><input id={'sn' + l} value={v['site_name_' + l]} onChange={s('site_name_' + l)} maxLength={120} /></Field>)}
        {(['uz', 'ru', 'en'] as const).map(l => <Field key={l} label={`${t('admin.tagline')} (${l.toUpperCase()})`} htmlFor={'tl' + l}><input id={'tl' + l} value={v['tagline_' + l]} onChange={s('tagline_' + l)} maxLength={200} /></Field>)}
        <Field label={t('admin.defaultLang')} htmlFor="dl"><select id="dl" value={v.default_lang} onChange={s('default_lang')}>{['uz', 'ru', 'en'].map(l => <option key={l} value={l}>{t('lang.' + l)}</option>)}</select></Field>
        <Field label={t('admin.contactEmail')} htmlFor="ce"><input id="ce" type="email" value={v.contact_email} onChange={s('contact_email')} /></Field></div>
        <label className="check"><input type="checkbox" checked={v.demo_banner === '1'} onChange={e => setV({ ...v, demo_banner: e.target.checked ? '1' : '0' })} />{t('admin.demoBanner')}</label></section>
      <section className="panel"><h2>{t('admin.brand')}</h2><p className="small muted">{t('admin.brandNote')}</p><div className="form-grid">{color('brand_primary_light', t('admin.brandLight'))}{color('brand_primary_dark', t('admin.brandDark'))}</div></section>
      <section className="panel"><h2>{t('admin.studioPolicy')}</h2><p className="small muted">{t('admin.studioPolicyNote')}</p>
        <Field label={t('admin.allowedHosts')} htmlFor="ah" hint={t('admin.allowedHostsHint')}><textarea id="ah" value={v.studio_allowed_hosts} onChange={s('studio_allowed_hosts')} placeholder="cdnjs.cloudflare.com" rows={3} /></Field></section>
    </form>
  );
}
