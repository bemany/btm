import nodemailer from 'nodemailer';
import { APP_FULL_NAME, APP_ORG_NAME, APP_URL } from './brand.js';

const host = process.env.SMTP_HOST;
const port = Number(process.env.SMTP_PORT ?? 465);
const secure = (process.env.SMTP_SECURE ?? 'true') === 'true';
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
const from = process.env.SMTP_FROM ?? user ?? 'noreply@localhost';
// MAIL_DISABLED=true → kein Versand, nur Log. Fuer Staging/Dev-Umgebungen.
const mailDisabled = process.env.MAIL_DISABLED === 'true';

let transporter: nodemailer.Transporter | null = null;

function getTransport(): nodemailer.Transporter {
  if (!host || !user || !pass) {
    throw new Error(
      'SMTP nicht konfiguriert (SMTP_HOST/SMTP_USER/SMTP_PASS fehlen). Magic-Links werden in der Konsole geloggt.',
    );
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
  }
  return transporter;
}

export interface MailAttachment {
  filename: string;
  path: string;
  cid: string;
}

export interface MailOpts {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: MailAttachment[];
}

export async function sendMail({ to, subject, text, html, attachments }: MailOpts): Promise<void> {
  if (mailDisabled) {
    console.log(`[mail] DISABLED (MAIL_DISABLED=true) — would have sent to=${to} subject="${subject}"`);
    return;
  }
  try {
    const t = getTransport();
    const info = await t.sendMail({ from, to, subject, text, html, attachments });
    console.log(`[mail] sent to=${to} subject="${subject}" id=${info.messageId}`);
  } catch (err) {
    console.warn(`[mail] FAILED to=${to} subject="${subject}":`, err);
    console.warn(`[mail] FALLBACK content:\n--- ${subject} ---\n${text}\n---`);
  }
}

// Pfad zur App-Icon-PNG fürs Mail-Embed.
// Beim Production-Setup auf 139 liegt die hier (Frontend-Build-Output):
//   /opt/apps/btm/dist/app-icon-192.png
// In der Dev-Umgebung in <repo>/public/app-icon-192.png.
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

function findAppIcon(): string | null {
  // Im Docker-Image liegt es unter /app/assets (siehe Dockerfile). Lokal beim
  // Dev-Server im server/-Subdir ebenfalls. Die anderen Pfade decken Legacy-
  // Setups (alter LXC, monorepo-cwd) ab.
  const candidates = [
    resolve(process.cwd(), 'assets/app-icon-192.png'),
    '/opt/apps/btm/dist/app-icon-192.png',
    resolve(process.cwd(), 'dist/app-icon-192.png'),
    resolve(process.cwd(), '../dist/app-icon-192.png'),
    resolve(process.cwd(), '../public/app-icon-192.png'),
    resolve(process.cwd(), 'public/app-icon-192.png'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

export const APP_ICON_CID = 'btm-app-icon';

export function appIconAttachment(): MailAttachment | null {
  const path = findAppIcon();
  if (!path) return null;
  return { filename: 'btm-icon.png', path, cid: APP_ICON_CID };
}

export function magicLinkEmail(opts: {
  url: string;
  email: string;
  code?: string;
}): { subject: string; text: string; html: string } {
  const subject = 'Dein Login für BTM';
  const codeBlock = opts.code
    ? `

Oder falls du in der App bist (z. B. PWA auf dem Handy), gib einfach
diesen Code ein:

    ${opts.code.replace(/(.)(?=.)/g, '$1 ')}
`
    : '';
  const text = `Hi,

du hast einen Login für BTM angefordert. Öffne diesen Link, um dich einzuloggen:

${opts.url}
${codeBlock}
Link und Code sind 15 Minuten gültig. Wenn du das nicht warst, ignoriere diese Mail.

— BTM (${APP_FULL_NAME})
`;
  const codeHtml = opts.code
    ? `
    <div style="margin:22px 0 6px;font-size:12px;color:#6B6359;text-transform:uppercase;letter-spacing:0.08em;font-family:Menlo,Consolas,'SF Mono',monospace;">Oder Code in der App eingeben</div>
    <div style="display:inline-block;background:#FBF1D9;border:1px solid #E8D7A4;border-radius:8px;padding:12px 18px;font-family:Menlo,Consolas,'SF Mono',monospace;font-size:26px;font-weight:700;letter-spacing:0.32em;color:#1C1A17;">${opts.code}</div>
    <p style="font-size:11.5px;color:#6B6359;margin:10px 0 0;line-height:1.55;">Praktisch wenn du in der PWA bist und der Browser-Wechsel nervt.</p>`
    : '';
  const html = `<!doctype html>
<html lang="de"><body style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;background:#FAF7F2;color:#1C1A17;padding:32px;">
  <div style="max-width:480px;margin:auto;background:#fff;border:1px solid #E3DCCE;border-radius:12px;padding:28px;">
    <div style="font-family:'Archivo',-apple-system,sans-serif;font-weight:700;font-size:20px;letter-spacing:-0.01em;margin-bottom:16px;">BTM Login</div>
    <p style="font-size:15px;line-height:1.55;margin:0 0 20px;">Klick auf den Knopf, um dich einzuloggen:</p>
    <a href="${opts.url}" style="display:inline-block;background:#C85A2C;color:#FAF7F2;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:14px;">Bei BTM einloggen</a>
${codeHtml}
    <p style="font-size:12px;color:#6B6359;margin:24px 0 0;line-height:1.55;">Link und Code sind 15 Minuten gültig. Wenn du das nicht warst: einfach ignorieren.</p>
  </div>
</body></html>`;
  return { subject, text, html };
}

// ── Mention-Mail ────────────────────────────────────────────────────────
// Wird sofort verschickt wenn jemand den Empfänger in einem Kommentar
// erwähnt — sofern der User `notify_mentions_mail = true` hat.

export function mentionEmail(opts: {
  actorName: string;
  recipientName: string;
  subjectType: 'task' | 'project';
  subjectTitle: string;
  excerpt: string;
  appUrl: string;
  inboxUrl: string;
  unsubscribeUrl: string; // Settings-Page
}): { subject: string; text: string; html: string } {
  const subjectKindLabel = opts.subjectType === 'task' ? 'Aufgabe' : 'Projekt';
  const subject = `${opts.actorName} hat dich erwähnt: ${opts.subjectTitle}`;
  const greeting = opts.recipientName ? `Hi ${opts.recipientName.split(' ')[0]},` : 'Hi,';
  const text = `${greeting}

${opts.actorName} hat dich in der ${subjectKindLabel} „${opts.subjectTitle}" erwähnt:

  ${opts.excerpt}

Direkt öffnen:
${opts.appUrl}

Alle Erwähnungen in deiner Inbox:
${opts.inboxUrl}

— BTM
Du kannst diese Mails in den Einstellungen ausschalten:
${opts.unsubscribeUrl}
`;

  const html = `<!doctype html>
<html lang="de"><body style="margin:0;padding:0;background:#FAF7F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1C1A17;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF7F2;padding:40px 16px;">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
      <tr>
        <td style="padding:0 0 18px;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-right:10px;vertical-align:middle;">
                <img src="cid:${APP_ICON_CID}" width="36" height="36" alt="BTM" style="display:block;width:36px;height:36px;border-radius:8px;border:0;" />
              </td>
              <td style="vertical-align:middle;">
                <div style="font-family:'Archivo',-apple-system,sans-serif;font-weight:700;font-size:17px;letter-spacing:-0.01em;color:#1C1A17;">BTM</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <tr><td style="background:#fff;border:1px solid #E3DCCE;border-radius:14px;padding:28px 30px 22px;box-shadow:0 18px 40px -20px rgba(28,26,23,0.08);">
        <div style="font-family:Menlo,Consolas,'SF Mono',monospace;font-size:10.5px;color:#C85A2C;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:10px;">
          Du wurdest erwähnt
        </div>

        <h1 style="font-family:'Archivo',-apple-system,sans-serif;font-size:22px;line-height:1.25;letter-spacing:-0.01em;font-weight:700;margin:0 0 8px;color:#1C1A17;">
          ${opts.actorName} <span style="color:#6B6359;font-weight:500;">hat dich erwähnt</span>
        </h1>

        <div style="font-family:Menlo,Consolas,'SF Mono',monospace;font-size:11px;color:#6B6359;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:18px;">
          ${subjectKindLabel} · ${escapeHtml(opts.subjectTitle)}
        </div>

        <div style="background:#F4EFE7;border-left:3px solid #C85A2C;padding:14px 18px;border-radius:6px;margin:0 0 22px;">
          <div style="font-size:14px;line-height:1.6;color:#3D3833;white-space:pre-wrap;">${escapeHtml(opts.excerpt)}</div>
        </div>

        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td style="background:#C85A2C;border-radius:8px;">
              <a href="${opts.appUrl}" style="display:inline-block;padding:11px 22px;color:#FAF7F2;font-weight:600;font-size:14px;text-decoration:none;">
                Öffnen →
              </a>
            </td>
            <td style="padding-left:10px;">
              <a href="${opts.inboxUrl}" style="display:inline-block;padding:11px 18px;color:#3D3833;font-weight:500;font-size:13.5px;text-decoration:none;border:1px solid #E3DCCE;border-radius:8px;background:#fff;">
                Inbox
              </a>
            </td>
          </tr>
        </table>
      </td></tr>

      <tr><td style="padding:18px 8px 0;text-align:center;">
        <div style="font-size:11px;color:#A8A097;line-height:1.55;">
          Du bekommst diese Mail weil du in BTM erwähnt wurdest.<br/>
          <a href="${opts.unsubscribeUrl}" style="color:#6B6359;text-decoration:underline;">Mention-Mails ausschalten</a> · ${APP_URL}
        </div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
  return { subject, text, html };
}

// ── Feedback-Resolved-Mail ──────────────────────────────────────────────
// Wird beim Auflösen eines Feedback-Eintrags an den Reporter geschickt.
// Optionaler resolutionNote = was wurde gemacht / Lösung.
export function feedbackResolvedEmail(opts: {
  recipientName: string;
  feedbackType: 'bug' | 'feature';
  feedbackTitle: string;
  resolutionNote: string | null;
  resolverName: string;
  inboxUrl: string;
  unsubscribeUrl: string;
}): { subject: string; text: string; html: string } {
  const typeLabel = opts.feedbackType === 'bug' ? 'Bug-Report' : 'Feature-Wunsch';
  const verbDe = opts.feedbackType === 'bug' ? 'wurde behoben' : 'wurde umgesetzt';
  const subject = `Dein ${typeLabel} „${opts.feedbackTitle}" ${verbDe}`;
  const greeting = opts.recipientName ? `Hi ${opts.recipientName.split(' ')[0]},` : 'Hi,';
  const noteBlock = opts.resolutionNote
    ? `\nNotiz von ${opts.resolverName}:\n\n  ${opts.resolutionNote}\n`
    : '';
  const text = `${greeting}

dein ${typeLabel} „${opts.feedbackTitle}" ${verbDe}.
${noteBlock}
Inbox:
${opts.inboxUrl}

— BTM
Du kannst diese Mails in den Einstellungen ausschalten:
${opts.unsubscribeUrl}
`;

  const noteHtml = opts.resolutionNote
    ? `<div style="background:#F4EFE7;border-left:3px solid #5E7F4E;padding:14px 18px;border-radius:6px;margin:0 0 22px;">
        <div style="font-family:Menlo,Consolas,'SF Mono',monospace;font-size:10px;color:#5E7F4E;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">
          Notiz von ${escapeHtml(opts.resolverName)}
        </div>
        <div style="font-size:14px;line-height:1.6;color:#3D3833;white-space:pre-wrap;">${escapeHtml(opts.resolutionNote)}</div>
      </div>`
    : '';

  const html = `<!doctype html>
<html lang="de"><body style="margin:0;padding:0;background:#FAF7F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1C1A17;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF7F2;padding:40px 16px;">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
      <tr>
        <td style="padding:0 0 18px;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-right:10px;vertical-align:middle;">
                <img src="cid:${APP_ICON_CID}" width="36" height="36" alt="BTM" style="display:block;width:36px;height:36px;border-radius:8px;border:0;" />
              </td>
              <td style="vertical-align:middle;">
                <div style="font-family:'Archivo',-apple-system,sans-serif;font-weight:700;font-size:17px;letter-spacing:-0.01em;color:#1C1A17;">BTM</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <tr><td style="background:#fff;border:1px solid #E3DCCE;border-radius:14px;padding:28px 30px 22px;box-shadow:0 18px 40px -20px rgba(28,26,23,0.08);">
        <div style="font-family:Menlo,Consolas,'SF Mono',monospace;font-size:10.5px;color:#5E7F4E;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:10px;">
          ${typeLabel} · Erledigt
        </div>

        <h1 style="font-family:'Archivo',-apple-system,sans-serif;font-size:22px;line-height:1.25;letter-spacing:-0.01em;font-weight:700;margin:0 0 14px;color:#1C1A17;">
          „${escapeHtml(opts.feedbackTitle)}" ${verbDe}.
        </h1>

        ${noteHtml}

        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td style="background:#1C1A17;border-radius:8px;">
              <a href="${opts.inboxUrl}" style="display:inline-block;padding:11px 22px;color:#FAF7F2;font-weight:600;font-size:14px;text-decoration:none;">
                Inbox öffnen →
              </a>
            </td>
          </tr>
        </table>
      </td></tr>

      <tr><td style="padding:18px 8px 0;text-align:center;">
        <div style="font-size:11px;color:#A8A097;line-height:1.55;">
          Du bekommst diese Mail weil du diesen ${typeLabel} eingereicht hast.<br/>
          <a href="${opts.unsubscribeUrl}" style="color:#6B6359;text-decoration:underline;">Benachrichtigungen verwalten</a> · ${APP_URL}
        </div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
  return { subject, text, html };
}

// ── Task-Reminder-Mail ─────────────────────────────────────────────────
// Wird zum eingestellten Zeitpunkt an den User geschickt.
export function reminderEmail(opts: {
  recipientName: string;
  taskTitle: string;
  taskUrl: string;
  remindAt: string; // formatierter Zeitpunkt "Do., 15.05.2026 09:00"
}): { subject: string; text: string; html: string } {
  const firstName = opts.recipientName.split(' ')[0];
  const subject = `Erinnerung: ${opts.taskTitle}`;
  const text = `Hi ${firstName},\n\ndies ist deine Erinnerung für:\n\n  ${opts.taskTitle}\n\nAufgabe öffnen:\n${opts.taskUrl}\n\n— BTM`;
  const html = `<!doctype html>
<html lang="de"><body style="margin:0;padding:0;background:#FAF7F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1C1A17;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF7F2;padding:40px 16px;">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
      <tr><td style="padding:0 0 24px;">
        <div style="font-size:22px;font-weight:700;color:#1C1A17;">⏰ Erinnerung</div>
        <div style="font-size:13px;color:#6B6359;margin-top:4px;">${opts.remindAt}</div>
      </td></tr>
      <tr><td style="background:#fff;border:1px solid #E8E3DC;border-radius:10px;padding:20px 24px;">
        <div style="font-size:12px;font-weight:600;color:#6B6359;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;">Aufgabe</div>
        <div style="font-size:16px;font-weight:600;color:#1C1A17;margin-bottom:20px;">${opts.taskTitle}</div>
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr><td style="background:#1C1A17;border-radius:8px;">
            <a href="${opts.taskUrl}" style="display:inline-block;padding:11px 22px;color:#FAF7F2;font-weight:600;font-size:14px;text-decoration:none;">Aufgabe öffnen →</a>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:18px 8px 0;text-align:center;">
        <div style="font-size:11px;color:#A8A097;">Du bekommst diese Mail weil du einen Reminder für diese Aufgabe gesetzt hast. · ${APP_URL}</div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
  return { subject, text, html };
}

// ── Daily-Digest-Mail ───────────────────────────────────────────────────
// Sammelt alles, was der User in den letzten 24h verpasst hat. Wird vom
// Scheduler (server/src/lib/digest.ts) gerufen.

export interface DigestPayload {
  recipientName: string;
  date: string; // formatiertes Datum für Header (z.B. "Sa., 09.05.2026")
  mentions: Array<{
    actorName: string;
    subjectType: 'task' | 'project';
    subjectTitle: string;
    excerpt: string;
    url: string;
  }>;
  dueToday: Array<{ id: string; title: string; url: string }>;
  dueThisWeek: Array<{ id: string; title: string; due: string; url: string }>;
  activityOnMyTasks: Array<{
    actorName: string;
    text: string; // bereits in Klartext gerenderte Activity
    url: string;
    when: string; // "vor 3 Std" o. ä.
  }>;
  appUrl: string;
  unsubscribeUrl: string;
}

export function digestEmail(p: DigestPayload): { subject: string; text: string; html: string } {
  const totalCount = p.mentions.length + p.dueToday.length + p.dueThisWeek.length + p.activityOnMyTasks.length;
  const subject =
    p.mentions.length > 0
      ? `BTM-Tagesübersicht · ${p.mentions.length} neue Erwähnung${p.mentions.length === 1 ? '' : 'en'}`
      : p.dueToday.length > 0
        ? `BTM-Tagesübersicht · ${p.dueToday.length} fällig heute`
        : `BTM-Tagesübersicht · ${p.date}`;

  // ── Plain text ─────────────────────────────────────────────────────
  const lines: string[] = [];
  const greeting = p.recipientName ? `Hi ${p.recipientName.split(' ')[0]},` : 'Hi,';
  lines.push(greeting, '', `deine BTM-Tagesübersicht für ${p.date}.`, '');

  if (p.mentions.length > 0) {
    lines.push(`📨 ERWÄHNUNGEN (${p.mentions.length})`);
    for (const m of p.mentions) {
      const kind = m.subjectType === 'task' ? 'Aufgabe' : 'Projekt';
      lines.push(`  · ${m.actorName} in „${m.subjectTitle}" (${kind})`);
      lines.push(`    ${m.excerpt}`);
      lines.push(`    → ${m.url}`);
    }
    lines.push('');
  }
  if (p.dueToday.length > 0) {
    lines.push(`⏰ HEUTE FÄLLIG (${p.dueToday.length})`);
    for (const t of p.dueToday) {
      lines.push(`  · ${t.title}`);
      lines.push(`    → ${t.url}`);
    }
    lines.push('');
  }
  if (p.dueThisWeek.length > 0) {
    lines.push(`📅 DIESE WOCHE FÄLLIG (${p.dueThisWeek.length})`);
    for (const t of p.dueThisWeek) {
      lines.push(`  · ${t.due} — ${t.title}`);
    }
    lines.push('');
  }
  if (p.activityOnMyTasks.length > 0) {
    lines.push(`🔔 AKTIVITÄT AUF DEINEN AUFGABEN (${p.activityOnMyTasks.length})`);
    for (const a of p.activityOnMyTasks) {
      lines.push(`  · ${a.actorName} ${a.text} (${a.when})`);
    }
    lines.push('');
  }
  if (totalCount === 0) {
    lines.push('Heute alles ruhig — nichts neues. Schöner Tag! ☀️');
    lines.push('');
  }
  lines.push(`Direkt zur App: ${p.appUrl}`);
  lines.push('');
  lines.push('— BTM');
  lines.push(`Digest abbestellen: ${p.unsubscribeUrl}`);
  const text = lines.join('\n');

  // ── HTML ───────────────────────────────────────────────────────────
  const sectionStyles =
    'background:#fff;border:1px solid #E3DCCE;border-radius:12px;padding:20px 24px;margin-bottom:14px;';
  const eyebrowStyles =
    'font-family:Menlo,Consolas,"SF Mono",monospace;font-size:10.5px;color:#C85A2C;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:10px;';
  const itemStyles = 'padding:10px 0;border-top:1px solid #ECE5D8;font-size:13.5px;line-height:1.55;color:#3D3833;';
  const linkStyles = 'color:#C85A2C;text-decoration:none;font-weight:500;';

  const mentionsBlock =
    p.mentions.length === 0
      ? ''
      : `
        <div style="${sectionStyles}">
          <div style="${eyebrowStyles}">📨 Erwähnungen (${p.mentions.length})</div>
          ${p.mentions
            .map(
              (m) => `
            <div style="${itemStyles}">
              <div><b>${escapeHtml(m.actorName)}</b> in <a href="${m.url}" style="${linkStyles}">${escapeHtml(m.subjectTitle)}</a></div>
              <div style="background:#F4EFE7;border-left:3px solid #C85A2C;padding:8px 12px;border-radius:4px;margin-top:6px;font-size:13px;">${escapeHtml(m.excerpt)}</div>
            </div>`,
            )
            .join('')}
        </div>`;

  const dueTodayBlock =
    p.dueToday.length === 0
      ? ''
      : `
        <div style="${sectionStyles}">
          <div style="${eyebrowStyles}">⏰ Heute fällig (${p.dueToday.length})</div>
          ${p.dueToday
            .map(
              (t) => `
            <div style="${itemStyles}"><a href="${t.url}" style="${linkStyles}">${escapeHtml(t.title)}</a></div>`,
            )
            .join('')}
        </div>`;

  const dueWeekBlock =
    p.dueThisWeek.length === 0
      ? ''
      : `
        <div style="${sectionStyles}">
          <div style="${eyebrowStyles}">📅 Diese Woche fällig (${p.dueThisWeek.length})</div>
          ${p.dueThisWeek
            .map(
              (t) => `
            <div style="${itemStyles}">
              <span style="font-family:Menlo,Consolas,'SF Mono',monospace;font-size:11.5px;color:#6B6359;margin-right:10px;">${escapeHtml(t.due)}</span>
              <a href="${t.url}" style="${linkStyles}">${escapeHtml(t.title)}</a>
            </div>`,
            )
            .join('')}
        </div>`;

  const activityBlock =
    p.activityOnMyTasks.length === 0
      ? ''
      : `
        <div style="${sectionStyles}">
          <div style="${eyebrowStyles}">🔔 Aktivität auf deinen Aufgaben (${p.activityOnMyTasks.length})</div>
          ${p.activityOnMyTasks
            .map(
              (a) => `
            <div style="${itemStyles}">
              <b>${escapeHtml(a.actorName)}</b> ${escapeHtml(a.text)}
              <span style="color:#A8A097;margin-left:6px;font-size:12px;">${escapeHtml(a.when)}</span>
            </div>`,
            )
            .join('')}
        </div>`;

  const emptyBlock =
    totalCount === 0
      ? `
        <div style="${sectionStyles}text-align:center;padding:34px 24px;">
          <div style="font-size:38px;margin-bottom:10px;">☀️</div>
          <div style="font-family:'Archivo',-apple-system,sans-serif;font-weight:700;font-size:18px;color:#1C1A17;margin-bottom:6px;">Heute alles ruhig.</div>
          <div style="font-size:13.5px;color:#6B6359;">Keine neuen Erwähnungen, keine fälligen Aufgaben. Schöner Tag!</div>
        </div>`
      : '';

  const html = `<!doctype html>
<html lang="de"><body style="margin:0;padding:0;background:#FAF7F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1C1A17;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF7F2;padding:36px 16px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

      <tr><td style="padding:0 0 22px;">
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding-right:12px;vertical-align:middle;">
              <img src="cid:${APP_ICON_CID}" width="40" height="40" alt="BTM" style="display:block;width:40px;height:40px;border-radius:9px;border:0;" />
            </td>
            <td style="vertical-align:middle;">
              <div style="font-family:'Archivo',-apple-system,sans-serif;font-weight:700;font-size:18px;letter-spacing:-0.01em;color:#1C1A17;">BTM Tagesübersicht</div>
              <div style="font-family:Menlo,Consolas,'SF Mono',monospace;font-size:10.5px;color:#6B6359;text-transform:uppercase;letter-spacing:0.08em;margin-top:2px;">${escapeHtml(p.date)}</div>
            </td>
          </tr>
        </table>
      </td></tr>

      ${mentionsBlock}
      ${dueTodayBlock}
      ${dueWeekBlock}
      ${activityBlock}
      ${emptyBlock}

      <tr><td style="padding:8px 0 0;text-align:center;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 18px;">
          <tr>
            <td style="background:#C85A2C;border-radius:8px;">
              <a href="${p.appUrl}" style="display:inline-block;padding:11px 24px;color:#FAF7F2;font-weight:600;font-size:14px;text-decoration:none;">
                BTM öffnen →
              </a>
            </td>
          </tr>
        </table>
        <div style="font-size:11px;color:#A8A097;line-height:1.55;">
          Du bekommst diesen Tagesdigest weil er in deinen Einstellungen aktiv ist.<br/>
          <a href="${p.unsubscribeUrl}" style="color:#6B6359;text-decoration:underline;">Digest abbestellen</a> · ${APP_URL}
        </div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
  return { subject, text, html };
}

// HTML-Escape für User-content. Verhindert XSS in Mail-Clients.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function inviteEmail(opts: {
  url: string;
  inviterName: string;
  role: 'admin' | 'member';
  inviteeName?: string | null;
}): { subject: string; text: string; html: string } {
  const greeting = opts.inviteeName ? `Hey ${opts.inviteeName.split(' ')[0]}` : 'Hey';
  const roleLabel = opts.role === 'admin' ? 'Admin' : 'Mitglied';
  const subject = `${opts.inviterName} hat dich zu BTM eingeladen`;

  const text = `${greeting},

${opts.inviterName} hat dich als ${roleLabel} bei BTM eingeladen — unserem internen Tool fürs Wochen- und Zeitmanagement.

Was BTM kann:
  · Wochenboard (Backlog → In Arbeit → Erledigt)
  · Live-Timer mit Pomodoro auf jeder Aufgabe
  · Team-Kapazität und Auslastung pro Person
  · Planungs-KI extrahiert Aufgaben aus E-Mails / Briefings
  · MCP-Anbindung für Claude Desktop

Login ist passwortlos: gib deine E-Mail ein, wir schicken dir einen Magic-Link.

Direkt loslegen:
${opts.url}

Der Link ist 7 Tage gültig.
Bei Fragen: einfach an ${opts.inviterName} zurück antworten.

— BTM
`;

  const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Du wurdest zu BTM eingeladen</title>
</head>
<body style="margin:0;padding:0;background:#FAF7F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1C1A17;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF7F2;padding:40px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

        <!-- Brand -->
        <tr>
          <td style="padding:0 0 24px;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding-right:12px;vertical-align:middle;">
                  <img src="cid:${APP_ICON_CID}" width="44" height="44" alt="BTM" style="display:block;width:44px;height:44px;border-radius:10px;border:0;" />
                </td>
                <td style="vertical-align:middle;">
                  <div style="font-family:'Archivo',-apple-system,sans-serif;font-weight:700;font-size:20px;letter-spacing:-0.01em;color:#1C1A17;">BTM</div>
                  <div style="font-family:Menlo,Consolas,'SF Mono',monospace;font-size:11px;color:#6B6359;text-transform:uppercase;letter-spacing:0.08em;margin-top:2px;">${APP_FULL_NAME}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Hero card -->
        <tr>
          <td style="background:#fff;border:1px solid #E3DCCE;border-radius:14px;padding:36px 36px 28px;box-shadow:0 18px 40px -20px rgba(28,26,23,0.08);">

            <div style="font-family:Menlo,Consolas,'SF Mono',monospace;font-size:11px;color:#C85A2C;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:14px;">
              Einladung zum Team
            </div>

            <h1 style="font-family:'Archivo',-apple-system,sans-serif;font-size:30px;line-height:1.15;letter-spacing:-0.015em;font-weight:700;margin:0 0 14px;color:#1C1A17;">
              ${greeting} —
              <span style="color:#C85A2C;font-style:italic;font-weight:600;">willkommen.</span>
            </h1>

            <p style="font-size:15.5px;line-height:1.6;color:#3D3833;margin:0 0 24px;">
              <b>${opts.inviterName}</b> hat dich als <b>${roleLabel}</b> bei <b>BTM</b> eingeladen — unserem internen
              Tool fürs Wochen- und Zeitmanagement.
            </p>

            <!-- CTA -->
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
              <tr>
                <td style="background:#C85A2C;border-radius:10px;">
                  <a href="${opts.url}"
                     style="display:inline-block;padding:14px 28px;color:#FAF7F2;font-weight:600;font-size:15px;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                    Einladung annehmen →
                  </a>
                </td>
              </tr>
            </table>

            <div style="font-family:Menlo,Consolas,'SF Mono',monospace;font-size:10.5px;color:#6B6359;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:32px;">
              Kein Passwort nötig · Magic-Link · 7 Tage gültig
            </div>

            <!-- Features -->
            <div style="border-top:1px solid #ECE5D8;padding-top:24px;">
              <div style="font-family:Menlo,Consolas,'SF Mono',monospace;font-size:11px;color:#6B6359;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:14px;">
                Was du in BTM machen kannst
              </div>

              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                ${[
                  ['Wochenboard', 'Backlog → In Arbeit → Erledigt. Drag & drop, klare Übersicht für deine fünf Tage.'],
                  ['Live-Timer + Pomodoro', '25/5-Rhythmus, automatische Wochensumme, kein doppeltes Eintragen.'],
                  ['Kapazität', 'Wer hat noch Luft, wer ist überlastet — Team-Auslastung mit Soll/Ist auf einen Blick.'],
                  ['Planungs-KI', 'Aus E-Mails und Briefings extrahiert die KI fertige Aufgaben mit Schätzung.'],
                  ['MCP für Claude', 'Aufgaben anlegen und planen aus Claude Desktop oder Web heraus.'],
                ]
                  .map(
                    ([title, desc]) => `
                <tr>
                  <td style="padding:8px 0;vertical-align:top;width:24px;">
                    <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#C85A2C;margin-top:8px;"></span>
                  </td>
                  <td style="padding:6px 0;vertical-align:top;">
                    <div style="font-weight:600;font-size:14px;color:#1C1A17;line-height:1.4;">${title}</div>
                    <div style="font-size:13px;color:#6B6359;line-height:1.5;margin-top:2px;">${desc}</div>
                  </td>
                </tr>`,
                  )
                  .join('')}
              </table>
            </div>

            <!-- Quick start -->
            <div style="background:#F4EFE7;border-radius:10px;padding:18px 20px;margin-top:28px;">
              <div style="font-family:Menlo,Consolas,'SF Mono',monospace;font-size:10.5px;color:#6B6359;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">
                So legst du los
              </div>
              <ol style="margin:0;padding-left:18px;font-size:13.5px;color:#3D3833;line-height:1.65;">
                <li>Auf den Knopf oben klicken — du landest direkt im Login</li>
                <li>Magic-Link aus der nächsten Mail bestätigen</li>
                <li>Erste Aufgaben anlegen oder ⌘K für die Planungs-KI</li>
              </ol>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 8px 0;text-align:center;">
            <div style="font-size:11.5px;color:#6B6359;line-height:1.5;">
              Du hast diese Mail bekommen, weil ${opts.inviterName} dich zu BTM eingeladen hat.<br/>
              Wenn das ein Versehen war, ignorier sie einfach.
            </div>
            <div style="margin-top:14px;font-family:Menlo,Consolas,'SF Mono',monospace;font-size:10px;color:#A8A097;text-transform:uppercase;letter-spacing:0.08em;">
              © ${APP_ORG_NAME} · ${APP_URL}
            </div>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>

</body>
</html>`;

  return { subject, text, html };
}
