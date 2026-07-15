import { NextRequest, NextResponse } from "next/server";
import { isOwnHost } from "@/lib/is-own-host";

// Platform: semua /platform/* kecuali /platform/login
const PLATFORM_PUBLIC    = /^\/platform\/login$/;
const PLATFORM_PROTECTED = /^\/platform(\/|$)/;

// Admin-on-Custom-Domain (Opsi B, path-based) — docs/arsitektur-domain.md § 7.
// Resolve slug SELALU dari Host header request ini sendiri, tidak pernah dari path —
// ini yang menjamin /admin/* di sebuah custom domain hanya bisa membuka dashboard
// tenant PEMILIK domain itu, tidak pernah tenant lain (celah yang sama persis dengan
// yang ditutup 2026-07-08 untuk /app/* biasa, lihat § 8.1 dokumen).
async function resolveCustomDomainSlug(host: string): Promise<string | null> {
  try {
    const internalUrl =
      process.env.APP_INTERNAL_URL ??
      process.env.NEXT_PUBLIC_APP_URL ??
      "http://localhost:3000";
    const normalizedHost = host.split(":")[0].replace(/^www\./, "");
    const resolveUrl = new URL("/api/internal/resolve-domain", internalUrl);
    resolveUrl.searchParams.set("domain", normalizedHost);
    const res = await fetch(resolveUrl.toString(), {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const { slug } = (await res.json()) as { slug: string | null };
    return slug;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") ?? "";

  // ── Custom domain routing ──────────────────────────────────────────────────
  // Jika request datang dari domain selain jalakarta.com → resolve ke tenant slug.
  if (!isOwnHost(host)) {
    // Admin-on-Custom-Domain: /admin/* di custom domain tenant sendiri → dashboard admin
    // tenant PEMILIK domain ini (rewrite internal ke /app/{slug}/*, URL bar tetap /admin/*).
    // Ditempatkan SEBELUM guard /app/*+/platform/* di bawah — carve-out eksplisit dan sempit,
    // bukan membuka blanket akses /app/*.
    if (pathname === "/admin" || pathname.startsWith("/admin/")) {
      const slug = await resolveCustomDomainSlug(host);

      if (!slug) {
        // Domain belum/tidak aktif → tidak ada konteks tenant sama sekali untuk diarahkan ke
        // /login sendiri — jangan lanjut ke logic publik (akan 404 lewat catch-all [pageSlug]),
        // arahkan ke login admin kanonik di jalakarta.com sebagai fallback aman.
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://jalakarta.com";
        return NextResponse.redirect(new URL("/app/login", appUrl).toString(), 302);
      }

      // Cermin guard cookie /app/* di bawah (§ 8.1) — dicek proaktif di sini juga (bukan cuma
      // diserahkan ke layout (dashboard)/app/[tenant]/layout.tsx, yang tetap jadi lapis kedua).
      // Redirect ke /login DI DOMAIN INI SENDIRI (bukan jalakarta.com) — cookie sesi Better Auth
      // di-scope oleh Host header saat login (lihat lesson "Login di Custom Domain — Better Auth
      // CSRF"), jadi login via {custom-domain}/login menghasilkan cookie yang valid untuk
      // {custom-domain}/admin/* juga. login-form.tsx sudah honor query `redirect` apa adanya
      // (window.location.href = redirectTo || baseUrl/akun) — tidak perlu perubahan apapun di sana.
      const sessionCookie =
        request.cookies.get("better-auth.session_token") ??
        request.cookies.get("__Secure-better-auth.session_token");
      if (!sessionCookie) {
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = "/login";
        loginUrl.search   = "";
        loginUrl.searchParams.set("redirect", pathname);
        return NextResponse.redirect(loginUrl, 302);
      }

      // "/app/{slug}" bare (tanpa sub-path) BUKAN route valid — tidak ada page.tsx di sana
      // (dashboard admin selalu diakses via /app/{slug}/dashboard). "/admin" bare wajib
      // di-map ke /dashboard, bukan diteruskan apa adanya.
      const restPath = pathname === "/admin" || pathname === "/admin/" ? "/dashboard" : pathname.slice("/admin".length);
      const url = request.nextUrl.clone();
      url.pathname = `/app/${slug}${restPath}`;
      return NextResponse.rewrite(url);
    }

    // Path admin (/app/*) dan platform (/platform/*) pada custom domain → redirect ke jalakarta.com,
    // KECUALI /app/{slug}/* untuk slug PEMILIK domain ini sendiri (Opsi C, docs/arsitektur-domain.md
    // § 7.2). Alasan: seluruh dashboard admin (ratusan file — sidebar, semua modul, semua server
    // action) hardcode link/redirect sebagai path absolut /app/{slug}/... — refactor total supaya
    // /admin/* konsisten di address bar sebanding migrasi URL Fase 1-4 dulu (127+131 referensi).
    // Dengan membiarkan /app/{slug-sendiri}/* render langsung, semua link itu otomatis jalan tanpa
    // disentuh satu file pun — trade-off: address bar berubah ke /app/{slug}/... setelah klik menu
    // pertama (bukan tetap /admin/...), tapi tenant tetap di domain sendiri & branding tetap tampil.
    // Verifikasi tetap dari Host header (bukan path) — tenant lain tetap tidak bisa diakses.
    if (pathname.startsWith("/app/") || pathname.startsWith("/platform/")) {
      let allowOwnApp = false;
      if (pathname.startsWith("/app/")) {
        const ownSlug  = await resolveCustomDomainSlug(host);
        const pathSlug = pathname.split("/")[2];
        allowOwnApp = !!ownSlug && pathSlug === ownSlug;
      }
      if (!allowOwnApp) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://jalakarta.com";
        const dest   = new URL(pathname + request.nextUrl.search, appUrl);
        return NextResponse.redirect(dest.toString(), 302);
      }

      // allowOwnApp true — WAJIB return eksplisit di sini. Tanpa return, eksekusi jatuh ke blok
      // resolve-domain PUBLIK di bawah (masih di dalam if (!isOwnHost)), yang salah rewrite jadi
      // /{slug}/app/{slug}/... (4 segmen, tidak match route manapun → 404 — bug nyata yang
      // ditemukan saat uji manual, lihat § 8.1 dokumen).
      //
      // Cermin guard cookie /app/* standar (di bawah, di luar blok custom domain) di sini juga —
      // kalau cuma next() polos lalu biarkan layout (dashboard)/app/[tenant]/layout.tsx yang
      // redirect(), hasilnya `/app/login` RELATIF yang di-resolve browser ke visikita.com/app/login
      // dulu (1 hop sia-sia + redundant dengan pathSlug="login" yang pasti gagal cocok), baru
      // dari situ terlempar lagi ke jalakarta.com. Dicek proaktif di sini → 1 hop langsung ke
      // /login DI DOMAIN INI SENDIRI (sama seperti cabang /admin di atas), konsisten & lebih cepat.
      const sessionCookie =
        request.cookies.get("better-auth.session_token") ??
        request.cookies.get("__Secure-better-auth.session_token");
      if (!sessionCookie) {
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = "/login";
        loginUrl.search   = "";
        loginUrl.searchParams.set("redirect", pathname);
        return NextResponse.redirect(loginUrl, 302);
      }
      return NextResponse.next();
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
