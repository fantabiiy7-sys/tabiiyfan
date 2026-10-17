import { useEffect, useRef, useState } from 'react';
import { useApp } from '../lib/store';
import { Link, useLocation, navigate } from '../lib/router';
import { Icon } from './ui';
import { LANGS, LANG_NAMES } from '../lib/i18n';
import { cx } from '../lib/util';
import { get } from '../lib/api';

export function Logo({ compact }: { compact?: boolean }) {
  const { siteName } = useApp();
  return (
    <Link to="/" className="logo" aria-label={siteName}>
      <svg width="30" height="30" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="var(--primary)" /><path d="M32 14c9 6 14 14 14 22a14 14 0 0 1-28 0c0-8 5-16 14-22z" fill="#fff" opacity=".95" /><path d="M32 24v26M32 36l8-7M32 42l-8-7" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" fill="none" /></svg>
      {!compact && <span className="logo-text">{siteName}</span>}
    </Link>
  );
}

export function Menu({ trigger, children, align = 'right', label }: any) {
  const [open, setOpen] = useState(false); const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const c = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); ref.current?.querySelector<HTMLElement>('button')?.focus(); } };
    document.addEventListener('mousedown', c); document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', c); document.removeEventListener('keydown', k); };
  }, [open]);
  return (
    <div className="menu" ref={ref}>
      <button className="icon-btn menu-trigger" aria-haspopup="menu" aria-expanded={open} aria-label={label} onClick={() => setOpen(o => !o)}>{trigger}</button>
      {open && <div className={cx('menu-pop', 'menu-' + align)} role="menu" onClick={() => setOpen(false)}>{children}</div>}
    </div>
  );
}

export function TopBar({ onMenu, admin }: { onMenu?: () => void; admin?: boolean }) {
  const { t, lang, setLang, theme, toggleTheme, me, can, logout } = useApp();
  const [q, setQ] = useState(''); const [pending, setPending] = useState(0);
  useEffect(() => { if (can('content.review')) get('/api/admin/dashboard').then(d => setPending(d.pendingReview?.length ?? 0)).catch(() => {}); else setPending(0); }, [me?.id]);
  const submit = (e: any) => { e.preventDefault(); if (q.trim().length >= 1) navigate('/search?q=' + encodeURIComponent(q.trim())); };
  return (
    <header className="topbar">
      {onMenu && <button className="icon-btn menu-btn" onClick={onMenu} aria-label={t('nav.openMenu')}><Icon name="menu" /></button>}
      <Logo />
      {!admin && (
        <form className="topsearch" role="search" onSubmit={submit}>
          <Icon name="search" size={18} />
          <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={t('search.placeholder')} aria-label={t('search.placeholder')} />
        </form>
      )}
      <div className="topbar-actions">
        <Menu label={t('top.language')} trigger={<><Icon name="globe" /><span className="lang-code">{lang.toUpperCase()}</span></>}>
          {LANGS.map(l => <button key={l} role="menuitemradio" aria-checked={l === lang} className={cx('menu-item', l === lang && 'active')} onClick={() => setLang(l)}>{LANG_NAMES[l]}{l === lang && <Icon name="check-circle" size={16} />}</button>)}
        </Menu>
        <button className="icon-btn" onClick={toggleTheme} aria-label={theme === 'dark' ? t('top.lightMode') : t('top.darkMode')} title={theme === 'dark' ? t('top.lightMode') : t('top.darkMode')}><Icon name={theme === 'dark' ? 'sun' : 'moon'} /></button>
        {can('content.review') && (
          <Link to="/admin/moderation" className="icon-btn bell" aria-label={t('top.notifications') + (pending ? ` (${pending})` : '')} title={t('top.pendingReview', { n: pending })}>
            <Icon name="bell" />{pending > 0 && <span className="bell-dot">{pending}</span>}
          </Link>
        )}
        <Menu label={t('top.profile')} trigger={<Icon name="user" />}>
          {me ? <>
            <div className="menu-head"><strong>{me.fullName}</strong><span className="muted small">{t('role.' + me.role)}</span></div>
            {can('admin.access') && <Link to="/admin" className="menu-item" role="menuitem"><Icon name="settings" size={16} />{t('top.adminPanel')}</Link>}
            {can('studio.use') && <Link to="/studio" className="menu-item" role="menuitem"><Icon name="code" size={16} />HTML Studio</Link>}
            <Link to="/account" className="menu-item" role="menuitem"><Icon name="lock" size={16} />{t('top.account')}</Link>
            <button className="menu-item" role="menuitem" onClick={() => logout().then(() => navigate('/'))}><Icon name="logout" size={16} />{t('top.logout')}</button>
          </> : <Link to="/login" className="menu-item" role="menuitem"><Icon name="user" size={16} />{t('top.login')}</Link>}
        </Menu>
      </div>
    </header>
  );
}

function isActive(item: { path?: string }, loc: { path: string; search: string }) {
  if (!item.path) return false;
  const [p, s] = item.path.split('?');
  if (p === '/') return loc.path === '/';
  if (s) return loc.path === p && loc.search.replace('?', '').split('&').includes(s);
  if (p === '/lessons') return loc.path === '/lessons' && !/grade=/.test(loc.search);
  return loc.path === p || loc.path.startsWith(p + '/');
}

export function SideNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { boot, t } = useApp(); const loc = useLocation();
  const nav: any[] = boot?.nav ?? [];
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => { onClose(); }, [loc.path, loc.search]);
  useEffect(() => {
    if (!open) return; const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k); document.body.classList.add('no-scroll');
    navRef.current?.querySelector<HTMLElement>('a,button')?.focus();
    return () => { document.removeEventListener('keydown', k); document.body.classList.remove('no-scroll'); };
  }, [open]);
  return (
    <>
      {open && <div className="drawer-backdrop" onClick={onClose} aria-hidden="true" />}
      <aside className={cx('sidenav', open && 'open')} aria-label={t('nav.main')} id="sidenav">
        <button className="icon-btn drawer-close" onClick={onClose} aria-label={t('nav.closeMenu')}><Icon name="x" /></button>
        <nav ref={navRef}>
          <ul>
            {nav.map(item => {
              const kids: any[] = item.children ?? []; const childActive = kids.some(c => isActive(c, loc));
              const selfActive = !kids.length ? isActive(item, loc) : false;
              const isOpen = expanded[item.key] ?? childActive;
              return (
                <li key={item.key}>
                  {kids.length ? (
                    <>
                      <div className={cx('nav-row', (childActive || (loc.path === item.path && !loc.search)) && 'active-parent')}>
                        <Link to={item.path} className={cx('nav-link', isActive(item, loc) && 'active')} aria-current={isActive(item, loc) ? 'page' : undefined}><Icon name={item.icon ?? 'book'} /><span>{item.label}</span></Link>
                        <button className="nav-toggle" aria-expanded={isOpen} aria-controls={'sub-' + item.key} aria-label={item.label} onClick={() => setExpanded(s => ({ ...s, [item.key]: !isOpen }))}><Icon name="chevron-down" size={16} className={isOpen ? 'rot' : ''} /></button>
                      </div>
                      {isOpen && <ul className="subnav" id={'sub-' + item.key}>{kids.map(c => <li key={c.key}><Link to={c.path} className={cx('nav-link sub', isActive(c, loc) && 'active')} aria-current={isActive(c, loc) ? 'page' : undefined}><span>{c.label}</span></Link></li>)}</ul>}
                    </>
                  ) : (
                    <Link to={item.path} className={cx('nav-link', selfActive && 'active')} aria-current={selfActive ? 'page' : undefined}><Icon name={item.icon ?? 'book'} /><span>{item.label}</span></Link>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </>
  );
}

export function Footer() {
  const { t, siteName } = useApp();
  return (
    <footer className="footer">
      <div><strong>{siteName}</strong><span className="muted"> · {t('footer.note')}</span></div>
      <div className="muted small">{t('footer.disclaimer')}</div>
    </footer>
  );
}

export function PublicLayout({ children }: any) {
  const { t, isDemoSite } = useApp(); const [open, setOpen] = useState(false);
  return (
    <div className="app">
      <a className="skip-link" href="#main">{t('a11y.skip')}</a>
      <TopBar onMenu={() => setOpen(true)} />
      {isDemoSite && <div className="demo-banner" role="note"><Icon name="info" size={16} />{t('demo.banner')}</div>}
      <div className="shell">
        <SideNav open={open} onClose={() => setOpen(false)} />
        <main id="main" className="main" tabIndex={-1}>{children}<Footer /></main>
      </div>
    </div>
  );
}
