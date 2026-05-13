import { Hono } from 'hono';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client.js';
import { users, calendarEvents, taskSessions } from '../db/schema.js';
import { requireAuth, type Variables } from '../lib/context.js';
import { sendDigestForUser } from '../lib/digest.js';
import { encryptSecret } from '../lib/secrets.js';
import { syncUserCalendar } from '../lib/calendar-sync.js';
import { authenticate, readUserInfo, OdooError } from '../lib/odoo-client.js';

export const meRoute = new Hono<{ Variables: Variables }>()
  .get('/', async (c) => {
    const user = c.get('user');
    const mode = c.get('authMode');
    if (!user) return c.json({ user: null }, 200);
    // Selbstheilung: User aus Bestand (vor 2026-05-06) hat ggf. noch kein
    // Privat-Projekt — beim ersten /me-Hit anlegen. Idempotent.
    try {
      const { ensurePrivateProject } = await import('../lib/private-project.js');
      await ensurePrivateProject(user.id, user.name);
    } catch {
      /* ignore */
    }
    return c.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role,
        status: user.status,
        cap: user.cap,
        color: user.color,
        jobTitle: user.jobTitle,
        teamId: user.teamId,
        boardDefaultView: user.boardDefaultView,
        onboardingCompletedAt: user.onboardingCompletedAt,
        notifyMentionsMail: user.notifyMentionsMail,
        notifyDigestMail: user.notifyDigestMail,
        backgroundChoice: user.backgroundChoice,
        // Odoo-Calendar-Sync-State (kein API-Key, nur Anzeige-Felder)
        odooUrl: user.odooUrl,
        odooDatabase: user.odooDatabase,
        odooUsername: user.odooUsername,
        odooHasApiKey: !!user.odooApiKeyEnc,
        odooSyncEnabled: user.odooSyncEnabled,
        odooLastSyncAt: user.odooLastSyncAt,
        odooLastSyncError: user.odooLastSyncError,
      },
      authMode: mode,
    });
  })
  // Sammel-Endpoint für UI-Präferenzen (Mail-Notifications, animated
  // Background, …). Pflegen wir hier statt mehrerer kleiner Routes.
  .patch('/prefs', requireAuth, async (c) => {
    const me = c.get('user')!;
    const body = z
      .object({
        notifyMentionsMail: z.boolean().optional(),
        notifyDigestMail: z.boolean().optional(),
        // Frontend-Catalog ist die Source-of-Truth — wir whitelisten hier nur,
        // damit kein beliebiger String reinkommt.
        backgroundChoice: z
          .enum([
            'none',
            'aurora',
            'mesh',
            'glow',
            'beams',
            'grain',
            'dotgrid',
            'lines',
            'waves',
            'soft-aurora',
            'light-pillar',
            'prism',
            'dark-veil',
            'grainient',
          ])
          .optional(),
      })
      .parse(await c.req.json());
    const patch: Partial<{
      notifyMentionsMail: boolean;
      notifyDigestMail: boolean;
      backgroundChoice: string;
      updatedAt: Date;
    }> = { updatedAt: new Date() };
    if (body.notifyMentionsMail !== undefined) patch.notifyMentionsMail = body.notifyMentionsMail;
    if (body.notifyDigestMail !== undefined) patch.notifyDigestMail = body.notifyDigestMail;
    if (body.backgroundChoice !== undefined) patch.backgroundChoice = body.backgroundChoice;
    await db.update(users).set(patch).where(eq(users.id, me.id));
    return c.json({ ok: true });
  })
  // Digest jetzt sofort an den eingeloggten User schicken — ignoriert
  // das normale Trigger-Throttling, setzt aber `digestLastSentAt`
  // damit der Scheduler nicht doppelt sendet.
  .post('/digest/send-now', requireAuth, async (c) => {
    const me = c.get('user')!;
    try {
      await sendDigestForUser(me.id);
      return c.json({ ok: true });
    } catch (e) {
      console.warn('[digest] send-now failed', e);
      return c.json({ error: 'send_failed' }, 500);
    }
  })
  // Profil-Daten ändern (Position + Avatar). Bild kann eine URL oder
  // ein Data-URI (`data:image/...;base64,...`) sein — das Frontend
  // konvertiert hochgeladene Bilder zu Data-URIs (max ~256 KB).
  .patch('/profile', requireAuth, async (c) => {
    const me = c.get('user')!;
    const body = z
      .object({
        jobTitle: z.string().max(120).nullable().optional(),
        image: z.string().max(400_000).nullable().optional(),
        name: z.string().min(1).max(120).optional(),
      })
      .parse(await c.req.json());
    const patch: Partial<{ jobTitle: string | null; image: string | null; name: string; updatedAt: Date }> = {
      updatedAt: new Date(),
    };
    if (body.jobTitle !== undefined) patch.jobTitle = body.jobTitle;
    if (body.image !== undefined) patch.image = body.image;
    if (body.name !== undefined) patch.name = body.name;
    if (Object.keys(patch).length === 1) return c.json({ ok: true });
    await db.update(users).set(patch).where(eq(users.id, me.id));
    return c.json({ ok: true });
  })
  // Backwards-Compat: alter notify-prefs-Endpoint bleibt funktional
  .patch('/notify-prefs', requireAuth, async (c) => {
    const me = c.get('user')!;
    const body = z
      .object({
        notifyMentionsMail: z.boolean().optional(),
        notifyDigestMail: z.boolean().optional(),
      })
      .parse(await c.req.json());
    const patch: Partial<{ notifyMentionsMail: boolean; notifyDigestMail: boolean; updatedAt: Date }> = {
      updatedAt: new Date(),
    };
    if (body.notifyMentionsMail !== undefined) patch.notifyMentionsMail = body.notifyMentionsMail;
    if (body.notifyDigestMail !== undefined) patch.notifyDigestMail = body.notifyDigestMail;
    await db.update(users).set(patch).where(eq(users.id, me.id));
    return c.json({ ok: true });
  })
  .post('/onboarding/complete', requireAuth, async (c) => {
    const me = c.get('user')!;
    await db
      .update(users)
      .set({ onboardingCompletedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, me.id));
    return c.json({ ok: true });
  })
  .post('/onboarding/reset', requireAuth, async (c) => {
    const me = c.get('user')!;
    await db
      .update(users)
      .set({ onboardingCompletedAt: null, updatedAt: new Date() })
      .where(eq(users.id, me.id));
    return c.json({ ok: true });
  })

  // Stunden-Grid für TimesScreen: gibt für jede eigene Task pro Tag die
  // gebuchten Stunden zurück (Mo-Fr der angeforderten KW). Default: aktuelle
  // Woche relativ zu serverseitigem now().
  //
  // Response: { sessions: [{ taskId, day: 'YYYY-MM-DD', hours: number }] }
  .get('/week-sessions', requireAuth, async (c) => {
    const me = c.get('user')!;
    const weekParam = c.req.query('week'); // optional: 'YYYY-MM-DD' (Wochenstart Mo)
    // userId-Filter — nur Admin darf andere User abfragen, sonst eigene
    const requestedUserId = c.req.query('userId');
    const targetUserId =
      requestedUserId && (me.role === 'admin' || requestedUserId === me.id)
        ? requestedUserId
        : me.id;
    const monday = weekParam ? new Date(weekParam) : (() => {
      // Aktueller Montag (UTC)
      const d = new Date();
      const dow = d.getUTCDay() || 7; // So=7
      d.setUTCDate(d.getUTCDate() - (dow - 1));
      d.setUTCHours(0, 0, 0, 0);
      return d;
    })();
    const friday = new Date(monday);
    friday.setUTCDate(friday.getUTCDate() + 5); // exklusiver Bound
    const rows = await db
      .select({
        taskId: taskSessions.taskId,
        fromAt: taskSessions.fromAt,
        hours: taskSessions.hours,
      })
      .from(taskSessions)
      .where(
        and(
          eq(taskSessions.userId, targetUserId),
          sql`${taskSessions.fromAt} >= ${monday.toISOString()}`,
          sql`${taskSessions.fromAt} < ${friday.toISOString()}`,
        ),
      );
    // Aggregiere pro (taskId, day) — fasst mehrere Sessions am selben Tag zusammen
    const agg = new Map<string, { taskId: string; day: string; hours: number }>();
    for (const r of rows) {
      const day = new Date(r.fromAt).toISOString().slice(0, 10);
      const key = `${r.taskId}|${day}`;
      const cur = agg.get(key);
      if (cur) cur.hours += Number(r.hours);
      else agg.set(key, { taskId: r.taskId, day, hours: Number(r.hours) });
    }
    return c.json({ sessions: Array.from(agg.values()) });
  })

  // ── Odoo-Calendar-Config ────────────────────────────────────────────
  // PATCH: speichert Credentials (apiKey optional — wenn nicht im Body,
  //        bleibt bestehender Wert), kann Sync aktivieren/deaktivieren.
  //        Bei URL/DB/Username-Change: odooUid + odooPartnerId reset
  //        damit nächster Sync sich neu authentifiziert.
  .patch('/calendar', requireAuth, async (c) => {
    const me = c.get('user')!;
    const body = z
      .object({
        odooUrl: z.string().url().nullable().optional(),
        odooDatabase: z.string().min(1).max(200).nullable().optional(),
        odooUsername: z.string().min(1).max(200).nullable().optional(),
        // 20 Char Min-Length: Odoo-API-Keys sind 40-Hex-Chars. Damit fängt
        // man Browser-Autofill-Müll ab (z.B. 8-12 Char-Passwörter) der
        // sonst still die DB überschreibt und alle Syncs auf auth_failed
        // schickt. Bei explizitem null wird der Key gelöscht (Disconnect).
        odooApiKey: z.union([z.string().min(20).max(1000), z.null()]).optional(),
        odooSyncEnabled: z.boolean().optional(),
      })
      .parse(await c.req.json());

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    const credsChanged =
      body.odooUrl !== undefined ||
      body.odooDatabase !== undefined ||
      body.odooUsername !== undefined ||
      body.odooApiKey !== undefined;

    if (body.odooUrl !== undefined) patch.odooUrl = body.odooUrl;
    if (body.odooDatabase !== undefined) patch.odooDatabase = body.odooDatabase;
    if (body.odooUsername !== undefined) patch.odooUsername = body.odooUsername;
    if (body.odooApiKey !== undefined) {
      if (body.odooApiKey === null) {
        patch.odooApiKeyEnc = null;
        patch.odooApiKeyIv = null;
      } else {
        const { enc, iv } = encryptSecret(body.odooApiKey);
        patch.odooApiKeyEnc = enc;
        patch.odooApiKeyIv = iv;
      }
    }
    if (body.odooSyncEnabled !== undefined) patch.odooSyncEnabled = body.odooSyncEnabled;
    if (credsChanged) {
      // Cached UID + Partner-ID resetten, nächster Sync re-authentifiziert
      patch.odooUid = null;
      patch.odooPartnerId = null;
      patch.odooLastSyncError = null;
    }

    await db.update(users).set(patch).where(eq(users.id, me.id));
    return c.json({ ok: true });
  })

  // POST: Verbindung testen ohne zu speichern. Body: gleiche Felder wie
  // PATCH, optional. Wenn ein Feld nicht da ist, wird der aktuelle DB-Wert
  // benutzt (so kann der User den Test mit „nur ändere URL"-Form auslösen).
  .post('/calendar/test', requireAuth, async (c) => {
    const me = c.get('user')!;
    const body = z
      .object({
        odooUrl: z.string().url().optional(),
        odooDatabase: z.string().optional(),
        odooUsername: z.string().optional(),
        odooApiKey: z.string().optional(),
      })
      .parse(await c.req.json().catch(() => ({})));

    // Lade aktuelle Werte als Fallback
    const [u] = await db.select().from(users).where(eq(users.id, me.id)).limit(1);
    if (!u) return c.json({ ok: false, error: 'user_not_found' }, 404);

    const url = body.odooUrl ?? u.odooUrl ?? '';
    const database = body.odooDatabase ?? u.odooDatabase ?? '';
    const username = body.odooUsername ?? u.odooUsername ?? '';
    let apiKey = body.odooApiKey;
    if (!apiKey) {
      if (!u.odooApiKeyEnc || !u.odooApiKeyIv) {
        return c.json({ ok: false, error: 'no_api_key' }, 400);
      }
      try {
        const { decryptSecret } = await import('../lib/secrets.js');
        apiKey = decryptSecret(u.odooApiKeyEnc, u.odooApiKeyIv);
      } catch {
        return c.json({ ok: false, error: 'decrypt_failed' }, 500);
      }
    }
    if (!url || !database || !username || !apiKey) {
      return c.json({ ok: false, error: 'incomplete' }, 400);
    }

    try {
      const uid = await authenticate({ url, database, username, apiKey });
      const info = await readUserInfo({ url, database, username, apiKey }, uid);
      return c.json({ ok: true, uid, partnerId: info.partnerId, name: info.name, tz: info.tz });
    } catch (e) {
      const code = e instanceof OdooError ? e.code : 'network';
      const message = (e as Error).message ?? 'unknown';
      return c.json({ ok: false, error: code, message }, 200);
    }
  })

  // DELETE: trennt die Verbindung — Credentials + Cache + State löschen.
  .delete('/calendar', requireAuth, async (c) => {
    const me = c.get('user')!;
    await db
      .update(users)
      .set({
        odooUrl: null,
        odooDatabase: null,
        odooUsername: null,
        odooApiKeyEnc: null,
        odooApiKeyIv: null,
        odooUid: null,
        odooPartnerId: null,
        odooSyncEnabled: false,
        odooLastSyncAt: null,
        odooLastSyncError: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, me.id));
    await db.delete(calendarEvents).where(eq(calendarEvents.userId, me.id));
    return c.json({ ok: true });
  })

  // POST: Sofort einen Sync triggern (für „Jetzt synchronisieren"-Button im
  // Settings-Tab). Returns Anzahl der gesyncten / gelöschten Events.
  .post('/calendar/sync-now', requireAuth, async (c) => {
    const me = c.get('user')!;
    const [u] = await db.select().from(users).where(eq(users.id, me.id)).limit(1);
    if (!u) return c.json({ error: 'user_not_found' }, 404);
    if (!u.odooSyncEnabled || !u.odooApiKeyEnc) {
      return c.json({ error: 'not_configured' }, 400);
    }
    try {
      const r = await syncUserCalendar(u);
      await db
        .update(users)
        .set({ odooLastSyncAt: new Date(), odooLastSyncError: null })
        .where(eq(users.id, me.id));
      return c.json({ ok: true, synced: r.synced, deleted: r.deleted });
    } catch (e) {
      const code = e instanceof OdooError ? e.code : 'network';
      await db
        .update(users)
        .set({ odooLastSyncAt: new Date(), odooLastSyncError: code })
        .where(eq(users.id, me.id));
      return c.json({ ok: false, error: code }, 200);
    }
  });
