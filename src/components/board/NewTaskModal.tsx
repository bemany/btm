// FuO6j_tbUS5: Modal statt Inline-Tile beim Anlegen einer neuen Aufgabe.
// Wird vom Board "+"-Button geoeffnet. Pflicht: Titel. Optional: Beschreibung,
// Projekt, Aufwand, Prio, Faellig, Assignee. "Anlegen" speichert + schliesst,
// "Anlegen & oeffnen" speichert + zeigt das Detail-Drawer.

import { useEffect, useRef, useState } from 'react';
import type { ColumnId, Priority } from '../../store/types';
import { useStore } from '../../store/store';
import { useAuth } from '../../auth/AuthContext';
import { Icon } from '../shared/Icon';
import { ProjectSelect } from '../shared/ProjectSelect';
import { HoursMinutesInput } from '../shared/HoursMinutesInput';
import { filterAssignableProjects } from '../../lib/projectFilters';
import { showToast } from '../shared/Toast';
import { useT } from '../../i18n';

export interface NewTaskModalProps {
  col: ColumnId;
  onClose: () => void;
  // FXjEEm5q-_l: vorbelegen, wenn der "+"-Button aus einer Timeline-Zelle
  // kommt (Tag/Person sind dann schon klar).
  initialDue?: string | null;
  initialAssignee?: string;
}

export function NewTaskModal({ col, onClose, initialDue, initialAssignee }: NewTaskModalProps) {
  const t = useT();
  const projects = useStore((s) => s.projects);
  const users = useStore((s) => s.users);
  const currentUser = useStore((s) => s.currentUser);
  const addTask = useStore((s) => s.addTask);
  const setUI = useStore((s) => s.setUI);
  const filterProj = useStore((s) => s.filter.proj);
  const { user: me } = useAuth();

  const initialProj = (() => {
    if (filterProj && filterProj !== 'all' && projects.some((p) => p.id === filterProj)) {
      return filterProj;
    }
    const { all } = filterAssignableProjects(projects, {
      currentUserId: currentUser,
      showOnlyFavorites: true,
    });
    return all[0]?.id ?? '';
  })();

  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [proj, setProj] = useState(initialProj);
  const [estH, setEstH] = useState(1.0);
  const [prio, setPrio] = useState<Priority>('med');
  const [due, setDue] = useState<string>(initialDue ?? '');
  const [assignee, setAssignee] = useState<string>(initialAssignee || currentUser);
  const [busy, setBusy] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => titleRef.current?.focus(), 30);
  }, []);

  // Esc-Key schliesst
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const canSubmit = title.trim().length > 0 && !busy;

  const submit = async (openAfter: boolean) => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      const created = await addTask({
        title: title.trim(),
        desc: desc.trim() || undefined,
        col,
        prio,
        estH: estH || 1,
        due: due ? due : null,
        proj: proj || null,
        who: assignee || currentUser,
      });
      if (created) {
        showToast(t('toast.task_created'));
        if (openAfter) setUI({ taskDetailId: created.id });
        onClose();
      } else {
        showToast(t('common.error_generic'));
      }
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit(false);
    }
  };

  const activeUsers = users.filter((u) => u.status === 'active');

  return (
    <div
      className="ntm-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
    >
      <div className="ntm-shell" onKeyDown={onKeyDown}>
        <div className="ntm-head">
          <div>
            <div className="ntm-eyebrow">{t('column.' + col as 'column.todo')}</div>
            <h2 className="ntm-title">{t('board.new_task_title')}</h2>
          </div>
          <button className="ntm-close" onClick={onClose} aria-label={t('common.close')}>
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="ntm-body">
          <label className="ntm-field">
            <span className="ntm-label">
              {t('board.new_task_title_label')}
              <span className="ntm-req">{t('mobile.create_required')}</span>
            </span>
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('board.new_task_title_placeholder')}
              maxLength={200}
              className="ntm-input"
            />
          </label>

          <label className="ntm-field">
            <span className="ntm-label">
              {t('board.new_task_desc_label')}
              <span className="ntm-opt">{t('mobile.create_optional')}</span>
            </span>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder={t('board.new_task_desc_placeholder')}
              rows={4}
              className="ntm-input ntm-textarea"
            />
          </label>

          <div className="ntm-row">
            <label className="ntm-field" style={{ flex: 1 }}>
              <span className="ntm-label">{t('board.new_task_project')}</span>
              <ProjectSelect
                value={proj || null}
                projects={projects}
                currentUserId={currentUser}
                onChange={(v) => setProj(v ?? '')}
              />
            </label>
            <label className="ntm-field" style={{ flex: 1 }}>
              <span className="ntm-label">{t('board.new_task_assignee')}</span>
              <select
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                className="ntm-input ntm-select"
              >
                <option value={currentUser}>
                  {me?.name ?? users.find((u) => u.id === currentUser)?.name ?? t('common.none')} ({t('board.new_task_me')})
                </option>
                {activeUsers.filter((u) => u.id !== currentUser).map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="ntm-row">
            <label className="ntm-field" style={{ flex: 1 }}>
              <span className="ntm-label">{t('board.new_task_estimate')}</span>
              <HoursMinutesInput value={estH} onChange={setEstH} max={24} />
            </label>
            <label className="ntm-field" style={{ flex: 1 }}>
              <span className="ntm-label">{t('board.new_task_priority')}</span>
              <div className="ntm-prio-row">
                {(['low', 'med', 'high'] as const).map((p) => (
                  <button
                    type="button"
                    key={p}
                    className={`ntm-prio ${p} ${prio === p ? 'is-on' : ''}`}
                    onClick={() => setPrio(p)}
                  >
                    {t(`prio.${p}` as 'prio.low')}
                  </button>
                ))}
              </div>
            </label>
            <label className="ntm-field" style={{ flex: 1 }}>
              <span className="ntm-label">{t('board.new_task_due')}</span>
              <input
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
                className="ntm-input"
              />
            </label>
          </div>
        </div>

        <div className="ntm-foot">
          <button className="ntm-btn" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </button>
          <div style={{ flex: 1 }} />
          <button
            className="ntm-btn"
            onClick={() => submit(true)}
            disabled={!canSubmit}
          >
            <Icon name="arrow-right" size={12} /> {t('board.new_task_save_open')}
          </button>
          <button
            className="ntm-btn is-primary"
            onClick={() => submit(false)}
            disabled={!canSubmit}
          >
            <Icon name="check" size={12} /> {t('board.new_task_save')}
          </button>
        </div>
      </div>
    </div>
  );
}
