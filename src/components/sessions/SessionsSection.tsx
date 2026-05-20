// Sessions-Section im TaskDetailDrawer.
//
// Listet alle Sessions einer Task chronologisch und erlaubt:
//   – Stunden-Edit pro Session (Inline-Number-Input)
//   – Datum/Uhrzeit-Edit pro Session
//   – Delete einer Session (nur die eigenen — Backend prüft das)
//   – Neue manuelle Session hinzufügen (Datum + Stunden)
//
// Backend-Endpoints werden direkt via `api.*` gerufen; nach jeder Mutation
// invalidieren wir den TASK_SESSIONS-Cache, damit die Liste + die Σ in der
// Hero-Card des Drawers refreshen. Außerdem TASKS-Cache, weil sich `loggedH`
// auf der Task ändert.
//
// Optimistic Updates wären nice, aber: Server kann `loggedH` GREATEST(0, …)
// clampen — also Server-Round-Trip + invalidate ist robuster.

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../../data/api';
import { SYNC_KEYS } from '../../data/sync';
import { Icon } from '../shared/Icon';
import { showToast } from '../shared/Toast';
import { useT, useLocale } from '../../i18n';
import { fmtHM } from '../../lib/format';
import { DatePicker } from '../shared/DatePicker';

export interface SessionsSectionProps {
  taskId: string;
}

interface RowProps {
  session: api.ServerSession;
  taskId: string;
  locale: 'de' | 'en';
  onChange: () => void;
}

function fmtDateTimeForInput(date: Date): string {
  // datetime-local erwartet 'YYYY-MM-DDTHH:mm' in lokaler Zeit
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    date.getFullYear() +
    '-' +
    pad(date.getMonth() + 1) +
    '-' +
    pad(date.getDate()) +
    'T' +
    pad(date.getHours()) +
    ':' +
    pad(date.getMinutes())
  );
}

function SessionRow({ session, taskId, locale, onChange }: RowProps) {
  void taskId;
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [hoursDraft, setHoursDraft] = useState(String(session.hours));
  const [fromDraft, setFromDraft] = useState(fmtDateTimeForInput(new Date(session.fromAt)));
  const [busy, setBusy] = useState(false);

  const startEdit = () => {
    setHoursDraft(String(session.hours));
    setFromDraft(fmtDateTimeForInput(new Date(session.fromAt)));
    setEditing(true);
  };

  const save = async () => {
    const h = parseFloat(hoursDraft.replace(',', '.'));
    if (Number.isNaN(h) || h < 0) {
      setEditing(false);
      return;
    }
    const newFrom = new Date(fromDraft);
    if (Number.isNaN(newFrom.getTime())) {
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      await api.updateSession(session.id, { hours: h, fromAt: newFrom });
      onChange();
      setEditing(false);
    } catch (e) {
      console.error('updateSession failed', e);
      showToast(t('common.error_generic'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm(t('sessions.delete_confirm'))) return;
    setBusy(true);
    try {
      await api.deleteSession(session.id);
      onChange();
    } catch (e) {
      console.error('deleteSession failed', e);
      showToast(t('common.error_generic'));
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <div className="ses-row is-editing">
        <Icon name="edit-3" size={12} className="ses-row-icon" />
        <DatePicker
          mode="datetime"
          value={fromDraft}
          onChange={(v) => v && setFromDraft(v)}
          required
        />
        <input
          type="number"
          step={0.25}
          min={0}
          max={24}
          value={hoursDraft}
          onChange={(e) => setHoursDraft(e.target.value)}
          className="ses-row-input ses-row-hours"
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') setEditing(false);
          }}
        />
        <span className="ses-row-h-label">h</span>
        <button
          type="button"
          className="ses-row-act ses-row-act-save"
          onClick={save}
          disabled={busy}
          title={t('common.save')}
        >
          <Icon name="check" size={12} />
        </button>
        <button
          type="button"
          className="ses-row-act"
          onClick={() => setEditing(false)}
          disabled={busy}
          title={t('common.cancel')}
        >
          <Icon name="x" size={12} />
        </button>
      </div>
    );
  }

  return (
    <div className="ses-row">
      <Icon
        name={session.source === 'manual' ? 'edit-3' : 'timer'}
        size={12}
        className="ses-row-icon"
      />
      <span className="ses-row-date-label">
        {new Date(session.fromAt).toLocaleString(locale === 'en' ? 'en-US' : 'de-DE', {
          weekday: 'short',
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </span>
      <span className="ses-row-h">{fmtHM(Number(session.hours))}</span>
      <div className="ses-row-actions">
        <button
          type="button"
          className="ses-row-act"
          onClick={startEdit}
          title={t('sessions.edit_title')}
        >
          <Icon name="pencil" size={12} />
        </button>
        <button
          type="button"
          className="ses-row-act ses-row-act-danger"
          onClick={remove}
          disabled={busy}
          title={t('sessions.delete_title')}
        >
          <Icon name="trash-2" size={12} />
        </button>
      </div>
    </div>
  );
}

interface AddRowProps {
  taskId: string;
  onAdded: () => void;
  onCancel: () => void;
}

function AddRow({ taskId, onAdded, onCancel }: AddRowProps) {
  const t = useT();
  const initialFrom = useMemo(() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    return fmtDateTimeForInput(d);
  }, []);
  const [hoursDraft, setHoursDraft] = useState('1');
  const [fromDraft, setFromDraft] = useState(initialFrom);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const h = parseFloat(hoursDraft.replace(',', '.'));
    if (Number.isNaN(h) || h <= 0) return;
    const from = new Date(fromDraft);
    if (Number.isNaN(from.getTime())) return;
    setBusy(true);
    try {
      await api.createSession(taskId, from, h, 'manual');
      onAdded();
    } catch (e) {
      console.error('createSession failed', e);
      showToast(t('common.error_generic'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ses-row is-editing ses-row-add">
      <Icon name="plus" size={12} className="ses-row-icon" />
      <DatePicker
        mode="datetime"
        value={fromDraft}
        onChange={(v) => v && setFromDraft(v)}
        required
      />
      <input
        type="number"
        step={0.25}
        min={0.25}
        max={24}
        value={hoursDraft}
        onChange={(e) => setHoursDraft(e.target.value)}
        className="ses-row-input ses-row-hours"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') onCancel();
        }}
      />
      <span className="ses-row-h-label">h</span>
      <button
        type="button"
        className="ses-row-act ses-row-act-save"
        onClick={save}
        disabled={busy}
        title={t('common.save')}
      >
        <Icon name="check" size={12} />
      </button>
      <button
        type="button"
        className="ses-row-act"
        onClick={onCancel}
        disabled={busy}
        title={t('common.cancel')}
      >
        <Icon name="x" size={12} />
      </button>
    </div>
  );
}

export function SessionsSection({ taskId }: SessionsSectionProps) {
  const t = useT();
  const [locale] = useLocale();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);

  const sessionsQ = useQuery({
    queryKey: [...SYNC_KEYS.TASK_SESSIONS, taskId],
    queryFn: () => api.listTaskSessions(taskId),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    enabled: !!taskId,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: [...SYNC_KEYS.TASK_SESSIONS, taskId] });
    queryClient.invalidateQueries({ queryKey: SYNC_KEYS.TASKS });
  };

  const sessions = sessionsQ.data ?? [];

  return (
    <div className="ses-section">
      <div className="ses-head">
        <div className="eyebrow">
          {t('task_detail.sessions', { count: sessions.length })}
        </div>
        <button
          type="button"
          className="ses-add-btn"
          onClick={() => setAdding((v) => !v)}
          title={t('sessions.add_title')}
        >
          <Icon name="plus" size={11} />
          <span>{t('sessions.add_short')}</span>
        </button>
      </div>

      {adding && (
        <AddRow
          taskId={taskId}
          onAdded={() => {
            setAdding(false);
            refresh();
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      {sessions.length === 0 && !adding && (
        <div className="ses-empty">
          {sessionsQ.isLoading ? t('common.loading') : t('task_detail.sessions_empty')}
        </div>
      )}

      {sessions.map((s) => (
        <SessionRow
          key={s.id}
          session={s}
          taskId={taskId}
          locale={locale}
          onChange={refresh}
        />
      ))}
    </div>
  );
}
