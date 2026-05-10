import { Hono } from 'hono';
import { and, eq, asc, sql, isNull, or } from 'drizzle-orm';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { db } from '../db/client.js';
import { tasks, taskSessions, liveTimers, projects, projectMembers } from '../db/schema.js';
import { requireAuth, type Variables } from '../lib/context.js';
import { logActivity } from '../lib/activity.js';
import { createNotification } from '../lib/notifications.js';
import { listVisibleProjectIds } from '../lib/project-visibility.js';

const ColumnEnum = z.enum(['todo', 'planned', 'doing', 'review', 'done']);
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
  parentTaskId: z.string().nullable().optional(),
});

const updateSchema = createSchema.partial();

export const tasksRoute = new Hono<{ Variables: Variables }>()
  .use('*', requireAuth)
  .get('/', async (c) => {
    const me = c.get('user')!;
    // Sichtbarkeit gemäß Project-Membership: Tasks aus Projekten die der
    // User nicht sehen darf werden ausgeblendet. Tasks ohne Projekt
    // bleiben weiterhin sichtbar (z.B. ad-hoc-Aufgaben).
    const { ids: visibleProjectIds, isAdmin } = await listVisibleProjectIds(
      me.id,
      me.role,
    );
    const rows = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        description: tasks.description,
        column: tasks.column,
        priority: tasks.priority,
        estH: tasks.estH,
        loggedH: tasks.loggedH,
        due: tasks.due,
        projectId: tasks.projectId,
        assigneeId: tasks.assigneeId,
        createdById: tasks.createdById,
        sortOrder: tasks.sortOrder,
        parentTaskId: tasks.parentTaskId,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
      })
      .from(tasks)
      .orderBy(asc(tasks.sortOrder), asc(tasks.createdAt));
    const filtered = isAdmin
      ? rows
      : rows.filter((t) => !t.projectId || visibleProjectIds.includes(t.projectId));
    return c.json({ tasks: filtered });
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
    logActivity({ kind: 'task_created', actorId: user.id, target: id, meta: { title: row.title, projectId: row.projectId } });
    return c.json({ task: row }, 201);
  })
  .patch('/:id', async (c) => {
    const me = c.get('user')!;
    const id = c.req.param('id');
    const body = updateSchema.parse(await c.req.json());
    const [before] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
    if (!before) return c.json({ error: 'not found' }, 404);

    // Permission-Check: Wechsel nach 'done' ist nur dem Projekt-Owner oder
    // einem Admin erlaubt. Wenn das Projekt keinen Owner hat, darf jede:r.
    if (body.column === 'done' && before.column !== 'done' && me.role !== 'admin') {
      const projId = (body.projectId !== undefined ? body.projectId : before.projectId) as string | null;
      if (projId) {
        const [proj] = await db
          .select({ ownerId: projects.ownerId })
          .from(projects)
          .where(eq(projects.id, projId))
          .limit(1);
        if (proj?.ownerId && proj.ownerId !== me.id) {
          return c.json(
            {
              error: 'forbidden',
              reason: 'only_owner_can_mark_done',
              message: 'Nur der Projekt-Verantwortliche darf Aufgaben auf „Erledigt" setzen.',
            },
            403,
          );
        }
      }
    }

    const [row] = await db
      .update(tasks)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
    if (!row) return c.json({ error: 'not found' }, 404);
    if (body.column && body.column !== before.column) {
      logActivity({
        kind: body.column === 'done' ? 'task_done' : 'task_moved',
        actorId: me.id,
        target: id,
        meta: { title: row.title, from: before.column, to: body.column, who: row.assigneeId },
      });
      // Wechsel nach 'review' → Inbox-Notification an Projekt-Owner.
      // Self-Trigger filtern: wenn der Owner selbst verschoben hat, keine
      // Notification (sonst wäre die Inbox voll).
      if (body.column === 'review' && row.projectId) {
        void notifyOwnerOnReview({
          taskId: row.id,
          taskTitle: row.title,
          projectId: row.projectId,
          actorId: me.id,
        });
      }
    } else if (Object.keys(body).length > 0) {
      // Diff der relevanten Felder ins meta — UI rendert daraus einen
      // Tooltip „Titel: alt → neu". Lange Strings clippen wir auf 80
      // Zeichen, damit das jsonb nicht aufbläht.
      const clip = (v: unknown): string => {
        const s = v == null ? '' : String(v);
        return s.length > 80 ? s.slice(0, 79) + '…' : s;
      };
      const changes: Record<string, { from: string; to: string }> = {};
      const trackFields: Array<keyof typeof body> = [
        'title',
        'description',
        'priority',
        'estH',
        'due',
        'projectId',
        'assigneeId',
      ];
      for (const f of trackFields) {
        if (body[f] === undefined) continue;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const beforeVal = (before as any)[f];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const afterVal = (row as any)[f];
        if (clip(beforeVal) !== clip(afterVal)) {
          changes[f as string] = { from: clip(beforeVal), to: clip(afterVal) };
        }
      }
      logActivity({
        kind: 'task_updated',
        actorId: me.id,
        target: id,
        meta: { title: row.title, changes },
      });
    }
    return c.json({ task: row });
  })
  .delete('/:id', async (c) => {
    const me = c.get('user')!;
    const id = c.req.param('id');
    const [before] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
    const result = await db.delete(tasks).where(eq(tasks.id, id)).returning();
    if (!result.length) return c.json({ error: 'not found' }, 404);
    logActivity({ kind: 'task_deleted', actorId: me.id, target: id, meta: { title: before?.title } });
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
    const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
    logActivity({ kind: 'timer_started', actorId: user.id, target: taskId, meta: { title: task?.title, who: user.id } });
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
    const [task] = await db.select().from(tasks).where(eq(tasks.id, existing.taskId)).limit(1);
    logActivity({
      kind: 'timer_stopped',
      actorId: user.id,
      target: existing.taskId,
      meta: { title: task?.title, who: user.id, hours: Number(hours.toFixed(2)) },
    });
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
  // Atomic Tag-Replace: ersetzt alle Sessions eines Users für eine Task an einem Tag.
  // Nützlich fürs Stunden-Grid (TimeCell): Cell-Edit überschreibt den Tageswert.
  .post('/:id/sessions/day', async (c) => {
    const user = c.get('user')!;
    const taskId = c.req.param('id');
    const body = z.object({ day: z.string(), hours: z.number().min(0).max(24) }).parse(await c.req.json());
    const dayStart = new Date(body.day + 'T00:00:00.000Z');
    const dayEnd = new Date(body.day + 'T23:59:59.999Z');

    // Existing-Sessions des Tages für diese Task + diesen User wegputzen.
    const existing = await db
      .select()
      .from(taskSessions)
      .where(
        and(
          eq(taskSessions.taskId, taskId),
          eq(taskSessions.userId, user.id),
          sql`${taskSessions.fromAt} >= ${dayStart}`,
          sql`${taskSessions.fromAt} <= ${dayEnd}`,
        ),
      );
    const removedSum = existing.reduce((a, s) => a + Number(s.hours), 0);
    if (existing.length > 0) {
      await db
        .delete(taskSessions)
        .where(
          and(
            eq(taskSessions.taskId, taskId),
            eq(taskSessions.userId, user.id),
            sql`${taskSessions.fromAt} >= ${dayStart}`,
            sql`${taskSessions.fromAt} <= ${dayEnd}`,
          ),
        );
    }

    let session = null;
    if (body.hours > 0) {
      const fromAt = new Date(body.day + 'T09:00:00.000Z');
      const toAt = new Date(fromAt.getTime() + body.hours * 3_600_000);
      [session] = await db
        .insert(taskSessions)
        .values({
          id: `S${nanoid(8)}`,
          taskId,
          userId: user.id,
          fromAt,
          toAt,
          hours: body.hours,
          source: 'manual',
        })
        .returning();
    }
    const delta = body.hours - removedSum;
    if (delta !== 0) {
      await db
        .update(tasks)
        .set({ loggedH: sql`GREATEST(0, ${tasks.loggedH} + ${delta})` })
        .where(eq(tasks.id, taskId));
    }
    return c.json({ session, removed: existing.length, delta: Number(delta.toFixed(4)) });
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
  })
  // Einzelne Session bearbeiten (Stunden und/oder Startzeitpunkt). Nur die
  // eigenen Sessions sind editierbar — fremde geben 404. `hours` und/oder
  // `fromAt` optional; `toAt` wird neu berechnet aus dem (ggf. neuen) From +
  // (ggf. neuen) Hours, Logged-Counter wird per Delta nachgezogen.
  .patch('/sessions/:sessionId', async (c) => {
    const user = c.get('user')!;
    const sessionId = c.req.param('sessionId');
    const body = z
      .object({
        hours: z.number().min(0).max(24).optional(),
        fromAt: z.string().optional(),
      })
      .parse(await c.req.json());
    const [s] = await db
      .select()
      .from(taskSessions)
      .where(and(eq(taskSessions.id, sessionId), eq(taskSessions.userId, user.id)))
      .limit(1);
    if (!s) return c.json({ error: 'not found' }, 404);
    const newHours = body.hours ?? Number(s.hours);
    const newFromAt = body.fromAt ? new Date(body.fromAt) : s.fromAt;
    const newToAt = new Date(newFromAt.getTime() + newHours * 3_600_000);
    const [updated] = await db
      .update(taskSessions)
      .set({ hours: newHours, fromAt: newFromAt, toAt: newToAt })
      .where(eq(taskSessions.id, sessionId))
      .returning();
    const delta = newHours - Number(s.hours);
    if (delta !== 0) {
      await db
        .update(tasks)
        .set({ loggedH: sql`GREATEST(0, ${tasks.loggedH} + ${delta})` })
        .where(eq(tasks.id, s.taskId));
    }
    return c.json({ session: updated });
  });

// ── Helper: Owner-Notification beim Review-Wechsel ────────────────────
// Schreibt einen Inbox-Eintrag (kind = 'review_request') für den Projekt-
// Owner und triggert die existierende Notification-Mail-Pipeline (Mention-
// Mail-Toggle wird hier ignoriert; Owner-Reviews sind wichtiger als der
// allgemeine Mention-Setting-Toggle, sollen aber im Digest mitlaufen).

async function notifyOwnerOnReview(opts: {
  taskId: string;
  taskTitle: string;
  projectId: string;
  actorId: string;
}): Promise<void> {
  try {
    const [proj] = await db
      .select({ ownerId: projects.ownerId, name: projects.name })
      .from(projects)
      .where(eq(projects.id, opts.projectId))
      .limit(1);
    if (!proj?.ownerId) return;
    if (proj.ownerId === opts.actorId) return; // Self-Trigger filtern

    void projectMembers; // referenziert; kein Member-Check nötig

    await createNotification({
      userId: proj.ownerId,
      actorId: opts.actorId,
      kind: 'review_request',
      payload: {
        taskId: opts.taskId,
        subjectType: 'task',
        subjectId: opts.taskId,
        subjectTitle: opts.taskTitle,
        excerpt: '',
        projectName: proj.name,
      },
    });
  } catch (e) {
    console.warn('[tasks] notifyOwnerOnReview failed', e);
  }
}
