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

export async function listTasks(): Promise<ServerTask[]> {
  const { tasks } = await apiFetch<{ tasks: ServerTask[] }>('/tasks');
  return tasks;
}

export async function listProjects(): Promise<ServerProject[]> {
  const { projects } = await apiFetch<{ projects: ServerProject[] }>('/projects');
  return projects;
}

export async function getLiveTimer(): Promise<ServerLiveTimer | null> {
  const { liveTimer } = await apiFetch<{ liveTimer: ServerLiveTimer | null }>('/tasks/timer/live');
  return liveTimer;
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
  patch: Partial<Pick<AppUser, 'name' | 'jobTitle' | 'phone' | 'cap' | 'color' | 'role' | 'status' | 'teamId' | 'boardDefaultView'>>,
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
}): Promise<void> {
  await apiFetch('/me/prefs', { method: 'PATCH', body: patch });
}

// Backwards-Compat-Alias
export const updateNotifyPrefs = updateUserPrefs;

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
}): Promise<FeedbackEntry> {
  const { feedback } = await apiFetch<{ feedback: FeedbackEntry }>('/feedback', {
    method: 'POST',
    body: input,
  });
  return feedback;
}
export async function updateFeedback(
  id: string,
  patch: { status?: FeedbackStatus; adminNote?: string | null },
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
  kind: 'mention'; // erweiterbar
  actorId: string | null;
  payload: {
    commentId?: string;
    subjectType?: CommentSubjectType;
    subjectId?: string;
    subjectTitle?: string;
    excerpt?: string;
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
