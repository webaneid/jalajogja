import { notFound }                      from "next/navigation";
import { eq, desc, and, inArray, ilike, sql } from "drizzle-orm";
import { resolveVariantPriceRanges } from "@/lib/product-variation-price.server";
import { createTenantDb, db, tenants, members, memberBusinesses, getSettings } from "@jalajogja/db";
import { auth }                          from "@/lib/auth";
import { headers }                       from "next/headers";
import { ProductArchiveCards }           from "@/components/website/public/product-cards/product-archive-cards";
import { ProductArchiveClient }          from "@/components/toko/public/product-archive-client";
import type { ProductCardData, SessionType } from "@/lib/product-card-templates";
import { PRODUCT_ARCHIVE_CARD_DESIGN_IDS, type ProductArchiveCardDesignId } from "@/lib/product-archive-card-designs";
import type { Metadata }                 from "next";
import { getTenantSeoBase }              from "@/lib/tenant-seo";
import { generateMetadata as buildMetadata } from "@/lib/seo";
import { ShoppingBag, ChevronLeft, ChevronRight, ChevronRight as ChevronRightIcon } from "lucide-react";

export const revalidate = 60;

const PAGE_SIZE = 20;

type Params       = Promise<{ tenant: string; categorySlug: string }>;
type SearchParams  = Promise<{ search?: string; page?: string }>;

function extractCover(images: unknown): { coverUrl: string | null; coverVariants: Record<string, string> | null } {
  if (!Array.isArray(images) || images.length === 0) return { coverUrl: null, coverVariants: null };
  const first = images[0] as { url?: string; variants?: Record<string, string> | null };
  return { coverUrl: first.variants?.["square-large"] ?? first.url ?? null, coverVariants: first.variants ?? null };
}

async function resolveSessionType(userId: string | undefined): Promise<SessionType> {
  if (!userId) return "none";
  const [member] = await db
    .select({ id: members.id })
    .from(members)
    .where(eq(members.betterAuthUserId, userId))
    .limit(1);
  return member ? "member" : "public";
}

// SEO ringan (Fase 2, docs/arsitektur-seo.md § 3.2) — kalau kategori punya metaTitle/metaDesc,
// pakai itu; kalau tidak, tetap format template lama ("{nama} — Produk {siteName}").
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { tenant: slug, categorySlug } = await params;
  const tenantClient = createTenantDb(slug);
  const { db: tenantDb, schema } = tenantClient;
  const [cat, base] = await Promise.all([
    tenantDb
      .select({ name: schema.productCategories.name, metaTitle: schema.productCategories.metaTitle, metaDesc: schema.productCategories.metaDesc })
      .from(schema.productCategories)
      .where(eq(schema.productCategories.slug, categorySlug))
      .limit(1)
      .then((r) => r[0]),
    getTenantSeoBase(slug),
  ]);
  return buildMetadata({
    title:        cat?.metaTitle || `${cat?.name ?? categorySlug} — Produk ${base.siteName}`,
    description:  cat?.metaDesc  || `Produk kategori ${cat?.name ?? categorySlug} dari ${base.siteName}`,
    siteName:     base.siteName,
    canonicalUrl: `${base.baseUrl}/produk/kategori/${categorySlug}`,
    ogImageUrl:   base.logoUrl,
  });
}

export default async function ProdukKategoriPage({
  params,
  searchParams,
}: {
  params:       Params;
  searchParams: SearchParams;
}) {
  const { tenant: slug, categorySlug }   = await params;
  const { search, page: pageParam }      = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name, isActive: tenants.isActive })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  if (!tenant?.isActive) notFound();

  const session     = await auth.api.getSession({ headers: await headers() });
  const sessionType = await resolveSessionType(session?.user?.id);

  const tenantClient             = createTenantDb(slug);
  const { db: tenantDb, schema } = tenantClient;

  // Resolve kategori dari slug → 404 jika tidak ada
  const [category] = await tenantDb
    .select({ id: schema.productCategories.id, name: schema.productCategories.name, slug: schema.productCategories.slug })
    .from(schema.productCategories)
    .where(eq(schema.productCategories.slug, categorySlug))
    .limit(1);
  if (!category) notFound();

  // Semua kategori untuk filter chips navigasi
  const categories = await tenantDb
    .select({ id: schema.productCategories.id, name: schema.productCategories.name, slug: schema.productCategories.slug })
    .from(schema.productCategories)
    .orderBy(schema.productCategories.name);

  const whereClauses = [
    eq(schema.products.status, "active"),
    eq(schema.products.categoryId, category.id),
    ...(search ? [ilike(schema.products.name, `%${search}%`)] : []),
  ];

  const [{ total }] = await tenantDb
    .select({ total: sql<number>`count(*)` })
    .from(schema.products)
    .leftJoin(schema.mitras, eq(schema.mitras.id, schema.products.mitraId))
    .where(and(...whereClauses));

  const totalPages = Math.max(1, Math.ceil(Number(total) / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);

  const rows = await tenantDb
    .select({
      id:           schema.products.id,
      name:         schema.products.name,
      slug:         schema.products.slug,
      description:  schema.products.description,
      price:        schema.products.price,
      publicPrice:  schema.products.publicPrice,
      memberPrice:  schema.products.memberPrice,
      productType:  schema.products.productType,
      images:       schema.products.images,
      categoryId:   schema.products.categoryId,
      sellerType:   schema.products.sellerType,
      mitraId:      schema.products.mitraId,
      categoryName: schema.productCategories.name,
    })
    .from(schema.products)
    .leftJoin(schema.productCategories, eq(schema.productCategories.id, schema.products.categoryId))
    .leftJoin(schema.mitras, eq(schema.mitras.id, schema.products.mitraId))
    .where(and(...whereClauses))
    .orderBy(desc(schema.products.createdAt))
    .limit(PAGE_SIZE)
    .offset((safePage - 1) * PAGE_SIZE);

  const filtered = rows.filter(r =>
    r.sellerType === "tenant" || (r.sellerType === "mitra" && r.mitraId != null),
  );

  const mitraIds = [...new Set(filtered.filter(r => r.mitraId).map(r => r.mitraId!))];
  const businessMap = new Map<string, string>();
  if (mitraIds.length > 0) {
    const mitras = await tenantDb
      .select({ id: schema.mitras.id, businessId: schema.mitras.businessId })
      .from(schema.mitras)
      .where(inArray(schema.mitras.id, mitraIds));
    const bizIds = [...new Set(mitras.map(m => m.businessId))];
    if (bizIds.length > 0) {
      const bizRows = await db
        .select({ id: memberBusinesses.id, name: memberBusinesses.name, brand: memberBusinesses.brand })
        .from(memberBusinesses)
        .where(inArray(memberBusinesses.id, bizIds));
      const bizById = new Map(bizRows.map(b => [b.id, b.brand ?? b.name]));
      mitras.forEach(m => businessMap.set(m.id, bizById.get(m.businessId) ?? ""));
    }
  }

  const variableIds   = filtered.filter(r => r.productType === "variable").map(r => r.id);
  const priceRangeMap = await resolveVariantPriceRanges(tenantClient, variableIds);

  const products: ProductCardData[] = filtered.map(r => {
    const { coverUrl, coverVariants } = extractCover(r.images);
    const isVariable = r.productType === "variable";
    const range      = isVariable ? priceRangeMap.get(r.id) : null;
    const priceMin   = range?.min ?? String(r.price);
    const priceMax   = range && range.max !== range.min ? range.max : null;
    return {
      id:           r.id,
      name:         r.name,
      slug:         r.slug,
      description:  r.description,
      price:        String(r.price),
      publicPrice:  r.publicPrice != null ? String(r.publicPrice) : null,
      memberPrice:  r.memberPrice != null ? String(r.memberPrice) : null,
      productType:  (r.productType ?? "simple") as "simple" | "variable",
      priceMin,
      priceMax,
      coverUrl,
      coverVariants,
      categoryName: r.categoryName ?? null,
      sellerType:   (r.sellerType ?? "tenant") as "tenant" | "mitra",
      businessName: r.mitraId ? (businessMap.get(r.mitraId) ?? null) : null,
      mitraId:      r.mitraId ?? null,
    };
  });

  const basePath = `/${slug}/produk`;

  // Desain kartu arsip — lihat docs/arsitektur-product.md
  const tokoSettings     = await getSettings(tenantClient, "toko");
  const archiveDesignRaw = tokoSettings.product_archive_design as { design?: string } | undefined;
  const archiveDesign: ProductArchiveCardDesignId = PRODUCT_ARCHIVE_CARD_DESIGN_IDS.includes(archiveDesignRaw?.design as ProductArchiveCardDesignId)
    ? (archiveDesignRaw!.design as ProductArchiveCardDesignId)
    : "1";

  return (
    <div className="py-10 px-4">
      <div className="max-w-7xl mx-auto">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-6">
          <a href={basePath} className="hover:text-foreground transition-colors">Produk</a>
          <ChevronRightIcon className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">{category.name}</span>
        </nav>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{category.name}</h1>
          <p className="text-muted-foreground text-sm mt-1">{tenant.name}</p>
        </div>

        {/* Filter */}
        <div className="mb-6">
          <ProductArchiveClient
            categories={categories}
            currentCategory={categorySlug}
            currentSearch={search ?? ""}
            basePath={basePath}
          />
        </div>

        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <ShoppingBag className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-sm">Belum ada produk di kategori ini{search ? ` untuk "${search}"` : ""}.</p>
          </div>
        ) : (
          <ProductArchiveCards design={archiveDesign} products={products} tenantSlug={slug} sessionType={sessionType} />
        )}

        {totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-2">
            {safePage > 1 && (
              <a
                href={`/${slug}/produk/kategori/${categorySlug}?${new URLSearchParams({ ...(search ? { search } : {}), page: String(safePage - 1) }).toString()}`}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-sm transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                Sebelumnya
              </a>
            )}
            <span className="text-sm text-muted-foreground px-2">
              Halaman {safePage} dari {totalPages}
            </span>
            {safePage < totalPages && (
              <a
                href={`/${slug}/produk/kategori/${categorySlug}?${new URLSearchParams({ ...(search ? { search } : {}), page: String(safePage + 1) }).toString()}`}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-sm transition-colors"
              >
                Berikutnya
                <ChevronRight className="h-4 w-4" />
              </a>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
