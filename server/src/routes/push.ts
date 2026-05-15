// Push-Notification-Routen.
// GET  /api/push/vapid-key   → öffentlicher VAPID-Key für Subscription
// POST /api/push/subscribe   → Subscription speichern
// DELETE /api/push/unsubscribe → Subscription entfernen

import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/client.js';
import { pushSubscriptions } from '../db/schema.js';
import { requireAuth, type Variables } from '../lib/context.js';
import { getVapidPublicKey, sendTestPush } from '../lib/push.js';

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
  })

  .get('/devices', requireAuth, async (c) => {
    const me = c.get('user')!;
    const devices = await db
      .select({
        id: pushSubscriptions.id,
        endpoint: pushSubscriptions.endpoint,
        createdAt: pushSubscriptions.createdAt,
      })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, me.id));
    return c.json({ devices });
  })

  .post('/test', requireAuth, async (c) => {
    const me = c.get('user')!;
    const body = await c.req.json().catch(() => ({})) as { subscriptionId?: string };
    if (!body.subscriptionId) return c.json({ ok: false, error: 'subscriptionId required' }, 400);
    const result = await sendTestPush(body.subscriptionId, me.id);
    if (result === 'not_found') return c.json({ ok: false, error: 'not_found' }, 404);
    if (result === 'error') return c.json({ ok: false, error: 'send_failed' }, 500);
    return c.json({ ok: true });
  })

  .delete('/devices/:id', requireAuth, async (c) => {
    const me = c.get('user')!;
    const id = c.req.param('id');
    await db
      .delete(pushSubscriptions)
      .where(and(eq(pushSubscriptions.id, id), eq(pushSubscriptions.userId, me.id)));
    return c.json({ ok: true });
  });
