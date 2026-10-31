// Halaman produk tunggal ADMIN — tampilan bertab memakai komponen BERSAMA dengan Portal Produsen
// (components/toko/product-detail/*; data: lib/product-detail.server.ts). Ubah tampilan di komponen bersama = berlaku di
// admin DAN produsen. Doc: docs/arsitektur-portal-produsen.md § 17.
import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect, notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { Pencil } from "lucide-react";
import Link from "next/link";
import { resolveProductBuyers } from "@/lib/product-buyers.server";
import { listProductOrders } from "@/lib/producer-orders.server";
import { loadProductDetail } from "@/lib/product-detail.server";
import { resolveProducers, resolveInternalProducer } from "@/lib/producer.server";
import { buildProductReport, buildProductConclusion } from "@/lib/product-report";
import { hasFullAccess } from "@/lib/permissions";
import { isValidUuid } from "@/lib/is-uuid";
import { ProductDetailHeader } from "@/components/toko/product-detail/product-detail-header";
import { ProductDetailTabNav, productTabs, resolveActiveTab } from "@/components/toko/product-detail/product-detail-tabs";
import { TabRingkasan } from "@/components/toko/product-detail/tab-ringkasan";
import { TabPesanan } from "@/components/toko/product-detail/tab-pesanan";
import { TabDetail } from "@/components/toko/product-detail/tab-detail";
import { TabLaporan } from "@/components/toko/product-detail/tab-laporan";
import { rupiah } from "@/components/toko/product-detail/format";

export default async function ProdukDetailPage({
  params, searchParams,
}: {
  params: Promise<{ tenant: string; id: string }>;
  searchParams: Promise<{ tab?: string; q?: string; page?: string }>;
}) {
  const { tenant: slug, id: productId } = await params;
  const { tab, q, page } = await searchParams;
  if (!isValidUuid(productId)) notFound();
  const access = await getTenantAccess(slug);
  if (!access) redirect("/app/login");

  const tenantClient = createTenantDb(slug);

  const [detail, buyers] = await Promise.all([
    loadProductDetail(tenantClient, productId),
    resolveProductBuyers(tenantClient, productId, { includeAll: true }),
  ]);
  if (!detail || !buyers.product) notFound();
  const rows = buyers.rows;

  // Laporan keuangan produk memuat MODAL (Harga Dasar) = rahasia bisnis → hanya hasFullAccess(toko).
  // Akses baca-saja tetap melihat Daftar Pembeli tapi tanpa modal/laba.
  const canSeeReport = hasFullAccess(access.tenantUser, "toko");
  const tabs   = productTabs("admin", { canSeeReport });
  const active = resolveActiveTab(tab, tabs);

  const counts = {
    total:     rows.length,
    lunas:     rows.filter((r) => r.paymentStatusLabel === "Lunas").length,
    sebagian:  rows.filter((r) => r.paymentStatusLabel === "Sebagian").length,
    belum:     rows.filter((r) => r.paymentStatusLabel === "Belum Bayar").length,
    unitLunas: rows.filter((r) => r.paymentStatusLabel === "Lunas").reduce((a, r) => a + r.quantity, 0),
    stock:     detail.stock,
  };

  // Tab Pesanan Masuk — tabel SAMA dengan menu Pesanan produsen (pesanan lunas produk ini). Produk sudah terbukti ada (loadProductDetail).
  let pesananTab: React.ReactNode = null;
  if (active === "pesanan") {
    const pageNum = Math.min(10_000, Math.max(1, parseInt(page ?? "1") || 1));
    const query = (q ?? "").trim().slice(0, 80);
    const { rows: orderRows, total } = await listProductOrders(tenantClient, productId, { q: query, page: pageNum, pageSize: 20 });
    pesananTab = (
      <TabPesanan slug={slug} productId={productId} rows={orderRows} total={total} page={pageNum} pageSize={20} q={query}
        basePath={`/app/${slug}/toko/produk/${productId}`} viewHref={(id) => `/app/${slug}/toko/pesanan/invoice/${id}`} canExport />
    );
  }

  // Tab Laporan & Produsen — dihitung HANYA bila tab itu aktif dan pengguna berhak
  let laporan: React.ReactNode = null;
  if (active === "laporan" && canSeeReport) {
    const report     = buildProductReport(rows);
    const conclusion = buildProductConclusion(report, rupiah);
    const producerTenant = { id: access.tenant.id, name: access.tenant.name, tenantType: access.tenant.tenantType };
    const [pRow] = await tenantClient.db
      .select({ producerId: tenantClient.schema.products.producerId, mitraId: tenantClient.schema.products.mitraId })
      .from(tenantClient.schema.products).where(eq(tenantClient.schema.products.id, productId)).limit(1);
    const producerView = pRow && !pRow.mitraId
      ? (pRow.producerId
          ? (await resolveProducers(tenantClient, producerTenant, [pRow.producerId])).get(pRow.producerId) ?? null
          : await resolveInternalProducer(tenantClient, producerTenant))
      : null;
    laporan = <TabLaporan slug={slug} producerView={producerView} report={report} conclusion={conclusion}
      exportHref={`/api/products/${productId}/export-buyers?tenant=${slug}&all=1`} />;
  }

  return (
    <div className="flex flex-col h-full">
      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        <ProductDetailHeader
          product={detail}
          backHref={`/app/${slug}/toko/produk`}
          backLabel="Produk"
          actions={
            <Link
              href={`/app/${slug}/toko/produk/${productId}/edit`}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Link>
          }
        />
        <ProductDetailTabNav basePath={`/app/${slug}/toko/produk/${productId}`} tabs={tabs} active={active} />

        {active === "ringkasan" && <TabRingkasan counts={counts} />}
        {active === "pesanan"   && pesananTab}
        {active === "detail"    && <TabDetail product={detail} tenantSlug={slug} showCost={canSeeReport} />}
        {active === "laporan"   && laporan}
      </main>
    </div>
  );
}
