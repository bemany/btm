// Daily-Digest-Scheduler.
//
// Läuft alle 5 Minuten als setInterval (single-Instance — wir haben nur
// einen Container). Pro User mit `notify_digest_mail = true`:
//   – ist `digest_last_sent_at` älter als der heutige Trigger-Zeitpunkt
//     (08:00 Europe/Berlin)? → Digest schicken
//   – sammelt: ungelesene Mentions seit `digest_last_sent_at`, fällige
//     Tasks heute/diese Woche, Activity auf eigenen Tasks der letzten 24h
//   – Wenn alles leer UND der User wurde bereits informiert → trotzdem
//     Mail (so wissen sie dass alles ruhig ist) — aber nur 1×/Tag.
//
// Robustheit:
//   – Fehler pro User werden geloggt aber blockieren den Loop nicht
//   – `digest_last_sent_at` wird auch bei leerem Digest gesetzt, sonst
//     würde der nächste Tick es nochmal versuchen
//   – Im Test/Dev-Mode kann SKIP_DIGEST_SCHEDULER=1 gesetzt werden

import { and, eq, isNull, or, lt, gte, ne, inArray, desc, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users, notifications, tasks, taskSessions, activityLog } from '../db/schema.js';
import { sendMail, digestEmail, appIconAttachment, type DigestPayload } from './mailer.js';

const APP_BASE_URL = process.env.BETTER_AUTH_URL ?? 'http://localhost:3001';

// Trigger-Stunde in lokaler Zeit (Europe/Berlin). UTC = lokal - 1 (Winter)
// oder - 2 (Sommer). Wir nutzen einfach 7:00 UTC (~9:00 MESZ / 8:00 MEZ),
// das passt für unsere Sommerzeit-Demo (Mai = MESZ).
const DIGEST_TRIGGER_HOUR_UTC = 7;

function todaysTriggerInstant(): Date {
  const now = new Date();
  const d = new Date(now);
  d.setUTCHours(DIGEST_TRIGGER_HOUR_UTC, 0, 0, 0);
  // Wenn jetzt vor dem heutigen Trigger ist → gestern als „heutiger" Trigger
  // (so wird niemand zweimal pro Kalendertag bedient).
  if (now < d) d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

function fmtRelDe(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `vor ${h} Std`;
  const d = Math.floor(h / 24);
  return `vor ${d} Tg`;
}

function activityTextDe(kind: string, meta: Record<string, unknown> | null): string {
  switch (kind) {
    case 'task_updated':
      return 'hat die Aufgabe aktualisiert.';
    case 'task_moved': {
      const to = meta?.to as string | undefined;
      const COL_LABEL: Record<string, string> = {
        todo: 'Zu erledigen',
        planned: 'Geplant',
        doing: 'In Arbeit',
        review: 'Review',
        done: 'Erledigt',
      };
      if (to && COL_LABEL[to]) return `hat die Aufgabe nach „${COL_LABEL[to]}" verschoben.`;
      return 'hat die Aufgabe verschoben.';
    }
    case 'task_done':
      return 'hat die Aufgabe als erledigt markiert.';
    case 'timer_started':
      return 'hat den Timer gestartet.';
    case 'timer_stopped': {
      const hours = meta?.hours as number | undefined;
      if (typeof hours === 'number') return `hat den Timer gestoppt (${hours.toFixed(2).replace('.', ',')}h erfasst).`;
      return 'hat den Timer gestoppt.';
    }
    case 'comment_created':
      return 'hat einen Kommentar geschrieben.';
    default:
      return kind;
  }
}

export async function buildPayload(user: {
  id: string;
  email: string;
  name: string;
  digestLastSentAt: Date | null;
}): Promise<DigestPayload | null> {
  const since = user.digestLastSentAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
  const now = new Date();

  // 1. Ungelesene Mentions seit `since`
  const myMentions = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, user.id),
        eq(notifications.kind, 'mention'),
        gte(notifications.createdAt, since),
      ),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(20);

  // Actor-Namen sammeln
  const actorIds = Array.from(new Set(myMentions.map((m) => m.actorId).filter((x): x is string => !!x)));
  const actors = actorIds.length
    ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, actorIds))
    : [];
  const actorById = new Map(actors.map((a) => [a.id, a.name]));

  const mentions = myMentions.map((m) => {
    const p = m.payload as { subjectType: 'task' | 'project'; subjectId: string; subjectTitle: string; excerpt: string };
    const url =
      p.subjectType === 'task'
        ? `${APP_BASE_URL}/board?taskId=${p.subjectId}`
        : `${APP_BASE_URL}/projects?projectId=${p.subjectId}`;
    return {
      actorName: actorById.get(m.actorId ?? '') ?? 'Jemand',
      subjectType: p.subjectType,
      subjectTitle: p.subjectTitle,
      excerpt: p.excerpt,
      url,
    };
  });

  // 2. Eigene Tasks die heute/diese Woche fällig sind
  const todayStr = now.toISOString().slice(0, 10);
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  const myDueTasks = await db
    .select({ id: tasks.id, title: tasks.title, due: tasks.due, column: tasks.column })
    .from(tasks)
    .where(
      and(
        eq(tasks.assigneeId, user.id),
        ne(tasks.column, 'done'),
        // due ist text mit ISO-Date — string-Compare passt
        sql`${tasks.due} IS NOT NULL`,
        sql`${tasks.due} <= ${weekEndStr}`,
      ),
    );

  const dueToday = myDueTasks
    .filter((t) => t.due === todayStr)
    .map((t) => ({
      id: t.id,
      title: t.title,
      url: `${APP_BASE_URL}/board?taskId=${t.id}`,
    }));
  const dueThisWeek = myDueTasks
    .filter((t) => t.due && t.due > todayStr && t.due <= weekEndStr)
    .map((t) => ({
      id: t.id,
      title: t.title,
      due: t.due ?? '',
      url: `${APP_BASE_URL}/board?taskId=${t.id}`,
    }));

  // 3. Activity auf eigenen Tasks der letzten 24h (ohne eigene Activities)
  const myTaskIds = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(eq(tasks.assigneeId, user.id));
  const taskIdSet = myTaskIds.map((t) => t.id);

  let activityRows: Array<{
    id: string;
    kind: string;
    actorId: string | null;
    target: string | null;
    meta: unknown;
    createdAt: Date;
  }> = [];
  if (taskIdSet.length > 0) {
    activityRows = await db
      .select()
      .from(activityLog)
      .where(
        and(
          inArray(activityLog.target, taskIdSet),
          ne(activityLog.actorId, user.id),
          gte(activityLog.createdAt, since),
        ),
      )
      .orderBy(desc(activityLog.createdAt))
      .limit(15);
  }

  const moreActorIds = Array.from(new Set(activityRows.map((a) => a.actorId).filter((x): x is string => !!x)));
  const missingIds = moreActorIds.filter((id) => !actorById.has(id));
  if (missingIds.length > 0) {
    const more = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.id, missingIds));
    for (const u of more) actorById.set(u.id, u.name);
  }

  const activityOnMyTasks = activityRows.map((a) => ({
    actorName: actorById.get(a.actorId ?? '') ?? 'Jemand',
    text: activityTextDe(a.kind, (a.meta as Record<string, unknown> | null) ?? null),
    url: a.target ? `${APP_BASE_URL}/board?taskId=${a.target}` : APP_BASE_URL,
    when: fmtRelDe(a.createdAt.toISOString()),
  }));

  void taskSessions; // unused — Sessions sind über activityLog (timer_stopped) abgedeckt

  return {
    recipientName: user.name,
    date: now.toLocaleDateString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
    mentions,
    dueToday,
    dueThisWeek,
    activityOnMyTasks,
    appUrl: APP_BASE_URL,
    unsubscribeUrl: `${APP_BASE_URL}/?settings=notifications`,
  };
}

let isRunning = false;

export async function runDigestTick(): Promise<void> {
  if (isRunning) return;
  isRunning = true;
  try {
    const trigger = todaysTriggerInstant();
    const candidates = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        digestLastSentAt: users.digestLastSentAt,
      })
      .from(users)
      .where(
        and(
          eq(users.notifyDigestMail, true),
          eq(users.status, 'active'),
          or(isNull(users.digestLastSentAt), lt(users.digestLastSentAt, trigger)),
        ),
      );
    if (candidates.length === 0) return;
    console.log(`[digest] processing ${candidates.length} candidate(s)`);

    for (const u of candidates) {
      try {
        const payload = await buildPayload(u);
        if (!payload) continue;
        const mail = digestEmail(payload);
        const icon = appIconAttachment();
        await sendMail({
          to: u.email,
          ...mail,
          attachments: icon ? [icon] : undefined,
        });
      } catch (e) {
        console.warn(`[digest] failed for user ${u.id}:`, e);
      } finally {
        // Auch bei Fail markieren — sonst Hammer-Mail-Schleife bei broken Daten
        await db.update(users).set({ digestLastSentAt: new Date() }).where(eq(users.id, u.id));
      }
    }
  } finally {
    isRunning = false;
  }
}

/**
 * Schickt SOFORT einen Digest an einen einzelnen User. Wird vom UI-
 * Button „Jetzt senden" gerufen — ignoriert das `digestLastSentAt`-
 * Throttling, setzt es aber nach erfolgreichem Versand auf `now()`,
 * damit der nächste Tick nicht doppelt feuert.
 */
export async function sendDigestForUser(userId: string): Promise<void> {
  const [u] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      digestLastSentAt: users.digestLastSentAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!u) throw new Error('User not found');
  const payload = await buildPayload(u);
  if (!payload) throw new Error('No payload');
  const mail = digestEmail(payload);
  const icon = appIconAttachment();
  await sendMail({
    to: u.email,
    ...mail,
    attachments: icon ? [icon] : undefined,
  });
  await db.update(users).set({ digestLastSentAt: new Date() }).where(eq(users.id, u.id));
}

let intervalHandle: NodeJS.Timeout | null = null;
export function startDigestScheduler(): void {
  if (process.env.SKIP_DIGEST_SCHEDULER === '1') {
    console.log('[digest] scheduler disabled via SKIP_DIGEST_SCHEDULER=1');
    return;
  }
  if (intervalHandle) return;
  // Jede 5 Min — der Trigger feuert bei der ersten Iteration nach 7:00 UTC.
  intervalHandle = setInterval(() => {
    void runDigestTick();
  }, 5 * 60 * 1000);
  // Beim Start auch direkt einmal ausführen (catch-up nach Restart)
  setTimeout(() => void runDigestTick(), 5_000);
  console.log('[digest] scheduler started (5min interval, trigger 07:00 UTC)');
}
