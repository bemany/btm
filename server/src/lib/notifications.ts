// Notifications-Helper. Fire-and-forget; Fehler werden geloggt.
// Aktuelle kinds: 'mention'. Erweiterbar: 'task_assigned', 'comment_reply',
// 'due_soon' — payload-Struktur wird je kind unterschiedlich sein, daher
// generisch als jsonb gespeichert.

import { nanoid } from 'nanoid';
import { db } from '../db/client.js';
import { notifications } from '../db/schema.js';
import { emit } from './events.js';
import { sendPushToUser } from './push.js';

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

function pushTitle(kind: NotificationKind, payload: CreateNotificationArgs['payload']): { title: string; body: string; url: string } {
  const p = payload as Record<string, string>;
  switch (kind) {
    case 'mention':
      return { title: 'BTM — Neue Erwähnung', body: p.excerpt ?? 'Jemand hat dich erwähnt', url: '/inbox' };
    case 'review_request':
      return { title: 'BTM — Review-Anfrage', body: `Aufgabe: ${p.taskTitle ?? ''}`, url: '/inbox' };
    case 'reminder':
      return { title: 'BTM — Erinnerung', body: p.taskTitle ?? 'Aufgaben-Erinnerung', url: p.taskUrl ?? '/inbox' };
    case 'feedback_resolved':
      return { title: 'BTM — Feedback umgesetzt', body: p.feedbackTitle ?? 'Dein Feedback wurde bearbeitet', url: '/inbox' };
    default:
      return { title: 'BTM', body: 'Neue Benachrichtigung', url: '/inbox' };
  }
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
    const push = pushTitle(args.kind, args.payload);
    sendPushToUser(args.userId, push).catch(() => {});
  } catch (e) {
    console.warn(`[notifications] insert failed (${args.kind}):`, e);
  }
}
