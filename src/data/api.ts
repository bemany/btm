// API-Layer: Server-Calls + Field-Mapping zwischen Server- und Frontend-Schema.
//
// Server (Drizzle):  column / priority / projectId / assigneeId / description / sortOrder
// Frontend (Store):  col    / prio     / proj      / who        / desc        / —
//
// Mapping isoliert hier — UI-Code bleibt unverändert.

import { apiFetch } from '../lib/api';
import type {
  Task,
  Project,
  ColumnId,
  Priority,
  Session,
  Timer,
  AppUser,
  AppTeam,
  AppInvitation,
} from '../store/types';

// ── Server-DTOs ─────────────────────────────────────────────────────────

export interface ServerTask {
  id: string;
  title: string;
  description: string | null;
  column: ColumnId;
  priority: Priority;
  estH: number;
  loggedH: number;
  due: string | null;
  projectId: string | null;
  assigneeId: string | null;
  createdById: string | null;
  sortOrder: number;
  parentTaskId: string | null;
  /** ISO-Timestamp wenn archiviert, sonst null. (FgPjnOpBdCX) */
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ServerProject {
  id: string;
  code: string;
  name: string;
  color: string;
  client: string | null;
  due: string | null;
  createdById: string | null;
  ownerId: string | null;
  privateOwnerId: string | null;
  isFavorite?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ProjectMemberRole = 'owner' | 'member' | 'viewer';

export interface ProjectMember {
  userId: string;
  role: ProjectMemberRole;
  addedAt: string;
  name: string | null;
  email: string | null;
  image: string | null;
  color: string | null;
}

export interface ServerSession {
  id: string;
  taskId: string;
  userId: string;
  fromAt: string;
  toAt: string;
  hours: number;
  source: 'timer' | 'manual';
  createdAt: string;
}

export interface ServerLiveTimer {
  userId: string;
  taskId: string;
  startedAt: string;
  pomodoroEnabled: boolean;
  pomodoroStartedAt: string | null;
}

// ── Mapping ────────────────────────────────────────────────────────────

export function fromServerTask(s: ServerTask, sessions: ServerSession[] = []): Task {
  return {
    id: s.id,
    title: s.title,
    desc: s.description ?? undefined,
    col: s.column,
    who: s.assigneeId ?? '',
    proj: s.projectId,
    estH: s.estH,
    loggedH: s.loggedH,
    prio: s.priority,
    due: (s.due ?? undefined) as Task['due'],
    sessions: sessions.map(fromServerSession),
    createdAt: new Date(s.createdAt).getTime(),
    parentTaskId: s.parentTaskId,
    archivedAt: s.archivedAt ?? null,
  };
}

export function fromServerProject(s: ServerProject): Project {
  return {
    id: s.id,
    code: s.code,
    name: s.name,
    color: s.color,
    client: s.client ?? '',
    due: s.due,
    ownerId: s.ownerId,
    privateOwnerId: s.privateOwnerId,
    isFavorite: s.isFavorite ?? false,
  };
}

export function fromServerSession(s: ServerSession): Session {
  return {
    id: s.id,
    from: new Date(s.fromAt).getTime(),
    to: new Date(s.toAt).getTime(),
    h: s.hours,
    source: s.source,
  };
}

export function fromServerLiveTimer(s: ServerLiveTimer | null): Timer | null {
  if (!s) return null;
  const startedAt = new Date(s.startedAt).getTime();
  return {
    taskId: s.taskId,
    startedAt,
    pomodoro: s.pomodoroEnabled
      ? {
          mode: 'focus',
          blockIndex: 0,
          blocksDone: 0,
          startedAt: s.pomodoroStartedAt ? new Date(s.pomodoroStartedAt).getTime() : startedAt,
        }
      : null,
  };
}

// ── Reads ──────────────────────────────────────────────────────────────

export async function listTasks(
  opts: { archived?: 'active' | 'archived' | 'all' } = {},
): Promise<ServerTask[]> {
  // Default 'active' = ohne Archivierte. 'archived' nur archivierte, 'all' beide.
  const q = opts.archived && opts.archived !== 'active' ? `?archived=${opts.archived}` : '';
  const { tasks } = await apiFetch<{ tasks: ServerTask[] }>(`/tasks${q}`);
  return tasks;
}

export async function archiveTask(id: string): Promise<void> {
  await apiFetch(`/tasks/${id}/archive`, { method: 'POST' });
}
export async function unarchiveTask(id: string): Promise<void> {
  await apiFetch(`/tasks/${id}/unarchive`, { method: 'POST' });
}

export async function listProjects(): Promise<ServerProject[]> {
  const { projects } = await apiFetch<{ projects: ServerProject[] }>('/projects');
  return projects;
}

export async function getLiveTimer(): Promise<ServerLiveTimer | null> {
  const { liveTimer } = await apiFetch<{ liveTimer: ServerLiveTimer | null }>('/tasks/timer/live');
  return liveTimer;
}

// FQJzGtjPqc-: Alle Live-Timer aller User — fürs TV-Dashboard.
export async function listAllLiveTimers(): Promise<ServerLiveTimer[]> {
  const { liveTimers } = await apiFetch<{ liveTimers: ServerLiveTimer[] }>('/tasks/timer/live/all');
  return liveTimers;
}

// ── Writes (Tasks) ─────────────────────────────────────────────────────

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  column?: ColumnId;
  priority?: Priority;
  estH?: number;
  due?: string | null;
  projectId?: string | null;
  assigneeId?: string | null;
  parentTaskId?: string | null;
}

export async function createTask(input: CreateTaskInput): Promise<ServerTask> {
  const { task } = await apiFetch<{ task: ServerTask }>('/tasks', { method: 'POST', body: input });
  return task;
}

export type UpdateTaskInput = Partial<CreateTaskInput>;

export async function updateTask(id: string, patch: UpdateTaskInput): Promise<ServerTask> {
  const { task } = await apiFetch<{ task: ServerTask }>(`/tasks/${id}`, { method: 'PATCH', body: patch });
  return task;
}

export async function deleteTask(id: string): Promise<void> {
  await apiFetch(`/tasks/${id}`, { method: 'DELETE' });
}

// ── Writes (Projects) ──────────────────────────────────────────────────

export interface CreateProjectInput {
  code: string;
  name: string;
  color: string;
  client?: string | null;
  due?: string | null;
  ownerId?: string | null;
}

export async function createProject(input: CreateProjectInput): Promise<ServerProject> {
  const { project } = await apiFetch<{ project: ServerProject }>('/projects', { method: 'POST', body: input });
  return project;
}

export type UpdateProjectInput = Partial<CreateProjectInput>;

export async function updateProject(id: string, patch: UpdateProjectInput): Promise<ServerProject> {
  const { project } = await apiFetch<{ project: ServerProject }>(`/projects/${id}`, {
    method: 'PATCH',
    body: patch,
  });
  return project;
}

// ── Project-Members ──────────────────────────────────────────────────

export async function listProjectMembers(projectId: string): Promise<ProjectMember[]> {
  const { members } = await apiFetch<{ members: ProjectMember[] }>(`/projects/${projectId}/members`);
  return members;
}
export async function addProjectMember(
  projectId: string,
  userId: string,
  role: ProjectMemberRole = 'member',
): Promise<void> {
  await apiFetch(`/projects/${projectId}/members`, {
    method: 'POST',
    body: { userId, role },
  });
}
export async function updateProjectMemberRole(
  projectId: string,
  userId: string,
  role: ProjectMemberRole,
): Promise<void> {
  await apiFetch(`/projects/${projectId}/members/${userId}`, { method: 'PATCH', body: { role } });
}
export async function removeProjectMember(projectId: string, userId: string): Promise<void> {
  await apiFetch(`/projects/${projectId}/members/${userId}`, { method: 'DELETE' });
}

export async function deleteProject(id: string): Promise<void> {
  await apiFetch(`/projects/${id}`, { method: 'DELETE' });
}

export async function setProjectFavorite(id: string, isFavorite: boolean): Promise<void> {
  await apiFetch(`/projects/${id}/favorite`, { method: isFavorite ? 'POST' : 'DELETE' });
}

// ── Timer ──────────────────────────────────────────────────────────────

export async function startServerTimer(taskId: string, pomodoro = true): Promise<ServerLiveTimer> {
  const { liveTimer } = await apiFetch<{ liveTimer: ServerLiveTimer }>(`/tasks/${taskId}/timer/start`, {
    method: 'POST',
    body: { pomodoro },
  });
  return liveTimer;
}

export async function stopServerTimer(): Promise<ServerLiveTimer | null> {
  const { liveTimer } = await apiFetch<{ liveTimer: ServerLiveTimer | null }>('/tasks/timer/stop', {
    method: 'POST',
  });
  return liveTimer;
}

// ── Users ──────────────────────────────────────────────────────────────

export async function listUsers(): Promise<AppUser[]> {
  const { users } = await apiFetch<{ users: AppUser[] }>('/users');
  return users;
}

export async function updateUser(
  id: string,
  patch: Partial<Pick<AppUser, 'name' | 'jobTitle' | 'phone' | 'cap' | 'color' | 'role' | 'status' | 'teamId' | 'boardDefaultView'>> & {
    teamIds?: string[];
  },
): Promise<AppUser> {
  const { user } = await apiFetch<{ user: AppUser }>(`/users/${id}`, {
    method: 'PATCH',
    body: patch,
  });
  return user;
}

// ── Teams ──────────────────────────────────────────────────────────────

export async function listTeams(): Promise<AppTeam[]> {
  const { teams } = await apiFetch<{ teams: AppTeam[] }>('/teams');
  return teams;
}

export async function createTeam(name: string, color: string): Promise<AppTeam> {
  const { team } = await apiFetch<{ team: AppTeam }>('/teams', {
    method: 'POST',
    body: { name, color },
  });
  return team;
}

export async function updateTeam(id: string, patch: { name?: string; color?: string }): Promise<AppTeam> {
  const { team } = await apiFetch<{ team: AppTeam }>(`/teams/${id}`, { method: 'PATCH', body: patch });
  return team;
}

export async function deleteTeam(id: string): Promise<void> {
  await apiFetch(`/teams/${id}`, { method: 'DELETE' });
}

// ── Invitations ────────────────────────────────────────────────────────

export async function listInvitations(): Promise<AppInvitation[]> {
  const { invitations } = await apiFetch<{ invitations: AppInvitation[] }>('/invitations');
  return invitations;
}

export interface InviteInput {
  email: string;
  name?: string;
  role?: 'admin' | 'member';
  teamId?: string | null;
  cap?: number;
}

export async function sendInvitation(input: InviteInput): Promise<{ created?: boolean; updated?: boolean }> {
  return apiFetch<{ created?: boolean; updated?: boolean }>('/invitations', {
    method: 'POST',
    body: input,
  });
}

export async function resendInvitation(id: string): Promise<void> {
  await apiFetch(`/invitations/${id}/resend`, { method: 'POST' });
}

export async function cancelInvitation(id: string): Promise<void> {
  await apiFetch(`/invitations/${id}`, { method: 'DELETE' });
}

export async function lookupInvitation(token: string): Promise<{
  email: string;
  name: string | null;
  role: 'admin' | 'member';
  teamId: string | null;
  cap: number;
  invitedAt: string;
}> {
  return apiFetch(`/invitations/accept/${token}`);
}

export async function acceptInvitation(token: string): Promise<void> {
  await apiFetch(`/invitations/accept/${token}`, { method: 'POST' });
}

// ── Activity ───────────────────────────────────────────────────────────

export interface ActivityEntry {
  id: string;
  kind: string;
  actorId: string | null;
  target: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

export async function listActivity(
  opts: { limit?: number; before?: string; kind?: string; actorId?: string; target?: string } = {},
): Promise<ActivityEntry[]> {
  const params = new URLSearchParams();
  if (opts.limit) params.set('limit', String(opts.limit));
  if (opts.before) params.set('before', opts.before);
  if (opts.kind) params.set('kind', opts.kind);
  if (opts.actorId) params.set('actorId', opts.actorId);
  if (opts.target) params.set('target', opts.target);
  const path = `/activity${params.toString() ? '?' + params.toString() : ''}`;
  const { activity } = await apiFetch<{ activity: ActivityEntry[] }>(path);
  return activity;
}

// ── Sessions ───────────────────────────────────────────────────────────

export async function listTaskSessions(taskId: string): Promise<ServerSession[]> {
  const { sessions } = await apiFetch<{ sessions: ServerSession[] }>(`/tasks/${taskId}/sessions`);
  return sessions;
}

export async function createSession(
  taskId: string,
  fromAt: Date,
  hours: number,
  source: 'timer' | 'manual' = 'manual',
): Promise<ServerSession> {
  const { session } = await apiFetch<{ session: ServerSession }>(`/tasks/${taskId}/sessions`, {
    method: 'POST',
    body: { fromAt: fromAt.toISOString(), hours, source },
  });
  return session;
}

export async function deleteSession(sessionId: string): Promise<void> {
  await apiFetch(`/tasks/sessions/${sessionId}`, { method: 'DELETE' });
}

export interface UpdateSessionInput {
  hours?: number;
  fromAt?: Date;
}

export async function updateSession(
  sessionId: string,
  patch: UpdateSessionInput,
): Promise<ServerSession> {
  const body: { hours?: number; fromAt?: string } = {};
  if (patch.hours !== undefined) body.hours = patch.hours;
  if (patch.fromAt !== undefined) body.fromAt = patch.fromAt.toISOString();
  const { session } = await apiFetch<{ session: ServerSession }>(`/tasks/sessions/${sessionId}`, {
    method: 'PATCH',
    body,
  });
  return session;
}

// Atomic Tag-Update für Stunden-Grid
export async function setTaskHoursForDay(taskId: string, day: string, hours: number): Promise<{
  delta: number;
  removed: number;
}> {
  return apiFetch(`/tasks/${taskId}/sessions/day`, {
    method: 'POST',
    body: { day, hours },
  });
}

// Wochengrid-Daten: pro (taskId, day) die gebuchten Stunden des aktuellen
// Users für Mo-Fr. Aggregiert mehrere Sessions pro Tag.
export interface WeekSession {
  taskId: string;
  day: string; // 'YYYY-MM-DD'
  hours: number;
}
export async function listWeekSessions(
  weekStart?: string,
  userId?: string,
): Promise<WeekSession[]> {
  const params = new URLSearchParams();
  if (weekStart) params.set('week', weekStart);
  if (userId) params.set('userId', userId);
  const qs = params.toString() ? `?${params.toString()}` : '';
  const { sessions } = await apiFetch<{ sessions: WeekSession[] }>(`/me/week-sessions${qs}`);
  return sessions;
}

// User-Präferenzen (Mail-Notifications, Background-Effekt, …)
// Sammel-Endpoint — nicht alle Felder müssen im Patch sein.
export async function updateUserPrefs(patch: {
  notifyMentionsMail?: boolean;
  notifyDigestMail?: boolean;
  backgroundChoice?: string;
  calendarTvPrivate?: boolean;
  /** Per-User Akzentfarbe als '#RRGGBB' oder null für Default-Orange. */
  accentColor?: string | null;
}): Promise<void> {
  await apiFetch('/me/prefs', { method: 'PATCH', body: patch });
}

// Backwards-Compat-Alias
export const updateNotifyPrefs = updateUserPrefs;

// Notify-Prompt-Wizard: markiert dass der Dialog gezeigt wurde + setzt
// optional die Mail-Notifikations-Einstellungen.
export async function markNotifyPromptSeen(opts: {
  notifyMentionsMail?: boolean;
  notifyDigestMail?: boolean;
} = {}): Promise<void> {
  await apiFetch('/me/notify-prompt/seen', { method: 'POST', body: opts });
}

// Profil bearbeiten: Position (jobTitle), Avatar (image), Name
export async function updateMyProfile(patch: {
  name?: string;
  jobTitle?: string | null;
  image?: string | null;
}): Promise<void> {
  await apiFetch('/me/profile', { method: 'PATCH', body: patch });
}

// Tagesübersicht jetzt sofort an mich schicken (Test-Trigger)
export async function sendDigestNow(): Promise<void> {
  await apiFetch('/me/digest/send-now', { method: 'POST' });
}

// Admin-Tool: Magic-Login-Link für anderen User generieren
export interface AdminMagicLinkResponse {
  email: string;
  code: string;
  url: string;
  expiresAt: string;
}
export async function adminMagicLink(userId: string): Promise<AdminMagicLinkResponse> {
  return apiFetch<AdminMagicLinkResponse>(`/users/${userId}/magic-link`, {
    method: 'POST',
  });
}

// ── Feedback (Bug-Reports + Feature-Requests) ──────────────────────

export type FeedbackType = 'bug' | 'feature';
export type FeedbackStatus = 'open' | 'in_progress' | 'done' | 'wontfix';
export type FeedbackPriority = 'low' | 'med' | 'high';

export interface FeedbackEntry {
  id: string;
  type: FeedbackType;
  title: string;
  body: string;
  contextPath: string | null;
  contextTheme: string | null;
  contextUserAgent: string | null;
  submitterId: string | null;
  status: FeedbackStatus;
  priority: FeedbackPriority;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function listFeedback(): Promise<FeedbackEntry[]> {
  const { feedback } = await apiFetch<{ feedback: FeedbackEntry[] }>('/feedback');
  return feedback;
}
export async function createFeedback(input: {
  type: FeedbackType;
  title: string;
  body: string;
  contextPath?: string | null;
  contextTheme?: string | null;
  contextUserAgent?: string | null;
  /** Data-URI eines optionalen Screenshots (~8 MB base64 max). */
  screenshotBase64?: string | null;
}): Promise<FeedbackEntry> {
  const { feedback } = await apiFetch<{ feedback: FeedbackEntry }>('/feedback', {
    method: 'POST',
    body: input,
  });
  return feedback;
}
export async function updateFeedback(
  id: string,
  patch: {
    status?: FeedbackStatus;
    priority?: FeedbackPriority;
    adminNote?: string | null;
    title?: string;
    body?: string;
    type?: FeedbackType;
  },
): Promise<FeedbackEntry> {
  const { feedback } = await apiFetch<{ feedback: FeedbackEntry }>(`/feedback/${id}`, {
    method: 'PATCH',
    body: patch,
  });
  return feedback;
}
export async function deleteFeedback(id: string): Promise<void> {
  await apiFetch(`/feedback/${id}`, { method: 'DELETE' });
}

// ── Comments ───────────────────────────────────────────────────────────

export type CommentSubjectType = 'task' | 'project';

export interface AppComment {
  id: string;
  subjectType: CommentSubjectType;
  subjectId: string;
  authorId: string;
  body: string;
  editedAt: string | null;
  createdAt: string;
}

export async function listComments(
  subjectType: CommentSubjectType,
  subjectId: string,
): Promise<AppComment[]> {
  const params = new URLSearchParams({ subjectType, subjectId });
  const { comments } = await apiFetch<{ comments: AppComment[] }>(
    `/comments?${params.toString()}`,
  );
  return comments;
}

export async function createComment(input: {
  subjectType: CommentSubjectType;
  subjectId: string;
  body: string;
}): Promise<AppComment> {
  const { comment } = await apiFetch<{ comment: AppComment }>('/comments', {
    method: 'POST',
    body: input,
  });
  return comment;
}

export async function updateComment(id: string, body: string): Promise<AppComment> {
  const { comment } = await apiFetch<{ comment: AppComment }>(`/comments/${id}`, {
    method: 'PATCH',
    body: { body },
  });
  return comment;
}

export async function deleteComment(id: string): Promise<void> {
  await apiFetch(`/comments/${id}`, { method: 'DELETE' });
}

// ── Notifications / Inbox ──────────────────────────────────────────────

export interface AppNotification {
  id: string;
  userId: string;
  kind: 'mention' | 'review_request' | 'feedback_resolved';
  actorId: string | null;
  payload: {
    // mention / review_request
    commentId?: string;
    subjectType?: CommentSubjectType;
    subjectId?: string;
    subjectTitle?: string;
    excerpt?: string;
    // feedback_resolved
    feedbackId?: string;
    feedbackType?: 'bug' | 'feature';
    feedbackTitle?: string;
    resolutionNote?: string | null;
  };
  seenAt: string | null;
  createdAt: string;
}

export async function listNotifications(opts: { onlyUnread?: boolean; limit?: number } = {}): Promise<
  AppNotification[]
> {
  const params = new URLSearchParams();
  if (opts.onlyUnread) params.set('onlyUnread', 'true');
  if (opts.limit) params.set('limit', String(opts.limit));
  const path = `/notifications${params.toString() ? '?' + params.toString() : ''}`;
  const { notifications } = await apiFetch<{ notifications: AppNotification[] }>(path);
  return notifications;
}

export async function notificationCount(): Promise<{ unread: number }> {
  return apiFetch<{ unread: number }>('/notifications/count');
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiFetch(`/notifications/${id}/read`, { method: 'POST' });
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiFetch('/notifications/read-all', { method: 'POST' });
}

// ── Calendar (Odoo-Sync) ────────────────────────────────────────────

export interface CalendarEventDTO {
  id: string;
  userId: string;
  externalId: string;
  source?: 'odoo' | 'ical';
  title: string;
  location: string | null;
  startAt: string; // ISO
  endAt: string;   // ISO
  allDay: boolean;
  attendeeCount: number;
  organizerName: string | null;
  // Nur in /api/calendar/all (TV)
  userName?: string;
  userImage?: string | null;
  userColor?: string;
}

export interface CalendarConfigPatch {
  odooUrl?: string | null;
  odooDatabase?: string | null;
  odooUsername?: string | null;
  odooApiKey?: string | null;
  odooSyncEnabled?: boolean;
}

export interface CalendarTestResult {
  ok: boolean;
  uid?: number;
  partnerId?: number;
  name?: string;
  tz?: string | null;
  error?: string;
  message?: string;
}

export interface CalendarSyncResult {
  ok: boolean;
  synced?: number;
  deleted?: number;
  error?: string;
}

export async function listMyCalendar(opts: { from?: string; to?: string } = {}): Promise<CalendarEventDTO[]> {
  const params = new URLSearchParams();
  if (opts.from) params.set('from', opts.from);
  if (opts.to) params.set('to', opts.to);
  const qs = params.toString();
  const { events } = await apiFetch<{ events: CalendarEventDTO[] }>(`/calendar/my${qs ? `?${qs}` : ''}`);
  return events;
}

export async function listAllCalendar(opts: { from?: string; to?: string } = {}): Promise<CalendarEventDTO[]> {
  const params = new URLSearchParams();
  if (opts.from) params.set('from', opts.from);
  if (opts.to) params.set('to', opts.to);
  const qs = params.toString();
  const { events } = await apiFetch<{ events: CalendarEventDTO[] }>(`/calendar/all${qs ? `?${qs}` : ''}`);
  return events;
}

export async function updateCalendarConfig(patch: CalendarConfigPatch): Promise<void> {
  await apiFetch('/me/calendar', { method: 'PATCH', body: patch });
}

export async function testCalendarConnection(
  creds: Partial<{ odooUrl: string; odooDatabase: string; odooUsername: string; odooApiKey: string }> = {},
): Promise<CalendarTestResult> {
  return apiFetch<CalendarTestResult>('/me/calendar/test', { method: 'POST', body: creds });
}

export async function deleteCalendarConfig(): Promise<void> {
  await apiFetch('/me/calendar', { method: 'DELETE' });
}

export async function syncCalendarNow(): Promise<CalendarSyncResult> {
  return apiFetch<CalendarSyncResult>('/me/calendar/sync-now', { method: 'POST' });
}

// iCal-Feeds (zweite Calendar-Quelle, mehrere pro User möglich)
export interface IcalFeedDTO {
  id: string;
  userId: string;
  url: string;
  label: string | null;
  syncEnabled: boolean;
  tvPrivate: boolean;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  createdAt: string;
}

export async function listIcalFeeds(): Promise<IcalFeedDTO[]> {
  const { feeds } = await apiFetch<{ feeds: IcalFeedDTO[] }>('/me/calendar/feeds');
  return feeds;
}

export async function createIcalFeed(input: { url: string; label?: string | null }): Promise<{ id: string }> {
  return apiFetch<{ id: string }>('/me/calendar/feeds', { method: 'POST', body: input });
}

export async function updateIcalFeed(
  id: string,
  patch: { url?: string; label?: string | null; syncEnabled?: boolean; tvPrivate?: boolean },
): Promise<void> {
  await apiFetch(`/me/calendar/feeds/${id}`, { method: 'PATCH', body: patch });
}

export async function deleteIcalFeed(id: string): Promise<void> {
  await apiFetch(`/me/calendar/feeds/${id}`, { method: 'DELETE' });
}

export async function syncIcalFeedNow(id: string): Promise<CalendarSyncResult> {
  return apiFetch<CalendarSyncResult>(`/me/calendar/feeds/${id}/sync-now`, { method: 'POST' });
}

// ── Task-Attachments (FmFsMB3v6rK) ──────────────────────────────────
export interface TaskAttachmentDTO {
  id: string;
  taskId: string;
  uploaderId: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export async function listTaskAttachments(taskId: string): Promise<TaskAttachmentDTO[]> {
  const { attachments } = await apiFetch<{ attachments: TaskAttachmentDTO[] }>(
    `/tasks/${taskId}/attachments`,
  );
  return attachments;
}

/** Lädt eine Datei via FormData hoch. Nutzt direktes fetch statt apiFetch
 *  weil wir keine JSON-Content-Type setzen dürfen (multipart braucht
 *  Boundary). credentials: include für Cookie-Session. */
export async function uploadTaskAttachment(
  taskId: string,
  file: File,
): Promise<TaskAttachmentDTO> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`/api/tasks/${taskId}/attachments`, {
    method: 'POST',
    credentials: 'include',
    body: fd,
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const payload = await res.json();
      msg = payload.error ? `${payload.error}` : msg;
      if (payload.error === 'too_large') msg = 'too_large';
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const { attachment } = (await res.json()) as { attachment: TaskAttachmentDTO };
  return attachment;
}

export async function deleteTaskAttachment(taskId: string, attachmentId: string): Promise<void> {
  await apiFetch(`/tasks/${taskId}/attachments/${attachmentId}`, { method: 'DELETE' });
}

/** Liefert die URL für den Download — Browser navigiert dorthin direkt. */
export function taskAttachmentDownloadUrl(taskId: string, attachmentId: string): string {
  return `/api/tasks/${taskId}/attachments/${attachmentId}/download`;
}

// ── Allowed Domains (Fm16BUutfUO) ────────────────────────────────────────

export interface AllowedDomainDTO {
  id: string;
  domain: string;
  addedById: string | null;
  createdAt: string;
}

export async function listAllowedDomains(): Promise<AllowedDomainDTO[]> {
  const { domains } = await apiFetch<{ domains: AllowedDomainDTO[] }>('/allowed-domains');
  return domains;
}

export async function addAllowedDomain(domain: string): Promise<AllowedDomainDTO> {
  const { domain: row } = await apiFetch<{ domain: AllowedDomainDTO }>('/allowed-domains', {
    method: 'POST',
    body: { domain },
  });
  return row;
}

export async function deleteAllowedDomain(id: string): Promise<void> {
  await apiFetch(`/allowed-domains/${id}`, { method: 'DELETE' });
}

// ── Checklisten (FCXVQOSTCFp) ────────────────────────────────────────────

export interface TaskChecklistItemDTO {
  id: string;
  taskId: string;
  text: string;
  done: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export async function listTaskChecklist(taskId: string): Promise<TaskChecklistItemDTO[]> {
  const { items } = await apiFetch<{ items: TaskChecklistItemDTO[] }>(`/tasks/${taskId}/checklist`);
  return items;
}

export async function createChecklistItem(taskId: string, text: string): Promise<TaskChecklistItemDTO> {
  const { item } = await apiFetch<{ item: TaskChecklistItemDTO }>(`/tasks/${taskId}/checklist`, {
    method: 'POST',
    body: { text },
  });
  return item;
}

export async function updateChecklistItem(
  taskId: string,
  itemId: string,
  patch: { text?: string; done?: boolean },
): Promise<TaskChecklistItemDTO> {
  const { item } = await apiFetch<{ item: TaskChecklistItemDTO }>(`/tasks/${taskId}/checklist/${itemId}`, {
    method: 'PATCH',
    body: patch,
  });
  return item;
}

export async function deleteChecklistItem(taskId: string, itemId: string): Promise<void> {
  await apiFetch(`/tasks/${taskId}/checklist/${itemId}`, { method: 'DELETE' });
}

// ── Push Devices ─────────────────────────────────────────────────────────

export interface PushDeviceDTO {
  id: string;
  endpoint: string;
  createdAt: string;
}

export async function listPushDevices(): Promise<PushDeviceDTO[]> {
  const r = await apiFetch<{ devices: PushDeviceDTO[] }>('/push/devices');
  return (r as unknown as { devices: PushDeviceDTO[] }).devices;
}

export async function sendPushTest(subscriptionId: string): Promise<void> {
  await apiFetch('/push/test', { method: 'POST', body: { subscriptionId } });
}

export async function deletePushDevice(id: string): Promise<void> {
  await apiFetch(`/push/devices/${id}`, { method: 'DELETE' });
}
