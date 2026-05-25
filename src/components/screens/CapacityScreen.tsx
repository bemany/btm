import type { CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStore } from '../../store/store';
import { Avatar } from '../shared/Avatar';
import { useT, useLocale } from '../../i18n';
import { listTasks, fromServerTask } from '../../data/api';

export function CapacityScreen() {
  const tasks = useStore((s) => s.tasks);
  const users = useStore((s) => s.users);
  const t = useT();
  const [locale] = useLocale();
  const fmtNum = (h: number) => h.toFixed(1).replace('.', locale === 'en' ? '.' : ',');

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
    // Planned: nur aktive, nicht-archivierte, nicht-done — das sind die kommenden Aufgaben
    const myActiveTasks = tasks.filter((tk) => tk.who === u.id && tk.col !== 'done');
    const planned = myActiveTasks.reduce((a, b) => a + b.estH, 0);
    // Logged: ueber ALLE Tasks (auch archivierte) damit historische Stunden bleiben
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
          <h1>{t('capacity.title', { kw: 19 })}</h1>
          <div className="subtitle">
            {t('capacity.sub', { count: rows.length, totalCap })}
          </div>
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
