import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { sql, ilike, eq } from "drizzle-orm";
import Link from "next/link";
import { createProductDraftAction } from "../actions";
import { ProductListClient } from "@/components/toko/product-list-client";

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
};

const STATUS_COLOR: Record<string, string> = {
  draft:    "bg-zinc-100 text-zinc-600",
  active:   "bg-green-100 text-green-700",
  archived: "bg-orange-100 text-orange-600",
};

const PAGE_SIZE = 20;

export default async function ProdukPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { tenant: slug } = await params;
  const { q, status, page } = await searchParams;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const { db, schema } = createTenantDb(slug);
  const currentPage = Math.max(1, parseInt(page ?? "1"));
  const offset = (currentPage - 1) * PAGE_SIZE;

  const conditions = [];
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
        id:        schema.products.id,
        name:      schema.products.name,
        slug:      schema.products.slug,
        price:     schema.products.price,
        stock:     schema.products.stock,
        status:    schema.products.status,
        images:    schema.products.images,
        updatedAt: schema.products.updatedAt,
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
    if (overrides.page)             sp.set("page",   overrides.page);
    return `/${slug}/toko/produk?${sp.toString()}`;
  };

  const statuses = ["all", "active", "draft", "archived"];

  // Ambil thumbnail pertama dari JSONB images
  function getFirstImage(images: unknown): string | null {
    if (!Array.isArray(images) || images.length === 0) return null;
    return (images[0] as { url?: string })?.url ?? null;
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Produk</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{total} produk</p>
        </div>
        <ProductListClient slug={slug} createAction={createProductDraftAction} />
      </div>

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
      <form method="GET" action={`/${slug}/toko/produk`}>
        <div className="relative max-w-sm">
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Cari nama produk..."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {status && <input type="hidden" name="status" value={status} />}
        </div>
      </form>

      {/* Grid produk */}
      {rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-muted-foreground">Belum ada produk</p>
          <p className="text-xs text-muted-foreground mt-1">Klik &quot;Produk Baru&quot; untuk mulai.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {rows.map((product) => {
            const thumb = getFirstImage(product.images);
            return (
              <Link
                key={product.id}
                href={`/${slug}/toko/produk/${product.id}/edit`}
                className="group rounded-lg border border-border bg-card overflow-hidden hover:border-primary/50 transition-colors"
              >
                {/* Thumbnail */}
                <div className="aspect-square bg-muted/30 relative overflow-hidden">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumb}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                  )}
                  {/* Status badge */}
                  <span className={`absolute top-1.5 left-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[product.status] ?? ""}`}>
                    {STATUS_LABEL[product.status] ?? product.status}
                  </span>
                </div>

                {/* Info */}
                <div className="p-2.5">
                  <p className="text-sm font-medium truncate">{product.name}</p>
                  <p className="text-xs text-green-600 font-medium mt-0.5">{formatRupiah(product.price)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Stok: {product.stock}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}

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
