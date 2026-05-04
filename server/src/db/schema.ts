// Drizzle-Schema für BTM. Better-Auth-Tabellen folgen dessen Konvention
// (users, sessions, accounts, verifications) damit Better-Auth sie direkt
// nutzen kann. Domain-Tabellen (projects, tasks, task_sessions, invitations,
// api_tokens) sind eigen.

import { pgTable, text, timestamp, integer, real, boolean, primaryKey, index } from 'drizzle-orm/pg-core';

// ── Better-Auth Tabellen ──────────────────────────────────────────────

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  name: text('name').notNull(),
  image: text('image'),
  // App-spezifisch ergänzt:
  role: text('role', { enum: ['admin', 'member'] }).notNull().default('member'),
  cap: integer('cap').notNull().default(40), // Wochenkapazität in h
  color: text('color').notNull().default('#6B6359'),
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
    column: text('column', { enum: ['todo', 'doing', 'review', 'done'] })
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
  role: text('role', { enum: ['admin', 'member'] })
    .notNull()
    .default('member'),
  invitedById: text('invited_by_id').references(() => users.id, { onDelete: 'set null' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// API-Tokens für MCP / CLI / Programmatic Access — pro User, hashed.
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
