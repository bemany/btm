import type { ColumnId, Priority } from '../../store/types';
import { useStore } from '../../store/store';
import { COLUMNS } from '../../store/seed';
import { useTick } from '../shared/hooks';
import { Icon } from '../shared/Icon';
import { ProjTag } from '../shared/ProjTag';
import { showToast } from '../shared/Toast';

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

  const isLive = timer?.taskId === id;
  useTick(isLive);

  const t = tasks.find((x) => x.id === id);
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
              showToast('Gelöscht');
              close();
            }}
            title="Löschen"
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
            value={t.title}
            onChange={(e) => updateTask(t.id, { title: e.target.value })}
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
                  {c.label}
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
              <option value="">— niemand —</option>
              {users.filter((u) => u.status === 'active').map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
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
              <option value="low">Prio: niedrig</option>
              <option value="med">Prio: mittel</option>
              <option value="high">Prio: hoch</option>
            </select>
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
              <div className="eyebrow">Stunden</div>
              {!isLive ? (
                <button
                  className="tb-btn accent"
                  onClick={() => {
                    startTimer(t.id, true);
                    showToast('Timer + Pomodoro gestartet');
                  }}
                >
                  <Icon name="play" size={12} /> Timer starten
                </button>
              ) : (
                <button
                  className="tb-btn primary"
                  onClick={() => {
                    stopTimer();
                    showToast('Timer gestoppt');
                  }}
                >
                  <Icon name="square" size={12} /> Stoppen
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
                {liveLog.toFixed(1).replace('.', ',')}
              </span>
              <span style={{ fontSize: 14, color: 'var(--ink-500)' }}>
                / {t.estH.toFixed(1).replace('.', ',')}h geplant
              </span>
            </div>
            <div className="mini-bar" style={{ marginTop: 10 }}>
              <span style={{ width: pct + '%' }} />
            </div>
          </div>

          <div className="field">
            <label>Beschreibung</label>
            <textarea
              value={t.desc || ''}
              onChange={(e) => updateTask(t.id, { desc: e.target.value })}
              placeholder="Notizen, Akzeptanzkriterien, Links…"
              style={{ minHeight: 100, fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.55 }}
            />
          </div>

          <div className="eyebrow" style={{ marginTop: 18, marginBottom: 8 }}>
            Sessions ({(t.sessions || []).length})
          </div>
          {(!t.sessions || t.sessions.length === 0) && (
            <div style={{ fontSize: 12, color: 'var(--ink-500)', fontStyle: 'italic' }}>
              Noch keine Zeit erfasst.
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
                {new Date(sess.from).toLocaleString('de-DE', {
                  weekday: 'short',
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              <div style={{ flex: 1 }} />
              <span className="mono" style={{ fontWeight: 600 }}>
                {sess.h.toFixed(2).replace('.', ',')}h
              </span>
            </div>
          ))}

          <div className="eyebrow" style={{ marginTop: 18, marginBottom: 8 }}>
            Anhänge
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
            Dateien hier ablegen (Demo)
          </div>
        </div>
      </div>
    </>
  );
}
