import { useStore } from '../../store/store';
import { PERSONAS } from '../../store/seed';
import { useTick } from '../shared/hooks';
import { Icon } from '../shared/Icon';
import { ProjTag } from '../shared/ProjTag';
import { showToast } from '../shared/Toast';
import { fmtHMS, fmtMS } from '../../lib/format';
import { computePomo } from '../../lib/pomodoro';

export function MobileScreen() {
  const tasks = useStore((s) => s.tasks);
  const currentUser = useStore((s) => s.currentUser);
  const timer = useStore((s) => s.timer);
  const startTimer = useStore((s) => s.startTimer);
  const stopTimer = useStore((s) => s.stopTimer);
  const togglePomodoro = useStore((s) => s.togglePomodoro);

  useTick(!!timer);
  // Persona derived for future avatar use
  PERSONAS.find((p) => p.id === currentUser);
  const myTasks = tasks.filter((t) => t.who === currentUser);
  const today = myTasks.filter((t) => t.col === 'doing' || t.col === 'todo').slice(0, 4);
  const pomo = timer ? computePomo(timer.pomodoro, Date.now()) : null;
  const liveTask = timer ? tasks.find((t) => t.id === timer.taskId) : null;
  const elapsed = timer ? Date.now() - timer.startedAt : 0;

  return (
    <div className="page">
      <div className="page-head">
        <div className="left">
          <div className="eyebrow">Mobile · PWA Phase 2</div>
          <h1>Mobile-Set: 3 Screens reichen</h1>
          <div className="subtitle">
            Heute · Pomodoro-Timer · KI-Eintrag (Foto vom Whiteboard) — synchron mit Desktop-Daten
          </div>
        </div>
      </div>

      <div className="mob-row">
        {/* HEUTE */}
        <div>
          <div className="mob-frame">
            <div style={{ padding: '14px 14px 8px', borderBottom: '1px solid var(--ink-100)' }}>
              <div
                className="mono"
                style={{
                  fontSize: 9,
                  color: 'var(--ink-500)',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                Mo · 04. Mai
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, marginTop: 2 }}>
                Heute
              </div>
            </div>
            <div
              className="scrollable"
              style={{ flex: 1, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}
            >
              {today.map((t) => (
                <div
                  key={t.id}
                  style={{
                    background: 'var(--cream-100)',
                    border: '1px solid var(--ink-100)',
                    borderRadius: 6,
                    padding: 8,
                  }}
                >
                  <ProjTag id={t.proj} />
                  <div style={{ fontSize: 12, fontWeight: 500, marginTop: 4, lineHeight: 1.3 }}>{t.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                    <span className="mono" style={{ fontSize: 9, color: 'var(--ink-500)' }}>
                      {t.estH.toFixed(1).replace('.', ',')}h gepl.
                    </span>
                    <div style={{ flex: 1 }} />
                    {timer?.taskId === t.id ? (
                      <span
                        style={{
                          fontSize: 9,
                          color: 'var(--accent-500)',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 600,
                        }}
                      >
                        ● LIVE
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          startTimer(t.id, true);
                          showToast('Timer + Pomo gestartet');
                        }}
                        style={{
                          background: 'var(--ink-900)',
                          color: 'var(--cream-50)',
                          border: 0,
                          borderRadius: 4,
                          padding: '3px 8px',
                          fontSize: 9,
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                        }}
                      >
                        <Icon name="play" size={8} /> START
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div
              style={{
                display: 'flex',
                borderTop: '1px solid var(--ink-100)',
                background: 'var(--cream-100)',
              }}
            >
              {(
                [
                  ['list-checks', 'Heute', true],
                  ['timer', 'Timer', false],
                  ['sparkles', 'KI', false],
                ] as Array<[string, string, boolean]>
              ).map(([ic, lbl, act]) => (
                <div
                  key={lbl}
                  style={{
                    flex: 1,
                    padding: '10px 0',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 3,
                    color: act ? 'var(--accent-500)' : 'var(--ink-500)',
                    fontSize: 9,
                    fontFamily: 'var(--font-mono)',
                    fontWeight: act ? 600 : 500,
                  }}
                >
                  <Icon name={ic} size={16} /> {lbl}
                </div>
              ))}
            </div>
          </div>
          <div className="label">Heute</div>
        </div>

        {/* TIMER */}
        <div>
          <div className="mob-frame dark">
            <div style={{ padding: '14px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="chevron-left" size={18} />
              <div className="mono" style={{ fontSize: 10, color: 'var(--cream-100)', flex: 1 }}>
                {timer
                  ? `läuft seit ${new Date(timer.startedAt).toLocaleTimeString('de-DE', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}`
                  : 'kein Timer'}
              </div>
            </div>
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                padding: 16,
                textAlign: 'center',
              }}
            >
              {liveTask ? (
                <>
                  <ProjTag id={liveTask.proj} />
                  <div
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 700,
                      fontSize: 14,
                      lineHeight: 1.2,
                      color: 'var(--cream-50)',
                    }}
                  >
                    {liveTask.title}
                  </div>
                  {pomo && (
                    <>
                      <div style={{ position: 'relative', width: 170, height: 170 }}>
                        <svg
                          viewBox="0 0 100 100"
                          style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}
                        >
                          <circle cx="50" cy="50" r="44" fill="none" stroke="var(--ink-700)" strokeWidth="4" />
                          <circle
                            cx="50"
                            cy="50"
                            r="44"
                            fill="none"
                            stroke={pomo.mode === 'focus' ? 'var(--accent-500)' : 'var(--ok-500)'}
                            strokeWidth="4"
                            strokeLinecap="round"
                            strokeDasharray="276.5"
                            strokeDashoffset={276.5 * (1 - pomo.elapsedInBlock / pomo.total)}
                          />
                        </svg>
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 2,
                          }}
                        >
                          <div
                            className="mono"
                            style={{
                              fontSize: 9,
                              color: 'var(--cream-100)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.08em',
                            }}
                          >
                            {pomo.mode === 'focus' ? 'Fokus' : pomo.mode === 'short' ? 'Pause' : 'L. Pause'}
                          </div>
                          <div
                            style={{
                              fontFamily: 'var(--font-display)',
                              fontWeight: 700,
                              fontSize: 28,
                              color: 'var(--cream-50)',
                              letterSpacing: '-0.02em',
                            }}
                          >
                            {fmtMS(pomo.remaining)}
                          </div>
                          <div className="mono" style={{ fontSize: 9, color: 'var(--cream-100)' }}>
                            von {Math.round(pomo.total / 60000)}:00
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {[0, 1, 2, 3].map((i) => (
                          <span
                            key={i}
                            style={{
                              width: 22,
                              height: 5,
                              borderRadius: 2.5,
                              background:
                                i < pomo.blocksDone
                                  ? 'var(--ok-500)'
                                  : i === pomo.blocksDone && pomo.mode === 'focus'
                                  ? 'var(--accent-500)'
                                  : 'var(--ink-700)',
                            }}
                          />
                        ))}
                      </div>
                    </>
                  )}
                  <div className="mono" style={{ fontSize: 10, color: 'var(--cream-100)' }}>
                    gesamt {fmtHMS(elapsed)}
                  </div>
                </>
              ) : (
                <>
                  <Icon name="timer" size={48} style={{ color: 'var(--ink-700)' }} />
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--cream-100)' }}>
                    Kein Timer aktiv
                  </div>
                  <div className="mono" style={{ fontSize: 10, color: 'var(--ink-500)' }}>
                    Auf „Heute" eine Aufgabe wählen
                  </div>
                </>
              )}
            </div>
            {timer && (
              <div style={{ padding: 12, display: 'flex', gap: 6 }}>
                <button
                  onClick={togglePomodoro}
                  style={{
                    flex: 1,
                    padding: 10,
                    borderRadius: 8,
                    background: 'transparent',
                    color: 'var(--cream-50)',
                    border: '1px solid var(--ink-700)',
                    fontWeight: 600,
                    fontSize: 11,
                  }}
                >
                  {timer.pomodoro ? 'Pomo aus' : 'Pomo an'}
                </button>
                <button
                  onClick={() => {
                    stopTimer();
                    showToast('Gestoppt');
                  }}
                  style={{
                    flex: 1.4,
                    padding: 10,
                    borderRadius: 8,
                    background: 'var(--cream-50)',
                    color: 'var(--ink-900)',
                    border: 0,
                    fontWeight: 600,
                    fontSize: 11,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                  }}
                >
                  <Icon name="square" size={11} /> Stoppen
                </button>
              </div>
            )}
          </div>
          <div className="label">Pomodoro-Timer</div>
        </div>

        {/* KI-EINTRAG */}
        <div>
          <div className="mob-frame">
            <div
              style={{
                padding: '14px',
                borderBottom: '1px solid var(--ink-100)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Icon name="x" size={16} />
              <div style={{ flex: 1, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>
                Aufgaben planen
              </div>
            </div>
            <div style={{ flex: 1, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div
                style={{
                  background: 'var(--cream-100)',
                  border: '1px dashed var(--ink-300)',
                  borderRadius: 6,
                  padding: 10,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--ink-700)',
                  flex: 1,
                }}
              >
                Anwalt-Feedback DSGVO + Impressum
                <br />
                <span style={{ color: 'var(--ink-500)' }}>[Anhang: anwalt-review.pdf]</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  style={{
                    flex: 1,
                    padding: '8px',
                    border: '1px solid var(--ink-200)',
                    background: 'var(--cream-50)',
                    borderRadius: 6,
                    fontSize: 11,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                  }}
                >
                  <Icon name="camera" size={12} /> Foto
                </button>
                <button
                  style={{
                    flex: 1,
                    padding: '8px',
                    border: '1px solid var(--ink-200)',
                    background: 'var(--cream-50)',
                    borderRadius: 6,
                    fontSize: 11,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                  }}
                >
                  <Icon name="mic" size={12} /> Sprache
                </button>
              </div>
              <div className="eyebrow" style={{ marginTop: 4 }}>
                KI-Vorschlag · 3 Aufgaben
              </div>
              {['DSGVO-Erklärung anpassen', 'Impressum ergänzen', 'Anwaltsfreigabe-Mail an GL'].map((t, i) => (
                <div
                  key={i}
                  style={{
                    padding: 6,
                    border: '1px solid var(--ink-200)',
                    borderRadius: 4,
                    fontSize: 11,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <input type="checkbox" defaultChecked style={{ accentColor: 'var(--accent-500)' }} />
                  <span style={{ flex: 1 }}>{t}</span>
                </div>
              ))}
              <button
                style={{
                  background: 'var(--accent-500)',
                  color: 'var(--cream-50)',
                  border: 0,
                  borderRadius: 6,
                  padding: 10,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                3 Aufgaben anlegen
              </button>
            </div>
          </div>
          <div className="label">KI-Eintrag</div>
        </div>
      </div>
    </div>
  );
}
