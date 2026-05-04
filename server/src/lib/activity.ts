// Activity-Log-Helper. Fire-and-forget; Fehler werden geloggt aber nicht zurückgegeben.

import { nanoid } from 'nanoid';
import { db } from '../db/client.js';
import { activityLog } from '../db/schema.js';

export type ActivityKind =
  | 'task_created'
  | 'task_updated'
  | 'task_moved'
  | 'task_done'
  | 'task_deleted'
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
  | 'team_deleted';

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
}
