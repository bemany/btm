// SSE-Endpoint /api/events: Realtime-Updates für verbundene Clients.
// Auth: Cookie-Session ODER Bearer-API-Token.
// Cloudflare-Tunnel: HTTP/2 streamt zuverlässig wenn no-buffer-Header gesetzt.

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { requireAuth, type Variables } from '../lib/context.js';
import { subscribe, type EventNotification } from '../lib/events.js';

export const eventsRoute = new Hono<{ Variables: Variables }>()
  .use('*', requireAuth)
  .get('/', async (c) => {
    // Wichtig für Cloudflare-Tunnel + Nginx-style Proxies: Buffering aus.
    c.header('X-Accel-Buffering', 'no');
    c.header('Cache-Control', 'no-cache');

    return streamSSE(c, async (stream) => {
      // Initial-Nachricht — Client weiß, dass die Verbindung steht
      await stream.writeSSE({
        event: 'hello',
        data: JSON.stringify({ ts: Date.now() }),
      });

      const queue: EventNotification[] = [];
      let resolve: (() => void) | null = null;
      const wait = () =>
        new Promise<void>((r) => {
          resolve = r;
        });

      const unsubscribe = subscribe((n) => {
        queue.push(n);
        if (resolve) {
          resolve();
          resolve = null;
        }
      });

      // Heartbeat alle 25 s damit Connections nicht idle-getimeoutet werden
      const heartbeat = setInterval(() => {
        if (resolve) {
          resolve();
          resolve = null;
        }
      }, 25_000);

      try {
        while (true) {
          if (queue.length === 0) {
            await wait();
          }
          // entweder echte Events oder ein heartbeat
          if (queue.length === 0) {
            await stream.writeSSE({ event: 'heartbeat', data: String(Date.now()) });
            continue;
          }
          while (queue.length > 0) {
            const n = queue.shift()!;
            await stream.writeSSE({
              event: 'change',
              data: JSON.stringify(n),
            });
          }
        }
      } finally {
        clearInterval(heartbeat);
        unsubscribe();
      }
    });
  });
