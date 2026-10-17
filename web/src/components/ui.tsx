import { useEffect, useRef, useState, useCallback } from 'react';
import { useApp } from '../lib/store';
import { cx } from '../lib/util';

// ---------- Ikonkalar (24x24, chiziqli) ----------
const P: Record<string, string> = {
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5zM4 19a2 2 0 0 0 2 2h13',
  users: 'M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 20v-1a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  flask: 'M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2.2h12.4a1.5 1.5 0 0 0 1.3-2.2L14 9V3M7.5 15h9',
  sparkles: 'M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z',
  video: 'M3 6h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H3zM17 10l4-2v8l-4-2',
  library: 'M4 4v16M9 4v16M14 6l5 14M3 20h18',
  check: 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  school: 'M2 10l10-5 10 5-10 5zM6 12v5c0 1.5 3 3 6 3s6-1.5 6-3v-5M22 10v6',
  compass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5v.01',
  menu: 'M4 6h16M4 12h16M4 18h16',
  x: 'M6 6l12 12M18 6L6 18',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5z',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18',
  user: 'M20 21v-1a5 5 0 0 0-5-5H9a5 5 0 0 0-5 5v1M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  bell: 'M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0',
  'chevron-down': 'M6 9l6 6 6-6',
  'chevron-right': 'M9 6l6 6-6 6',
  'chevron-left': 'M15 6l-6 6 6 6',
  plus: 'M12 5v14M5 12h14',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  save: 'M5 3h11l4 4v14H5zM8 3v5h7V3M8 21v-7h8v7',
  play: 'M7 4l13 8-13 8z',
  refresh: 'M20 11a8 8 0 0 0-14.5-3.5L4 9M4 4v5h5M4 13a8 8 0 0 0 14.5 3.5L20 15M20 20v-5h-5',
  maximize: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  phone: 'M7 2h10a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM11 18h2',
  tablet: 'M5 2h14a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM11 18h2',
  monitor: 'M3 4h18v12H3zM8 20h8M12 16v4',
  download: 'M12 3v12M7 11l5 5 5-5M4 20h16',
  upload: 'M12 16V4M7 8l5-5 5 5M4 20h16',
  printer: 'M6 9V3h12v6M6 18H4v-7h16v7h-2M7 14h10v7H7z',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
  history: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
  'eye-off': 'M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3.2 3.9M6.4 7.7A17 17 0 0 0 2 12s4 7 10 7c1.5 0 2.9-.4 4-1M9.9 9.9a3 3 0 0 0 4.2 4.2',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  alert: 'M12 3l10 18H2zM12 10v5M12 18v.01',
  'check-circle': 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12l3 3 5-6',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  filter: 'M3 5h18l-7 8v6l-4 2v-8z',
  code: 'M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16',
  layout: 'M3 4h18v16H3zM3 10h18M9 10v10',
  image: 'M3 5h18v14H3zM8 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3M21 16l-5-5-8 8',
  type: 'M5 6V4h14v2M12 4v16M9 20h6',
  table: 'M3 5h18v14H3zM3 10h18M3 15h18M9 5v14M15 5v14',
  columns: 'M3 4h18v16H3zM12 4v16',
  quiz: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5M12 17v.01',
  move: 'M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20',
  'arrow-up': 'M12 19V5M5 12l7-7 7 7',
  'arrow-down': 'M12 5v14M5 12l7 7 7-7',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  database: 'M12 8c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3zM4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  file: 'M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM14 3v5h5',
  news: 'M4 4h13v16H6a2 2 0 0 1-2-2zM17 8h3v10a2 2 0 0 1-2 2M8 8h6M8 12h6M8 16h4',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
};
export function Icon({ name, size = 20, className, title }: { name: string; size?: number; className?: string; title?: string }) {
  return (
    <svg className={cx('icon', className)} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden={title ? undefined : true} role={title ? 'img' : undefined} aria-label={title}>
      <path d={P[name] ?? P.info} />
    </svg>
  );
}
export const hasIcon = (n: string) => n in P;

// ---------- Holatlar: yuklanish, bo'sh, xato ----------
export function Loading({ label }: { label?: string }) {
  const { t } = useApp();
  return <div className="state state-loading" role="status" aria-live="polite"><span className="spinner" aria-hidden="true" /><span>{label ?? t('state.loading')}</span></div>;
}
export function Empty({ title, text, action, icon = 'search' }: { title: string; text?: string; action?: any; icon?: string }) {
  return <div className="state state-empty"><Icon name={icon} size={36} /><h3>{title}</h3>{text && <p>{text}</p>}{action}</div>;
}
export function ErrorState({ error, onRetry }: { error: any; onRetry?: () => void }) {
  const { t } = useApp();
  const code = error?.code ?? 'error';
  const msg = code === 'network' ? t('state.network') : code === 'forbidden' ? t('state.forbidden') : code === 'not_found' ? t('state.notFound') : t('state.error');
  return (
    <div className="state state-error" role="alert"><Icon name="alert" size={36} /><h3>{msg}</h3>
      {error?.message && error.message !== code && <p className="muted small">{error.message}</p>}
      {onRetry && <button className="btn" onClick={onRetry}><Icon name="refresh" size={16} />{t('state.retry')}</button>}</div>
  );
}

// ---------- useAsync ----------
export function useAsync<T>(fn: (signal: AbortSignal) => Promise<T>, deps: any[]) {
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: any }>({ data: null, loading: true, error: null });
  const [tick, setTick] = useState(0);
  const seq = useRef(0);
  useEffect(() => {
    const ac = new AbortController(); const id = ++seq.current;
    setState(s => ({ ...s, loading: true, error: null }));
    fn(ac.signal).then(d => { if (id === seq.current) setState({ data: d, loading: false, error: null }); })
      .catch(e => { if (e?.name === 'AbortError') return; if (id === seq.current) setState({ data: null, loading: false, error: e }); });
    return () => ac.abort();
  }, [...deps, tick]);
  const reload = useCallback(() => setTick(x => x + 1), []);
  return { ...state, reload };
}

// ---------- Boshqa umumiy ----------
export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const { t } = useApp();
  const pages = Math.max(1, Math.ceil(total / pageSize)); if (pages <= 1) return null;
  const nums: (number | '…')[] = []; for (let i = 1; i <= pages; i++) if (i === 1 || i === pages || Math.abs(i - page) <= 1) nums.push(i); else if (nums[nums.length - 1] !== '…') nums.push('…');
  return (
    <nav className="pager" aria-label={t('a11y.pagination')}>
      <button className="btn btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label={t('common.prev')}><Icon name="chevron-left" size={16} /></button>
      {nums.map((n, i) => n === '…' ? <span key={i} className="pager-gap">…</span> :
        <button key={i} className={cx('btn btn-sm', n === page && 'btn-primary')} aria-current={n === page ? 'page' : undefined} onClick={() => onPage(n)}>{n}</button>)}
      <button className="btn btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label={t('common.next')}><Icon name="chevron-right" size={16} /></button>
    </nav>
  );
}
export function StatusBadge({ status }: { status: string }) {
  const { t } = useApp();
  return <span className={'badge badge-status badge-' + status}>{t('status.' + status)}</span>;
}
export function Badge({ children, tone = 'neutral', title }: any) { return <span className={'badge badge-' + tone} title={title}>{children}</span>; }

export function Field({ label, hint, error, children, htmlFor }: any) {
  return (
    <div className={cx('field', error && 'field-error')}>
      <label htmlFor={htmlFor}>{label}</label>{children}
      {hint && <div className="hint">{hint}</div>}{error && <div className="err" role="alert">{error}</div>}
    </div>
  );
}
export function Modal({ title, onClose, children, wide, footer }: any) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('input,select,textarea,button')?.focus();
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && ref.current) { // fokus modal ichida qoladi
        const f = ref.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])');
        if (!f.length) return; const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', k); return () => { window.removeEventListener('keydown', k); prev?.focus?.(); };
  }, []);
  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={cx('modal', wide && 'modal-wide')} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="modal-head"><h2>{title}</h2><button className="icon-btn" onClick={onClose} aria-label="×"><Icon name="x" /></button></div>
        <div className="modal-body">{children}</div>{footer && <div className="modal-actions">{footer}</div>}
      </div>
    </div>
  );
}
export function Tabs({ tabs, value, onChange }: { tabs: { key: string; label: string; count?: number }[]; value: string; onChange: (k: string) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map(x => <button key={x.key} role="tab" aria-selected={value === x.key} className={cx('tab', value === x.key && 'active')} onClick={() => onChange(x.key)}>{x.label}{x.count !== undefined && <span className="tab-count">{x.count}</span>}</button>)}
    </div>
  );
}
