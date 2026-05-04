import nodemailer from 'nodemailer';

const host = process.env.SMTP_HOST;
const port = Number(process.env.SMTP_PORT ?? 465);
const secure = (process.env.SMTP_SECURE ?? 'true') === 'true';
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
const from = process.env.SMTP_FROM ?? user ?? 'noreply@localhost';

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
  const candidates = [
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

export function magicLinkEmail(opts: { url: string; email: string }): { subject: string; text: string; html: string } {
  const subject = 'Dein Login-Link für BTM';
  const text = `Hi,

du hast einen Login für BTM angefordert. Öffne diesen Link, um dich einzuloggen:

${opts.url}

Der Link ist 15 Minuten gültig. Wenn du das nicht warst, ignoriere diese Mail.

— BTM (Bethesna Task Management)
`;
  const html = `<!doctype html>
<html lang="de"><body style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;background:#FAF7F2;color:#1C1A17;padding:32px;">
  <div style="max-width:480px;margin:auto;background:#fff;border:1px solid #E3DCCE;border-radius:12px;padding:28px;">
    <div style="font-family:'Archivo',-apple-system,sans-serif;font-weight:700;font-size:20px;letter-spacing:-0.01em;margin-bottom:16px;">BTM Login</div>
    <p style="font-size:15px;line-height:1.55;margin:0 0 20px;">Klick auf den Knopf, um dich einzuloggen:</p>
    <a href="${opts.url}" style="display:inline-block;background:#C85A2C;color:#FAF7F2;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:14px;">Bei BTM einloggen</a>
    <p style="font-size:12px;color:#6B6359;margin:24px 0 0;line-height:1.55;">Link ist 15 Minuten gültig. Wenn du das nicht warst: einfach ignorieren.</p>
  </div>
</body></html>`;
  return { subject, text, html };
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
                  <div style="font-family:Menlo,Consolas,'SF Mono',monospace;font-size:11px;color:#6B6359;text-transform:uppercase;letter-spacing:0.08em;margin-top:2px;">Bethesna Task Management</div>
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
              © Bethesna Group · btm.bethesna.org
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
