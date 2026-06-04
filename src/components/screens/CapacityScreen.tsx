import type { CSSProperties } from 'react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStore } from '../../store/store';
import { Avatar } from '../shared/Avatar';
import { Icon } from '../shared/Icon';
import { useT, useLocale } from '../../i18n';
import { listTasks, fromServerTask } from '../../data/api';
import type { Task } from '../../store/types';

// F8O1Z0G38WT: Wochenauswahl. Helper-Logik kommt 1:1 aus BoardTimeline.
function mondayOfDate(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  const dow = (out.getDay() || 7) - 1;
  out.setDate(out.getDate() - dow);
  return out;
}
function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function isoWeek(d: Date): number {
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}
type DuePlacement = number | 'no-due' | 'out-of-week';
function dueDayIndex(due: string | null | undefined, weekStart: Date): DuePlacement {
  if (!due) return 'no-due';
  if (due === 'today') return 0;
  if (due === 'tomorrow') return 1;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(due);
  if (!m) return 'no-due';
  const target = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const days = Math.round((target.getTime() - weekStart.getTime()) / 86400000);
  if (days < 0 || days > 4) return 'out-of-week';
  return days;
}
// Wie viele Stunden plant der User in dieser Woche fuer diese Task? Multi-
// Tag-Plan zaehlt mehrfach (jeder Plan-Tag bucht estH). Tasks ohne Plan-Tag
// fallen zurueck auf die Frist.
function plannedHoursInWeek(tk: Task, weekStart: Date): number {
  if (tk.plannedFor && tk.plannedFor.length > 0) {
    let count = 0;
    for (const d of tk.plannedFor) {
      const di = dueDayIndex(d, weekStart);
      if (typeof di === 'number') count += 1;
    }
    return count * tk.estH;
  }
  const di = dueDayIndex(tk.due, weekStart);
  if (typeof di === 'number') return tk.estH;
  return 0;
}

export function CapacityScreen() {
  const tasks = useStore((s) => s.tasks);
  const users = useStore((s) => s.users);
  const t = useT();
  const [locale] = useLocale();
  const fmtNum = (h: number) => h.toFixed(1).replace('.', locale === 'en' ? '.' : ',');

  // Wochenanker — Default: aktuelle Woche.
  const [weekStart, setWeekStart] = useState<Date>(() => mondayOfDate(new Date()));
  const shiftWeek = (delta: number) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + delta);
    setWeekStart(d);
  };
  const goToday = () => setWeekStart(mondayOfDate(new Date()));
  const fmtDay = (d: Date) =>
    d.toLocaleDateString(locale === 'en' ? 'en-US' : 'de-DE', { day: '2-digit', month: '2-digit' });
  const friday = new Date(weekStart);
  friday.setDate(friday.getDate() + 4);
  const kw = isoWeek(weekStart);

  // FEI436brUlv: gebuchte Stunden archivierter Aufgaben muessen weiter in
  // die Kapazitaets-Summe einfliessen. Separate Query mit archived=all.
  const allTasksQ = useQuery({
    queryKey: ['btm', 'tasks', 'all-with-archived'],
    queryFn: async () => {
      const list = await listTasks({ archived: 'all' });
      return list.map((s) => fromServerTask(s, []));
    },
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
  const allTasks = allTasksQ.data ?? tasks;

  const activeUsers = users.filter((u) => u.status === 'active');
  const rows = activeUsers.map((u) => {
    // Planned: nur Tasks, die in der aktuell ausgewaehlten Woche einen
    // Plan-Tag haben (oder ohne plannedFor eine Frist in der Woche). Erledigte
    // raus — wer fertig ist, blockt keine Kapazitaet mehr.
    const myActiveTasks = tasks.filter((tk) => tk.who === u.id && tk.col !== 'done');
    const planned = myActiveTasks.reduce((a, b) => a + plannedHoursInWeek(b, weekStart), 0);
    // Logged: ueber ALLE Tasks (auch archivierte) — Lifetime-Summe, nicht
    // wochengefiltert. Pro Woche aufzuteilen braeuchte Session-Daten die hier
    // nicht im Store sind.
    const logged = allTasks.filter((tk) => tk.who === u.id).reduce((a, b) => a + b.loggedH, 0);
    return { ...u, full: u.name, role: u.jobTitle ?? '—', planned, logged };
  });
  const totalCap = rows.reduce((a, r) => a + r.cap, 0) || 1;
  const totalPlan = rows.reduce((a, r) => a + r.planned, 0);
  const totalLog = rows.reduce((a, r) => a + r.logged, 0);

  return (
    <div className="page">
      <div className="page-head">
        <div className="left">
          <div className="eyebrow">{t('capacity.eyebrow')}</div>
          <h1>{t('capacity.title', { kw })}</h1>
          <div className="subtitle">
            {t('capacity.sub', { count: rows.length, totalCap })}
          </div>
        </div>
        <div className="cap-week-nav">
          <button
            type="button"
            className="cap-week-btn"
            onClick={() => shiftWeek(-7)}
            title={t('times.prev_week')}
            aria-label={t('times.prev_week')}
          >
            <Icon name="chevron-left" size={14} />
          </button>
          <div className="cap-week-label">
            <span className="cap-week-kw">KW {kw}</span>
            <span className="cap-week-range">
              {fmtDay(weekStart)} – {fmtDay(friday)}
            </span>
          </div>
          <button
            type="button"
            className="cap-week-btn"
            onClick={() => shiftWeek(7)}
            title={t('times.next_week')}
            aria-label={t('times.next_week')}
          >
            <Icon name="chevron-right" size={14} />
          </button>
          <button type="button" className="cap-week-today" onClick={goToday}>
            {t('common.today')}
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi">
          <div className="k">{t('capacity.kpi_capacity')}</div>
          <div className="v">
            {totalCap}
            <span className="u">h</span>
          </div>
          <div className="d">{t('capacity.kpi_capacity_sub', { count: rows.length })}</div>
        </div>
        <div className="kpi">
          <div className="k">{t('capacity.kpi_planned')}</div>
          <div className="v">
            {totalPlan.toFixed(0)}
            <span className="u">h</span>
          </div>
          <div className="d">{t('capacity.kpi_planned_sub', { pct: Math.round((totalPlan / totalCap) * 100) })}</div>
        </div>
        <div className="kpi">
          <div className="k">{t('capacity.kpi_logged')}</div>
          <div className="v">
            {fmtNum(totalLog)}
            <span className="u">h</span>
          </div>
          <div className="d">
            {t('capacity.kpi_logged_sub', { pct: Math.round((totalLog / Math.max(totalPlan, 1)) * 100) })}
          </div>
        </div>
        <div className="kpi">
          <div className="k">{t('capacity.kpi_overload')}</div>
          <div className="v">{rows.filter((r) => r.planned > r.cap).length}</div>
          <div className="d warn">
            {rows
              .filter((r) => r.planned > r.cap)
              .map((r) => r.name)
              .join(', ') || '—'}
          </div>
        </div>
      </div>

      <div className="cap-container">
        <div className="cap-table-head">
          <span>{t('capacity.employee')}</span>
          <span>{t('capacity.utilization')}</span>
          <span style={{ textAlign: 'right' }}>{t('capacity.hours')}</span>
          <span style={{ textAlign: 'right' }}>{t('capacity.pct')}</span>
        </div>
        {rows.map((r) => {
          const pct = (r.planned / r.cap) * 100;
          const lpct = (r.logged / r.cap) * 100;
          const cls = r.planned > r.cap ? 'over' : r.planned < r.cap * 0.75 ? 'under' : '';
          return (
            <div key={r.id} className="cap-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar id={r.id} size={32} />
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{r.full}</div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--ink-500)' }}>
                    {r.role} · {t('capacity.cap_per_week', { cap: r.cap })}
                  </div>
                </div>
              </div>
              <div
                className={`cap-bar ${cls}`}
                style={{
                  ['--p' as keyof CSSProperties]: `${Math.min(pct, 130)}%`,
                  ['--l' as keyof CSSProperties]: `${Math.min(lpct, 130)}%`,
                } as CSSProperties}
              >
                <div className="planned" />
                <div className="logged" />
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="mono" style={{ fontSize: 13, fontWeight: 600 }}>
                  {fmtNum(r.planned)} / {r.cap}h
                </div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--ink-500)' }}>
                  {t('capacity.captured', { h: fmtNum(r.logged) })}
                </div>
              </div>
              <div
                className="mono"
                style={{
                  textAlign: 'right',
                  fontSize: 16,
                  fontWeight: 700,
                  fontFamily: 'var(--font-display)',
                  color:
                    cls === 'over' ? 'var(--err-500)' : cls === 'under' ? 'var(--ok-500)' : 'var(--ink-900)',
                }}
              >
                {Math.round(pct)}%
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 14,
          fontSize: 12,
          color: 'var(--ink-500)',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '0 4px',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 8, background: 'var(--accent-500)', borderRadius: 2 }} /> {t('capacity.legend_planned')}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 8, background: 'rgba(0,0,0,0.18)', borderRadius: 2 }} /> {t('capacity.legend_logged')}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 8, background: 'var(--err-500)', borderRadius: 2 }} /> {t('capacity.legend_overload')}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 8, background: 'var(--ok-500)', borderRadius: 2 }} /> {t('capacity.legend_underload')}
        </span>
      </div>
    </div>
  );
}
