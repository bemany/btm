// Read-Endpoints für gecachte Calendar-Events.
//
// GET /api/calendar/my?from=ISO&to=ISO   — Events des aktuellen Users.
//   Default-Window: heute 00:00 lokal → übermorgen 00:00 lokal (~48h).
//
// GET /api/calendar/all?from=ISO&to=ISO  — Events ALLER User mit aktivem
//   Sync. Admin-only (für TV-Dashboard). Jedes Event hat user-Snapshot
//   (name + image) damit das TV den Avatar rendern kann ohne extra Lookup.
//   Default-Window: heute 00:00 lokal → morgen 00:00 lokal (24h).

import { Hono } from 'hono';
import { and, asc, eq, gte, lt } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client.js';
import { calendarEvents, users, icalFeeds } from '../db/schema.js';
import { requireAuth, type Variables } from '../lib/context.js';

const rangeSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

function defaultWindow(days: number): { from: Date; to: Date } {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + days);
  return { from, to };
}

export const calendarRoute = new Hono<{ Variables: Variables }>()
  .use('*', requireAuth)

  .get('/my', async (c) => {
    const me = c.get('user')!;
    const q = rangeSchema.parse(Object.fromEntries(new URL(c.req.url).searchParams));
    const win = defaultWindow(2); // heute + morgen
    const from = q.from ? new Date(q.from) : win.from;
    const to = q.to ? new Date(q.to) : win.to;

    const rows = await db
      .select()
      .from(calendarEvents)
      .where(and(
        eq(calendarEvents.userId, me.id),
        gte(calendarEvents.startAt, from),
        lt(calendarEvents.startAt, to),
      ))
      .orderBy(asc(calendarEvents.startAt));
    return c.json({ events: dedupAcrossSources(rows) });
  })

  .get('/all', async (c) => {
    const me = c.get('user')!;
    if (me.role !== 'admin') return c.json({ error: 'forbidden' }, 403);
    const q = rangeSchema.parse(Object.fromEntries(new URL(c.req.url).searchParams));
    const win = defaultWindow(1); // nur heute auf TV
    const from = q.from ? new Date(q.from) : win.from;
    const to = q.to ? new Date(q.to) : win.to;

    // Join mit users für UI-Anzeige (Name + Avatar).
    // Nur Events von Usern mit aktivem Sync.
    // Per-Source-Privacy:
    //   • source='odoo'  → user.calendarTvPrivate entscheidet
    //   • source='ical'  → ical_feeds.tvPrivate entscheidet (LEFT JOIN über
    //     ical_feed_id; falls Feed gelöscht, ist Feed-Toggle effektiv false)
    // Anonymisierung: Title='Privat', location=null, attendeeCount=0,
    // organizerName=null.
    const rows = await db
      .select({
        id: calendarEvents.id,
        userId: calendarEvents.userId,
        externalId: calendarEvents.externalId,
        source: calendarEvents.source,
        icalFeedId: calendarEvents.icalFeedId,
        title: calendarEvents.title,
        location: calendarEvents.location,
        startAt: calendarEvents.startAt,
        endAt: calendarEvents.endAt,
        allDay: calendarEvents.allDay,
        attendeeCount: calendarEvents.attendeeCount,
        organizerName: calendarEvents.organizerName,
        userName: users.name,
        userImage: users.image,
        userColor: users.color,
        odooTvPrivate: users.calendarTvPrivate,
        feedTvPrivate: icalFeeds.tvPrivate,
      })
      .from(calendarEvents)
      .innerJoin(users, eq(calendarEvents.userId, users.id))
      .leftJoin(icalFeeds, eq(calendarEvents.icalFeedId, icalFeeds.id))
      .where(and(
        gte(calendarEvents.startAt, from),
        lt(calendarEvents.startAt, to),
      ))
      .orderBy(asc(calendarEvents.startAt));

    const events = rows.map((r) => {
      const shouldHide =
        (r.source === 'odoo' && !!r.odooTvPrivate) ||
        (r.source === 'ical' && !!r.feedTvPrivate);
      if (shouldHide) {
        return {
          id: r.id,
          userId: r.userId,
          externalId: r.externalId,
          source: r.source,
          icalFeedId: r.icalFeedId,
          title: 'Privat',
          location: null,
          startAt: r.startAt,
          endAt: r.endAt,
          allDay: r.allDay,
          attendeeCount: 0,
          organizerName: null,
          userName: r.userName,
          userImage: r.userImage,
          userColor: r.userColor,
        };
      }
      return {
        id: r.id,
        userId: r.userId,
        externalId: r.externalId,
        source: r.source,
        icalFeedId: r.icalFeedId,
        title: r.title,
        location: r.location,
        startAt: r.startAt,
        endAt: r.endAt,
        allDay: r.allDay,
        attendeeCount: r.attendeeCount,
        organizerName: r.organizerName,
        userName: r.userName,
        userImage: r.userImage,
        userColor: r.userColor,
      };
    });
    // Cross-source-Dedup auch auf TV: pro User dieselbe Schlüsselung wie /my,
    // sonst tauchen Odoo+iCal-Overlaps doppelt im Quadrant auf.
    const eventsByUser = new Map<string, typeof events>();
    for (const ev of events) {
      const list = eventsByUser.get(ev.userId) ?? [];
      list.push(ev);
      eventsByUser.set(ev.userId, list);
    }
    const deduped: typeof events = [];
    for (const list of eventsByUser.values()) {
      deduped.push(...dedupAcrossSources(list));
    }
    deduped.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    return c.json({ events: deduped });
  });

// Cross-source-Deduplikation: wenn dieselbe Veranstaltung sowohl via Odoo-
// Sync ALS AUCH via iCal-Feed gepullt wird (z.B. ein Termin, der in Odoo
// als calendar.event existiert UND zusätzlich im Google-Kalender liegt, der
// als iCal-Feed angebunden ist), zeigen wir sie nur einmal an.
// Heuristik: gleicher (normalized title, startAt-Sekunde, endAt-Sekunde) →
// behalte die iCal-Variante (meist die aktuellere; Quelle ist häufig die
// Original-Source und Odoo spiegelt nur).
function dedupAcrossSources<T extends {
  source: string;
  title: string;
  startAt: Date | string;
  endAt: Date | string;
}>(rows: T[]): T[] {
  const seen = new Map<string, T>();
  for (const r of rows) {
    const titleNorm = (r.title ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
    const startSec = Math.floor(new Date(r.startAt).getTime() / 1000);
    const endSec = Math.floor(new Date(r.endAt).getTime() / 1000);
    const key = `${titleNorm}|${startSec}|${endSec}`;
    const prev = seen.get(key);
    if (!prev) {
      seen.set(key, r);
    } else if (prev.source === 'odoo' && r.source === 'ical') {
      seen.set(key, r);
    }
  }
  return Array.from(seen.values());
}
