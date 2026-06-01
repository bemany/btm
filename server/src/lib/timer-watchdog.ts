// FGuP3nYfPfL: Push-Warnungen bei lang laufenden Live-Timern.
//
// Logik pro Tick (60 s):
//   • elapsed >= 60 min UND lastWarningPushAt == null
//       → 1. Push, stempelt lastWarningPushAt
//   • elapsed >= 90 min UND time-since-last-warning >= 5 min
//       → Folge-Push, stempelt erneut
//
// So bleibt die 60-min-Warnung einmalig, ab 90 min greift der 5-min-Rhythmus
// (auch wenn der Container zwischendurch neustartet — wir halten den letzten
// Push-Zeitstempel in der DB).
//
// Wird vom Hauptprozess ueber `startTimerWatchdog()` initialisiert.
// Mit SKIP_TIMER_WATCHDOG=1 abschaltbar (lokale Dev).

import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { liveTimers, tasks } from '../db/schema.js';
import { sendPushToUser } from './push.js';

const TICK_MS = 60 * 1000;
const FIRST_WARN_MIN = 60;
const REPEAT_THRESHOLD_MIN = 90;
const REPEAT_INTERVAL_MIN = 5;

let intervalHandle: NodeJS.Timeout | null = null;

async function runTick(now: Date = new Date()): Promise<void> {
  const rows = await db
    .select({
      userId: liveTimers.userId,
      taskId: liveTimers.taskId,
      startedAt: liveTimers.startedAt,
      lastWarningPushAt: liveTimers.lastWarningPushAt,
      taskTitle: tasks.title,
    })
    .from(liveTimers)
    .leftJoin(tasks, eq(tasks.id, liveTimers.taskId));

  for (const row of rows) {
    const elapsedMin = (now.getTime() - new Date(row.startedAt).getTime()) / 60_000;
    if (elapsedMin < FIRST_WARN_MIN) continue;

    const lastWarn = row.lastWarningPushAt ? new Date(row.lastWarningPushAt) : null;
    let shouldSend = false;
    let kind: '60' | '90+' = '60';

    if (!lastWarn) {
      // Erster Push, sobald 60 min erreicht sind.
      shouldSend = true;
      kind = elapsedMin >= REPEAT_THRESHOLD_MIN ? '90+' : '60';
    } else if (elapsedMin >= REPEAT_THRESHOLD_MIN) {
      // 90+ Modus: alle 5 min eine Folge-Push.
      const minSinceLast = (now.getTime() - lastWarn.getTime()) / 60_000;
      if (minSinceLast >= REPEAT_INTERVAL_MIN) {
        shouldSend = true;
        kind = '90+';
      }
    }

    if (!shouldSend) continue;

    const minutes = Math.round(elapsedMin);
    const title = kind === '60'
      ? `Timer laeuft seit ${minutes} Minuten`
      : `Timer laeuft seit ${minutes} Minuten — Session beenden`;
    const body = kind === '60'
      ? `„${row.taskTitle ?? 'Aufgabe'}" laeuft jetzt seit ueber einer Stunde. Pause machen oder Session abschliessen?`
      : `„${row.taskTitle ?? 'Aufgabe'}" laeuft sehr lange. Bitte Session jetzt beenden und ggf. eine neue starten.`;

    try {
      await sendPushToUser(row.userId, {
        title,
        body,
        url: '/timer',
        // tag pro user: neue Push ersetzt die vorherige (kein Stapel).
        tag: `timer-watchdog-${row.userId}`,
      });
    } catch (e) {
      console.warn('[timer-watchdog] sendPushToUser failed:', (e as Error)?.message ?? e);
    }

    await db
      .update(liveTimers)
      .set({ lastWarningPushAt: now })
      .where(eq(liveTimers.userId, row.userId))
      .catch((e) => console.warn('[timer-watchdog] stamp update failed:', e));
  }
}

export function startTimerWatchdog(): void {
  if (process.env.SKIP_TIMER_WATCHDOG === '1') {
    console.log('[timer-watchdog] disabled via SKIP_TIMER_WATCHDOG=1');
    return;
  }
  if (intervalHandle) return;
  intervalHandle = setInterval(() => {
    void runTick().catch((e) => console.error('[timer-watchdog] tick error:', e));
  }, TICK_MS);
  // Erstes Tick nach 10s damit Restart-Lag nicht eine ganze Minute verbummelt.
  setTimeout(() => void runTick().catch(() => {}), 10_000);
  console.log('[timer-watchdog] started (60s ticks, 60min first warn, 90min+ repeat every 5min)');
}
