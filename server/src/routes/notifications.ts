// Inbox-Endpoints: List + Counter + Mark-Read.
// Counter ist separater Endpoint (cached/leichter abfragbar) — Frontend
// pollt den Counter alle 30s, die Liste wird nur auf Inbox-Page geladen.

import { Hono } from 'hono';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client.js';
import { notifications, feedback } from '../db/schema.js';
import { requireAuth, type Variables } from '../lib/context.js';

const listQuery = z.object({
  onlyUnread: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  limit: z.coerce.number().min(1).max(200).default(50),
});

export const notificationsRoute = new Hono<{ Variables: Variables }>()
  .use('*', requireAuth)

  // GET /notifications?onlyUnread=true&limit=50
  .get('/', async (c) => {
    const me = c.get('user')!;
    const { onlyUnread, limit } = listQuery.parse(c.req.query());
    const where = onlyUnread
      ? and(eq(notifications.userId, me.id), isNull(notifications.seenAt))
      : eq(notifications.userId, me.id);
    const list = await db
      .select()
      .from(notifications)
      .where(where)
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
    return c.json({ notifications: list });
  })

  // GET /notifications/count → { unread: number }
  // Badge = ungelesene Notifications (ausser 'feedback_resolved' — die werden
  // durch die offenen Abnahmen unten repraesentiert) PLUS offene Reporter-
  // Abnahmen (FTKnjlXNVlH). Letztere haengen am Feedback-Zustand, nicht an
  // seenAt: so bleibt der Badge stehen bis der User wirklich abgenommen hat —
  // er kann die Aufforderung nicht durch "als gelesen" wegklicken.
  .get('/count', async (c) => {
    const me = c.get('user')!;
    const [notif] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, me.id),
          isNull(notifications.seenAt),
          sql`${notifications.kind} <> 'feedback_resolved'`,
        ),
      );
    const [pending] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(feedback)
      .where(
        and(
          eq(feedback.submitterId, me.id),
          eq(feedback.status, 'done'),
          isNull(feedback.reporterConfirmation),
        ),
      );
    return c.json({ unread: (notif?.count ?? 0) + (pending?.count ?? 0) });
  })

  // POST /notifications/:id/read
  .post('/:id/read', async (c) => {
    const me = c.get('user')!;
    const id = c.req.param('id');
    const [existing] = await db.select().from(notifications).where(eq(notifications.id, id)).limit(1);
    if (!existing) return c.json({ error: 'not found' }, 404);
    if (existing.userId !== me.id) return c.json({ error: 'forbidden' }, 403);
    if (existing.seenAt) return c.json({ ok: true }); // already read, idempotent

    await db.update(notifications).set({ seenAt: new Date() }).where(eq(notifications.id, id));
    return c.json({ ok: true });
  })

  // POST /notifications/read-all
  .post('/read-all', async (c) => {
    const me = c.get('user')!;
    await db
      .update(notifications)
      .set({ seenAt: new Date() })
      .where(and(eq(notifications.userId, me.id), isNull(notifications.seenAt)));
    return c.json({ ok: true });
  });
