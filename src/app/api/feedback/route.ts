import { sendMail, smtpConfigured } from "@/lib/mail";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, string>;
    const rating = (body.rating || "Not specified").trim();
    const category = (body.category || "General").trim();
    const message = (body.message || "").trim();
    const email = (body.email || "anonymous@depoii.com").trim();

    if (!message) {
      return Response.json({ error: "Feedback message cannot be empty." }, { status: 400 });
    }

    console.log(`[feedback] Received (${category} / ${rating}) from ${email}:`, message);

    const recipient = "mirzamailbox0@gmail.com";
    if (smtpConfigured()) {
      try {
        await sendMail({
          to: recipient,
          replyTo: email.includes("@") ? email : undefined,
          fromName: "Depoii Feedback",
          subject: `[Depoii Feedback] ${category} - ${rating} from ${email}`,
          text: [
            "New Depoii User Feedback",
            "===========================================",
            `Rating:    ${rating}`,
            `Category:  ${category}`,
            `From:      ${email}`,
            `Date:      ${new Date().toLocaleString("en-US", { timeZone: "America/Chicago" })} CT`,
            "",
            "Message:",
            "-------------------------------------------",
            message,
            "===========================================",
          ].join("\n"),
        });
      } catch (mailErr) {
        console.error("[feedback] sendMail failed", mailErr);
      }
    } else {
      console.warn(`[feedback] SMTP not configured; feedback logged for ${recipient}:`, { rating, category, email, message });
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[feedback] Error handling feedback", err);
    return Response.json({ error: "Failed to submit feedback" }, { status: 500 });
  }
}
