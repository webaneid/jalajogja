// Tambah produk (produsen) — memakai ProductForm BERSAMA dengan admin (mode produsen, K31). Status bawaan Draft; produsen sendiri
// yang menayangkannya (K32). Batas produk (K26) dicek di sini untuk tampilan dan ULANG di server saat simpan.
import { redirect } from "next/navigation";
import Link from "next/link";
import { getProducerPageAccess } from "@/lib/producer-access.server";
import { getProducerCommercials, countOwnedProducts } from "@/lib/producer-products.server";
import { emptyProducerInitialData, loadProducerFormContext } from "@/lib/producer-product-form.server";
import { ProductForm } from "@/components/toko/product-form";
import { createProducerProductAction } from "../actions";

export default async function NewProducerProductPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const access = await getProducerPageAccess(slug);
  if (!access) redirect("/no-tenant-access");

  const { tc, categories, originOptions } = await loadProducerFormContext(access.tenant.slug, access.producer.id);
  const [com, used] = await Promise.all([
    getProducerCommercials(tc, access.producer.id),
    countOwnedProducts(tc, access.producer.id),
  ]);

  const base = `/app/${access.tenant.slug}/portal-produsen/produk`;
  const Notice = ({ children }: { children: React.ReactNode }) => (
    <div className="max-w-2xl space-y-3">
      <h1 className="text-xl font-semibold">Tambah Produk</h1>
      <p className="rounded-lg border border-border bg-card p-4 text-sm">{children}</p>
      <Link href={base} className="text-sm text-primary hover:underline">← Kembali ke daftar produk</Link>
    </div>
  );

  if (!com || !com.isActive) return <Notice>Akun produsen Anda tidak aktif.</Notice>;
  if (com.sharePercent === null) return <Notice>Persentase bagi hasil Anda belum ditetapkan pengurus, jadi produk belum bisa ditambahkan. Silakan hubungi pengurus.</Notice>;
  if (used >= com.productLimit) return <Notice>Batas produk tercapai ({used}/{com.productLimit}). Produk yang diarsipkan tetap dihitung; hapus produk yang tidak diperlukan atau minta pengurus menaikkan batas Anda.</Notice>;

  return (
    // Form admin dirancang memenuhi area konten tanpa padding; portal punya padding sendiri → ditiadakan di sini.
    <div className="-m-4 h-[calc(100%+2rem)] md:-m-6 md:h-[calc(100%+3rem)]">
      <ProductForm
        slug={access.tenant.slug}
        tenantName={access.tenant.name}
        productId={null}
        initialData={emptyProducerInitialData(access.producer.id)}
        categories={categories}
        producerOptions={null}
        originOptions={originOptions}
        producer={{
          sharePercent: com.sharePercent,
          listHref: base,
          detailHref: base,
          onSave: createProducerProductAction.bind(null, access.tenant.slug),
        }}
      />
    </div>
  );
}
