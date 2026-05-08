// Drizzle-Schema für BTM. Better-Auth-Tabellen folgen dessen Konvention
// (users, sessions, accounts, verifications) damit Better-Auth sie direkt
// nutzen kann. Domain-Tabellen (projects, tasks, task_sessions, invitations,
// api_tokens) sind eigen.

import { pgTable, text, timestamp, integer, real, boolean, jsonb, index } from 'drizzle-orm/pg-core';

// ── Better-Auth Tabellen ──────────────────────────────────────────────

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  name: text('name').notNull(),
  image: text('image'),
  // App-spezifisch:
  role: text('role', { enum: ['admin', 'member'] }).notNull().default('member'),
  status: text('status', { enum: ['active', 'invited', 'inactive'] }).notNull().default('active'),
  cap: integer('cap').notNull().default(40), // Wochenkapazität in h
  color: text('color').notNull().default('#6B6359'),
  jobTitle: text('job_title'), // Funktion / Rolle (z.B. "Backend-Engineer")
  phone: text('phone'),
  teamId: text('team_id'), // FK zu teams.id (set null on team delete)
  // Default-Ansicht im Wochenboard (Kanban / Liste / Timeline). User-spezifisch,
  // wird beim Onboarding gesetzt und kann via Gear-Popover am Board geändert werden.
  boardDefaultView: text('board_default_view', { enum: ['kanban', 'list', 'timeline'] })
    .notNull()
    .default('kanban'),
  onboardingCompletedAt: timestamp('onboarding_completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const verifications = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── BTM Domain ────────────────────────────────────────────────────────

export const projects = pgTable(
  'projects',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    color: text('color').notNull().default('#6B6359'),
    client: text('client'),
    due: text('due'), // ISO-Date oder NULL
    createdById: text('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    // Wenn gesetzt: privates Projekt — nur für diesen User sichtbar.
    // Wird beim Anlegen eines Users automatisch mit `Privat <Name>` befüllt.
    privateOwnerId: text('private_owner_id').references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('projects_code_idx').on(t.code)],
);

export const tasks = pgTable(
  'tasks',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description'),
    column: text('column', { enum: ['todo', 'planned', 'doing', 'review', 'done'] })
      .notNull()
      .default('todo'),
    priority: text('priority', { enum: ['low', 'med', 'high'] })
      .notNull()
      .default('med'),
    estH: real('est_h').notNull().default(1),
    loggedH: real('logged_h').notNull().default(0),
    due: text('due'), // 'today' | 'tomorrow' | ISO-Date | NULL
    projectId: text('project_id').references(() => projects.id, { onDelete: 'set null' }),
    assigneeId: text('assignee_id').references(() => users.id, { onDelete: 'set null' }),
    createdById: text('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('tasks_assignee_col_idx').on(t.assigneeId, t.column),
    index('tasks_project_idx').on(t.projectId),
  ],
);

export const taskSessions = pgTable(
  'task_sessions',
  {
    id: text('id').primaryKey(),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    fromAt: timestamp('from_at', { withTimezone: true }).notNull(),
    toAt: timestamp('to_at', { withTimezone: true }).notNull(),
    hours: real('hours').notNull(),
    source: text('source', { enum: ['timer', 'manual'] })
      .notNull()
      .default('manual'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('task_sessions_user_from_idx').on(t.userId, t.fromAt)],
);

// Aktiv laufender Live-Timer (max. 1 pro User durch Unique-Index auf userId)
export const liveTimers = pgTable('live_timers', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  taskId: text('task_id')
    .notNull()
    .references(() => tasks.id, { onDelete: 'cascade' }),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  pomodoroEnabled: boolean('pomodoro_enabled').notNull().default(false),
  pomodoroStartedAt: timestamp('pomodoro_started_at', { withTimezone: true }),
});

export const invitations = pgTable('invitations', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  name: text('name'), // gewünschter Name (Anzeige in Admin-Liste)
  role: text('role', { enum: ['admin', 'member'] })
    .notNull()
    .default('member'),
  teamId: text('team_id'), // optional vorab zugewiesen
  cap: integer('cap').notNull().default(40),
  invitedById: text('invited_by_id').references(() => users.id, { onDelete: 'set null' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Teams ──────────────────────────────────────────────────────────────

export const teams = pgTable('teams', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color').notNull().default('#5E7F4E'),
  createdById: text('created_by_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Activity Log ───────────────────────────────────────────────────────

export const activityLog = pgTable(
  'activity_log',
  {
    id: text('id').primaryKey(),
    kind: text('kind').notNull(), // 'task_created' | 'task_moved' | 'timer_started' | 'invite_sent' | ...
    actorId: text('actor_id').references(() => users.id, { onDelete: 'set null' }),
    target: text('target'), // freie ID oder Email — was die Aktion betraf
    meta: jsonb('meta'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('activity_created_idx').on(t.createdAt)],
);

// 6-stelliger Login-Code für PWA — wird parallel zum Magic-Link in der
// Mail verschickt, damit Mobile-User nicht aus der PWA in den Browser
// rausgeworfen werden. Eingabe direkt in der App.
export const loginCodes = pgTable(
  'login_codes',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    code: text('code').notNull(), // 6 Ziffern
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('login_codes_email_idx').on(t.email)],
);

// API-Tokens für MCP / CLI / Programmatic Access — pro User, hashed.
// Für Office-Displays optional zusätzlich displayUrl (Plain-URL) +
// refreshSeconds, damit Admins die URL später nochmal ablesen können.
export const apiTokens = pgTable(
  'api_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    prefix: text('prefix').notNull(), // erste 8 Zeichen für die UI ("btm_xxxx…")
    scopes: text('scopes').array().notNull().default(['read', 'write']),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    // Plain-URL für nicht-sicherheitskritische Tokens (TV-Display).
    // Bei normalen API-Tokens bleibt das null.
    displayUrl: text('display_url'),
    // Auto-Reload-Intervall in Sekunden für /tv-Display.
    refreshSeconds: integer('refresh_seconds'),
  },
  (t) => [index('api_tokens_user_idx').on(t.userId)],
);

// ── Type-Exports für Frontend / Routes ────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type TaskSession = typeof taskSessions.$inferSelect;
export type LiveTimer = typeof liveTimers.$inferSelect;
export type Invitation = typeof invitations.$inferSelect;
export type ApiToken = typeof apiTokens.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type ActivityEntry = typeof activityLog.$inferSelect;
export type NewActivityEntry = typeof activityLog.$inferInsert;
