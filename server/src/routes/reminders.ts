// CRUD für Task-Reminder.
// GET  /api/tasks/:taskId/reminders   → alle Reminder des Users für diesen Task
// POST /api/tasks/:taskId/reminders   → neuen Reminder anlegen
// DELETE /api/reminders/:id           → Reminder löschen (nur eigene)

import { Hono } from 'hono';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/client.js';
import { taskReminders, tasks } from '../db/schema.js';
import { requireAuth, type Variables } from '../lib/context.js';

const createSchema = z.object({
  remindAt: z.string().min(1), // ISO-8601
});

export const remindersRoute = new Hono<{ Variables: Variables }>()
  .use('*', requireAuth)

  .get('/tasks/:taskId/reminders', async (c) => {
    const me = c.get('user')!;
    const taskId = c.req.param('taskId');
    const rows = await db
      .select()
      .from(taskReminders)
      .where(and(eq(taskReminders.taskId, taskId), eq(taskReminders.userId, me.id)));
    return c.json({ reminders: rows });
  })

  .post('/tasks/:taskId/reminders', async (c) => {
    const me = c.get('user')!;
    const taskId = c.req.param('taskId');
    const body = createSchema.parse(await c.req.json());

    // Task muss existieren
    const [task] = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, taskId)).limit(1);
    if (!task) return c.json({ error: 'task not found' }, 404);

    const remindAt = new Date(body.remindAt);
    if (isNaN(remindAt.getTime())) return c.json({ error: 'invalid remindAt' }, 400);

    const id = `R${nanoid(10)}`;
    const [row] = await db
      .insert(taskReminders)
      .values({ id, taskId, userId: me.id, remindAt })
      .returning();
    return c.json({ reminder: row }, 201);
  })

  .delete('/reminders/:id', async (c) => {
    const me = c.get('user')!;
    const id = c.req.param('id');
    const [row] = await db
      .delete(taskReminders)
      .where(and(eq(taskReminders.id, id), eq(taskReminders.userId, me.id)))
      .returning();
    if (!row) return c.json({ error: 'not found' }, 404);
    return c.json({ ok: true });
  });
