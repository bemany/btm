// Activity-Log-Helper. Fire-and-forget; Fehler werden geloggt aber nicht zurückgegeben.

import { nanoid } from 'nanoid';
import { db } from '../db/client.js';
import { activityLog } from '../db/schema.js';
import { emit, type EventTopic } from './events.js';

const TOPIC_BY_KIND: Record<string, EventTopic[]> = {
  task_created: ['tasks', 'activity'],
  task_updated: ['tasks', 'activity'],
  task_moved: ['tasks', 'activity'],
  task_done: ['tasks', 'activity'],
  task_deleted: ['tasks', 'activity'],
  task_archived: ['tasks', 'activity'],
  task_unarchived: ['tasks', 'activity'],
  project_created: ['projects', 'activity'],
  project_updated: ['projects', 'activity'],
  project_deleted: ['projects', 'activity'],
  timer_started: ['timer', 'tasks', 'activity'],
  timer_stopped: ['timer', 'tasks', 'activity'],
  invite_sent: ['invitations', 'activity'],
  invite_resent: ['invitations', 'activity'],
  invite_cancelled: ['invitations', 'activity'],
  invite_accepted: ['invitations', 'users', 'activity'],
  user_added: ['users', 'activity'],
  user_updated: ['users', 'activity'],
  user_activated: ['users', 'activity'],
  user_deactivated: ['users', 'activity'],
  role_changed: ['users', 'activity'],
  team_created: ['teams', 'activity'],
  team_updated: ['teams', 'activity'],
  team_deleted: ['teams', 'activity'],
  comment_created: ['comments', 'activity'],
  comment_updated: ['comments', 'activity'],
  comment_deleted: ['comments', 'activity'],
};

export type ActivityKind =
  | 'task_created'
  | 'task_updated'
  | 'task_moved'
  | 'task_done'
  | 'task_deleted'
  | 'task_archived'
  | 'task_unarchived'
  | 'project_created'
  | 'project_updated'
  | 'project_deleted'
  | 'timer_started'
  | 'timer_stopped'
  | 'invite_sent'
  | 'invite_resent'
  | 'invite_cancelled'
  | 'invite_accepted'
  | 'user_added'
  | 'user_updated'
  | 'user_activated'
  | 'user_deactivated'
  | 'role_changed'
  | 'team_created'
  | 'team_updated'
  | 'team_deleted'
  | 'comment_created'
  | 'comment_updated'
  | 'comment_deleted';

export interface LogActivityArgs {
  kind: ActivityKind;
  actorId: string | null;
  target?: string | null;
  meta?: Record<string, unknown> | null;
}

export function logActivity(args: LogActivityArgs): void {
  const id = `A${nanoid(10)}`;
  void db
    .insert(activityLog)
    .values({
      id,
      kind: args.kind,
      actorId: args.actorId ?? null,
      target: args.target ?? null,
      meta: args.meta ?? null,
    })
    .catch((e) => {
      console.warn(`[activity] log failed (${args.kind}):`, e);
    });

  // Realtime-Event an verbundene SSE-Clients
  const topics = TOPIC_BY_KIND[args.kind] ?? ['activity'];
  for (const topic of topics) {
    emit(topic, { kind: args.kind, actorId: args.actorId, target: args.target });
  }
}
