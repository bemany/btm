// POST /api/login-code — verifiziert den 6-stelligen Code aus der
// Magic-Link-Mail und erstellt eine Better-Auth-Session.
//
// Trick: wir übersetzen den verifizierten Code zurück in einen frischen
// Better-Auth-Magic-Link-Token, indem wir eine `verifications`-Zeile im
// gleichen Format anlegen. Frontend bekommt eine verifyUrl zurück, die
// es im selben Tab öffnet — Better-Auth setzt den Session-Cookie und
// redirected. Kein zusätzliches Mail, kein Browser-Wechsel auf Mobile.

import { Hono } from 'hono';
import { z } from 'zod';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/client.js';
import { loginCodes, verifications } from '../db/schema.js';
import type { Variables } from '../lib/context.js';

const schema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/),
  callbackURL: z.string().optional(),
});

export const loginCodeRoute = new Hono<{ Variables: Variables }>().post('/', async (c) => {
  const body = schema.parse(await c.req.json());
  const email = body.email.toLowerCase().trim();

  // Frischsten passenden Code finden — nicht abgelaufen, noch nicht verbraucht.
  const [row] = await db
    .select()
    .from(loginCodes)
    .where(
      and(
        eq(loginCodes.email, email),
        eq(loginCodes.code, body.code),
        isNull(loginCodes.usedAt),
        sql`${loginCodes.expiresAt} > NOW()`,
      ),
    )
    .orderBy(sql`${loginCodes.createdAt} DESC`)
    .limit(1);

  if (!row) {
    return c.json({ error: 'Code ungültig oder abgelaufen' }, 401);
  }

  // Code als verbraucht markieren (one-shot, Replays sperren)
  await db
    .update(loginCodes)
    .set({ usedAt: new Date() })
    .where(eq(loginCodes.id, row.id));

  // Frischen Magic-Link-Token in verifications-Tabelle anlegen, im selben
  // Format das Better-Auth's Plugin nutzt. Sehr kurze Lebenszeit, weil er
  // gleich verbraucht wird.
  const token = nanoid(32);
  await db.insert(verifications).values({
    id: `V${nanoid(16)}`,
    identifier: token,
    value: JSON.stringify({ email, attempt: 0 }),
    expiresAt: new Date(Date.now() + 60 * 1000),
  });

  const callback = body.callbackURL ?? '/';
  const verifyUrl = `/api/auth/magic-link/verify?token=${token}&callbackURL=${encodeURIComponent(
    callback,
  )}`;

  return c.json({ verifyUrl });
});
