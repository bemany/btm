import { useStore } from '../../store/store';
import { PERSONAS } from '../../store/seed';
import { useTick } from '../shared/hooks';
import { Icon } from '../shared/Icon';
import { fmtHMS } from '../../lib/format';

export function TVDashboardScreen() {
  const tasks = useStore((s) => s.tasks);
  const projects = useStore((s) => s.projects);
  const timer = useStore((s) => s.timer);

  useTick(true); // 1s tick for live clock + timer

  const now = new Date();
  const weekday = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'][now.getDay()];
  const dateStr = now.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const kw = 'KW 19';

  const personaById = (id: string) => PERSONAS.find((p) => p.id === id);
  const projectById = (id: string | null) => (id ? projects.find((p) => p.id === id) : undefined);

  const inProgress = tasks.filter((t) => t.col === 'doing');
  const dueToday = tasks.filter((t) => t.due === 'today' && t.col !== 'done');
  const inReview = tasks.filter((t) => t.col === 'review');
  const doneToday = tasks.filter((t) => t.col === 'done');
  const doneCount = doneToday.length;

  const totalEst = tasks.reduce((a, t) => a + (t.estH || 0), 0);
  const totalLogged = tasks.reduce((a, t) => a + (t.loggedH || 0), 0);
  const weekPct = totalEst ? Math.min(100, Math.round((totalLogged / totalEst) * 100)) : 0;

  const liveTaskId = timer?.taskId;
  const liveElapsed = timer ? Date.now() - timer.startedAt : 0;

  return (
    <div className="tv-dashboard">
      <header className="tv-head">
        <div className="tv-head-left">
          <div className="tv-brand">
            <svg viewBox="0 0 32 32" width="36" height="36" fill="none">
              <rect x="0" y="0" width="32" height="32" rx="8" fill="#FAF7F2" />
              <rect x="6" y="9" width="9" height="2" rx="1" fill="#0F0E0C" fillOpacity="0.55" />
              <rect x="6" y="15" width="14" height="2" rx="1" fill="#0F0E0C" fillOpacity="0.55" />
              <rect x="6" y="21" width="6" height="2" rx="1" fill="#0F0E0C" fillOpacity="0.55" />
              <rect x="20" y="14" width="4" height="4" rx="2" fill="#C85A2C" />
            </svg>
            <div>
              <div className="tv-brand-name">BTM</div>
              <div className="tv-brand-sub">Bethesna Task Management</div>
            </div>
          </div>
        </div>

        <div className="tv-head-center">
          <div className="tv-date">
            <div className="tv-date-weekday">{weekday}</div>
            <div className="tv-date-meta">
              {kw} · {dateStr}
            </div>
          </div>
        </div>

        <div className="tv-head-right">
          <div className="tv-clock">{timeStr}</div>
          <div className="tv-status">
            <span className="tv-status-dot" />
            <span>Live</span>
          </div>
        </div>
      </header>

      <main className="tv-main">
        {/* In Arbeit */}
        <section className="tv-col tv-col-progress">
          <div className="tv-col-head">
            <div className="tv-col-eyebrow">Jetzt</div>
            <h2>In Arbeit</h2>
            <div className="tv-col-count">{inProgress.length}</div>
          </div>
          <div className="tv-list">
            {inProgress.length === 0 && <div className="tv-empty">Niemand arbeitet gerade aktiv.</div>}
            {inProgress.map((t) => {
              const p = personaById(t.who);
              const proj = projectById(t.proj);
              const isLive = liveTaskId === t.id;
              const pct = t.estH ? Math.min(100, Math.round((t.loggedH / t.estH) * 100)) : 0;
              return (
                <div key={t.id} className={`tv-row ${isLive ? 'is-live' : ''}`}>
                  <div className="tv-row-avatar" style={{ background: 'var(--accent-500)' }}>
                    {p?.id || '??'}
                  </div>
                  <div className="tv-row-title">{t.title}</div>
                  <div className="tv-row-trail">
                    <span className="tv-chip" style={{ borderColor: proj?.color, color: proj?.color }}>
                      {proj?.code || '—'}
                    </span>
                    {isLive && (
                      <span className="tv-live-pill">
                        <span className="tv-live-dot" />
                        {fmtHMS(liveElapsed)}
                      </span>
                    )}
                    <div className="tv-row-progress">
                      <div className="tv-row-progbar">
                        <div className="tv-row-progfill" style={{ width: pct + '%' }} />
                      </div>
                      <div className="tv-row-progmeta">
                        {t.loggedH.toFixed(1)}
                        <span className="dim">/</span>
                        {t.estH.toFixed(1)}h
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Heute fällig */}
        <section className="tv-col tv-col-due">
          <div className="tv-col-head">
            <div className="tv-col-eyebrow">Frist</div>
            <h2>Heute fällig</h2>
            <div className="tv-col-count">{dueToday.length}</div>
          </div>
          <div className="tv-list">
            {dueToday.length === 0 && <div className="tv-empty">Keine Fristen für heute.</div>}
            {dueToday.map((t) => {
              const p = personaById(t.who);
              const proj = projectById(t.proj);
              const statusLabel =
                ({ todo: 'Backlog', doing: 'In Arbeit', review: 'Review' } as Record<string, string>)[t.col] || t.col;
              return (
                <div key={t.id} className={`tv-row tv-row-due status-${t.col}`}>
                  <div className="tv-due-flag">
                    <Icon name="alarm-clock" size={16} />
                  </div>
                  <div className="tv-row-title">{t.title}</div>
                  <div className="tv-row-trail">
                    <span className="tv-chip" style={{ borderColor: proj?.color, color: proj?.color }}>
                      {proj?.code || '—'}
                    </span>
                    <span className={`tv-status-pill status-${t.col}`}>{statusLabel}</span>
                    {t.prio === 'high' && <span className="tv-prio-pill">Hoch</span>}
                    <div className="tv-row-avatar sm" style={{ background: 'var(--accent-500)' }} title={p?.full}>
                      {p?.id}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Im Review */}
        <section className="tv-col tv-col-review">
          <div className="tv-col-head">
            <div className="tv-col-eyebrow">Wartet</div>
            <h2>Im Review</h2>
            <div className="tv-col-count">{inReview.length}</div>
          </div>
          <div className="tv-list">
            {inReview.length === 0 && <div className="tv-empty">Nichts im Review-Stapel.</div>}
            {inReview.map((t) => {
              const p = personaById(t.who);
              const proj = projectById(t.proj);
              return (
                <div key={t.id} className="tv-row tv-row-review">
                  <div className="tv-review-flag">
                    <Icon name="eye" size={14} />
                  </div>
                  <div className="tv-row-title">{t.title}</div>
                  <div className="tv-row-trail">
                    <span className="tv-chip" style={{ borderColor: proj?.color, color: proj?.color }}>
                      {proj?.code || '—'}
                    </span>
                    {t.due === 'today' && <span className="tv-due-tag">heute fällig</span>}
                    <span className="tv-row-progmeta">{t.loggedH.toFixed(1)}h</span>
                    <div className="tv-row-avatar sm" style={{ background: 'var(--accent-500)' }} title={p?.full}>
                      {p?.id}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Heute erledigt */}
        <section className="tv-col tv-col-done">
          <div className="tv-col-head">
            <div className="tv-col-eyebrow">Geschafft</div>
            <h2>Heute erledigt</h2>
            <div className="tv-col-count">{doneToday.length}</div>
          </div>
          <div className="tv-list">
            {doneToday.length === 0 && <div className="tv-empty">Heute noch nichts erledigt.</div>}
            {doneToday.map((t) => {
              const p = personaById(t.who);
              const proj = projectById(t.proj);
              return (
                <div key={t.id} className="tv-row tv-row-done">
                  <div className="tv-done-flag">
                    <Icon name="check" size={16} />
                  </div>
                  <div className="tv-row-title tv-row-title-done">{t.title}</div>
                  <div className="tv-row-trail">
                    <span className="tv-chip" style={{ borderColor: proj?.color, color: proj?.color }}>
                      {proj?.code || '—'}
                    </span>
                    <span className="tv-row-progmeta">{t.loggedH.toFixed(1)}h</span>
                    <div className="tv-row-avatar sm" style={{ background: '#5E7F4E' }} title={p?.full}>
                      {p?.id}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="tv-foot">
        <div className="tv-foot-stat">
          <div className="tv-foot-label">In Arbeit</div>
          <div className="tv-foot-val">{inProgress.length}</div>
        </div>
        <div className="tv-foot-stat">
          <div className="tv-foot-label">Fristen heute</div>
          <div className="tv-foot-val">{dueToday.length}</div>
        </div>
        <div className="tv-foot-stat">
          <div className="tv-foot-label">Im Review</div>
          <div className="tv-foot-val">{inReview.length}</div>
        </div>
        <div className="tv-foot-stat">
          <div className="tv-foot-label">Erledigt heute</div>
          <div className="tv-foot-val">{doneCount}</div>
        </div>

        <div className="tv-foot-bar">
          <div className="tv-foot-bar-head">
            <span>KW 19 Fortschritt</span>
            <span className="tv-foot-bar-pct">
              {totalLogged.toFixed(1)} / {totalEst.toFixed(1)} h · {weekPct}%
            </span>
          </div>
          <div className="tv-bar">
            <div className="tv-bar-fill" style={{ width: weekPct + '%' }} />
          </div>
        </div>

        <div className="tv-foot-tag">
          <span className="tv-status-dot" />
          Auto-Refresh · alle 30 s
        </div>
      </footer>
    </div>
  );
}
