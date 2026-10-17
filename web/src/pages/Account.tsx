import { useState } from 'react';
import { useApp } from '../lib/store';
import { navigate, useQuery, useTitle } from '../lib/router';
import { post } from '../lib/api';
import { Field, Icon } from '../components/ui';

export function Login() {
  const { t, login, me } = useApp(); const [q] = useQuery(); useTitle(t('login.title') + ' — ' + t('site.short'));
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const [show, setShow] = useState(false);
  const next = q.get('next') && q.get('next')!.startsWith('/') && !q.get('next')!.startsWith('//') ? q.get('next')! : '/';
  if (me) return <div className="page narrow"><div className="panel"><p>{t('login.already', { name: me.fullName })}</p><button className="btn btn-primary" onClick={() => navigate(next)}>{t('common.continue')}</button></div></div>;
  const submit = async (e: any) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { await login(email.trim(), password); navigate(next); }
    catch (ex: any) { setErr(({ invalid_credentials: t('login.invalid'), account_locked: t('login.locked'), account_disabled: t('login.disabled'), too_many_requests: t('login.tooMany'), network: t('state.network') } as any)[ex.code] ?? t('state.error')); }
    finally { setBusy(false); }
  };
  return (
    <div className="page narrow">
      <form className="panel auth-form" onSubmit={submit} noValidate>
        <h1 className="h2">{t('login.title')}</h1><p className="muted">{t('login.lead')}</p>
        {err && <div className="callout callout-error" role="alert"><Icon name="alert" size={18} /><div>{err}</div></div>}
        <Field label={t('login.email')} htmlFor="l-email"><input id="l-email" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></Field>
        <Field label={t('login.password')} htmlFor="l-pw">
          <div className="input-icon pw"><input id="l-pw" type={show ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />
            <button type="button" className="icon-btn" onClick={() => setShow(s => !s)} aria-label={show ? t('login.hide') : t('login.show')}><Icon name={show ? 'eye-off' : 'eye'} size={18} /></button></div>
        </Field>
        <button className="btn btn-primary btn-block" disabled={busy || !email || !password}>{busy ? t('state.loading') : t('top.login')}</button>
        <p className="muted small">{t('login.noRegister')}</p>
      </form>
    </div>
  );
}

export function Account() {
  const { t, me, toast } = useApp(); useTitle(t('top.account') + ' — ' + t('site.short'));
  const [cur, setCur] = useState(''); const [nw, setNw] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  if (!me) { setTimeout(() => navigate('/login?next=/account', { replace: true }), 0); return null; }
  const submit = async (e: any) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { await post('/api/auth/password', { current: cur, next: nw }); toast(t('account.changed'), 'success'); setCur(''); setNw(''); }
    catch (ex: any) { setErr(({ invalid_credentials: t('account.wrongCurrent'), password_too_short: t('account.tooShort'), password_weak: t('account.weak') } as any)[ex.code] ?? t('state.error')); }
    finally { setBusy(false); }
  };
  return (
    <div className="page narrow">
      <header className="page-head"><h1>{t('top.account')}</h1></header>
      <div className="panel"><dl className="meta-grid"><div><dt>{t('login.email')}</dt><dd>{me.email}</dd></div><div><dt>{t('account.name')}</dt><dd>{me.fullName}</dd></div><div><dt>{t('account.role')}</dt><dd>{t('role.' + me.role)}</dd></div></dl></div>
      <form className="panel auth-form" onSubmit={submit}>
        <h2 className="h3">{t('account.changePw')}</h2>
        {err && <div className="callout callout-error" role="alert"><Icon name="alert" size={18} /><div>{err}</div></div>}
        <Field label={t('account.current')} htmlFor="a-cur"><input id="a-cur" type="password" autoComplete="current-password" value={cur} onChange={e => setCur(e.target.value)} required /></Field>
        <Field label={t('account.new')} htmlFor="a-new" hint={t('account.pwRule')}><input id="a-new" type="password" autoComplete="new-password" value={nw} onChange={e => setNw(e.target.value)} required minLength={10} /></Field>
        <button className="btn btn-primary" disabled={busy || !cur || nw.length < 10}>{t('common.save')}</button>
      </form>
    </div>
  );
}
