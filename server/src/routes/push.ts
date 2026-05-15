// Push-Notification-Routen.
// GET  /api/push/vapid-key   → öffentlicher VAPID-Key für Subscription
// POST /api/push/subscribe   → Subscription speichern
// DELETE /api/push/unsubscribe → Subscription entfernen

import { Hono } from 'hono';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/client.js';
import { pushSubscriptions } from '../db/schema.js';
import { requireAuth, type Variables } from '../lib/context.js';
import { getVapidPublicKey } from '../lib/push.js';

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export const pushRoute = new Hono<{ Variables: Variables }>()

  .get('/vapid-key', (c) => c.json({ publicKey: getVapidPublicKey() }))

  .post('/subscribe', requireAuth, async (c) => {
    const me = c.get('user')!;
    const body = subscribeSchema.parse(await c.req.json());
    const id = `PS${nanoid(10)}`;
    await db
      .insert(pushSubscriptions)
      .values({ id, userId: me.id, endpoint: body.endpoint, p256dh: body.keys.p256dh, auth: body.keys.auth })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { userId: me.id, p256dh: body.keys.p256dh, auth: body.keys.auth },
      });
    return c.json({ ok: true });
  })

  .delete('/unsubscribe', requireAuth, async (c) => {
    const body = await c.req.json().catch(() => ({})) as { endpoint?: string };
    if (body.endpoint) {
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, body.endpoint));
    }
    return c.json({ ok: true });
  });
