import { Hono } from 'hono';
import { and, eq, asc, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { db } from '../db/client.js';
import { apiTokens } from '../db/schema.js';
import { requireAuth, type Variables } from '../lib/context.js';
import { generateApiToken } from '../lib/api-token.js';

const createSchema = z.object({
  name: z.string().min(1).max(120),
  scopes: z.array(z.enum(['read', 'write'])).default(['read', 'write']),
  expiresAt: z.string().nullable().optional(),
});

export const apiTokensRoute = new Hono<{ Variables: Variables }>()
  .use('*', requireAuth)
  .get('/', async (c) => {
    const user = c.get('user')!;
    const list = await db
      .select({
        id: apiTokens.id,
        name: apiTokens.name,
        prefix: apiTokens.prefix,
        scopes: apiTokens.scopes,
        lastUsedAt: apiTokens.lastUsedAt,
        expiresAt: apiTokens.expiresAt,
        createdAt: apiTokens.createdAt,
        revokedAt: apiTokens.revokedAt,
      })
      .from(apiTokens)
      .where(and(eq(apiTokens.userId, user.id), isNull(apiTokens.revokedAt)))
      .orderBy(asc(apiTokens.createdAt));
    return c.json({ tokens: list });
  })
  .post('/', async (c) => {
    const user = c.get('user')!;
    // API-Tokens nur via Session-Cookie erstellen — nicht mit anderem Token bootstrappen
    if (c.get('authMode') !== 'session') {
      return c.json({ error: 'create requires browser session login' }, 403);
    }
    const body = createSchema.parse(await c.req.json());
    const { plain, hash, prefix } = generateApiToken();
    const id = `K${nanoid(10)}`;
    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    const [row] = await db
      .insert(apiTokens)
      .values({
        id,
        userId: user.id,
        name: body.name,
        tokenHash: hash,
        prefix,
        scopes: body.scopes,
        expiresAt,
      })
      .returning();
    // ⚠️ plain wird nur EIN MAL zurückgegeben.
    return c.json({ token: { ...row, tokenHash: undefined }, plain }, 201);
  })
  .post('/:id/revoke', async (c) => {
    const user = c.get('user')!;
    const id = c.req.param('id');
    const [row] = await db
      .update(apiTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(apiTokens.id, id), eq(apiTokens.userId, user.id)))
      .returning();
    if (!row) return c.json({ error: 'not found' }, 404);
    return c.json({ ok: true });
  });
