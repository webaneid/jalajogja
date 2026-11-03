// Ubah produk (produsen). Kepemilikan dibuktikan di DATA (requireOwnedProduct) — produk lain/internal/mitra = 404.
// Produk yang sudah dipesan BEBAS diubah (K22); pesanan lama memakai harga saat checkout.
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { asc } from "drizzle-orm";
import { createTenantDb } from "@jalajogja/db";
import { getProducerPageAccess } from "@/lib/producer-access.server";
import { getProducerCommercials, requireOwnedProduct, type StoredProductImage } from "@/lib/producer-products.server";
import { ProducerProductForm } from "@/components/producer/producer-product-form";
import { updateProducerProductAction } from "../../actions";

export default async function EditProducerProductPage({ params }: { params: Promise<{ tenant: string; id: string }> }) {
  const { tenant: slug, id } = await params;
  const access = await getProducerPageAccess(slug);
  if (!access) redirect("/no-tenant-access");

  const tc = createTenantDb(access.tenant.slug);
  const [product, com, cats] = await Promise.all([
    requireOwnedProduct(tc, access.producer.id, id),
    getProducerCommercials(tc, access.producer.id),
    tc.db.select({ id: tc.schema.productCategories.id, name: tc.schema.productCategories.name }).from(tc.schema.productCategories).orderBy(asc(tc.schema.productCategories.name)),
  ]);
  if (!product) notFound();

  const back = `/app/${access.tenant.slug}/portal-produsen/produk/${product.id}`;
  const Notice = ({ children }: { children: React.ReactNode }) => (
    <div className="max-w-2xl space-y-3">
      <h1 className="text-xl font-semibold">Ubah Produk</h1>
      <p className="rounded-lg border border-border bg-card p-4 text-sm">{children}</p>
      <Link href={back} className="text-sm text-primary hover:underline">← Kembali</Link>
    </div>
  );
  if (!com || !com.isActive) return <Notice>Akun produsen Anda tidak aktif.</Notice>;
  if (com.sharePercent === null) return <Notice>Persentase bagi hasil Anda belum ditetapkan pengurus, jadi produk belum bisa diubah. Silakan hubungi pengurus.</Notice>;
  if (product.productType === "variable") return <Notice>Produk bervariasi belum bisa diubah dari portal. Silakan hubungi pengurus.</Notice>;

  const stored = (Array.isArray(product.images) ? product.images : []) as StoredProductImage[];
  const num = (v: unknown) => (v === null || v === undefined ? "" : String(Math.round(Number(v))));
  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Ubah Produk</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Perubahan langsung tampil di toko. Pesanan yang sudah masuk tetap memakai harga saat pembeli memesan.</p>
      </div>
      <ProducerProductForm
        slug={access.tenant.slug}
        categories={cats.map((c) => ({ value: c.id, label: c.name }))}
        sharePercent={com.sharePercent}
        submitLabel="Simpan Perubahan"
        backHref={back}
        onSubmit={updateProducerProductAction.bind(null, access.tenant.slug, product.id)}
        initial={{
          name: product.name, description: product.description ?? "", categoryId: product.categoryId,
          images: stored.map((i) => ({ id: i.id, url: i.url, thumb: i.variants?.square ?? i.url, alt: i.alt ?? "" })),
          publicPrice: num(product.publicPrice), memberPrice: num(product.memberPrice), stock: String(product.stock), weightGram: String(product.weightGram ?? ""),
        }}
      />
    </div>
  );
}
