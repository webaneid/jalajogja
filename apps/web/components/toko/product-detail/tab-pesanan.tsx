// Tab "Pesanan Masuk" — daftar pembeli produk ini. Admin: tabel lengkap + export (ProductBuyerList, kolom uang).
// (Cabang produsen ditambahkan di fase T2.) Doc: docs/arsitektur-portal-produsen.md § 17.
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductBuyerList } from "@/components/toko/product-buyer-list";
import type { ProductBuyerRow } from "@/lib/product-buyers.server";

export function TabPesanan({ slug, productId, rows }: { slug: string; productId: string; rows: ProductBuyerRow[] }) {
  return (
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
  );
}
