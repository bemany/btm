import { useStore } from '../../store/store';
import { PERSONAS } from '../../store/seed';
import type { ScreenId } from '../../store/types';
import { useTick } from '../shared/hooks';
import { Icon } from '../shared/Icon';
import { ProjTag } from '../shared/ProjTag';
import { showToast } from '../shared/Toast';
import { fmtHMS, fmtMS } from '../../lib/format';
import { computePomo } from '../../lib/pomodoro';

export interface MyWeekScreenProps {
  setActive: (id: ScreenId) => void;
}

export function MyWeekScreen({ setActive }: MyWeekScreenProps) {
  const tasks = useStore((s) => s.tasks);
  const currentUser = useStore((s) => s.currentUser);
  const timer = useStore((s) => s.timer);
  const setUI = useStore((s) => s.setUI);
  const startTimer = useStore((s) => s.startTimer);
  const stopTimer = useStore((s) => s.stopTimer);
  const togglePomodoro = useStore((s) => s.togglePomodoro);

  useTick(!!timer);
  const me = PERSONAS.find((p) => p.id === currentUser) ?? PERSONAS[0];
  const myTasks = tasks.filter((t) => t.who === currentUser);
  const today = myTasks.filter((t) => t.col === 'doing').slice(0, 5);
  const inReview = myTasks.filter((t) => t.col === 'review');
  const doneThisWeek = myTasks.filter((t) => t.col === 'done');

  const plannedH = myTasks.filter((t) => t.col !== 'done').reduce((a, b) => a + b.estH, 0);
  const loggedH = myTasks.reduce((a, b) => a + b.loggedH, 0);
  const liveTask = timer ? tasks.find((t) => t.id === timer.taskId) : null;
  const pomo = timer ? computePomo(timer.pomodoro, Date.now()) : null;
  const elapsed = timer ? Date.now() - timer.startedAt : 0;

  return (
    <div className="page">
      <div className="page-head">
        <div className="left">
          <div className="eyebrow">01 · Meine Woche</div>
          <h1>Hallo {me.name}.</h1>
          <div className="subtitle">KW 19 · 04.–08. Mai 2026 · {me.cap}h Kapazität diese Woche</div>
        </div>
        <div className="right">
          <button className="tb-btn" onClick={() => setActive('board')}>
            <Icon name="kanban-square" size={14} />
            Wochenboard öffnen
          </button>
        </div>
      </div>

      {timer && liveTask && (
        <div className="timer-hero">
          {pomo ? (
            <div className="pomo-ring-lg">
              <svg viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="28" fill="none" stroke="var(--ink-700)" strokeWidth="3" opacity="0.5" />
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke={pomo.mode === 'focus' ? 'var(--accent-500)' : 'var(--ok-500)'}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="175.93"
                  strokeDashoffset={175.93 * (1 - pomo.elapsedInBlock / pomo.total)}
                />
              </svg>
              <div className="lbl">
                <div>{pomo.mode === 'focus' ? 'FOKUS' : pomo.mode === 'short' ? 'PAUSE' : 'L. PAUSE'}</div>
                <div className="big">{fmtMS(pomo.remaining)}</div>
              </div>
            </div>
          ) : (
            <div
              style={{
                width: 64,
                height: 64,
                display: 'grid',
                placeItems: 'center',
                background: 'rgba(255,255,255,0.06)',
                borderRadius: 8,
              }}
            >
              <Icon name="timer" size={28} style={{ color: 'var(--accent-500)' }} />
            </div>
          )}
          <div className="info">
            <div className="ey eyebrow">
              Live · läuft seit{' '}
              {new Date(timer.startedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="t">{liveTask.title}</div>
            <div className="m">
              <ProjTag id={liveTask.proj} /> · geplant {liveTask.estH.toFixed(1).replace('.', ',')}h · erfasst inkl. Live{' '}
              {(liveTask.loggedH + elapsed / 3600000).toFixed(1).replace('.', ',')}h
              {pomo && (
                <>
                  {' '}
                  · Pomodoro Block {pomo.blocksDone + 1}/4
                </>
              )}
            </div>
            {pomo && (
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="pomo-dots">
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className={`d ${
                        i < pomo.blocksDone ? 'done' : i === pomo.blocksDone && pomo.mode === 'focus' ? 'now' : ''
                      }`}
                    />
                  ))}
                </span>
                <span className="mono" style={{ fontSize: 10, color: 'var(--cream-100)' }}>
                  4× 25 min Fokus · 5/15 min Pause
                </span>
              </div>
            )}
          </div>
          <div className="clock">{fmtHMS(elapsed)}</div>
          <div className="actions">
            <button className="btn" onClick={togglePomodoro}>
              <Icon name="sparkles" size={12} />
              {timer.pomodoro ? 'Pomodoro aus' : 'Pomodoro an'}
            </button>
            <button
              className="btn danger"
              onClick={() => {
                stopTimer();
                showToast('Timer gestoppt');
              }}
            >
              <Icon name="square" size={12} /> Stoppen
            </button>
          </div>
        </div>
      )}

      <div className="kpi-grid">
        <div className="kpi">
          <div className="k">Geplant</div>
          <div className="v">
            {plannedH.toFixed(1).replace('.', ',')}
            <span className="u">h</span>
          </div>
          <div className="d">
            {Math.round((plannedH / me.cap) * 100)}% von {me.cap}h
          </div>
        </div>
        <div className="kpi">
          <div className="k">Erfasst</div>
          <div className="v">
            {loggedH.toFixed(1).replace('.', ',')}
            <span className="u">h</span>
          </div>
          <div className="d">{plannedH ? Math.round((loggedH / plannedH) * 100) : 0}% vom Plan</div>
        </div>
        <div className="kpi">
          <div className="k">Offene Aufgaben</div>
          <div className="v">{myTasks.filter((t) => t.col !== 'done').length}</div>
          <div className="d">{myTasks.filter((t) => t.col === 'doing').length} in Arbeit</div>
        </div>
        <div className="kpi">
          <div className="k">Erledigt KW 19</div>
          <div className="v">{doneThisWeek.length}</div>
          <div className="d ok">+ {Math.round(doneThisWeek.reduce((a, b) => a + b.loggedH, 0))}h gebucht</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            In Arbeit · jetzt
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {today.length === 0 && (
              <div className="empty-state">
                <Icon name="check-circle-2" size={36} className="icon" />
                <h4>Nichts in Arbeit</h4>
                <p>Zieh eine Aufgabe vom Backlog ins „In Arbeit", oder starte den Timer auf einer Card.</p>
              </div>
            )}
            {today.map((t) => (
              <div
                key={t.id}
                onClick={() => setUI({ taskDetailId: t.id })}
                style={{
                  background: 'var(--cream-50)',
                  border: '1px solid var(--ink-100)',
                  borderRadius: 8,
                  padding: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  cursor: 'pointer',
                }}
              >
                <span className="pill doing">In Arbeit</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{t.title}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 3 }}>
                    <ProjTag id={t.proj} />
                    <span className="mono" style={{ fontSize: 11, color: 'var(--ink-500)' }}>
                      geplant {t.estH.toFixed(1).replace('.', ',')}h · erfasst {t.loggedH.toFixed(1).replace('.', ',')}h
                    </span>
                  </div>
                </div>
                {timer?.taskId === t.id ? (
                  <button
                    className="timer-btn live"
                    onClick={(e) => {
                      e.stopPropagation();
                      stopTimer();
                    }}
                  >
                    <Icon name="square" size={11} /> Stoppen
                  </button>
                ) : (
                  <button
                    className="timer-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      startTimer(t.id, true);
                      showToast('Timer + Pomodoro gestartet');
                    }}
                  >
                    <Icon name="play" size={11} /> Start
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            Wartet auf mich · Review
          </div>
          {inReview.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--ink-500)', fontStyle: 'italic' }}>Nichts in Review.</div>
          )}
          {inReview.map((t) => (
            <div
              key={t.id}
              onClick={() => setUI({ taskDetailId: t.id })}
              style={{
                background: 'var(--cream-50)',
                border: '1px solid var(--ink-100)',
                borderRadius: 6,
                padding: 10,
                marginBottom: 8,
                cursor: 'pointer',
              }}
            >
              <ProjTag id={t.proj} />
              <div style={{ fontSize: 13, marginTop: 6 }}>{t.title}</div>
            </div>
          ))}

          <div className="eyebrow" style={{ margin: '20px 0 10px' }}>
            Schnellaktion
          </div>
          <button
            className="tb-btn accent"
            style={{ width: '100%', justifyContent: 'center', padding: 12 }}
            onClick={() => setUI({ drawer: 'ai' })}
          >
            <Icon name="sparkles" size={14} />
            Aufgaben planen
          </button>
        </div>
      </div>
    </div>
  );
}
