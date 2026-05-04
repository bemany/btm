import type { CSSProperties } from 'react';
import { useStore } from '../../store/store';
import { Avatar } from '../shared/Avatar';

export function CapacityScreen() {
  const tasks = useStore((s) => s.tasks);
  const users = useStore((s) => s.users);

  const activeUsers = users.filter((u) => u.status === 'active');
  const rows = activeUsers.map((u) => {
    const myTasks = tasks.filter((t) => t.who === u.id && t.col !== 'done');
    const planned = myTasks.reduce((a, b) => a + b.estH, 0);
    const logged = tasks.filter((t) => t.who === u.id).reduce((a, b) => a + b.loggedH, 0);
    return { ...u, full: u.name, role: u.jobTitle ?? '—', planned, logged };
  });
  const totalCap = rows.reduce((a, r) => a + r.cap, 0) || 1;
  const totalPlan = rows.reduce((a, r) => a + r.planned, 0);
  const totalLog = rows.reduce((a, r) => a + r.logged, 0);

  return (
    <div className="page">
      <div className="page-head">
        <div className="left">
          <div className="eyebrow">03 · Kapazität</div>
          <h1>Team-Auslastung KW 19</h1>
          <div className="subtitle">
            {rows.length} Mitarbeiter · {totalCap}h Gesamtkapazität · Stundenbasiert
          </div>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi">
          <div className="k">Team-Kapazität</div>
          <div className="v">
            {totalCap}
            <span className="u">h</span>
          </div>
          <div className="d">{rows.length} Mitarb.</div>
        </div>
        <div className="kpi">
          <div className="k">Geplant</div>
          <div className="v">
            {totalPlan.toFixed(0)}
            <span className="u">h</span>
          </div>
          <div className="d">{Math.round((totalPlan / totalCap) * 100)}% belegt</div>
        </div>
        <div className="kpi">
          <div className="k">Erfasst</div>
          <div className="v">
            {totalLog.toFixed(1).replace('.', ',')}
            <span className="u">h</span>
          </div>
          <div className="d">{Math.round((totalLog / Math.max(totalPlan, 1)) * 100)}% vom Plan</div>
        </div>
        <div className="kpi">
          <div className="k">Über Kapazität</div>
          <div className="v">{rows.filter((r) => r.planned > r.cap).length}</div>
          <div className="d warn">
            {rows
              .filter((r) => r.planned > r.cap)
              .map((r) => r.name)
              .join(', ') || '—'}
          </div>
        </div>
      </div>

      <div
        style={{
          background: 'var(--cream-50)',
          border: '1px solid var(--ink-100)',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '220px 1fr 120px 80px',
            gap: 16,
            padding: '10px 16px',
            background: 'var(--cream-100)',
            borderBottom: '1px solid var(--ink-100)',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--ink-500)',
            fontWeight: 600,
          }}
        >
          <span>Mitarbeiter</span>
          <span>Auslastung (geplant ggü. Kapazität · erfasst)</span>
          <span style={{ textAlign: 'right' }}>Stunden</span>
          <span style={{ textAlign: 'right' }}>%</span>
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
                    {r.role} · {r.cap}h/Wo
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
                  {r.planned.toFixed(1).replace('.', ',')} / {r.cap}h
                </div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--ink-500)' }}>
                  erfasst {r.logged.toFixed(1).replace('.', ',')}h
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
          <span style={{ width: 12, height: 8, background: 'var(--accent-500)', borderRadius: 2 }} /> Geplant
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 8, background: 'rgba(0,0,0,0.18)', borderRadius: 2 }} /> Bereits erfasst
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 8, background: 'var(--err-500)', borderRadius: 2 }} /> Überlast
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 8, background: 'var(--ok-500)', borderRadius: 2 }} /> Unterlast (&lt; 75%)
        </span>
      </div>
    </div>
  );
}
