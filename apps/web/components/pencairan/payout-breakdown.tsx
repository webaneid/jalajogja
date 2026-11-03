// Rincian pencairan yang mudah dipahami: tiap angka punya nama dan penjelasan. Dipakai portal produsen DAN halaman admin (satu komponen).
import { rupiah, rupiahSigned } from "@/lib/rupiah";

export type BreakdownLine = { key: string; label: string; productAmount: number; shippingAmount: number; adjustmentAmount: number; total: number };
export type BreakdownSummary = {
  creditsTotal: number; debtTotal: number; adjustmentTotal: number; subtotal: number;
  transferFee: number | null;          // null = belum ditetapkan
  feeIsEstimate?: boolean;
  netAmount: number | null;
};

function Row({ label, hint, value, tone, strong }: { label: string; hint?: string; value: string; tone?: "minus" | "plus" | "total"; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p className={`text-sm ${strong ? "font-semibold" : "font-medium"}`}>{label}</p>
        {hint && <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{hint}</p>}
      </div>
      <p className={`shrink-0 text-sm tabular-nums ${strong ? "text-base font-semibold" : "font-medium"} ${tone === "minus" ? "text-rose-600" : tone === "plus" ? "text-emerald-600" : ""}`}>{value}</p>
    </div>
  );
}

export function PayoutBreakdown({ lines, summary, emptyText }: { lines: BreakdownLine[]; summary: BreakdownSummary; emptyText?: string }) {
  const shipmentLines = lines.filter((l) => l.adjustmentAmount === 0);
  const adjustLines = lines.filter((l) => l.adjustmentAmount !== 0);
  return (
    <div className="space-y-4">
      {/* Per pengiriman */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border bg-muted/40 px-4 py-2.5">
          <p className="text-sm font-semibold">Rincian per pengiriman</p>
          <p className="text-xs text-muted-foreground">Hak Anda dari tiap pesanan: bagian produk (setelah bagi hasil) ditambah ongkir yang dibayar pembeli.</p>
        </div>
        {shipmentLines.length === 0 && adjustLines.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">{emptyText ?? "Belum ada pengiriman."}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr><th className="px-4 py-2 font-medium">Pesanan</th><th className="px-2 py-2 text-right font-medium">Bagian produk</th><th className="px-2 py-2 text-right font-medium">Ongkir</th><th className="px-4 py-2 text-right font-medium">Total</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {shipmentLines.map((l) => (
                  <tr key={l.key}>
                    <td className="px-4 py-2.5 font-mono text-xs">{l.label}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{rupiah(l.productAmount)}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{rupiah(l.shippingAmount)}</td>
                    <td className="px-4 py-2.5 text-right font-medium tabular-nums">{rupiah(l.total)}</td>
                  </tr>
                ))}
                {adjustLines.map((l) => (
                  <tr key={l.key} className="bg-muted/20">
                    <td className="px-4 py-2.5 text-xs" colSpan={3}>{l.label}</td>
                    <td className={`px-4 py-2.5 text-right font-medium tabular-nums ${l.adjustmentAmount < 0 ? "text-rose-600" : "text-emerald-600"}`}>{rupiahSigned(l.adjustmentAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ringkasan: dari hak sampai uang yang diterima */}
      <div className="rounded-xl border border-border bg-card px-4 py-1">
        <div className="divide-y divide-border">
          <Row label="Total hak dari pesanan" hint="Jumlah semua pengiriman di atas (produk + ongkir)." value={rupiah(summary.creditsTotal)} />
          {summary.debtTotal > 0 && <Row label="Potongan refund" hint="Pesanan yang dikembalikan ke pembeli dan menjadi tanggungan Anda; dipotong dari pencairan ini." value={`−${rupiah(summary.debtTotal)}`} tone="minus" />}
          {summary.adjustmentTotal > 0 && <Row label="Pelunasan hutang (transfer Anda)" hint="Pembayaran hutang refund yang sudah Anda transfer ke tenant." value={`+${rupiah(summary.adjustmentTotal)}`} tone="plus" />}
          <Row label="Jumlah pencairan" hint="Dana yang dicairkan sebelum biaya transfer." value={rupiah(summary.subtotal)} strong />
          <Row
            label={summary.feeIsEstimate ? "Biaya transfer (perkiraan)" : "Biaya transfer"}
            hint={summary.feeIsEstimate ? "Ditanggung produsen, dipotong dari pencairan. Sesama bank biasanya gratis; beda bank dikenakan biaya. Angka pasti ditetapkan saat transfer." : "Ditanggung produsen, dipotong dari pencairan (biaya bank saat transfer)."}
            value={summary.transferFee === null ? "—" : `−${rupiah(summary.transferFee)}`} tone={summary.transferFee ? "minus" : undefined}
          />
          <Row label={summary.netAmount === null || summary.feeIsEstimate ? "Perkiraan diterima di rekening" : "Diterima di rekening"} value={summary.netAmount === null ? "—" : rupiah(summary.netAmount)} strong />
        </div>
      </div>
    </div>
  );
}
