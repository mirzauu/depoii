import { sendMail, smtpConfigured } from "@/lib/mail";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, string>;
    const category = (body.category || "General").trim();
    const message = (body.message || "").trim();
    const email = (body.email || "anonymous@depoii.com").trim();

    if (!message) {
      return Response.json({ error: "Feedback message cannot be empty." }, { status: 400 });
    }

    console.log(`[feedback] Received (${category}) from ${email}:`, message);

    const notifyTo = process.env.PILOT_NOTIFY_EMAIL || process.env.SMTP_USER;
    if (smtpConfigured() && notifyTo) {
      try {
        await sendMail({
          to: notifyTo,
          replyTo: email.includes("@") ? email : undefined,
          fromName: "Depoii Feedback",
          subject: `[Depoii Feedback] ${category}: ${message.slice(0, 50)}...`,
          text: [
            `Category: ${category}`,
            `From: ${email}`,
            `Submitted At: ${new Date().toISOString()}`,
            "",
            "Message:",
            message,
          ].join("\n"),
        });
      } catch (mailErr) {
        console.error("[feedback] sendMail failed", mailErr);
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[feedback] Error handling feedback", err);
    return Response.json({ error: "Failed to submit feedback" }, { status: 500 });
  }
}
