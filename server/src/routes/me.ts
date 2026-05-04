import { Hono } from 'hono';
import type { Variables } from '../lib/context.js';

export const meRoute = new Hono<{ Variables: Variables }>().get('/', (c) => {
  const user = c.get('user');
  const mode = c.get('authMode');
  if (!user) return c.json({ user: null }, 200);
  return c.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      role: user.role,
      cap: user.cap,
      color: user.color,
    },
    authMode: mode,
  });
});
