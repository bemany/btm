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

// F4ItOLZIZ2-: Stunden lesbar als "Hh MM" oder "MMm" formatieren — keine
// Dezimalstunden mehr (0,7 ist schwerer zu erfassen als 42m).
//   0    → "0m"
//   0.7  → "42m"
//   1    → "1h"
//   1.5  → "1h30"
//   2.25 → "2h15"
export function fmtHM(h: number | null | undefined): string {
  if (h == null || !isFinite(h) || h < 0) return '0m';
  const totalMin = Math.round(h * 60);
  if (totalMin === 0) return '0m';
  if (totalMin < 60) return `${totalMin}m`;
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h${String(mins).padStart(2, '0')}`;
}

// Demo-Anker: alle "heute"/"morgen"-Berechnungen relativ zu diesem Datum.
export const DEMO_TODAY = new Date('2026-05-04T00:00:00');
export const DEMO_WEEK = 'KW 19 · 04.–08. Mai 2026';
export const DEMO_DAYS = ['Mo 04', 'Di 05', 'Mi 06', 'Do 07', 'Fr 08'];
