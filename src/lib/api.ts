// Fetch-Wrapper für die BTM-API.
// In dev über Vite-Proxy, in production direkt gegen die selbe Origin.

const API_BASE = '/api';

export class ApiError extends Error {
  status: number;
  payload: unknown;
  constructor(status: number, message: string, payload: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export async function apiFetch<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const url = path.startsWith('/') ? `${API_BASE}${path}` : `${API_BASE}/${path}`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...opts.headers,
  };
  if (opts.body !== undefined && !(opts.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    method: opts.method ?? 'GET',
    credentials: 'include',
    headers,
    body:
      opts.body === undefined
        ? undefined
        : opts.body instanceof FormData
        ? opts.body
        : JSON.stringify(opts.body),
    signal: opts.signal,
  });

  const ct = res.headers.get('content-type') ?? '';
  const payload = ct.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    const message =
      (typeof payload === 'object' && payload !== null && 'error' in payload && String((payload as { error: unknown }).error)) ||
      `HTTP ${res.status}`;
    throw new ApiError(res.status, message, payload);
  }
  return payload as T;
}

// Convenience-Wrapper für Better-Auth-Endpoints (haben eigene Response-Form)
export function authFetch<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  return apiFetch<T>(`/auth${path.startsWith('/') ? path : `/${path}`}`, opts);
}
