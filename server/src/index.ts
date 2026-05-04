import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { auth } from './lib/auth.js';
import { attachUser, type Variables } from './lib/context.js';

import { meRoute } from './routes/me.js';
import { projectsRoute } from './routes/projects.js';
import { tasksRoute } from './routes/tasks.js';
import { usersRoute, invitationsRoute } from './routes/users.js';
import { apiTokensRoute } from './routes/api-tokens.js';

const app = new Hono<{ Variables: Variables }>();

app.use('*', logger());

const trustedOrigins = (process.env.TRUSTED_ORIGINS ?? 'https://btm.bethesna.org')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  '/api/*',
  cors({
    origin: trustedOrigins,
    credentials: true,
    allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  }),
);

// Better-Auth übernimmt /api/auth/* selbst (Sign-In, Sign-Out, Sessions, Magic-Link).
app.on(['POST', 'GET'], '/api/auth/*', (c) => auth.handler(c.req.raw));

// User/Auth-Lookup für alle anderen Routen
app.use('/api/*', attachUser);

app.route('/api/me', meRoute);
app.route('/api/projects', projectsRoute);
app.route('/api/tasks', tasksRoute);
app.route('/api/users', usersRoute);
app.route('/api/invitations', invitationsRoute);
app.route('/api/api-tokens', apiTokensRoute);

app.get('/api/healthz', (c) => c.json({ ok: true, ts: Date.now() }));

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? '127.0.0.1';

console.log(`→ btm-api: lausche auf ${host}:${port}`);
console.log(`   trustedOrigins=${trustedOrigins.join(', ')}`);
console.log(`   initialAdmin=${process.env.INITIAL_ADMIN_EMAIL ?? '(none)'}`);

serve({ fetch: app.fetch, hostname: host, port });
