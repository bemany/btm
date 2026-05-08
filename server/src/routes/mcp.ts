// MCP-Server: HTTP-Streamable-Transport mit JSON-RPC-2.0.
// Auth via Bearer-API-Token (gleicher Mechanismus wie REST).
//
// Claude Desktop / Web binden ihn über die URL:
//   https://btm.bethesna.org/api/mcp
// mit Header `Authorization: Bearer btm_<token>`.
//
// Implementiert die Kern-Methoden (initialize, tools/list, tools/call) +
// notifications/initialized. Reicht für Claude.

import { Hono } from 'hono';
import { z } from 'zod';
import { and, eq, desc, asc, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/client.js';
import { tasks, projects, users, liveTimers, taskSessions, activityLog } from '../db/schema.js';
import { requireAuth, type Variables } from '../lib/context.js';
import { logActivity } from '../lib/activity.js';

// ── Tool-Schemas (JSON-Schema für MCP) ─────────────────────────────────

const COL = ['todo', 'planned', 'doing', 'review', 'done'] as const;
const PRIO = ['low', 'med', 'high'] as const;

export const TOOLS = [
  {
    name: 'me',
    description:
      'Liefert Identität des aktuellen Users (id, email, name, role). Nützlich um zu prüfen wer der API-Token-Inhaber ist.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_tasks',
    description:
      'Listet Aufgaben. Optional gefiltert nach column (todo=Backlog, planned=Zu erledigen, doing=In Arbeit, review, done), assignee_id, project_id.',
    inputSchema: {
      type: 'object',
      properties: {
        column: { type: 'string', enum: [...COL] },
        assignee_id: { type: 'string' },
        project_id: { type: 'string' },
        only_mine: { type: 'boolean', description: 'Nur Aufgaben des Token-Inhabers' },
      },
    },
  },
  {
    name: 'create_task',
    description: 'Legt eine neue Aufgabe an. Title ist Pflicht.',
    inputSchema: {
      type: 'object',
      required: ['title'],
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        column: { type: 'string', enum: [...COL], default: 'todo' },
        priority: { type: 'string', enum: [...PRIO], default: 'med' },
        est_h: { type: 'number', minimum: 0, maximum: 200 },
        due: { type: 'string', description: "ISO-Date oder 'today'/'tomorrow'" },
        project_id: { type: 'string' },
        assignee_id: { type: 'string', description: 'Default: Token-Inhaber' },
      },
    },
  },
  {
    name: 'update_task',
    description: 'Aktualisiert eine bestehende Aufgabe.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        column: { type: 'string', enum: [...COL] },
        priority: { type: 'string', enum: [...PRIO] },
        est_h: { type: 'number' },
        due: { type: 'string' },
        project_id: { type: 'string' },
        assignee_id: { type: 'string' },
      },
    },
  },
  {
    name: 'move_task',
    description: 'Schiebt eine Aufgabe in eine andere Spalte.',
    inputSchema: {
      type: 'object',
      required: ['id', 'column'],
      properties: { id: { type: 'string' }, column: { type: 'string', enum: [...COL] } },
    },
  },
  {
    name: 'delete_task',
    description: 'Löscht eine Aufgabe.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string' } },
    },
  },
  {
    name: 'list_projects',
    description: 'Alle Projekte.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'create_project',
    description: 'Legt ein neues Projekt an.',
    inputSchema: {
      type: 'object',
      required: ['code', 'name'],
      properties: {
        code: { type: 'string' },
        name: { type: 'string' },
        color: { type: 'string', description: 'Hex z.B. #C85A2C' },
        client: { type: 'string' },
        due: { type: 'string', description: 'ISO-Date' },
      },
    },
  },
  {
    name: 'list_users',
    description: 'Alle aktiven User mit id, email, name, role.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'start_timer',
    description: 'Startet Live-Timer für eine Aufgabe (stoppt vorherigen automatisch).',
    inputSchema: {
      type: 'object',
      required: ['task_id'],
      properties: { task_id: { type: 'string' }, pomodoro: { type: 'boolean', default: true } },
    },
  },
  {
    name: 'stop_timer',
    description: 'Stoppt aktuellen Live-Timer + bucht Session.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_live_timer',
    description: 'Liefert aktuellen Live-Timer-Status (oder null).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_week',
    description: 'Wochenübersicht: alle eigenen Aufgaben + Stunden + Live-Timer.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_activity',
    description: 'Letzte Aktivitäten (Audit-Log). Default 50 Einträge.',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'number', minimum: 1, maximum: 200 } },
    },
  },
] as const;

// ── Tool-Implementierungen ────────────────────────────────────────────

export interface ToolCtx {
  userId: string;
  userRole: 'admin' | 'member';
}

export const handlers: Record<string, (args: Record<string, unknown>, ctx: ToolCtx) => Promise<unknown>> = {
  me: async (_args, ctx) => {
    const [u] = await db.select().from(users).where(eq(users.id, ctx.userId)).limit(1);
    if (!u) throw new Error('user not found');
    return {
      id: u.id, email: u.email, name: u.name, role: u.role, status: u.status,
      cap: u.cap, color: u.color, jobTitle: u.jobTitle, teamId: u.teamId,
    };
  },

  list_tasks: async (args, ctx) => {
    const filters = [];
    if (args.column) filters.push(eq(tasks.column, args.column as any));
    if (args.assignee_id) filters.push(eq(tasks.assigneeId, args.assignee_id as string));
    if (args.project_id) filters.push(eq(tasks.projectId, args.project_id as string));
    if (args.only_mine) filters.push(eq(tasks.assigneeId, ctx.userId));
    const where = filters.length === 0 ? undefined : filters.length === 1 ? filters[0] : and(...filters);
    const rows = await (where ? db.select().from(tasks).where(where) : db.select().from(tasks))
      .orderBy(asc(tasks.sortOrder), asc(tasks.createdAt))
      .limit(200);
    return { tasks: rows };
  },

  create_task: async (args, ctx) => {
    const schema = z.object({
      title: z.string().min(1).max(300),
      description: z.string().max(10_000).optional(),
      column: z.enum(COL).default('todo'),
      priority: z.enum(PRIO).default('med'),
      est_h: z.number().min(0).max(200).default(1),
      due: z.string().optional(),
      project_id: z.string().optional(),
      assignee_id: z.string().optional(),
    });
    const v = schema.parse(args);
    const id = `T${nanoid(8)}`;
    const [row] = await db
      .insert(tasks)
      .values({
        id,
        title: v.title,
        description: v.description ?? null,
        column: v.column,
        priority: v.priority,
        estH: v.est_h,
        due: v.due ?? null,
        projectId: v.project_id ?? null,
        assigneeId: v.assignee_id ?? ctx.userId,
        createdById: ctx.userId,
      })
      .returning();
    logActivity({ kind: 'task_created', actorId: ctx.userId, target: id, meta: { title: row.title, via: 'mcp' } });
    return { task: row };
  },

  update_task: async (args, ctx) => {
    const schema = z.object({
      id: z.string(),
      title: z.string().optional(),
      description: z.string().optional(),
      column: z.enum(COL).optional(),
      priority: z.enum(PRIO).optional(),
      est_h: z.number().optional(),
      due: z.string().optional(),
      project_id: z.string().optional(),
      assignee_id: z.string().optional(),
    });
    const v = schema.parse(args);
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (v.title !== undefined) patch.title = v.title;
    if (v.description !== undefined) patch.description = v.description;
    if (v.column !== undefined) patch.column = v.column;
    if (v.priority !== undefined) patch.priority = v.priority;
    if (v.est_h !== undefined) patch.estH = v.est_h;
    if (v.due !== undefined) patch.due = v.due;
    if (v.project_id !== undefined) patch.projectId = v.project_id;
    if (v.assignee_id !== undefined) patch.assigneeId = v.assignee_id;
    const [row] = await db.update(tasks).set(patch as any).where(eq(tasks.id, v.id)).returning();
    if (!row) throw new Error('task not found');
    logActivity({ kind: v.column ? 'task_moved' : 'task_updated', actorId: ctx.userId, target: v.id, meta: { via: 'mcp', ...v } });
    return { task: row };
  },

  move_task: async (args, ctx) => {
    return handlers.update_task({ id: args.id, column: args.column }, ctx);
  },

  delete_task: async (args, ctx) => {
    const id = z.string().parse(args.id);
    const r = await db.delete(tasks).where(eq(tasks.id, id)).returning();
    if (!r.length) throw new Error('task not found');
    logActivity({ kind: 'task_deleted', actorId: ctx.userId, target: id, meta: { via: 'mcp' } });
    return { ok: true };
  },

  list_projects: async () => {
    const rows = await db.select().from(projects).orderBy(asc(projects.code));
    return { projects: rows };
  },

  create_project: async (args, ctx) => {
    const v = z
      .object({
        code: z.string().min(1).max(40),
        name: z.string().min(1).max(200),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#6B6359'),
        client: z.string().optional(),
        due: z.string().optional(),
      })
      .parse(args);
    const id = `P${nanoid(8)}`;
    const [row] = await db
      .insert(projects)
      .values({
        id,
        code: v.code,
        name: v.name,
        color: v.color,
        client: v.client ?? null,
        due: v.due ?? null,
        createdById: ctx.userId,
      })
      .returning();
    logActivity({ kind: 'project_created', actorId: ctx.userId, target: id, meta: { ...v, via: 'mcp' } });
    return { project: row };
  },

  list_users: async () => {
    const rows = await db
      .select({
        id: users.id, email: users.email, name: users.name, role: users.role,
        status: users.status, cap: users.cap, color: users.color,
      })
      .from(users)
      .orderBy(asc(users.name));
    return { users: rows.filter((u) => u.status === 'active') };
  },

  start_timer: async (args, ctx) => {
    const task_id = z.string().parse(args.task_id);
    const pomodoro = z.boolean().default(true).parse(args.pomodoro);

    // Stop existing timer if present (mit Session-Buchung)
    const [existing] = await db.select().from(liveTimers).where(eq(liveTimers.userId, ctx.userId)).limit(1);
    if (existing) {
      const now = new Date();
      const hours = (now.getTime() - existing.startedAt.getTime()) / 3_600_000;
      await db.insert(taskSessions).values({
        id: `S${nanoid(8)}`,
        taskId: existing.taskId,
        userId: ctx.userId,
        fromAt: existing.startedAt,
        toAt: now,
        hours: Number(hours.toFixed(4)),
        source: 'timer',
      });
      await db.update(tasks).set({ loggedH: sql`${tasks.loggedH} + ${hours}` }).where(eq(tasks.id, existing.taskId));
      await db.delete(liveTimers).where(eq(liveTimers.userId, ctx.userId));
    }

    const startedAt = new Date();
    const [row] = await db
      .insert(liveTimers)
      .values({
        userId: ctx.userId,
        taskId: task_id,
        startedAt,
        pomodoroEnabled: pomodoro,
        pomodoroStartedAt: pomodoro ? startedAt : null,
      })
      .returning();
    logActivity({ kind: 'timer_started', actorId: ctx.userId, target: task_id, meta: { via: 'mcp' } });
    return { live_timer: row };
  },

  stop_timer: async (_args, ctx) => {
    const [existing] = await db.select().from(liveTimers).where(eq(liveTimers.userId, ctx.userId)).limit(1);
    if (!existing) return { live_timer: null };
    const now = new Date();
    const hours = (now.getTime() - existing.startedAt.getTime()) / 3_600_000;
    const [session] = await db
      .insert(taskSessions)
      .values({
        id: `S${nanoid(8)}`,
        taskId: existing.taskId,
        userId: ctx.userId,
        fromAt: existing.startedAt,
        toAt: now,
        hours: Number(hours.toFixed(4)),
        source: 'timer',
      })
      .returning();
    await db.update(tasks).set({ loggedH: sql`${tasks.loggedH} + ${hours}` }).where(eq(tasks.id, existing.taskId));
    await db.delete(liveTimers).where(eq(liveTimers.userId, ctx.userId));
    logActivity({ kind: 'timer_stopped', actorId: ctx.userId, target: existing.taskId, meta: { via: 'mcp', hours: Number(hours.toFixed(2)) } });
    return { live_timer: null, session };
  },

  get_live_timer: async (_args, ctx) => {
    const [row] = await db.select().from(liveTimers).where(eq(liveTimers.userId, ctx.userId)).limit(1);
    return { live_timer: row ?? null };
  },

  list_week: async (_args, ctx) => {
    const myTasks = await db.select().from(tasks).where(eq(tasks.assigneeId, ctx.userId));
    const [live] = await db.select().from(liveTimers).where(eq(liveTimers.userId, ctx.userId)).limit(1);
    const planned = myTasks.filter((t) => t.column !== 'done').reduce((a, t) => a + Number(t.estH), 0);
    const logged = myTasks.reduce((a, t) => a + Number(t.loggedH), 0);
    return {
      tasks: myTasks,
      live_timer: live ?? null,
      summary: {
        total: myTasks.length,
        open: myTasks.filter((t) => t.column !== 'done').length,
        in_progress: myTasks.filter((t) => t.column === 'doing').length,
        done: myTasks.filter((t) => t.column === 'done').length,
        planned_h: Number(planned.toFixed(2)),
        logged_h: Number(logged.toFixed(2)),
      },
    };
  },

  list_activity: async (args) => {
    const limit = z.number().min(1).max(200).default(50).parse(args.limit ?? 50);
    const rows = await db.select().from(activityLog).orderBy(desc(activityLog.createdAt)).limit(limit);
    return { activity: rows };
  },
};

// ── JSON-RPC-Endpoint ─────────────────────────────────────────────────

const rpcSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number(), z.null()]).optional(),
  method: z.string(),
  params: z.record(z.unknown()).optional(),
});

interface RpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

function rpcResult(id: string | number | null | undefined, result: unknown): RpcResponse {
  return { jsonrpc: '2.0', id: id ?? null, result };
}
function rpcError(id: string | number | null | undefined, code: number, message: string, data?: unknown): RpcResponse {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message, data } };
}

const SERVER_INFO = {
  name: 'btm-mcp',
  version: '0.1.0',
};

export const mcpRoute = new Hono<{ Variables: Variables }>()
  // GET /api/mcp → simple Status, plus 405 für GET ohne Streaming-Setup
  .get('/', (c) =>
    c.json({
      ok: true,
      server: SERVER_INFO,
      transport: 'http-streamable',
      auth: 'Bearer api-token (siehe Profile → API-Tokens)',
      tools: TOOLS.length,
      hint: 'POST JSON-RPC 2.0 mit Authorization: Bearer btm_<token>',
    }),
  )
  // POST: JSON-RPC-2.0
  .use('*', requireAuth)
  .post('/', async (c) => {
    const me = c.get('user')!;
    const ctx: ToolCtx = { userId: me.id, userRole: me.role };
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(rpcError(null, -32700, 'Parse error'), 400);
    }
    const arr = Array.isArray(body) ? body : [body];
    const responses: RpcResponse[] = [];

    // Debug-Logging: was schickt der Client?
    const ua = c.req.header('user-agent') ?? '';
    const sid = c.req.header('mcp-session-id') ?? '';
    const proto = c.req.header('mcp-protocol-version') ?? '';
    const methods = arr.map((r: any) => r?.method).filter(Boolean).join(',');
    if (ua.toLowerCase().includes('claude') || methods) {
      console.log(`[mcp] req ua="${ua}" sid="${sid}" proto="${proto}" methods=[${methods}]`);
    }

    for (const raw of arr) {
      let parsed;
      try {
        parsed = rpcSchema.parse(raw);
      } catch (e) {
        responses.push(rpcError((raw as { id?: string | number }).id, -32600, 'Invalid Request', e instanceof Error ? e.message : undefined));
        continue;
      }

      const id = parsed.id;
      const params = parsed.params ?? {};

      try {
        switch (parsed.method) {
          case 'initialize': {
            // Spec: server picks highest mutually-compatible protocol version.
            // Wir unterstützen alle Versionen ab 2024-11-05 — am einfachsten
            // ist es, die vom Client angefragte Version zurückzuspiegeln, wenn
            // sie aus der bekannten Liste stammt. Sonst Default 2025-06-18.
            const SUPPORTED_VERSIONS = [
              '2024-11-05',
              '2025-03-26',
              '2025-06-18',
              '2025-11-25',
            ];
            const requested = String(params.protocolVersion ?? '');
            const protocolVersion = SUPPORTED_VERSIONS.includes(requested) ? requested : '2025-06-18';
            console.log(`[mcp] initialize from ${(params.clientInfo as any)?.name ?? '?'} v=${requested} → ${protocolVersion}`);
            responses.push(
              rpcResult(id, {
                protocolVersion,
                serverInfo: SERVER_INFO,
                capabilities: { tools: { listChanged: false } },
                instructions:
                  'BTM MCP server: tasks, projects and timer for Bethesna Task Management. Authenticated via API token. Available tools: ' +
                  TOOLS.map((t) => t.name).join(', ') + '.',
              }),
            );
            break;
          }

          case 'notifications/initialized':
            // Notification (id meist null) — keine Antwort nötig wenn id fehlt.
            if (id != null) responses.push(rpcResult(id, null));
            break;

          case 'tools/list':
            responses.push(rpcResult(id, { tools: TOOLS }));
            break;

          case 'tools/call': {
            const name = String(params.name ?? '');
            const args = (params.arguments ?? {}) as Record<string, unknown>;
            const handler = handlers[name];
            if (!handler) {
              responses.push(rpcError(id, -32601, `Unknown tool: ${name}`));
              break;
            }
            try {
              const result = await handler(args, ctx);
              responses.push(
                rpcResult(id, {
                  content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
                  isError: false,
                }),
              );
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              responses.push(
                rpcResult(id, {
                  content: [{ type: 'text', text: `Error: ${msg}` }],
                  isError: true,
                }),
              );
            }
            break;
          }

          case 'ping':
            responses.push(rpcResult(id, {}));
            break;

          default:
            responses.push(rpcError(id, -32601, `Method not found: ${parsed.method}`));
        }
      } catch (e) {
        responses.push(rpcError(id, -32603, 'Internal error', e instanceof Error ? e.message : undefined));
      }
    }

    if (responses.length === 0) return c.body(null, 204);

    // Mcp-Session-Id: nur beim initialize-Response setzen (Claude.ai-Connector
    // erwartet/respektiert den Header). Stateless-Server — die ID dient nur
    // der Client-Tracking; wir nutzen sie nicht.
    const isInit = arr.some((r: any) => r?.method === 'initialize');
    if (isInit) {
      c.header('Mcp-Session-Id', `btm-${nanoid(16)}`);
    }

    if (responses.length === 1 && !Array.isArray(body)) return c.json(responses[0]);
    return c.json(responses);
  });
