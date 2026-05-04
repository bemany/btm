import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { magicLink } from 'better-auth/plugins';
import { db } from '../db/client.js';
import * as schema from '../db/schema.js';
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
        const mail = magicLinkEmail({ email, url });
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
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh every 24 h
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
});

export type AuthSession = Awaited<ReturnType<typeof auth.api.getSession>>;
