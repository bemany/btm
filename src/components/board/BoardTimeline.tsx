import type { CSSProperties } from 'react';
import type { Task } from '../../store/types';
import { useStore } from '../../store/store';
import { Avatar } from '../shared/Avatar';
import { DEMO_TODAY } from '../../lib/format';
import { useT, useLocale } from '../../i18n';

export interface BoardTimelineProps {
  tasks: Task[];
}

// Wochenstart (Montag) — alle Day-Indizes relativ dazu.
const WEEK_START = new Date(DEMO_TODAY);
WEEK_START.setHours(0, 0, 0, 0);

// Liefert den Tag-Index 0-4 (Mo-Fr) für eine Task, oder -1 wenn keine
// Frist gesetzt / Frist außerhalb der Woche / ungültiges Format.
function dueDayIndex(due: string | null | undefined): number {
  if (!due) return -1;
  if (due === 'today') return 0; // DEMO_TODAY = Mo 04.05
  if (due === 'tomorrow') return 1;
  // ISO-Datum 'YYYY-MM-DD'
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(due);
  if (!m) return -1;
  const target = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const days = Math.round((target.getTime() - WEEK_START.getTime()) / 86400000);
  if (days < 0 || days > 4) return -1;
  return days;
}

export function BoardTimeline({ tasks }: BoardTimelineProps) {
  const projects = useStore((s) => s.projects);
  const users = useStore((s) => s.users);
  const setUI = useStore((s) => s.setUI);
  const t = useT();
  const [locale] = useLocale();
  const fmtNum = (h: number) => h.toFixed(1).replace('.', locale === 'en' ? '.' : ',');

  const days = [
    t('board.timeline_day_mo'),
    t('board.timeline_day_di'),
    t('board.timeline_day_mi'),
    t('board.timeline_day_do'),
    t('board.timeline_day_fr'),
  ];
  const byPerson: Record<string, Task[]> = {};
  tasks.forEach((tk) => {
    if (!byPerson[tk.who]) byPerson[tk.who] = [];
    byPerson[tk.who].push(tk);
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
          gridTemplateColumns: '160px repeat(5, 1fr) 1.2fr',
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
          {t('board.timeline_person')}
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
        <div
          style={{
            padding: '10px 14px',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--ink-500)',
            fontWeight: 600,
            textAlign: 'center',
            borderLeft: '1px solid var(--ink-100)',
            background: 'var(--cream-200, var(--cream-100))',
          }}
        >
          {t('board.timeline_no_due')}
        </div>
      </div>
      {Object.keys(byPerson).map((personId) => {
        const person = users.find((u) => u.id === personId);
        const list = byPerson[personId];
        return (
          <div
            key={personId}
            style={{
              display: 'grid',
              gridTemplateColumns: '160px repeat(5, 1fr) 1.2fr',
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
                  {t('board.timeline_cap_per_week', { cap: person?.cap ?? 0 })}
                </div>
              </div>
            </div>
            {(() => {
              // Tasks per due-Field auf Tag-Index oder „Ohne Frist" (-1) bucketen
              const buckets: Task[][] = [[], [], [], [], [], []]; // Mo, Di, Mi, Do, Fr, OhneFrist
              for (const tk of list) {
                const di = dueDayIndex(tk.due);
                buckets[di < 0 ? 5 : di].push(tk);
              }
              const renderTask = (tk: Task) => (
                <div
                  key={tk.id}
                  onClick={() => setUI({ taskDetailId: tk.id })}
                  style={{
                    background: 'var(--cream-100)',
                    borderLeft: '3px solid var(--proj-color)',
                    ['--proj-color' as keyof CSSProperties]: projects.find((p) => p.id === tk.proj)?.color,
                    padding: '5px 7px',
                    borderRadius: 3,
                    fontSize: 11,
                    lineHeight: 1.3,
                    cursor: 'pointer',
                  } as CSSProperties}
                >
                  <div style={{ fontWeight: 500, color: 'var(--ink-900)' }}>
                    {tk.title.slice(0, 30)}
                    {tk.title.length > 30 ? '…' : ''}
                  </div>
                  <div className="mono" style={{ fontSize: 9, color: 'var(--ink-500)' }}>
                    {fmtNum(tk.estH)}h
                  </div>
                </div>
              );
              return (
                <>
                  {days.map((d, di) => (
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
                      {buckets[di].map(renderTask)}
                    </div>
                  ))}
                  <div
                    style={{
                      padding: 6,
                      borderLeft: '1px solid var(--ink-100)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      background: buckets[5].length > 0 ? 'rgba(0,0,0,0.015)' : 'transparent',
                    }}
                  >
                    {buckets[5].map(renderTask)}
                  </div>
                </>
              );
            })()}
          </div>
        );
      })}
    </div>
  );
}
