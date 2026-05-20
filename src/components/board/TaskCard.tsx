import type { DragEvent, MouseEvent } from 'react';
import type { Task } from '../../store/types';
import { useStore } from '../../store/store';
import { useTick } from '../shared/hooks';
import { Icon } from '../shared/Icon';
import { Avatar } from '../shared/Avatar';
import { ProjTag } from '../shared/ProjTag';
import { PrioDot } from '../shared/PrioDot';
import { showToast } from '../shared/Toast';
import { useT, useLocale } from '../../i18n';
import { fmtHM } from '../../lib/format';

export interface TaskCardProps {
  task: Task;
  dragging: boolean;
  onDragStart: (e: DragEvent<HTMLDivElement>, task: Task) => void;
  onDragEnd: () => void;
  onClick: () => void;
}

export function TaskCard({ task, dragging, onDragStart, onDragEnd, onClick }: TaskCardProps) {
  const timer = useStore((s) => s.timer);
  const startTimer = useStore((s) => s.startTimer);
  const stopTimer = useStore((s) => s.stopTimer);
  const t = useT();
  const [locale] = useLocale();

  const isLive = timer?.taskId === task.id;
  useTick(isLive);

  const liveLogged = isLive && timer
    ? task.loggedH + (Date.now() - timer.startedAt) / 1000 / 3600
    : task.loggedH;
  const over = liveLogged > task.estH * 1.05;

  // Due-Status berechnen — für visuelles Highlighting + Sortierung im Kanban
  // (Bug F2QWZBJbq4v). 'overdue' = Frist < heute, 'today' = heute, 'soon' = in
  // den nächsten 3 Tagen, 'later' = später, 'none' = keine Frist gesetzt.
  // 'done' Tasks bekommen immer 'none' damit erledigte nicht als 'überfällig'
  // hervorgehoben werden.
  const dueStatus: 'overdue' | 'today' | 'soon' | 'later' | 'none' = (() => {
    if (task.col === 'done') return 'none';
    if (!task.due) return 'none';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let target: Date | null = null;
    if (task.due === 'today') target = today;
    else if (task.due === 'tomorrow') {
      target = new Date(today);
      target.setDate(target.getDate() + 1);
    } else {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(task.due as string);
      if (m) target = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    }
    if (!target) return 'none';
    const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
    if (diffDays < 0) return 'overdue';
    if (diffDays === 0) return 'today';
    if (diffDays <= 3) return 'soon';
    return 'later';
  })();
  const dueLabel: string | null = (() => {
    if (dueStatus === 'none' || !task.due) return null;
    if (task.due === 'today' || dueStatus === 'today') return t('board.card_due_today');
    if (task.due === 'tomorrow') return t('board.card_due_tomorrow');
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(task.due as string);
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return d.toLocaleDateString(locale === 'en' ? 'en-US' : 'de-DE', { day: '2-digit', month: 'short' });
  })();

  return (
    <div
      className={`task-card ${dragging ? 'dragging' : ''} ${isLive ? 'live' : ''} due-${dueStatus}`}
      draggable
      onDragStart={(e) => onDragStart(e, task)}
      onDragEnd={onDragEnd}
      onClick={onClick}
    >
      <div className="meta-row">
        <ProjTag id={task.proj} />
        <PrioDot p={task.prio} />
        {dueLabel && (
          <span className={`due-pill due-pill-${dueStatus}`} title={dueLabel}>
            <Icon name={dueStatus === 'overdue' ? 'alert-triangle' : 'calendar'} size={9} />
            {dueStatus === 'overdue' ? t('board.card_overdue') : dueLabel}
          </span>
        )}
        {task.parentTaskId && (
          <span
            className="subtask-pill"
            title={t('subtasks.is_subtask_indicator')}
          >
            <Icon name="corner-up-left" size={9} />
            {t('subtasks.subtask_label')}
          </span>
        )}
        {isLive && (
          <span className="pill doing">
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: 'var(--accent-500)',
                display: 'inline-block',
                animation: 'pulse 1.4s var(--ease-out) infinite',
              }}
            />{' '}
            {t('board.card_live_pill')}
          </span>
        )}
      </div>
      <div className="title">{task.title}</div>
      <div className="right-row">
        <span className={`hours ${over ? 'over' : ''}`}>
          <Icon name="timer" size={11} />
          {fmtHM(liveLogged)} / {fmtHM(task.estH)}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {!isLive ? (
            <button
              className="timer-btn"
              onClick={(e: MouseEvent) => {
                e.stopPropagation();
                startTimer(task.id, true);
                showToast(t('board.timer_started_pomo_toast'));
              }}
              title={t('board.card_timer_start_title')}
            >
              <Icon name="play" size={9} /> {t('board.card_start')}
            </button>
          ) : (
            <button
              className="timer-btn live"
              onClick={(e: MouseEvent) => {
                e.stopPropagation();
                stopTimer();
                showToast(t('toast.timer_stopped'));
              }}
              title={t('board.card_timer_stop_title')}
            >
              <Icon name="square" size={9} /> {t('board.card_stop')}
            </button>
          )}
          <Avatar id={task.who} size={20} />
        </div>
      </div>
    </div>
  );
}
