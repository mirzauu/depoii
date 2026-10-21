import { cookieMaxAge, cookieName, sessionToken, signUp } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json()) as { name?: string; organization?: string; email?: string; password?: string; invite?: string };
  const result = await signUp(body);
  if ("error" in result) {
    const status = result.error === "A user with that email already exists." ? 409 : result.error.startsWith("Signup is closed") ? 403 : 400;
    return Response.json({ error: result.error }, { status });
  }
  const user = result.user;
  const res = Response.json({ email: user.email, name: user.name, orgName: user.orgName, platformRole: user.platformRole });
  res.headers.append("Set-Cookie", `${cookieName()}=${sessionToken(user)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${cookieMaxAge()}`);
  return res;
}
