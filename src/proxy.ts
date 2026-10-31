import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { readSessionToken } from "@/lib/auth";

/** Netlify (and any host with this flag) serves only the public landing + pilot API. */
function isLandingOnly() {
  return process.env.DEPOII_LANDING_ONLY === "1" || process.env.DEPOII_LANDING_ONLY === "true";
}

function isPublicAsset(pathname: string) {
  return (
    pathname === "/icon.svg" ||
    pathname === "/apple-icon" ||
    pathname.startsWith("/manifest") ||
    pathname.startsWith("/landing/") ||
    pathname.startsWith("/api/aerial") ||
    pathname.startsWith("/api/timeline-aerial") ||
      pathname.startsWith("/api/parcel-boundary") ||
    pathname.startsWith("/aerial_cache") ||
    pathname.startsWith("/cesium")
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isLandingOnly()) {
    if (pathname.startsWith("/api/pilot")) {
      return NextResponse.next();
    }
    if (isPublicAsset(pathname)) {
      return NextResponse.next();
    }
    // Public marketing surface — rewrite app entry URLs to the welcome landing
    if (pathname === "/" || pathname.startsWith("/login") || pathname.startsWith("/welcome")) {
      if (pathname.startsWith("/welcome")) {
        return NextResponse.next();
      }
      const url = request.nextUrl.clone();
      url.pathname = "/welcome";
      return NextResponse.rewrite(url);
    }
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Not available." }, { status: 404 });
    }
    // Block dashboard and every other app route
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (
    isPublicAsset(pathname) ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/welcome") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/pilot") ||
    pathname.startsWith("/api/feedback") ||
    pathname === "/api/engine/health"
  ) {
    return NextResponse.next();
  }
  const session = await readSessionToken(request.cookies.get("depoii_session")?.value);
  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }
    if (pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/welcome";
      return NextResponse.rewrite(url);
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
