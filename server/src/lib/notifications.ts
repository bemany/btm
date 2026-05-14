// Notifications-Helper. Fire-and-forget; Fehler werden geloggt.
// Aktuelle kinds: 'mention'. Erweiterbar: 'task_assigned', 'comment_reply',
// 'due_soon' — payload-Struktur wird je kind unterschiedlich sein, daher
// generisch als jsonb gespeichert.

import { nanoid } from 'nanoid';
import { db } from '../db/client.js';
import { notifications } from '../db/schema.js';
import { emit } from './events.js';

export type NotificationKind = 'mention' | 'review_request' | 'feedback_resolved' | 'reminder';

export interface MentionPayload {
  commentId: string;
  subjectType: 'task' | 'project';
  subjectId: string;
  subjectTitle: string; // snapshot, überlebt Rename
  excerpt: string;      // erste 140 chars vom Body, Tokens als @Name gerendert
}

export interface FeedbackResolvedPayload {
  feedbackId: string;
  feedbackType: 'bug' | 'feature';
  feedbackTitle: string;      // snapshot
  resolutionNote: string | null; // optionaler Admin-Kommentar
}

export interface CreateNotificationArgs {
  userId: string;       // Empfänger
  actorId: string | null;
  kind: NotificationKind;
  payload: MentionPayload | Record<string, unknown>;
}

export async function createNotification(args: CreateNotificationArgs): Promise<void> {
  const id = `N${nanoid(10)}`;
  try {
    await db.insert(notifications).values({
      id,
      userId: args.userId,
      actorId: args.actorId,
      kind: args.kind,
      payload: args.payload as Record<string, unknown>,
    });
    emit('notifications', { userId: args.userId, kind: args.kind });
  } catch (e) {
    console.warn(`[notifications] insert failed (${args.kind}):`, e);
  }
}
