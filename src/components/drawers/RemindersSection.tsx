// Reminder-Sektion im TaskDetailDrawer.
// Zeigt bestehende Reminder + Inline-Formular zum Anlegen eines neuen.
// Reminder = Datum + Uhrzeit → In-App-Notification + E-Mail.

import { useEffect, useState } from 'react';
import { Icon } from '../shared/Icon';
import { useT } from '../../i18n';

interface Reminder {
  id: string;
  remindAt: string; // ISO
  notifiedAt: string | null;
}

export function RemindersSection({ taskId }: { taskId: string }) {
  const t = useT();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/tasks/${taskId}/reminders`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setReminders(d.reminders ?? []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [taskId]);

  const add = async () => {
    if (!date || busy) return;
    const remindAt = new Date(`${date}T${time}:00`).toISOString();
    setBusy(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/reminders`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remindAt }),
      });
      if (res.ok) {
        const d = await res.json();
        setReminders((prev) => [...prev, d.reminder]);
        setAdding(false);
        setDate('');
        setTime('09:00');
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    await fetch(`/api/reminders/${id}`, { method: 'DELETE', credentials: 'include' });
    setReminders((prev) => prev.filter((r) => r.id !== id));
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('de-DE', {
      weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  return (
    <div className="sub-section">
      <div className="sub-head">
        <div className="eyebrow">{t('reminders.heading', { count: reminders.length })}</div>
        <button type="button" className="sub-add-btn" onClick={() => setAdding((v) => !v)}>
          <Icon name="plus" size={11} />
          <span>{t('reminders.add_short')}</span>
        </button>
      </div>

      {adding && (
        <div className="sub-add-row" style={{ flexWrap: 'wrap', gap: 6 }}>
          <input
            type="date"
            value={date}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setDate(e.target.value)}
            style={{ flex: '1 1 120px' }}
          />
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            style={{ flex: '1 1 80px' }}
          />
          <button type="button" className="sub-add-save" onClick={add} disabled={busy || !date}>
            <Icon name="check" size={12} />
          </button>
          <button type="button" className="sub-add-cancel" onClick={() => { setAdding(false); setDate(''); }} disabled={busy}>
            <Icon name="x" size={12} />
          </button>
        </div>
      )}

      {reminders.length === 0 && !adding && (
        <div className="sub-empty">{t('reminders.empty')}</div>
      )}

      {reminders.map((r) => (
        <div key={r.id} className="sub-row" style={{ justifyContent: 'space-between', cursor: 'default' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <Icon name="bell" size={12} style={{ color: r.notifiedAt ? 'var(--ink-400)' : 'var(--accent-500)' }} />
            <span style={{ color: r.notifiedAt ? 'var(--ink-400)' : 'var(--ink-800)' }}>
              {fmt(r.remindAt)}
            </span>
            {r.notifiedAt && (
              <span style={{ fontSize: 10, color: 'var(--ink-400)' }}>{t('reminders.sent')}</span>
            )}
          </span>
          {!r.notifiedAt && (
            <button
              type="button"
              onClick={() => remove(r.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-400)', padding: 2 }}
              title={t('reminders.delete')}
            >
              <Icon name="x" size={11} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
