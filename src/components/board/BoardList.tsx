import type { Task } from '../../store/types';
import { useStore } from '../../store/store';
import { COLUMNS } from '../../store/seed';
import { Icon } from '../shared/Icon';
import { Avatar } from '../shared/Avatar';
import { ProjTag } from '../shared/ProjTag';
import { showToast } from '../shared/Toast';

export interface BoardListProps {
  tasks: Task[];
}

export function BoardList({ tasks }: BoardListProps) {
  const setUI = useStore((s) => s.setUI);
  const startTimer = useStore((s) => s.startTimer);

  const grouped = COLUMNS.map((c) => ({ col: c, items: tasks.filter((t) => t.col === c.id) }));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {grouped.map((g) => (
        <div
          key={g.col.id}
          style={{
            background: 'var(--cream-50)',
            border: '1px solid var(--ink-100)',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '10px 14px',
              background: 'var(--cream-100)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              borderBottom: '1px solid var(--ink-100)',
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: g.col.dot }} />
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13 }}>{g.col.label}</span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--ink-500)' }}>
              {g.items.length}
            </span>
          </div>
          {g.items.length === 0 && (
            <div style={{ padding: 14, fontSize: 12, color: 'var(--ink-400)', fontStyle: 'italic' }}>
              Keine Aufgaben
            </div>
          )}
          {g.items.map((t) => (
            <div
              key={t.id}
              onClick={() => setUI({ taskDetailId: t.id })}
              style={{
                display: 'grid',
                gridTemplateColumns: '160px 1fr 100px 80px 80px 32px',
                alignItems: 'center',
                gap: 12,
                padding: '10px 14px',
                borderTop: '1px solid var(--ink-100)',
                cursor: 'pointer',
              }}
            >
              <ProjTag id={t.proj} />
              <div style={{ fontSize: 13 }}>{t.title}</div>
              <Avatar id={t.who} size={20} />
              <span className="mono" style={{ fontSize: 11, color: 'var(--ink-500)' }}>
                {t.estH.toFixed(1).replace('.', ',')}h gepl.
              </span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--ink-700)' }}>
                {t.loggedH.toFixed(1).replace('.', ',')}h erf.
              </span>
              <button
                className="timer-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  startTimer(t.id, true);
                  showToast('Timer gestartet');
                }}
              >
                <Icon name="play" size={10} />
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
