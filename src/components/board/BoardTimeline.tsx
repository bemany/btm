import type { CSSProperties } from 'react';
import type { Task } from '../../store/types';
import { useStore } from '../../store/store';
import { Avatar } from '../shared/Avatar';
import { DEMO_DAYS } from '../../lib/format';

export interface BoardTimelineProps {
  tasks: Task[];
}

export function BoardTimeline({ tasks }: BoardTimelineProps) {
  const projects = useStore((s) => s.projects);
  const users = useStore((s) => s.users);
  const setUI = useStore((s) => s.setUI);

  const days = DEMO_DAYS;
  const byPerson: Record<string, Task[]> = {};
  tasks.forEach((t) => {
    if (!byPerson[t.who]) byPerson[t.who] = [];
    byPerson[t.who].push(t);
  });

  return (
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
          gridTemplateColumns: '160px repeat(5, 1fr)',
          borderBottom: '1px solid var(--ink-100)',
          background: 'var(--cream-100)',
        }}
      >
        <div
          style={{
            padding: '10px 14px',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--ink-500)',
            fontWeight: 600,
          }}
        >
          Person
        </div>
        {days.map((d) => (
          <div
            key={d}
            style={{
              padding: '10px 14px',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--ink-700)',
              fontWeight: 600,
              textAlign: 'center',
              borderLeft: '1px solid var(--ink-100)',
            }}
          >
            {d}
          </div>
        ))}
      </div>
      {Object.keys(byPerson).map((personId) => {
        const person = users.find((u) => u.id === personId);
        const list = byPerson[personId];
        return (
          <div
            key={personId}
            style={{
              display: 'grid',
              gridTemplateColumns: '160px repeat(5, 1fr)',
              borderTop: '1px solid var(--ink-100)',
              minHeight: 80,
              alignItems: 'stretch',
            }}
          >
            <div
              style={{
                padding: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'var(--cream-100)',
              }}
            >
              <Avatar id={personId} size={24} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{person?.name}</div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--ink-500)' }}>
                  {person?.cap}h/Wo
                </div>
              </div>
            </div>
            {days.map((d, di) => {
              const dayTasks = list.filter((_, i) => i % 5 === di);
              return (
                <div
                  key={d}
                  style={{
                    padding: 6,
                    borderLeft: '1px solid var(--ink-100)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  {dayTasks.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => setUI({ taskDetailId: t.id })}
                      style={{
                        background: 'var(--cream-100)',
                        borderLeft: '3px solid var(--proj-color)',
                        ['--proj-color' as keyof CSSProperties]: projects.find((p) => p.id === t.proj)?.color,
                        padding: '5px 7px',
                        borderRadius: 3,
                        fontSize: 11,
                        lineHeight: 1.3,
                        cursor: 'pointer',
                      } as CSSProperties}
                    >
                      <div style={{ fontWeight: 500, color: 'var(--ink-900)' }}>
                        {t.title.slice(0, 30)}
                        {t.title.length > 30 ? '…' : ''}
                      </div>
                      <div className="mono" style={{ fontSize: 9, color: 'var(--ink-500)' }}>
                        {t.estH.toFixed(1).replace('.', ',')}h
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
