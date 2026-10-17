import { useApp } from '../lib/store';
import { Link, useTitle } from '../lib/router';
import { Icon } from '../components/ui';

const secs = Array.from({ length: 20 }, (_, i) => 's' + (i + 1));

export function Teachers() {
  const { t } = useApp(); useTitle(t('teachers.title') + ' — ' + t('site.short'));
  return (
    <div className="page prose">
      <header className="page-head"><h1>{t('teachers.title')}</h1><p className="lead">{t('teachers.lead')}</p></header>
      <section className="content-sec"><h2>{t('teachers.how')}</h2><ol><li>{t('teachers.how1')}</li><li>{t('teachers.how2')}</li><li>{t('teachers.how3')}</li><li>{t('teachers.how4')}</li></ol></section>
      <section className="content-sec"><h2>{t('teachers.template')}</h2><p>{t('teachers.templateText')}</p>
        <ol className="two-col">{secs.map(s => <li key={s}>{t('lesson.sec.' + s)}</li>)}</ol></section>
      <section className="content-sec"><h2>{t('teachers.safety')}</h2><ul><li>{t('teachers.safety1')}</li><li>{t('teachers.safety2')}</li><li>{t('teachers.safety3')}</li><li>{t('teachers.safety4')}</li></ul></section>
      <section className="content-sec"><h2>{t('teachers.contribute')}</h2><p>{t('teachers.contributeText')}</p><Link to="/guides" className="btn">{t('teachers.toGuides')}</Link></section>
    </div>
  );
}

export function Guides() {
  const { t } = useApp(); useTitle(t('guides.title') + ' — ' + t('site.short'));
  return (
    <div className="page prose">
      <header className="page-head"><h1>{t('guides.title')}</h1><p className="lead">{t('guides.lead')}</p></header>
      <section className="content-sec"><h2>{t('guides.plan')}</h2><ol><li>{t('guides.plan1')}</li><li>{t('guides.plan2')}</li><li>{t('guides.plan3')}</li><li>{t('guides.plan4')}</li><li>{t('guides.plan5')}</li></ol></section>
      <section className="content-sec"><h2>{t('guides.assess')}</h2><p>{t('guides.assessText')}</p></section>
      <section className="content-sec"><h2>{t('guides.official')}</h2><div className="callout"><Icon name="alert" size={18} /><div>{t('guides.officialText')}</div></div></section>
      <section className="content-sec"><h2>{t('guides.misc')}</h2><p>{t('guides.miscText')}</p><div className="content-actions"><Link to="/methods" className="btn">{t('kind.method.plural')}</Link><Link to="/integration" className="btn">{t('integration.title')}</Link></div></section>
    </div>
  );
}

export function About() {
  const { t, can } = useApp(); useTitle(t('about.title') + ' — ' + t('site.short'));
  return (
    <div className="page prose">
      <header className="page-head"><h1>{t('about.title')}</h1><p className="lead">{t('about.lead')}</p></header>
      <section className="content-sec"><h2>{t('about.goal')}</h2><p>{t('about.goalText')}</p></section>
      <section className="content-sec"><h2>{t('about.features')}</h2><ul><li>{t('about.f1')}</li><li>{t('about.f2')}</li><li>{t('about.f3')}</li><li>{t('about.f4')}</li></ul></section>
      <section className="content-sec"><h2>{t('about.status')}</h2><div className="callout callout-demo"><Icon name="info" size={18} /><div>{t('about.statusText')}</div></div></section>
      {can('admin.access') && <p><Link to="/admin" className="btn btn-primary">{t('top.adminPanel')}</Link></p>}
    </div>
  );
}

export function NotFound() {
  const { t } = useApp(); useTitle(t('state.notFound'));
  return <div className="page"><div className="state state-empty"><Icon name="search" size={40} /><h1 className="h2">{t('state.notFound')}</h1><p>{t('state.notFoundText')}</p><Link className="btn btn-primary" to="/">{t('nav.home')}</Link></div></div>;
}
