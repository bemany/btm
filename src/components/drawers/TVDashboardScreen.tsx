import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStore } from '../../store/store';
import { useTick } from '../shared/hooks';
import { Icon } from '../shared/Icon';
import { fmtHMS } from '../../lib/format';
import type { Task } from '../../store/types';
import * as api from '../../data/api';
import type { CalendarEventDTO } from '../../data/api';
import { APP_FULL_NAME } from '../../lib/brand';

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

  // ── Alle aktiven Live-Timer (FQJzGtjPqc-) ─────────────────────────────
  // Damit Aufgaben, auf die jemand gerade Zeit trackt, auch dann auf dem
  // TV-Dashboard erscheinen, wenn sie noch in Backlog / Geplant stehen.
  const liveTimersQ = useQuery({
    queryKey: ['btm', 'tv', 'live-timers'],
    queryFn: api.listAllLiveTimers,
    staleTime: 5_000,
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  });
  const allLiveTimers = liveTimersQ.data ?? [];
  // Map: taskId → {userId, startedAt} für schnellen Lookup beim Rendering
  const liveTimerByTaskId = useMemo(() => {
    const m = new Map<string, { userId: string; startedAt: Date }>();
    for (const lt of allLiveTimers) {
      m.set(lt.taskId, { userId: lt.userId, startedAt: new Date(lt.startedAt) });
    }
    return m;
  }, [allLiveTimers]);

  // ── Bucketing ─────────────────────────────────────────────────────────
  // In Arbeit = alle Tasks in der "doing"-Spalte + alle Tasks (egal welche Spalte)
  // auf die gerade ein Live-Timer läuft. Doppelte ID-Filterung am Ende.
  const doingTasks = publicTasks.filter((t) => t.col === 'doing');
  const trackedOutsideDoing = publicTasks.filter(
    (t) => t.col !== 'doing' && liveTimerByTaskId.has(t.id),
  );
  const inProgress = useMemo(() => {
    const seen = new Set<string>();
    const out: typeof publicTasks = [];
    // Live-Timer-Tasks zuerst (auch die aus anderen Spalten)
    for (const t of trackedOutsideDoing) {
      if (!seen.has(t.id)) { seen.add(t.id); out.push(t); }
    }
    for (const t of doingTasks) {
      if (!seen.has(t.id)) { seen.add(t.id); out.push(t); }
    }
    return out;
  }, [doingTasks, trackedOutsideDoing]);

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

  // ── Team-Kalender (Odoo) ──────────────────────────────────────────────
  // Holt alle Events aller User mit aktivem Sync für heute.
  // Refetch 5 Min — gleicher Rhythmus wie Server-Sync.
  const calendarStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, [today]); // today als string, ändert sich nur bei Datums-Wechsel
  const calendarEnd = useMemo(() => {
    const d = new Date(calendarStart);
    d.setDate(d.getDate() + 1);
    return d;
  }, [calendarStart]);
  const calendarQ = useQuery({
    queryKey: ['btm', 'tv', 'calendar', today],
    queryFn: () => api.listAllCalendar({ from: calendarStart.toISOString(), to: calendarEnd.toISOString() }),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: true,
    retry: 5,
    retryDelay: (i) => Math.min(1000 * 2 ** i, 30_000),
  });
  const calendarEventsRaw: CalendarEventDTO[] = calendarQ.data ?? [];
  // FNl4YW89vBX: Doppelte Termine konsolidieren — wenn mehrere User im
  // gleichen Termin sind, kommt jeder mit seinem eigenen Event-Eintrag.
  // Wir gruppieren nach Titel + Zeitraum + Location und sammeln alle
  // Teilnehmer in einem Array.
  type AggregatedEvent = CalendarEventDTO & {
    attendees: Array<{ userId: string; userName?: string; userImage?: string | null; userColor?: string }>;
  };
  const calendarEvents: AggregatedEvent[] = useMemo(() => {
    const groupKey = (ev: CalendarEventDTO) =>
      `${ev.title}|${ev.startAt}|${ev.endAt}|${ev.location ?? ''}|${ev.allDay ? '1' : '0'}`;
    const groups = new Map<string, AggregatedEvent>();
    for (const ev of calendarEventsRaw) {
      const key = groupKey(ev);
      const existing = groups.get(key);
      const attendee = {
        userId: ev.userId,
        userName: ev.userName,
        userImage: ev.userImage,
        userColor: ev.userColor,
      };
      if (existing) {
        if (!existing.attendees.some((a) => a.userId === attendee.userId)) {
          existing.attendees.push(attendee);
        }
      } else {
        groups.set(key, { ...ev, attendees: [attendee] });
      }
    }
    return Array.from(groups.values()).sort((a, b) => a.startAt.localeCompare(b.startAt));
  }, [calendarEventsRaw]);
  const calendarPaged = usePagedRotation(calendarEvents, PAGE_SIZE);

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
              <div className="tv-brand-sub">{APP_FULL_NAME}</div>
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
              // Live-Timer-Info ermitteln — entweder eigener Timer oder
              // ein Timer von einem anderen User (FQJzGtjPqc-)
              const liveInfo = liveTimerByTaskId.get(t.id);
              // Wer trackt? Bei Live-Timern den User des Timers nehmen,
              // sonst den eingetragenen Assignee
              const trackerId = liveInfo?.userId ?? t.who;
              const p = personaById(trackerId);
              const proj = projectById(t.proj);
              const isLive = !!liveInfo;
              const isOwnTimer = liveTaskId === t.id;
              const elapsedMs = liveInfo
                ? Date.now() - liveInfo.startedAt.getTime()
                : isOwnTimer
                  ? liveElapsed
                  : 0;
              const pct = t.estH ? Math.min(100, Math.round((t.loggedH / t.estH) * 100)) : 0;
              const colLabel: Record<string, string> = {
                todo: 'Backlog',
                planned: 'Geplant',
                doing: 'In Arbeit',
                review: 'Review',
              };
              const showStatus = t.col !== 'doing';
              return (
                <div key={t.id} className={`tv-row ${isLive ? 'is-live' : ''}`}>
                  {renderAvatar(p)}
                  <div className="tv-row-title">{t.title}</div>
                  <div className="tv-row-trail">
                    <span className="tv-chip" style={{ borderColor: proj?.color, color: proj?.color }}>
                      {proj?.code || '—'}
                    </span>
                    {showStatus && (
                      <span className={`tv-status-pill status-${t.col}`}>{colLabel[t.col] ?? t.col}</span>
                    )}
                    {isLive && (
                      <span className="tv-live-pill">
                        <span className="tv-live-dot" />
                        {fmtHMS(elapsedMs)}
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

        {/* Team-Kalender — alle Termine aller User mit aktivem Odoo-Sync für heute. */}
        <section className="tv-col tv-col-calendar">
          <div className="tv-col-head">
            <div className="tv-col-eyebrow">Heute</div>
            <h2>Kalender</h2>
            <PageBadge pageIndex={calendarPaged.pageIndex} pageCount={calendarPaged.pageCount} />
            <div className="tv-col-count">{calendarEvents.length}</div>
          </div>
          <div className="tv-list">
            {calendarEvents.length === 0 && (
              <div className="tv-empty">Heute keine Termine im Team.</div>
            )}
            {calendarPaged.page.map((ev) => {
              const startTime = new Date(ev.startAt).toLocaleTimeString('de-DE', {
                hour: '2-digit',
                minute: '2-digit',
              });
              const endTime = new Date(ev.endAt).toLocaleTimeString('de-DE', {
                hour: '2-digit',
                minute: '2-digit',
              });
              const timeLabel = ev.allDay ? 'Ganztägig' : `${startTime}–${endTime}`;
              return (
                <div key={ev.id} className="tv-row tv-cal-row">
                  <span className="tv-cal-time">{timeLabel}</span>
                  <div className="tv-row-title">{ev.title}</div>
                  <div className="tv-row-trail">
                    {ev.location && (
                      <span className="tv-cal-location" title={ev.location}>
                        <Icon name="map-pin" size={10} /> {ev.location.length > 20 ? ev.location.slice(0, 20) + '…' : ev.location}
                      </span>
                    )}
                    {/* FNl4YW89vBX: gestapelte Avatare aller Teilnehmer */}
                    <div className="tv-cal-attendees">
                      {ev.attendees.slice(0, 4).map((a) => {
                        const init = (a.userName ?? '??').slice(0, 2).toUpperCase();
                        return a.userImage ? (
                          <span key={a.userId} className="tv-row-avatar sm has-image" title={a.userName}>
                            <img src={a.userImage} alt={a.userName ?? ''} />
                          </span>
                        ) : (
                          <div
                            key={a.userId}
                            className="tv-row-avatar sm"
                            style={{ background: a.userColor ?? '#6B6359' }}
                            title={a.userName}
                          >
                            {init}
                          </div>
                        );
                      })}
                      {ev.attendees.length > 4 && (
                        <div className="tv-row-avatar sm tv-cal-attendee-more" title={`+${ev.attendees.length - 4}`}>
                          +{ev.attendees.length - 4}
                        </div>
                      )}
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
