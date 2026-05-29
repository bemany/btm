// Drizzle-Schema für BTM. Better-Auth-Tabellen folgen dessen Konvention
// (users, sessions, accounts, verifications) damit Better-Auth sie direkt
// nutzen kann. Domain-Tabellen (projects, tasks, task_sessions, invitations,
// api_tokens) sind eigen.

import { pgTable, text, timestamp, integer, real, boolean, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';

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
  // Wann der Notification-Wizard-Dialog dem User gezeigt wurde.
  // null = noch nicht gesehen → Dialog beim naechsten Login zeigen.
  notifyPromptShownAt: timestamp('notify_prompt_shown_at', { withTimezone: true }),
  // Mail-Notification-Präferenzen. Default: instant-Mention-Mails an, Daily-
  // Digest an. Beide unabhängig — der User kann sich auch nur Digest oder
  // nur Sofort-Mails wünschen.
  notifyMentionsMail: boolean('notify_mentions_mail').notNull().default(true),
  notifyDigestMail: boolean('notify_digest_mail').notNull().default(true),
  // Wann der letzte Digest verschickt wurde (UTC). Wird vom Scheduler
  // genutzt um Doppel-Sendung zu verhindern.
  digestLastSentAt: timestamp('digest_last_sent_at', { withTimezone: true }),
  // Animierter Hintergrund (Glass-Modus). Frontend hat den Catalog,
  // Server speichert nur den ID-String — Validierung im Endpoint.
  backgroundChoice: text('background_choice').notNull().default('none'),
  // Odoo-Calendar-Sync (per-user Credentials, MVP read-only).
  // odooApiKey wird AES-256-GCM-verschlüsselt gespeichert (Key aus
  // BETTER_AUTH_SECRET via scrypt) — IV pro Record. odooUid + odooPartnerId
  // werden beim ersten erfolgreichen Sync gecacht. odooLastSyncError ist
  // ein Code-String ('auth_failed' | 'network' | 'server_error') für UI.
  odooUrl: text('odoo_url'),
  odooDatabase: text('odoo_database'),
  odooUsername: text('odoo_username'),
  odooApiKeyEnc: text('odoo_api_key_enc'),
  odooApiKeyIv: text('odoo_api_key_iv'),
  odooUid: integer('odoo_uid'),
  odooPartnerId: integer('odoo_partner_id'),
  odooSyncEnabled: boolean('odoo_sync_enabled').notNull().default(false),
  odooLastSyncAt: timestamp('odoo_last_sync_at', { withTimezone: true }),
  odooLastSyncError: text('odoo_last_sync_error'),
  // Calendar-Privacy für TV-Dashboard: wenn true werden eigene Events auf
  // /api/calendar/all (TV) als 'Privat' anonymisiert (Title, Location und
  // Attendee-Count werden entfernt). Auf 'Meine Woche' bleibt der User
  // immer sein eigener Titel sichtbar — Privacy gilt nur für andere User.
  calendarTvPrivate: boolean('calendar_tv_private').notNull().default(false),
  // Per-User Accent-Color (F7JzZf65SzX). Hex-Format '#RRGGBB' oder null
  // (= globaler BTM-Default-Orange). Wird bei Mount als CSS-Variable
  // --accent-500 + --accent-600 gesetzt.
  accentColor: text('accent_color'),
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
    // Projekt-Verantwortlicher: bekommt Notification wenn eine Aufgabe in
    // Review wechselt, und nur er/sie (oder ein Admin) darf Aufgaben auf
    // „Erledigt" setzen. NULL = niemand zuständig (Standard für Privat- und
    // bestehende Projekte).
    ownerId: text('owner_id').references(() => users.id, { onDelete: 'set null' }),
    // Wenn gesetzt: privates Projekt — nur für diesen User sichtbar.
    // Wird beim Anlegen eines Users automatisch mit `Privat <Name>` befüllt.
    privateOwnerId: text('private_owner_id').references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('projects_code_idx').on(t.code)],
);

// Projekt-Mitgliedschaften — wer hat Zugriff auf welches Projekt mit
// welcher Rolle:
//   • owner   — voller Zugriff inkl. Aufgaben auf 'done' setzen
//   • member  — kann Aufgaben anlegen/bearbeiten, aber nicht abschließen
//   • viewer  — nur lesen
//
// Existenz eines Eintrags ist orthogonal zu privateOwnerId — Privat-Projekte
// brauchen normalerweise keinen Member-Eintrag, da nur der Owner sie sieht.
// Auch wenn die Tabelle leer ist für ein Projekt, dürfen alle aktiven User
// es sehen (Backwards-Compat). Admins sehen alles unabhängig.
export const projectMembers = pgTable(
  'project_members',
  {
    projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['owner', 'member', 'viewer'] }).notNull().default('member'),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('project_members_pid_idx').on(t.projectId),
    index('project_members_uid_idx').on(t.userId),
  ],
);

// Datei-Anhänge an Tasks. Storage liegt im Filesystem (Docker-Volume
// /app/uploads/{taskId}/{id}.{ext}), in der DB nur Metadata. uploaderId
// kann null werden wenn der User gelöscht wird (set null). Files werden
// über storage_path-relative Pfade aufgelöst.
export const taskAttachments = pgTable(
  'task_attachments',
  {
    id: text('id').primaryKey(),
    taskId: text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
    uploaderId: text('uploader_id').references(() => users.id, { onDelete: 'set null' }),
    filename: text('filename').notNull(),       // Original-Filename (Display)
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    storagePath: text('storage_path').notNull(), // relativ zu UPLOAD_DIR
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('task_attachments_task_idx').on(t.taskId, t.createdAt),
  ],
);

// Fm16BUutfUO: E-Mail-Domains die sich selbst registrieren dürfen.
// Beim Magic-Link-Anmelden mit einer neuen E-Mail wird geprüft, ob die
// Domain in dieser Liste steht. Wenn ja: User wird automatisch als
// 'member' angelegt. Wenn nein: Magic-Link wird nicht versendet.
// Pflege durch Admins über Admin-Screen.
export const allowedDomains = pgTable('allowed_domains', {
  id: text('id').primaryKey(),
  domain: text('domain').notNull().unique(),
  addedById: text('added_by_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// FCXVQOSTCFp: Checklisten-Items pro Aufgabe.
// Reihenfolge via sortOrder, jedes Item kann unabhängig abgehakt werden.
export const taskChecklistItems = pgTable(
  'task_checklist_items',
  {
    id: text('id').primaryKey(),
    taskId: text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    done: boolean('done').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('task_checklist_items_task_idx').on(t.taskId, t.sortOrder),
  ],
);

// Persönliche Projekt-Favoriten — komplett user-spezifisch, kein Sharing.
// PK ist (userId, projectId). Beim Löschen von User oder Projekt cascading.
export const projectFavorites = pgTable(
  'project_favorites',
  {
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('project_favorites_user_idx').on(t.userId),
    index('project_favorites_proj_idx').on(t.projectId),
  ],
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
    // Subtask-Beziehung. Wenn gesetzt, ist diese Aufgabe Teil einer
    // anderen. Sub-Aufgaben tauchen als eigenständige Karten im Board auf,
    // werden aber im UI mit Hinweis auf den Parent dekoriert. Mehrstufige
    // Hierarchien (Subtask von Subtask) sind technisch erlaubt, im UI
    // visualisieren wir aktuell nur eine Ebene.
    parentTaskId: text('parent_task_id'),
    // Archiv-Status (FgPjnOpBdCX). NULL = aktiv. Default-Listen blenden
    // archivierte aus; nur Done-Tasks dürfen archiviert werden.
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('tasks_assignee_col_idx').on(t.assigneeId, t.column),
    index('tasks_archived_idx').on(t.archivedAt),
    index('tasks_parent_idx').on(t.parentTaskId),
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
  // FclpRr066St: gespeicherte vorherige Spalte fuer Auto-Move-Back.
  // null wenn Task schon in 'doing' war (kein Move beim Start).
  previousColumn: text('previous_column'),
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

// User ↔ Team Multi-Membership. Ein User kann in 0..N Teams sein.
// users.teamId bleibt als 'primary team' für Backwards-Compat in bestehenden
// Views (Capacity-Filter, Activity-Liste etc.). Die hier sind alle weiteren
// Mitgliedschaften — beim Speichern hält Code sicher dass teamId IMMER auch
// in dieser Tabelle vorhanden ist.
export const userTeams = pgTable(
  'user_teams',
  {
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    teamId: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('user_teams_user_idx').on(t.userId),
    index('user_teams_team_idx').on(t.teamId),
  ],
);

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
    // Klartext-Token (FTTMD2R8-LH). Internes Tool, kein Datenschutz-Risiko,
    // Hash bleibt der Auth-Pfad. Legacy-Tokens (vor 2026-05-14) sind null.
    tokenPlain: text('token_plain'),
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

// ── Kommentare + Mentions ─────────────────────────────────────────────
// Subjektpolymorph: ein Kommentar hängt an genau EINEM Subject (Task ODER
// Project), Validierung im Endpoint. Body ist Plain-Text mit Mention-Tokens
// im Format `@[Name](userId)` — sichtbar/copy-paste-fest, paralleler Index
// in `comment_mentions` für schnelle Inbox-Queries.
export const comments = pgTable(
  'comments',
  {
    id: text('id').primaryKey(),
    subjectType: text('subject_type', { enum: ['task', 'project'] }).notNull(),
    subjectId: text('subject_id').notNull(),
    authorId: text('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    editedAt: timestamp('edited_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('comments_subject_idx').on(t.subjectType, t.subjectId, t.createdAt),
    index('comments_author_idx').on(t.authorId),
  ],
);

export const commentMentions = pgTable(
  'comment_mentions',
  {
    commentId: text('comment_id')
      .notNull()
      .references(() => comments.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [
    index('comment_mentions_user_idx').on(t.userId),
    index('comment_mentions_comment_idx').on(t.commentId),
  ],
);

// Generische Notifications. `kind` ist Text damit später `task_assigned`,
// `comment_reply`, `due_soon` etc. ohne Schema-Migration dazukommen können.
// `payload` ist jsonb mit kind-spezifischer Struktur (siehe lib/notifications.ts).
export const notifications = pgTable(
  'notifications',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    actorId: text('actor_id').references(() => users.id, { onDelete: 'set null' }),
    payload: jsonb('payload').notNull(),
    seenAt: timestamp('seen_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('notif_user_seen_idx').on(t.userId, t.seenAt, t.createdAt),
    index('notif_user_created_idx').on(t.userId, t.createdAt),
  ],
);

// User-Feedback (Bug-Reports + Feature-Requests). Wird von Nutzern aus
// dem In-App-Feedback-Modal befüllt, im Admin sichtbar. Status-Workflow:
// open → in_progress → done | wontfix.
export const feedback = pgTable(
  'feedback',
  {
    id: text('id').primaryKey(),
    type: text('type', { enum: ['bug', 'feature'] }).notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    // Snapshot-Felder zum Zeitpunkt des Reports (Routing, Theme, …) damit
    // Admin sieht, wo der User war als er das Problem hatte.
    contextPath: text('context_path'),
    contextTheme: text('context_theme'),
    contextUserAgent: text('context_user_agent'),
    // Optionaler Screenshot als Data-URI (PNG/JPEG, max ~8 MB).
    // Drag&drop + Clipboard-Paste im Modal.
    screenshotBase64: text('screenshot_base64'),
    submitterId: text('submitter_id').references(() => users.id, { onDelete: 'set null' }),
    status: text('status', { enum: ['open', 'in_progress', 'done', 'wontfix'] })
      .notNull()
      .default('open'),
    // FpU3hZAA30w: Admin-Prioritaet fuer Sortierung im Admin-Screen
    priority: text('priority', { enum: ['low', 'med', 'high'] })
      .notNull()
      .default('med'),
    adminNote: text('admin_note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('feedback_status_idx').on(t.status, t.createdAt),
    index('feedback_submitter_idx').on(t.submitterId),
  ],
);

// Cache für Calendar-Events aus mehreren Quellen (Odoo und iCal-Feeds).
// Wird vom Sync-Scheduler (alle 5 Min) upserted und außerhalb des
// [today, +7d]-Fensters gelöscht. `externalId` ist die ID aus der jeweili-
// gen Quelle (Odoo: integer-id; iCal: UID-string). `source` + `externalId`
// + `userId` ist eindeutig (zwei Quellen können theoretisch identische IDs
// haben). `icalFeedId` ist nur bei source='ical' gesetzt.
export const calendarEvents = pgTable(
  'calendar_events',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    source: text('source', { enum: ['odoo', 'ical'] }).notNull().default('odoo'),
    icalFeedId: text('ical_feed_id'),
    externalId: text('external_id').notNull(),
    title: text('title').notNull(),
    location: text('location'),
    startAt: timestamp('start_at', { withTimezone: true }).notNull(),
    endAt: timestamp('end_at', { withTimezone: true }).notNull(),
    allDay: boolean('all_day').notNull().default(false),
    attendeeCount: integer('attendee_count').notNull().default(0),
    organizerName: text('organizer_name'),
    syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('cal_events_user_start_idx').on(t.userId, t.startAt),
    index('cal_events_start_idx').on(t.startAt),
    uniqueIndex('cal_events_user_source_ext').on(t.userId, t.source, t.externalId),
  ],
);

// User-konfigurierte iCal-Feed-URLs. Mehrere pro User möglich (z.B.
// "Privat (Google)" + "Familie (Apple)" + "Sportverein"). Aktivierbar
// einzeln über syncEnabled — wenn ein Feed Mist liefert kann der User
// ihn pausieren ohne ihn zu löschen.
export const icalFeeds = pgTable(
  'ical_feeds',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    label: text('label'),
    syncEnabled: boolean('sync_enabled').notNull().default(true),
    /** Wenn true: Events dieses Feeds werden auf /api/calendar/all (TV)
     *  als 'Privat' anonymisiert. Default false (= öffentlich anzeigen). */
    tvPrivate: boolean('tv_private').notNull().default(false),
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
    lastSyncError: text('last_sync_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('ical_feeds_user_idx').on(t.userId)],
);

// ── Task-Reminders ────────────────────────────────────────────────────
// Nutzer-spezifische Erinnerungen für Aufgaben. Der Scheduler prüft alle
// 1 Minute auf fällige Reminder (remind_at <= NOW() AND notified_at IS NULL)
// und schickt In-App-Notification + E-Mail.
export const taskReminders = pgTable(
  'task_reminders',
  {
    id: text('id').primaryKey(),
    taskId: text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    remindAt: timestamp('remind_at', { withTimezone: true }).notNull(),
    notifiedAt: timestamp('notified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('reminders_task_idx').on(t.taskId),
    index('reminders_user_idx').on(t.userId),
    index('reminders_remind_at_idx').on(t.remindAt),
  ],
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
export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
export type CommentMention = typeof commentMentions.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type Feedback = typeof feedback.$inferSelect;
export type NewFeedback = typeof feedback.$inferInsert;
export type TaskReminder = typeof taskReminders.$inferSelect;
export type NewTaskReminder = typeof taskReminders.$inferInsert;
export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type NewCalendarEvent = typeof calendarEvents.$inferInsert;

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type IcalFeed = typeof icalFeeds.$inferSelect;
export type NewIcalFeed = typeof icalFeeds.$inferInsert;
export type TaskAttachment = typeof taskAttachments.$inferSelect;
export type NewTaskAttachment = typeof taskAttachments.$inferInsert;
export type TaskChecklistItem = typeof taskChecklistItems.$inferSelect;
export type NewTaskChecklistItem = typeof taskChecklistItems.$inferInsert;
export type AllowedDomain = typeof allowedDomains.$inferSelect;
export type NewAllowedDomain = typeof allowedDomains.$inferInsert;
