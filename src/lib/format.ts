export function fmtHMS(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

export function fmtMS(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

export function fmtH(h: number | null | undefined): string {
  if (h == null) return '—';
  return h.toFixed(1).replace('.', ',') + 'h';
}

// Demo-Anker: alle "heute"/"morgen"-Berechnungen relativ zu diesem Datum.
export const DEMO_TODAY = new Date('2026-05-04T00:00:00');
export const DEMO_WEEK = 'KW 19 · 04.–08. Mai 2026';
export const DEMO_DAYS = ['Mo 04', 'Di 05', 'Mi 06', 'Do 07', 'Fr 08'];
