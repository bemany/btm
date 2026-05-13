// iCal-Feed-Client: lädt eine .ical/.ics-URL und expandiert Events
// (inkl. RRULE-Recurring) ins gegebene Date-Window.
//
// Nutzt ical.js (Mozilla), die standard-konforme iCalendar-Parser-Library
// mit RecurExpansion-Support für wiederkehrende Termine.

import ICAL from 'ical.js';

const FETCH_TIMEOUT_MS = 15_000;
const MAX_BODY_BYTES = 8 * 1024 * 1024; // 8 MB sollte für die meisten iCal-Feeds reichen
const MAX_OCCURRENCES_PER_EVENT = 200;   // sichert gegen Endlos-RRULE (DAILY ohne UNTIL)

export interface IcalEvent {
  uid: string;
  title: string;
  location: string | null;
  description: string | null;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  attendeeCount: number;
  organizerName: string | null;
}

export class IcalError extends Error {
  code: 'fetch_failed' | 'parse_failed' | 'http_404' | 'http_401' | 'http_403' | 'http_error' | 'too_large';
  details?: unknown;
  constructor(code: IcalError['code'], message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

async function fetchFeed(url: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    // Manche Provider geben .ical mit webcal:// — auf https umbiegen
    const httpUrl = url.replace(/^webcal:\/\//i, 'https://');
    res = await fetch(httpUrl, {
      signal: ctrl.signal,
      headers: { Accept: 'text/calendar, application/calendar+json, text/plain;q=0.9, */*;q=0.5' },
      redirect: 'follow',
    });
  } catch (e) {
    throw new IcalError('fetch_failed', `Fetch failed: ${(e as Error).message}`, e);
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    // Auth-/Not-Found-Fehler explizit klassifizieren — bei Google Calendar
    // bedeutet 404 meist „Kalender nicht public, falsche URL", 401/403 ist
    // „nicht freigegeben". Der Frontend-Tab kann darauf reagieren.
    if (res.status === 404) {
      throw new IcalError('http_404', 'Calendar not found (404)', { status: 404 });
    }
    if (res.status === 401) {
      throw new IcalError('http_401', 'Unauthorized (401)', { status: 401 });
    }
    if (res.status === 403) {
      throw new IcalError('http_403', 'Forbidden (403)', { status: 403 });
    }
    throw new IcalError('http_error', `HTTP ${res.status}`, { status: res.status });
  }
  // Body als Stream lesen mit Size-Cap
  const reader = res.body?.getReader();
  if (!reader) {
    throw new IcalError('fetch_failed', 'No response body');
  }
  const decoder = new TextDecoder();
  let total = 0;
  let body = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        throw new IcalError('too_large', `Feed >${MAX_BODY_BYTES} bytes`);
      }
      body += decoder.decode(value, { stream: true });
    }
  }
  body += decoder.decode();
  return body;
}

/**
 * Holt einen iCal-Feed und expandiert alle Events ins Window [from, to).
 * Recurring-Events werden über ICAL.RecurExpansion expandiert.
 */
export async function fetchIcalEvents(url: string, from: Date, to: Date): Promise<IcalEvent[]> {
  const raw = await fetchFeed(url);
  let comp: ICAL.Component;
  try {
    const jcal = ICAL.parse(raw);
    comp = new ICAL.Component(jcal);
  } catch (e) {
    throw new IcalError('parse_failed', `iCal parse failed: ${(e as Error).message}`, e);
  }
  const vevents = comp.getAllSubcomponents('vevent');
  const out: IcalEvent[] = [];

  for (const ve of vevents) {
    try {
      const ev = new ICAL.Event(ve);
      const uid = ev.uid || `${ve.getFirstPropertyValue('summary')}-${ev.startDate?.toString()}`;
      const title = ev.summary || '(no title)';
      const asStr = (v: unknown): string | null => {
        if (typeof v === 'string' && v) return v;
        if (Array.isArray(v) && v.length > 0) return String(v[0]);
        return null;
      };
      const location = asStr(ev.location);
      const description = asStr(ev.description);
      const organizerProp = ve.getFirstProperty('organizer');
      let organizerName: string | null = null;
      if (organizerProp) {
        const cn = organizerProp.getParameter('cn');
        if (typeof cn === 'string' && cn) {
          organizerName = cn;
        } else {
          const v = organizerProp.getFirstValue();
          if (typeof v === 'string') organizerName = v.replace(/^mailto:/i, '');
        }
      }
      const attendeeCount = ve.getAllProperties('attendee').length;

      if (ev.isRecurring()) {
        const iterator = ev.iterator();
        let next: ICAL.Time | null;
        let occurrences = 0;
        // eslint-disable-next-line no-cond-assign
        while ((next = iterator.next()) && occurrences < MAX_OCCURRENCES_PER_EVENT) {
          const startDate = next.toJSDate();
          if (startDate >= to) break; // alles ab hier außerhalb Window
          occurrences++;
          // ev.getOccurrenceDetails liefert auch endDate korrekt verschoben
          const details = ev.getOccurrenceDetails(next);
          const startAt = details.startDate.toJSDate();
          const endAt = details.endDate.toJSDate();
          if (endAt <= from) continue; // vor Window → skip aber weiter iterieren
          out.push({
            uid: `${uid}__${startAt.toISOString()}`, // pro Occurrence eindeutige ID
            title,
            location,
            description,
            startAt,
            endAt,
            allDay: ev.startDate.isDate,
            attendeeCount,
            organizerName,
          });
        }
      } else {
        if (!ev.startDate) continue;
        const startAt = ev.startDate.toJSDate();
        const endAt = ev.endDate ? ev.endDate.toJSDate() : new Date(startAt.getTime() + 3600_000);
        // Window-Filter
        if (endAt <= from) continue;
        if (startAt >= to) continue;
        out.push({
          uid,
          title,
          location,
          description,
          startAt,
          endAt,
          allDay: ev.startDate.isDate,
          attendeeCount,
          organizerName,
        });
      }
    } catch (e) {
      // einzelne kaputte Events tolerieren — weiter mit dem nächsten
      console.warn('[ical] skip broken event:', (e as Error).message);
    }
  }

  return out;
}
