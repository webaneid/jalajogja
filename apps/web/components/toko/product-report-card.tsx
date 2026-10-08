// Kartu "Laporan Produk" di halaman admin produk — keuntungan, uang masuk, ongkir TERPISAH + kesimpulan.
// Server component (tanpa interaksi). HANYA dirender untuk pengguna hasFullAccess(toko): memuat modal
// (rahasia bisnis). Definisi angka: docs/arsitektur-product.md § "Laporan Produk" + lib/product-report.ts.
import type { ProductReport } from "@/lib/product-report";

function rp(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n || 0);
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "good" | "bad" }) {
  const color = tone === "good" ? "text-green-600" : tone === "bad" ? "text-red-600" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-background p-3 space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground leading-snug">{hint}</p>}
    </div>
  );
}

export function ProductReportCard({ report, conclusion, exportHref }: {
  report:     ProductReport;
  conclusion: string[];
  exportHref: string;
}) {
  const tone = report.profit > 0 ? "good" : report.profit < 0 ? "bad" : undefined;
  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold">Laporan Produk</h2>
          <p className="text-xs text-muted-foreground">Dihitung dari pesanan yang sudah <b>lunas</b>.</p>
        </div>
        <a href={exportHref} className="text-xs font-medium text-primary hover:underline">Export Excel lengkap →</a>
      </div>

      {/* Inti: pendapatan − modal = keuntungan */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Pendapatan Produk" value={rp(report.revenue)} hint={report.discount > 0 ? `sudah dipotong voucher ${rp(report.discount)}` : "harga jual yang ditagih"} />
        <Stat label="Modal ke Produsen" value={rp(report.cost)} hint="Harga Dasar × jumlah terjual" />
        <Stat
          label="Keuntungan"
          value={rp(report.profit)}
          tone={tone}
          hint={report.marginPct != null ? `margin ${report.marginPct.toFixed(1)}%` : undefined}
        />
        <Stat label="Terjual" value={`${report.paidQty} unit`} hint={`${report.paidOrders} pesanan lunas`} />
      </div>

      {/* Dipisahkan: BUKAN bagian keuntungan */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Dicatat terpisah (bukan keuntungan)</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat
            label="Ongkos Kirim"
            value={rp(report.shipping)}
            hint={report.freeShippingSavings > 0 ? `diteruskan ke kurir · hemat gratis ongkir ${rp(report.freeShippingSavings)}` : "diteruskan ke kurir (ongkir invoice terkait)"}
          />
          <Stat label="Kode Unik Transfer" value={rp(report.uniqueCode)} hint="selisih Rp100–999 untuk identifikasi transfer" />
          <Stat label="Total Dibayar Client" value={rp(report.clientPaid)} hint="produk + ongkir + kode unik per invoice (bisa memuat produk lain di invoice yang sama)" />
          <Stat label="Belum Lunas (Piutang)" value={rp(report.receivable)} hint={`${report.receivableOrders} pesanan · belum dihitung`} />
        </div>
      </div>

      {/* Kesimpulan */}
      <div className="rounded-lg bg-muted/40 border border-border p-3 space-y-1">
        <p className="text-xs font-semibold">Kesimpulan</p>
        {conclusion.map((line, i) => (
          <p key={i} className="text-sm text-foreground/90 leading-relaxed">{line}</p>
        ))}
      </div>
    </section>
  );
}
