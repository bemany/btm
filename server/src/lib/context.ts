// Hono-Context: Auth-Lookup über Better-Auth-Session-Cookie ODER API-Token.
// Bietet `c.get('user')` für authenticated Routes.

import type { Context, MiddlewareHandler } from 'hono';
import { eq, isNull, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import { apiTokens, users, type User } from '../db/schema.js';
import { auth } from './auth.js';
import { hashApiToken } from './api-token.js';

export type Variables = {
  user: User | null;
  session: { id: string; userId: string } | null;
  authMode: 'session' | 'apiToken' | null;
};

export const requireAuth: MiddlewareHandler<{ Variables: Variables }> = async (c, next) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'unauthorized' }, 401);
  await next();
};

export const requireAdmin: MiddlewareHandler<{ Variables: Variables }> = async (c, next) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'unauthorized' }, 401);
  if (user.role !== 'admin') return c.json({ error: 'forbidden — admin only' }, 403);
  await next();
};

// Wird einmal global vor jeder Route aufgerufen
export const attachUser: MiddlewareHandler<{ Variables: Variables }> = async (c, next) => {
  c.set('user', null);
  c.set('session', null);
  c.set('authMode', null);

  // 1) Bearer-API-Token?
  const authHeader = c.req.header('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token.startsWith('btm_')) {
      const hash = hashApiToken(token);
      const [row] = await db
        .select({ userId: apiTokens.userId, id: apiTokens.id })
        .from(apiTokens)
        .where(and(eq(apiTokens.tokenHash, hash), isNull(apiTokens.revokedAt)))
        .limit(1);
      if (row) {
        const [u] = await db.select().from(users).where(eq(users.id, row.userId)).limit(1);
        if (u) {
          c.set('user', u);
          c.set('authMode', 'apiToken');
          // Async — last-used aktualisieren ohne den Request zu blocken
          db.update(apiTokens)
            .set({ lastUsedAt: new Date() })
            .where(eq(apiTokens.id, row.id))
            .catch(() => {});
        }
      }
    }
  }

  // 2) Session-Cookie via Better-Auth (nur wenn kein API-Token)
  if (!c.get('user')) {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (session?.user) {
      const [u] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
      if (u) {
        c.set('user', u);
        c.set('session', { id: session.session.id, userId: session.user.id });
        c.set('authMode', 'session');
      }
    }
  }

  await next();
};

export type AppContext = Context<{ Variables: Variables }>;
