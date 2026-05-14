// Reminder-Scheduler: prüft jede Minute auf fällige Task-Reminders
// (remind_at <= NOW() AND notified_at IS NULL) und schickt:
//   1. In-App-Notification (kind: 'reminder') → Inbox
//   2. E-Mail an den User

import { and, eq, isNull, lte } from 'drizzle-orm';
import { db } from '../db/client.js';
import { taskReminders, tasks, users } from '../db/schema.js';
import { createNotification } from './notifications.js';
import { sendMail, reminderEmail } from './mailer.js';

const APP_BASE_URL = process.env.BETTER_AUTH_URL ?? 'https://btm.bethesna.org';

async function runReminderTick(): Promise<void> {
  const now = new Date();
  let due: { id: string; taskId: string; userId: string; remindAt: Date }[];
  try {
    due = await db
      .select({
        id: taskReminders.id,
        taskId: taskReminders.taskId,
        userId: taskReminders.userId,
        remindAt: taskReminders.remindAt,
      })
      .from(taskReminders)
      .where(and(lte(taskReminders.remindAt, now), isNull(taskReminders.notifiedAt)));
  } catch (e) {
    console.warn('[reminders] db query failed:', e instanceof Error ? e.message : e);
    return;
  }

  if (due.length === 0) return;

  for (const r of due) {
    try {
      const [task] = await db
        .select({ id: tasks.id, title: tasks.title })
        .from(tasks)
        .where(eq(tasks.id, r.taskId))
        .limit(1);

      const [user] = await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, r.userId))
        .limit(1);

      if (!task || !user) continue;

      const taskUrl = `${APP_BASE_URL}/board?taskId=${task.id}`;
      const remindAtFmt = r.remindAt.toLocaleString('de-DE', {
        weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });

      await createNotification({
        userId: user.id,
        actorId: null,
        kind: 'reminder',
        payload: { taskId: task.id, taskTitle: task.title, taskUrl, remindAt: r.remindAt.toISOString() },
      });

      const mail = reminderEmail({
        recipientName: user.name,
        taskTitle: task.title,
        taskUrl,
        remindAt: remindAtFmt,
      });
      await sendMail({ to: user.email, ...mail });

      await db
        .update(taskReminders)
        .set({ notifiedAt: now })
        .where(eq(taskReminders.id, r.id));

    } catch (e) {
      console.warn(`[reminders] failed for reminder ${r.id}:`, e);
    }
  }
}

let intervalHandle: NodeJS.Timeout | null = null;

export function startReminderScheduler(): void {
  if (intervalHandle) return;
  intervalHandle = setInterval(() => {
    void runReminderTick();
  }, 60 * 1000);
  setTimeout(() => void runReminderTick(), 3_000);
  console.log('[reminders] scheduler started (1min interval)');
}
