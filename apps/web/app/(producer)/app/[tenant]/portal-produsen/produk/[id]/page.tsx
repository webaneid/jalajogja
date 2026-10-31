// Halaman produk tunggal PRODUSEN — memakai komponen BERSAMA dengan admin (components/toko/product-detail/*), BACA-SAJA.
// Kepemilikan diverifikasi DI DATA: loadProductDetail(..., { ownerProducerId: <produsen dari SESI> }) → produk lain /
// internal / mitra → 404. resolveProductBuyers HANYA dipanggil setelah kepemilikan terbukti. Tabel pesanan SAMA dengan admin
// (keputusan user 2026-10-31); proyeksi allow-list lib/producer-buyers.ts disiapkan tetapi TIDAK dipakai sementara.
// Doc: docs/arsitektur-portal-produsen.md § 17.
import { redirect, notFound } from "next/navigation";
import { createTenantDb } from "@jalajogja/db";
import { getProducerAccess } from "@/lib/producer-access.server";
import { isValidUuid } from "@/lib/is-uuid";
import { loadProductDetail } from "@/lib/product-detail.server";
import { resolveProductBuyers } from "@/lib/product-buyers.server";
import { listProductOrders } from "@/lib/producer-orders.server";
import { ProductDetailHeader } from "@/components/toko/product-detail/product-detail-header";
import { ProductDetailTabNav, productTabs, resolveActiveTab } from "@/components/toko/product-detail/product-detail-tabs";
import { TabRingkasan } from "@/components/toko/product-detail/tab-ringkasan";
import { TabPesanan } from "@/components/toko/product-detail/tab-pesanan";
import { TabDetail } from "@/components/toko/product-detail/tab-detail";

export default async function ProducerProductDetailPage({
  params, searchParams,
}: {
  params: Promise<{ tenant: string; id: string }>;
  searchParams: Promise<{ tab?: string; q?: string; page?: string }>;
}) {
  const { tenant: slug, id } = await params;
  const { tab, q, page } = await searchParams;

  const access = await getProducerAccess(slug);
  if (!access) redirect("/no-tenant-access");
  if (!isValidUuid(id)) notFound();

  const tenantClient = createTenantDb(access.tenant.slug);
  const detail = await loadProductDetail(tenantClient, id, { ownerProducerId: access.producer.id });
  if (!detail) notFound();

  // Kepemilikan terbukti di atas → aman memuat pembeli. Keputusan user 2026-10-31: tabel SAMA dengan admin (semua kolom/status,
  // "tidak ada rahasia antara admin dan produsen"). Satu-satunya yang tetap dikosongkan: MODAL per baris (unitCost) — sama seperti
  // halaman admin yang mengosongkannya untuk semua pengguna sebelum data ke komponen client.
  const { rows } = await resolveProductBuyers(tenantClient, detail.id, { includeAll: true });
  const counts = {
    total:     rows.length,
    lunas:     rows.filter((r) => r.paymentStatusLabel === "Lunas").length,
    sebagian:  rows.filter((r) => r.paymentStatusLabel === "Sebagian").length,
    belum:     rows.filter((r) => r.paymentStatusLabel === "Belum Bayar").length,
    unitLunas: rows.filter((r) => r.paymentStatusLabel === "Lunas").reduce((a, r) => a + r.quantity, 0),
    stock:     detail.stock,
  };

  const tabs   = productTabs("producer");
  const active = resolveActiveTab(tab, tabs);
  const basePath = `/app/${slug}/portal-produsen/produk/${detail.id}`;

  // Tab Pesanan Masuk: tabel SAMA dengan menu Pesanan (pesanan lunas produk ini). Kepemilikan produk sudah terbukti di atas.
  const pageNum = Math.min(10_000, Math.max(1, parseInt(page ?? "1") || 1));
  const query = (q ?? "").trim().slice(0, 80);
  const { rows: orderRows, total: orderTotal } = active === "pesanan"
    ? await listProductOrders(tenantClient, detail.id, { q: query, page: pageNum, pageSize: 20 })
    : { rows: [], total: 0 };

  return (
    <div className="space-y-6">
      <ProductDetailHeader product={detail} backHref={`/app/${slug}/portal-produsen/produk`} backLabel="Produk Saya" />
      <p className="text-xs text-muted-foreground -mt-4">Hanya untuk dilihat. Perubahan produk dilakukan oleh admin.</p>
      <ProductDetailTabNav basePath={basePath} tabs={tabs} active={active} />

      {active === "ringkasan" && <TabRingkasan counts={counts} />}
      {active === "pesanan" && (
        <TabPesanan slug={slug} productId={detail.id} rows={orderRows} total={orderTotal} page={pageNum} pageSize={20} q={query}
          basePath={basePath} viewHref={(oid) => `/app/${slug}/portal-produsen/pesanan/${oid}`} canExport={false} />
      )}
      {active === "detail" && <TabDetail product={detail} tenantSlug={access.tenant.slug} showCost />}
    </div>
  );
}
