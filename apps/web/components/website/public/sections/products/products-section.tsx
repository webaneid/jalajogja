import { eq, desc, and, inArray, min, max } from "drizzle-orm";
import type { TenantDb } from "@jalajogja/db";
import type { ProductsSectionData, ProductsSectionDesignId } from "@/lib/products-section-designs";
import type { ProductCardData } from "@/lib/product-card-templates";
import { ProductsDesign1 } from "./products-design-1";
import { ProductsDesign2 } from "./products-design-2";
import { ProductsDesign3 } from "./products-design-3";

type Props = {
  data:         ProductsSectionData;
  variant:      ProductsSectionDesignId;
  tenantClient: TenantDb;
  tenantSlug:   string;
};

// Ambil cover pertama dari images JSONB
// images[0].url dan images[0].variants sudah berisi URL lengkap dari MediaPicker
// TIDAK perlu publicUrl() lagi — akan double URL jika dipanggil
function extractCover(
  images: unknown,
): { coverUrl: string | null; coverVariants: Record<string, string> | null } {
  if (!Array.isArray(images) || images.length === 0) return { coverUrl: null, coverVariants: null };
  const first = images[0] as { url?: string; variants?: Record<string, string> | null };
  const coverUrl = first.variants?.["square-large"] ?? first.url ?? null;
  return { coverUrl, coverVariants: first.variants ?? null };
}

async function fetchProducts(
  tenantClient: TenantDb,
  data: ProductsSectionData,
  tenantSlug: string,
): Promise<ProductCardData[]> {
  const { db, schema } = tenantClient;
  const count = data.count ?? 8;

  const clauses = [
    eq(schema.products.status, "active"),
    // Hanya produk tenant + mitra aktif
    ...(data.categoryId ? [eq(schema.products.categoryId, data.categoryId)] : []),
  ];

  const rows = await db
    .select({
      id:          schema.products.id,
      name:        schema.products.name,
      slug:        schema.products.slug,
      description: schema.products.description,
      price:       schema.products.price,
      publicPrice: schema.products.publicPrice,
      memberPrice: schema.products.memberPrice,
      productType: schema.products.productType,
      images:      schema.products.images,
      categoryId:  schema.products.categoryId,
      sellerType:  schema.products.sellerType,
      mitraId:     schema.products.mitraId,
      categoryName: schema.productCategories.name,
    })
    .from(schema.products)
    .leftJoin(schema.productCategories, eq(schema.productCategories.id, schema.products.categoryId))
    // JOIN mitras untuk filter mitra aktif
    .leftJoin(schema.mitras, eq(schema.mitras.id, schema.products.mitraId))
    .where(and(
      ...clauses,
      // Produk tenant selalu tampil; produk mitra hanya jika mitra aktif
      // SQL: seller_type = 'tenant' OR (seller_type = 'mitra' AND mitras.status = 'active')
    ))
    .orderBy(desc(schema.products.createdAt))
    .limit(count);

  // Filter aplikasi: mitra hanya jika aktif
  const filtered = rows.filter(r =>
    r.sellerType === "tenant" ||
    (r.sellerType === "mitra" && r.mitraId != null)
  );

  // Fetch businessName untuk produk mitra
  const mitraIds = [...new Set(filtered.filter(r => r.mitraId).map(r => r.mitraId!))] ;
  let businessMap = new Map<string, string>();
  if (mitraIds.length > 0) {
    const { db: db2, schema: schema2 } = tenantClient;
    const mitras = await db2
      .select({ id: schema2.mitras.id, businessId: schema2.mitras.businessId })
      .from(schema2.mitras)
      .where(inArray(schema2.mitras.id, mitraIds));

    // Fetch business names dari public.member_businesses via app-level
    // (tidak bisa JOIN cross-schema di Drizzle — gunakan aplikasi level)
    const { db: publicDb, memberBusinesses } = await import("@jalajogja/db");
    const bizIds = [...new Set(mitras.map(m => m.businessId))];
    if (bizIds.length > 0) {
      const bizRows = await publicDb
        .select({ id: memberBusinesses.id, name: memberBusinesses.name, brand: memberBusinesses.brand })
        .from(memberBusinesses)
        .where(inArray(memberBusinesses.id, bizIds));
      const bizById = new Map(bizRows.map(b => [b.id, b.brand ?? b.name]));
      mitras.forEach(m => businessMap.set(m.id, bizById.get(m.businessId) ?? ""));
    }
  }

  // Fetch priceMin/priceMax untuk variable product
  const variableIds = filtered.filter(r => r.productType === "variable").map(r => r.id);
  const priceRangeMap = new Map<string, { min: string; max: string }>();
  if (variableIds.length > 0) {
    const ranges = await db
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

  return filtered.map(r => {
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
}

export async function ProductsSection({ data, variant, tenantClient, tenantSlug }: Props) {
  const { db, schema } = tenantClient;

  // Resolve filter meta (nama kategori + href arsip)
  let sectionTitle = data.title || "Produk";
  let filterHref   = `/${tenantSlug}/produk`;

  if (data.categoryId) {
    const [cat] = await db
      .select({ name: schema.productCategories.name, slug: schema.productCategories.slug })
      .from(schema.productCategories)
      .where(eq(schema.productCategories.id, data.categoryId))
      .limit(1);
    if (cat) {
      if (!data.title) sectionTitle = cat.name;
      filterHref = `/${tenantSlug}/produk?category=${cat.slug}`;
    }
  }

  const products = await fetchProducts(tenantClient, data, tenantSlug);
  const props = { data, products, tenantSlug, sectionTitle, filterHref };

  switch (variant) {
    case "2": return <ProductsDesign2 {...props} />;
    case "3": return <ProductsDesign3 {...props} />;
    default:  return <ProductsDesign1 {...props} />;
  }
}
