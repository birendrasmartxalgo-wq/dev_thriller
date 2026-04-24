// Generic SMTP transport via nodemailer. Works with any SMTP provider: Amazon SES,
// Postmark, Mailgun, Brevo, Mailtrap, self-hosted Postfix, etc.
//
// If SMTP is not configured, all senders become no-ops that log a warning — so the
// app runs fine in dev without mail.

import nodemailer, { type Transporter } from "nodemailer";
import { env, smtpConfigured } from "@/config/env";
import { logger } from "@/lib/logger";

let transporter: Transporter | null = null;

function tx(): Transporter | null {
  if (!smtpConfigured) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE, // true = TLS on 465; false = STARTTLS on 587
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
    transporter.verify().then(
      () => logger.info("smtp connection verified"),
      (err) => logger.warn({ err }, "smtp verify failed; messages will attempt send anyway")
    );
  }
  return transporter;
}

interface BaseSend {
  to: string;
  subject: string;
  text: string;
  html: string;
}

async function send({ to, subject, text, html }: BaseSend): Promise<void> {
  const t = tx();
  if (!t) {
    logger.warn({ to, subject }, "smtp not configured; email skipped (no-op)");
    return;
  }
  try {
    await t.sendMail({ from: env.SMTP_FROM, to, subject, text, html });
    logger.info({ to, subject }, "email sent");
  } catch (err) {
    logger.error({ err, to, subject }, "email send failed");
  }
}

// ---------- templates (intentionally minimal — design-system palette inline)

function wrap(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="background:#FAF6EC;margin:0;padding:24px;font-family:Inter,system-ui,Arial,sans-serif;color:#1B1808">
  <div style="max-width:540px;margin:0 auto;background:#FFFDF8;border:1px solid #E3D9C0;border-radius:12px;padding:32px">
    <div style="font:700 13px/1 Inter,sans-serif;letter-spacing:.02em;color:#C8361A;margin-bottom:6px">DEV THRILLER</div>
    <h1 style="font:700 22px/1.25 Inter,sans-serif;margin:0 0 16px 0;letter-spacing:-.01em">${title}</h1>
    ${bodyHtml}
    <hr style="margin:28px 0;border:0;border-top:1px solid #E3D9C0"/>
    <p style="font:400 11px/1.4 'JetBrains Mono',monospace;color:#8F8467">Sent by Dev Thriller. If this wasn't you, reply to this email.</p>
  </div></body></html>`;
}

export async function sendInviteEmail(opts: { to: string; workspaceName: string; inviteUrl: string; inviterName: string }) {
  const subject = `You're invited to ${opts.workspaceName} on Dev Thriller`;
  const text = `${opts.inviterName} invited you to join the workspace "${opts.workspaceName}" on Dev Thriller.\n\nAccept the invite:\n${opts.inviteUrl}\n\nThis link expires in 14 days.`;
  const html = wrap(
    `You're invited.`,
    `<p style="font:400 14px/1.5 Inter,sans-serif;color:#35301F">
      <strong>${opts.inviterName}</strong> invited you to join the workspace
      <strong>${opts.workspaceName}</strong>.
    </p>
    <p style="margin:24px 0"><a href="${opts.inviteUrl}" style="display:inline-block;background:#FF512E;color:#FFFDF8;padding:10px 18px;border-radius:8px;font:600 13px/1 Inter,sans-serif;text-decoration:none">Accept invite</a></p>
    <p style="font:400 12px/1.4 'JetBrains Mono',monospace;color:#8F8467;word-break:break-all">${opts.inviteUrl}</p>
    <p style="font:400 12px/1.4 Inter,sans-serif;color:#595243">This link expires in 14 days.</p>`
  );
  await send({ to: opts.to, subject, text, html });
}

export async function sendPasswordResetEmail(opts: { to: string; name: string; resetUrl: string }) {
  const subject = `Reset your Dev Thriller password`;
  const text = `Hi ${opts.name},\n\nUse this link to reset your password:\n${opts.resetUrl}\n\nIt expires in 1 hour. If you didn't request it, ignore this email.`;
  const html = wrap(
    `Password reset.`,
    `<p style="font:400 14px/1.5 Inter,sans-serif;color:#35301F">Hi ${opts.name},</p>
     <p style="font:400 14px/1.5 Inter,sans-serif;color:#35301F">Use the link below to set a new password. It expires in one hour.</p>
     <p style="margin:24px 0"><a href="${opts.resetUrl}" style="display:inline-block;background:#FF512E;color:#FFFDF8;padding:10px 18px;border-radius:8px;font:600 13px/1 Inter,sans-serif;text-decoration:none">Reset password</a></p>
     <p style="font:400 12px/1.4 'JetBrains Mono',monospace;color:#8F8467;word-break:break-all">${opts.resetUrl}</p>`
  );
  await send({ to: opts.to, subject, text, html });
}

export async function sendPasswordChangedEmail(opts: { to: string; name: string; ip: string }) {
  const subject = `Your Dev Thriller password was changed`;
  const text = `Hi ${opts.name},\n\nYour password was just changed from IP ${opts.ip}.\nIf this wasn't you, contact your workspace admin immediately.`;
  const html = wrap(
    `Password changed.`,
    `<p style="font:400 14px/1.5 Inter,sans-serif;color:#35301F">Hi ${opts.name},</p>
     <p style="font:400 14px/1.5 Inter,sans-serif;color:#35301F">Your password was just changed from IP <code>${opts.ip}</code>.</p>
     <p style="font:400 14px/1.5 Inter,sans-serif;color:#35301F">If this wasn't you, contact your workspace admin immediately.</p>`
  );
  await send({ to: opts.to, subject, text, html });
}

export async function sendDigestEmail(opts: { to: string; name: string; workspaceName: string; items: { title: string; snippet: string; url: string }[] }) {
  if (opts.items.length === 0) return;
  const subject = `Dev Thriller digest · ${opts.items.length} item${opts.items.length === 1 ? "" : "s"} in ${opts.workspaceName}`;
  const text = `${opts.name}, here's what you missed in ${opts.workspaceName}:\n\n${opts.items
    .map((i) => `• ${i.title}\n  ${i.snippet}\n  ${i.url}`)
    .join("\n\n")}`;
  const itemsHtml = opts.items
    .map(
      (i) => `<div style="padding:12px 0;border-top:1px solid #E3D9C0">
        <a href="${i.url}" style="font:600 14px/1.3 Inter,sans-serif;color:#C8361A;text-decoration:none">${i.title}</a>
        <div style="font:400 13px/1.5 Inter,sans-serif;color:#595243;margin-top:4px">${i.snippet}</div>
      </div>`
    )
    .join("");
  const html = wrap(
    `Your daily digest.`,
    `<p style="font:400 14px/1.5 Inter,sans-serif;color:#35301F">Hi ${opts.name}, here's what you missed in <strong>${opts.workspaceName}</strong>:</p>${itemsHtml}`
  );
  await send({ to: opts.to, subject, text, html });
}

// Expose the raw `send` for tests only.
export const __internal = { send };
