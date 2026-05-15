import { notFound }                      from "next/navigation";
import { eq, desc, and, inArray, min, max, ilike, sql } from "drizzle-orm";
import { createTenantDb, db, tenants, members, memberBusinesses } from "@jalajogja/db";
import { auth }                          from "@/lib/auth";
import { headers }                       from "next/headers";
import { ProductCard }                   from "@/components/website/public/product-cards/product-card";
import { ProductArchiveClient }          from "@/components/toko/public/product-archive-client";
import type { ProductCardData, SessionType } from "@/lib/product-card-templates";
import { generateMetadata as buildMetadata } from "@/lib/seo";
import { getTenantSeoBase } from "@/lib/tenant-seo";
import type { Metadata }                 from "next";
import { ShoppingBag } from "lucide-react";
import { PublicButton } from "@/components/website/public/ui/public-button";

export const revalidate = 60;

const PAGE_SIZE = 20;

type Params        = Promise<{ tenant: string }>;
type SearchParams  = Promise<{ category?: string; search?: string; page?: string }>;

// ─── extractCover (sama dengan products-section.tsx) ──────────────────────────
function extractCover(images: unknown): { coverUrl: string | null; coverVariants: Record<string, string> | null } {
  if (!Array.isArray(images) || images.length === 0) return { coverUrl: null, coverVariants: null };
  const first = images[0] as { url?: string; variants?: Record<string, string> | null };
  const coverUrl = first.variants?.["square-large"] ?? first.url ?? null;
  return { coverUrl, coverVariants: first.variants ?? null };
}

// ─── sessionType ──────────────────────────────────────────────────────────────
async function resolveSessionType(userId: string | undefined): Promise<SessionType> {
  if (!userId) return "none";
  const [member] = await db
    .select({ id: members.id })
    .from(members)
    .where(eq(members.betterAuthUserId, userId))
    .limit(1);
  return member ? "member" : "public";
}

// ─── Metadata ─────────────────────────────────────────────────────────────────
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { tenant: slug } = await params;
  const base = await getTenantSeoBase(slug);
  return buildMetadata({ title: "Produk", siteName: base.siteName, ogImageUrl: base.logoUrl, canonicalUrl: `${base.baseUrl}/produk` });
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function ProdukArchivePage({
  params,
  searchParams,
}: {
  params:       Params;
  searchParams: SearchParams;
}) {
  const { tenant: slug }                       = await params;
  const { category, search, page: pageParam }  = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name, isActive: tenants.isActive })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  if (!tenant?.isActive) notFound();

  const session     = await auth.api.getSession({ headers: await headers() });
  const sessionType = await resolveSessionType(session?.user?.id);

  const tenantClient           = createTenantDb(slug);
  const { db: tenantDb, schema } = tenantClient;

  // Resolve kategori filter
  let categoryId: string | null = null;
  if (category) {
    const [cat] = await tenantDb
      .select({ id: schema.productCategories.id })
      .from(schema.productCategories)
      .where(eq(schema.productCategories.slug, category))
      .limit(1);
    categoryId = cat?.id ?? null;
  }

  // Fetch semua kategori (untuk filter chips)
  const categories = await tenantDb
    .select({ id: schema.productCategories.id, name: schema.productCategories.name, slug: schema.productCategories.slug })
    .from(schema.productCategories)
    .orderBy(schema.productCategories.name);

  // Clauses filter
  const whereClauses = [
    eq(schema.products.status, "active"),
    ...(categoryId ? [eq(schema.products.categoryId, categoryId)] : []),
    ...(search ? [ilike(schema.products.name, `%${search}%`)] : []),
  ];

  // Count total untuk pagination
  const [{ total }] = await tenantDb
    .select({ total: sql<number>`count(*)` })
    .from(schema.products)
    .leftJoin(schema.mitras, eq(schema.mitras.id, schema.products.mitraId))
    .where(and(...whereClauses));

  const totalPages = Math.max(1, Math.ceil(Number(total) / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);

  // Fetch produk
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

  // Filter mitra aktif di app layer
  const filtered = rows.filter(r =>
    r.sellerType === "tenant" ||
    (r.sellerType === "mitra" && r.mitraId != null),
  );

  // businessName cross-schema
  const mitraIds = [...new Set(filtered.filter(r => r.mitraId).map(r => r.mitraId!))] ;
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

  // priceMin/priceMax untuk variable product
  const variableIds = filtered.filter(r => r.productType === "variable").map(r => r.id);
  const priceRangeMap = new Map<string, { min: string; max: string }>();
  if (variableIds.length > 0) {
    const ranges = await tenantDb
      .select({
        productId: schema.productVariations.productId,
        minPrice:  min(schema.productVariations.price),
        maxPrice:  max(schema.productVariations.price),
      })
      .from(schema.productVariations)
      .where(and(
        inArray(schema.productVariations.productId, variableIds),
        eq(schema.productVariations.isActive, true),
      ))
      .groupBy(schema.productVariations.productId);
    ranges.forEach(r => {
      if (r.minPrice && r.maxPrice)
        priceRangeMap.set(r.productId, { min: r.minPrice, max: r.maxPrice });
    });
  }

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

  return (
    <div className="py-10 px-4">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Produk</h1>
          <p className="text-muted-foreground text-sm mt-1">{tenant.name}</p>
        </div>

        {/* Filter: search + kategori chips */}
        <div className="mb-6">
          <ProductArchiveClient
            categories={categories}
            currentCategory={category ?? null}
            currentSearch={search ?? ""}
            basePath={basePath}
          />
        </div>

        {/* Grid produk */}
        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <ShoppingBag className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-sm">Belum ada produk{search ? ` untuk "${search}"` : ""}.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {products.map(p => (
              <ProductCard key={p.id} product={p} variant="grid" tenantSlug={slug} sessionType={sessionType} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-2">
            {safePage > 1 && (
              <PublicButton
                href={`${basePath}?${new URLSearchParams({ ...(category ? { category } : {}), ...(search ? { search } : {}), page: String(safePage - 1) }).toString()}`}
                variant="outline-dark" size="sm" iconLeft="chevron" icon="none"
              >
                Sebelumnya
              </PublicButton>
            )}
            <span className="text-sm text-muted-foreground px-2">
              Halaman {safePage} dari {totalPages}
            </span>
            {safePage < totalPages && (
              <PublicButton
                href={`${basePath}?${new URLSearchParams({ ...(category ? { category } : {}), ...(search ? { search } : {}), page: String(safePage + 1) }).toString()}`}
                variant="outline-dark" size="sm" icon="chevron"
              >
                Berikutnya
              </PublicButton>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
