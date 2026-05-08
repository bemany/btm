import type { Task } from '../../store/types';
import { useStore } from '../../store/store';
import { COLUMNS } from '../../store/seed';
import { Icon } from '../shared/Icon';
import { Avatar } from '../shared/Avatar';
import { ProjTag } from '../shared/ProjTag';
import { showToast } from '../shared/Toast';
import { useT, useLocale } from '../../i18n';

export interface BoardListProps {
  tasks: Task[];
}

export function BoardList({ tasks }: BoardListProps) {
  const setUI = useStore((s) => s.setUI);
  const startTimer = useStore((s) => s.startTimer);
  const t = useT();
  const [locale] = useLocale();
  const fmtNum = (h: number) => h.toFixed(1).replace('.', locale === 'en' ? '.' : ',');

  const grouped = COLUMNS.map((c) => ({ col: c, items: tasks.filter((tk) => tk.col === c.id) }));
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
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13 }}>
              {t(`column.${g.col.id}` as 'column.todo')}
            </span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--ink-500)' }}>
              {g.items.length}
            </span>
          </div>
          {g.items.length === 0 && (
            <div style={{ padding: 14, fontSize: 12, color: 'var(--ink-400)', fontStyle: 'italic' }}>
              {t('board.list_no_tasks')}
            </div>
          )}
          {g.items.map((tk) => (
            <div
              key={tk.id}
              onClick={() => setUI({ taskDetailId: tk.id })}
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
              <ProjTag id={tk.proj} />
              <div style={{ fontSize: 13 }}>{tk.title}</div>
              <Avatar id={tk.who} size={20} />
              <span className="mono" style={{ fontSize: 11, color: 'var(--ink-500)' }}>
                {t('board.list_planned_short', { h: fmtNum(tk.estH) })}
              </span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--ink-700)' }}>
                {t('board.list_logged_short', { h: fmtNum(tk.loggedH) })}
              </span>
              <button
                className="timer-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  startTimer(tk.id, true);
                  showToast(t('toast.timer_started'));
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
