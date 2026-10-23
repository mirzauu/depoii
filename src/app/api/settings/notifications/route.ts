import { requireUser } from "@/lib/auth";
import { getUserNotificationSettings, updateUserNotificationSettings, type UserNotificationSettings } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    const settings = await getUserNotificationSettings(user.id, user.orgId);
    return Response.json({ settings });
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 401) return Response.json({ error: "Sign in required." }, { status: 401 });
    return Response.json({ error: "Could not load notification settings." }, { status: 400 });
  }
}

export async function PUT(req: Request) {
  try {
    const user = await requireUser();
    const body = (await req.json()) as Partial<UserNotificationSettings>;
    const settings = await updateUserNotificationSettings(user.id, user.orgId, body);
    return Response.json({ ok: true, settings });
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 401) return Response.json({ error: "Sign in required." }, { status: 401 });
    return Response.json({ error: "Could not save notification settings." }, { status: 400 });
  }
}
