import { requireUser } from "@/lib/auth";
import { sendTestNotificationEmail } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await requireUser();
    const result = await sendTestNotificationEmail({ email: user.email, name: user.name });
    if ("error" in result) {
      return Response.json({ error: result.error }, { status: 400 });
    }
    return Response.json({ ok: true, message: `Test notification sent to ${user.email}` });
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 401) return Response.json({ error: "Sign in required." }, { status: 401 });
    return Response.json({ error: "Could not send test notification." }, { status: 400 });
  }
}
