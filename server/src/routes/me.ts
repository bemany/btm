import { Hono } from 'hono';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users, taskSessions } from '../db/schema.js';
import { requireAuth, type Variables } from '../lib/context.js';

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
      },
      authMode: mode,
    });
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
          eq(taskSessions.userId, me.id),
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
  });
