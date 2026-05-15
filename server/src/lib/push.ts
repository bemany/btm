// Web-Push via VAPID. Sendet Browser-Push-Notifications an alle
// gespeicherten Subscriptions eines Users.
// Abgelaufene/ungültige Subscriptions (410/404) werden automatisch gelöscht.

import webpush from 'web-push';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { pushSubscriptions } from '../db/schema.js';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? '';
const VAPID_MAILTO = `mailto:${process.env.INITIAL_ADMIN_EMAIL ?? 'admin@example.com'}`;

let initialized = false;

function init() {
  if (initialized || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;
  webpush.setVapidDetails(VAPID_MAILTO, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  initialized = true;
}

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string; tag?: string },
): Promise<void> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;
  init();

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  if (subs.length === 0) return;

  const message = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: '/app-icon-192.png',
    badge: '/app-icon-192.png',
    data: { url: payload.url ?? '/inbox' },
    tag: payload.tag,
  });

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          message,
        );
      } catch (e: unknown) {
        const status = (e as { statusCode?: number })?.statusCode;
        if (status === 410 || status === 404) {
          await db
            .delete(pushSubscriptions)
            .where(eq(pushSubscriptions.endpoint, sub.endpoint))
            .catch(() => {});
        } else {
          console.warn(`[push] send failed for user ${userId}:`, (e as Error)?.message ?? e);
        }
      }
    }),
  );
}
