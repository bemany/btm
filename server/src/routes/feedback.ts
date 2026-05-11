// Feedback-Route — Bug-Reports + Feature-Requests von Nutzern.
//
// POST /                — neuer Eintrag (jeder eingeloggte User)
// GET  /                — Liste (alle für Admin, eigene für Nicht-Admin)
// PATCH /:id            — Status / adminNote ändern (nur Admin)
// DELETE /:id           — entfernen (Admin oder Submitter)

import { Hono } from 'hono';
import { and, desc, eq, or } from 'drizzle-orm';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { db } from '../db/client.js';
import { feedback, users } from '../db/schema.js';
import { requireAuth, type Variables } from '../lib/context.js';
import { createNotification } from '../lib/notifications.js';
import { sendMail, feedbackResolvedEmail, appIconAttachment } from '../lib/mailer.js';

const TypeEnum = z.enum(['bug', 'feature']);
const StatusEnum = z.enum(['open', 'in_progress', 'done', 'wontfix']);

const createSchema = z.object({
  type: TypeEnum,
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(20_000),
  contextPath: z.string().max(2000).optional().nullable(),
  contextTheme: z.string().max(80).optional().nullable(),
  contextUserAgent: z.string().max(500).optional().nullable(),
});

const updateSchema = z.object({
  status: StatusEnum.optional(),
  adminNote: z.string().max(20_000).nullable().optional(),
});

const resolveSchema = z.object({
  resolutionNote: z.string().max(20_000).optional().nullable(),
});

export const feedbackRoute = new Hono<{ Variables: Variables }>()
  .use('*', requireAuth)
  .get('/', async (c) => {
    const me = c.get('user')!;
    const filter =
      me.role === 'admin'
        ? undefined
        : eq(feedback.submitterId, me.id);
    const list = await (filter
      ? db.select().from(feedback).where(filter)
      : db.select().from(feedback))
      .orderBy(desc(feedback.createdAt));
    return c.json({ feedback: list });
  })
  .post('/', async (c) => {
    const me = c.get('user')!;
    const body = createSchema.parse(await c.req.json());
    const id = `F${nanoid(10)}`;
    const [row] = await db
      .insert(feedback)
      .values({
        id,
        type: body.type,
        title: body.title,
        body: body.body,
        contextPath: body.contextPath ?? null,
        contextTheme: body.contextTheme ?? null,
        contextUserAgent: body.contextUserAgent ?? null,
        submitterId: me.id,
      })
      .returning();
    return c.json({ feedback: row }, 201);
  })
  .patch('/:id', async (c) => {
    const me = c.get('user')!;
    if (me.role !== 'admin') return c.json({ error: 'forbidden' }, 403);
    const id = c.req.param('id');
    const body = updateSchema.parse(await c.req.json());
    const patch: {
      status?: 'open' | 'in_progress' | 'done' | 'wontfix';
      adminNote?: string | null;
      updatedAt: Date;
    } = { updatedAt: new Date() };
    if (body.status !== undefined) patch.status = body.status;
    if (body.adminNote !== undefined) patch.adminNote = body.adminNote;
    const [row] = await db.update(feedback).set(patch).where(eq(feedback.id, id)).returning();
    if (!row) return c.json({ error: 'not found' }, 404);
    return c.json({ feedback: row });
  })
  .delete('/:id', async (c) => {
    const me = c.get('user')!;
    const id = c.req.param('id');
    const [item] = await db.select().from(feedback).where(eq(feedback.id, id)).limit(1);
    if (!item) return c.json({ error: 'not found' }, 404);
    if (me.role !== 'admin' && item.submitterId !== me.id) {
      return c.json({ error: 'forbidden' }, 403);
    }
    await db.delete(feedback).where(eq(feedback.id, id));
    return c.json({ ok: true });
  })

  // ── Resolve ────────────────────────────────────────────────────────
  // Atomarer Workflow für „Feedback erledigt":
  //   1. status = 'done', adminNote = resolutionNote, updatedAt = now
  //   2. In-App-Notification an den Submitter (kind: 'feedback_resolved')
  //   3. E-Mail an den Submitter (sofern Mention-Mails aktiv sind)
  // Wird typischerweise von Claude Code aus dem Admin-Prompt via API-Token
  // aufgerufen. Nur Admin.
  .post('/:id/resolve', async (c) => {
    const me = c.get('user')!;
    if (me.role !== 'admin') return c.json({ error: 'forbidden' }, 403);
    const id = c.req.param('id');
    const body = resolveSchema.parse(await c.req.json().catch(() => ({})));
    const resolutionNote = body.resolutionNote ?? null;

    // 1. Feedback updaten
    const [row] = await db
      .update(feedback)
      .set({
        status: 'done',
        adminNote: resolutionNote,
        updatedAt: new Date(),
      })
      .where(eq(feedback.id, id))
      .returning();
    if (!row) return c.json({ error: 'not found' }, 404);

    // 2. Submitter laden (für Notify-Prefs + E-Mail)
    if (row.submitterId) {
      const [submitter] = await db
        .select()
        .from(users)
        .where(eq(users.id, row.submitterId))
        .limit(1);

      if (submitter) {
        // 2a. In-App-Notification
        await createNotification({
          userId: submitter.id,
          actorId: me.id,
          kind: 'feedback_resolved',
          payload: {
            feedbackId: row.id,
            feedbackType: row.type,
            feedbackTitle: row.title,
            resolutionNote,
          },
        });

        // 2b. E-Mail (best-effort, async, kein Block).
        // Feedback-Resolved-Mails kann der User nicht abschalten — sind
        // selten und der User hat das Feedback aktiv eingereicht. In-App-
        // Notification kann sowieso nicht abgeschaltet werden, Mail ist
        // direkte Bestätigung „dein Anliegen wurde bearbeitet".
        if (submitter.email) {
          const appUrl = process.env.BETTER_AUTH_URL ?? 'https://btm.bethesna.org';
          const email = feedbackResolvedEmail({
            recipientName: submitter.name || submitter.email,
            feedbackType: row.type,
            feedbackTitle: row.title,
            resolutionNote,
            resolverName: me.name || me.email,
            inboxUrl: `${appUrl}/inbox`,
            unsubscribeUrl: `${appUrl}/settings`,
          });
          const icon = appIconAttachment();
          sendMail({
            to: submitter.email,
            subject: email.subject,
            text: email.text,
            html: email.html,
            attachments: icon ? [icon] : [],
          }).catch((e) => console.warn('[feedback resolve] mail failed:', e));
        }
      }
    }

    return c.json({ feedback: row });
  });

void or;
void and;
