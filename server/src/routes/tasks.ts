import { Hono } from 'hono';
import { and, eq, asc, sql, isNull, or, desc } from 'drizzle-orm';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { promises as fs, createReadStream } from 'node:fs';
import { join as joinPath, extname } from 'node:path';
import { Readable } from 'node:stream';
import { db } from '../db/client.js';
import { tasks, taskSessions, liveTimers, projects, projectMembers, taskAttachments, taskChecklistItems } from '../db/schema.js';
import { requireAuth, type Variables } from '../lib/context.js';
import { logActivity } from '../lib/activity.js';
import { createNotification } from '../lib/notifications.js';
import { listVisibleProjectIds } from '../lib/project-visibility.js';

// Attachment-Storage. UPLOAD_DIR kommt aus ENV (Docker-Volume),
// default /app/uploads. Pro Task ein Subdir damit es nicht 10k Files
// im Root gibt. Filename = generierte ID + Original-Extension (Path-
// Traversal-Schutz: nichts vom User wird in den Pfad geschrieben).
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? '/app/uploads';
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5 MB

// Sichere Extension extrahieren — nur a-z0-9 erlaubt, sonst leer.
function safeExt(filename: string): string {
  const e = extname(filename).toLowerCase().slice(1);
  return /^[a-z0-9]{1,8}$/.test(e) ? `.${e}` : '';
}

const ColumnEnum = z.enum(['todo', 'planned', 'doing', 'review', 'done']);
const PrioEnum = z.enum(['low', 'med', 'high']);

// F44rPspkp5z: plannedFor sind ISO-Datumsstrings (YYYY-MM-DD). Wir lassen max
// 10 Eintraege zu — eine Aufgabe ueber 2 Wochen zu planen ist denkbar, mehr
// wirkt willkuerlich. Reihenfolge ist signifikant fuer Anzeige (chronologisch
// hilft Lesbarkeit, wir sortieren aber im Frontend).
const PlannedDayString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'invalid ISO date');

const createSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(10_000).optional().nullable(),
  column: ColumnEnum.default('todo'),
  priority: PrioEnum.default('med'),
  estH: z.number().min(0).max(200).default(1),
  due: z.string().max(50).optional().nullable(),
  plannedFor: z.array(PlannedDayString).max(10).optional(),
  projectId: z.string().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  parentTaskId: z.string().nullable().optional(),
});

const updateSchema = createSchema.partial();

export const tasksRoute = new Hono<{ Variables: Variables }>()
  .use('*', requireAuth)
  .get('/', async (c) => {
    const me = c.get('user')!;
    // Archiv-Filter (FgPjnOpBdCX): default 'active'. ?archived=1 → nur
    // archivierte. ?archived=all → beides. Default räumt Listen/Boards auf.
    const archivedParam = c.req.query('archived');
    const archiveMode: 'active' | 'archived' | 'all' =
      archivedParam === '1' || archivedParam === 'true'
        ? 'archived'
        : archivedParam === 'all'
          ? 'all'
          : 'active';
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
        plannedFor: tasks.plannedFor,
        projectId: tasks.projectId,
        assigneeId: tasks.assigneeId,
        createdById: tasks.createdById,
        sortOrder: tasks.sortOrder,
        parentTaskId: tasks.parentTaskId,
        archivedAt: tasks.archivedAt,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
      })
      .from(tasks)
      .orderBy(asc(tasks.sortOrder), asc(tasks.createdAt));
    const filteredByVis = isAdmin
      ? rows
      : rows.filter((t) => !t.projectId || visibleProjectIds.includes(t.projectId));
    const filtered = filteredByVis.filter((t) => {
      if (archiveMode === 'all') return true;
      if (archiveMode === 'archived') return !!t.archivedAt;
      return !t.archivedAt;
    });
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
        plannedFor: body.plannedFor ?? [],
        projectId: body.projectId ?? null,
        assigneeId: body.assigneeId ?? user.id,
        createdById: user.id,
        parentTaskId: body.parentTaskId ?? null,
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

  // ── Archiv (FgPjnOpBdCX) ────────────────────────────────────────────
  // archive: nur Tasks in column='done' dürfen archiviert werden — wir
  // wollen nicht versehentlich unerledigte Aufgaben aus dem Board räumen.
  .post('/:id/archive', async (c) => {
    const me = c.get('user')!;
    const id = c.req.param('id');
    const [before] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
    if (!before) return c.json({ error: 'not found' }, 404);
    if (before.column !== 'done') {
      return c.json({ error: 'invalid_state', message: 'Nur erledigte Aufgaben können archiviert werden.' }, 400);
    }
    if (before.archivedAt) return c.json({ task: before });
    const [row] = await db
      .update(tasks)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
    logActivity({ kind: 'task_archived', actorId: me.id, target: id, meta: { title: before.title } });
    return c.json({ task: row });
  })
  .post('/:id/unarchive', async (c) => {
    const me = c.get('user')!;
    const id = c.req.param('id');
    const [before] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
    if (!before) return c.json({ error: 'not found' }, 404);
    if (!before.archivedAt) return c.json({ task: before });
    const [row] = await db
      .update(tasks)
      .set({ archivedAt: null, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
    logActivity({ kind: 'task_unarchived', actorId: me.id, target: id, meta: { title: before.title } });
    return c.json({ task: row });
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
      // FclpRr066St: alte Task ggf. zurueck in vorherige Spalte
      await restorePreviousColumn(existing.taskId, existing.previousColumn);
      await db
        .update(tasks)
        .set({ loggedH: sql`${tasks.loggedH} + ${hours}` })
        .where(eq(tasks.id, existing.taskId));
      await db.delete(liveTimers).where(eq(liveTimers.userId, user.id));
    }

    // FclpRr066St: aktuelle Spalte der Ziel-Aufgabe lesen und ggf. in 'doing' setzen.
    // Wir merken uns die alte Spalte; bei Stop verschieben wir zurueck.
    const [targetTask] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
    const previousColumn = targetTask && targetTask.column !== 'doing' ? targetTask.column : null;
    if (previousColumn) {
      await db.update(tasks).set({ column: 'doing', updatedAt: new Date() }).where(eq(tasks.id, taskId));
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
        previousColumn,
      })
      .returning();
    logActivity({
      kind: 'timer_started',
      actorId: user.id,
      target: taskId,
      meta: { title: targetTask?.title, who: user.id, autoMovedFrom: previousColumn },
    });
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
    // FclpRr066St: zurueck in vorherige Spalte (nur wenn aktuell noch in 'doing')
    await restorePreviousColumn(existing.taskId, existing.previousColumn);
    await db.delete(liveTimers).where(eq(liveTimers.userId, user.id));
    const [task] = await db.select().from(tasks).where(eq(tasks.id, existing.taskId)).limit(1);
    logActivity({
      kind: 'timer_stopped',
      actorId: user.id,
      target: existing.taskId,
      meta: { title: task?.title, who: user.id, hours: Number(hours.toFixed(2)), autoMovedTo: existing.previousColumn },
    });
    return c.json({ liveTimer: null, session });
  })
  .get('/timer/live', async (c) => {
    const user = c.get('user')!;
    const [row] = await db.select().from(liveTimers).where(eq(liveTimers.userId, user.id)).limit(1);
    return c.json({ liveTimer: row ?? null });
  })
  // FQJzGtjPqc-: Alle aktiven Live-Timer aller User — fürs TV-Dashboard,
  // damit man auch Aufgaben sieht, die nicht in "Doing" stehen, aber auf
  // die gerade Zeit getrackt wird.
  .get('/timer/live/all', async (c) => {
    const rows = await db.select().from(liveTimers);
    return c.json({ liveTimers: rows });
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
  })

  // ── Attachments ────────────────────────────────────────────────────
  // POST /:id/attachments — multipart/form-data, key 'file'. Max 5 MB.
  // Visibility-Check via Project-Membership.
  .post('/:id/attachments', async (c) => {
    const me = c.get('user')!;
    const taskId = c.req.param('id');
    const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
    if (!task) return c.json({ error: 'task_not_found' }, 404);

    // Visibility-Check: Task gehört zu einem Projekt das der User sehen darf?
    if (task.projectId) {
      const { ids } = await listVisibleProjectIds(me.id, me.role);
      if (!ids.includes(task.projectId)) return c.json({ error: 'forbidden' }, 403);
    }

    // Hono parseBody hat eingebautes multipart-Handling
    const body = await c.req.parseBody();
    const file = body['file'];
    if (!(file instanceof File)) {
      return c.json({ error: 'no_file' }, 400);
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      return c.json({ error: 'too_large', maxBytes: MAX_ATTACHMENT_BYTES }, 413);
    }
    if (file.size === 0) {
      return c.json({ error: 'empty_file' }, 400);
    }

    const id = `TA${nanoid(12)}`;
    const ext = safeExt(file.name);
    const taskDir = joinPath(UPLOAD_DIR, taskId);
    await fs.mkdir(taskDir, { recursive: true });
    const storagePath = joinPath(taskId, `${id}${ext}`); // relativ zu UPLOAD_DIR
    const absPath = joinPath(UPLOAD_DIR, storagePath);
    const buf = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(absPath, buf);

    const [row] = await db
      .insert(taskAttachments)
      .values({
        id,
        taskId,
        uploaderId: me.id,
        filename: file.name.slice(0, 300),
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        storagePath,
      })
      .returning();
    return c.json({ attachment: row }, 201);
  })

  // GET /:id/attachments — Liste aller Attachments dieser Task
  .get('/:id/attachments', async (c) => {
    const me = c.get('user')!;
    const taskId = c.req.param('id');
    const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
    if (!task) return c.json({ error: 'task_not_found' }, 404);
    if (task.projectId) {
      const { ids } = await listVisibleProjectIds(me.id, me.role);
      if (!ids.includes(task.projectId)) return c.json({ error: 'forbidden' }, 403);
    }
    const rows = await db
      .select({
        id: taskAttachments.id,
        taskId: taskAttachments.taskId,
        uploaderId: taskAttachments.uploaderId,
        filename: taskAttachments.filename,
        mimeType: taskAttachments.mimeType,
        sizeBytes: taskAttachments.sizeBytes,
        createdAt: taskAttachments.createdAt,
      })
      .from(taskAttachments)
      .where(eq(taskAttachments.taskId, taskId))
      .orderBy(desc(taskAttachments.createdAt));
    return c.json({ attachments: rows });
  })

  // GET /:id/attachments/:attachmentId/download — Streaming-Download.
  // Content-Disposition: attachment, damit der Browser nichts inline rendert
  // (kein XSS-Risiko durch hochgeladene HTML/SVG/PDF).
  .get('/:id/attachments/:attachmentId/download', async (c) => {
    const me = c.get('user')!;
    const taskId = c.req.param('id');
    const attachmentId = c.req.param('attachmentId');
    const [row] = await db
      .select()
      .from(taskAttachments)
      .where(and(eq(taskAttachments.id, attachmentId), eq(taskAttachments.taskId, taskId)))
      .limit(1);
    if (!row) return c.json({ error: 'not_found' }, 404);

    const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
    if (!task) return c.json({ error: 'task_not_found' }, 404);
    if (task.projectId) {
      const { ids } = await listVisibleProjectIds(me.id, me.role);
      if (!ids.includes(task.projectId)) return c.json({ error: 'forbidden' }, 403);
    }

    const absPath = joinPath(UPLOAD_DIR, row.storagePath);
    try {
      await fs.access(absPath);
    } catch {
      return c.json({ error: 'storage_missing' }, 410);
    }
    const stream = createReadStream(absPath);
    const webStream = Readable.toWeb(stream) as ReadableStream<Uint8Array>;
    // Safe filename für Content-Disposition (RFC 6266)
    const safeName = row.filename.replace(/["\\\r\n]/g, '_');
    return new Response(webStream, {
      status: 200,
      headers: {
        'Content-Type': row.mimeType || 'application/octet-stream',
        'Content-Length': String(row.sizeBytes),
        'Content-Disposition': `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(row.filename)}`,
        'Cache-Control': 'private, max-age=300',
      },
    });
  })

  // DELETE /:id/attachments/:attachmentId — nur Uploader oder Admin.
  .delete('/:id/attachments/:attachmentId', async (c) => {
    const me = c.get('user')!;
    const taskId = c.req.param('id');
    const attachmentId = c.req.param('attachmentId');
    const [row] = await db
      .select()
      .from(taskAttachments)
      .where(and(eq(taskAttachments.id, attachmentId), eq(taskAttachments.taskId, taskId)))
      .limit(1);
    if (!row) return c.json({ error: 'not_found' }, 404);
    if (me.role !== 'admin' && row.uploaderId !== me.id) {
      return c.json({ error: 'forbidden' }, 403);
    }
    // Erst DB-Eintrag löschen, dann File. Falls File-Delete fehlschlägt
    // (z.B. schon weg) → kein Rollback, nur log. Orphans sind harmlos.
    await db.delete(taskAttachments).where(eq(taskAttachments.id, attachmentId));
    try {
      await fs.unlink(joinPath(UPLOAD_DIR, row.storagePath));
    } catch (e) {
      console.warn('[attachments] unlink failed for', row.storagePath, e);
    }
    return c.json({ ok: true });
  })

  // ── Checklisten (FCXVQOSTCFp) ───────────────────────────────────────
  .get('/:id/checklist', async (c) => {
    const taskId = c.req.param('id');
    const items = await db
      .select()
      .from(taskChecklistItems)
      .where(eq(taskChecklistItems.taskId, taskId))
      .orderBy(asc(taskChecklistItems.sortOrder));
    return c.json({ items });
  })
  .post('/:id/checklist', async (c) => {
    const taskId = c.req.param('id');
    const { text } = z.object({ text: z.string().min(1).max(500) }).parse(await c.req.json());
    // Nächste sortOrder bestimmen (max + 1)
    const [maxRow] = await db
      .select({ max: sql<number>`coalesce(max(${taskChecklistItems.sortOrder}), 0)` })
      .from(taskChecklistItems)
      .where(eq(taskChecklistItems.taskId, taskId));
    const sortOrder = (maxRow?.max ?? 0) + 1;
    const id = `CL${nanoid(10)}`;
    const [row] = await db
      .insert(taskChecklistItems)
      .values({ id, taskId, text, done: false, sortOrder })
      .returning();
    return c.json({ item: row }, 201);
  })
  .patch('/:id/checklist/:itemId', async (c) => {
    const itemId = c.req.param('itemId');
    const body = z
      .object({ text: z.string().min(1).max(500).optional(), done: z.boolean().optional() })
      .parse(await c.req.json());
    const patch: { text?: string; done?: boolean; updatedAt: Date } = { updatedAt: new Date() };
    if (body.text !== undefined) patch.text = body.text;
    if (body.done !== undefined) patch.done = body.done;
    const [row] = await db
      .update(taskChecklistItems)
      .set(patch)
      .where(eq(taskChecklistItems.id, itemId))
      .returning();
    if (!row) return c.json({ error: 'not found' }, 404);
    return c.json({ item: row });
  })
  .delete('/:id/checklist/:itemId', async (c) => {
    const itemId = c.req.param('itemId');
    await db.delete(taskChecklistItems).where(eq(taskChecklistItems.id, itemId));
    return c.json({ ok: true });
  });

// ── Helper: Owner-Notification beim Review-Wechsel ────────────────────
// Schreibt einen Inbox-Eintrag (kind = 'review_request') für den Projekt-
// Owner und triggert die existierende Notification-Mail-Pipeline (Mention-
// Mail-Toggle wird hier ignoriert; Owner-Reviews sind wichtiger als der
// allgemeine Mention-Setting-Toggle, sollen aber im Digest mitlaufen).

// FclpRr066St: Wenn ein Timer auf eine Aufgabe lief die vorher NICHT in 'doing'
// war, schieben wir sie beim Stop zurueck in die alte Spalte. Aber nur, wenn:
//   - previousColumn gespeichert ist (sonst war Task schon in 'doing')
//   - die Task aktuell noch in 'doing' steht (sonst hat jemand sie manuell weiterverschoben)
// review/done werden nicht zurueckgezogen — finale Stati respektieren.
async function restorePreviousColumn(taskId: string, previousColumn: string | null): Promise<void> {
  if (!previousColumn) return;
  if (previousColumn === 'review' || previousColumn === 'done') return;
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task || task.column !== 'doing') return;
  await db
    .update(tasks)
    .set({ column: previousColumn as 'todo' | 'planned' | 'doing' | 'review' | 'done', updatedAt: new Date() })
    .where(eq(tasks.id, taskId));
}

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
