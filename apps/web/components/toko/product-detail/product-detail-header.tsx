// Kepala halaman produk tunggal (foto kecil, nama, status, SKU, harga, stok) — dipakai admin & produsen.
// `actions` = slot tombol (admin: Edit). Produsen tidak memberi slot → baca-saja.
import Link from "next/link";
import { Package } from "lucide-react";
import type { ProductDetailData } from "@/lib/product-detail.server";
import { STATUS_COLORS, STATUS_LABELS, firstImageUrl } from "./format";

export function ProductDetailHeader({ product, backHref, backLabel, actions }: {
  product: ProductDetailData; backHref: string; backLabel: string; actions?: React.ReactNode;
}) {
  const thumb = firstImageUrl(product.images);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href={backHref} className="text-sm text-muted-foreground hover:text-foreground">← {backLabel}</Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium truncate max-w-[200px]">{product.name}</span>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <div className="h-20 w-20 rounded-lg border border-border bg-muted/30 overflow-hidden shrink-0">
            {thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumb} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-muted-foreground/30"><Package className="h-8 w-8" /></div>
            )}
          </div>
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold">{product.name}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[product.status] ?? ""}`}>
                {STATUS_LABELS[product.status] ?? product.status}
              </span>
            </div>
            {product.sku && <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>}
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{product.priceLabel}</span>
              <span>Stok: {product.stock}</span>
            </div>
          </div>
        </div>
        {actions && <div className="flex gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
