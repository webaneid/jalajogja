// Detail produk milik produsen — BACA-SAJA. Doc: docs/arsitektur-portal-produsen.md § 7.
// Produk dimuat dengan WHERE id = $1 AND producer_id = <produsen dari SESI> AND mitra_id IS NULL: id dari URL tidak
// dipercaya, produsen lain / produk internal / produk mitra → 404. Tidak ada pesanan, pembeli, atau laporan di sini.
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { and, asc, eq, isNull } from "drizzle-orm";
import { Package } from "lucide-react";
import { createTenantDb } from "@jalajogja/db";
import { getProducerAccess } from "@/lib/producer-access.server";
import { isValidUuid } from "@/lib/is-uuid";
import { renderBody } from "@/lib/letter-render";

const STATUS_LABEL: Record<string, string> = { active: "Aktif", draft: "Draft", archived: "Diarsipkan" };
const STATUS_COLOR: Record<string, string> = {
  draft: "bg-muted text-muted-foreground", active: "bg-green-100 text-green-700", archived: "bg-orange-100 text-orange-700",
};
const rupiah = (v: unknown) => {
  if (v == null || v === "") return "—";
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n) : "—";
};

type Img = { url?: string; alt?: string; variants?: Record<string, string> | null };

export default async function ProducerProductDetailPage({ params }: { params: Promise<{ tenant: string; id: string }> }) {
  const { tenant: slug, id } = await params;

  const access = await getProducerAccess(slug);
  if (!access) redirect("/no-tenant-access");
  if (!isValidUuid(id)) notFound();

  const { db, schema } = createTenantDb(access.tenant.slug);
  const [product] = await db.select({
    id: schema.products.id, name: schema.products.name, sku: schema.products.sku, description: schema.products.description,
    status: schema.products.status, productType: schema.products.productType, stock: schema.products.stock,
    price: schema.products.price, publicPrice: schema.products.publicPrice, memberPrice: schema.products.memberPrice,
    memberPriceTenantOnly: schema.products.memberPriceTenantOnly, weightGram: schema.products.weightGram,
    attributeGroups: schema.products.attributeGroups, images: schema.products.images, categoryId: schema.products.categoryId,
    createdAt: schema.products.createdAt, updatedAt: schema.products.updatedAt,
  }).from(schema.products)
    .where(and(eq(schema.products.id, id), eq(schema.products.producerId, access.producer.id), isNull(schema.products.mitraId)))
    .limit(1);
  if (!product) notFound();

  const [category] = product.categoryId
    ? await db.select({ name: schema.productCategories.name }).from(schema.productCategories).where(eq(schema.productCategories.id, product.categoryId)).limit(1)
    : [];

  // product.id sudah terverifikasi milik produsen ini di atas
  const variations = product.productType === "variable"
    ? await db.select({
        id: schema.productVariations.id, sku: schema.productVariations.sku, attributeCombo: schema.productVariations.attributeCombo,
        price: schema.productVariations.price, publicPrice: schema.productVariations.publicPrice, memberPrice: schema.productVariations.memberPrice,
        stock: schema.productVariations.stock, weightGram: schema.productVariations.weightGram, isActive: schema.productVariations.isActive,
      }).from(schema.productVariations).where(eq(schema.productVariations.productId, product.id)).orderBy(asc(schema.productVariations.createdAt))
    : [];

  const images = (Array.isArray(product.images) ? product.images : []) as Img[];
  const totalStock = product.productType === "variable" ? variations.filter((v) => v.isActive).reduce((a, v) => a + v.stock, 0) : product.stock;
  const dt = (d: Date) => d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });

  const rows: [string, string][] = [
    ["Harga Dasar", rupiah(product.price)],
    ["Harga Publik", rupiah(product.publicPrice)],
    ["Harga Anggota", product.memberPrice != null ? `${rupiah(product.memberPrice)}${product.memberPriceTenantOnly ? " (khusus anggota tenant ini)" : " (semua anggota IKPM)"}` : "—"],
    ["Stok", String(totalStock)],
    ["Berat", product.weightGram ? `${product.weightGram} gram` : "—"],
    ["Kategori", category?.name ?? "—"],
    ["Tipe", product.productType === "variable" ? "Bervariasi" : "Biasa"],
    ["Diperbarui", dt(product.updatedAt)],
  ];

  return (
    <div className="space-y-6">
      <Link href={`/app/${slug}/portal-produsen/produk`} className="text-sm text-muted-foreground hover:text-foreground">← Produk Saya</Link>

      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold">{product.name}</h1>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[product.status] ?? ""}`}>{STATUS_LABEL[product.status] ?? product.status}</span>
        {product.sku && <span className="text-xs text-muted-foreground">SKU: {product.sku}</span>}
      </div>
      <p className="text-xs text-muted-foreground -mt-4">Hanya untuk dilihat. Perubahan produk dilakukan oleh admin.</p>

      <div className="grid gap-6 md:grid-cols-[320px_1fr]">
        <div className="grid grid-cols-3 gap-2 md:grid-cols-2 content-start">
          {images.length === 0 ? (
            <div className="col-span-full flex aspect-square items-center justify-center rounded-lg border border-border bg-muted/30 text-muted-foreground/40"><Package className="h-10 w-10" /></div>
          ) : images.map((img, i) => {
            const src = img.variants?.["square-large"] ?? img.variants?.square ?? img.url;
            return src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={src} alt={img.alt || product.name} className={`w-full rounded-lg border border-border object-cover aspect-square ${i === 0 ? "col-span-full" : ""}`} />
            ) : null;
          })}
        </div>

        <div className="space-y-6">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-lg border border-border bg-card p-4 text-sm sm:grid-cols-2">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-border/50 py-1 last:border-0 sm:[&:nth-last-child(2)]:border-0">
                <dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v}</dd>
              </div>
            ))}
          </dl>

          {product.description && (
            <section>
              <h2 className="mb-2 text-sm font-semibold">Deskripsi</h2>
              <div className="prose prose-sm max-w-none rounded-lg border border-border bg-card p-4"
                dangerouslySetInnerHTML={{ __html: renderBody(product.description, {
                  imageBaseUrl: `${process.env.MINIO_PUBLIC_URL ?? "https://minio.jalakarta.com"}/tenant-${access.tenant.slug}`,
                  tenantSlug: access.tenant.slug,
                  baseUrl: `/${access.tenant.slug}`,
                }) }} />
            </section>
          )}

          {variations.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold">Variasi ({variations.length})</h2>
              <div className="overflow-x-auto rounded-lg border border-border bg-card">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                    <tr><th className="p-3">Variasi</th><th className="p-3">SKU</th><th className="p-3">Harga Dasar</th><th className="p-3">Harga Publik</th><th className="p-3">Stok</th><th className="p-3">Status</th></tr>
                  </thead>
                  <tbody>
                    {variations.map((v) => (
                      <tr key={v.id} className={`border-t border-border ${v.isActive ? "" : "opacity-60"}`}>
                        <td className="p-3">{Object.values(v.attributeCombo ?? {}).join(" / ") || "—"}</td>
                        <td className="p-3">{v.sku ?? "—"}</td>
                        <td className="p-3 whitespace-nowrap">{v.price != null ? rupiah(v.price) : "ikut produk"}</td>
                        <td className="p-3 whitespace-nowrap">{v.publicPrice != null ? rupiah(v.publicPrice) : "ikut produk"}</td>
                        <td className="p-3">{v.stock}</td>
                        <td className="p-3">{v.isActive ? "Aktif" : "Nonaktif"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
