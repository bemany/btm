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
import { commentsRoute } from './routes/comments.js';
import { notificationsRoute } from './routes/notifications.js';
import { feedbackRoute } from './routes/feedback.js';
import { calendarRoute } from './routes/calendar.js';
import { aiRoute } from './routes/ai.js';
import { mcpRoute } from './routes/mcp.js';
import { eventsRoute } from './routes/events.js';
import { loginCodeRoute } from './routes/login-code.js';
import { remindersRoute } from './routes/reminders.js';
import { devAuthRoute } from './routes/dev-auth.js';
import { pushRoute } from './routes/push.js';

const app = new Hono<{ Variables: Variables }>();

app.use('*', logger());

const trustedOrigins = (process.env.TRUSTED_ORIGINS ?? 'http://localhost:5173')
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

// devAuthRoute zuerst: /api/auth/dev-pin muss VOR Better-Auth registriert sein,
// weil Better-Auth /api/auth/* als Wildcard abfängt.
app.route('/api/auth', devAuthRoute);

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
app.route('/api/comments', commentsRoute);
app.route('/api/notifications', notificationsRoute);
app.route('/api/feedback', feedbackRoute);
app.route('/api/calendar', calendarRoute);
app.route('/api/ai', aiRoute);
app.route('/api/mcp', mcpRoute);
app.route('/api/events', eventsRoute);
app.route('/api/login-code', loginCodeRoute);
app.route('/api/push', pushRoute);
app.get('/api/healthz', (c) => c.json({ ok: true, ts: Date.now() }));

// devAuthRoute VOR remindersRoute: remindersRoute hat .use('*', requireAuth)
// das sonst /api/config und /api/auth/dev-pin mit 401 blockieren würde.
app.route('/api', devAuthRoute);
app.route('/api', remindersRoute);

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? '127.0.0.1';

console.log(`→ btm-api: lausche auf ${host}:${port}`);
console.log(`   trustedOrigins=${trustedOrigins.join(', ')}`);
console.log(`   initialAdmin=${process.env.INITIAL_ADMIN_EMAIL ?? '(none)'}`);

serve({ fetch: app.fetch, hostname: host, port });

// Daily-Digest-Scheduler. Single-Instance — wir haben einen Container.
// Erste Iteration läuft 5s nach Startup (catch-up nach Container-Restart),
// danach alle 5 Min ein Tick der prüft ob ein User digest-fällig ist.
import { startDigestScheduler } from './lib/digest.js';
startDigestScheduler();

// Calendar-Sync-Scheduler — pollt Odoo alle 5 Min für jeden User mit
// aktivem Sync. Errors werden per User isoliert; Loop läuft weiter.
import { startCalendarSyncScheduler } from './lib/calendar-sync.js';
startCalendarSyncScheduler();

// Reminder-Scheduler — prüft jede Minute auf fällige Task-Reminder
// und schickt In-App-Notification + E-Mail.
import { startReminderScheduler } from './lib/reminder-scheduler.js';
startReminderScheduler();
