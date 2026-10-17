import { useState } from 'react';
import { useApp } from '../lib/store';
import { Link, useLocation, matchPath, navigate, useTitle } from '../lib/router';
import { Icon, ErrorState } from '../components/ui';
import { TopBar, Footer } from '../components/Layout';
import { cx } from '../lib/util';
import { Dashboard } from './Dashboard';
import { ContentList } from './ContentList';
import { ContentEditor } from './ContentEditor';
import { Moderation } from './Moderation';
import { Taxonomy } from './Taxonomy';
import { Users, Roles } from './Users';
import { I18nAdmin } from './I18nAdmin';
import { MediaAdmin } from './MediaAdmin';
import { SettingsAdmin } from './SettingsAdmin';
import { HomeAdmin, NavAdmin } from './HomeNavAdmin';
import { System } from './System';

const KINDS = ['lesson', 'method', 'lab', 'animation', 'video', 'ebook', 'assessment', 'project'];
interface NavDef { to: string; icon: string; label: string; perm?: string; match?: (p: string, s: string) => boolean }

export default function AdminApp() {
  const { me, t, can } = useApp(); const loc = useLocation(); const [open, setOpen] = useState(false);
  useTitle(t('admin.title') + ' — ' + t('site.short'));
  if (!me) { setTimeout(() => navigate('/login?next=' + encodeURIComponent(loc.full), { replace: true }), 0); return null; }
  if (!can('admin.access')) return <div className="page narrow"><ErrorState error={{ code: 'forbidden' }} /><p style={{ textAlign: 'center' }}><Link to="/" className="btn">{t('nav.home')}</Link></p></div>;
  const kindOf = (s: string) => new URLSearchParams(s).get('kind') ?? 'lesson';
  const groups: { title: string; items: NavDef[] }[] = [
    { title: t('admin.g.overview'), items: [
      { to: '/admin', icon: 'grid', label: t('admin.n.dashboard'), match: p => p === '/admin' },
      { to: '/admin/moderation', icon: 'check-circle', label: t('admin.n.moderation'), perm: 'content.review' } ] },
    { title: t('admin.g.content'), items: [
      { to: '/admin/content?kind=lesson', icon: 'book', label: t('admin.n.lessons'), match: (p, s) => (p === '/admin/content' && kindOf(s) === 'lesson') || (p.startsWith('/admin/content/') && false) },
      { to: '/admin/taxonomy', icon: 'folder', label: t('admin.n.taxonomy'), perm: 'taxonomy.manage' },
      { to: '/admin/taxonomy?tab=subjects', icon: 'users', label: t('admin.n.integration'), perm: 'taxonomy.manage', match: (p, s) => p === '/admin/taxonomy' && s.includes('tab=subjects') },
      ...(['method', 'lab', 'animation', 'video', 'ebook', 'assessment', 'project'] as const).map(k => ({ to: `/admin/content?kind=${k}`, icon: ({ method: 'users', lab: 'flask', animation: 'sparkles', video: 'video', ebook: 'library', assessment: 'check', project: 'folder' } as any)[k], label: t('admin.n.' + k), match: (p: string, s: string) => p === '/admin/content' && kindOf(s) === k })),
      { to: '/studio', icon: 'code', label: 'HTML Studio', perm: 'studio.use' },
      { to: '/admin/home', icon: 'news', label: t('admin.n.news'), perm: 'announcements.manage', match: (p, s) => p === '/admin/home' && !s.includes('tab=home') },
      { to: '/admin/media', icon: 'image', label: t('admin.n.media'), perm: 'media.upload' } ] },
    { title: t('admin.g.platform'), items: [
      { to: '/admin/home?tab=home', icon: 'home', label: t('admin.n.home'), perm: 'home.manage', match: (p, s) => p === '/admin/home' && s.includes('tab=home') },
      { to: '/admin/nav', icon: 'list', label: t('admin.n.nav'), perm: 'nav.manage' },
      { to: '/admin/i18n', icon: 'globe', label: t('admin.n.i18n'), perm: 'i18n.manage' },
      { to: '/admin/settings', icon: 'settings', label: t('admin.n.settings'), perm: 'settings.manage' } ] },
    { title: t('admin.g.people'), items: [
      { to: '/admin/users', icon: 'user', label: t('admin.n.users'), perm: 'users.read' },
      { to: '/admin/roles', icon: 'shield', label: t('admin.n.roles'), perm: 'users.read' } ] },
    { title: t('admin.g.system'), items: [
      { to: '/admin/audit', icon: 'clock', label: t('admin.n.audit'), perm: 'audit.read' },
      { to: '/admin/versions', icon: 'history', label: t('admin.n.versions'), perm: 'content.read_all' },
      { to: '/admin/backup', icon: 'database', label: t('admin.n.backup'), perm: 'backup.export' } ] },
  ];
  const isAct = (n: NavDef) => n.match ? n.match(loc.path, loc.search) : loc.path === n.to.split('?')[0] && (!n.to.includes('?') || loc.search.includes(n.to.split('?')[1]));
  return (
    <div className="app admin">
      <a className="skip-link" href="#main">{t('a11y.skip')}</a>
      <TopBar admin onMenu={() => setOpen(true)} />
      <div className="shell">
        {open && <div className="drawer-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />}
        <aside className={cx('sidenav adminnav', open && 'open')} aria-label={t('admin.title')}>
          <button className="icon-btn drawer-close" onClick={() => setOpen(false)} aria-label={t('nav.closeMenu')}><Icon name="x" /></button>
          <nav>{groups.map(g => { const items = g.items.filter(i => !i.perm || can(i.perm)); if (!items.length) return null; return (
            <div key={g.title}><h4>{g.title}</h4><ul>{items.map(n => <li key={n.to}><Link to={n.to} onClick={() => setOpen(false)} className={cx('nav-link', isAct(n) && 'active')} aria-current={isAct(n) ? 'page' : undefined}><Icon name={n.icon} /><span>{n.label}</span></Link></li>)}</ul></div>); })}
            <h4>{t('admin.g.site')}</h4><ul><li><Link to="/" className="nav-link"><Icon name="external" /><span>{t('admin.viewSite')}</span></Link></li></ul>
          </nav>
        </aside>
        <main id="main" className="admin-main" tabIndex={-1}><AdminRoutes path={loc.path} />{<Footer />}</main>
      </div>
    </div>
  );
}

function AdminRoutes({ path }: { path: string }) {
  const { can, t } = useApp();
  const guard = (perm: string, el: any) => can(perm) ? el : <ErrorState error={{ code: 'forbidden' }} />;
  if (path === '/admin') return <Dashboard />;
  if (path === '/admin/content') return guard('content.read_all', <ContentList />);
  const ed = matchPath('/admin/content/:id', path); if (ed) return guard('content.read_all', <ContentEditor key={ed.id} id={ed.id} />);
  if (path === '/admin/moderation') return guard('content.review', <Moderation />);
  if (path === '/admin/taxonomy') return guard('taxonomy.manage', <Taxonomy />);
  if (path === '/admin/users') return guard('users.read', <Users />);
  if (path === '/admin/roles') return guard('users.read', <Roles />);
  if (path === '/admin/i18n') return guard('i18n.manage', <I18nAdmin />);
  if (path === '/admin/media') return guard('media.upload', <MediaAdmin />);
  if (path === '/admin/settings') return guard('settings.manage', <SettingsAdmin />);
  if (path === '/admin/home') return guard('home.manage', <HomeAdmin />);
  if (path === '/admin/nav') return guard('nav.manage', <NavAdmin />);
  if (path === '/admin/audit' || path === '/admin/versions' || path === '/admin/backup') return <System which={path.split('/')[2]} />;
  void t; void KINDS;
  return <ErrorState error={{ code: 'not_found' }} />;
}
