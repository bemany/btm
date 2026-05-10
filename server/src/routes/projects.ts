import { Hono } from 'hono';
import { and, eq, asc, isNull, or, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { db } from '../db/client.js';
import { projects, projectMembers, users } from '../db/schema.js';
import { requireAuth, type Variables } from '../lib/context.js';
import { logActivity } from '../lib/activity.js';
import { listVisibleProjectIds } from '../lib/project-visibility.js';

const createSchema = z.object({
  code: z.string().min(1).max(40),
  name: z.string().min(1).max(200),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  client: z.string().max(200).optional().nullable(),
  due: z.string().nullable().optional(),
  ownerId: z.string().nullable().optional(),
});

const updateSchema = createSchema.partial();

const RoleEnum = z.enum(['owner', 'member', 'viewer']);
const memberAddSchema = z.object({
  userId: z.string().min(1),
  role: RoleEnum.default('member'),
});
const memberPatchSchema = z.object({ role: RoleEnum });

export const projectsRoute = new Hono<{ Variables: Variables }>()
  .use('*', requireAuth)
  .get('/', async (c) => {
    const me = c.get('user')!;
    // Sichtbarkeit gemäß Membership-Regeln (siehe project-visibility.ts):
    // Admin sieht alles, sonst nur Projekte in denen man Owner / Member ist
    // bzw. Legacy-Projekte ohne Member-Liste.
    const { ids } = await listVisibleProjectIds(me.id, me.role);
    if (ids.length === 0) return c.json({ projects: [] });
    const list = await db
      .select()
      .from(projects)
      .where(inArray(projects.id, ids))
      .orderBy(asc(projects.code));
    return c.json({ projects: list });
  })
  .post('/', async (c) => {
    const user = c.get('user')!;
    const body = createSchema.parse(await c.req.json());
    const id = `P${nanoid(8)}`;
    const [row] = await db
      .insert(projects)
      .values({ id, createdById: user.id, ...body })
      .returning();
    logActivity({ kind: 'project_created', actorId: user.id, target: id, meta: { code: row.code, name: row.name } });
    return c.json({ project: row }, 201);
  })
  .patch('/:id', async (c) => {
    const me = c.get('user')!;
    const id = c.req.param('id');
    const body = updateSchema.parse(await c.req.json());
    const [row] = await db
      .update(projects)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    if (!row) return c.json({ error: 'not found' }, 404);
    logActivity({ kind: 'project_updated', actorId: me.id, target: id, meta: { code: row.code } });
    return c.json({ project: row });
  })
  .delete('/:id', async (c) => {
    const me = c.get('user')!;
    const id = c.req.param('id');
    const [before] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    const result = await db.delete(projects).where(eq(projects.id, id)).returning();
    if (!result.length) return c.json({ error: 'not found' }, 404);
    logActivity({ kind: 'project_deleted', actorId: me.id, target: id, meta: { code: before?.code } });
    return c.json({ ok: true });
  })

  // ── Member-Verwaltung ─────────────────────────────────────────────
  // GET  /:id/members           — Mitglieder + Rollen + User-Snapshot
  // POST /:id/members           — User mit Rolle hinzufügen
  // PATCH /:id/members/:userId  — Rolle ändern
  // DELETE /:id/members/:userId — User entfernen
  //
  // Berechtigt sind: Admin, Projekt-Owner (Verantwortlicher) oder bereits
  // eingetragener Owner-Member. „Member"/„Viewer" dürfen nichts ändern.

  .get('/:id/members', async (c) => {
    const id = c.req.param('id');
    const rows = await db
      .select({
        userId: projectMembers.userId,
        role: projectMembers.role,
        addedAt: projectMembers.addedAt,
        name: users.name,
        email: users.email,
        image: users.image,
        color: users.color,
      })
      .from(projectMembers)
      .leftJoin(users, eq(projectMembers.userId, users.id))
      .where(eq(projectMembers.projectId, id));
    return c.json({ members: rows });
  })
  .post('/:id/members', async (c) => {
    const me = c.get('user')!;
    const id = c.req.param('id');
    if (!(await canManageProject(me.id, me.role, id))) {
      return c.json({ error: 'forbidden' }, 403);
    }
    const body = memberAddSchema.parse(await c.req.json());
    // Idempotent: ON CONFLICT do update (Rolle aktualisieren)
    await db
      .insert(projectMembers)
      .values({ projectId: id, userId: body.userId, role: body.role })
      .onConflictDoUpdate({
        target: [projectMembers.projectId, projectMembers.userId],
        set: { role: body.role },
      });
    logActivity({
      kind: 'project_updated',
      actorId: me.id,
      target: id,
      meta: { memberAdded: body.userId, role: body.role },
    });
    return c.json({ ok: true }, 201);
  })
  .patch('/:id/members/:userId', async (c) => {
    const me = c.get('user')!;
    const id = c.req.param('id');
    const userId = c.req.param('userId');
    if (!(await canManageProject(me.id, me.role, id))) {
      return c.json({ error: 'forbidden' }, 403);
    }
    const body = memberPatchSchema.parse(await c.req.json());
    const result = await db
      .update(projectMembers)
      .set({ role: body.role })
      .where(and(eq(projectMembers.projectId, id), eq(projectMembers.userId, userId)))
      .returning();
    if (!result.length) return c.json({ error: 'not found' }, 404);
    return c.json({ ok: true });
  })
  .delete('/:id/members/:userId', async (c) => {
    const me = c.get('user')!;
    const id = c.req.param('id');
    const userId = c.req.param('userId');
    if (!(await canManageProject(me.id, me.role, id))) {
      return c.json({ error: 'forbidden' }, 403);
    }
    await db
      .delete(projectMembers)
      .where(and(eq(projectMembers.projectId, id), eq(projectMembers.userId, userId)));
    return c.json({ ok: true });
  });

/**
 * Darf der User die Mitglieder eines Projekts verwalten?
 * Admins immer; sonst nur der eingetragene `ownerId` des Projekts oder
 * ein Member mit Rolle 'owner'.
 */
async function canManageProject(
  userId: string,
  role: 'admin' | 'member',
  projectId: string,
): Promise<boolean> {
  if (role === 'admin') return true;
  const [proj] = await db
    .select({ ownerId: projects.ownerId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (proj?.ownerId === userId) return true;
  const [m] = await db
    .select({ role: projectMembers.role })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .limit(1);
  return m?.role === 'owner';
}

// Re-export für andere Module (tasks.ts braucht owner-check)
void inArray;
