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

export interface MailOpts {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendMail({ to, subject, text, html }: MailOpts): Promise<void> {
  try {
    const t = getTransport();
    const info = await t.sendMail({ from, to, subject, text, html });
    console.log(`[mail] sent to=${to} subject="${subject}" id=${info.messageId}`);
  } catch (err) {
    console.warn(`[mail] FAILED to=${to} subject="${subject}":`, err);
    console.warn(`[mail] FALLBACK content:\n--- ${subject} ---\n${text}\n---`);
  }
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
}): { subject: string; text: string; html: string } {
  const subject = `${opts.inviterName} hat dich zu BTM eingeladen`;
  const text = `Hi,

${opts.inviterName} hat dich als ${opts.role === 'admin' ? 'Admin' : 'Mitglied'} bei BTM (Bethesna Task Management) eingeladen.

Einladung annehmen: ${opts.url}

Der Link ist 7 Tage gültig.
`;
  const html = `<!doctype html>
<html lang="de"><body style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;background:#FAF7F2;color:#1C1A17;padding:32px;">
  <div style="max-width:480px;margin:auto;background:#fff;border:1px solid #E3DCCE;border-radius:12px;padding:28px;">
    <div style="font-family:'Archivo',-apple-system,sans-serif;font-weight:700;font-size:20px;margin-bottom:16px;">Du wurdest zu BTM eingeladen</div>
    <p style="font-size:15px;line-height:1.55;margin:0 0 20px;"><b>${opts.inviterName}</b> hat dich als <b>${
      opts.role === 'admin' ? 'Admin' : 'Mitglied'
    }</b> eingeladen.</p>
    <a href="${opts.url}" style="display:inline-block;background:#C85A2C;color:#FAF7F2;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:14px;">Einladung annehmen</a>
    <p style="font-size:12px;color:#6B6359;margin:24px 0 0;line-height:1.55;">Link ist 7 Tage gültig.</p>
  </div>
</body></html>`;
  return { subject, text, html };
}
