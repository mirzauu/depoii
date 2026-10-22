import { cookieMaxAge, cookieName, redeemLoginLink, sessionToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const result = await redeemLoginLink(url.searchParams.get("token") || "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  const proto = req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "") || "http";

  // Redirect to home URL ("/") instead of login/signup page
  const dest = new URL("/", `${proto}://${host}`);
  const headers = new Headers({ Location: dest.toString() });

  if (!("error" in result)) {
    headers.append(
      "Set-Cookie",
      `${cookieName()}=${sessionToken(result.user)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${cookieMaxAge()}`,
    );
  }

  return new Response(null, { status: 303, headers });
}
