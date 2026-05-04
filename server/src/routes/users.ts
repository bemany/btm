import { Hono } from 'hono';
import { eq, asc } from 'drizzle-orm';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { db } from '../db/client.js';
import { users, invitations } from '../db/schema.js';
import { requireAuth, requireAdmin, type Variables } from '../lib/context.js';
import { sendMail, inviteEmail } from '../lib/mailer.js';

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member']).default('member'),
});

const updateUserSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  cap: z.number().int().min(0).max(168).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  role: z.enum(['admin', 'member']).optional(),
});

export const usersRoute = new Hono<{ Variables: Variables }>()
  .use('*', requireAuth)
  .get('/', async (c) => {
    const list = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        image: users.image,
        role: users.role,
        cap: users.cap,
        color: users.color,
      })
      .from(users)
      .orderBy(asc(users.name));
    return c.json({ users: list });
  })
  .patch('/:id', async (c) => {
    const me = c.get('user')!;
    const id = c.req.param('id');
    const body = updateUserSchema.parse(await c.req.json());

    // Nur Admins dürfen role ändern oder andere User editieren
    if (id !== me.id && me.role !== 'admin') return c.json({ error: 'forbidden' }, 403);
    if (body.role && me.role !== 'admin') return c.json({ error: 'admin only' }, 403);

    const [row] = await db
      .update(users)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    if (!row) return c.json({ error: 'not found' }, 404);
    return c.json({ user: row });
  });

export const invitationsRoute = new Hono<{ Variables: Variables }>()
  .use('*', requireAuth)
  .get('/', requireAdmin, async (c) => {
    const list = await db.select().from(invitations).orderBy(asc(invitations.createdAt));
    return c.json({ invitations: list });
  })
  .post('/', requireAdmin, async (c) => {
    const inviter = c.get('user')!;
    const body = inviteSchema.parse(await c.req.json());
    const email = body.email.toLowerCase().trim();

    // Existiert User schon? Dann nur Rolle anpassen.
    const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing) {
      await db.update(users).set({ role: body.role, updatedAt: new Date() }).where(eq(users.id, existing.id));
      return c.json({ updated: true, user: existing });
    }

    const id = `I${nanoid(10)}`;
    const token = nanoid(32);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const [row] = await db
      .insert(invitations)
      .values({ id, email, role: body.role, invitedById: inviter.id, token, expiresAt })
      .returning();

    const baseUrl = process.env.BETTER_AUTH_URL ?? 'https://btm.bethesna.org';
    const url = `${baseUrl}/invite/${token}`;
    const mail = inviteEmail({ url, inviterName: inviter.name, role: body.role });
    await sendMail({ to: email, ...mail });

    return c.json({ invitation: row }, 201);
  })
  .delete('/:id', requireAdmin, async (c) => {
    const id = c.req.param('id');
    await db.delete(invitations).where(eq(invitations.id, id));
    return c.json({ ok: true });
  })
  // Token-basiertes Akzeptieren — der eingeladene User klickt auf den Link,
  // landet auf /invite/<token>. Frontend ruft dann diese Route auf und
  // löst Magic-Link-Login aus.
  .post('/accept/:token', async (c) => {
    const token = c.req.param('token');
    const [inv] = await db.select().from(invitations).where(eq(invitations.token, token)).limit(1);
    if (!inv) return c.json({ error: 'invalid or used' }, 400);
    if (inv.acceptedAt) return c.json({ error: 'already accepted', email: inv.email }, 410);
    if (inv.expiresAt < new Date()) return c.json({ error: 'expired' }, 410);
    return c.json({
      email: inv.email,
      role: inv.role,
      invitedAt: inv.createdAt,
    });
  });
