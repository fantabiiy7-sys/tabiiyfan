import { useRef, useState } from 'react';
import { useApp } from '../lib/store';
import { useTitle } from '../lib/router';
import { get, put, del, api } from '../lib/api';
import { useAsync, Loading, ErrorState, Empty, Icon, Field, Modal } from '../components/ui';
import { fmtBytes, fmtDate } from '../lib/util';

export function MediaAdmin() {
  const { t, lang, can, toast, confirm } = useApp(); useTitle(t('admin.n.media'));
  const r = useAsync(s => get<any[]>('/api/admin/media', s), []);
  const input = useRef<HTMLInputElement>(null); const [busy, setBusy] = useState(false); const [alt, setAlt] = useState(''); const [edit, setEdit] = useState<any | null>(null);
  const upMsg = (e: any) => ({ unsupported_type: t('admin.err.fileType'), file_too_large: t('admin.err.fileSize'), content_mismatch: t('admin.err.fileMismatch'), too_many_requests: t('state.tooMany') } as any)[e.code] ?? t('state.error');
  const upload = async (files: FileList | null) => {
    if (!files?.length) return; setBusy(true);
    for (const file of Array.from(files)) {
      try { await api('POST', '/api/admin/media', undefined, { raw: file, headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-Filename': encodeURIComponent(file.name), 'X-Alt': encodeURIComponent(alt) } }); toast(`${file.name}: ${t('admin.uploaded')}`, 'success'); }
      catch (e: any) { toast(`${file.name}: ${upMsg(e)}`, 'error'); }
    }
    setBusy(false); setAlt(''); if (input.current) input.current.value = ''; r.reload();
  };
  const remove = async (m: any) => {
    if (!(await confirm({ title: t('admin.deleteTitle'), message: t('admin.deleteMsg', { name: m.filename }), danger: true, okLabel: t('common.delete') }))) return;
    try { await del('/api/admin/media/' + m.id); toast(t('common.deleted'), 'success'); r.reload(); } catch (e: any) { toast(e.code === 'media_in_use' ? t('admin.err.inUse') : e.status === 403 ? t('state.forbidden') : t('state.error'), 'error'); }
  };
  const saveAlt = async () => { try { await put('/api/admin/media/' + edit.id, { altUz: edit.alt_uz ?? '', altRu: edit.alt_ru ?? '', altEn: edit.alt_en ?? '' }); toast(t('common.saved'), 'success'); setEdit(null); r.reload(); } catch { toast(t('state.error'), 'error'); } };
  const copy = async (m: any) => { try { await navigator.clipboard.writeText(location.origin + '/media/' + m.stored_name); toast(t('admin.copied'), 'success'); } catch { toast('/media/' + m.stored_name, 'info'); } };
  return (
    <div>
      <div className="admin-head"><h1>{t('admin.n.media')}</h1></div>
      <section className="panel"><h2>{t('admin.upload')}</h2><p className="small muted">{t('admin.uploadRules')}</p>
        <div className="toolbar"><div className="field grow"><label htmlFor="m-alt">{t('admin.altText')}</label><input id="m-alt" value={alt} onChange={e => setAlt(e.target.value)} maxLength={300} /></div>
          <div className="field"><label htmlFor="m-f">{t('admin.file')}</label><input id="m-f" ref={input} type="file" multiple accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml,application/pdf,video/mp4,video/webm" onChange={e => upload(e.target.files)} disabled={busy} /></div></div>
        {busy && <p role="status">{t('state.loading')}</p>}
      </section>
      {r.loading && !r.data ? <Loading /> : r.error ? <ErrorState error={r.error} onRetry={r.reload} /> : !r.data!.length ? <Empty title={t('admin.noMedia')} icon="image" /> :
        <div className="media-grid">{r.data!.map(m => (
          <div className="media-item" key={m.id}><div className="media-thumb">{m.mime.startsWith('image/') ? <img src={'/media/' + m.stored_name} alt={m.alt_uz || ''} loading="lazy" /> : <Icon name={m.mime.startsWith('video/') ? 'video' : 'file'} size={36} />}</div>
            <div className="media-meta"><strong title={m.filename}>{m.filename}</strong><span className="muted small">{m.mime} · {fmtBytes(m.size)}</span><span className="muted small">{fmtDate(m.created_at, lang)}{m.uploader ? ' · ' + m.uploader : ''}</span>
              {m.mime.startsWith('image/') && !m.alt_uz && <span className="small" style={{ color: 'var(--warn)' }}>{t('admin.noAlt')}</span>}
              <div className="content-actions" style={{ marginTop: 6 }}><button className="btn btn-sm" onClick={() => copy(m)}><Icon name="copy" size={14} />{t('admin.copyUrl')}</button><button className="btn btn-sm" onClick={() => setEdit({ ...m })}>{t('admin.altText')}</button>
                {can('media.manage') && <button className="btn btn-sm btn-ghost" onClick={() => remove(m)} aria-label={t('common.delete')}><Icon name="trash" size={14} /></button>}</div></div></div>))}</div>}
      {edit && <Modal title={t('admin.altText')} onClose={() => setEdit(null)} footer={<><button className="btn" onClick={() => setEdit(null)}>{t('common.cancel')}</button><button className="btn btn-primary" onClick={saveAlt}>{t('common.save')}</button></>}>
        {(['uz', 'ru', 'en'] as const).map(l => <Field key={l} label={l.toUpperCase()} htmlFor={'a-' + l}><input id={'a-' + l} value={edit['alt_' + l] ?? ''} maxLength={300} onChange={e => setEdit({ ...edit, ['alt_' + l]: e.target.value })} /></Field>)}
      </Modal>}
    </div>
  );
}
