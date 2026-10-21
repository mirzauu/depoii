import { query } from "@/lib/pg";
import { sendMail, smtpConfigured } from "@/lib/mail";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  const name = (body.name || "").trim();
  const company = (body.company || "").trim();
  const email = (body.email || "").trim();
  const territory = (body.territory || "").trim();
  const sizeRange = (body.sizeRange || "").trim();
  if (!name || !company || !email.includes("@") || !territory || !sizeRange) {
    return Response.json({ error: "Name, company, email, territory, and size range are required." }, { status: 400 });
  }
  await query(
    `insert into app.pilot_requests (name, company, email, territory, size_range, created_at) values ($1,$2,$3,$4,$5,$6)`,
    [name, company, email, territory, sizeRange, new Date().toISOString()],
  );

  const notifyTo = process.env.PILOT_NOTIFY_EMAIL || process.env.SMTP_USER;
  if (smtpConfigured() && notifyTo) {
    try {
      await sendMail({
        to: notifyTo,
        replyTo: email,
        fromName: "Depoii Pilot",
        subject: `Pilot request: ${name} (${company})`,
        text: [
          "New Depoii pilot request",
          "",
          `Name: ${name}`,
          `Company: ${company}`,
          `Email: ${email}`,
          `Territory: ${territory}`,
          `Roof sizes: ${sizeRange}`,
        ].join("\n"),
      });
    } catch (err) {
      console.error("[pilot] email send failed", err);
      // Request is already saved; do not fail the form for mail issues.
    }
  } else {
    console.warn("[pilot] SMTP not configured; request saved without email.");
  }

  return Response.json({ ok: true });
}
