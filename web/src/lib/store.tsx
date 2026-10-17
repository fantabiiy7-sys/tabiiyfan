import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { get, post, setCsrf } from './api';
import { makeT, isLang, type Lang } from './i18n';
import { safeLS } from './util';

export interface Me { id: number; email: string; fullName: string; role: string; csrf: string; permissions: string[] }
export interface Boot {
  me: Me | null; nav: any[]; settings: Record<string, string>; overrides: Record<string, string>;
  grades: { id: number; name: string }[]; subjects: { id: number; slug: string; name: string; isCore: boolean }[];
  topics: { id: number; grade: number; slug: string; title: string; section: string; sectionKey: string; verified: boolean }[];
  studioPolicy: { sandbox: string; hosts: string[]; csp: string } | null;
}
interface Ctx {
  boot: Boot | null; bootError: string | null; lang: Lang; setLang(l: Lang): void; theme: 'light' | 'dark'; toggleTheme(): void;
  me: Me | null; can(p: string): boolean; t(k: string, v?: Record<string, string | number>): string;
  login(email: string, password: string): Promise<void>; logout(): Promise<void>; reload(): Promise<void>;
  toast(msg: string, kind?: 'success' | 'error' | 'info'): void; confirm(o: { title: string; message?: string; danger?: boolean; okLabel?: string }): Promise<boolean>;
  siteName: string; tagline: string; isDemoSite: boolean;
}
const AppCtx = createContext<Ctx>(null as any);
export const useApp = () => useContext(AppCtx);

function initialLang(): Lang { const l = safeLS.get('tf.lang'); return isLang(l) ? l : 'uz'; }
function initialTheme(): 'light' | 'dark' { return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; }

export function AppProvider({ children }: any) {
  const [boot, setBoot] = useState<Boot | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [lang, setLangState] = useState<Lang>(initialLang);
  const [theme, setTheme] = useState<'light' | 'dark'>(initialTheme);
  const [toasts, setToasts] = useState<{ id: number; msg: string; kind: string }[]>([]);
  const [dlg, setDlg] = useState<any>(null);
  const langRef = useRef(lang); langRef.current = lang;

  const load = useCallback(async (l: Lang) => {
    try { const b = await get<Boot>('/api/bootstrap?lang=' + l); setCsrf(b.me?.csrf ?? ''); setBoot(b); setBootError(null); }
    catch (e: any) { setBootError(e?.code ?? 'error'); }
  }, []);
  useEffect(() => { load(lang); }, [lang]);
  useEffect(() => { document.documentElement.setAttribute('lang', lang); }, [lang]);
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);
  useEffect(() => { const h = () => { setCsrf(''); load(langRef.current); }; window.addEventListener('tf:unauth', h); return () => window.removeEventListener('tf:unauth', h); }, []);

  useEffect(() => { // admin tanlagan brend rangi (kontrast serverda tekshirilgan) dizayn tokenlariga qo'llanadi
    const l = boot?.settings.brand_primary_light, d = boot?.settings.brand_primary_dark;
    let el = document.getElementById('brand-style');
    if (!l && !d) { el?.remove(); return; }
    if (!el) { el = document.createElement('style'); el.id = 'brand-style'; document.head.appendChild(el); }
    const rule = (sel: string, c?: string) => c && /^#[0-9a-fA-F]{6}$/.test(c) ? `${sel}{--primary:${c};--primary-hover:color-mix(in srgb,${c} 84%,#000);--primary-soft:color-mix(in srgb,${c} 13%,var(--surface));--focus:${c};}` : '';
    el.textContent = rule(':root[data-theme="light"]', l) + rule(':root[data-theme="dark"]', d);
  }, [boot?.settings.brand_primary_light, boot?.settings.brand_primary_dark]);
  const t = useMemo(() => makeT(lang, boot?.overrides), [lang, boot?.overrides]);
  const me = boot?.me ?? null;
  const toast = useCallback((msg: string, kind: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now() + Math.random(); setToasts(x => [...x, { id, msg, kind }]);
    setTimeout(() => setToasts(x => x.filter(i => i.id !== id)), kind === 'error' ? 7000 : 3500);
  }, []);
  const confirm = useCallback((o: any) => new Promise<boolean>(res => setDlg({ ...o, res })), []);

  const value: Ctx = {
    boot, bootError, lang, theme, me, t,
    setLang: l => { safeLS.set('tf.lang', l); setLangState(l); },
    toggleTheme: () => setTheme(x => { const n = x === 'dark' ? 'light' : 'dark'; safeLS.set('tf.theme', n); return n; }),
    can: p => !!me?.permissions.includes(p),
    login: async (email, password) => { await post('/api/auth/login', { email, password }); await load(langRef.current); },
    logout: async () => { await post('/api/auth/logout'); setCsrf(''); await load(langRef.current); },
    reload: () => load(langRef.current),
    toast, confirm,
    siteName: boot?.settings['site_name_' + lang] || 'Tabiiy fan — Science',
    tagline: boot?.settings['tagline_' + lang] || '',
    isDemoSite: boot?.settings.demo_banner === '1',
  };
  return (
    <AppCtx.Provider value={value}>
      {children}
      <div className="toasts" role="region" aria-label={t('a11y.notifications')} aria-live="polite">
        {toasts.map(x => <div key={x.id} className={'toast toast-' + x.kind} role={x.kind === 'error' ? 'alert' : 'status'}>{x.msg}</div>)}
      </div>
      {dlg && <ConfirmDialog dlg={dlg} t={t} close={(v: boolean) => { dlg.res(v); setDlg(null); }} />}
    </AppCtx.Provider>
  );
}

function ConfirmDialog({ dlg, close, t }: any) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => { ref.current?.focus(); const k = (e: KeyboardEvent) => { if (e.key === 'Escape') close(false); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, []);
  return (
    <div className="modal-backdrop" onClick={() => close(false)}>
      <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="cfm-t" onClick={e => e.stopPropagation()}>
        <h2 id="cfm-t">{dlg.title}</h2>
        {dlg.message && <p>{dlg.message}</p>}
        <div className="modal-actions">
          <button className="btn" onClick={() => close(false)}>{t('common.cancel')}</button>
          <button ref={ref} className={'btn ' + (dlg.danger ? 'btn-danger' : 'btn-primary')} onClick={() => close(true)}>{dlg.okLabel ?? t('common.confirm')}</button>
        </div>
      </div>
    </div>
  );
}
