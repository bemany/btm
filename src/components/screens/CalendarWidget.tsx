// Calendar-Widget auf „Meine Woche". Zeigt eigene Termine für Heute + Morgen.
//
// Features (Feature FFvSseD4n_R):
//   • „Next Up"-Karte oben mit Live-Countdown („in 1h 23 Min")
//   • „Jetzt"-Linie zwischen Vergangenheit und Zukunft in der Heute-Liste
//   • Vergangene Events ausgegraut
//   • Toggle Liste ↔ Timeline (vertikale Stunden-Skala mit Event-Blocks)
//
// Datenquellen:
//   • /api/calendar/my Window [today 00:00, day-after-tomorrow 00:00)
//   • Auth-Context für odooSyncEnabled-Flag → Banner wenn Sync inaktiv
// Refetch: 5 min Server-Sync-Rhythmus, plus useTick(1s) für Countdown-UI.

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext';
import { Icon } from '../shared/Icon';
import { useTick } from '../shared/hooks';
import { useT, useLocale } from '../../i18n';
import * as api from '../../data/api';
import type { CalendarEventDTO } from '../../data/api';
import { SYNC_KEYS } from '../../data/sync';

const VIEW_STORAGE_KEY = 'btm.calendarWidgetView';
const TIMELINE_START_HOUR = 7;
const TIMELINE_END_HOUR = 20;
const TIMELINE_HOURS = TIMELINE_END_HOUR - TIMELINE_START_HOUR;
const HOUR_PX = 44; // Höhe pro Stunde in der Timeline

type ViewMode = 'list' | 'timeline';

export interface CalendarWidgetProps {
  onOpenSettings?: () => void;
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}
function fmtTime(iso: string, locale: 'de' | 'en'): string {
  return new Date(iso).toLocaleTimeString(locale === 'en' ? 'en-US' : 'de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: locale === 'en',
  });
}
function fmtRange(startIso: string, endIso: string, allDay: boolean, locale: 'de' | 'en', allDayLabel: string): string {
  if (allDay) return allDayLabel;
  return `${fmtTime(startIso, locale)}–${fmtTime(endIso, locale)}`;
}

// Mache aus Millisekunden einen lesbaren Countdown-String wie „in 1h 23 Min" /
// „in 12 Min" / „jetzt" / „läuft (noch 23 Min)".
function fmtCountdown(diffMs: number, locale: 'de' | 'en'): string {
  if (diffMs <= 0) return locale === 'en' ? 'now' : 'jetzt';
  const totalMin = Math.floor(diffMs / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (locale === 'en') {
    if (h > 0) return `in ${h}h ${m}m`;
    return `in ${m}m`;
  }
  if (h > 0) return `in ${h} Std ${m} Min`;
  return `in ${m} Min`;
}

function loadView(): ViewMode {
  try {
    return localStorage.getItem(VIEW_STORAGE_KEY) === 'timeline' ? 'timeline' : 'list';
  } catch {
    return 'list';
  }
}

export function CalendarWidget({ onOpenSettings }: CalendarWidgetProps) {
  const t = useT();
  const [locale] = useLocale();
  const { user } = useAuth();
  const syncEnabled = !!user?.odooSyncEnabled;

  // 1s-Tick damit Countdown + Jetzt-Linie live aktualisieren
  useTick(syncEnabled);

  const [view, setView] = useState<ViewMode>(loadView);
  useEffect(() => {
    try { localStorage.setItem(VIEW_STORAGE_KEY, view); } catch { /* ignore */ }
  }, [view]);

  const now = new Date();
  const today = useMemo(() => startOfDay(new Date()), []);
  const tomorrow = useMemo(() => {
    const d = new Date(today); d.setDate(d.getDate() + 1); return d;
  }, [today]);
  const dayAfterTomorrow = useMemo(() => {
    const d = new Date(today); d.setDate(d.getDate() + 2); return d;
  }, [today]);

  const { data: events = [], isLoading } = useQuery({
    queryKey: [...SYNC_KEYS.CALENDAR_MY, today.toISOString()],
    queryFn: () => api.listMyCalendar({ from: today.toISOString(), to: dayAfterTomorrow.toISOString() }),
    enabled: syncEnabled,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: true,
  });

  // Gruppen + sortiert
  const { todayEvents, tomorrowEvents } = useMemo(() => {
    const todayList: CalendarEventDTO[] = [];
    const tomorrowList: CalendarEventDTO[] = [];
    for (const ev of events) {
      const startMs = new Date(ev.startAt).getTime();
      if (startMs < tomorrow.getTime()) todayList.push(ev);
      else if (startMs < dayAfterTomorrow.getTime()) tomorrowList.push(ev);
    }
    todayList.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    tomorrowList.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    return { todayEvents: todayList, tomorrowEvents: tomorrowList };
  }, [events, tomorrow, dayAfterTomorrow]);

  // „Next Up": ongoing > upcoming-today > upcoming-tomorrow
  const nextUp = useMemo(() => {
    const nowMs = now.getTime();
    const ongoing = todayEvents.find((ev) => {
      const s = new Date(ev.startAt).getTime();
      const e = new Date(ev.endAt).getTime();
      return s <= nowMs && nowMs < e;
    });
    if (ongoing) return { event: ongoing, ongoing: true };
    const upcomingToday = todayEvents.find((ev) => new Date(ev.startAt).getTime() > nowMs);
    if (upcomingToday) return { event: upcomingToday, ongoing: false };
    const tomorrowFirst = tomorrowEvents[0];
    if (tomorrowFirst) return { event: tomorrowFirst, ongoing: false };
    return null;
  }, [todayEvents, tomorrowEvents, now]);

  if (!syncEnabled) {
    return (
      <div className="cal-widget cal-widget-inactive">
        <div className="cal-widget-head">
          <Icon name="calendar" size={14} />
          <h3>{t('calendar.widget_heading')}</h3>
        </div>
        <div className="cal-widget-banner">
          <Icon name="info" size={14} />
          <span>{t('calendar.not_configured')}</span>
          {onOpenSettings && (
            <button type="button" className="cal-banner-btn" onClick={onOpenSettings}>
              {t('calendar.open_settings')}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="cal-widget">
      <div className="cal-widget-head">
        <Icon name="calendar" size={14} />
        <h3>{t('calendar.widget_heading')}</h3>
        <div style={{ flex: 1 }} />
        <div className="cal-view-toggle">
          {(['list', 'timeline'] as const).map((v) => (
            <button
              key={v}
              type="button"
              className={view === v ? 'is-active' : ''}
              onClick={() => setView(v)}
              title={t(v === 'list' ? 'calendar.view_list' : 'calendar.view_timeline')}
            >
              <Icon name={v === 'list' ? 'list' : 'calendar-clock'} size={11} />
              {t(v === 'list' ? 'calendar.view_list' : 'calendar.view_timeline')}
            </button>
          ))}
        </div>
      </div>

      {nextUp && <NextUpCard nextUp={nextUp} now={now} locale={locale} />}

      {view === 'list' ? (
        <div className="cal-widget-grid">
          <CalendarSection
            eyebrow={t('calendar.today')}
            events={todayEvents}
            empty={t('calendar.empty_today')}
            locale={locale}
            isLoading={isLoading}
            now={now}
            showNowLine
          />
          <CalendarSection
            eyebrow={t('calendar.tomorrow')}
            events={tomorrowEvents}
            empty={t('calendar.empty_tomorrow')}
            locale={locale}
            isLoading={isLoading}
            now={now}
          />
        </div>
      ) : (
        <div className="cal-widget-grid">
          <TimelineSection
            eyebrow={t('calendar.today')}
            events={todayEvents}
            empty={t('calendar.empty_today')}
            locale={locale}
            now={now}
            showNowLine
            tEnv={t}
          />
          <TimelineSection
            eyebrow={t('calendar.tomorrow')}
            events={tomorrowEvents}
            empty={t('calendar.empty_tomorrow')}
            locale={locale}
            now={now}
            tEnv={t}
          />
        </div>
      )}
    </div>
  );
}

// ── Next-Up-Karte ─────────────────────────────────────────────────────
interface NextUpProps {
  nextUp: { event: CalendarEventDTO; ongoing: boolean };
  now: Date;
  locale: 'de' | 'en';
}
function NextUpCard({ nextUp, now, locale }: NextUpProps) {
  const t = useT();
  const ev = nextUp.event;
  const start = new Date(ev.startAt);
  const end = new Date(ev.endAt);
  const isTomorrow = start.getDate() !== now.getDate();
  const diffMs = nextUp.ongoing ? end.getTime() - now.getTime() : start.getTime() - now.getTime();
  const countdownText = nextUp.ongoing
    ? t('calendar.nextup_ongoing_remaining', { rel: fmtCountdown(diffMs, locale).replace(/^in /, '') })
    : fmtCountdown(diffMs, locale);

  return (
    <div className={`cal-nextup ${nextUp.ongoing ? 'is-ongoing' : ''}`}>
      <div className="cal-nextup-eyebrow">
        <Icon name={nextUp.ongoing ? 'play-circle' : 'clock'} size={12} />
        {nextUp.ongoing ? t('calendar.nextup_now_label') : t('calendar.nextup_next_label')}
      </div>
      <div className="cal-nextup-body">
        <div className="cal-nextup-title">{ev.title}</div>
        <div className="cal-nextup-meta">
          <span className="cal-nextup-time">{fmtRange(ev.startAt, ev.endAt, ev.allDay, locale, t('calendar.all_day'))}</span>
          {isTomorrow && <span className="cal-nextup-day">{t('calendar.tomorrow')}</span>}
          {ev.location && <span className="cal-nextup-loc"><Icon name="map-pin" size={10} /> {ev.location}</span>}
        </div>
      </div>
      <div className="cal-nextup-countdown">{countdownText}</div>
    </div>
  );
}

// ── List-Section (mit Now-Line + ausgegrauten Past-Events) ─────────────
interface ListSectionProps {
  eyebrow: string;
  events: CalendarEventDTO[];
  empty: string;
  locale: 'de' | 'en';
  isLoading: boolean;
  now: Date;
  showNowLine?: boolean;
}
function CalendarSection({ eyebrow, events, empty, locale, isLoading, now, showNowLine }: ListSectionProps) {
  const t = useT();
  const nowMs = now.getTime();
  // Index nach dem die Now-Linie eingefügt wird = Anzahl bereits beendeter
  // Events (Vergangene Reihen werden ausgegraut)
  const nowLineIndex = useMemo(
    () => events.findIndex((ev) => new Date(ev.endAt).getTime() > nowMs),
    [events, nowMs],
  );

  return (
    <section className="cal-section">
      <div className="cal-section-head">{eyebrow}</div>
      {isLoading && events.length === 0 ? (
        <div className="cal-empty dim">{t('common.loading')}</div>
      ) : events.length === 0 ? (
        <div className="cal-empty">{empty}</div>
      ) : (
        <ul className="cal-event-list">
          {events.map((ev, idx) => {
            const past = new Date(ev.endAt).getTime() <= nowMs;
            const ongoing = !past && new Date(ev.startAt).getTime() <= nowMs;
            return (
              <span key={ev.id}>
                {showNowLine && idx === nowLineIndex && nowLineIndex > 0 && (
                  <li className="cal-now-line" aria-hidden>
                    <span>{t('calendar.now_label')} · {fmtTime(now.toISOString(), locale)}</span>
                  </li>
                )}
                <li className={`cal-event-row ${past ? 'is-past' : ''} ${ongoing ? 'is-ongoing' : ''}`}>
                  <span className="cal-time-pill">{fmtRange(ev.startAt, ev.endAt, ev.allDay, locale, t('calendar.all_day'))}</span>
                  <div className="cal-event-body">
                    <div className="cal-event-title">{ev.title}</div>
                    {(ev.location || ev.attendeeCount > 1) && (
                      <div className="cal-event-meta">
                        {ev.location && <span><Icon name="map-pin" size={10} /> {ev.location}</span>}
                        {ev.attendeeCount > 1 && (
                          <span><Icon name="users" size={10} /> {t('calendar.attendees', { count: ev.attendeeCount })}</span>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              </span>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ── Timeline-Section (vertikale Stunden mit Event-Blocks) ─────────────
interface TimelineProps {
  eyebrow: string;
  events: CalendarEventDTO[];
  empty: string;
  locale: 'de' | 'en';
  now: Date;
  showNowLine?: boolean;
  tEnv: ReturnType<typeof useT>;
}
function TimelineSection({ eyebrow, events, empty, locale, now, showNowLine, tEnv }: TimelineProps) {
  // Konvertiere ein Date in Y-Pixel-Position relativ zu TIMELINE_START_HOUR.
  const dayStart = startOfDay(now);
  // Wenn die Section "Morgen" ist, ist der Anker der morgige Tagesanfang
  const refDayStart = events.length > 0
    ? startOfDay(new Date(events[0].startAt))
    : dayStart;
  const isToday = refDayStart.getTime() === dayStart.getTime();

  const dateToY = (d: Date): number => {
    const minutesSinceStart =
      (d.getTime() - refDayStart.getTime()) / 60_000 - TIMELINE_START_HOUR * 60;
    return (minutesSinceStart / 60) * HOUR_PX;
  };

  const totalHeight = TIMELINE_HOURS * HOUR_PX;
  const nowY = isToday ? dateToY(now) : -1;
  const isAllDayList = events.filter((e) => e.allDay);
  const isTimedList = events.filter((e) => !e.allDay);

  return (
    <section className="cal-section">
      <div className="cal-section-head">{eyebrow}</div>
      {events.length === 0 ? (
        <div className="cal-empty">{empty}</div>
      ) : (
        <>
          {isAllDayList.length > 0 && (
            <div className="cal-allday-row">
              {isAllDayList.map((ev) => (
                <span key={ev.id} className="cal-allday-chip">
                  <Icon name="sun" size={10} /> {ev.title}
                </span>
              ))}
            </div>
          )}
          <div className="cal-timeline" style={{ height: totalHeight }}>
            {Array.from({ length: TIMELINE_HOURS + 1 }).map((_, i) => {
              const hour = TIMELINE_START_HOUR + i;
              return (
                <div key={hour} className="cal-timeline-hour" style={{ top: i * HOUR_PX }}>
                  <span className="cal-timeline-hour-label">
                    {String(hour).padStart(2, '0')}:00
                  </span>
                  <span className="cal-timeline-hour-line" />
                </div>
              );
            })}
            {isTimedList.map((ev) => {
              const start = new Date(ev.startAt);
              const end = new Date(ev.endAt);
              const top = Math.max(0, dateToY(start));
              const bottom = Math.min(totalHeight, dateToY(end));
              const height = Math.max(20, bottom - top);
              const past = end.getTime() <= now.getTime();
              const ongoing = !past && start.getTime() <= now.getTime();
              return (
                <div
                  key={ev.id}
                  className={`cal-timeline-event ${past ? 'is-past' : ''} ${ongoing ? 'is-ongoing' : ''}`}
                  style={{ top, height }}
                  title={`${fmtTime(ev.startAt, locale)} – ${fmtTime(ev.endAt, locale)} · ${ev.title}`}
                >
                  <span className="cal-timeline-event-time">
                    {fmtTime(ev.startAt, locale)}
                  </span>
                  <span className="cal-timeline-event-title">{ev.title}</span>
                </div>
              );
            })}
            {showNowLine && nowY >= 0 && nowY <= totalHeight && (
              <div className="cal-timeline-now" style={{ top: nowY }} aria-hidden>
                <span className="cal-timeline-now-dot" />
                <span className="cal-timeline-now-line" />
                <span className="cal-timeline-now-label">{fmtTime(now.toISOString(), locale)}</span>
              </div>
            )}
          </div>
        </>
      )}
      <span style={{ display: 'none' }}>{tEnv('calendar.all_day')}</span>
    </section>
  );
}
