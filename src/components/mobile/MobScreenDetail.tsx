// Screen 3 · Aufgaben-Detail — Bottom-Sheet-Inhalt (wird in MobBottomSheet gewrappt).
// Drei-Zonen-Layout: head (fix), scroll (flex), foot (fix). Kein eigener
// Backdrop/Mock-Streifen mehr — die MobBottomSheet-Komponente uebernimmt das.

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStore } from '../../store/store';
import { Icon } from '../shared/Icon';
import { Avatar } from '../shared/Avatar';
import { ProjTag } from '../shared/ProjTag';
import { showToast } from '../shared/Toast';
import { useT, useLocale } from '../../i18n';
import * as api from '../../data/api';

interface Props {
  taskId: string;
  onClose: () => void;
}

export function MobScreenDetail({ taskId, onClose }: Props) {
  const t = useT();
  const [locale] = useLocale();
  const tasks = useStore((s) => s.tasks);
  const users = useStore((s) => s.users);
  const projects = useStore((s) => s.projects);
  const startTimer = useStore((s) => s.startTimer);

  const task = tasks.find((tk) => tk.id === taskId);
  const assignee = task ? users.find((u) => u.id === task.who) : null;
  const proj = task?.proj ? projects.find((p) => p.id === task.proj) : null;

  const subtasks = useMemo(
    () => (task ? tasks.filter((tk) => tk.parentTaskId === task.id) : []),
    [tasks, task],
  );

  const checklistQ = useQuery({
    queryKey: ['btm', 'checklist', taskId],
    queryFn: () => api.listTaskChecklist(taskId),
    staleTime: 15_000,
    enabled: !!task,
  });
  const checklist = checklistQ.data ?? [];

  if (!task) {
    return (
      <>
        <div className="mob-sheet-scroll" style={{ textAlign: 'center', padding: 40 }}>
          <p>{t('mobile.detail_not_found')}</p>
        </div>
        <div className="mob-sheet-foot">
          <button onClick={onClose} className="mob-sheet-primary" style={{ flex: 1 }}>
            {t('common.close')}
          </button>
        </div>
      </>
    );
  }

  const dueLabel = (() => {
    if (!task.due) return '—';
    if (task.due === 'today') return t('common.today');
    if (task.due === 'tomorrow') return t('common.tomorrow');
    const d = new Date(task.due);
    return d.toLocaleDateString(locale === 'en' ? 'en-US' : 'de-DE', {
      weekday: 'short', day: '2-digit', month: '2-digit',
    });
  })();

  return (
    <>
      <header className="mob-sheet-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {task.proj && <ProjTag id={task.proj} />}
          <span className="mono" style={{ fontSize: 10, color: 'var(--ink-500)' }}>
            #{task.id.slice(0, 8)}
          </span>
          <div style={{ flex: 1 }} />
          <Icon name="more-horizontal" size={16} style={{ color: 'var(--ink-500)' }} />
        </div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 19, lineHeight: 1.25, letterSpacing: '-0.01em', marginTop: 10, marginBottom: 0 }}>
          {task.title}
        </h2>
      </header>

      <div className="mob-sheet-scroll">
        {task.desc && (
          <div style={{ fontSize: 14, color: 'var(--ink-700)', lineHeight: 1.45, whiteSpace: 'pre-wrap', marginBottom: 14 }}>
            {task.desc}
          </div>
        )}

        <div className="mob-detail-meta">
          <div>
            <div className="mob-meta-lbl">{t('mobile.detail_estimate')}</div>
            <div className="mob-meta-val">
              {(task.estH || 0).toFixed(1).replace('.', locale === 'en' ? '.' : ',')}h
            </div>
          </div>
          <div>
            <div className="mob-meta-lbl">{t('mobile.detail_due')}</div>
            <div className="mob-meta-val">{dueLabel}</div>
          </div>
          <div>
            <div className="mob-meta-lbl">{t('mobile.detail_who')}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              {assignee && <Avatar id={assignee.id} size={18} />}
              <span style={{ fontSize: 13, fontWeight: 500 }}>
                {assignee ? assignee.name.split(' ')[0] : '—'}
              </span>
            </div>
          </div>
          <div>
            <div className="mob-meta-lbl">{t('mobile.detail_logged')}</div>
            <div className="mob-meta-val">
              {(task.loggedH || 0).toFixed(1).replace('.', locale === 'en' ? '.' : ',')}h
            </div>
          </div>
        </div>

        {checklist.length > 0 && (
          <div className="mob-detail-section">
            <div className="mob-section-h">
              {t('checklist.heading')} · {checklist.filter((c) => c.done).length}/{checklist.length}
            </div>
            {checklist.map((c) => (
              <div key={c.id} className="mob-sub-row">
                <span className={`mob-check ${c.done ? 'on' : ''}`}>
                  {c.done && <Icon name="check" size={11} />}
                </span>
                <span style={{ fontSize: 14, color: c.done ? 'var(--ink-400)' : 'var(--ink-800)', textDecoration: c.done ? 'line-through' : 'none' }}>
                  {c.text}
                </span>
              </div>
            ))}
          </div>
        )}

        {subtasks.length > 0 && (
          <div className="mob-detail-section">
            <div className="mob-section-h">
              {t('mobile.detail_subtasks')} · {subtasks.filter((st) => st.col === 'done').length}/{subtasks.length}
            </div>
            {subtasks.map((st) => (
              <div key={st.id} className="mob-sub-row">
                <span className={`mob-check ${st.col === 'done' ? 'on' : ''}`}>
                  {st.col === 'done' && <Icon name="check" size={11} />}
                </span>
                <span style={{ fontSize: 14, color: st.col === 'done' ? 'var(--ink-400)' : 'var(--ink-800)', textDecoration: st.col === 'done' ? 'line-through' : 'none' }}>
                  {st.title}
                </span>
              </div>
            ))}
          </div>
        )}

        {proj?.name && (
          <div className="mob-detail-section">
            <div className="mob-section-h">{t('mobile.detail_project')}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: proj.color }} />
              <span style={{ fontWeight: 500 }}>{proj.name}</span>
            </div>
          </div>
        )}
      </div>

      <footer className="mob-sheet-foot">
        <button type="button" className="mob-sheet-secondary" onClick={onClose}>
          <Icon name="x" size={13} /> {t('common.close')}
        </button>
        <button
          type="button"
          className="mob-sheet-primary"
          onClick={() => {
            startTimer(task.id, true);
            showToast(t('mobile.timer_started_toast'));
            onClose();
          }}
        >
          <Icon name="play" size={13} /> {t('mobile.detail_start_timer')}
        </button>
      </footer>
    </>
  );
}
