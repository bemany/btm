import { useStore } from '../../store/store';
import { COLUMNS } from '../../store/seed';
import { useTick } from '../shared/hooks';
import { Icon } from '../shared/Icon';
import { ProjTag } from '../shared/ProjTag';
import { showToast } from '../shared/Toast';
import { fmtHMS } from '../../lib/format';

export function ChromePluginScreen() {
  const tasks = useStore((s) => s.tasks);
  const currentUser = useStore((s) => s.currentUser);
  const timer = useStore((s) => s.timer);
  const startTimer = useStore((s) => s.startTimer);
  const stopTimer = useStore((s) => s.stopTimer);

  const users = useStore((s) => s.users);
  useTick(!!timer);
  const me = users.find((u) => u.id === currentUser) ?? { name: '—', email: '—', cap: 40 };
  const liveTask = timer ? tasks.find((t) => t.id === timer.taskId) : null;
  const elapsed = timer ? Date.now() - timer.startedAt : 0;
  const myTasks = tasks.filter((t) => t.who === currentUser);
  const todoCount = myTasks.filter((t) => t.col === 'todo' || t.col === 'doing').length;

  return (
    <div className="page">
      <div className="page-head">
        <div className="left">
          <div className="eyebrow">Chrome-Plugin · Phase 3</div>
          <h1>Eine Klick-Distanz vom Browser zur Aufgabe.</h1>
          <div className="subtitle">
            Browser-Erweiterung mit drei Touchpoints: Toolbar-Popup (Live-Status), Kontextmenü (Quick-Capture aus
            Mail/Doc), Side-Panel (Mini-Board) — synchron mit Desktop-Daten.
          </div>
        </div>
      </div>

      <div className="cp-row">
        {/* TOOLBAR POPUP */}
        <div>
          <div className="cp-browser">
            <div className="cp-browser-bar">
              <span className="cp-dot r" />
              <span className="cp-dot y" />
              <span className="cp-dot g" />
              <div className="cp-url">your-btm-instance.example/board</div>
              <div className="cp-ext-row">
                <div className="cp-ext-icon">
                  <svg viewBox="0 0 32 32" width="14" height="14">
                    <rect x="6" y="9" width="20" height="3" rx="1" fill="#FAF7F2" />
                    <rect x="6" y="14" width="14" height="3" rx="1" fill="#FAF7F2" />
                    <rect x="6" y="19" width="17" height="3" rx="1" fill="#FAF7F2" />
                    <circle cx="24" cy="15.5" r="2" fill="var(--accent-500)" />
                  </svg>
                </div>
                <span className="cp-ext-badge">{todoCount}</span>
              </div>
            </div>
            <div className="cp-popover">
              <div className="cp-pop-head">
                <div className="cp-pop-logo">
                  <svg viewBox="0 0 32 32" width="14" height="14">
                    <rect x="6" y="9" width="20" height="3" rx="1" fill="#FAF7F2" />
                    <rect x="6" y="14" width="14" height="3" rx="1" fill="#FAF7F2" />
                    <rect x="6" y="19" width="17" height="3" rx="1" fill="#FAF7F2" />
                    <circle cx="24" cy="15.5" r="2" fill="var(--accent-500)" />
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13 }}>BTM</div>
                  <div className="mono" style={{ fontSize: 9, color: 'var(--ink-500)' }}>
                    {me.name} · KW 19
                  </div>
                </div>
                <Icon name="settings" size={13} style={{ color: 'var(--ink-500)' }} />
              </div>

              {liveTask ? (
                <div className="cp-live">
                  <div className="cp-live-pulse" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      className="mono"
                      style={{
                        fontSize: 9,
                        color: 'var(--accent-100)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                      }}
                    >
                      Live · {fmtHMS(elapsed)}
                    </div>
                    <div
                      style={{
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: 'var(--cream-50)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {liveTask.title}
                    </div>
                  </div>
                  <button
                    className="cp-stop"
                    onClick={() => {
                      stopTimer();
                      showToast('Gestoppt');
                    }}
                  >
                    <Icon name="square" size={10} />
                  </button>
                </div>
              ) : (
                <div className="cp-no-live">Kein Timer aktiv</div>
              )}

              <div className="cp-quick-add">
                <Icon name="plus" size={12} />
                <input type="text" placeholder='Quick-Add: „og:image fixen 1h #P1"' />
                <span className="mono" style={{ fontSize: 9, color: 'var(--ink-500)' }}>
                  ↵
                </span>
              </div>

              <div className="cp-section-label">Heute · {todoCount}</div>
              <div className="cp-tasks">
                {myTasks
                  .filter((t) => t.col === 'todo' || t.col === 'doing')
                  .slice(0, 4)
                  .map((t) => (
                    <div key={t.id} className="cp-task">
                      <ProjTag id={t.proj} />
                      <span className="cp-task-title">{t.title}</span>
                      {timer?.taskId === t.id ? (
                        <span
                          style={{
                            fontSize: 8,
                            color: 'var(--accent-500)',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 600,
                          }}
                        >
                          ● LIVE
                        </span>
                      ) : (
                        <button
                          className="cp-task-play"
                          onClick={() => {
                            startTimer(t.id, true);
                            showToast('Timer gestartet');
                          }}
                        >
                          <Icon name="play" size={9} />
                        </button>
                      )}
                    </div>
                  ))}
              </div>

              <div className="cp-pop-foot">
                <button className="cp-foot-btn">
                  <Icon name="layout-dashboard" size={11} /> Board
                </button>
                <button className="cp-foot-btn">
                  <Icon name="sparkles" size={11} /> KI
                </button>
                <button className="cp-foot-btn">
                  <Icon name="external-link" size={11} /> Web-App
                </button>
              </div>
            </div>
          </div>
          <div className="cp-label">① Toolbar-Popup · Live-Status & Quick-Add</div>
        </div>

        {/* CONTEXT MENU */}
        <div>
          <div className="cp-browser">
            <div className="cp-browser-bar">
              <span className="cp-dot r" />
              <span className="cp-dot y" />
              <span className="cp-dot g" />
              <div className="cp-url">mail.google.com/u/0/#inbox/FMfcg…</div>
            </div>
            <div className="cp-mail">
              <div className="cp-mail-head">
                <div style={{ fontSize: 13, fontWeight: 600 }}>Re: Anwalts-Feedback DSGVO</div>
                <div className="mono" style={{ fontSize: 9, color: 'var(--ink-500)' }}>
                  Dr. Schmidt · vor 2 Std.
                </div>
              </div>
              <div className="cp-mail-body">
                <p>Hallo Arne,</p>
                <p>
                  im Anhang die Review-Notizen.{' '}
                  <span className="cp-selected">
                    Bitte bis Freitag DSGVO-Erklärung anpassen + Impressum ergänzen — beides 2h Aufwand.
                  </span>{' '}
                  Dann gehen wir final durch.
                </p>
                <p style={{ color: 'var(--ink-500)' }}>
                  Beste Grüße,
                  <br />
                  Anna
                </p>
              </div>
            </div>

            <div className="cp-context">
              <div className="cp-ctx-item">
                Kopieren{' '}
                <span className="mono" style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--ink-500)' }}>
                  ⌘C
                </span>
              </div>
              <div className="cp-ctx-item">Suchen…</div>
              <div className="cp-ctx-divider" />
              <div className="cp-ctx-item btm-action">
                <Icon name="sparkles" size={11} />
                Zu BTM hinzufügen
                <span className="mono" style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--cream-100)' }}>
                  KI
                </span>
              </div>
              <div className="cp-ctx-item btm-action sub">
                <Icon name="plus" size={11} />
                Als Aufgabe anlegen…
              </div>
              <div className="cp-ctx-divider" />
              <div className="cp-ctx-item">Drucken…</div>
            </div>
          </div>
          <div className="cp-label">② Rechtsklick → KI extrahiert Aufgaben aus Mail/Doc</div>
        </div>

        {/* SIDE PANEL */}
        <div>
          <div className="cp-browser tall">
            <div className="cp-browser-bar">
              <span className="cp-dot r" />
              <span className="cp-dot y" />
              <span className="cp-dot g" />
              <div className="cp-url">github.com/your-org/your-repo/pull/47</div>
            </div>
            <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
              <div className="cp-page-fake">
                <div className="cp-skel l" />
                <div className="cp-skel m" />
                <div className="cp-skel s" />
                <div className="cp-skel l" />
                <div className="cp-skel m" />
                <div className="cp-skel l" />
                <div className="cp-skel s" />
              </div>
              <div className="cp-side">
                <div className="cp-side-head">
                  <div className="cp-pop-logo">
                    <svg viewBox="0 0 32 32" width="11" height="11">
                      <rect x="6" y="9" width="20" height="3" rx="1" fill="#FAF7F2" />
                      <rect x="6" y="14" width="14" height="3" rx="1" fill="#FAF7F2" />
                      <rect x="6" y="19" width="17" height="3" rx="1" fill="#FAF7F2" />
                      <circle cx="24" cy="15.5" r="2" fill="var(--accent-500)" />
                    </svg>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600 }}>Mini-Board</span>
                  <div style={{ flex: 1 }} />
                  <Icon name="x" size={12} style={{ color: 'var(--ink-500)' }} />
                </div>
                <div className="cp-side-body">
                  {COLUMNS.slice(0, 3).map((col) => {
                    const colTasks = myTasks.filter((t) => t.col === col.id).slice(0, 2);
                    return (
                      <div key={col.id} style={{ marginBottom: 10 }}>
                        <div
                          className="mono"
                          style={{
                            fontSize: 9,
                            color: 'var(--ink-500)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                            marginBottom: 4,
                          }}
                        >
                          {col.label} · {colTasks.length}
                        </div>
                        {colTasks.map((t) => (
                          <div key={t.id} className="cp-mini-card">
                            <ProjTag id={t.proj} />
                            <div style={{ fontSize: 10.5, fontWeight: 500, marginTop: 3, lineHeight: 1.3 }}>
                              {t.title}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
          <div className="cp-label">③ Side-Panel · Mini-Board parallel zur Arbeit</div>
        </div>
      </div>

      <div className="cp-roadmap">
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          Roadmap-Status
        </div>
        <div className="cp-road-row">
          <div className="cp-road-step done">
            <Icon name="check" size={11} /> Phase 1 · Web-App
          </div>
          <div className="cp-road-step current">
            <Icon name="zap" size={11} /> Phase 2 · Mobile PWA
          </div>
          <div className="cp-road-step next">
            <Icon name="puzzle" size={11} /> Phase 3 · Browser-Plugin{' '}
            <span className="mono" style={{ marginLeft: 4, color: 'var(--ink-500)' }}>
              Q3 2026
            </span>
          </div>
          <div className="cp-road-step next">Phase 4 · Native Apps</div>
        </div>
      </div>
    </div>
  );
}
