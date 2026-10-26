import { sendMail, smtpConfigured } from "@/lib/mail";
import { getSessionUser } from "@/lib/auth";

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

    const sessionUser = await getSessionUser();
    const orgName = sessionUser?.orgName || body.orgName || "No Organization";
    const orgId = sessionUser?.orgId || body.orgId || "N/A";
    const userName = sessionUser?.name || body.userName || "Anonymous User";
    const userEmail = sessionUser?.email || body.userEmail || email;
    const userRole = sessionUser?.role || body.userRole || "User";
    const platformRole = sessionUser?.platformRole || body.platformRole || "user";

    console.log(`[feedback] Received (${category} / ${rating}) from ${userName} (${orgName}):`, message);

    const recipient = "mirzamailbox0@gmail.com";
    if (smtpConfigured()) {
      try {
        await sendMail({
          to: recipient,
          replyTo: userEmail.includes("@") ? userEmail : undefined,
          fromName: "Depoii Feedback",
          subject: `[Depoii Feedback] ${orgName} - ${userName} (${category} / ${rating})`,
          text: [
            "New Depoii User Feedback",
            "===========================================",
            "ORGANIZATION & USER DETAILS",
            "-------------------------------------------",
            `Organization:    ${orgName} (ID: ${orgId})`,
            `User Name:       ${userName}`,
            `Account Email:   ${userEmail}`,
            `Role / Platform: ${userRole} / ${platformRole}`,
            `Entered Email:   ${email}`,
            `Submitted At:    ${new Date().toLocaleString("en-US", { timeZone: "America/Chicago" })} CT`,
            "",
            "FEEDBACK DETAILS",
            "-------------------------------------------",
            `Rating:          ${rating}`,
            `Category:        ${category}`,
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
      console.warn(`[feedback] SMTP not configured; feedback logged for ${recipient}:`, {
        orgName,
        orgId,
        userName,
        userEmail,
        rating,
        category,
        message,
      });
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[feedback] Error handling feedback", err);
    return Response.json({ error: "Failed to submit feedback" }, { status: 500 });
  }
}
