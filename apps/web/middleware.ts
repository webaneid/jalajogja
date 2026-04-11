import { NextRequest, NextResponse } from "next/server";

// Route yang butuh autentikasi — slug valid diikuti salah satu module path
const PROTECTED_PATTERN = /^\/[a-z0-9-]+\/(dashboard|members|letters|finance|shop|settings)/;

// Route yang tidak boleh diakses kalau sudah login (auth pages)
// /register TIDAK diblok — user yang login tapi belum punya tenant perlu akses ke sini
const AUTH_PAGES = ["/login"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Cek keberadaan session cookie Better Auth
  // Ini soft-check — validasi sungguhan ada di layout server component
  const sessionCookie =
    request.cookies.get("better-auth.session_token") ??
    request.cookies.get("__Secure-better-auth.session_token");

  const isLoggedIn = !!sessionCookie;

  // Redirect ke /login jika akses protected route tanpa session
  if (PROTECTED_PATTERN.test(pathname) && !isLoggedIn) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect ke /dashboard-redirect jika sudah login tapi akses halaman auth
  // /dashboard-redirect adalah server component yang cari tenant pertama user
  if (AUTH_PAGES.includes(pathname) && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard-redirect", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Jalankan middleware di semua route kecuali:
    // - _next/static (static files)
    // - _next/image (image optimization)
    // - favicon.ico
    // - api/auth (Better Auth handle sendiri)
    // - dashboard-redirect (hindari infinite redirect loop)
    "/((?!_next/static|_next/image|favicon.ico|api/auth|dashboard-redirect).*)",
  ],
};
