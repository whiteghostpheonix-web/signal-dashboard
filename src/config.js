export const CF_ACCESS_CLIENT_ID = '0eb18a2d45d18039dd0e7790bf4e4a2c.access';
export const CF_ACCESS_CLIENT_SECRET = 'cfast_vab92laUqURYmDI8rQhmoOoXtXi6px1WRm9kaM9Rd06f08c7';
export const API_BASE = 'https://device-finance-api.whiteghostpheonix.workers.dev';

export function authHeaders() {
  return {
    'CF-Access-Client-Id': CF_ACCESS_CLIENT_ID,
    'CF-Access-Client-Secret': CF_ACCESS_CLIENT_SECRET,
  };
}

export async function api(path, opts = {}) {
  const r = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(opts.headers || {}),
    },
  });
  if (!r.ok) {
    let detail = '';
    try {
      const ct = r.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const j = await r.json();
        detail = j.error || JSON.stringify(j);
      } else {
        detail = (await r.text()).slice(0, 200);
      }
    } catch (_) { detail = 'unknown response'; }
    const err = new Error(`HTTP ${r.status}: ${detail}`);
    err.status = r.status;
    err.detail = detail;
    throw err;
  }
  return r.json();
}
