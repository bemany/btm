import { useEffect, useRef, useState } from 'react';
import type { ColumnId, Priority } from '../../store/types';
import { useStore } from '../../store/store';
import { COLUMNS } from '../../store/seed';
import { useTick } from '../shared/hooks';
import { Icon } from '../shared/Icon';
import { ProjTag } from '../shared/ProjTag';
import { showToast } from '../shared/Toast';
import { useT, useLocale } from '../../i18n';
import { CommentsSection } from '../comments/CommentsSection';

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
  const startTimer = useStore((s) => s.startTimer);
  const stopTimer = useStore((s) => s.stopTimer);
  const tr = useT();
  const [locale] = useLocale();
  const fmtNum = (h: number) => h.toFixed(1).replace('.', locale === 'en' ? '.' : ',');

  const isLive = timer?.taskId === id;
  useTick(isLive);

  const t = tasks.find((x) => x.id === id);

  // Lokale Text-Drafts für Title + Description: KEIN Auto-Save während des
  // Tippens (sonst ruckelt's Buchstabe-für-Buchstabe weil jeder PATCH +
  // Sync einen Re-Render auslöst). Erst onBlur und beim Schließen wird
  // zum Server geschrieben.
  const [titleDraft, setTitleDraft] = useState(t?.title ?? '');
  const [descDraft, setDescDraft] = useState(t?.desc ?? '');

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

          <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
            <select
              value={t.col}
              onChange={(e) => updateTask(t.id, { col: e.target.value as ColumnId })}
              style={{
                background: 'var(--cream-50)',
                border: '1px solid var(--ink-200)',
                borderRadius: 6,
                padding: '6px 10px',
                fontSize: 12,
              }}
            >
              {COLUMNS.map((c) => (
                <option key={c.id} value={c.id}>
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
            <select
              value={t.proj ?? ''}
              onChange={(e) => updateTask(t.id, { proj: e.target.value || null })}
              style={{
                background: 'var(--cream-50)',
                border: '1px solid var(--ink-200)',
                borderRadius: 6,
                padding: '6px 10px',
                fontSize: 12,
              }}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code}
                </option>
              ))}
            </select>
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
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'var(--cream-50)',
                border: '1px solid var(--ink-200)',
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: 12,
              }}
            >
              <Icon name="calendar" size={12} style={{ color: 'var(--ink-500)' }} />
              <span className="mono" style={{ fontSize: 10, color: 'var(--ink-500)' }}>
                {tr('task_detail.due')}
              </span>
              <input
                type="date"
                value={
                  t.due && t.due !== 'today' && t.due !== 'tomorrow'
                    ? t.due
                    : ''
                }
                onChange={(e) => updateTask(t.id, { due: e.target.value || null })}
                style={{
                  border: 0,
                  background: 'transparent',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  color: 'var(--ink-700)',
                  padding: 0,
                  cursor: 'pointer',
                }}
              />
              {t.due && (
                <button
                  onClick={() => updateTask(t.id, { due: null })}
                  style={{
                    border: 0,
                    background: 'transparent',
                    color: 'var(--ink-400)',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'inline-flex',
                  }}
                  title={tr('task_detail.due_clear_title')}
                >
                  <Icon name="x" size={11} />
                </button>
              )}
            </label>
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
              <span style={{ fontSize: 14, color: 'var(--ink-500)' }}>
                {tr('task_detail.estimate_planned_suffix', { h: fmtNum(t.estH) })}
              </span>
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

          <div className="eyebrow" style={{ marginTop: 18, marginBottom: 8 }}>
            {tr('task_detail.sessions', { count: (t.sessions || []).length })}
          </div>
          {(!t.sessions || t.sessions.length === 0) && (
            <div style={{ fontSize: 12, color: 'var(--ink-500)', fontStyle: 'italic' }}>
              {tr('task_detail.sessions_empty')}
            </div>
          )}
          {(t.sessions || []).map((sess, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: 10,
                padding: '8px 10px',
                borderTop: '1px solid var(--ink-100)',
                alignItems: 'center',
                fontSize: 12,
              }}
            >
              <Icon
                name={sess.source === 'manual' ? 'edit-3' : 'timer'}
                size={12}
                style={{ color: 'var(--ink-500)' }}
              />
              <span className="mono" style={{ color: 'var(--ink-700)' }}>
                {new Date(sess.from).toLocaleString(locale === 'en' ? 'en-US' : 'de-DE', {
                  weekday: 'short',
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              <div style={{ flex: 1 }} />
              <span className="mono" style={{ fontWeight: 600 }}>
                {sess.h.toFixed(2).replace('.', locale === 'en' ? '.' : ',')}h
              </span>
            </div>
          ))}

          <CommentsSection subjectType="task" subjectId={t.id} />

          <div className="eyebrow" style={{ marginTop: 18, marginBottom: 8 }}>
            {tr('task_detail.attachments')}
          </div>
          <div
            style={{
              border: '1px dashed var(--ink-200)',
              borderRadius: 6,
              padding: 16,
              textAlign: 'center',
              fontSize: 12,
              color: 'var(--ink-500)',
            }}
          >
            <Icon name="paperclip" size={16} style={{ color: 'var(--ink-400)', marginRight: 6 }} />
            {tr('task_detail.attachments_dropzone')}
          </div>
        </div>
      </div>
    </>
  );
}
