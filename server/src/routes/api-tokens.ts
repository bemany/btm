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
  // Für TV-Display-Tokens: zusätzliche Felder die in der DB gespeichert werden,
  // damit Admins die URL später wieder ablesen können.
  displayUrlTemplate: z.string().optional(), // z.B. "/tv?token={plain}&reload=1800"
  refreshSeconds: z.number().int().min(30).max(86400).optional(),
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
        // Klartext für eigene Tokens (FTTMD2R8-LH). Bei Legacy-Tokens null.
        // Nur Session-Auth: über API-Token den eigenen Klartext zu listen
        // wäre OK aber irreführend (Token ist eh schon bekannt) — wir
        // liefern es trotzdem, weil's intern ist.
        tokenPlain: apiTokens.tokenPlain,
        scopes: apiTokens.scopes,
        lastUsedAt: apiTokens.lastUsedAt,
        expiresAt: apiTokens.expiresAt,
        createdAt: apiTokens.createdAt,
        revokedAt: apiTokens.revokedAt,
        displayUrl: apiTokens.displayUrl,
        refreshSeconds: apiTokens.refreshSeconds,
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

    // displayUrl: optional als persistierbare URL (für TV-Display-Tokens)
    const displayUrl = body.displayUrlTemplate
      ? body.displayUrlTemplate.replace('{plain}', encodeURIComponent(plain))
      : null;

    const [row] = await db
      .insert(apiTokens)
      .values({
        id,
        userId: user.id,
        name: body.name,
        tokenHash: hash,
        // Plain wird zusätzlich gespeichert (intern, FTTMD2R8-LH). Der
        // Hash bleibt der Auth-Pfad — Plain ist nur fürs UI-Anzeigen.
        tokenPlain: plain,
        prefix,
        scopes: body.scopes,
        expiresAt,
        displayUrl,
        refreshSeconds: body.refreshSeconds ?? null,
      })
      .returning();
    // ⚠️ plain wird nur EIN MAL zurückgegeben (außer wenn displayUrl gespeichert ist —
    // dann steht der Token implizit auch in der URL).
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
