// Calendar-Widget auf „Meine Woche". Zeigt eigene Termine für Heute + Morgen.
//
// Quellen:
//   • /api/calendar/my mit Window [today 00:00, day-after-tomorrow 00:00)
//   • Auth-Context für odooSyncEnabled-Flag → Banner wenn Sync inaktiv
//
// Optimierung: refetchInterval = 5 min, gleicher Rhythmus wie Server-Sync.

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext';
import { Icon } from '../shared/Icon';
import { useT, useLocale } from '../../i18n';
import * as api from '../../data/api';
import type { CalendarEventDTO } from '../../data/api';
import { SYNC_KEYS } from '../../data/sync';

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

export function CalendarWidget({ onOpenSettings }: CalendarWidgetProps) {
  const t = useT();
  const [locale] = useLocale();
  const { user } = useAuth();

  const syncEnabled = !!user?.odooSyncEnabled;

  const today = useMemo(() => startOfDay(new Date()), []);
  const tomorrow = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return d;
  }, [today]);
  const dayAfterTomorrow = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 2);
    return d;
  }, [today]);

  const { data: events = [], isLoading } = useQuery({
    queryKey: [...SYNC_KEYS.CALENDAR_MY, today.toISOString()],
    queryFn: () => api.listMyCalendar({ from: today.toISOString(), to: dayAfterTomorrow.toISOString() }),
    enabled: syncEnabled,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: true,
  });

  // Gruppen
  const { todayEvents, tomorrowEvents } = useMemo(() => {
    const todayList: CalendarEventDTO[] = [];
    const tomorrowList: CalendarEventDTO[] = [];
    for (const ev of events) {
      const startMs = new Date(ev.startAt).getTime();
      if (startMs < tomorrow.getTime()) todayList.push(ev);
      else if (startMs < dayAfterTomorrow.getTime()) tomorrowList.push(ev);
    }
    return { todayEvents: todayList, tomorrowEvents: tomorrowList };
  }, [events, tomorrow, dayAfterTomorrow]);

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
      </div>
      <div className="cal-widget-grid">
        <CalendarSection
          eyebrow={t('calendar.today')}
          events={todayEvents}
          empty={t('calendar.empty_today')}
          locale={locale}
          isLoading={isLoading}
        />
        <CalendarSection
          eyebrow={t('calendar.tomorrow')}
          events={tomorrowEvents}
          empty={t('calendar.empty_tomorrow')}
          locale={locale}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}

interface SectionProps {
  eyebrow: string;
  events: CalendarEventDTO[];
  empty: string;
  locale: 'de' | 'en';
  isLoading: boolean;
}

function CalendarSection({ eyebrow, events, empty, locale, isLoading }: SectionProps) {
  const t = useT();
  return (
    <section className="cal-section">
      <div className="cal-section-head">{eyebrow}</div>
      {isLoading && events.length === 0 ? (
        <div className="cal-empty dim">{t('common.loading')}</div>
      ) : events.length === 0 ? (
        <div className="cal-empty">{empty}</div>
      ) : (
        <ul className="cal-event-list">
          {events.map((ev) => (
            <li key={ev.id} className="cal-event-row">
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
          ))}
        </ul>
      )}
    </section>
  );
}
