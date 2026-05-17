// Screen 6 · Wochenboard (Swipe-Kanban)
// Spalten-Tabs oben, Touch-Swipe für Wechsel, Task-Karten mit Fortschritt.

import { useState, useRef, useMemo } from 'react';
import { useStore } from '../../store/store';
import { useAuth } from '../../auth/AuthContext';
import { Icon } from '../shared/Icon';
import { Avatar } from '../shared/Avatar';
import { ProjTag } from '../shared/ProjTag';
import { useT, useLocale } from '../../i18n';
import { MobStatusBar, HomeBar } from './MobileChrome';
import type { ColumnId } from '../../store/types';

interface Props {
  onOpenTask: (taskId: string) => void;
}

const COLUMNS: Array<{ id: ColumnId; labelKey: string; dot: string }> = [
  { id: 'todo', labelKey: 'column.todo', dot: 'rgba(28,26,23,0.35)' },
  { id: 'planned', labelKey: 'column.planned', dot: 'rgba(120,140,180,0.6)' },
  { id: 'doing', labelKey: 'column.doing', dot: 'var(--accent-500)' },
  { id: 'review', labelKey: 'column.review', dot: 'rgba(94,127,78,0.7)' },
  { id: 'done', labelKey: 'column.done', dot: 'rgba(94,127,78,0.4)' },
];

function PrioDot({ p }: { p: 'high' | 'med' | 'low' }) {
  const color = p === 'high' ? 'var(--err-500, #C0432C)' : p === 'low' ? 'rgba(28,26,23,0.25)' : 'rgba(94,127,78,0.7)';
  return <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} aria-label={p} />;
}

export function MobScreenBoard({ onOpenTask }: Props) {
  const t = useT();
  const [locale] = useLocale();
  const tasks = useStore((s) => s.tasks);
  const currentUser = useStore((s) => s.currentUser);
  const users = useStore((s) => s.users);
  const { user: me } = useAuth();

  const meUser = users.find((u) => u.id === currentUser);
  const [activeCol, setActiveCol] = useState<ColumnId>('doing');

  const myTasks = useMemo(() => tasks.filter((tk) => tk.who === currentUser), [tasks, currentUser]);
  const colTasks = useMemo(
    () => myTasks.filter((tk) => tk.col === activeCol).sort((a, b) => (a.estH || 0) - (b.estH || 0)),
    [myTasks, activeCol],
  );

  // Counts pro Spalte für Tab-Badges
  const counts = useMemo(() => {
    const out: Record<ColumnId, number> = { todo: 0, planned: 0, doing: 0, review: 0, done: 0 };
    for (const tk of myTasks) out[tk.col] = (out[tk.col] ?? 0) + 1;
    return out;
  }, [myTasks]);

  // Touch-Swipe: links/rechts wechselt die Spalte
  const startX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { startX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (startX.current == null) return;
    const dx = e.changedTouches[0].clientX - startX.current;
    startX.current = null;
    if (Math.abs(dx) < 50) return;
    const idx = COLUMNS.findIndex((c) => c.id === activeCol);
    if (dx < 0 && idx < COLUMNS.length - 1) setActiveCol(COLUMNS[idx + 1].id);
    if (dx > 0 && idx > 0) setActiveCol(COLUMNS[idx - 1].id);
  };

  const fmtNum = (h: number) => h.toFixed(1).replace('.', locale === 'en' ? '.' : ',');

  return (
    <div className="mob-screen">
      <MobStatusBar />

      <div className="mob-board-head">
        {meUser && <Avatar id={meUser.id} size={26} />}
        <div style={{ flex: 1 }}>
          <div className="mono" style={{ fontSize: 9, color: 'var(--ink-500)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {t('mobile.board_eyebrow')}
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>
            {me?.name?.split(' ')[0] ?? meUser?.name?.split(' ')[0] ?? ''}
          </div>
        </div>
        <Icon name="sliders-horizontal" size={14} style={{ color: 'var(--ink-500)' }} />
      </div>

      <div className="mob-col-tabs">
        {COLUMNS.map((c) => (
          <div
            key={c.id}
            className={`mob-col-tab ${c.id === activeCol ? 'is-active' : ''}`}
            onClick={() => setActiveCol(c.id)}
          >
            <span className="mob-col-dot" style={{ background: c.dot }} />
            <span>{t(c.labelKey as 'column.todo')}</span>
            <span className="mono" style={{ fontSize: 9, opacity: 0.7 }}>{counts[c.id]}</span>
          </div>
        ))}
      </div>

      <div className="mob-swipe-hint">
        <Icon name="chevron-left" size={10} style={{ color: 'var(--ink-300)' }} />
        <span className="mono" style={{ fontSize: 8.5, color: 'var(--ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {t('mobile.board_swipe_hint')}
        </span>
        <Icon name="chevron-right" size={10} style={{ color: 'var(--ink-300)' }} />
      </div>

      <div
        className="mob-scroll"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {colTasks.length === 0 && (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--ink-500)', fontSize: 12 }}>
            {t('mobile.board_empty')}
          </div>
        )}
        {colTasks.map((tk) => (
          <div
            key={tk.id}
            className="mob-board-card"
            onClick={() => onOpenTask(tk.id)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {tk.proj && <ProjTag id={tk.proj} />}
              <div style={{ flex: 1 }} />
              <PrioDot p={tk.prio || 'med'} />
              <span className="mono" style={{ fontSize: 9, color: 'var(--ink-500)' }}>{fmtNum(tk.estH || 0)}h</span>
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 500, marginTop: 6, lineHeight: 1.3, color: 'var(--ink-900)' }}>
              {tk.title}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <div style={{ flex: 1, height: 3, background: 'var(--cream-200)', borderRadius: 2, overflow: 'hidden' }}>
                <span
                  style={{
                    display: 'block',
                    height: '100%',
                    background: 'var(--accent-500)',
                    width: `${Math.min(100, ((tk.loggedH || 0) / Math.max(0.1, tk.estH || 1)) * 100)}%`,
                  }}
                />
              </div>
              <span className="mono" style={{ fontSize: 9, color: 'var(--ink-500)' }}>
                {fmtNum(tk.loggedH || 0)}/{fmtNum(tk.estH || 0)}h
              </span>
            </div>
          </div>
        ))}
      </div>

      <HomeBar />
    </div>
  );
}
