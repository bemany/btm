import { Hono } from 'hono';
import { eq, asc, and } from 'drizzle-orm';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { db } from '../db/client.js';
import { users, invitations } from '../db/schema.js';
import { requireAuth, requireAdmin, type Variables } from '../lib/context.js';
import { sendMail, inviteEmail, appIconAttachment } from '../lib/mailer.js';
import { logActivity } from '../lib/activity.js';

const inviteSchema = z.object({
  email: z.string().email(),
  name: z.string().max(120).optional(),
  role: z.enum(['admin', 'member']).default('member'),
  teamId: z.string().nullable().optional(),
  cap: z.number().int().min(0).max(168).default(40),
});

const updateUserSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  jobTitle: z.string().max(120).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  cap: z.number().int().min(0).max(168).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  role: z.enum(['admin', 'member']).optional(),
  status: z.enum(['active', 'invited', 'inactive']).optional(),
  teamId: z.string().nullable().optional(),
  boardDefaultView: z.enum(['kanban', 'list', 'timeline']).optional(),
});

const projectionFields = {
  id: users.id,
  email: users.email,
  name: users.name,
  image: users.image,
  role: users.role,
  status: users.status,
  cap: users.cap,
  color: users.color,
  jobTitle: users.jobTitle,
  phone: users.phone,
  teamId: users.teamId,
  boardDefaultView: users.boardDefaultView,
  createdAt: users.createdAt,
} as const;

export const usersRoute = new Hono<{ Variables: Variables }>()
  .use('*', requireAuth)
  .get('/', async (c) => {
    const list = await db.select(projectionFields).from(users).orderBy(asc(users.name));
    return c.json({ users: list });
  })
  .patch('/:id', async (c) => {
    const me = c.get('user')!;
    const id = c.req.param('id');
    const body = updateUserSchema.parse(await c.req.json());

    // Nur Admins dürfen role/status ändern oder andere User editieren
    if (id !== me.id && me.role !== 'admin') return c.json({ error: 'forbidden' }, 403);
    if ((body.role || body.status) && me.role !== 'admin') return c.json({ error: 'admin only' }, 403);

    const before = await db.select().from(users).where(eq(users.id, id)).limit(1);
    const [row] = await db
      .update(users)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning(projectionFields);
    if (!row) return c.json({ error: 'not found' }, 404);

    if (body.role && before[0]?.role !== body.role) {
      logActivity({ kind: 'role_changed', actorId: me.id, target: id, meta: { from: before[0]?.role, to: body.role } });
    }
    if (body.status && before[0]?.status !== body.status) {
      logActivity({
        kind: body.status === 'inactive' ? 'user_deactivated' : 'user_activated',
        actorId: me.id,
        target: id,
      });
    }
    if (Object.keys(body).some((k) => !['role', 'status'].includes(k))) {
      logActivity({ kind: 'user_updated', actorId: me.id, target: id, meta: body });
    }

    return c.json({ user: row });
  });

export const invitationsRoute = new Hono<{ Variables: Variables }>()
  // Public: Token-Lookup + Accept-Mark (eingeladene User haben noch keine Session)
  .get('/accept/:token', async (c) => {
    const token = c.req.param('token');
    const [inv] = await db
      .select()
      .from(invitations)
      .where(and(eq(invitations.token, token)))
      .limit(1);
    if (!inv) return c.json({ error: 'invalid or used' }, 404);
    if (inv.acceptedAt) return c.json({ error: 'already accepted', email: inv.email }, 410);
    if (inv.cancelledAt) return c.json({ error: 'cancelled' }, 410);
    if (inv.expiresAt < new Date()) return c.json({ error: 'expired' }, 410);
    return c.json({
      email: inv.email,
      name: inv.name,
      role: inv.role,
      teamId: inv.teamId,
      cap: inv.cap,
      invitedAt: inv.createdAt,
    });
  })
  .post('/accept/:token', async (c) => {
    const token = c.req.param('token');
    const [inv] = await db.select().from(invitations).where(eq(invitations.token, token)).limit(1);
    if (!inv) return c.json({ error: 'invalid' }, 404);
    if (inv.acceptedAt) return c.json({ ok: true });
    await db.update(invitations).set({ acceptedAt: new Date() }).where(eq(invitations.id, inv.id));
    const [u] = await db.select().from(users).where(eq(users.email, inv.email)).limit(1);
    if (u) {
      await db
        .update(users)
        .set({
          role: inv.role,
          teamId: inv.teamId,
          cap: inv.cap,
          name: inv.name?.trim() || u.name,
          status: 'active',
          updatedAt: new Date(),
        })
        .where(eq(users.id, u.id));
      logActivity({ kind: 'invite_accepted', actorId: u.id, target: inv.email });
    }
    return c.json({ ok: true });
  })
  // Ab hier: Admin-only
  .use('*', requireAuth)
  .get('/', requireAdmin, async (c) => {
    // Nur "offene" Einladungen (nicht akzeptiert, nicht zurückgezogen, nicht abgelaufen)
    const now = new Date();
    const list = await db
      .select()
      .from(invitations)
      .orderBy(asc(invitations.createdAt));
    return c.json({
      invitations: list.filter(
        (i) => !i.acceptedAt && !i.cancelledAt && i.expiresAt > now,
      ),
    });
  })
  .post('/', requireAdmin, async (c) => {
    const inviter = c.get('user')!;
    const body = inviteSchema.parse(await c.req.json());
    const email = body.email.toLowerCase().trim();

    // Existiert User schon? Dann nur Felder anpassen + reaktivieren
    const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing) {
      await db
        .update(users)
        .set({
          role: body.role,
          teamId: body.teamId ?? existing.teamId,
          cap: body.cap,
          status: 'active',
          name: body.name?.trim() || existing.name,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existing.id));
      logActivity({ kind: 'user_updated', actorId: inviter.id, target: existing.id, meta: { reinvited: true } });
      return c.json({ updated: true, user: existing });
    }

    const id = `I${nanoid(10)}`;
    const token = nanoid(32);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const [row] = await db
      .insert(invitations)
      .values({
        id,
        email,
        name: body.name?.trim() || null,
        role: body.role,
        teamId: body.teamId ?? null,
        cap: body.cap,
        invitedById: inviter.id,
        token,
        expiresAt,
      })
      .returning();

    // Inactive User-Record gleich mit anlegen, damit Aufgaben *vor* dem
    // Login schon zugewiesen werden können. Beim ersten Magic-Link-Verify
    // findet Better-Auth den existierenden Datensatz und switcht status='active'.
    const userId = `U${nanoid(10)}`;
    const colors = ['#6B6359', '#5573A0', '#5E7F4E', '#C85A2C', '#8C6F2D', '#A85A95', '#4A8580'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    await db.insert(users).values({
      id: userId,
      email,
      emailVerified: false,
      name: body.name?.trim() || email.split('@')[0],
      role: body.role,
      status: 'invited',
      cap: body.cap,
      color,
      teamId: body.teamId ?? null,
    });
    // Privat-Projekt direkt mit anlegen, damit der User nach Annahme
    // sofort einen persönlichen Bucket hat
    try {
      const { ensurePrivateProject } = await import('../lib/private-project.js');
      await ensurePrivateProject(userId, body.name?.trim() || email.split('@')[0]);
    } catch {
      /* nicht kritisch — kann auch beim ersten Login nachgeholt werden */
    }

    const baseUrl = process.env.BETTER_AUTH_URL ?? 'https://btm.bethesna.org';
    const url = `${baseUrl}/invite/${token}`;
    const mail = inviteEmail({
      url,
      inviterName: inviter.name,
      role: body.role,
      inviteeName: body.name?.trim() || null,
    });
    const icon = appIconAttachment();
    await sendMail({ to: email, ...mail, attachments: icon ? [icon] : undefined });

    logActivity({ kind: 'invite_sent', actorId: inviter.id, target: email, meta: { role: body.role, teamId: body.teamId } });
    return c.json({ invitation: row }, 201);
  })
  .post('/:id/resend', requireAdmin, async (c) => {
    const inviter = c.get('user')!;
    const id = c.req.param('id');
    const [inv] = await db.select().from(invitations).where(eq(invitations.id, id)).limit(1);
    if (!inv) return c.json({ error: 'not found' }, 404);
    if (inv.acceptedAt) return c.json({ error: 'already accepted' }, 410);
    if (inv.cancelledAt) return c.json({ error: 'cancelled' }, 410);

    // Frische Expiry + Token
    const newToken = nanoid(32);
    const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db
      .update(invitations)
      .set({ token: newToken, expiresAt: newExpiry })
      .where(eq(invitations.id, id));

    const baseUrl = process.env.BETTER_AUTH_URL ?? 'https://btm.bethesna.org';
    const url = `${baseUrl}/invite/${newToken}`;
    const mail = inviteEmail({
      url,
      inviterName: inviter.name,
      role: inv.role,
      inviteeName: inv.name,
    });
    const icon = appIconAttachment();
    await sendMail({ to: inv.email, ...mail, attachments: icon ? [icon] : undefined });

    logActivity({ kind: 'invite_resent', actorId: inviter.id, target: inv.email });
    return c.json({ ok: true });
  })
  .delete('/:id', requireAdmin, async (c) => {
    const inviter = c.get('user')!;
    const id = c.req.param('id');
    const [inv] = await db.select().from(invitations).where(eq(invitations.id, id)).limit(1);
    if (!inv) return c.json({ error: 'not found' }, 404);
    await db
      .update(invitations)
      .set({ cancelledAt: new Date() })
      .where(eq(invitations.id, id));
    logActivity({ kind: 'invite_cancelled', actorId: inviter.id, target: inv.email });
    return c.json({ ok: true });
  });
