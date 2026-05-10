// Subtasks-Liste im TaskDetailDrawer.
//
// Zeigt alle Aufgaben mit `parentTaskId === currentTaskId` als kompakte
// Zeilen mit Status-Chip + Titel + Avatar. Klick öffnet die jeweilige
// Subtask im Drawer (state-basiert, ersetzt nur die ID). Mit Inline-Add
// kann man eine neue Subtask anlegen — Projekt + Bearbeiter werden vom
// Parent geerbt.

import { useState } from 'react';
import { useStore } from '../../store/store';
import { Icon } from '../shared/Icon';
import { Avatar } from '../shared/Avatar';
import { useT } from '../../i18n';
import type { Task } from '../../store/types';

export interface SubtasksSectionProps {
  parent: Task;
}

export function SubtasksSection({ parent }: SubtasksSectionProps) {
  const t = useT();
  const tasks = useStore((s) => s.tasks);
  const setUI = useStore((s) => s.setUI);
  const addTask = useStore((s) => s.addTask);
  const subtasks = tasks.filter((tk) => tk.parentTaskId === parent.id);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const title = draft.trim();
    if (!title || busy) return;
    setBusy(true);
    try {
      await addTask({
        title,
        col: 'todo',
        proj: parent.proj,
        who: parent.who,
        parentTaskId: parent.id,
        estH: 1,
      });
      setDraft('');
      setAdding(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sub-section">
      <div className="sub-head">
        <div className="eyebrow">
          {t('subtasks.heading', { count: subtasks.length })}
        </div>
        <button
          type="button"
          className="sub-add-btn"
          onClick={() => setAdding((v) => !v)}
          title={t('subtasks.add_title')}
        >
          <Icon name="plus" size={11} />
          <span>{t('subtasks.add_short')}</span>
        </button>
      </div>

      {adding && (
        <div className="sub-add-row">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('subtasks.add_placeholder')}
            autoFocus
            disabled={busy}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
              if (e.key === 'Escape') {
                setAdding(false);
                setDraft('');
              }
            }}
          />
          <button
            type="button"
            className="sub-add-save"
            onClick={submit}
            disabled={busy || !draft.trim()}
          >
            <Icon name="check" size={12} />
          </button>
          <button
            type="button"
            className="sub-add-cancel"
            onClick={() => {
              setAdding(false);
              setDraft('');
            }}
            disabled={busy}
          >
            <Icon name="x" size={12} />
          </button>
        </div>
      )}

      {subtasks.length === 0 && !adding && (
        <div className="sub-empty">{t('subtasks.empty')}</div>
      )}

      {subtasks.map((s) => (
        <button
          key={s.id}
          type="button"
          className="sub-row"
          onClick={() => setUI({ taskDetailId: s.id })}
        >
          <span className={`pill ${s.col}`} style={{ fontSize: 9, padding: '2px 6px' }}>
            {t(`column.${s.col}` as 'column.todo')}
          </span>
          <span className="sub-row-title">{s.title}</span>
          {s.who && <Avatar id={s.who} size={18} />}
        </button>
      ))}
    </div>
  );
}
