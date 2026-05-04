import { useEffect, useState } from 'react';
import type { Task } from '../../store/types';
import { useStore } from '../../store/store';
import { showToast } from '../shared/Toast';

export interface TimeCellProps {
  task: Task;
  dayIdx: number;
  value: number;
}

export function TimeCell({ task, dayIdx, value }: TimeCellProps) {
  const updateTask = useStore((s) => s.updateTask);
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value > 0 ? value.toFixed(1).replace('.', ',') : '');
  useEffect(() => setVal(value > 0 ? value.toFixed(1).replace('.', ',') : ''), [value]);

  const commit = () => {
    const num = parseFloat((val || '0').replace(',', '.')) || 0;
    if (num !== value) {
      const newSessions = (task.sessions || []).filter((sess) => {
        const di = new Date(sess.from).getDay() - 1;
        return di !== dayIdx;
      });
      if (num > 0) {
        const date = new Date('2026-05-04T09:00:00');
        date.setDate(date.getDate() + dayIdx);
        newSessions.push({
          from: date.getTime(),
          to: date.getTime() + num * 3600000,
          h: num,
          source: 'manual',
        });
      }
      const newLogged = newSessions.reduce((a, b) => a + b.h, 0);
      updateTask(task.id, { sessions: newSessions, loggedH: +newLogged.toFixed(2) });
      showToast('Stunden gespeichert');
    }
    setEditing(false);
  };

  return (
    <div
      className={`tg-cell ${editing ? 'editing' : ''} ${value === 0 ? 'empty' : ''}`}
      onClick={() => setEditing(true)}
    >
      {editing ? (
        <input
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              setVal(value > 0 ? value.toFixed(1).replace('.', ',') : '');
              setEditing(false);
            }
          }}
        />
      ) : value > 0 ? (
        value.toFixed(1).replace('.', ',')
      ) : (
        '—'
      )}
    </div>
  );
}
