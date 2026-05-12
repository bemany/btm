// Schlanker Odoo-JSON-RPC-Client. Keine externe Lib — Odoo's `/jsonrpc`
// nimmt einfach `{ service, method, args }`-Calls entgegen.
//
// Sequence pro User-Sync:
//   1. authenticate(creds)             → uid
//   2. readUser(creds, uid)            → { partnerId, name, tz }
//   3. searchReadEvents(creds, partnerId, from, to)  → OdooEvent[]
//
// Fehler werden als OdooError mit `code` geworfen:
//   'auth_failed'   — Odoo akzeptiert Credentials nicht
//   'network'       — Timeout / DNS / TLS / Connection-Reset
//   'server_error'  — Odoo antwortet mit error-payload (Code 500/Exceptions)
//   'invalid_resp'  — Antwort hat nicht das erwartete Schema

const TIMEOUT_MS = 10_000;

export interface OdooCreds {
  url: string;       // z.B. "https://meinfahrer.odoo.com" (KEIN trailing /)
  database: string;
  username: string;
  apiKey: string;
}

export interface OdooUserInfo {
  uid: number;
  partnerId: number;
  name: string;
  tz: string | null;
}

export interface OdooEvent {
  id: number;
  name: string;
  location: string | false;
  start: string;     // "YYYY-MM-DD HH:mm:ss" UTC
  stop: string;
  allday: boolean;
  duration: number;
  user_id: [number, string] | false;
  partner_ids: number[];
  attendee_ids: number[];
}

export class OdooError extends Error {
  code: 'auth_failed' | 'network' | 'server_error' | 'invalid_resp';
  details?: unknown;
  constructor(code: OdooError['code'], message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

async function jsonRpc(url: string, service: string, method: string, args: unknown[]): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${normalizeUrl(url)}/jsonrpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { service, method, args } }),
      signal: ctrl.signal,
    });
  } catch (e) {
    throw new OdooError('network', `Connect failed: ${(e as Error).message}`, e);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new OdooError('server_error', `Odoo HTTP ${res.status}`, { status: res.status });
  }
  let payload: { result?: unknown; error?: { data?: { name?: string; message?: string }; message?: string } };
  try {
    payload = (await res.json()) as typeof payload;
  } catch (e) {
    throw new OdooError('invalid_resp', `JSON parse failed: ${(e as Error).message}`, e);
  }
  if (payload.error) {
    // Odoo wraps auth errors auch als „error" mit data.name = 'odoo.exceptions.AccessDenied'
    const name = payload.error.data?.name ?? '';
    const isAuth = name.includes('AccessDenied') || name.includes('AccessError');
    throw new OdooError(
      isAuth ? 'auth_failed' : 'server_error',
      payload.error.data?.message ?? payload.error.message ?? 'Odoo error',
      payload.error,
    );
  }
  return payload.result;
}

export async function authenticate(c: OdooCreds): Promise<number> {
  const res = await jsonRpc(c.url, 'common', 'authenticate', [c.database, c.username, c.apiKey, {}]);
  if (typeof res !== 'number' || res === 0) {
    throw new OdooError('auth_failed', 'Authenticate returned no UID');
  }
  return res;
}

export async function readUserInfo(c: OdooCreds, uid: number): Promise<OdooUserInfo> {
  const res = await jsonRpc(c.url, 'object', 'execute_kw', [
    c.database, uid, c.apiKey,
    'res.users', 'read',
    [[uid]],
    { fields: ['id', 'name', 'partner_id', 'tz'] },
  ]);
  if (!Array.isArray(res) || res.length === 0) {
    throw new OdooError('invalid_resp', 'res.users.read returned no rows');
  }
  const row = res[0] as { id: number; name: string; partner_id: [number, string] | false; tz: string | false };
  if (!row.partner_id || !Array.isArray(row.partner_id)) {
    throw new OdooError('invalid_resp', 'res.users hat keinen partner_id');
  }
  return {
    uid: row.id,
    partnerId: row.partner_id[0],
    name: row.name,
    tz: typeof row.tz === 'string' ? row.tz : null,
  };
}

/**
 * Holt alle calendar.event Records bei denen `partnerId` als Teilnehmer eingetragen ist.
 * `fromIso` / `toIso` sind UTC-Strings im Odoo-Format `YYYY-MM-DD HH:mm:ss`.
 */
export async function searchReadEvents(
  c: OdooCreds,
  uid: number,
  partnerId: number,
  fromIso: string,
  toIso: string,
): Promise<OdooEvent[]> {
  const res = await jsonRpc(c.url, 'object', 'execute_kw', [
    c.database, uid, c.apiKey,
    'calendar.event', 'search_read',
    [[
      ['start', '>=', fromIso],
      ['start', '<', toIso],
      ['partner_ids', 'in', [partnerId]],
    ]],
    {
      fields: ['id', 'name', 'location', 'start', 'stop', 'allday', 'duration', 'user_id', 'partner_ids', 'attendee_ids'],
      order: 'start asc',
      limit: 500,
    },
  ]);
  if (!Array.isArray(res)) {
    throw new OdooError('invalid_resp', 'calendar.event.search_read no array');
  }
  return res as OdooEvent[];
}

/** Helper: JS-Date → Odoo-Datetime-String (UTC, "YYYY-MM-DD HH:mm:ss"). */
export function toOdooDateTime(d: Date): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
         `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

/** Helper: Odoo-Datetime-String (UTC, "YYYY-MM-DD HH:mm:ss") → JS-Date. */
export function fromOdooDateTime(s: string): Date {
  // Odoo liefert UTC ohne TZ-Suffix — wir hängen 'Z' an damit JS UTC parst.
  return new Date(s.replace(' ', 'T') + 'Z');
}
