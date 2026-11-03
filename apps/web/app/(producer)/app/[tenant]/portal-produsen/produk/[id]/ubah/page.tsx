// Ubah produk (produsen) — ProductForm BERSAMA dengan admin (mode produsen, K31). Kepemilikan dibuktikan di DATA (requireOwnedProduct):
// produk lain/internal/mitra = 404. Produk yang sudah dipesan BEBAS diubah (K22); pesanan lama memakai harga saat checkout.
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { getProducerPageAccess } from "@/lib/producer-access.server";
import { getProducerCommercials, requireOwnedProduct } from "@/lib/producer-products.server";
import { loadProducerFormContext, producerInitialData } from "@/lib/producer-product-form.server";
import { ProductForm } from "@/components/toko/product-form";
import { updateProducerProductAction, deleteProducerProductAction } from "../../actions";

export default async function EditProducerProductPage({ params }: { params: Promise<{ tenant: string; id: string }> }) {
  const { tenant: slug, id } = await params;
  const access = await getProducerPageAccess(slug);
  if (!access) redirect("/no-tenant-access");

  const { tc, categories, originOptions } = await loadProducerFormContext(access.tenant.slug, access.producer.id);
  const [product, com] = await Promise.all([
    requireOwnedProduct(tc, access.producer.id, id),
    getProducerCommercials(tc, access.producer.id),
  ]);
  if (!product) notFound();

  const base = `/app/${access.tenant.slug}/portal-produsen/produk`;
  const Notice = ({ children }: { children: React.ReactNode }) => (
    <div className="max-w-2xl space-y-3">
      <h1 className="text-xl font-semibold">Ubah Produk</h1>
      <p className="rounded-lg border border-border bg-card p-4 text-sm">{children}</p>
      <Link href={`${base}/${product.id}`} className="text-sm text-primary hover:underline">← Kembali</Link>
    </div>
  );
  if (!com || !com.isActive) return <Notice>Akun produsen Anda tidak aktif.</Notice>;
  if (com.sharePercent === null) return <Notice>Persentase bagi hasil Anda belum ditetapkan pengurus, jadi produk belum bisa diubah. Silakan hubungi pengurus.</Notice>;

  const variations = product.productType === "variable"
    ? await tc.db.select().from(tc.schema.productVariations).where(eq(tc.schema.productVariations.productId, product.id)).orderBy(tc.schema.productVariations.createdAt)
    : [];

  return (
    <div className="absolute inset-0">
      <ProductForm
        slug={access.tenant.slug}
        tenantName={access.tenant.name}
        productId={product.id}
        initialData={producerInitialData(product, variations)}
        categories={categories}
        producerOptions={null}
        originOptions={originOptions}
        producer={{
          sharePercent: com.sharePercent,
          listHref: base,
          detailHref: base,
          onSave: updateProducerProductAction.bind(null, access.tenant.slug, product.id),
          onDelete: deleteProducerProductAction.bind(null, access.tenant.slug, product.id),
        }}
      />
    </div>
  );
}
