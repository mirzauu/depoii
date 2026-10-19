import { cookieName } from "@/lib/auth";

export const dynamic = "force-dynamic";

export function POST() {
  const res = Response.json({ ok: true });
  res.headers.append("Set-Cookie", `${cookieName()}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  return res;
}
