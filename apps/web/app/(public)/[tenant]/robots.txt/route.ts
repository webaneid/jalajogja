import { NextResponse } from "next/server";
import { getTenantSeoBase } from "@/lib/tenant-seo";

// Fix bug live custom domain — docs/arsitektur-seo.md § 6c.2. middleware.ts me-rewrite SEMUA
// path non-/admin/non-/api di custom domain jadi `/{slug}${pathname}` (termasuk `/robots.txt`),
// tapi Metadata Route file convention (`app/robots.ts`) TIDAK BISA di-nest ke dalam dynamic
// segment — dikonfirmasi empiris via source Next.js sendiri (`is-metadata-route.ts`):
// regex pencocokan untuk `robots`/`manifest`/`favicon.ico` di-ANCHOR dengan `^` (harus persis di
// root `app/`), beda dari `sitemap`/`icon`/`opengraph-image` yang TIDAK di-anchor (boleh nested).
// Percobaan awal menaruh `app/(public)/[tenant]/robots.ts` compile TANPA error tapi menghasilkan
// NOL route — file itu diam-diam diabaikan Next.js (bukan page, bukan route, bukan metadata file
// yang dikenali di lokasi itu). Solusi yang genuinely bekerja: Route Handler biasa di folder
// literal bernama `robots.txt` — Route Handler mendukung nesting di kedalaman path berapa pun
// (termasuk dynamic segment), menghasilkan route `/{tenant}/robots.txt` — PERSIS path hasil
// rewrite middleware, match di custom domain MAUPUN akses path-based langsung.
//
// `app/robots.ts` (root, generik, TETAP DIPERTAHANKAN) melayani domain telanjang
// (`jalakarta.com/robots.txt`, landing page platform) yang tidak pernah match segmen dinamis
// `[tenant]` (0 segmen path) — dua file ini hidup di kedalaman URL berbeda, tidak collision.
//
// Isi rules masih generik (identik root) — belum per-bot AI (itu tetap scope Fase 6, § 5). Baris
// `Sitemap:` ditambahkan sekarang karena Fase 5 (Dual Sitemap Index) SUDAH selesai dibangun
// (§ 4.5) — menutup gap yang sebelumnya dicatat "menyusul saat Fase 5 selesai" di komentar ini.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const { tenant: slug } = await params;
  const base = await getTenantSeoBase(slug);
  const body = [
    "User-agent: *",
    "Allow: /",
    "",
    `Sitemap: ${base.baseUrl}/sitemap.xml`,
    `Sitemap: ${base.baseUrl}/sitemap_index.xml`,
  ].join("\n") + "\n";
  return new NextResponse(body, {
    headers: { "Content-Type": "text/plain" },
  });
}
