import { Hono } from 'hono';
import { eq, asc, count } from 'drizzle-orm';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { db } from '../db/client.js';
import { teams, users } from '../db/schema.js';
import { requireAuth, requireAdmin, type Variables } from '../lib/context.js';
import { logActivity } from '../lib/activity.js';

const createSchema = z.object({
  name: z.string().min(1).max(80),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#5E7F4E'),
});

const updateSchema = createSchema.partial();

export const teamsRoute = new Hono<{ Variables: Variables }>()
  .use('*', requireAuth)
  .get('/', async (c) => {
    const list = await db.select().from(teams).orderBy(asc(teams.name));
    // Mitgliederzahl pro Team mitliefern
    const counts = await db
      .select({ teamId: users.teamId, n: count(users.id) })
      .from(users)
      .groupBy(users.teamId);
    const countByTeam = new Map(counts.filter((c) => c.teamId).map((c) => [c.teamId!, Number(c.n)]));
    return c.json({
      teams: list.map((t) => ({ ...t, memberCount: countByTeam.get(t.id) ?? 0 })),
    });
  })
  .post('/', requireAdmin, async (c) => {
    const me = c.get('user')!;
    const body = createSchema.parse(await c.req.json());
    const id = `TM${nanoid(8)}`;
    const [row] = await db.insert(teams).values({ id, ...body, createdById: me.id }).returning();
    logActivity({ kind: 'team_created', actorId: me.id, target: id, meta: { name: row.name } });
    return c.json({ team: { ...row, memberCount: 0 } }, 201);
  })
  .patch('/:id', requireAdmin, async (c) => {
    const me = c.get('user')!;
    const id = c.req.param('id');
    const body = updateSchema.parse(await c.req.json());
    const [row] = await db
      .update(teams)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(teams.id, id))
      .returning();
    if (!row) return c.json({ error: 'not found' }, 404);
    logActivity({ kind: 'team_updated', actorId: me.id, target: id, meta: body });
    return c.json({ team: row });
  })
  .delete('/:id', requireAdmin, async (c) => {
    const me = c.get('user')!;
    const id = c.req.param('id');
    // Nur löschen wenn keine Mitglieder
    const [{ n }] = await db
      .select({ n: count(users.id) })
      .from(users)
      .where(eq(users.teamId, id));
    if (Number(n) > 0) return c.json({ error: 'team has members' }, 409);
    const result = await db.delete(teams).where(eq(teams.id, id)).returning();
    if (!result.length) return c.json({ error: 'not found' }, 404);
    logActivity({ kind: 'team_deleted', actorId: me.id, target: id });
    return c.json({ ok: true });
  });
