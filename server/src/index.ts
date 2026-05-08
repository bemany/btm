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
import { teamsRoute } from './routes/teams.js';
import { activityRoute } from './routes/activity.js';
import { aiRoute } from './routes/ai.js';
import { mcpRoute } from './routes/mcp.js';
import { eventsRoute } from './routes/events.js';
import { loginCodeRoute } from './routes/login-code.js';

const app = new Hono<{ Variables: Variables }>();

app.use('*', logger());

const trustedOrigins = (process.env.TRUSTED_ORIGINS ?? 'https://btm.bethesna.org')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// MCP-Server: muss von beliebigen Origins erreichbar sein (Claude.ai,
// Claude Desktop, eigene Tools). Bearer-Token statt Cookie → credentials=false.
const mcpCors = cors({
  origin: '*',
  credentials: false,
  allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'Mcp-Session-Id', 'mcp-session-id', 'mcp-protocol-version'],
  exposeHeaders: ['Mcp-Session-Id'],
  maxAge: 86400,
});
app.use('/api/mcp', mcpCors);
app.use('/api/mcp/*', mcpCors);

// Restliche /api/*-Routes nur von eigener Origin (Cookie-Sessions).
// MCP-Pfade werden geskippt damit deren liberale CORS nicht überschrieben wird.
const restCors = cors({
  origin: trustedOrigins,
  credentials: true,
  allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
});
app.use('/api/*', async (c, next) => {
  const p = c.req.path;
  if (p === '/api/mcp' || p.startsWith('/api/mcp/')) return next();
  return restCors(c, next);
});

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
app.route('/api/teams', teamsRoute);
app.route('/api/activity', activityRoute);
app.route('/api/ai', aiRoute);
app.route('/api/mcp', mcpRoute);
app.route('/api/events', eventsRoute);
app.route('/api/login-code', loginCodeRoute);

app.get('/api/healthz', (c) => c.json({ ok: true, ts: Date.now() }));

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? '127.0.0.1';

console.log(`→ btm-api: lausche auf ${host}:${port}`);
console.log(`   trustedOrigins=${trustedOrigins.join(', ')}`);
console.log(`   initialAdmin=${process.env.INITIAL_ADMIN_EMAIL ?? '(none)'}`);

serve({ fetch: app.fetch, hostname: host, port });
