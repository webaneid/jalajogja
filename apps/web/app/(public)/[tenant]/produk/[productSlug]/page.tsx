import { notFound }                from "next/navigation";
import { eq, desc, and, inArray, min, max } from "drizzle-orm";
import { createTenantDb, db, tenants, members, memberBusinesses } from "@jalajogja/db";
import { auth }                   from "@/lib/auth";
import { headers }                from "next/headers";
import { renderBody }             from "@/lib/letter-render";
import { ProductDetailClient }    from "@/components/toko/public/product-detail-client";
import { ProductCard }            from "@/components/website/public/product-cards/product-card";
import type { ProductCardData, SessionType } from "@/lib/product-card-templates";
import type { Metadata }          from "next";
import type { ProductVariationData, AttributeGroup, ViewerImage } from "@/components/toko/public/product-detail-client";
import { ChevronRight }           from "lucide-react";
import { generateMetadata as buildMetadata } from "@/lib/seo";
import { getTenantSeoBase } from "@/lib/tenant-seo";

export const revalidate = 60;

type Params = Promise<{ tenant: string; productSlug: string }>;

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

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { tenant: slug, productSlug } = await params;
  const [base] = await Promise.all([getTenantSeoBase(slug)]);

  const tenantClient             = createTenantDb(slug);
  const { db: tenantDb, schema } = tenantClient;
  const [product] = await tenantDb
    .select({ name: schema.products.name, metaTitle: schema.products.metaTitle, metaDesc: schema.products.metaDesc, images: schema.products.images })
    .from(schema.products)
    .where(and(eq(schema.products.slug, productSlug), eq(schema.products.status, "active")))
    .limit(1);

  if (!product) return {};
  const firstImg = Array.isArray(product.images) && product.images.length > 0
    ? (product.images[0] as { variants?: Record<string, string>; url?: string })
    : null;
  const ogImage = firstImg?.variants?.["large"] ?? firstImg?.variants?.["original"] ?? firstImg?.url ?? base.logoUrl;
  return buildMetadata({
    title:       product.metaTitle ?? product.name,
    description: product.metaDesc ?? undefined,
    siteName:    base.siteName,
    canonicalUrl: `${base.baseUrl}/produk/${productSlug}`,
    ogImageUrl:  ogImage,
    ogType:      "article",
  });
}

export default async function ProdukDetailPage({ params }: { params: Params }) {
  const { tenant: slug, productSlug } = await params;

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

  // ── Fetch produk ──────────────────────────────────────────────────────────
  const [row] = await tenantDb
    .select({
      id:              schema.products.id,
      name:            schema.products.name,
      slug:            schema.products.slug,
      description:     schema.products.description,
      price:           schema.products.price,
      publicPrice:     schema.products.publicPrice,
      memberPrice:     schema.products.memberPrice,
      productType:     schema.products.productType,
      attributeGroups: schema.products.attributeGroups,
      images:          schema.products.images,
      stock:           schema.products.stock,
      categoryId:      schema.products.categoryId,
      sellerType:      schema.products.sellerType,
      mitraId:         schema.products.mitraId,
      categoryName:    schema.productCategories.name,
      categorySlug:    schema.productCategories.slug,
    })
    .from(schema.products)
    .leftJoin(schema.productCategories, eq(schema.productCategories.id, schema.products.categoryId))
    .leftJoin(schema.mitras, eq(schema.mitras.id, schema.products.mitraId))
    .where(and(
      eq(schema.products.slug, productSlug),
      eq(schema.products.status, "active"),
    ))
    .limit(1);

  if (!row) notFound();

  // Pastikan mitra aktif (seller_type=mitra harus ada di mitras table)
  if (row.sellerType === "mitra" && !row.mitraId) notFound();

  // ── businessName cross-schema ─────────────────────────────────────────────
  let businessName: string | null = null;
  if (row.mitraId) {
    const [mitra] = await tenantDb
      .select({ businessId: schema.mitras.businessId })
      .from(schema.mitras)
      .where(eq(schema.mitras.id, row.mitraId))
      .limit(1);
    if (mitra) {
      const [biz] = await db
        .select({ name: memberBusinesses.name, brand: memberBusinesses.brand })
        .from(memberBusinesses)
        .where(eq(memberBusinesses.id, mitra.businessId))
        .limit(1);
      businessName = biz ? (biz.brand ?? biz.name) : null;
    }
  }

  // ── Variasi (jika variable product) ──────────────────────────────────────
  const isVariable = row.productType === "variable";
  let variations: ProductVariationData[] = [];

  if (isVariable) {
    const vrows = await tenantDb
      .select({
        id:             schema.productVariations.id,
        sku:            schema.productVariations.sku,
        price:          schema.productVariations.price,
        publicPrice:    schema.productVariations.publicPrice,
        memberPrice:    schema.productVariations.memberPrice,
        stock:          schema.productVariations.stock,
        images:         schema.productVariations.images,
        attributeCombo: schema.productVariations.attributeCombo,
        isActive:       schema.productVariations.isActive,
      })
      .from(schema.productVariations)
      .where(and(
        eq(schema.productVariations.productId, row.id),
        eq(schema.productVariations.isActive, true),
      ))
      .orderBy(schema.productVariations.createdAt);

    variations = vrows.map(v => ({
      id:             v.id,
      sku:            v.sku,
      price:          String(v.price),
      publicPrice:    v.publicPrice != null ? String(v.publicPrice) : null,
      memberPrice:    v.memberPrice != null ? String(v.memberPrice) : null,
      stock:          v.stock,
      images:         (Array.isArray(v.images) ? v.images : []) as ProductVariationData["images"],
      attributeCombo: (v.attributeCombo ?? {}) as Record<string, string>,
      isActive:       v.isActive,
    }));
  }

  // priceMin/priceMax untuk variable product
  let priceMin = String(row.price);
  let priceMax: string | null = null;
  if (isVariable && variations.length > 0) {
    const prices = variations.map(v => parseFloat(v.price));
    const minP   = Math.min(...prices);
    const maxP   = Math.max(...prices);
    priceMin = String(minP);
    priceMax = maxP !== minP ? String(maxP) : null;
  }

  // ── Images produk → ViewerImage[] ────────────────────────────────────────
  const rawImages = Array.isArray(row.images) ? row.images as Array<{
    id: string; url: string; variants?: Record<string, string> | null; alt: string; order: number;
  }> : [];

  const productImages: ViewerImage[] = rawImages.map(img => ({
    id:       img.id,
    url:      img.url,
    variants: img.variants,
    alt:      img.alt,
  }));

  // ── ProductCardData untuk client component ────────────────────────────────
  const { coverUrl, coverVariants } = extractCover(row.images);
  const product: ProductCardData = {
    id:           row.id,
    name:         row.name,
    slug:         row.slug,
    description:  row.description,
    price:        String(row.price),
    publicPrice:  row.publicPrice != null ? String(row.publicPrice) : null,
    memberPrice:  row.memberPrice != null ? String(row.memberPrice) : null,
    productType:  (row.productType ?? "simple") as "simple" | "variable",
    priceMin,
    priceMax,
    coverUrl,
    coverVariants,
    categoryName: row.categoryName ?? null,
    sellerType:   (row.sellerType ?? "tenant") as "tenant" | "mitra",
    businessName,
    mitraId:      row.mitraId ?? null,
  };

  // ── attribute groups ──────────────────────────────────────────────────────
  const attrGroups: AttributeGroup[] = (row.attributeGroups ?? []) as AttributeGroup[];

  // ── Produk terkait ────────────────────────────────────────────────────────
  let relatedProducts: ProductCardData[] = [];
  if (row.categoryId) {
    const relRows = await tenantDb
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
      .where(and(
        eq(schema.products.status, "active"),
        eq(schema.products.categoryId, row.categoryId),
      ))
      .orderBy(desc(schema.products.createdAt))
      .limit(5);

    const relFiltered = relRows.filter(r => r.id !== row.id && (
      r.sellerType === "tenant" || (r.sellerType === "mitra" && r.mitraId != null)
    )).slice(0, 4);

    // priceMin/priceMax untuk variable related
    const relVariableIds = relFiltered.filter(r => r.productType === "variable").map(r => r.id);
    const relPriceMap = new Map<string, { min: string; max: string }>();
    if (relVariableIds.length > 0) {
      const ranges = await tenantDb
        .select({
          productId: schema.productVariations.productId,
          minPrice:  min(schema.productVariations.price),
          maxPrice:  max(schema.productVariations.price),
        })
        .from(schema.productVariations)
        .where(and(
          inArray(schema.productVariations.productId, relVariableIds),
          eq(schema.productVariations.isActive, true),
        ))
        .groupBy(schema.productVariations.productId);
      ranges.forEach(r => {
        if (r.minPrice && r.maxPrice) relPriceMap.set(r.productId, { min: r.minPrice, max: r.maxPrice });
      });
    }

    relatedProducts = relFiltered.map(r => {
      const { coverUrl: cv, coverVariants: cvs } = extractCover(r.images);
      const isVar  = r.productType === "variable";
      const range  = isVar ? relPriceMap.get(r.id) : null;
      return {
        id:           r.id,
        name:         r.name,
        slug:         r.slug,
        description:  r.description,
        price:        String(r.price),
        publicPrice:  r.publicPrice != null ? String(r.publicPrice) : null,
        memberPrice:  r.memberPrice != null ? String(r.memberPrice) : null,
        productType:  (r.productType ?? "simple") as "simple" | "variable",
        priceMin:     range?.min ?? String(r.price),
        priceMax:     range && range.max !== range.min ? range.max : null,
        coverUrl:     cv,
        coverVariants: cvs,
        categoryName: r.categoryName ?? null,
        sellerType:   (r.sellerType ?? "tenant") as "tenant" | "mitra",
        businessName: null,
        mitraId:      r.mitraId ?? null,
      };
    });
  }

  return (
    <div className="py-10 px-4">
      <div className="max-w-7xl mx-auto space-y-12">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <a href={`/${slug}/produk`} className="hover:text-foreground transition-colors">Produk</a>
          {row.categoryName && row.categorySlug && (
            <>
              <ChevronRight className="h-3.5 w-3.5" />
              <a href={`/${slug}/produk/kategori/${row.categorySlug}`} className="hover:text-foreground transition-colors">
                {row.categoryName}
              </a>
            </>
          )}
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium line-clamp-1">{row.name}</span>
        </nav>

        {/* Main: gallery + info */}
        <ProductDetailClient
          product={product}
          variations={variations}
          attrGroups={attrGroups}
          productImages={productImages}
          sessionType={sessionType}
          tenantSlug={slug}
        />

        {/* Deskripsi */}
        {row.description && (
          <section>
            <h2 className="text-lg font-semibold mb-4 pb-2 border-b border-border">Deskripsi Produk</h2>
            <div
              className="prose prose-sm max-w-none [&_p]:my-3 [&_ul]:my-3 [&_ol]:my-3 [&_h2]:mt-6 [&_h2]:mb-3 [&_h3]:mt-5 [&_h3]:mb-2"
              dangerouslySetInnerHTML={{ __html: renderBody(row.description) }}
            />
          </section>
        )}

        {/* Produk terkait */}
        {relatedProducts.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-4 pb-2 border-b border-border">Produk Lainnya</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {relatedProducts.map(p => (
                <ProductCard key={p.id} product={p} variant="grid" tenantSlug={slug} sessionType={sessionType} />
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
