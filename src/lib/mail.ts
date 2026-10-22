import nodemailer from "nodemailer";

export function smtpConfigured() {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function sendMail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  fromName?: string;
}) {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  if (!smtpUser || !smtpPass) {
    throw new Error("Email is not configured. Set SMTP_USER and SMTP_PASS.");
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.hostinger.com",
    port: Number(process.env.SMTP_PORT || 465),
    secure: true,
    auth: { user: smtpUser, pass: smtpPass },
  });

  await transporter.sendMail({
    from: `"${input.fromName || "Depoii"}" <${smtpUser}>`,
    to: input.to,
    replyTo: input.replyTo,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
}

export async function sendClaimDeadlineWarningMail(input: {
  to: string;
  propertyAddress: string;
  hoursRemaining: number;
  appUrl?: string;
}) {
  if (!smtpConfigured()) return;
  const url = input.appUrl || process.env.NEXT_PUBLIC_APP_URL || "https://depoii.com";
  const subject = `⚠️ Action Required: 48 hours to log contact for ${input.propertyAddress}`;
  const text = `Your exclusive claim on ${input.propertyAddress} will auto-release in approximately ${input.hoursRemaining} hours due to inactivity.\n\nLog any contact (call, email, or site visit) with one click at: ${url}/claims to reset your 7-day clock.`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px;">
      <h2 style="color: #d97706; margin-top: 0;">⚠️ Activity Needed on Exclusive Claim</h2>
      <p style="font-size: 15px; color: #374151; line-height: 1.5;">
        Your exclusive territory lock on <strong>${input.propertyAddress}</strong> is approaching its 7-day activity deadline.
      </p>
      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 0; font-size: 14px; color: #92400e;">
          <strong>Time remaining:</strong> ~${input.hoursRemaining} hours before property returns to the territory pool.
        </p>
      </div>
      <p style="font-size: 14px; color: #4b5563;">
        To keep your claim locked exclusively for your team, simply record any outreach (call, email, or site inspection) using the one-click buttons on your claims dashboard.
      </p>
      <div style="margin: 24px 0;">
        <a href="${url}/claims" style="background-color: #0f172a; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">
          Open Claims Dashboard & Log Activity
        </a>
      </div>
      <p style="font-size: 12px; color: #9ca3af; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
        Depoii Territory & Claim Protection Engine
      </p>
    </div>
  `;

  await sendMail({
    to: input.to,
    subject,
    text,
    html,
  });
}

export async function sendClaimExpiredMail(input: {
  to: string;
  propertyAddress: string;
  reason: string;
  appUrl?: string;
}) {
  if (!smtpConfigured()) return;
  const url = input.appUrl || process.env.NEXT_PUBLIC_APP_URL || "https://depoii.com";
  const subject = `Claim Released: ${input.propertyAddress} has returned to the territory pool`;
  const text = `Your claim on ${input.propertyAddress} was released (${input.reason}). You can browse available properties at: ${url}/territory`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px;">
      <h2 style="color: #4b5563; margin-top: 0;">Claim Released Back to Territory Pool</h2>
      <p style="font-size: 15px; color: #374151; line-height: 1.5;">
        Your exclusive lock on <strong>${input.propertyAddress}</strong> has ended due to <em>${input.reason}</em>.
      </p>
      <div style="margin: 24px 0;">
        <a href="${url}/territory" style="background-color: #0f172a; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">
          Browse Available Properties
        </a>
      </div>
      <p style="font-size: 12px; color: #9ca3af; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
        Depoii Territory & Claim Protection Engine
      </p>
    </div>
  `;

  await sendMail({
    to: input.to,
    subject,
    text,
    html,
  });
}

