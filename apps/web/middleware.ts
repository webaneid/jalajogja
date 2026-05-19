import { NextRequest, NextResponse } from "next/server";
import { isOwnHost } from "@/lib/is-own-host";

// Platform: semua /platform/* kecuali /platform/login
const PLATFORM_PUBLIC    = /^\/platform\/login$/;
const PLATFORM_PROTECTED = /^\/platform(\/|$)/;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") ?? "";

  // ── Custom domain routing ──────────────────────────────────────────────────
  // Jika request datang dari domain selain jalakarta.com → resolve ke tenant slug.
  // Hanya berlaku untuk public routes — admin routes (/app/) tetap di jalakarta.com.
  if (!isOwnHost(host) && !pathname.startsWith("/api/") && !pathname.startsWith("/app/")) {
    try {
      const internalUrl =
        process.env.APP_INTERNAL_URL ??
        process.env.NEXT_PUBLIC_APP_URL ??
        "http://localhost:3000";
      const resolveUrl = new URL("/api/internal/resolve-domain", internalUrl);
      resolveUrl.searchParams.set("domain", host.split(":")[0]); // strip port jika ada

      const res = await fetch(resolveUrl.toString(), {
        cache: "no-store",
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const { slug } = (await res.json()) as { slug: string | null };
        if (slug) {
          // C1: Jika path sudah include slug → strip slug → redirect 301 ke clean URL
          if (pathname.startsWith(`/${slug}/`) || pathname === `/${slug}`) {
            const cleanPath = pathname === `/${slug}` ? "/" : pathname.slice(`/${slug}`.length);
            const cleanUrl = request.nextUrl.clone();
            cleanUrl.pathname = cleanPath;
            return NextResponse.redirect(cleanUrl, 301);
          }
          // Rewrite: ikpmjogja.com/post/artikel → /pc-ikpm-jogjakarta/post/artikel (internal)
          const url = request.nextUrl.clone();
          url.pathname = `/${slug}${pathname === "/" ? "" : pathname}`;
          return NextResponse.rewrite(url);
        }
      }
    } catch {
      // Gagal resolve → lanjut normal
    }
  }

  // ── Platform auth guard ────────────────────────────────────────────────────
  if (PLATFORM_PROTECTED.test(pathname) && !PLATFORM_PUBLIC.test(pathname)) {
    const platformToken = request.cookies.get("platform_session")?.value;
    if (!platformToken) {
      return NextResponse.redirect(new URL("/platform/login", request.url));
    }
    return NextResponse.next();
  }

  // ── Admin dashboard auth guard ─────────────────────────────────────────────
  // Semua /app/* kecuali /app/login memerlukan sesi login
  const sessionCookie =
    request.cookies.get("better-auth.session_token") ??
    request.cookies.get("__Secure-better-auth.session_token");

  const isLoggedIn = !!sessionCookie;

  if (pathname.startsWith("/app/") && pathname !== "/app/login" && !isLoggedIn) {
    const loginUrl = new URL("/app/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/app/login" && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard-redirect", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/auth|dashboard-redirect).*)",
  ],
};
