// Backend bilan aloqa. CSRF tokeni sessiya bilan birga keladi va har bir o'zgartiruvchi so'rovga qo'shiladi.
let csrf = '';
export const setCsrf = (t: string) => { csrf = t; };

export class ApiError extends Error {
  constructor(public status: number, public code: string, message?: string) { super(message || code); }
}

export async function api<T = any>(method: string, url: string, body?: unknown, opts: { raw?: Blob | ArrayBuffer; headers?: Record<string, string>; signal?: AbortSignal } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', ...(opts.headers ?? {}) };
  if (csrf && method !== 'GET') headers['X-CSRF-Token'] = csrf;
  let payload: BodyInit | undefined;
  if (opts.raw) payload = opts.raw as any;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  let res: Response;
  try { res = await fetch(url, { method, headers, body: payload, credentials: 'same-origin', signal: opts.signal }); }
  catch (e: any) { if (e?.name === 'AbortError') throw e; throw new ApiError(0, 'network', 'network'); }
  const text = await res.text();
  let data: any = null; try { data = text ? JSON.parse(text) : null; } catch { /* html/matn */ }
  if (!res.ok) {
    const err = new ApiError(res.status, data?.error ?? 'error', data?.message);
    if (res.status === 401) window.dispatchEvent(new CustomEvent('tf:unauth'));
    throw err;
  }
  return data as T;
}
export const get = <T = any>(url: string, signal?: AbortSignal) => api<T>('GET', url, undefined, { signal });
export const post = <T = any>(url: string, body?: unknown) => api<T>('POST', url, body ?? {});
export const put = <T = any>(url: string, body?: unknown) => api<T>('PUT', url, body ?? {});
export const del = <T = any>(url: string) => api<T>('DELETE', url);

export const qs = (o: Record<string, string | number | undefined | null | boolean>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== '' && v !== false) p.set(k, String(v));
  const s = p.toString(); return s ? '?' + s : '';
};
