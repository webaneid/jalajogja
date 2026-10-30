// Halaman produk tunggal PRODUSEN — memakai komponen BERSAMA dengan admin (components/toko/product-detail/*), BACA-SAJA.
// Kepemilikan diverifikasi DI DATA: loadProductDetail(..., { ownerProducerId: <produsen dari SESI> }) → produk lain /
// internal / mitra → 404. resolveProductBuyers HANYA dipanggil setelah kepemilikan terbukti; hasilnya diproyeksikan allow-list
// (toProducerBuyerRows: pesanan Lunas saja, tanpa uang, tanpa alamat rumah profil) sebelum menyentuh komponen apa pun.
// Doc: docs/arsitektur-portal-produsen.md § 17.
import { redirect, notFound } from "next/navigation";
import { createTenantDb } from "@jalajogja/db";
import { getProducerAccess } from "@/lib/producer-access.server";
import { isValidUuid } from "@/lib/is-uuid";
import { loadProductDetail } from "@/lib/product-detail.server";
import { resolveProductBuyers } from "@/lib/product-buyers.server";
import { toProducerBuyerRows } from "@/lib/producer-buyers";
import { ProductDetailHeader } from "@/components/toko/product-detail/product-detail-header";
import { ProductDetailTabNav, productTabs, resolveActiveTab } from "@/components/toko/product-detail/product-detail-tabs";
import { TabRingkasan } from "@/components/toko/product-detail/tab-ringkasan";
import { TabPesanan } from "@/components/toko/product-detail/tab-pesanan";
import { TabDetail } from "@/components/toko/product-detail/tab-detail";

export default async function ProducerProductDetailPage({
  params, searchParams,
}: {
  params: Promise<{ tenant: string; id: string }>;
  searchParams: Promise<{ tab?: string; q?: string; p?: string }>;
}) {
  const { tenant: slug, id } = await params;
  const { tab, q, p } = await searchParams;

  const access = await getProducerAccess(slug);
  if (!access) redirect("/no-tenant-access");
  if (!isValidUuid(id)) notFound();

  const tenantClient = createTenantDb(access.tenant.slug);
  const detail = await loadProductDetail(tenantClient, id, { ownerProducerId: access.producer.id });
  if (!detail) notFound();

  // Kepemilikan terbukti di atas → aman memuat pembeli. Hanya pesanan lunas; proyeksi allow-list di server.
  const { rows: buyerRows } = await resolveProductBuyers(tenantClient, detail.id, { includeAll: false });
  const orders = toProducerBuyerRows(buyerRows);

  const tabs   = productTabs("producer");
  const active = resolveActiveTab(tab, tabs);
  const basePath = `/app/${slug}/portal-produsen/produk/${detail.id}`;

  return (
    <div className="space-y-6">
      <ProductDetailHeader product={detail} backHref={`/app/${slug}/portal-produsen/produk`} backLabel="Produk Saya" />
      <p className="text-xs text-muted-foreground -mt-4">Hanya untuk dilihat. Perubahan produk dilakukan oleh admin.</p>
      <ProductDetailTabNav basePath={basePath} tabs={tabs} active={active} />

      {active === "ringkasan" && (
        <TabRingkasan view="producer" counts={{
          total: orders.length, lunas: orders.length, sebagian: 0, belum: 0,
          unitLunas: orders.reduce((a, r) => a + r.quantity, 0), stock: detail.stock,
        }} />
      )}
      {active === "pesanan" && (
        <TabPesanan view="producer" basePath={basePath} rows={orders}
          q={(q ?? "").slice(0, 80)} page={Math.min(10_000, Math.max(1, parseInt(p ?? "1") || 1))} />
      )}
      {active === "detail" && <TabDetail product={detail} tenantSlug={access.tenant.slug} showCost />}
    </div>
  );
}
