import { lazy, Suspense, useEffect } from 'react';
import { useApp } from './lib/store';
import { useLocation, matchPath } from './lib/router';
import { PublicLayout } from './components/Layout';
import { Loading, ErrorState } from './components/ui';
import { PATH_KIND } from './lib/util';
import { Home } from './pages/Home';
import { Catalog } from './pages/Catalog';
import { ContentPage } from './pages/ContentPage';
import { Topics, Integration, SearchPage } from './pages/Browse';
import { Teachers, Guides, About, NotFound } from './pages/Static';
import { Login, Account } from './pages/Account';

const AdminApp = lazy(() => import('./admin/AdminApp'));
const StudioApp = lazy(() => import('./studio/StudioApp'));

export function App() {
  const { boot, bootError, t } = useApp(); const { path } = useLocation();
  useEffect(() => { document.getElementById('main')?.focus?.({ preventScroll: true }); }, [path]);
  if (bootError && !boot) return <div className="boot-error"><ErrorState error={{ code: bootError === 'network' ? 'network' : 'error' }} onRetry={() => location.reload()} /></div>;
  if (!boot) return <div className="boot-loading"><Loading /></div>;
  if (path === '/admin' || path.startsWith('/admin/')) return <Suspense fallback={<div className="boot-loading"><Loading /></div>}><AdminApp /></Suspense>;
  if (path === '/studio' || path.startsWith('/studio/')) return <Suspense fallback={<div className="boot-loading"><Loading /></div>}><StudioApp /></Suspense>;
  return <PublicLayout><Routes path={path} /></PublicLayout>;
}

function Routes({ path }: { path: string }) {
  if (path === '/') return <Home />;
  if (path === '/topics') return <Topics />;
  if (path === '/integration') return <Integration />;
  if (path === '/search') return <SearchPage />;
  if (path === '/teachers') return <Teachers />;
  if (path === '/guides') return <Guides />;
  if (path === '/about') return <About />;
  if (path === '/login') return <Login />;
  if (path === '/account') return <Account />;
  const list = matchPath('/:kind', path);
  if (list && PATH_KIND[list.kind]) return <Catalog kind={PATH_KIND[list.kind]} />;
  const one = matchPath('/:kind/:slug', path);
  if (one && PATH_KIND[one.kind]) return <ContentPage slug={one.slug} />;
  return <NotFound />;
}
