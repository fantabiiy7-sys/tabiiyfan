import { useSyncExternalStore, useCallback, useEffect } from 'react';

// Kichik History API router (React Router o'rnatib bo'lmagani uchun).
const EVT = 'tf:navigate';
const subscribe = (cb: () => void) => { window.addEventListener('popstate', cb); window.addEventListener(EVT, cb); return () => { window.removeEventListener('popstate', cb); window.removeEventListener(EVT, cb); }; };
const snap = () => location.pathname + location.search;

export function navigate(to: string, opts: { replace?: boolean; scroll?: boolean } = {}) {
  if (to === snap()) return;
  if (opts.replace) history.replaceState(null, '', to); else history.pushState(null, '', to);
  window.dispatchEvent(new Event(EVT));
  if (opts.scroll !== false) window.scrollTo(0, 0);
}
export function useLocation() {
  const s = useSyncExternalStore(subscribe, snap, snap);
  const i = s.indexOf('?');
  return { path: i < 0 ? s : s.slice(0, i), search: i < 0 ? '' : s.slice(i), full: s };
}
export function useQuery(): [URLSearchParams, (u: Record<string, string | number | undefined | null>, o?: { replace?: boolean }) => void] {
  const { search, path } = useLocation();
  const params = new URLSearchParams(search);
  const set = useCallback((u: Record<string, string | number | undefined | null>, o: { replace?: boolean } = {}) => {
    const p = new URLSearchParams(location.search);
    for (const [k, v] of Object.entries(u)) { if (v === undefined || v === null || v === '') p.delete(k); else p.set(k, String(v)); }
    const s = p.toString(); navigate(location.pathname + (s ? '?' + s : ''), { replace: o.replace ?? true, scroll: false });
  }, [path]);
  return [params, set];
}
export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const pp = pattern.split('/').filter(Boolean), ap = path.split('/').filter(Boolean);
  if (pp.length !== ap.length && !pattern.endsWith('/*')) return null;
  const out: Record<string, string> = {};
  for (let i = 0; i < pp.length; i++) {
    if (pp[i] === '*') return out;
    if (pp[i].startsWith(':')) { if (!ap[i]) return null; out[pp[i].slice(1)] = decodeURIComponent(ap[i]); }
    else if (pp[i] !== ap[i]) return null;
  }
  return out;
}

export function Link({ to, children, onClick, replace, ...rest }: any) {
  const href = to;
  const handle = (e: any) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || rest.target === '_blank') return;
    if (/^(https?:)?\/\//.test(href)) return;
    e.preventDefault(); navigate(href, { replace });
  };
  return <a href={href} onClick={handle} {...rest}>{children}</a>;
}
export function useTitle(title: string) { useEffect(() => { if (title) document.title = title; }, [title]); }
