import { cookieMaxAge, cookieName, requestLoginOtp, sessionToken, verifyLoginOtp } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json()) as { email?: string; code?: string };
  const email = body.email || "";
  const code = (body.code || "").trim();

  if (!code) {
    const result = await requestLoginOtp(email);
    if ("error" in result) {
      const status = result.error.includes("not configured") ? 503 : 400;
      return Response.json({ error: result.error }, { status });
    }
    return Response.json({ ok: true, step: "otp" });
  }

  const result = await verifyLoginOtp(email, code);
  if ("error" in result) {
    const status = result.error.includes("incorrect") || result.error.includes("expired") || result.error.includes("attempts")
      ? 401
      : 400;
    return Response.json({ error: result.error }, { status });
  }

  const user = result.user;
  const res = Response.json({ email: user.email, name: user.name, orgName: user.orgName, platformRole: user.platformRole });
  res.headers.append(
    "Set-Cookie",
    `${cookieName()}=${sessionToken(user)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${cookieMaxAge()}`,
  );
  return res;
}
