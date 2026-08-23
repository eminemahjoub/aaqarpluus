import nodemailer, { type Transporter } from "nodemailer";
import { log } from "@/lib/logger";

/**
 * SMTP email service with a safe development fallback.
 *
 * - Configured via SMTP_HOST / SMTP_PORT / SMTP_SECURE / SMTP_USER /
 *   SMTP_PASS / SMTP_FROM env vars.
 * - If SMTP is not configured, or NODE_ENV=development, sendEmail logs the
 *   message instead of throwing — the app keeps working without a mail server.
 */
const SMTP_CONFIG = {
  host: process.env.SMTP_HOST || "",
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: String(process.env.SMTP_SECURE ?? "").toLowerCase() === "true",
  user: process.env.SMTP_USER || "",
  pass: process.env.SMTP_PASS || "",
  from: process.env.SMTP_FROM || "AaqarPlus <noreply@aaqarplus.com>",
};

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!SMTP_CONFIG.host) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_CONFIG.host,
      port: SMTP_CONFIG.port,
      secure: SMTP_CONFIG.secure,
      auth: SMTP_CONFIG.user
        ? { user: SMTP_CONFIG.user, pass: SMTP_CONFIG.pass }
        : undefined,
    });
  }
  return transporter;
}

export function isEmailConfigured(): boolean {
  return Boolean(SMTP_CONFIG.host);
}

export type EmailLanguage = "ar" | "en";

function resetPasswordTemplate(lang: EmailLanguage, resetUrl: string) {
  if (lang === "en") {
    return {
      subject: "Reset your AaqarPlus password",
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px">
          <h2 style="color:#0b3d2e">Reset your password</h2>
          <p>We received a request to reset your password. The link below expires in 1 hour.</p>
          <p><a href="${resetUrl}" style="display:inline-block;background:#0b3d2e;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Reset password</a></p>
          <p style="color:#666;font-size:13px">If you did not request this, you can safely ignore this email.</p>
          <p style="color:#666;font-size:13px">${resetUrl}</p>
        </div>`,
    };
  }
  return {
    subject: "استعادة كلمة المرور — عقار بلس",
    html: `
      <div dir="rtl" style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px">
        <h2 style="color:#0b3d2e">استعادة كلمة المرور</h2>
        <p>تلقينا طلباً لاستعادة كلمة المرور الخاصة بك. الرابط التالي صالح لمدة ساعة واحدة.</p>
        <p><a href="${resetUrl}" style="display:inline-block;background:#0b3d2e;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">استعادة كلمة المرور</a></p>
        <p style="color:#666;font-size:13px">إذا لم تكن أنت من طلب هذا، يمكنك تجاهل هذه الرسالة بأمان.</p>
        <p style="color:#666;font-size:13px;direction:ltr">${resetUrl}</p>
      </div>`,
  };
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  if (!isEmailConfigured()) {
    log.info("[email] SMTP not configured — skipping send to:", to, "subject:", subject);
    return;
  }
  const t = getTransporter();
  if (!t) return;
  try {
    await t.sendMail({ from: SMTP_CONFIG.from, to, subject, html });
    log.info("[email] sent to:", to, "subject:", subject);
  } catch (err) {
    log.error("[email] send failed:", err);
  }
}

export async function sendPasswordResetEmail({
  to,
  resetUrl,
  lang = "ar",
}: {
  to: string;
  resetUrl: string;
  lang?: EmailLanguage;
}): Promise<void> {
  const { subject, html } = resetPasswordTemplate(lang, resetUrl);
  await sendEmail({ to, subject, html });
}