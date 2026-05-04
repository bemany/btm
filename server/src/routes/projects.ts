import { Hono } from 'hono';
import { eq, asc } from 'drizzle-orm';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { db } from '../db/client.js';
import { projects } from '../db/schema.js';
import { requireAuth, type Variables } from '../lib/context.js';

const createSchema = z.object({
  code: z.string().min(1).max(40),
  name: z.string().min(1).max(200),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  client: z.string().max(200).optional().nullable(),
  due: z.string().nullable().optional(),
});

const updateSchema = createSchema.partial();

export const projectsRoute = new Hono<{ Variables: Variables }>()
  .use('*', requireAuth)
  .get('/', async (c) => {
    const list = await db.select().from(projects).orderBy(asc(projects.code));
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
    return c.json({ project: row }, 201);
  })
  .patch('/:id', async (c) => {
    const id = c.req.param('id');
    const body = updateSchema.parse(await c.req.json());
    const [row] = await db
      .update(projects)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    if (!row) return c.json({ error: 'not found' }, 404);
    return c.json({ project: row });
  })
  .delete('/:id', async (c) => {
    const id = c.req.param('id');
    const result = await db.delete(projects).where(eq(projects.id, id)).returning();
    if (!result.length) return c.json({ error: 'not found' }, 404);
    return c.json({ ok: true });
  });
