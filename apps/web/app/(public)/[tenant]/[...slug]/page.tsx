// Catch-all route — MENGGANTIKAN [pageSlug]/page.tsx (single dynamic segment tidak bisa
// menangkap path post multi-segmen: date_name 3-segmen, category_date_name 4-segmen).
// docs/arsitektur-import-export-post-wordpress.md § 5.4/§ 5.5, Fase 2.5.
//
// Prioritas resolusi (Next.js App Router SELALU cocokkan folder statis — post/, produk/,
// agenda/, dst — SEBELUM catch-all ini, jadi tenant permalink="default" tidak pernah sampai
// ke file ini untuk path /post/{slug}):
//   1. 1 segmen  → coba Page dulu (perilaku EXISTING, dipertahankan persis)
//   2. 1 segmen  → kalau bukan Page DAN permalink="post_name" → coba Post
//   3. 3 segmen  → kalau permalink="date_name" → Post via segmen ke-3 (year/month diabaikan
//      untuk lookup, cuma kosmetik di URL — post dicari by slug unik)
//   4. 4 segmen  → kalau permalink="category_date_name" → Post via segmen ke-4 (category
//      diabaikan untuk lookup, sama alasannya)
//   5. Tidak ketemu apa pun di atas → cek legacy_url_redirects, redirect 308 kalau ketemu
//   6. Semua gagal → notFound()
import { cache } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { createTenantDb, db, tenants, getSettings, type TenantDb } from "@jalajogja/db";
import { resolveBaseUrl } from "@/lib/resolve-base-url";
import { publicUrl } from "@/lib/minio";
import { DefaultTemplate } from "@/components/website/public/default-template";
import { LandingTemplate } from "@/components/website/public/landing-template";
import { ContactTemplate } from "@/components/website/public/contact-template";
import { LinktreeTemplate } from "@/components/website/public/linktree-template";
import { parseLandingBody, parseContactBody, parseLinktreeBody } from "@/lib/page-templates";
import type { Metadata } from "next";
import { generateMetadata as buildMetadata } from "@/lib/seo";
import { getTenantSeoBase } from "@/lib/tenant-seo";
import { getPublicNavMenu } from "@/lib/get-public-nav-menu";
import { getPostDetailMetadata, PostDetailView } from "@/components/website/public/single/post-detail-view";
import { getTenantPermalink } from "@/lib/post-permalink.server";

export const revalidate = 60;

type Params = Promise<{ tenant: string; slug: string[] }>;

// ── Resolusi jenis konten dari segmen path ──────────────────────────────────────

type Resolution =
  | { kind: "page"; pageSlug: string }
  | { kind: "post"; postSlug: string }
  | { kind: "redirect"; to: string }
  | { kind: "none" };

async function pageExists(tenantClient: TenantDb, pageSlug: string): Promise<boolean> {
  const { db: tenantDb, schema } = tenantClient;
  const [row] = await tenantDb
    .select({ id: schema.pages.id })
    .from(schema.pages)
    .where(and(eq(schema.pages.slug, pageSlug), eq(schema.pages.status, "published")))
    .limit(1);
  return !!row;
}

async function postExists(tenantClient: TenantDb, postSlug: string): Promise<boolean> {
  const { db: tenantDb, schema } = tenantClient;
  const [row] = await tenantDb
    .select({ id: schema.posts.id })
    .from(schema.posts)
    .where(and(eq(schema.posts.slug, postSlug), eq(schema.posts.status, "published")))
    .limit(1);
  return !!row;
}

// React.cache() — dedup pemanggilan antara generateMetadata() dan CatchAllPage() untuk request
// yang sama (docs/rencana-perbaikan-akses-404.md § 3.3/Fase C). Next.js TIDAK otomatis dedup
// fungsi custom seperti fetch() — tanpa ini, setiap request menjalankan query ini 2x.
//
// PENTING — argumen kedua HARUS primitif (string), BUKAN array `segments: string[]`: dibuktikan
// EMPIRIS (console.log sementara + curl) bahwa `segments` yang didestructure dari `await params`
// di generateMetadata() dan CatchAllPage() TERNYATA array reference yang BERBEDA meski isinya
// identik — asumsi awal "Next.js selalu bagi objek params yang sama" ternyata TIDAK berlaku di
// sini (beda dari getCurrentSession di lib/tenant.ts yang argumennya nol/primitif semua).
// React.cache() bandingkan argumen non-primitif secara REFERENCE, bukan deep-equality — array
// beda reference = cache miss meski isinya sama. Fix: gabung segments jadi satu string sebelum
// masuk fungsi cache, split lagi di dalam. String primitif dibandingkan by VALUE, dedup benar.
const resolveSlugKind = cache(async (tenantSlug: string, joinedSegments: string): Promise<Resolution> => {
  const segments = joinedSegments.split("/");
  const tenantClient = createTenantDb(tenantSlug);
  const { db: tenantDb, schema } = tenantClient;

  if (segments.length === 1) {
    const slug = segments[0]!;
    if (await pageExists(tenantClient, slug)) return { kind: "page", pageSlug: slug };

    const permalink = await getTenantPermalink(tenantClient);
    if (permalink === "post_name" && (await postExists(tenantClient, slug))) {
      return { kind: "post", postSlug: slug };
    }
  } else if (segments.length === 3) {
    const permalink = await getTenantPermalink(tenantClient);
    if (permalink === "date_name") {
      const postSlug = segments[2]!;
      if (await postExists(tenantClient, postSlug)) return { kind: "post", postSlug };
    }
  } else if (segments.length === 4) {
    const permalink = await getTenantPermalink(tenantClient);
    if (permalink === "category_date_name") {
      const postSlug = segments[3]!;
      if (await postExists(tenantClient, postSlug)) return { kind: "post", postSlug };
    }
  }

  // Legacy redirect fallback — cek SETELAH page/post gagal match.
  const joinedPath = "/" + segments.join("/");
  const [redirectRow] = await tenantDb
    .select({ redirectTo: schema.legacyUrlRedirects.redirectTo })
    .from(schema.legacyUrlRedirects)
    .where(eq(schema.legacyUrlRedirects.oldPath, joinedPath))
    .limit(1);
  if (redirectRow) return { kind: "redirect", to: redirectRow.redirectTo };

  return { kind: "none" };
});

// ── Page fetch + metadata (dipertahankan persis dari [pageSlug]/page.tsx lama) ──────────────

async function getPage(slug: string, pageSlug: string) {
  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name, isActive: tenants.isActive })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);

  if (!tenant?.isActive) return null;

  const tenantClient             = createTenantDb(slug);
  const { db: tenantDb, schema } = tenantClient;

  const [page] = await tenantDb
    .select({
      id:        schema.pages.id,
      title:     schema.pages.title,
      content:   schema.pages.content,
      template:  schema.pages.template,
      status:    schema.pages.status,
      coverId:   schema.pages.coverId,
      updatedAt: schema.pages.updatedAt,
      metaTitle:      schema.pages.metaTitle,
      metaDesc:       schema.pages.metaDesc,
      ogTitle:        schema.pages.ogTitle,
      ogDescription:  schema.pages.ogDescription,
    })
    .from(schema.pages)
    .where(eq(schema.pages.slug, pageSlug))
    .limit(1);

  if (!page || page.status !== "published") return null;

  let coverUrl: string | null = null;
  if (page.coverId) {
    const [media] = await tenantDb
      .select({ path: schema.media.path })
      .from(schema.media)
      .where(eq(schema.media.id, page.coverId))
      .limit(1);
    coverUrl = media ? publicUrl(slug, media.path) : null;
  }

  return { page, coverUrl, tenantName: tenant.name, tenantClient, slug };
}

async function getPageMetadata(slug: string, pageSlug: string): Promise<Metadata> {
  const [result, base] = await Promise.all([
    getPage(slug, pageSlug),
    getTenantSeoBase(slug),
  ]);
  if (!result) return {};
  const { page, coverUrl } = result;
  return buildMetadata({
    title:         page.metaTitle || page.title,
    description:   page.metaDesc ?? undefined,
    siteName:      base.siteName,
    canonicalUrl:  `${base.baseUrl}/${pageSlug}`,
    ogImageUrl:    coverUrl ?? base.logoUrl,
    ogTitle:       page.ogTitle  || undefined,
    ogDescription: page.ogDescription || undefined,
  });
}

async function renderPage(slug: string, pageSlug: string) {
  const baseUrl = await resolveBaseUrl(slug);
  const result  = await getPage(slug, pageSlug);
  if (!result) notFound();

  const { page, coverUrl, tenantClient, tenantName } = result;

  if (page.template === "landing") {
    const body = parseLandingBody(page.content);
    return (
      <LandingTemplate
        body={body}
        tenantSlug={slug}
        tenantClient={tenantClient}
        baseUrl={baseUrl}
      />
    );
  }

  if (page.template === "contact") {
    const body     = parseContactBody(page.content);
    const settings = await getSettings(tenantClient, "contact");
    return (
      <ContactTemplate
        tenantSlug={slug}
        pageId={page.id}
        title={page.title}
        body={body}
        settings={settings as Parameters<typeof ContactTemplate>[0]["settings"]}
      />
    );
  }

  if (page.template === "linktree") {
    const body = parseLinktreeBody(page.content);
    return (
      <LinktreeTemplate
        title={page.title}
        body={body}
        orgName={tenantName}
      />
    );
  }

  // terms + privacy + default + about: render Tiptap HTML
  const [navMenu, seoBase] = await Promise.all([
    getPublicNavMenu(tenantClient, slug, baseUrl),
    getTenantSeoBase(slug),
  ]);
  return (
    <DefaultTemplate
      title={page.title}
      content={page.content}
      coverUrl={coverUrl}
      updatedAt={page.updatedAt}
      backHref={baseUrl || "/"}
      navMenu={navMenu}
      siteName={tenantName}
      pageUrl={`${seoBase.baseUrl}/${pageSlug}`}
      tenantSlug={slug}
      baseUrl={baseUrl}
    />
  );
}

// ── Metadata + Page ──────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { tenant: tenantSlug, slug: segments } = await params;
  const resolution = await resolveSlugKind(tenantSlug, segments.join("/"));

  if (resolution.kind === "page") return getPageMetadata(tenantSlug, resolution.pageSlug);
  if (resolution.kind === "post") return getPostDetailMetadata(tenantSlug, resolution.postSlug);
  return {};
}

export default async function CatchAllPage({ params }: { params: Params }) {
  const { tenant: tenantSlug, slug: segments } = await params;
  const resolution = await resolveSlugKind(tenantSlug, segments.join("/"));

  if (resolution.kind === "redirect") {
    permanentRedirect(resolution.to);
  }
  if (resolution.kind === "post") {
    return <PostDetailView tenantSlug={tenantSlug} postSlug={resolution.postSlug} />;
  }
  if (resolution.kind === "page") {
    return renderPage(tenantSlug, resolution.pageSlug);
  }
  notFound();
}
