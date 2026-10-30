// Tab "Pesanan Masuk" — daftar pembeli produk ini, DUA cabang dalam satu komponen (edit sekali berlaku ke keduanya):
//  - admin   : tabel lengkap + export (ProductBuyerList, kolom uang)
//  - producer: kartu ringkas untuk PENGIRIMAN — hanya field allow-list (lib/producer-buyers.ts), pesanan Lunas saja, tanpa uang,
//              tanpa alamat rumah profil. BACA-SAJA (kirim paket/resi/label = upgrade berikutnya).
// Doc: docs/arsitektur-portal-produsen.md § 17.
import Link from "next/link";
import { Download, MapPin, MessageCircle, Package, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductBuyerList } from "@/components/toko/product-buyer-list";
import type { ProductBuyerRow } from "@/lib/product-buyers.server";
import type { ProducerBuyerRow } from "@/lib/producer-buyers";
import { displayPhone, toWaDigits } from "@/lib/phone";

const PAGE_SIZE = 20;

type AdminProps    = { view: "admin"; slug: string; productId: string; rows: ProductBuyerRow[] };
type ProducerProps = { view: "producer"; basePath: string; rows: ProducerBuyerRow[]; q: string; page: number };

export function TabPesanan(props: AdminProps | ProducerProps) {
  if (props.view === "admin") {
    const { slug, productId, rows } = props;
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

  // ── Produsen ────────────────────────────────────────────────────────────────────────────────
  const { basePath, rows, q, page } = props;
  const needle   = q.trim().toLowerCase();
  const filtered = needle
    ? rows.filter((r) => r.customerName.toLowerCase().includes(needle) || r.invoiceNumber.toLowerCase().includes(needle))
    : rows;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current    = Math.min(Math.max(1, page), totalPages);
  const slice      = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const href = (p: number) => {
    const sp = new URLSearchParams({ tab: "pesanan" });
    if (needle) sp.set("q", q.trim());
    if (p > 1) sp.set("p", String(p));
    return `${basePath}?${sp.toString()}`;
  };
  const fmtDate = (d: Date) => new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Pesanan Masuk (sudah dibayar)</h2>
        <p className="text-xs text-muted-foreground">Data pembeli hanya untuk keperluan pengiriman pesanan ini. Hanya pesanan yang sudah Lunas yang ditampilkan.</p>
      </div>

      <form action={basePath} method="get" className="flex gap-2">
        <input type="hidden" name="tab" value="pesanan" />
        <input name="q" defaultValue={q} placeholder="Cari nama pembeli atau nomor invoice…" className="h-9 w-full max-w-sm rounded-md border border-border bg-background px-3 text-sm" />
        <button type="submit" className="h-9 rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted">Cari</button>
      </form>

      {slice.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {needle ? "Tidak ada pesanan yang cocok." : "Belum ada pesanan yang sudah dibayar untuk produk ini."}
        </p>
      ) : (
        <ul className="space-y-3">
          {slice.map((r, i) => {
            const wa = r.customerPhone ? toWaDigits(r.customerPhone).replace(/\D/g, "") : "";
            return (
              <li key={`${r.invoiceNumber}-${i}`} className="rounded-xl border border-border bg-card p-4 space-y-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{r.invoiceNumber}</span>
                  <span className="text-xs text-muted-foreground">{fmtDate(r.createdAt)}</span>
                </div>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{r.customerName}</p>
                    {r.customerPhone ? (
                      <p className="flex items-center gap-1.5 text-muted-foreground">
                        <MessageCircle className="h-3.5 w-3.5 text-green-600" />
                        {wa
                          ? <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">{displayPhone(r.customerPhone)}</a>
                          : <span>{displayPhone(r.customerPhone)}</span>}
                      </p>
                    ) : <p className="text-muted-foreground">Nomor HP tidak tersedia</p>}
                  </div>
                  <div className="text-right">
                    <p className="flex items-center justify-end gap-1.5 font-medium"><Package className="h-4 w-4 text-muted-foreground" />{r.quantity} × {r.itemName}</p>
                    {r.variantLabel && <p className="text-xs text-muted-foreground">{r.variantLabel}</p>}
                  </div>
                </div>
                <div className="grid gap-1 border-t border-border pt-2 sm:grid-cols-2">
                  <p className="flex items-start gap-1.5"><Truck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span>{r.shippingLabel || "—"}</span></p>
                  <p className="flex items-start gap-1.5"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span>{r.address || "Alamat tidak tersedia (ambil sendiri)"}</span></p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Halaman {current} dari {totalPages} · {filtered.length} pesanan</span>
          <div className="flex gap-2">
            {current > 1 && <Link href={href(current - 1)} className="rounded-md border border-border bg-card px-3 py-1.5 hover:bg-muted">← Sebelumnya</Link>}
            {current < totalPages && <Link href={href(current + 1)} className="rounded-md border border-border bg-card px-3 py-1.5 hover:bg-muted">Berikutnya →</Link>}
          </div>
        </div>
      )}
    </div>
  );
}
