import { useEffect, useRef, useState } from 'react';
import type { ColumnId, Priority } from '../../store/types';
import { useStore } from '../../store/store';
import { COLUMNS } from '../../store/seed';
import { ProjectSelect } from '../shared/ProjectSelect';
import { useTick } from '../shared/hooks';
import { Icon } from '../shared/Icon';
import { ProjTag } from '../shared/ProjTag';
import { showToast } from '../shared/Toast';
import { useT, useLocale } from '../../i18n';
import { SessionsSection } from '../sessions/SessionsSection';
import { TaskTimeline } from '../sessions/TaskTimeline';
import { DatePicker } from '../shared/DatePicker';
import { SubtasksSection } from './SubtasksSection';
import { AttachmentsSection } from './AttachmentsSection';
import { checkMarkDone } from '../../lib/taskPermissions';

export interface TaskDetailDrawerProps {
  id: string;
}

export function TaskDetailDrawer({ id }: TaskDetailDrawerProps) {
  const tasks = useStore((s) => s.tasks);
  const projects = useStore((s) => s.projects);
  const users = useStore((s) => s.users);
  const timer = useStore((s) => s.timer);
  const setUI = useStore((s) => s.setUI);
  const updateTask = useStore((s) => s.updateTask);
  const deleteTask = useStore((s) => s.deleteTask);
  const archiveTask = useStore((s) => s.archiveTask);
  const startTimer = useStore((s) => s.startTimer);
  const stopTimer = useStore((s) => s.stopTimer);
  const tr = useT();
  const [locale] = useLocale();
  const fmtNum = (h: number) => h.toFixed(1).replace('.', locale === 'en' ? '.' : ',');

  const isLive = timer?.taskId === id;
  useTick(isLive);

  const t = tasks.find((x) => x.id === id);

  // Permission: nur Projekt-Owner oder Admin darf auf 'done' setzen.
  // Wenn das Projekt keinen Owner hat → niemand wird blockiert.
  const currentUserId = useStore.getState().currentUser;
  const meIsAdmin = users.find((u) => u.id === currentUserId)?.role === 'admin';
  // Berechtigung wird zentral via checkMarkDone() berechnet (F0vR8mfjrwv).
  // `canPickDone` steuert das `disabled` am Option, das Confirm passiert
  // dann erst beim tatsächlichen onChange — sonst kann der Admin Done
  // nicht mehr im Dropdown sehen.
  const markDonePerm = t
    ? checkMarkDone(
        { task: t, projects, currentUserId: currentUserId ?? '', meIsAdmin },
        (ownerId) => users.find((u) => u.id === ownerId)?.name ?? null,
      )
    : { kind: 'allow' as const };
  const canPickDone = markDonePerm.kind !== 'blocked';

  // Lokale Text-Drafts für Title + Description: KEIN Auto-Save während des
  // Tippens (sonst ruckelt's Buchstabe-für-Buchstabe weil jeder PATCH +
  // Sync einen Re-Render auslöst). Erst onBlur und beim Schließen wird
  // zum Server geschrieben.
  const [titleDraft, setTitleDraft] = useState(t?.title ?? '');
  const [descDraft, setDescDraft] = useState(t?.desc ?? '');
  // Inline-Edit für „geplante Zeit". Klick auf das `/ Xh geplant`-Label
  // öffnet einen Number-Input. Enter/Blur speichert, Escape verwirft.
  const [editingEst, setEditingEst] = useState(false);
  const [estDraft, setEstDraft] = useState('');

  // Beim Wechsel der Task (anderer Drawer-Aufruf) Draft initial füllen.
  // Gegen Server-Updates DURING typing schützen wir uns mit einem ref:
  // wenn der lokale Draft != Server-Wert, lassen wir ihn in Ruhe.
  const lastSyncedTitle = useRef(t?.title ?? '');
  const lastSyncedDesc = useRef(t?.desc ?? '');
  useEffect(() => {
    // Anderer Task → Drafts neu setzen
    setTitleDraft(t?.title ?? '');
    setDescDraft(t?.desc ?? '');
    lastSyncedTitle.current = t?.title ?? '';
    lastSyncedDesc.current = t?.desc ?? '';
  }, [id]);

  // Server-State-Updates (z. B. anderer User editiert dieselbe Task) nur
  // dann übernehmen, wenn der lokale Draft noch dem zuletzt gesyncten Wert
  // entspricht — sonst überschreiben wir gerade getipptes nicht.
  useEffect(() => {
    if (t && titleDraft === lastSyncedTitle.current && t.title !== titleDraft) {
      setTitleDraft(t.title);
      lastSyncedTitle.current = t.title;
    }
    if (t && descDraft === lastSyncedDesc.current && (t.desc ?? '') !== descDraft) {
      setDescDraft(t.desc ?? '');
      lastSyncedDesc.current = t.desc ?? '';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t?.title, t?.desc]);

  const flushTitle = () => {
    if (!t) return;
    if (titleDraft !== t.title) {
      updateTask(t.id, { title: titleDraft });
      lastSyncedTitle.current = titleDraft;
    }
  };
  const flushDesc = () => {
    if (!t) return;
    if (descDraft !== (t.desc ?? '')) {
      updateTask(t.id, { desc: descDraft });
      lastSyncedDesc.current = descDraft;
    }
  };

  // Auf Unmount evtl. ausstehende Drafts noch persistieren
  useEffect(() => {
    return () => {
      flushTitle();
      flushDesc();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!t) return null;
  const close = () => setUI({ taskDetailId: null });
  const liveLog = isLive && timer ? t.loggedH + (Date.now() - timer.startedAt) / 3600000 : t.loggedH;
  const pct = Math.min(100, Math.round((liveLog / t.estH) * 100));

  return (
    <>
      <div className="drawer-backdrop" onClick={close} />
      <div className="drawer">
        <div className="drawer-head">
          <ProjTag id={t.proj} />
          <span className="mono" style={{ fontSize: 11, color: 'var(--ink-500)' }}>
            {t.id}
          </span>
          <div style={{ flex: 1 }} />
          {t.col === 'done' && !t.archivedAt && (
            <button
              className="x"
              onClick={() => {
                void archiveTask(t.id);
                showToast(tr('toast.archived'));
                close();
              }}
              title={tr('task_detail.archive')}
            >
              <Icon name="archive" size={14} />
            </button>
          )}
          <button
            className="x"
            onClick={() => {
              deleteTask(t.id);
              showToast(tr('toast.deleted'));
              close();
            }}
            title={tr('common.delete')}
          >
            <Icon name="trash-2" size={14} />
          </button>
          <button className="x" onClick={close}>
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="drawer-body">
          <input
            type="text"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={flushTitle}
            style={{
              width: '100%',
              background: 'transparent',
              border: 0,
              fontFamily: 'var(--font-display)',
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: '-0.01em',
              color: 'var(--ink-900)',
              marginBottom: 14,
              padding: '4px 0',
            }}
          />

          {t.parentTaskId && (() => {
            const parent = tasks.find((x) => x.id === t.parentTaskId);
            if (!parent) return null;
            return (
              <button
                type="button"
                className="parent-task-pill"
                onClick={() => setUI({ taskDetailId: parent.id })}
                title={tr('subtasks.parent_link_title')}
              >
                <Icon name="corner-up-left" size={11} />
                <span className="parent-task-pill-label">{tr('subtasks.parent_label')}</span>
                <span className="parent-task-pill-title">{parent.title}</span>
              </button>
            );
          })()}

          <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
            <select
              value={t.col}
              onChange={(e) => {
                const newCol = e.target.value as ColumnId;
                if (newCol === 'done' && t.col !== 'done') {
                  if (markDonePerm.kind === 'blocked') {
                    showToast(tr('toast.only_owner_can_mark_done'));
                    return;
                  }
                  if (markDonePerm.kind === 'admin_override') {
                    const msg = markDonePerm.ownerName
                      ? tr('toast.admin_confirm_done', { owner: markDonePerm.ownerName })
                      : tr('toast.admin_confirm_done_no_owner');
                    if (!window.confirm(msg)) {
                      // Select-Wert zurückspulen — onChange hat den Wert schon übernommen
                      e.target.value = t.col;
                      return;
                    }
                  }
                }
                updateTask(t.id, { col: newCol });
              }}
              style={{
                background: 'var(--cream-50)',
                border: '1px solid var(--ink-200)',
                borderRadius: 6,
                padding: '6px 10px',
                fontSize: 12,
              }}
            >
              {COLUMNS.map((c) => (
                <option key={c.id} value={c.id} disabled={c.id === 'done' && !canPickDone && t.col !== 'done'}>
                  {tr(`column.${c.id}` as 'column.todo')}
                </option>
              ))}
            </select>
            <select
              value={t.who}
              onChange={(e) => updateTask(t.id, { who: e.target.value })}
              style={{
                background: 'var(--cream-50)',
                border: '1px solid var(--ink-200)',
                borderRadius: 6,
                padding: '6px 10px',
                fontSize: 12,
              }}
            >
              <option value="">{tr('common.none')}</option>
              {users
                .filter((u) => u.status === 'active' || u.status === 'invited')
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                    {u.status === 'invited' ? tr('task_detail.user_invited_suffix') : ''}
                  </option>
                ))}
            </select>
            <ProjectSelect
              value={t.proj}
              currentUserId={currentUserId}
              projects={projects}
              onChange={(v) => updateTask(t.id, { proj: v })}
              style={{
                background: 'var(--cream-50)',
                border: '1px solid var(--ink-200)',
                borderRadius: 6,
                padding: '6px 10px',
                fontSize: 12,
              }}
            />
            <select
              value={t.prio}
              onChange={(e) => updateTask(t.id, { prio: e.target.value as Priority })}
              style={{
                background: 'var(--cream-50)',
                border: '1px solid var(--ink-200)',
                borderRadius: 6,
                padding: '6px 10px',
                fontSize: 12,
              }}
            >
              <option value="low">{tr('task_detail.prio_low')}</option>
              <option value="med">{tr('task_detail.prio_med')}</option>
              <option value="high">{tr('task_detail.prio_high')}</option>
            </select>
            <DatePicker
              mode="date"
              value={
                t.due && t.due !== 'today' && t.due !== 'tomorrow'
                  ? t.due
                  : null
              }
              onChange={(v) => updateTask(t.id, { due: v })}
              placeholder={tr('task_detail.due')}
              mono
            />
          </div>

          <div
            style={{
              background: 'var(--cream-100)',
              border: '1px solid var(--ink-100)',
              borderRadius: 8,
              padding: 14,
              marginBottom: 18,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <div className="eyebrow">{tr('task_detail.hours')}</div>
              {!isLive ? (
                <button
                  className="tb-btn accent"
                  onClick={() => {
                    startTimer(t.id, true);
                    showToast(tr('week.timer_pomo_started'));
                  }}
                >
                  <Icon name="play" size={12} /> {tr('task_detail.timer_start')}
                </button>
              ) : (
                <button
                  className="tb-btn primary"
                  onClick={() => {
                    stopTimer();
                    showToast(tr('toast.timer_stopped'));
                  }}
                >
                  <Icon name="square" size={12} /> {tr('task_detail.timer_stop')}
                </button>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 32,
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {fmtNum(liveLog)}
              </span>
              {editingEst ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'baseline',
                    gap: 4,
                    fontSize: 14,
                    color: 'var(--ink-500)',
                  }}
                >
                  /
                  <input
                    type="number"
                    autoFocus
                    step={0.5}
                    min={0}
                    max={200}
                    value={estDraft}
                    onChange={(e) => setEstDraft(e.target.value)}
                    onBlur={() => {
                      const v = parseFloat(estDraft.replace(',', '.'));
                      if (!Number.isNaN(v) && v >= 0 && v !== t.estH) {
                        updateTask(t.id, { estH: Math.round(v * 100) / 100 });
                      }
                      setEditingEst(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        (e.currentTarget as HTMLInputElement).blur();
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        setEditingEst(false);
                      }
                    }}
                    style={{
                      width: 60,
                      padding: '2px 6px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 13,
                      fontVariantNumeric: 'tabular-nums',
                      border: '1px solid var(--ink-300)',
                      borderRadius: 4,
                      background: 'var(--cream-50)',
                      color: 'var(--ink-900)',
                    }}
                  />
                  {tr('task_detail.estimate_planned_inline_suffix')}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEstDraft(String(t.estH));
                    setEditingEst(true);
                  }}
                  title={tr('task_detail.estimate_edit_tooltip')}
                  style={{
                    fontSize: 14,
                    color: 'var(--ink-500)',
                    background: 'transparent',
                    border: 'none',
                    padding: '2px 4px',
                    margin: 0,
                    cursor: 'pointer',
                    borderRadius: 4,
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'var(--ink-50, rgba(0,0,0,0.05))';
                    (e.currentTarget as HTMLElement).style.color = 'var(--ink-700)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                    (e.currentTarget as HTMLElement).style.color = 'var(--ink-500)';
                  }}
                >
                  {tr('task_detail.estimate_planned_suffix', { h: fmtNum(t.estH) })}
                </button>
              )}
            </div>
            <div className="mini-bar" style={{ marginTop: 10 }}>
              <span style={{ width: pct + '%' }} />
            </div>
          </div>

          <div className="field">
            <label>{tr('task_detail.description')}</label>
            <textarea
              value={descDraft}
              onChange={(e) => setDescDraft(e.target.value)}
              onBlur={flushDesc}
              placeholder={tr('task_detail.description_placeholder')}
              style={{ minHeight: 100, fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.55 }}
            />
          </div>

          <AttachmentsSection taskId={t.id} />

          <div style={{ marginTop: 18, marginBottom: 18 }}>
            <SubtasksSection parent={t} />
          </div>

          <div style={{ marginTop: 4 }}>
            <SessionsSection taskId={t.id} />
          </div>

          <div style={{ marginTop: 18 }}>
            <TaskTimeline taskId={t.id} />
          </div>
        </div>
      </div>
    </>
  );
}
