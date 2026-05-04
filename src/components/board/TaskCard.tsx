import type { DragEvent, MouseEvent } from 'react';
import type { Task } from '../../store/types';
import { useStore } from '../../store/store';
import { useTick } from '../shared/hooks';
import { Icon } from '../shared/Icon';
import { Avatar } from '../shared/Avatar';
import { ProjTag } from '../shared/ProjTag';
import { PrioDot } from '../shared/PrioDot';
import { showToast } from '../shared/Toast';

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

  const isLive = timer?.taskId === task.id;
  useTick(isLive);

  const liveLogged = isLive && timer
    ? task.loggedH + (Date.now() - timer.startedAt) / 1000 / 3600
    : task.loggedH;
  const over = liveLogged > task.estH * 1.05;

  return (
    <div
      className={`task-card ${dragging ? 'dragging' : ''} ${isLive ? 'live' : ''}`}
      draggable
      onDragStart={(e) => onDragStart(e, task)}
      onDragEnd={onDragEnd}
      onClick={onClick}
    >
      <div className="meta-row">
        <ProjTag id={task.proj} />
        <PrioDot p={task.prio} />
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
            Live
          </span>
        )}
      </div>
      <div className="title">{task.title}</div>
      <div className="right-row">
        <span className={`hours ${over ? 'over' : ''}`}>
          <Icon name="timer" size={11} />
          {liveLogged.toFixed(1).replace('.', ',')} / {task.estH.toFixed(1).replace('.', ',')}h
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {!isLive ? (
            <button
              className="timer-btn"
              onClick={(e: MouseEvent) => {
                e.stopPropagation();
                startTimer(task.id, true);
                showToast('Timer gestartet · Pomodoro Fokus');
              }}
              title="Timer starten (mit Pomodoro)"
            >
              <Icon name="play" size={9} /> Start
            </button>
          ) : (
            <button
              className="timer-btn live"
              onClick={(e: MouseEvent) => {
                e.stopPropagation();
                stopTimer();
                showToast('Timer gestoppt');
              }}
              title="Stoppen"
            >
              <Icon name="square" size={9} /> Stop
            </button>
          )}
          <Avatar id={task.who} size={20} />
        </div>
      </div>
    </div>
  );
}
