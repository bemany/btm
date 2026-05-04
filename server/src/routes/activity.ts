import { Hono } from 'hono';
import { desc, lt, and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client.js';
import { activityLog } from '../db/schema.js';
import { requireAuth, type Variables } from '../lib/context.js';

const querySchema = z.object({
  limit: z.coerce.number().min(1).max(200).default(100),
  before: z.string().optional(), // ISO-Date für Pagination
  kind: z.string().optional(),
});

export const activityRoute = new Hono<{ Variables: Variables }>()
  .use('*', requireAuth)
  .get('/', async (c) => {
    const { limit, before, kind } = querySchema.parse(c.req.query());
    const filters = [];
    if (before) filters.push(lt(activityLog.createdAt, new Date(before)));
    if (kind) filters.push(eq(activityLog.kind, kind));
    const where = filters.length === 0
      ? undefined
      : filters.length === 1
        ? filters[0]
        : and(...filters);

    const list = await (where
      ? db.select().from(activityLog).where(where)
      : db.select().from(activityLog)
    )
      .orderBy(desc(activityLog.createdAt))
      .limit(limit);
    return c.json({ activity: list });
  })
  // Cleanup-Endpoint (Admin only) — alte Einträge >90 Tage löschen
  .delete('/purge', async (c) => {
    const user = c.get('user');
    if (!user || user.role !== 'admin') return c.json({ error: 'forbidden' }, 403);
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    await db.execute(sql`DELETE FROM ${activityLog} WHERE ${activityLog.createdAt} < ${cutoff}`);
    return c.json({ ok: true });
  });
