// Feedback-Route — Bug-Reports + Feature-Requests von Nutzern.
//
// POST /                — neuer Eintrag (jeder eingeloggte User)
// GET  /                — Liste (alle für Admin, eigene für Nicht-Admin)
// PATCH /:id            — Status / adminNote ändern (nur Admin)
// DELETE /:id           — entfernen (Admin oder Submitter)

import { Hono } from 'hono';
import { and, desc, eq, or } from 'drizzle-orm';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { db } from '../db/client.js';
import { feedback } from '../db/schema.js';
import { requireAuth, type Variables } from '../lib/context.js';

const TypeEnum = z.enum(['bug', 'feature']);
const StatusEnum = z.enum(['open', 'in_progress', 'done', 'wontfix']);

const createSchema = z.object({
  type: TypeEnum,
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(20_000),
  contextPath: z.string().max(2000).optional().nullable(),
  contextTheme: z.string().max(80).optional().nullable(),
  contextUserAgent: z.string().max(500).optional().nullable(),
});

const updateSchema = z.object({
  status: StatusEnum.optional(),
  adminNote: z.string().max(20_000).nullable().optional(),
});

export const feedbackRoute = new Hono<{ Variables: Variables }>()
  .use('*', requireAuth)
  .get('/', async (c) => {
    const me = c.get('user')!;
    const filter =
      me.role === 'admin'
        ? undefined
        : eq(feedback.submitterId, me.id);
    const list = await (filter
      ? db.select().from(feedback).where(filter)
      : db.select().from(feedback))
      .orderBy(desc(feedback.createdAt));
    return c.json({ feedback: list });
  })
  .post('/', async (c) => {
    const me = c.get('user')!;
    const body = createSchema.parse(await c.req.json());
    const id = `F${nanoid(10)}`;
    const [row] = await db
      .insert(feedback)
      .values({
        id,
        type: body.type,
        title: body.title,
        body: body.body,
        contextPath: body.contextPath ?? null,
        contextTheme: body.contextTheme ?? null,
        contextUserAgent: body.contextUserAgent ?? null,
        submitterId: me.id,
      })
      .returning();
    return c.json({ feedback: row }, 201);
  })
  .patch('/:id', async (c) => {
    const me = c.get('user')!;
    if (me.role !== 'admin') return c.json({ error: 'forbidden' }, 403);
    const id = c.req.param('id');
    const body = updateSchema.parse(await c.req.json());
    const patch: {
      status?: 'open' | 'in_progress' | 'done' | 'wontfix';
      adminNote?: string | null;
      updatedAt: Date;
    } = { updatedAt: new Date() };
    if (body.status !== undefined) patch.status = body.status;
    if (body.adminNote !== undefined) patch.adminNote = body.adminNote;
    const [row] = await db.update(feedback).set(patch).where(eq(feedback.id, id)).returning();
    if (!row) return c.json({ error: 'not found' }, 404);
    return c.json({ feedback: row });
  })
  .delete('/:id', async (c) => {
    const me = c.get('user')!;
    const id = c.req.param('id');
    const [item] = await db.select().from(feedback).where(eq(feedback.id, id)).limit(1);
    if (!item) return c.json({ error: 'not found' }, 404);
    if (me.role !== 'admin' && item.submitterId !== me.id) {
      return c.json({ error: 'forbidden' }, 403);
    }
    await db.delete(feedback).where(eq(feedback.id, id));
    return c.json({ ok: true });
  });

void or;
void and;
