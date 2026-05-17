// Fm16BUutfUO: Admin-Routes für die E-Mail-Domain-Whitelist.
// GET  /api/allowed-domains       — Liste (alle eingeloggten User dürfen lesen)
// POST /api/allowed-domains       — Domain hinzufügen (Admin)
// DELETE /api/allowed-domains/:id — Domain entfernen (Admin)

import { Hono } from 'hono';
import { eq, asc } from 'drizzle-orm';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { db } from '../db/client.js';
import { allowedDomains } from '../db/schema.js';
import { requireAuth, type Variables } from '../lib/context.js';

const createSchema = z.object({
  domain: z
    .string()
    .min(3)
    .max(253)
    .regex(/^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i, 'invalid domain'),
});

export const allowedDomainsRoute = new Hono<{ Variables: Variables }>()
  .use('*', requireAuth)
  .get('/', async (c) => {
    const list = await db.select().from(allowedDomains).orderBy(asc(allowedDomains.domain));
    return c.json({ domains: list });
  })
  .post('/', async (c) => {
    const me = c.get('user')!;
    if (me.role !== 'admin') return c.json({ error: 'forbidden' }, 403);
    const { domain } = createSchema.parse(await c.req.json());
    const lower = domain.toLowerCase().trim();
    const id = `AD${nanoid(10)}`;
    try {
      const [row] = await db
        .insert(allowedDomains)
        .values({ id, domain: lower, addedById: me.id })
        .returning();
      return c.json({ domain: row }, 201);
    } catch (e: unknown) {
      // Unique-Conflict → 409
      const msg = (e as Error)?.message ?? '';
      if (msg.includes('duplicate') || msg.includes('unique')) {
        return c.json({ error: 'duplicate' }, 409);
      }
      throw e;
    }
  })
  .delete('/:id', async (c) => {
    const me = c.get('user')!;
    if (me.role !== 'admin') return c.json({ error: 'forbidden' }, 403);
    const id = c.req.param('id');
    await db.delete(allowedDomains).where(eq(allowedDomains.id, id));
    return c.json({ ok: true });
  });
