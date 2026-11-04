import { query } from "@/lib/pg";
import { sendMail, smtpConfigured } from "@/lib/mail";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  const email = (body.email || "").trim();
  if (!email || !email.includes("@")) {
    return Response.json({ error: "A valid email is required." }, { status: 400 });
  }
  const name = (body.name || "Commercial Contractor").trim();
  const company = (body.company || "Commercial Roofing Contractor").trim();
  const territory = (body.territory || "Dallas–Fort Worth, TX").trim();
  const sizeRange = (body.sizeRange || "Commercial 25k+ sq ft").trim();
  const source = (body.source || "Landing Page").trim();

  // 1. Save to database if available
  try {
    await query(
      `insert into app.pilot_requests (name, company, email, territory, size_range, created_at) values ($1,$2,$3,$4,$5,$6)`,
      [name, company, email, territory, sizeRange, new Date().toISOString()],
    );
  } catch (dbErr) {
    console.warn("[pilot] DB insert warning:", dbErr);
  }

  // 2. Send notification to admin/pilot inbox
  const notifyTo = process.env.PILOT_NOTIFY_EMAIL || process.env.SMTP_USER;
  if (smtpConfigured() && notifyTo) {
    try {
      await sendMail({
        to: notifyTo,
        replyTo: email,
        fromName: "Depoii Pilot",
        subject: `[Pilot Lead] ${email} - ${territory}`,
        text: [
          "New Depoii Pilot / Lead Submission",
          "-----------------------------------",
          `Email: ${email}`,
          `Name: ${name}`,
          `Company: ${company}`,
          `Territory: ${territory}`,
          `Roof sizes: ${sizeRange}`,
          `Source: ${source}`,
          `Submitted at: ${new Date().toISOString()}`,
        ].join("\n"),
      });

      // 3. Send friendly confirmation to the user who submitted
      try {
        await sendMail({
          to: email,
          replyTo: notifyTo,
          fromName: "Depoii Team",
          subject: "Your Depoii Territory Access Request",
          text: [
            `Hello,`,
            ``,
            `Thank you for requesting territory access to Depoii for ${territory}.`,
            ``,
            `To protect contractor margins and lead exclusivity, Depoii caps active workspace access to a maximum of 2 commercial contractors per DFW territory.`,
            ``,
            `Our team has received your request and is checking availability for your bidding area. We will follow up with you shortly.`,
            ``,
            `Best regards,`,
            `The Depoii Team`,
            `https://depoii.com`,
          ].join("\n"),
        });
      } catch (userMailErr) {
        console.warn("[pilot] User confirmation email failed:", userMailErr);
      }
    } catch (err) {
      console.error("[pilot] Admin email notification failed:", err);
    }
  } else {
    console.warn("[pilot] SMTP not configured; request saved without email notification.");
  }

  return Response.json({ ok: true });
}
