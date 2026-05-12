import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { magicLink } from 'better-auth/plugins';
import { nanoid } from 'nanoid';
import { db } from '../db/client.js';
import * as schema from '../db/schema.js';
import { loginCodes } from '../db/schema.js';
import { sendMail, magicLinkEmail } from './mailer.js';

const initialAdminEmail = (process.env.INITIAL_ADMIN_EMAIL ?? '').trim().toLowerCase();
const trustedOrigins = (process.env.TRUSTED_ORIGINS ?? 'https://btm.bethesna.org')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  baseURL: process.env.BETTER_AUTH_URL ?? 'https://btm.bethesna.org',
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins,
  emailAndPassword: { enabled: false },
  user: {
    additionalFields: {
      role: { type: 'string', defaultValue: 'member', input: false },
      cap: { type: 'number', defaultValue: 40, input: false },
      color: { type: 'string', defaultValue: '#6B6359', input: false },
    },
  },
  plugins: [
    magicLink({
      expiresIn: 60 * 15, // 15 min
      sendMagicLink: async ({ email, url }) => {
        // Parallel zum Magic-Link einen 6-stelligen Code generieren und in
        // login_codes speichern. So kann der User in der PWA einfach den
        // Code eintippen statt aus der App in den Browser zu wechseln.
        const code = String(Math.floor(100000 + Math.random() * 900000));
        const lowerEmail = email.toLowerCase();
        try {
          await db.insert(loginCodes).values({
            id: `LC${nanoid(12)}`,
            email: lowerEmail,
            code,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          });
        } catch (e) {
          console.warn('[auth] failed to insert login_code', e);
        }
        const mail = magicLinkEmail({ email, url, code });
        await sendMail({ to: email, ...mail });
      },
    }),
  ],
  databaseHooks: {
    user: {
      create: {
        // - Name aus Email ableiten falls leer (Magic-Link liefert keinen Namen)
        // - Initial-Admin-Promotion über INITIAL_ADMIN_EMAIL
        before: async (user) => {
          const email = (user.email ?? '').toLowerCase();
          const fallbackName =
            (user.name && user.name.trim()) ||
            email
              .split('@')[0]
              .replace(/[._-]+/g, ' ')
              .replace(/\b\w/g, (c) => c.toUpperCase());
          const role: 'admin' | 'member' =
            initialAdminEmail && email === initialAdminEmail ? 'admin' : 'member';
          return { data: { ...user, name: fallbackName, role } };
        },
        // Nach erfolgreichem User-Create automatisch ein Privat-Projekt anlegen
        // (sichtbar nur für diesen User). Dafür ist ensurePrivateProject() in
        // lib/private-project.ts zuständig.
        after: async (user) => {
          try {
            const { ensurePrivateProject } = await import('./private-project.js');
            await ensurePrivateProject(user.id, user.name);
          } catch (e) {
            console.warn('[auth] ensurePrivateProject failed', e);
          }
        },
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh every 24 h
    // cookieCache war problematisch: Better-Auth packt das gesamte User-Objekt
    // INKLUSIVE user.image (base64-JPEG-Avatar, 5-15 KB) als signiertes Cookie
    // 'session_data' in den Browser. Mit anderen Cookies + Headern überstieg
    // das Node's default max-http-header-size von 16 KB → HTTP 431
    // (Request Header Fields Too Large). DB-Lookup pro authentifiziertem
    // Request kostet bei lokalem Postgres <1 ms — vernachlässigbar.
    cookieCache: { enabled: false },
  },
});

export type AuthSession = Awaited<ReturnType<typeof auth.api.getSession>>;
