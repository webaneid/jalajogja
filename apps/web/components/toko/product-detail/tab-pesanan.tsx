// Tab "Pesanan Masuk" — SATU tampilan untuk admin DAN produsen (keputusan user 2026-10-31: "tampilkan semuanya, tidak ada
// rahasia antara admin dan produsen" — tabel yang sama persis, edit sekali berlaku ke keduanya).
// Dua perbedaan teknis yang tak bisa sama: (1) tombol export hanya bila `canExport` (route export memakai getTenantAccess →
// akun produsen ditolak, jadi tombolnya akan error); (2) `linkInvoices`=false untuk produsen (halaman invoice admin bukan untuk produsen).
// Doc: docs/arsitektur-portal-produsen.md § 17.8.
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductBuyerList } from "@/components/toko/product-buyer-list";
import type { ProductBuyerRow } from "@/lib/product-buyers.server";

export function TabPesanan({ slug, productId, rows, canExport, linkInvoices }: {
  slug: string; productId: string; rows: ProductBuyerRow[]; canExport: boolean; linkInvoices: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-semibold">Daftar Pembeli</h2>
        {canExport && (
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
        )}
      </div>
      {canExport && (
        <p className="text-xs text-muted-foreground -mt-1">
          &ldquo;Export Pembeli (Sudah Bayar)&rdquo; hanya invoice berstatus Lunas. &ldquo;Export Semua
          Pembeli&rdquo; menyertakan semua status termasuk yang belum bayar/dibatalkan.
        </p>
      )}
      <ProductBuyerList slug={slug} rows={rows} linkInvoices={linkInvoices} />
    </div>
  );
}
