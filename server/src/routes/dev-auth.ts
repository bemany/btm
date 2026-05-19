// Dev-only PIN-Auth — nur aktiv wenn DEV_PIN_AUTH=true in .env.
// Erlaubt Login ohne Magic-Link via E-Mail+PIN. Kein Mail-Versand.
// Sichert durch ENV-Flag ab — produktiv nie aktiv.

import { Hono } from 'hono';
import { setSignedCookie } from 'hono/cookie';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/client.js';
import { users, sessions } from '../db/schema.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { Variables } from '../lib/context.js';
import { requireAdmin } from '../lib/context.js';

const execAsync = promisify(exec);

const DEV_PIN_AUTH = process.env.DEV_PIN_AUTH === 'true';
const DEV_TEST_PIN = process.env.DEV_TEST_PIN ?? '';
const PROD_DATABASE_URL = process.env.PROD_DATABASE_URL ?? '';

const pinSchema = z.object({
  email: z.string().email(),
  pin: z.string().min(1),
});

export const devAuthRoute = new Hono<{ Variables: Variables }>()

  // Liefert ob Dev-Modus aktiv ist (für Frontend-Feature-Flag)
  .get('/config', (c) =>
    c.json({ devMode: DEV_PIN_AUTH }),
  )

  // PIN-Login: E-Mail + PIN → Session-Cookie
  .post('/dev-pin', async (c) => {
    if (!DEV_PIN_AUTH || !DEV_TEST_PIN) {
      return c.json({ error: 'dev auth not enabled' }, 403);
    }
    const body = pinSchema.parse(await c.req.json());
    if (body.pin !== DEV_TEST_PIN) {
      return c.json({ error: 'invalid pin' }, 401);
    }

    const email = body.email.trim().toLowerCase();
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (!user) return c.json({ error: 'user not found' }, 404);

    const token = nanoid(40);
    const sessionId = nanoid(12);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.insert(sessions).values({
      id: sessionId,
      userId: user.id,
      token,
      expiresAt,
      ipAddress: c.req.header('x-forwarded-for') ?? null,
      userAgent: c.req.header('user-agent') ?? null,
    });

    // Better-Auth liest den Session-Token mit signiertem Cookie (HMAC-SHA-256
    // gegen BETTER_AUTH_SECRET). Ein simpler setCookie() reicht nicht, das
    // Cookie würde von auth.api.getSession() verworfen → User bleibt null.
    const secret = process.env.BETTER_AUTH_SECRET;
    if (!secret) return c.json({ error: 'BETTER_AUTH_SECRET not set' }, 500);
    // WICHTIG: Better-Auth setzt auf HTTPS automatisch den __Secure-Prefix
    // (siehe ctx.authCookies.sessionToken.name = "__Secure-better-auth.session_token").
    // Wenn wir nur "better-auth.session_token" setzen, findet getSession() das Cookie
    // nicht und gibt null zurück. Daher den passenden Cookie-Namen je nach Protokoll
    // wählen, plus parallel beide Varianten setzen für Tunnel-Konfigs mit
    // x-forwarded-proto-Drift.
    const isHttps = (c.req.header('x-forwarded-proto') ?? 'https') === 'https';
    const cookieName = isHttps
      ? '__Secure-better-auth.session_token'
      : 'better-auth.session_token';
    await setSignedCookie(c, cookieName, token, secret, {
      httpOnly: true,
      path: '/',
      sameSite: 'Lax',
      expires: expiresAt,
      secure: isHttps,
    });

    return c.json({ ok: true, userId: user.id });
  })

  // Prod-DB → Beta-DB klonen (nur in Dev-Modus, nur Admin)
  .post('/admin/clone-prod-db', requireAdmin, async (c) => {
    if (!DEV_PIN_AUTH) return c.json({ error: 'only in dev mode' }, 403);
    if (!PROD_DATABASE_URL) return c.json({ error: 'PROD_DATABASE_URL not set' }, 500);

    const betaUrl = process.env.DATABASE_URL!;
    try {
      // pg_dump von Prod, direkt in beta DB restoren
      const { stderr } = await execAsync(
        `pg_dump "${PROD_DATABASE_URL}" | psql "${betaUrl}"`,
        { timeout: 60_000 },
      );
      if (stderr && !stderr.includes('already exists') && !stderr.includes('pg_dump: warning')) {
        console.warn('[clone-prod-db] stderr:', stderr.slice(0, 500));
      }
      return c.json({ ok: true, note: 'Prod-DB erfolgreich in Beta-DB geklont.' });
    } catch (e) {
      console.error('[clone-prod-db] failed:', e);
      return c.json({ error: String(e) }, 500);
    }
  });
