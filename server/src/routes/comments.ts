// Comments-Endpoint: subjektpolymorph (Task ODER Project). Mention-Fanout
// (comment_mentions + notifications) passiert explizit hier — kein DB-Trigger.
// Edit (PATCH) löst Notifications nur für NEU hinzugefügte Mentions aus
// (Diff oldSet vs newSet) — kein Spam für bereits informierte User.

import { Hono } from 'hono';
import { and, eq, asc, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { db } from '../db/client.js';
import { comments, commentMentions, tasks, projects, users } from '../db/schema.js';
import { requireAuth, type Variables } from '../lib/context.js';
import { logActivity } from '../lib/activity.js';
import { createNotification } from '../lib/notifications.js';
import { extractMentionedUserIds, renderForExcerpt } from '../lib/mentions.js';

const SubjectEnum = z.enum(['task', 'project']);
const createSchema = z.object({
  subjectType: SubjectEnum,
  subjectId: z.string().min(1),
  body: z.string().min(1).max(10_000),
});
const updateSchema = z.object({
  body: z.string().min(1).max(10_000),
});

async function loadSubjectTitle(
  type: 'task' | 'project',
  id: string,
): Promise<string | null> {
  if (type === 'task') {
    const [r] = await db.select({ title: tasks.title }).from(tasks).where(eq(tasks.id, id)).limit(1);
    return r?.title ?? null;
  }
  const [r] = await db.select({ name: projects.name }).from(projects).where(eq(projects.id, id)).limit(1);
  return r?.name ?? null;
}

/**
 * Schreibt comment_mentions-Einträge + Notifications für die Liste an User-IDs.
 * Self-Mentions werden gefiltert. Nur User, die wirklich existieren,
 * bekommen Einträge — gegen Picker-Cache-Stale.
 */
async function fanoutMentions(opts: {
  commentId: string;
  newMentionIds: string[];
  authorId: string;
  subjectType: 'task' | 'project';
  subjectId: string;
  subjectTitle: string;
  excerpt: string;
  notifyOnly?: string[]; // wenn gesetzt, nur diese User benachrichtigen (für Edit-Diff)
}): Promise<void> {
  const ids = opts.newMentionIds.filter((id) => id !== opts.authorId);
  if (ids.length === 0) return;

  const valid = await db.select({ id: users.id }).from(users).where(inArray(users.id, ids));
  const validIds = valid.map((v) => v.id);
  if (validIds.length === 0) return;

  await db.insert(commentMentions).values(validIds.map((uid) => ({ commentId: opts.commentId, userId: uid })));

  const notifyIds = opts.notifyOnly
    ? validIds.filter((id) => opts.notifyOnly!.includes(id))
    : validIds;
  await Promise.all(
    notifyIds.map((uid) =>
      createNotification({
        userId: uid,
        actorId: opts.authorId,
        kind: 'mention',
        payload: {
          commentId: opts.commentId,
          subjectType: opts.subjectType,
          subjectId: opts.subjectId,
          subjectTitle: opts.subjectTitle,
          excerpt: opts.excerpt,
        },
      }),
    ),
  );
}

export const commentsRoute = new Hono<{ Variables: Variables }>()
  .use('*', requireAuth)

  // GET /comments?subjectType=task&subjectId=T123
  .get('/', async (c) => {
    const subjectType = SubjectEnum.parse(c.req.query('subjectType'));
    const subjectId = z.string().parse(c.req.query('subjectId'));
    const list = await db
      .select()
      .from(comments)
      .where(and(eq(comments.subjectType, subjectType), eq(comments.subjectId, subjectId)))
      .orderBy(asc(comments.createdAt));
    return c.json({ comments: list });
  })

  .post('/', async (c) => {
    const me = c.get('user')!;
    const body = createSchema.parse(await c.req.json());

    const subjectTitle = await loadSubjectTitle(body.subjectType, body.subjectId);
    if (!subjectTitle) return c.json({ error: 'subject not found' }, 404);

    const id = `C${nanoid(10)}`;
    const [row] = await db
      .insert(comments)
      .values({
        id,
        subjectType: body.subjectType,
        subjectId: body.subjectId,
        authorId: me.id,
        body: body.body,
      })
      .returning();

    const mentionIds = extractMentionedUserIds(body.body);
    if (mentionIds.length > 0) {
      await fanoutMentions({
        commentId: id,
        newMentionIds: mentionIds,
        authorId: me.id,
        subjectType: body.subjectType,
        subjectId: body.subjectId,
        subjectTitle,
        excerpt: renderForExcerpt(body.body),
      });
    }

    logActivity({
      kind: 'comment_created',
      actorId: me.id,
      target: id,
      meta: { subjectType: body.subjectType, subjectId: body.subjectId, subjectTitle },
    });
    return c.json({ comment: row }, 201);
  })

  .patch('/:id', async (c) => {
    const me = c.get('user')!;
    const id = c.req.param('id');
    const body = updateSchema.parse(await c.req.json());
    const [existing] = await db.select().from(comments).where(eq(comments.id, id)).limit(1);
    if (!existing) return c.json({ error: 'not found' }, 404);
    if (existing.authorId !== me.id) return c.json({ error: 'forbidden' }, 403);

    const [row] = await db
      .update(comments)
      .set({ body: body.body, editedAt: new Date() })
      .where(eq(comments.id, id))
      .returning();

    // Re-Fan-Out: alte Mentions weg, neue extrahieren. Notifications nur
    // für User die jetzt erstmals erwähnt werden (oldSet → newSet diff).
    const oldRows = await db
      .select({ userId: commentMentions.userId })
      .from(commentMentions)
      .where(eq(commentMentions.commentId, id));
    const oldSet = new Set(oldRows.map((r) => r.userId));
    await db.delete(commentMentions).where(eq(commentMentions.commentId, id));

    const newIds = extractMentionedUserIds(body.body);
    if (newIds.length > 0) {
      const subjectTitle = await loadSubjectTitle(
        existing.subjectType as 'task' | 'project',
        existing.subjectId,
      );
      if (subjectTitle) {
        const fresh = newIds.filter((u) => !oldSet.has(u));
        await fanoutMentions({
          commentId: id,
          newMentionIds: newIds,
          authorId: me.id,
          subjectType: existing.subjectType as 'task' | 'project',
          subjectId: existing.subjectId,
          subjectTitle,
          excerpt: renderForExcerpt(body.body),
          notifyOnly: fresh,
        });
      }
    }

    logActivity({
      kind: 'comment_updated',
      actorId: me.id,
      target: id,
      meta: { subjectType: existing.subjectType, subjectId: existing.subjectId },
    });
    return c.json({ comment: row });
  })

  .delete('/:id', async (c) => {
    const me = c.get('user')!;
    const id = c.req.param('id');
    const [existing] = await db.select().from(comments).where(eq(comments.id, id)).limit(1);
    if (!existing) return c.json({ error: 'not found' }, 404);
    if (existing.authorId !== me.id && me.role !== 'admin') {
      return c.json({ error: 'forbidden' }, 403);
    }

    // Cascade entfernt comment_mentions automatisch. Notifications bleiben
    // (haben eigene snapshot-payload) — Klick auf Inbox-Eintrag würde dann
    // im Frontend zur Task ohne Comment führen, ist akzeptiert.
    await db.delete(comments).where(eq(comments.id, id));

    logActivity({
      kind: 'comment_deleted',
      actorId: me.id,
      target: id,
      meta: { subjectType: existing.subjectType, subjectId: existing.subjectId },
    });
    return c.json({ ok: true });
  });
