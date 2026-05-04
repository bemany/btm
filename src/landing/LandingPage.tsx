import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/shared/Icon';

const TASKS = [
  { id: 't1', title: 'Roadmap-Review', hours: '2h', who: 'AB', color: '#4a6f8a' },
  { id: 't2', title: 'UX Audit App', hours: '4h', who: 'EY', color: '#b86a3a' },
  { id: 't3', title: 'Onboarding-Flow', hours: '3h', who: 'AB', color: '#4a6f8a' },
  { id: 't4', title: 'Meta-Tags optimieren', hours: '1.5h', who: 'AB', color: '#4a6f8a' },
  { id: 't5', title: 'Briefing finalisieren', hours: '1.5h', who: 'JW', color: '#6a8455' },
  { id: 't6', title: 'Standup vorbereiten', hours: '0.5h', who: 'AB', color: '#4a6f8a' },
  { id: 't7', title: 'Kunden-Call', hours: '1h', who: 'EY', color: '#b86a3a' },
  { id: 't8', title: 'Sprint-Planning', hours: '1h', who: 'JW', color: '#6a8455' },
];

type Lane = 'todo' | 'doing' | 'done';
type State = Record<Lane, string[]>;

export interface LandingPageProps {
  onLogin: () => void;
}

function fmtClock(s: number): string {
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${h}:${m}:${sec}`;
}

export function LandingPage({ onLogin }: LandingPageProps) {
  const [state, setState] = useState<State>({
    todo: ['t2', 't3', 't8'],
    doing: ['t4'],
    done: ['t6', 't7'],
  });
  const [enteringId, setEnteringId] = useState<string | null>(null);
  const [clock, setClock] = useState(24 * 60 + 18);
  const tickRef = useRef(0);

  useEffect(() => {
    const id = setInterval(() => setClock((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const cycle = () => {
      tickRef.current++;
      setState((prev) => {
        // 1. doing → done
        let next: State = { ...prev };
        if (next.doing.length > 0) {
          const id = next.doing[0];
          next = { ...next, doing: next.doing.slice(1), done: [...next.done, id] };
          setEnteringId(id);
        }
        return next;
      });
      setTimeout(() => {
        setState((prev) => {
          if (prev.todo.length === 0) return prev;
          const id = prev.todo[0];
          setEnteringId(id);
          return { ...prev, todo: prev.todo.slice(1), doing: [...prev.doing, id] };
        });
      }, 700);
      setTimeout(() => {
        setState((prev) => (prev.done.length > 3 ? { ...prev, done: prev.done.slice(-3) } : prev));
      }, 1400);
      setTimeout(() => {
        setState((prev) => {
          const used = new Set([...prev.todo, ...prev.doing, ...prev.done]);
          const free = TASKS.filter((t) => !used.has(t.id));
          if (prev.todo.length < 3 && free.length > 0) {
            const t = free[Math.floor(Math.random() * free.length)];
            setEnteringId(t.id);
            return { ...prev, todo: [...prev.todo, t.id] };
          }
          return prev;
        });
      }, 2100);
    };
    const id = setInterval(cycle, 4500);
    return () => clearInterval(id);
  }, []);

  const findTask = (id: string) => TASKS.find((t) => t.id === id);
  const onLoginClick = (e?: React.MouseEvent) => {
    e?.preventDefault();
    onLogin();
  };

  return (
    <div className="lp-root">
      {/* Top bar */}
      <header className="lp-top">
        <div className="lp-top-inner">
          <div className="lp-logo">
            <div className="lp-logo-mark">
              <svg viewBox="0 0 32 32" width="20" height="20" fill="none">
                <rect x="6" y="9" width="20" height="2" rx="1" fill="#fff" fillOpacity="0.18" />
                <rect x="6" y="15" width="20" height="2" rx="1" fill="#fff" fillOpacity="0.18" />
                <rect x="6" y="21" width="20" height="2" rx="1" fill="#fff" fillOpacity="0.18" />
                <rect x="6" y="9" width="9" height="2" rx="1" fill="#fff" fillOpacity="0.55" />
                <rect x="6" y="15" width="14" height="2" rx="1" fill="#fff" fillOpacity="0.55" />
                <rect x="6" y="21" width="6" height="2" rx="1" fill="#fff" fillOpacity="0.55" />
                <rect x="20" y="14" width="4" height="4" rx="2" fill="#C85A2C" />
              </svg>
            </div>
            <div className="lp-logo-text">BTM</div>
            <div className="lp-org-tag">Internes Tool · Bethesna Group</div>
          </div>
          <div className="lp-top-spacer" />
          <a href="#features" className="lp-top-link">
            Funktionen
          </a>
          <a href="#mcp" className="lp-top-link">
            MCP
          </a>
          <a href="#preview" className="lp-top-link">
            Vorschau
          </a>
          <a href="#login" onClick={onLoginClick} className="lp-btn">
            <Icon name="log-in" size={14} />
            Anmelden
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="lp-hero">
        <div>
          <div className="lp-eyebrow">Bethesna Task Management</div>
          <h1>
            Plane deine Woche.
            <br />
            Tracke deine Zeit.
            <br />
            <span className="accent">Behalte den Fokus.</span>
          </h1>
          <p className="lead">
            BTM ist das interne Wochen- und Zeitmanagement-Tool der Bethesna Group. Aufgaben planen, Stunden
            erfassen, Kapazitäten überblicken — in einer Oberfläche.
          </p>
          <div className="lp-cta-row">
            <a href="#login" onClick={onLoginClick} className="lp-btn">
              <Icon name="log-in" size={14} />
              Mit E-Mail anmelden
            </a>
            <a href="#features" className="lp-btn ghost">
              Mehr erfahren
              <Icon name="arrow-down" size={14} />
            </a>
          </div>
          <div className="lp-meta">
            <span className="lp-meta-dot" />
            <span>System einsatzbereit</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>v0.9.2</span>
          </div>
        </div>

        {/* Animated mini-board */}
        <div className="mini-board">
          <div className="mini-board-head">
            <div>
              <div className="mb-week">Wochenboard · KW 19</div>
              <div className="mb-week-meta">Mo 04. — Fr 08. Mai</div>
            </div>
            <div className="mb-spacer" />
            <div className="mb-clock">
              <span className="mb-clock-dot" />
              <span>{fmtClock(clock)}</span>
            </div>
          </div>
          <div className="mb-cols">
            {(
              [
                { key: 'todo', label: 'Backlog', dot: 'todo' as const },
                { key: 'doing', label: 'In Arbeit', dot: 'doing' as const },
                { key: 'done', label: 'Erledigt', dot: 'done' as const },
              ] as const
            ).map((col) => (
              <div className="mb-col" key={col.key}>
                <div className="mb-col-head">
                  <span className={`mb-col-dot ${col.dot}`} />
                  <span className="mb-col-ttl">{col.label}</span>
                  <span className="mb-col-ct">{state[col.key].length}</span>
                </div>
                <div className="mb-col-body">
                  {state[col.key].map((id) => {
                    const t = findTask(id);
                    if (!t) return null;
                    const isLive = col.key === 'doing';
                    const isDone = col.key === 'done';
                    const cls = ['mb-card', isLive && 'live', isDone && 'done', enteringId === id && 'entering']
                      .filter(Boolean)
                      .join(' ');
                    return (
                      <div key={id} className={cls}>
                        <div className="mb-card-title">{t.title}</div>
                        <div className="mb-card-meta">
                          <span className="mb-card-who" style={{ background: t.color }}>
                            {t.who}
                          </span>
                          {isLive && <span className="live-pip" />}
                          <span className="mb-card-hours">{t.hours}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pitch */}
      <section className="lp-pitch">
        <p className="pitch-text">
          Eine Woche im Überblick.{' '}
          <span className="dim">
            Aufgaben erscheinen aus deiner Inbox, wandern durch dein Board, werden zu Stunden.
          </span>{' '}
          Ohne Tabs-Wirrwarr, ohne Reibung.
        </p>
      </section>

      {/* Features */}
      <section className="lp-section" id="features">
        <div className="lp-section-label">Was BTM kann</div>
        <h2>Fünf Werkzeuge, ein Workflow.</h2>
        <p className="sub">
          Alles, was du brauchst, um deine Woche zu strukturieren — und nichts, was du nicht brauchst.
        </p>

        <div className="lp-features">
          {[
            {
              icon: 'layout-grid',
              title: 'Wochenboard',
              desc: 'Backlog · In Arbeit · Erledigt. Drag & drop, Live-Timer auf jeder Karte, klare Übersicht für deine fünf Tage.',
              stat: <><strong>Kanban</strong> · Liste · Timeline</>,
            },
            {
              icon: 'sparkles',
              title: 'Planungs-KI',
              desc: 'Aus E-Mails, Notizen und Briefings extrahiert die KI fertige Aufgaben — strukturiert, mit Schätzung und Zuordnung.',
              stat: <><strong>⌘K</strong> · zum Aufrufen</>,
            },
            {
              icon: 'clock',
              title: 'Zeiten',
              desc: 'Live-Timer pro Aufgabe, automatische Wochensumme, exportierbar. Kein doppeltes Eintragen, keine Lücken am Freitag.',
              stat: <><strong>Live</strong> · auf jeder Karte</>,
            },
            {
              icon: 'users',
              title: 'Kapazität',
              desc: 'Wer hat noch Luft, wer ist überlastet? Team-Auslastung pro Woche, mit Soll/Ist-Vergleich auf einen Blick.',
              stat: <><strong>Team-Heatmap</strong></>,
            },
            {
              icon: 'timer',
              title: 'Pomodoro',
              desc: '25 Minuten konzentriert, 5 Minuten Pause. Optionaler Fokusmodus mit Live-Timer im Topbar — direkt mit deinen Aufgaben verknüpft.',
              stat: <><strong>25 / 5</strong> · klassisch</>,
            },
            {
              icon: 'monitor',
              title: 'TV-Dashboard',
              desc: "Großbild-Ansicht für den Team-Bildschirm. Wer arbeitet woran, welche Tasks laufen, was steht heute an.",
              stat: <><strong>Vollbild</strong> · für's Office</>,
            },
          ].map((f) => (
            <div className="lp-feat" key={f.title}>
              <div className="lp-feat-icon">
                <Icon name={f.icon} size={18} />
              </div>
              <h3>{f.title}</h3>
              <p className="desc">{f.desc}</p>
              <div className="ft-stat">{f.stat}</div>
            </div>
          ))}
        </div>
      </section>

      {/* MCP */}
      <section className="lp-mcp" id="mcp">
        <div className="lp-section">
          <div className="lp-mcp-grid">
            <div>
              <div className="lp-mcp-pill">
                <span className="dot" />
                Neu · MCP-Server
              </div>
              <h2>BTM mit Claude steuern.</h2>
              <p className="sub">
                Der eingebaute MCP-Server macht BTM für Claude und andere KI-Assistenten erreichbar — auch
                außerhalb der App. Aufgaben anlegen, Wochen planen, Stunden buchen, alles per natürlicher Sprache
                aus deinem Editor, Terminal oder Chat.
              </p>
              <ul className="lp-mcp-tools">
                {[
                  ['btm.create_task', 'Aufgabe anlegen mit Projekt, Schätzung, Zuweisung'],
                  ['btm.move_task', 'Status ändern: Backlog → In Arbeit → Erledigt'],
                  ['btm.start_timer', 'Live-Timer für eine Aufgabe starten'],
                  ['btm.list_week', 'Wochenübersicht inkl. Stunden & Kapazität'],
                  ['btm.plan_from_text', 'Aus Briefing/E-Mail eine Wochenplanung generieren'],
                ].map(([code, desc]) => (
                  <li key={code} className="lp-mcp-tool">
                    <code>{code}</code>
                    <span>{desc}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="lp-mcp-chat">
              <div className="lp-mcp-chat-head">
                <span>Claude · MCP: btm.bethesna.org</span>
                <span className="live" />
              </div>
              <div className="lp-mcp-msg user">
                <div className="lp-mcp-avatar">AB</div>
                <div className="lp-mcp-bubble">
                  Plan mir den Donnerstag: Lighthouse-Audit, og:image fixen, danach Sprint-Review vorbereiten. 4h
                  Block am Vormittag.
                </div>
              </div>
              <div className="lp-mcp-msg ai">
                <div className="lp-mcp-avatar">C</div>
                <div className="lp-mcp-bubble">
                  Drei Aufgaben für Donnerstag in <span className="dim">Projekt P1 — Web/SEO</span> angelegt und
                  dir zugewiesen:
                  {[
                    ['„Lighthouse-Audit + Top-3 Fixes"', '1,5h'],
                    ['„og:image korrigieren"', '1,0h'],
                    ['„Sprint-Review vorbereiten"', '1,5h'],
                  ].map(([t, h]) => (
                    <div className="lp-mcp-tool-call" key={t}>
                      <span className="check">✓</span>
                      <span>
                        <span className="name">btm.create_task</span> · {t} · {h}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Preview */}
      <section className="lp-preview">
        <div className="lp-section" id="preview" style={{ paddingTop: 80, paddingBottom: 80 }}>
          <div className="lp-section-label">Vorschau</div>
          <h2>So sieht's drin aus.</h2>
          <p className="sub">
            Echte Daten aus KW 19: Arne, Web/Marketing. Live-Timer auf der Meta-Tag-Aufgabe, vier Backlog-Items
            aus Projekt P1, eine Done-Karte für Cache-Header.
          </p>

          <div className="lp-preview-frame">
            <div className="lp-preview-chrome">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
              <span className="url">btm.bethesna.org</span>
            </div>
            <div className="lp-preview-stage">
              <aside className="lp-preview-side">
                <div className="ps-label">Arbeit</div>
                {['Meine Woche', 'Wochenboard', 'Kapazität', 'Zeiten', 'Projekte'].map((label, i) => (
                  <div className={`ps-item ${i === 0 ? 'active' : ''}`} key={label}>
                    <span className="ps-bar" />
                    {label}
                  </div>
                ))}
                <div className="ps-label">Ausblick</div>
                {['Mobile-Vorschau', 'TV-Dashboard'].map((label) => (
                  <div className="ps-item" key={label}>
                    <span className="ps-bar" />
                    {label}
                  </div>
                ))}
              </aside>
              <main className="lp-preview-main">
                <div className="lp-preview-kpi-row">
                  {[
                    ['Diese Woche', <>12,4<span className="u">h / 40h</span></>],
                    ['Aktiv', '1'],
                    ['Offen', '5'],
                    ['Erledigt', '1'],
                  ].map(([k, v], i) => (
                    <div className="lp-preview-kpi" key={i}>
                      <div className="k">{k}</div>
                      <div className="v">{v}</div>
                    </div>
                  ))}
                </div>
                <div className="lp-preview-kanban">
                  <div className="lpk-col">
                    <div className="lpk-col-head">
                      <span className="mb-col-dot todo" /> Backlog{' '}
                      <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-500)' }}>
                        5
                      </span>
                    </div>
                    {[
                      ['robots.txt + sitemap.xml anlegen', 'P1 · 0,5h'],
                      ['og:image korrigieren (neues Bild)', 'P1 · 1,0h'],
                      ['JSON-LD Schema einbinden', 'P1 · 0,5h'],
                      ['Lighthouse-Audit + Top-3 Fixes', 'P1 · 1,5h'],
                    ].map(([t, m]) => (
                      <div className="lpk-card" key={t}>
                        {t}
                        <div className="ct">{m}</div>
                      </div>
                    ))}
                  </div>
                  <div className="lpk-col">
                    <div className="lpk-col-head">
                      <span className="mb-col-dot doing" /> In Arbeit{' '}
                      <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-500)' }}>
                        1
                      </span>
                    </div>
                    <div className="lpk-card live">
                      index.html Meta-Tags korrigieren
                      <div className="ct">
                        <span className="lpk-pip" /> 00:24:18 läuft · P1
                      </div>
                    </div>
                    <div
                      className="lpk-card"
                      style={{
                        borderStyle: 'dashed',
                        background: 'transparent',
                        color: 'var(--ink-500)',
                        textAlign: 'center',
                        fontStyle: 'italic',
                      }}
                    >
                      Web-Push: VAPID-Keys · Review
                    </div>
                  </div>
                  <div className="lpk-col">
                    <div className="lpk-col-head">
                      <span className="mb-col-dot done" /> Erledigt{' '}
                      <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-500)' }}>
                        1
                      </span>
                    </div>
                    <div className="lpk-card" style={{ opacity: 0.65 }}>
                      CDN-Cache-Header prüfen
                      <div className="ct">P1 · 0,4h · erledigt</div>
                    </div>
                  </div>
                </div>
              </main>
            </div>
          </div>
        </div>
      </section>

      {/* Login CTA */}
      <section className="lp-login">
        <h2>Bereit loszulegen?</h2>
        <p>Anmeldung mit deiner E-Mail.</p>
        <a href="#login" onClick={onLoginClick} className="lp-btn">
          <Icon name="mail" size={14} />
          Magic-Link anfordern
        </a>
        <div className="ml-hint">Kein Passwort nötig</div>
      </section>

      {/* Footer */}
      <footer className="lp-foot">
        <div className="lp-foot-inner">
          <div className="lp-foot-org">© 2026 Bethesna Group · BTM v0.9.2</div>
          <div className="lp-foot-spacer" />
          <a href="#">Impressum</a>
          <a href="#">Datenschutz</a>
          <a href="#login" onClick={onLoginClick}>
            Anmelden
          </a>
        </div>
      </footer>
    </div>
  );
}
