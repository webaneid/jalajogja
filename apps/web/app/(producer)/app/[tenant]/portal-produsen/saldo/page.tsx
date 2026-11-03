// Saldo produsen — ringkasan + laporan per PENGIRIMAN (D12) yang bisa dibuka menjadi baris produk. HANYA BACA.
// producerId dari SESI (getProducerPageAccess, fail-closed T&C); semua query difilter produsen itu. docs/arsitektur-pencairan-produsen.md § 12.
import { redirect } from "next/navigation";
import { createTenantDb, getProducerBalance, listProducerShipments, AUTO_COMPLETE_DAYS, type ShipmentCredit } from "@jalajogja/db";
import { getProducerPageAccess } from "@/lib/producer-access.server";

const rp = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
const fmtDate = (d: Date | null) => d ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(d) : "—";
const SHIP_LABEL: Record<string, string> = { pending: "Menunggu", processing: "Diproses", packed: "Dikemas", shipped: "Dikirim", delivered: "Diterima" };

function state(c: ShipmentCredit): { label: string; cls: string; note?: string } {
  if (c.completedAt) return { label: "Bisa dicairkan", cls: "bg-green-100 text-green-700", note: c.completionSource === "buyer" ? "Dikonfirmasi pembeli" : `Otomatis (${AUTO_COMPLETE_DAYS} hari sejak dikirim)` };
  if (c.blocker === "persentase_tidak_tercatat") return { label: "Perlu ditinjau pengurus", cls: "bg-amber-100 text-amber-700", note: "Persentase bagi hasil pesanan ini belum tercatat — hubungi pengurus." };
  if (c.buyerConfirmedAt) return { label: "Segera dicairkan", cls: "bg-green-100 text-green-700", note: "Pembeli sudah mengonfirmasi" };
  const auto = c.shippedAt ? new Date(c.shippedAt.getTime() + AUTO_COMPLETE_DAYS * 86_400_000) : null;
  return { label: "Menunggu", cls: "bg-muted text-muted-foreground", note: auto ? `Selesai saat pembeli konfirmasi, paling lambat ${fmtDate(auto)}` : "Menunggu pengiriman" };
}

export default async function ProducerBalancePage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const access = await getProducerPageAccess(slug);
  if (!access) redirect("/no-tenant-access");

  const tc = createTenantDb(access.tenant.slug);
  const [balance, all] = await Promise.all([
    getProducerBalance(tc, access.producer.id),
    listProducerShipments(tc, access.producer.id, { limit: 50 }),
  ]);
  const shipments = all.filter((c) => c.blocker !== "belum_lunas");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Saldo</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Hak Anda dari pesanan yang sudah dibayar pembeli. Dana menjadi <b>bisa dicairkan</b> setelah pembeli mengonfirmasi barang diterima, atau otomatis {AUTO_COMPLETE_DAYS} hari setelah dikirim.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Menunggu konfirmasi</p><p className="mt-1 text-xl font-semibold tabular-nums">{rp(balance.waiting)}</p></div>
        <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Bisa dicairkan</p><p className="mt-1 text-xl font-semibold tabular-nums text-green-700">{rp(balance.available)}</p></div>
        <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Sudah dicairkan</p><p className="mt-1 text-xl font-semibold tabular-nums">{rp(balance.paid)}</p></div>
      </div>
      {balance.reviewCount > 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">{balance.reviewCount} pengiriman perlu ditinjau pengurus (persentase bagi hasil belum tercatat) dan belum dihitung.</p>
      )}
      <p className="text-xs"><a href={`/app/${access.tenant.slug}/portal-produsen/pencairan`} className="font-medium text-primary hover:underline">Ajukan pencairan →</a></p>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Laporan per pengiriman</h2>
        {shipments.length === 0 && <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Belum ada pesanan lunas.</p>}
        {shipments.map((c) => {
          const st = state(c);
          return (
            <details key={c.shippingLineId} className="group rounded-xl border border-border bg-card">
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-mono text-sm font-medium">{c.invoiceNumber ?? c.invoiceId.slice(0, 8)}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(c.createdAt)} · {SHIP_LABEL[c.status] ?? c.status}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${st.cls}`}>{st.label}</span>
                  <span className="text-sm font-semibold tabular-nums">{rp(c.total)}</span>
                </div>
              </summary>
              <div className="space-y-2 border-t border-border px-4 py-3 text-xs">
                {st.note && <p className="text-muted-foreground">{st.note}</p>}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px]">
                    <thead className="text-left text-muted-foreground"><tr>
                      <th className="py-1 font-medium">Produk</th><th className="py-1 text-right font-medium">Dibayar pembeli</th><th className="py-1 text-right font-medium">Bagian tenant</th><th className="py-1 text-right font-medium">Bagian Anda</th>
                    </tr></thead>
                    <tbody className="divide-y divide-border">
                      {c.lines.map((l) => (
                        <tr key={l.invoiceItemId}>
                          <td className="py-1.5 pr-2">{l.name} <span className="text-muted-foreground">×{l.quantity}</span>
                            {l.discount > 0 && <span className="block text-[11px] text-muted-foreground">Voucher {rp(l.discount)} ({l.fundedBy === "producer" ? "ditanggung Anda" : "ditanggung tenant"})</span>}</td>
                          <td className="py-1.5 text-right tabular-nums">{rp(l.base - l.discount)}</td>
                          <td className="py-1.5 text-right tabular-nums text-muted-foreground">{l.percent === null ? "—" : `${l.percent}%`}</td>
                          <td className="py-1.5 text-right font-medium tabular-nums">{l.percent === null ? "—" : rp(l.amount)}</td>
                        </tr>
                      ))}
                      <tr><td className="py-1.5">Ongkir dibayar pembeli (milik Anda)</td><td className="py-1.5 text-right tabular-nums">{rp(c.shippingAmount)}</td><td /><td className="py-1.5 text-right font-medium tabular-nums">{rp(c.shippingAmount)}</td></tr>
                      {c.freeShippingDiscount > 0 && (
                        <tr className="text-muted-foreground"><td className="py-1.5" colSpan={3}>Ongkir yang Anda tanggung (gratis ongkir, perkiraan)</td><td className="py-1.5 text-right tabular-nums">{rp(c.freeShippingDiscount)}</td></tr>
                      )}
                      <tr className="font-semibold"><td className="pt-2" colSpan={3}>Total hak Anda</td><td className="pt-2 text-right tabular-nums">{rp(c.total)}</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
