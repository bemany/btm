import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Task } from '../../store/types';
import { showToast } from '../shared/Toast';
import { setTaskHoursForDay } from '../../data/api';
import { SYNC_KEYS } from '../../data/sync';
import { DEMO_TODAY } from '../../lib/format';

export interface TimeCellProps {
  task: Task;
  dayIdx: number;
  value: number;
}

function dayIso(dayIdx: number): string {
  const d = new Date(DEMO_TODAY);
  d.setUTCDate(d.getUTCDate() + dayIdx);
  return d.toISOString().slice(0, 10);
}

export function TimeCell({ task, dayIdx, value }: TimeCellProps) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value > 0 ? value.toFixed(1).replace('.', ',') : '');
  const [saving, setSaving] = useState(false);
  useEffect(() => setVal(value > 0 ? value.toFixed(1).replace('.', ',') : ''), [value]);

  const commit = async () => {
    const num = parseFloat((val || '0').replace(',', '.')) || 0;
    if (num === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await setTaskHoursForDay(task.id, dayIso(dayIdx), num);
      await queryClient.invalidateQueries({ queryKey: SYNC_KEYS.TASKS });
      showToast(num === 0 ? 'Stunden gelöscht' : 'Stunden gespeichert');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Speichern fehlgeschlagen');
      setVal(value > 0 ? value.toFixed(1).replace('.', ',') : '');
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  return (
    <div
      className={`tg-cell ${editing ? 'editing' : ''} ${value === 0 ? 'empty' : ''}`}
      onClick={() => !saving && setEditing(true)}
    >
      {editing ? (
        <input
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void commit();
            if (e.key === 'Escape') {
              setVal(value > 0 ? value.toFixed(1).replace('.', ',') : '');
              setEditing(false);
            }
          }}
          disabled={saving}
        />
      ) : value > 0 ? (
        value.toFixed(1).replace('.', ',')
      ) : (
        '—'
      )}
    </div>
  );
}
