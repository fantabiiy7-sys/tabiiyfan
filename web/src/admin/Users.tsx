import { useState } from 'react';
import { useApp } from '../lib/store';
import { useTitle } from '../lib/router';
import { get, post, put } from '../lib/api';
import { useAsync, Loading, ErrorState, Empty, Icon, Field, Modal, Badge } from '../components/ui';
import { fmtDate } from '../lib/util';

const ROLE_KEYS = ['super_admin', 'republic_editor', 'regional_moderator', 'district_moderator', 'school_admin', 'teacher', 'student', 'guest'];
export function Users() {
  const { t, lang, can, me, toast } = useApp(); useTitle(t('admin.n.users'));
  const r = useAsync(s => get<any[]>('/api/admin/users', s), []);
  const [edit, setEdit] = useState<any | null>(null); const [err, setErr] = useState(''); const [saving, setSaving] = useState(false);
  const manage = can('users.manage');
  const msg = (e: any) => ({ role_not_allowed: t('admin.err.roleNotAllowed'), email_exists: t('admin.err.emailExists'), cannot_modify_self: t('admin.err.self'), password_required: t('login.passRule'), password_too_short: t('login.passRule'), password_weak: t('login.passRule'), invalid_input: t('admin.err.invalid') } as any)[e.code] ?? (e.status === 403 ? t('state.forbidden') : t('state.error'));
  const save = async () => {
    setSaving(true); setErr('');
    try {
      const e = edit;
      if (e.id) await put('/api/admin/users/' + e.id, { fullName: e.full_name, role: e.role, isActive: !!e.is_active, ...(e.password ? { password: e.password } : {}) });
      else await post('/api/admin/users', { email: e.email, fullName: e.full_name, role: e.role, password: e.password });
      toast(t('common.saved'), 'success'); setEdit(null); r.reload();
    } catch (x: any) { setErr(msg(x)); } finally { setSaving(false); }
  };
  const f = (k: string, v: any) => setEdit({ ...edit, [k]: v });
  return (
    <div>
      <div className="admin-head"><h1>{t('admin.n.users')}</h1>{manage && <div className="actions"><button className="btn btn-primary" onClick={() => { setErr(''); setEdit({ email: '', full_name: '', role: 'teacher', password: '', is_active: 1 }); }}><Icon name="plus" size={16} />{t('common.create')}</button></div>}</div>
      <div className="callout" role="note"><Icon name="shield" size={18} /><div>{t('admin.usersNote')}</div></div>
      {r.loading && !r.data ? <Loading /> : r.error ? <ErrorState error={r.error} onRetry={r.reload} /> : !r.data!.length ? <Empty title={t('empty.noItems')} icon="user" /> :
        <div className="table-wrap"><table><thead><tr><th>{t('login.fullName')}</th><th>Email</th><th>{t('admin.role')}</th><th>{t('admin.status')}</th><th>{t('admin.created')}</th><th><span className="sr-only">{t('common.actions')}</span></th></tr></thead>
          <tbody>{r.data!.map(u => <tr key={u.id}><td className="cell-title">{u.full_name}{u.id === me?.id && <> <Badge>{t('admin.you')}</Badge></>}</td><td>{u.email}</td><td>{t('role.' + u.role)}</td>
            <td>{u.is_active ? <Badge tone="ok">{t('admin.active')}</Badge> : <Badge tone="bad">{t('admin.blocked')}</Badge>}</td><td className="muted">{fmtDate(u.created_at, lang)}</td>
            <td className="row-actions">{manage && <button className="btn btn-sm" onClick={() => { setErr(''); setEdit({ ...u, password: '' }); }}>{t('common.edit')}</button>}</td></tr>)}</tbody></table></div>}
      {edit && <Modal title={edit.id ? t('common.edit') : t('common.create')} onClose={() => setEdit(null)} footer={<><button className="btn" onClick={() => setEdit(null)}>{t('common.cancel')}</button><button className="btn btn-primary" disabled={saving} onClick={save}>{t('common.save')}</button></>}>
        {err && <div className="callout callout-bad" role="alert">{err}</div>}
        {!edit.id && <Field label="Email" htmlFor="u-e"><input id="u-e" type="email" value={edit.email} onChange={e => f('email', e.target.value)} autoComplete="off" /></Field>}
        <Field label={t('login.fullName')} htmlFor="u-n"><input id="u-n" value={edit.full_name} onChange={e => f('full_name', e.target.value)} /></Field>
        <Field label={t('admin.role')} htmlFor="u-r"><select id="u-r" value={edit.role} onChange={e => f('role', e.target.value)}>{ROLE_KEYS.map(k => <option key={k} value={k}>{t('role.' + k)}</option>)}</select></Field>
        <Field label={edit.id ? t('admin.newPassword') : t('login.password')} htmlFor="u-p" hint={t('login.passRule')}><input id="u-p" type="password" autoComplete="new-password" value={edit.password} onChange={e => f('password', e.target.value)} /></Field>
        {edit.id && <label className="check"><input type="checkbox" checked={!!edit.is_active} disabled={edit.id === me?.id} onChange={e => f('is_active', e.target.checked ? 1 : 0)} />{t('admin.active')}</label>}
      </Modal>}
    </div>
  );
}

export function Roles() {
  const { t } = useApp(); useTitle(t('admin.n.roles'));
  const r = useAsync(s => get<any[]>('/api/admin/roles', s), []);
  if (r.loading && !r.data) return <Loading />; if (r.error) return <ErrorState error={r.error} onRetry={r.reload} />;
  const roles = r.data!; const perms = [...new Set(roles.flatMap(x => x.permissions as string[]))].sort();
  return (
    <div>
      <div className="admin-head"><h1>{t('admin.n.roles')}</h1></div>
      <p className="muted">{t('admin.rolesNote')}</p>
      <div className="table-wrap"><table className="matrix"><caption className="sr-only">{t('admin.n.roles')}</caption>
        <thead><tr><th scope="col">{t('admin.permission')}</th>{roles.map(x => <th scope="col" key={x.key}>{t('role.' + x.key)}</th>)}</tr></thead>
        <tbody>{perms.map(p => <tr key={p}><th scope="row"><code>{p}</code></th>{roles.map(x => <td key={x.key} style={{ textAlign: 'center' }}>{x.permissions.includes(p) ? <span aria-label={t('common.yes')}>✓</span> : <span className="muted" aria-label={t('common.no')}>–</span>}</td>)}</tr>)}</tbody></table></div>
    </div>
  );
}
