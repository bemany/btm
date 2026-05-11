import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../../store/store';
import { useTick } from '../shared/hooks';
import { Icon } from '../shared/Icon';
import { fmtHMS } from '../../lib/format';
import type { Task } from '../../store/types';

// ── Date-Helper ────────────────────────────────────────────────────────
// task.due ist im Frontend `string | 'today' | 'tomorrow' | null` — historisch
// gemischt. Der Server liefert ISO-Date (YYYY-MM-DD). Die literalen Werte
// 'today'/'tomorrow' können noch in localen Stores stecken — behandeln wir
// daher beim Vergleich mit. ISO-Strings sortieren lexikografisch, also reicht
// String-Vergleich für Heute/Überfällig.

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function isoWeekNum(d: Date): number {
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}

function isDueToday(due: string | null | undefined, today: string): boolean {
  if (!due) return false;
  if (due === 'today') return true;
  return due === today;
}
function isOverdue(due: string | null | undefined, today: string): boolean {
  if (!due) return false;
  if (due === 'today' || due === 'tomorrow') return false;
  // ISO-Dates lexikografisch vergleichbar
  return due < today;
}

// Generischer Auto-Paginator für lange Listen — TV kann nicht scrollen, also
// rotieren wir Seiten alle `intervalMs` durch. Wenn die Liste reinpasst,
// bleibt es eine Seite (kein Flackern).
function usePagedRotation<T>(items: T[], pageSize: number, intervalMs = 10_000): {
  page: T[];
  pageIndex: number;
  pageCount: number;
} {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const [pageIndex, setPageIndex] = useState(0);

  // Wenn Liste kürzer wird, Page-Index in valid range bringen
  useEffect(() => {
    if (pageIndex >= pageCount) setPageIndex(0);
  }, [pageCount, pageIndex]);

  // Rotation aktivieren wenn mehr als eine Seite
  useEffect(() => {
    if (pageCount <= 1) return;
    const id = setInterval(() => {
      setPageIndex((i) => (i + 1) % pageCount);
    }, intervalMs);
    return () => clearInterval(id);
  }, [pageCount, intervalMs]);

  const start = pageIndex * pageSize;
  const page = items.slice(start, start + pageSize);
  return { page, pageIndex, pageCount };
}

// ── Component ──────────────────────────────────────────────────────────

const PAGE_SIZE = 7; // max Tasks pro Bucket-View; bei mehr rotiert es

export function TVDashboardScreen() {
  const tasks = useStore((s) => s.tasks);
  const projects = useStore((s) => s.projects);
  const users = useStore((s) => s.users);
  const timer = useStore((s) => s.timer);

  useTick(true); // 1s tick für Live-Clock + Timer

  const now = new Date();
  const weekday = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'][now.getDay()];
  const dateStr = now.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const kw = `KW ${isoWeekNum(now)}`;
  const today = todayIso();

  const personaById = (id: string | null | undefined) => {
    if (!id) return undefined;
    const u = users.find((x) => x.id === id);
    if (!u) return undefined;
    const initials = (u.name || u.email).slice(0, 2).toUpperCase();
    return { id: initials, full: u.name, color: u.color, image: u.image };
  };
  const projectById = (id: string | null) => (id ? projects.find((p) => p.id === id) : undefined);

  // Renderer für Avatar-Bereich in TV-Rows — wenn ein Profilbild hochgeladen
  // ist, zeigen wir es. Sonst die Initialen mit Akzent-Farbe als Fallback.
  // Größen: regular 26px, small 20px (synchron zu CSS-Klassen tv-row-avatar).
  function renderAvatar(p: ReturnType<typeof personaById>, opts: { sm?: boolean; tone?: string } = {}) {
    const cls = opts.sm ? 'tv-row-avatar sm' : 'tv-row-avatar';
    if (p?.image) {
      return (
        <span className={`${cls} has-image`} title={p.full}>
          <img src={p.image} alt={p.full} />
        </span>
      );
    }
    return (
      <div
        className={cls}
        style={{ background: opts.tone ?? 'var(--accent-500)' }}
        title={p?.full}
      >
        {p?.id ?? '??'}
      </div>
    );
  }

  // ── Sichtbarkeits-Filter: keine Privat-Projekte auf TV ────────────────
  const privateProjectIds = useMemo(
    () => new Set(projects.filter((p) => !!p.privateOwnerId).map((p) => p.id)),
    [projects],
  );
  const publicTasks = useMemo(
    () => tasks.filter((t) => !t.proj || !privateProjectIds.has(t.proj)),
    [tasks, privateProjectIds],
  );

  // ── Bucketing ─────────────────────────────────────────────────────────
  const inProgress = publicTasks.filter((t) => t.col === 'doing');

  // Heute fällig + Überfällig zusammen, überfällige zuerst und absteigend
  // (am ältesten ganz oben), heutige danach.
  const dueAndOverdue: Array<Task & { _overdue?: boolean }> = useMemo(() => {
    const due = publicTasks
      .filter((t) => t.col !== 'done' && (isDueToday(t.due, today) || isOverdue(t.due, today)))
      .map((t) => ({ ...t, _overdue: isOverdue(t.due, today) }));
    return due.sort((a, b) => {
      // Überfällige zuerst, danach nach Datum aufsteigend (älteste Überfälligkeit ganz oben)
      if (a._overdue && !b._overdue) return -1;
      if (!a._overdue && b._overdue) return 1;
      const da = a.due ?? '';
      const db = b.due ?? '';
      return da < db ? -1 : da > db ? 1 : 0;
    });
  }, [publicTasks, today]);

  const overdueCount = dueAndOverdue.filter((t) => t._overdue).length;

  const inReview = publicTasks.filter((t) => t.col === 'review');
  // Heute-erledigt-Bucket entfernt — Platz reserviert für künftige Kalender-Ansicht
  // (Feedback FqJLc2Cel2Y, 2026-05-11).

  // Stats (ebenfalls nur öffentliche Aufgaben)
  const totalEst = publicTasks.reduce((a, t) => a + (t.estH || 0), 0);
  const totalLogged = publicTasks.reduce((a, t) => a + (t.loggedH || 0), 0);
  const weekPct = totalEst ? Math.min(100, Math.round((totalLogged / totalEst) * 100)) : 0;

  const liveTaskId = timer?.taskId;
  const liveElapsed = timer ? Date.now() - timer.startedAt : 0;

  // Paginierung pro Bucket
  const progressPaged = usePagedRotation(inProgress, PAGE_SIZE);
  const duePaged = usePagedRotation(dueAndOverdue, PAGE_SIZE);
  const reviewPaged = usePagedRotation(inReview, PAGE_SIZE);

  const PageBadge = ({ pageIndex, pageCount }: { pageIndex: number; pageCount: number }) =>
    pageCount > 1 ? (
      <span className="tv-page-badge">
        {pageIndex + 1}/{pageCount}
      </span>
    ) : null;

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
            <PageBadge pageIndex={progressPaged.pageIndex} pageCount={progressPaged.pageCount} />
            <div className="tv-col-count">{inProgress.length}</div>
          </div>
          <div className="tv-list">
            {inProgress.length === 0 && <div className="tv-empty">Niemand arbeitet gerade aktiv.</div>}
            {progressPaged.page.map((t) => {
              const p = personaById(t.who);
              const proj = projectById(t.proj);
              const isLive = liveTaskId === t.id;
              const pct = t.estH ? Math.min(100, Math.round((t.loggedH / t.estH) * 100)) : 0;
              return (
                <div key={t.id} className={`tv-row ${isLive ? 'is-live' : ''}`}>
                  {renderAvatar(p)}
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

        {/* Heute fällig (inkl. Überfällig) */}
        <section className="tv-col tv-col-due">
          <div className="tv-col-head">
            <div className="tv-col-eyebrow">Frist</div>
            <h2>Heute fällig {overdueCount > 0 && <span className="tv-head-sub">· {overdueCount} überfällig</span>}</h2>
            <PageBadge pageIndex={duePaged.pageIndex} pageCount={duePaged.pageCount} />
            <div className="tv-col-count">{dueAndOverdue.length}</div>
          </div>
          <div className="tv-list">
            {dueAndOverdue.length === 0 && <div className="tv-empty">Keine offenen Fristen.</div>}
            {duePaged.page.map((t) => {
              const p = personaById(t.who);
              const proj = projectById(t.proj);
              const statusLabel =
                ({ todo: 'Backlog', planned: 'Geplant', doing: 'In Arbeit', review: 'Review' } as Record<string, string>)[
                  t.col
                ] || t.col;
              return (
                <div key={t.id} className={`tv-row tv-row-due status-${t.col} ${t._overdue ? 'is-overdue' : ''}`}>
                  <div className={`tv-due-flag ${t._overdue ? 'is-overdue' : ''}`}>
                    <Icon name="alarm-clock" size={16} />
                  </div>
                  <div className="tv-row-title">{t.title}</div>
                  <div className="tv-row-trail">
                    <span className="tv-chip" style={{ borderColor: proj?.color, color: proj?.color }}>
                      {proj?.code || '—'}
                    </span>
                    {t._overdue && <span className="tv-overdue-pill">Überfällig</span>}
                    <span className={`tv-status-pill status-${t.col}`}>{statusLabel}</span>
                    {t.prio === 'high' && <span className="tv-prio-pill">Hoch</span>}
                    {renderAvatar(p, { sm: true })}
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
            <PageBadge pageIndex={reviewPaged.pageIndex} pageCount={reviewPaged.pageCount} />
            <div className="tv-col-count">{inReview.length}</div>
          </div>
          <div className="tv-list">
            {inReview.length === 0 && <div className="tv-empty">Nichts im Review-Stapel.</div>}
            {reviewPaged.page.map((t) => {
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
                    {isDueToday(t.due, today) && <span className="tv-due-tag">heute fällig</span>}
                    {isOverdue(t.due, today) && <span className="tv-overdue-pill">Überfällig</span>}
                    <span className="tv-row-progmeta">{t.loggedH.toFixed(1)}h</span>
                    {renderAvatar(p, { sm: true })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Platzhalter für künftige Kalender-Ansicht (siehe Feedback FqJLc2Cel2Y).
            Wir behalten die Grid-Zelle und das visuelle Frame, damit das Layout
            ausgewogen bleibt und User schon mal sehen wo es hin will. */}
        <section className="tv-col tv-col-calendar tv-col-placeholder">
          <div className="tv-col-head">
            <div className="tv-col-eyebrow">Ausblick</div>
            <h2>Kalender</h2>
            <span className="tv-page-badge">bald</span>
          </div>
          <div className="tv-list">
            <div className="tv-placeholder">
              <Icon name="calendar-days" size={36} />
              <div className="tv-placeholder-title">Tages- &amp; Wochenkalender</div>
              <div className="tv-placeholder-sub">Termine, Fristen und Sessions auf einen Blick — kommt in einem der nächsten Releases.</div>
            </div>
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
          <div className="tv-foot-val">{dueAndOverdue.length}</div>
        </div>
        <div className="tv-foot-stat">
          <div className="tv-foot-label">Im Review</div>
          <div className="tv-foot-val">{inReview.length}</div>
        </div>

        <div className="tv-foot-bar">
          <div className="tv-foot-bar-head">
            <span>{kw} Fortschritt</span>
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
