// Tambah produk (produsen). Produk langsung TAYANG (K21). Batas produk (K26) dicek di sini untuk tampilan dan ULANG di server saat simpan.
import { redirect } from "next/navigation";
import Link from "next/link";
import { asc } from "drizzle-orm";
import { createTenantDb } from "@jalajogja/db";
import { getProducerPageAccess } from "@/lib/producer-access.server";
import { getProducerCommercials, countOwnedProducts } from "@/lib/producer-products.server";
import { ProducerProductForm } from "@/components/producer/producer-product-form";
import { createProducerProductAction } from "../actions";

export default async function NewProducerProductPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const access = await getProducerPageAccess(slug);
  if (!access) redirect("/no-tenant-access");

  const tc = createTenantDb(access.tenant.slug);
  const [com, used, cats] = await Promise.all([
    getProducerCommercials(tc, access.producer.id),
    countOwnedProducts(tc, access.producer.id),
    tc.db.select({ id: tc.schema.productCategories.id, name: tc.schema.productCategories.name }).from(tc.schema.productCategories).orderBy(asc(tc.schema.productCategories.name)),
  ]);

  const back = `/app/${access.tenant.slug}/portal-produsen/produk`;
  const Notice = ({ children }: { children: React.ReactNode }) => (
    <div className="max-w-2xl space-y-3">
      <h1 className="text-xl font-semibold">Tambah Produk</h1>
      <p className="rounded-lg border border-border bg-card p-4 text-sm">{children}</p>
      <Link href={back} className="text-sm text-primary hover:underline">← Kembali ke daftar produk</Link>
    </div>
  );

  if (!com || !com.isActive) return <Notice>Akun produsen Anda tidak aktif.</Notice>;
  if (com.sharePercent === null) return <Notice>Persentase bagi hasil Anda belum ditetapkan pengurus, jadi produk belum bisa ditambahkan. Silakan hubungi pengurus.</Notice>;
  if (used >= com.productLimit) return <Notice>Batas produk tercapai ({used}/{com.productLimit}). Produk yang diarsipkan tetap dihitung; hapus produk yang tidak diperlukan atau minta pengurus menaikkan batas Anda.</Notice>;

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Tambah Produk</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Produk langsung tayang di toko setelah disimpan. Slot terpakai: {used}/{com.productLimit}.</p>
      </div>
      <ProducerProductForm
        slug={access.tenant.slug}
        categories={cats.map((c) => ({ value: c.id, label: c.name }))}
        sharePercent={com.sharePercent}
        submitLabel="Simpan & Tayangkan"
        backHref={back}
        onSubmit={createProducerProductAction.bind(null, access.tenant.slug)}
      />
    </div>
  );
}
