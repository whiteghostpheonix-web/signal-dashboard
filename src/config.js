export const API_BASE = 'https://device-finance-api.whiteghostpheonix.workers.dev';

export function getToken() {
  return localStorage.getItem('admin_token');
}

export async function api(path, opts = {}) {
  const token = getToken();
  const headers = new Headers(opts.headers || {});
  if (!headers.has('Content-Type') && opts.body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json().catch(() => ({}))
    : await response.text().catch(() => '');

  if (!response.ok) {
    const detail = typeof payload === 'string' ? payload : (payload.error || JSON.stringify(payload));
    const error = new Error(detail || `HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return payload;
}
