// Daftar produk milik produsen yang login — BACA-SAJA (tanpa tombol/aksi tulis). Doc: docs/arsitektur-portal-produsen.md § 7.
// Hanya produk dengan producer_id = produsen dari SESI (bukan dari URL) dan produk tenant (bukan mitra).
import { redirect } from "next/navigation";
import Link from "next/link";
import { and, count, desc, eq, ilike, inArray, isNull } from "drizzle-orm";
import { Package } from "lucide-react";
import { createTenantDb, mergeVariationPrices, publicSellingPrice, minMax } from "@jalajogja/db";
import { getProducerAccess } from "@/lib/producer-access.server";
import { escapeLike } from "@/lib/escape-like";

const PAGE_SIZE = 20;
const STATUSES = ["active", "draft", "archived"] as const;
const STATUS_LABEL: Record<string, string> = { active: "Aktif", draft: "Draft", archived: "Diarsipkan" };
const STATUS_COLOR: Record<string, string> = {
  draft: "bg-muted text-muted-foreground", active: "bg-green-100 text-green-700", archived: "bg-orange-100 text-orange-700",
};

const rupiah = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n || 0);
const rangeLabel = (r: { min: number; max: number } | null, fallback: number) =>
  !r ? rupiah(fallback) : r.min === r.max ? rupiah(r.min) : `${rupiah(r.min)} – ${rupiah(r.max)}`;
const toNum = (v: unknown) => { const n = parseFloat(String(v ?? "")); return Number.isFinite(n) ? n : 0; };

function firstImage(images: unknown): string | null {
  if (!Array.isArray(images) || images.length === 0) return null;
  const first = images[0] as { url?: string; variants?: Record<string, string> | null };
  return first?.variants?.square ?? first?.url ?? null;
}

export default async function ProducerProductsPage({
  params, searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { tenant: slug } = await params;
  const { q, status, page } = await searchParams;

  const access = await getProducerAccess(slug);
  if (!access) redirect("/no-tenant-access");

  const { db, schema } = createTenantDb(access.tenant.slug);
  // Dibatasi: angka sangat besar membuat OFFSET melebihi bigint → 500
  const currentPage = Math.min(10_000, Math.max(1, parseInt(page ?? "1") || 1));
  const statusFilter = STATUSES.find((s) => s === status) ?? null;
  const query = (q ?? "").trim().slice(0, 80);

  const where = and(
    eq(schema.products.producerId, access.producer.id), // dari SESI, bukan dari URL
    isNull(schema.products.mitraId),
    statusFilter ? eq(schema.products.status, statusFilter) : undefined,
    query ? ilike(schema.products.name, `%${escapeLike(query)}%`) : undefined,
  );

  const [rows, [{ total }]] = await Promise.all([
    db.select({
      id: schema.products.id, name: schema.products.name, sku: schema.products.sku, status: schema.products.status,
      productType: schema.products.productType, stock: schema.products.stock,
      price: schema.products.price, publicPrice: schema.products.publicPrice, memberPrice: schema.products.memberPrice,
      images: schema.products.images, updatedAt: schema.products.updatedAt,
    }).from(schema.products).where(where).orderBy(desc(schema.products.updatedAt)).limit(PAGE_SIZE).offset((currentPage - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(schema.products).where(where),
  ]);

  // Produk bervariasi: harga = rentang variasi aktif, stok = jumlah stok variasi aktif (aturan project)
  const variableIds = rows.filter((r) => r.productType === "variable").map((r) => r.id);
  const variations = variableIds.length
    ? await db.select({
        productId: schema.productVariations.productId, price: schema.productVariations.price,
        publicPrice: schema.productVariations.publicPrice, stock: schema.productVariations.stock,
      }).from(schema.productVariations)
        .where(and(inArray(schema.productVariations.productId, variableIds), eq(schema.productVariations.isActive, true)))
    : [];

  const view = rows.map((p) => {
    if (p.productType !== "variable") {
      return { ...p, dasar: rupiah(toNum(p.price)), publik: rupiah(publicSellingPrice(p)), stok: p.stock };
    }
    const vs = variations.filter((v) => v.productId === p.id);
    const merged = vs.map((v) => mergeVariationPrices(p, v));
    return {
      ...p,
      dasar: rangeLabel(minMax(merged.map((m) => toNum(m.price))), toNum(p.price)),
      publik: rangeLabel(minMax(merged.map((m) => publicSellingPrice(m))), publicSellingPrice(p)),
      stok: vs.reduce((a, v) => a + v.stock, 0),
    };
  });

  const totalPages = Math.max(1, Math.ceil(Number(total) / PAGE_SIZE));
  const base = `/app/${slug}/portal-produsen/produk`;
  const href = (over: { status?: string | null; page?: number }) => {
    const sp = new URLSearchParams();
    const st = over.status === undefined ? statusFilter : over.status;
    if (st) sp.set("status", st);
    if (query) sp.set("q", query);
    if (over.page && over.page > 1) sp.set("page", String(over.page));
    const s = sp.toString();
    return s ? `${base}?${s}` : base;
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Produk Saya</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{Number(total)} produk · hanya untuk dilihat. Perubahan produk dilakukan oleh admin.</p>
      </div>

      <form action={base} method="get" className="flex flex-wrap items-center gap-2">
        <input name="q" defaultValue={query} placeholder="Cari nama produk…" className="h-9 w-full max-w-xs rounded-md border border-border bg-background px-3 text-sm" />
        {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
        <button type="submit" className="h-9 rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted">Cari</button>
        <div className="flex flex-wrap gap-1 ml-auto">
          {[{ v: null, l: "Semua" }, ...STATUSES.map((s) => ({ v: s as string | null, l: STATUS_LABEL[s] }))].map(({ v, l }) => (
            <Link key={l} href={href({ status: v })}
              className={`rounded-full border border-border px-3 py-1 text-xs ${statusFilter === v ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}>{l}</Link>
          ))}
        </div>
      </form>

      {view.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {query || statusFilter ? "Tidak ada produk yang cocok." : "Belum ada produk yang didaftarkan admin atas nama Anda."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr><th className="p-3">Produk</th><th className="p-3">Harga Dasar</th><th className="p-3">Harga Publik</th><th className="p-3">Stok</th><th className="p-3">Status</th></tr>
            </thead>
            <tbody>
              {view.map((p) => {
                const thumb = firstImage(p.images);
                return (
                  <tr key={p.id} className="border-t border-border hover:bg-muted/20">
                    <td className="p-3">
                      <Link href={`${base}/${p.id}`} className="flex items-center gap-3">
                        <span className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border bg-muted/30">
                          {thumb
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={thumb} alt={p.name} className="h-full w-full object-cover" />
                            : <span className="flex h-full w-full items-center justify-center text-muted-foreground/40"><Package className="h-5 w-5" /></span>}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium hover:underline">{p.name}</span>
                          {p.sku && <span className="block text-xs text-muted-foreground">SKU: {p.sku}</span>}
                          {p.productType === "variable" && <span className="block text-xs text-muted-foreground">Produk bervariasi</span>}
                        </span>
                      </Link>
                    </td>
                    <td className="p-3 whitespace-nowrap">{p.dasar}</td>
                    <td className="p-3 whitespace-nowrap">{p.publik}</td>
                    <td className="p-3">{p.stok}</td>
                    <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[p.status] ?? ""}`}>{STATUS_LABEL[p.status] ?? p.status}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Halaman {currentPage} dari {totalPages}</span>
          <div className="flex gap-2">
            {currentPage > 1 && <Link href={href({ page: currentPage - 1 })} className="rounded-md border border-border bg-card px-3 py-1.5 hover:bg-muted">← Sebelumnya</Link>}
            {currentPage < totalPages && <Link href={href({ page: currentPage + 1 })} className="rounded-md border border-border bg-card px-3 py-1.5 hover:bg-muted">Berikutnya →</Link>}
          </div>
        </div>
      )}
    </div>
  );
}
