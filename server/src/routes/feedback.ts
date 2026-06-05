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
const PriorityEnum = z.enum(['low', 'med', 'high']);

const createSchema = z.object({
  type: TypeEnum,
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(20_000),
  contextPath: z.string().max(2000).optional().nullable(),
  contextTheme: z.string().max(80).optional().nullable(),
  contextUserAgent: z.string().max(500).optional().nullable(),
  // Data-URI eines optionalen Screenshots (~8 MB base64 max).
  // Drag&drop + Clipboard-Paste im FeedbackModal.
  screenshotBase64: z
    .string()
    .max(10_000_000)
    .regex(/^data:image\/(png|jpe?g|gif|webp);base64,/i, 'invalid screenshot data URI')
    .optional()
    .nullable(),
});

const updateSchema = z.object({
  status: StatusEnum.optional(),
  priority: PriorityEnum.optional(),
  adminNote: z.string().max(20_000).nullable().optional(),
  // Admin kann Title + Body korrigieren (z.B. Tippfehler, klarere Formulierung,
  // unsinnige Feature-Wünsche rebooten). type bleibt unveränderlich — wenn das
  // ein Feature statt Bug ist, ist das eine andere Entscheidung als ein Edit.
  title: z.string().min(1).max(200).optional(),
  body: z.string().min(1).max(20_000).optional(),
  type: TypeEnum.optional(),
});

const resolveSchema = z.object({
  resolutionNote: z.string().max(20_000).optional().nullable(),
});

// FTKnjlXNVlH: Reporter nimmt das Ergebnis ab (approved) oder lehnt ab.
// Bei Ablehnung ist eine Begruendung erwuenscht (aber nicht hart erzwungen,
// damit der Button auch ohne Tipparbeit nutzbar bleibt).
const confirmSchema = z.object({
  approved: z.boolean(),
  note: z.string().max(20_000).optional().nullable(),
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
        screenshotBase64: body.screenshotBase64 ?? null,
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
      priority?: 'low' | 'med' | 'high';
      adminNote?: string | null;
      title?: string;
      body?: string;
      type?: 'bug' | 'feature';
      reporterConfirmation?: 'confirmed' | 'rejected' | null;
      reporterConfirmationNote?: string | null;
      reporterConfirmedAt?: Date | null;
      updatedAt: Date;
    } = { updatedAt: new Date() };
    if (body.status !== undefined) {
      patch.status = body.status;
      // Status-Wechsel startet einen frischen Bestaetigungs-Zyklus: eine alte
      // Reporter-Abnahme gilt nicht mehr fuer den neuen Stand.
      patch.reporterConfirmation = null;
      patch.reporterConfirmationNote = null;
      patch.reporterConfirmedAt = null;
    }
    if (body.priority !== undefined) patch.priority = body.priority;
    if (body.adminNote !== undefined) patch.adminNote = body.adminNote;
    if (body.title !== undefined) patch.title = body.title;
    if (body.body !== undefined) patch.body = body.body;
    if (body.type !== undefined) patch.type = body.type;
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
        // Frischer Bestaetigungs-Zyklus: Reporter soll den neuen Stand abnehmen.
        reporterConfirmation: null,
        reporterConfirmationNote: null,
        reporterConfirmedAt: null,
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
          const appUrl = process.env.BETTER_AUTH_URL ?? 'http://localhost:3001';
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
  })

  // ── Reporter-Bestaetigung (FTKnjlXNVlH) ────────────────────────────
  // Der Einreicher prueft ein als 'done' markiertes Feedback und nimmt es
  // entweder ab (approved=true) oder lehnt ab (approved=false). Bei Ablehnung
  // springt das Feedback zurueck auf 'open' und alle Admins werden benachrich-
  // tigt, damit weiter daran gearbeitet wird. Nur der Submitter selbst darf
  // bestaetigen, und nur solange der Status 'done' ist.
  .post('/:id/confirm', async (c) => {
    const me = c.get('user')!;
    const id = c.req.param('id');
    const { approved, note } = confirmSchema.parse(await c.req.json().catch(() => ({})));
    const trimmedNote = (note ?? '').trim() || null;

    const [item] = await db.select().from(feedback).where(eq(feedback.id, id)).limit(1);
    if (!item) return c.json({ error: 'not found' }, 404);
    if (item.submitterId !== me.id) return c.json({ error: 'forbidden' }, 403);
    if (item.status !== 'done') {
      return c.json({ error: 'not_resolved' }, 409);
    }

    if (approved) {
      // Abnahme: Status bleibt 'done', Bestaetigung festhalten.
      const [row] = await db
        .update(feedback)
        .set({
          reporterConfirmation: 'confirmed',
          reporterConfirmationNote: trimmedNote,
          reporterConfirmedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(feedback.id, id))
        .returning();
      return c.json({ feedback: row });
    }

    // Ablehnung: zurueck auf 'open', Begruendung festhalten, Admins benachrichtigen.
    const [row] = await db
      .update(feedback)
      .set({
        status: 'open',
        reporterConfirmation: 'rejected',
        reporterConfirmationNote: trimmedNote,
        reporterConfirmedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(feedback.id, id))
      .returning();

    // Alle aktiven Admins benachrichtigen (In-App + Push).
    const admins = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, 'admin'), eq(users.status, 'active')));
    await Promise.all(
      admins
        .filter((a) => a.id !== me.id) // sich selbst nicht benachrichtigen
        .map((a) =>
          createNotification({
            userId: a.id,
            actorId: me.id,
            kind: 'feedback_reopened',
            payload: {
              feedbackId: row.id,
              feedbackType: row.type,
              feedbackTitle: row.title,
              reporterName: me.name || me.email,
              rejectionNote: trimmedNote,
            },
          }),
        ),
    );

    return c.json({ feedback: row });
  });

void or;
