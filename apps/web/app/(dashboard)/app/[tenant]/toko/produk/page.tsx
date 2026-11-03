import { createTenantDb, publicSellingPrice, getVariableProductStockTotals } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { sql, ilike } from "drizzle-orm";
import Link from "next/link";
import { ProductListClient } from "@/components/toko/product-list-client";
import { ProductTable, type ProductRow } from "@/components/toko/product-table-client";
import { resolveVariantPriceRanges } from "@/lib/product-variation-price.server";
import { hasFullAccess } from "@/lib/permissions";
import { resolveProducers, resolveInternalProducer } from "@/lib/producer.server";

function formatRupiah(amount: number | string) {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n || 0);
}

const STATUS_LABEL: Record<string, string> = {
  draft:    "Draft",
  active:   "Aktif",
  archived: "Diarsipkan",
  frozen:   "Dibekukan",
};

const PAGE_SIZE = 20;

export default async function ProdukPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ q?: string; status?: string; page?: string; owner?: string }>;
}) {
  const { tenant: slug } = await params;
  const { q, status, page, owner: ownerParam } = await searchParams;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/app/login");

  const tenantClient = createTenantDb(slug);
  const { db, schema } = tenantClient;
  const currentPage = Math.max(1, parseInt(page ?? "1"));
  const offset = (currentPage - 1) * PAGE_SIZE;

  // Filter pemilik (ADMIN-ONLY, sama seperti kolom Produsen): "tenant" = produk toko sendiri (tanpa produsen & bukan mitra),
  // "produsen" = produk milik produsen. Param di luar daftar putih diabaikan; pengguna tanpa akses penuh tak bisa memakainya.
  const canFilterOwner = hasFullAccess(access.tenantUser, "toko");
  const owner = canFilterOwner && (ownerParam === "tenant" || ownerParam === "produsen") ? ownerParam : "";

  const conditions = [];
  if (owner === "tenant")   conditions.push(sql`${schema.products.producerId} IS NULL AND ${schema.products.mitraId} IS NULL`);
  if (owner === "produsen") conditions.push(sql`${schema.products.producerId} IS NOT NULL`);
  if (status && status !== "all") {
    conditions.push(sql`${schema.products.status} = ${status}`);
  }
  if (q) {
    conditions.push(ilike(schema.products.name, `%${q}%`));
  }

  const whereClause = conditions.length > 0
    ? conditions.reduce((acc, c) => sql`${acc} AND ${c}`)
    : undefined;

  const [rows, countResult] = await Promise.all([
    db
      .select({
        id:          schema.products.id,
        name:        schema.products.name,
        slug:        schema.products.slug,
        sku:         schema.products.sku,
        price:       schema.products.price,
        publicPrice: schema.products.publicPrice,
        stock:       schema.products.stock,
        status:      schema.products.status,
        productType: schema.products.productType,
        producerId:  schema.products.producerId,
        mitraId:     schema.products.mitraId,
        images:      schema.products.images,
        updatedAt:   schema.products.updatedAt,
      })
      .from(schema.products)
      .where(whereClause)
      .orderBy(sql`${schema.products.updatedAt} DESC`)
      .limit(PAGE_SIZE)
      .offset(offset),
    db
      .select({ count: sql<string>`COUNT(*)` })
      .from(schema.products)
      .where(whereClause),
  ]);

  const total      = parseInt(String(countResult[0]?.count ?? 0));
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const buildUrl = (overrides: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    if (overrides.q      ?? q)      sp.set("q",      overrides.q      ?? q ?? "");
    if (overrides.status ?? status) sp.set("status", overrides.status ?? status ?? "");
    const ownerNext = "owner" in overrides ? overrides.owner : owner;
    if (ownerNext)                  sp.set("owner",  ownerNext);
    if (overrides.page)             sp.set("page",   overrides.page);
    return `/app/${slug}/toko/produk?${sp.toString()}`;
  };

  const statuses = ["all", "active", "draft", "archived", "frozen"];

  // Ambil thumbnail pertama dari JSONB images — pakai square (400×400) untuk grid admin
  function getFirstImage(images: unknown): string | null {
    if (!Array.isArray(images) || images.length === 0) return null;
    const first = images[0] as { url?: string; variants?: Record<string, string> | null };
    return first?.variants?.square ?? first?.url ?? null;
  }

  // Harga produk variasi tidak diwakili satu angka products.price — pakai rentang min–max
  // dari variasi aktif (COALESCE fallback ke harga induk sudah ditangani helper ini).
  const variableIds  = rows.filter((r) => r.productType === "variable").map((r) => r.id);
  const priceRanges  = await resolveVariantPriceRanges(tenantClient, variableIds);
  // Produk bervariasi: stok = jumlah stok variasi, stok utama diabaikan (docs/arsitektur-stok.md).
  const stockTotals  = await getVariableProductStockTotals(tenantClient.db, tenantClient.schema, variableIds);

  // Kolom "Produsen" — ADMIN-ONLY (hasFullAccess toko); produk mitra tidak punya produsen. Batch, tanpa N+1.
  // Pengguna tanpa akses penuh: produsenLabel null → kolom tidak dirender. docs/arsitektur-produsen.md § 7.4.
  const canSeeProducer = hasFullAccess(access.tenantUser, "toko");
  const producerNames = new Map<string, string>();
  let internalProducerName: string | null = null;
  if (canSeeProducer) {
    const ref = { id: access.tenant.id, name: access.tenant.name, tenantType: access.tenant.tenantType };
    const ids = [...new Set(rows.map((r) => r.producerId).filter((x): x is string => !!x))];
    const resolved = await resolveProducers(tenantClient, ref, ids);
    for (const [id, v] of resolved) producerNames.set(id, v.isActive ? v.name : `${v.name} (nonaktif)`);
    if (rows.some((r) => !r.producerId && !r.mitraId)) {
      internalProducerName = (await resolveInternalProducer(tenantClient, ref)).name;
    }
  }

  const tableRows: ProductRow[] = rows.map((product) => {
    const range = priceRanges.get(product.id);
    let priceLabel: string;
    if (range) {
      priceLabel = range.min === range.max
        ? formatRupiah(range.min)
        : `${formatRupiah(range.min)} – ${formatRupiah(range.max)}`;
    } else {
      priceLabel = formatRupiah(publicSellingPrice(product));
    }
    return {
      id:          product.id,
      name:        product.name,
      sku:         product.sku,
      thumbUrl:    getFirstImage(product.images),
      priceLabel,
      stock:       product.productType === "variable" ? (stockTotals.get(product.id) ?? 0) : product.stock,
      productType: product.productType,
      status:      product.status,
      producerLabel: !canSeeProducer || product.mitraId
        ? null
        : (product.producerId ? (producerNames.get(product.producerId) ?? "—") : internalProducerName),
    };
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Produk</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{total} produk</p>
        </div>
        <ProductListClient slug={slug} />
      </div>

      {/* Filter pemilik — admin saja */}
      {canFilterOwner && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Tampilkan:</span>
          {([["", "Semua produk"], ["tenant", "Hanya produk tenant"], ["produsen", "Hanya produk produsen"]] as const).map(([v, label]) => (
            <Link
              key={v}
              href={buildUrl({ owner: v, page: "1" })}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                owner === v ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      )}

      {/* Filter status */}
      <div className="flex flex-wrap gap-2">
        {statuses.map((s) => (
          <Link
            key={s}
            href={buildUrl({ status: s === "all" ? "" : s, page: "1" })}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              (s === "all" && !status) || status === s
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {s === "all" ? "Semua" : (STATUS_LABEL[s] ?? s)}
          </Link>
        ))}
      </div>

      {/* Search */}
      <form method="GET" action={`/app/${slug}/toko/produk`}>
        <div className="relative max-w-sm">
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Cari nama produk..."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {status && <input type="hidden" name="status" value={status} />}
          {owner && <input type="hidden" name="owner" value={owner} />}
        </div>
      </form>

      {/* Tabel produk */}
      <ProductTable slug={slug} products={tableRows} showProducer={canSeeProducer} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{total} produk</span>
          <div className="flex gap-2">
            {currentPage > 1 && (
              <Link href={buildUrl({ page: String(currentPage - 1) })} className="rounded border border-border px-3 py-1 hover:bg-muted/40">
                ← Sebelumnya
              </Link>
            )}
            <span className="rounded border border-border px-3 py-1 bg-muted/20">
              {currentPage} / {totalPages}
            </span>
            {currentPage < totalPages && (
              <Link href={buildUrl({ page: String(currentPage + 1) })} className="rounded border border-border px-3 py-1 hover:bg-muted/40">
                Berikutnya →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
