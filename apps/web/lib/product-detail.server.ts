// Pemuat data "produk tunggal" — SATU sumber untuk halaman admin (/toko/produk/[id]) dan Portal Produsen
// (/portal-produsen/produk/[id]). Komponen tampilannya juga bersama: components/toko/product-detail/*.
// Doc: docs/arsitektur-portal-produsen.md § 17. Kolom di-select EKSPLISIT (bukan select() penuh).
//
// `ownerProducerId` (Portal Produsen): produk dimuat HANYA bila producer_id = produsen dari SESI dan bukan produk mitra —
// id produk dari URL tidak dipercaya. Tanpa opsi ini (admin) tidak ada batasan kepemilikan; pemanggil admin sudah
// menjaga akses lewat getTenantAccess.
import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { publicSellingPrice, type TenantDb } from "@jalajogja/db";
import { resolveVariantPriceRanges } from "@/lib/product-variation-price.server";

export type ProductImage = { url?: string; alt?: string; variants?: Record<string, string> | null };

export type ProductDetailData = {
  id:          string;
  name:        string;
  sku:         string | null;
  description: string | null;
  status:      string;
  productType: string;
  stock:       number;                 // produk bervariasi: jumlah stok variasi AKTIF (aturan project)
  price:       unknown;                // Harga Dasar (modal)
  publicPrice: unknown;
  memberPrice: unknown;
  memberPriceTenantOnly: boolean;
  weightGram:  number | null;
  images:      ProductImage[];
  categoryName: string | null;
  priceLabel:  string;                 // Harga Publik (rentang untuk produk bervariasi)
  createdAt:   Date;
  updatedAt:   Date;
  variations:  {
    id: string; sku: string | null; attributeCombo: Record<string, string>;
    price: unknown; publicPrice: unknown; memberPrice: unknown;
    stock: number; weightGram: number | null; isActive: boolean;
  }[];
};

const rupiah = (v: number | string) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format((typeof v === "string" ? parseFloat(v) : v) || 0);

export async function loadProductDetail(
  tenantClient: TenantDb,
  productId:    string,
  opts:         { ownerProducerId?: string } = {},
): Promise<ProductDetailData | null> {
  const { db, schema } = tenantClient;

  const [p] = await db.select({
    id: schema.products.id, name: schema.products.name, sku: schema.products.sku, description: schema.products.description,
    status: schema.products.status, productType: schema.products.productType, stock: schema.products.stock,
    price: schema.products.price, publicPrice: schema.products.publicPrice, memberPrice: schema.products.memberPrice,
    memberPriceTenantOnly: schema.products.memberPriceTenantOnly, weightGram: schema.products.weightGram,
    images: schema.products.images, categoryId: schema.products.categoryId,
    createdAt: schema.products.createdAt, updatedAt: schema.products.updatedAt,
  }).from(schema.products)
    .where(and(
      eq(schema.products.id, productId),
      ...(opts.ownerProducerId ? [eq(schema.products.producerId, opts.ownerProducerId), isNull(schema.products.mitraId)] : []),
    ))
    .limit(1);
  if (!p) return null;

  const [category] = p.categoryId
    ? await db.select({ name: schema.productCategories.name }).from(schema.productCategories).where(eq(schema.productCategories.id, p.categoryId)).limit(1)
    : [];

  // p.id sudah terverifikasi (kepemilikan bila ownerProducerId) — variasi dimuat berdasarkan id itu
  const variations = p.productType === "variable"
    ? await db.select({
        id: schema.productVariations.id, sku: schema.productVariations.sku, attributeCombo: schema.productVariations.attributeCombo,
        price: schema.productVariations.price, publicPrice: schema.productVariations.publicPrice, memberPrice: schema.productVariations.memberPrice,
        stock: schema.productVariations.stock, weightGram: schema.productVariations.weightGram, isActive: schema.productVariations.isActive,
      }).from(schema.productVariations).where(eq(schema.productVariations.productId, p.id)).orderBy(asc(schema.productVariations.createdAt))
    : [];

  let priceLabel = rupiah(publicSellingPrice(p));
  if (p.productType === "variable") {
    const range = (await resolveVariantPriceRanges(tenantClient, [p.id])).get(p.id);
    if (range) priceLabel = range.min === range.max ? rupiah(range.min) : `${rupiah(range.min)} – ${rupiah(range.max)}`;
  }

  return {
    id: p.id, name: p.name, sku: p.sku, description: p.description, status: p.status, productType: p.productType,
    stock: p.productType === "variable" ? variations.filter((v) => v.isActive).reduce((a, v) => a + v.stock, 0) : p.stock,
    price: p.price, publicPrice: p.publicPrice, memberPrice: p.memberPrice, memberPriceTenantOnly: p.memberPriceTenantOnly,
    weightGram: p.weightGram, images: (Array.isArray(p.images) ? p.images : []) as ProductImage[],
    categoryName: category?.name ?? null, priceLabel, createdAt: p.createdAt, updatedAt: p.updatedAt,
    variations: variations.map((v) => ({ ...v, attributeCombo: (v.attributeCombo ?? {}) as Record<string, string> })),
  };
}
