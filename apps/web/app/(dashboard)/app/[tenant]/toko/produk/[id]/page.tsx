import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Pencil, Download, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveProductBuyers } from "@/lib/product-buyers.server";
import { resolveVariantPriceRanges } from "@/lib/product-variation-price.server";
import { ProductBuyerList } from "@/components/toko/product-buyer-list";

function formatRupiah(amount: number | string) {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n || 0);
}

const STATUS_COLORS: Record<string, string> = {
  draft:    "bg-muted text-muted-foreground",
  active:   "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200",
  archived: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200",
};

const STATUS_LABELS: Record<string, string> = {
  draft:    "Draft",
  active:   "Aktif",
  archived: "Diarsipkan",
};

function getFirstImage(images: unknown): string | null {
  if (!Array.isArray(images) || images.length === 0) return null;
  const first = images[0] as { url?: string; variants?: Record<string, string> | null };
  return first?.variants?.square ?? first?.url ?? null;
}

export default async function ProdukDetailPage({
  params,
}: {
  params: Promise<{ tenant: string; id: string }>;
}) {
  const { tenant: slug, id: productId } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/app/login");

  const tenantClient = createTenantDb(slug);

  const { product, rows } = await resolveProductBuyers(tenantClient, productId, { includeAll: true });
  if (!product) notFound();

  let priceLabel = formatRupiah(product.price);
  if (product.productType === "variable") {
    const ranges = await resolveVariantPriceRanges(tenantClient, [product.id]);
    const range = ranges.get(product.id);
    if (range) {
      priceLabel = range.min === range.max
        ? formatRupiah(range.min)
        : `${formatRupiah(range.min)} – ${formatRupiah(range.max)}`;
    }
  }

  const lunasCount    = rows.filter((r) => r.paymentStatusLabel === "Lunas").length;
  const sebagianCount = rows.filter((r) => r.paymentStatusLabel === "Sebagian").length;
  const belumCount    = rows.filter((r) => r.paymentStatusLabel === "Belum Bayar").length;
  const thumbUrl       = getFirstImage(product.images);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/app/${slug}/toko/produk`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Produk
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium truncate max-w-[200px]">{product.name}</span>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Info Produk */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div className="h-20 w-20 rounded-lg border border-border bg-muted/30 overflow-hidden shrink-0">
              {thumbUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumbUrl} alt={product.name} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-muted-foreground/30">
                  <Package className="h-8 w-8" />
                </div>
              )}
            </div>
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold">{product.name}</h1>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[product.status] ?? ""}`}>
                  {STATUS_LABELS[product.status] ?? product.status}
                </span>
              </div>
              {product.sku && (
                <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
              )}
              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{priceLabel}</span>
                <span>Stok: {product.stock}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link
              href={`/app/${slug}/toko/produk/${productId}/edit`}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Link>
          </div>
        </div>

        {/* Statistik ringkas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Pembelian", value: rows.length,     color: "text-foreground" },
            { label: "Lunas",           value: lunasCount,      color: "text-green-600"  },
            { label: "Sebagian",        value: sebagianCount,   color: "text-amber-600"  },
            { label: "Belum Bayar",     value: belumCount,      color: "text-red-600"    },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl border border-border bg-card p-4 space-y-1">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Daftar Pembeli */}
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-sm font-semibold">Daftar Pembeli</h2>
            <div className="flex items-center gap-1.5">
              <Button asChild variant="outline" size="sm" className="h-7 px-2 text-xs">
                <a href={`/api/products/${productId}/export-buyers?tenant=${slug}`}>
                  <Download className="h-3 w-3 mr-1" />
                  Export Pembeli (Sudah Bayar)
                </a>
              </Button>
              <Button asChild variant="outline" size="sm" className="h-7 px-2 text-xs">
                <a href={`/api/products/${productId}/export-buyers?tenant=${slug}&all=1`}>
                  <Download className="h-3 w-3 mr-1" />
                  Export Semua Pembeli
                </a>
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground -mt-1">
            &ldquo;Export Pembeli (Sudah Bayar)&rdquo; hanya invoice berstatus Lunas. &ldquo;Export Semua
            Pembeli&rdquo; menyertakan semua status termasuk yang belum bayar/dibatalkan.
          </p>
          <ProductBuyerList slug={slug} rows={rows} />
        </div>
      </main>
    </div>
  );
}
