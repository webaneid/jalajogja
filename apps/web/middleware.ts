import { NextRequest, NextResponse } from "next/server";

// Route yang butuh autentikasi — slug valid diikuti salah satu module path
const PROTECTED_PATTERN = /^\/[a-z0-9-]+\/(dashboard|members|letters|finance|shop|settings)/;

// Route yang tidak boleh diakses kalau sudah login (auth pages)
const AUTH_PAGES = ["/login"];

// Platform: semua /platform/* kecuali /platform/login
const PLATFORM_PUBLIC = /^\/platform\/login$/;
const PLATFORM_PROTECTED = /^\/platform(\/|$)/;

// Host-host milik jalakarta — tidak perlu custom domain routing
function isOwnHost(host: string): boolean {
  return (
    host === "jalakarta.com" ||
    host === "www.jalakarta.com" ||
    host === "app.jalakarta.com" ||
    host.endsWith(".jalakarta.com") ||
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1")
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") ?? "";

  // ── Custom domain routing ──────────────────────────────────────────────────
  // Jika request datang dari domain selain jalakarta.com → resolve ke tenant slug
  if (!isOwnHost(host) && !pathname.startsWith("/api/internal/")) {
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://jalakarta.com";
      const resolveUrl = new URL("/api/internal/resolve-domain", appUrl);
      resolveUrl.searchParams.set("domain", host.split(":")[0]); // strip port jika ada

      const res = await fetch(resolveUrl.toString(), { cache: "no-store" });
      if (res.ok) {
        const { slug } = (await res.json()) as { slug: string | null };
        if (slug) {
          // Rewrite: ikpm.or.id/post/artikel → /pc-ikpm-jogjakarta/post/artikel (internal)
          const url = request.nextUrl.clone();
          url.pathname = `/${slug}${pathname === "/" ? "" : pathname}`;
          return NextResponse.rewrite(url);
        }
      }
    } catch {
      // Gagal resolve → lanjut normal (akan 404 atau homepage)
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

  // ── Tenant auth guard ──────────────────────────────────────────────────────
  const sessionCookie =
    request.cookies.get("better-auth.session_token") ??
    request.cookies.get("__Secure-better-auth.session_token");

  const isLoggedIn = !!sessionCookie;

  if (PROTECTED_PATTERN.test(pathname) && !isLoggedIn) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (AUTH_PAGES.includes(pathname) && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard-redirect", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/auth|dashboard-redirect).*)",
  ],
};
