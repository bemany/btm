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
import { calendarEvents, users } from '../db/schema.js';
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
    return c.json({ events: rows });
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
    const rows = await db
      .select({
        id: calendarEvents.id,
        userId: calendarEvents.userId,
        odooEventId: calendarEvents.odooEventId,
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
      })
      .from(calendarEvents)
      .innerJoin(users, eq(calendarEvents.userId, users.id))
      .where(and(
        eq(users.odooSyncEnabled, true),
        gte(calendarEvents.startAt, from),
        lt(calendarEvents.startAt, to),
      ))
      .orderBy(asc(calendarEvents.startAt));
    return c.json({ events: rows });
  });
