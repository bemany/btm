// FCXVQOSTCFp: Checklisten-Sektion im TaskDetailDrawer.
// Items mit Checkbox + Text + Lösch-Button, Add-Input am unteren Ende.
// Optimistic updates auf Toggle, invalidate nach Mutation.

import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import * as api from '../../data/api';
import type { TaskChecklistItemDTO } from '../../data/api';
import { Icon } from '../shared/Icon';
import { showToast } from '../shared/Toast';
import { useT } from '../../i18n';

const KEY = (taskId: string) => ['btm', 'checklist', taskId] as const;

export function ChecklistSection({ taskId }: { taskId: string }) {
  const t = useT();
  const qc = useQueryClient();
  const [draft, setDraft] = useState('');

  const { data: items = [] } = useQuery({
    queryKey: KEY(taskId),
    queryFn: () => api.listTaskChecklist(taskId),
    staleTime: 15_000,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: KEY(taskId) });

  const createMut = useMutation({
    mutationFn: (text: string) => api.createChecklistItem(taskId, text),
    onSuccess: () => { setDraft(''); refresh(); },
    onError: () => showToast(t('common.error_generic')),
  });

  const toggleMut = useMutation({
    mutationFn: (item: TaskChecklistItemDTO) =>
      api.updateChecklistItem(taskId, item.id, { done: !item.done }),
    onMutate: async (item) => {
      await qc.cancelQueries({ queryKey: KEY(taskId) });
      const prev = qc.getQueryData<TaskChecklistItemDTO[]>(KEY(taskId));
      if (prev) {
        qc.setQueryData<TaskChecklistItemDTO[]>(KEY(taskId),
          prev.map((it) => (it.id === item.id ? { ...it, done: !item.done } : it)));
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(KEY(taskId), ctx.prev); },
    onSettled: refresh,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteChecklistItem(taskId, id),
    onSuccess: refresh,
    onError: () => showToast(t('common.error_generic')),
  });

  const submitNew = () => {
    const txt = draft.trim();
    if (!txt) return;
    createMut.mutate(txt);
  };

  const doneCount = items.filter((it) => it.done).length;
  const total = items.length;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  return (
    <div className="checklist-section">
      <div className="checklist-head">
        <Icon name="check-square" size={13} />
        <span className="checklist-title">{t('checklist.heading')}</span>
        {total > 0 && (
          <>
            <span className="checklist-count">{doneCount}/{total}</span>
            <div className="checklist-bar">
              <div className="checklist-bar-fill" style={{ width: `${pct}%` }} />
            </div>
          </>
        )}
      </div>

      {items.length > 0 && (
        <ul className="checklist-list">
          {items.map((it) => (
            <li key={it.id} className={`checklist-item ${it.done ? 'is-done' : ''}`}>
              <button
                type="button"
                className={`checklist-check ${it.done ? 'is-checked' : ''}`}
                onClick={() => toggleMut.mutate(it)}
                aria-label={it.done ? t('checklist.uncheck') : t('checklist.check')}
              >
                {it.done && <Icon name="check" size={11} />}
              </button>
              <span className="checklist-text">{it.text}</span>
              <button
                type="button"
                className="checklist-delete"
                onClick={() => deleteMut.mutate(it.id)}
                aria-label={t('common.delete')}
                title={t('common.delete')}
              >
                <Icon name="x" size={11} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="checklist-add">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); submitNew(); }
          }}
          placeholder={t('checklist.add_placeholder')}
          maxLength={500}
        />
        <button
          type="button"
          onClick={submitNew}
          disabled={!draft.trim() || createMut.isPending}
        >
          <Icon name="plus" size={11} /> {t('common.add')}
        </button>
      </div>
    </div>
  );
}
