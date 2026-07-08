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
  if (!isOwnHost(host)) {
    // Path admin (/app/*) dan platform (/platform/*) pada custom domain → redirect ke jalakarta.com.
    // Custom domain hanya boleh melayani konten publik tenant mereka sendiri.
    if (pathname.startsWith("/app/") || pathname.startsWith("/platform/")) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://jalakarta.com";
      const dest   = new URL(pathname + request.nextUrl.search, appUrl);
      return NextResponse.redirect(dest.toString(), 302);
    }

    // API paths → pass through tanpa rewrite custom domain
    if (pathname.startsWith("/api/")) {
      return NextResponse.next();
    }

    try {
      const internalUrl =
        process.env.APP_INTERNAL_URL ??
        process.env.NEXT_PUBLIC_APP_URL ??
        "http://localhost:3000";

      // Strip port + normalisasi: hapus www. agar 'www.ikpmjogja.com' resolve ke 'ikpmjogja.com'
      const rawHost = host.split(":")[0];
      const normalizedHost = rawHost.replace(/^www\./, "");
      const hasWww = rawHost !== normalizedHost;

      const resolveUrl = new URL("/api/internal/resolve-domain", internalUrl);
      resolveUrl.searchParams.set("domain", normalizedHost);

      const res = await fetch(resolveUrl.toString(), {
        cache: "no-store",
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const { slug } = (await res.json()) as { slug: string | null };
        if (slug) {
          // Jika request datang dari www.* → redirect 301 ke apex domain (tanpa www)
          if (hasWww) {
            const apexUrl = request.nextUrl.clone();
            apexUrl.host = normalizedHost;
            return NextResponse.redirect(apexUrl, 301);
          }

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
