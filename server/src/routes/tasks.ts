import { Hono } from 'hono';
import { and, eq, asc, sql } from 'drizzle-orm';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { db } from '../db/client.js';
import { tasks, taskSessions, liveTimers } from '../db/schema.js';
import { requireAuth, type Variables } from '../lib/context.js';

const ColumnEnum = z.enum(['todo', 'doing', 'review', 'done']);
const PrioEnum = z.enum(['low', 'med', 'high']);

const createSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(10_000).optional().nullable(),
  column: ColumnEnum.default('todo'),
  priority: PrioEnum.default('med'),
  estH: z.number().min(0).max(200).default(1),
  due: z.string().max(50).optional().nullable(),
  projectId: z.string().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
});

const updateSchema = createSchema.partial();

export const tasksRoute = new Hono<{ Variables: Variables }>()
  .use('*', requireAuth)
  .get('/', async (c) => {
    const list = await db.select().from(tasks).orderBy(asc(tasks.sortOrder), asc(tasks.createdAt));
    return c.json({ tasks: list });
  })
  .post('/', async (c) => {
    const user = c.get('user')!;
    const body = createSchema.parse(await c.req.json());
    const id = `T${nanoid(8)}`;
    const [row] = await db
      .insert(tasks)
      .values({
        id,
        title: body.title,
        description: body.description ?? null,
        column: body.column,
        priority: body.priority,
        estH: body.estH,
        due: body.due ?? null,
        projectId: body.projectId ?? null,
        assigneeId: body.assigneeId ?? user.id,
        createdById: user.id,
      })
      .returning();
    return c.json({ task: row }, 201);
  })
  .patch('/:id', async (c) => {
    const id = c.req.param('id');
    const body = updateSchema.parse(await c.req.json());
    const [row] = await db
      .update(tasks)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
    if (!row) return c.json({ error: 'not found' }, 404);
    return c.json({ task: row });
  })
  .delete('/:id', async (c) => {
    const id = c.req.param('id');
    const result = await db.delete(tasks).where(eq(tasks.id, id)).returning();
    if (!result.length) return c.json({ error: 'not found' }, 404);
    return c.json({ ok: true });
  })

  // ── Live-Timer ──────────────────────────────────────────────────────
  .post('/:id/timer/start', async (c) => {
    const user = c.get('user')!;
    const taskId = c.req.param('id');
    const { pomodoro } = z
      .object({ pomodoro: z.boolean().default(false) })
      .parse(await c.req.json().catch(() => ({})));

    // Eventuellen vorhandenen Live-Timer des Users stoppen + Session anlegen
    const [existing] = await db.select().from(liveTimers).where(eq(liveTimers.userId, user.id)).limit(1);
    if (existing) {
      const now = new Date();
      const hours = (now.getTime() - existing.startedAt.getTime()) / 3_600_000;
      await db.insert(taskSessions).values({
        id: `S${nanoid(8)}`,
        taskId: existing.taskId,
        userId: user.id,
        fromAt: existing.startedAt,
        toAt: now,
        hours: Number(hours.toFixed(4)),
        source: 'timer',
      });
      await db
        .update(tasks)
        .set({ loggedH: sql`${tasks.loggedH} + ${hours}` })
        .where(eq(tasks.id, existing.taskId));
      await db.delete(liveTimers).where(eq(liveTimers.userId, user.id));
    }

    const startedAt = new Date();
    const [row] = await db
      .insert(liveTimers)
      .values({
        userId: user.id,
        taskId,
        startedAt,
        pomodoroEnabled: pomodoro,
        pomodoroStartedAt: pomodoro ? startedAt : null,
      })
      .returning();
    return c.json({ liveTimer: row });
  })
  .post('/timer/stop', async (c) => {
    const user = c.get('user')!;
    const [existing] = await db.select().from(liveTimers).where(eq(liveTimers.userId, user.id)).limit(1);
    if (!existing) return c.json({ liveTimer: null });

    const now = new Date();
    const hours = (now.getTime() - existing.startedAt.getTime()) / 3_600_000;
    const [session] = await db
      .insert(taskSessions)
      .values({
        id: `S${nanoid(8)}`,
        taskId: existing.taskId,
        userId: user.id,
        fromAt: existing.startedAt,
        toAt: now,
        hours: Number(hours.toFixed(4)),
        source: 'timer',
      })
      .returning();
    await db
      .update(tasks)
      .set({ loggedH: sql`${tasks.loggedH} + ${hours}` })
      .where(eq(tasks.id, existing.taskId));
    await db.delete(liveTimers).where(eq(liveTimers.userId, user.id));
    return c.json({ liveTimer: null, session });
  })
  .get('/timer/live', async (c) => {
    const user = c.get('user')!;
    const [row] = await db.select().from(liveTimers).where(eq(liveTimers.userId, user.id)).limit(1);
    return c.json({ liveTimer: row ?? null });
  })

  // ── Manuelle Zeitbuchungen ──────────────────────────────────────────
  .get('/:id/sessions', async (c) => {
    const taskId = c.req.param('id');
    const list = await db
      .select()
      .from(taskSessions)
      .where(eq(taskSessions.taskId, taskId))
      .orderBy(asc(taskSessions.fromAt));
    return c.json({ sessions: list });
  })
  .post('/:id/sessions', async (c) => {
    const user = c.get('user')!;
    const taskId = c.req.param('id');
    const body = z
      .object({
        fromAt: z.string(),
        hours: z.number().min(0).max(24),
        source: z.enum(['timer', 'manual']).default('manual'),
      })
      .parse(await c.req.json());
    const fromAt = new Date(body.fromAt);
    const toAt = new Date(fromAt.getTime() + body.hours * 3_600_000);
    const [row] = await db
      .insert(taskSessions)
      .values({
        id: `S${nanoid(8)}`,
        taskId,
        userId: user.id,
        fromAt,
        toAt,
        hours: body.hours,
        source: body.source,
      })
      .returning();
    await db
      .update(tasks)
      .set({ loggedH: sql`${tasks.loggedH} + ${body.hours}` })
      .where(eq(tasks.id, taskId));
    return c.json({ session: row }, 201);
  })
  .delete('/sessions/:sessionId', async (c) => {
    const user = c.get('user')!;
    const sessionId = c.req.param('sessionId');
    const [s] = await db
      .select()
      .from(taskSessions)
      .where(and(eq(taskSessions.id, sessionId), eq(taskSessions.userId, user.id)))
      .limit(1);
    if (!s) return c.json({ error: 'not found' }, 404);
    await db.delete(taskSessions).where(eq(taskSessions.id, sessionId));
    await db
      .update(tasks)
      .set({ loggedH: sql`GREATEST(0, ${tasks.loggedH} - ${s.hours})` })
      .where(eq(tasks.id, s.taskId));
    return c.json({ ok: true });
  });
