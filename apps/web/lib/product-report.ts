// Ringkasan Laporan Produk (keuntungan, uang masuk, ongkir terpisah) dari baris Daftar Pembeli.
// MURNI (tanpa DB/server-only) supaya bisa diuji langsung. Definisi lengkap + alasan:
// docs/arsitektur-product.md § "Laporan Produk".
//
//   pendapatan produk = invoice_items.total (harga yang DITAGIH, sudah net voucher) — invoice LUNAS saja
//   modal             = unitCost × qty (snapshot saat transaksi; baris lama = modal saat ini, estimasi)
//   keuntungan        = pendapatan − modal            (ongkir & kode unik TIDAK ikut — bukan laba)
//   ongkir            = dijumlah SEKALI per (invoice, penjual): ongkir dicatat per grup, bukan per produk
//   kode unik         = dijumlah SEKALI per invoice
//   piutang           = bagian produk dari invoice Sebagian/Belum Bayar (tidak dihitung laba)
// Baris produk MITRA tidak ikut hitungan laba (harga mitra dibahas terpisah).
import type { ProductBuyerRow } from "@/lib/product-buyers.server";

export type ProductReport = {
  paidOrders:          number;   // jumlah invoice lunas (produk tenant)
  paidQty:             number;   // unit terjual (lunas)
  revenue:             number;   // pendapatan produk
  discount:            number;   // potongan voucher pada baris lunas (info; revenue SUDAH net)
  cost:                number;   // modal ke produsen
  profit:              number;
  marginPct:           number | null;
  costEstimateRows:    number;   // baris lunas yang modalnya estimasi (invoice lama tanpa snapshot)
  mitraRowsExcluded:   number;   // baris lunas produk mitra (tidak masuk laba)
  shipping:            number;   // ongkir invoice terkait (diteruskan ke kurir, bukan laba)
  freeShippingSavings: number;   // total "hemat gratis ongkir" (info saja)
  uniqueCode:          number;   // total kode unik invoice lunas
  clientPaid:          number;   // total dibayar client untuk invoice lunas (produk + ongkir + kode unik, bisa termasuk produk lain di invoice yang sama)
  receivable:          number;   // piutang bagian produk (Sebagian + Belum Bayar)
  receivableOrders:    number;
};

function uniqueSum<T>(rows: ProductBuyerRow[], key: (r: ProductBuyerRow) => string, value: (r: ProductBuyerRow) => number): number {
  const seen = new Set<string>();
  let sum = 0;
  for (const r of rows) {
    const k = key(r);
    if (seen.has(k)) continue;
    seen.add(k);
    sum += value(r);
  }
  return sum;
}

export function buildProductReport(rows: ProductBuyerRow[]): ProductReport {
  const lunas      = rows.filter((r) => r.paymentStatusLabel === "Lunas");
  const tenantPaid = lunas.filter((r) => r.sellerType === "tenant");
  const unpaid     = rows.filter((r) => r.paymentStatusLabel !== "Lunas" && r.sellerType === "tenant");

  const revenue  = tenantPaid.reduce((s, r) => s + r.lineTotal, 0);
  const discount = tenantPaid.reduce((s, r) => s + r.discountAmount, 0);
  const cost     = tenantPaid.reduce((s, r) => s + (r.unitCost ?? 0) * r.quantity, 0);
  const profit   = revenue - cost;

  return {
    paidOrders:          new Set(tenantPaid.map((r) => r.invoiceId)).size,
    paidQty:             tenantPaid.reduce((s, r) => s + r.quantity, 0),
    revenue,
    discount,
    cost,
    profit,
    marginPct:           revenue > 0 ? (profit / revenue) * 100 : null,
    costEstimateRows:    tenantPaid.filter((r) => r.costIsEstimate).length,
    mitraRowsExcluded:   lunas.length - tenantPaid.length,
    shipping:            uniqueSum(tenantPaid, (r) => r.invoiceKey, (r) => r.shippingCost),
    freeShippingSavings: uniqueSum(tenantPaid, (r) => r.invoiceKey, (r) => r.freeShippingDiscount),
    uniqueCode:          uniqueSum(tenantPaid, (r) => r.invoiceId, (r) => r.uniqueCode),
    clientPaid:          uniqueSum(tenantPaid, (r) => r.invoiceId, (r) => (typeof r.totalDibayarkan === "number" ? r.totalDibayarkan : 0)),
    receivable:          unpaid.reduce((s, r) => s + r.lineTotal, 0),
    receivableOrders:    new Set(unpaid.map((r) => r.invoiceId)).size,
  };
}

// Kalimat kesimpulan untuk admin (Bahasa Indonesia). `fmt` = pemformat rupiah dari pemanggil.
export function buildProductConclusion(r: ProductReport, fmt: (n: number) => string): string[] {
  if (r.paidOrders === 0) {
    const lines = ["Belum ada pesanan lunas untuk produk ini, jadi belum ada pendapatan maupun keuntungan yang bisa dihitung."];
    if (r.receivableOrders > 0) lines.push(`${r.receivableOrders} pesanan masih menunggu pembayaran (${fmt(r.receivable)}).`);
    return lines;
  }
  const margin = r.marginPct != null ? ` (${r.marginPct.toFixed(1)}%)` : "";
  const lines: string[] = [
    `Dari ${r.paidOrders} pesanan lunas (${r.paidQty} unit): pendapatan produk ${fmt(r.revenue)}, modal ke produsen ${fmt(r.cost)}, keuntungan ${fmt(r.profit)}${margin}.`,
  ];
  if (r.profit < 0) lines.push("Produk ini merugi: harga jual yang ditagih lebih rendah dari modal.");
  if (r.shipping > 0) lines.push(`Ongkos kirim ${fmt(r.shipping)} dicatat terpisah — uang yang diteruskan ke kurir, bukan bagian keuntungan.`);
  if (r.uniqueCode > 0) lines.push(`Kode unik transfer ${fmt(r.uniqueCode)} juga terpisah dari pendapatan produk.`);
  if (r.receivableOrders > 0) lines.push(`${r.receivableOrders} pesanan belum lunas (${fmt(r.receivable)}) belum dihitung sebagai pendapatan.`);
  if (r.costEstimateRows > 0) lines.push(`${r.costEstimateRows} baris memakai modal produk saat ini (estimasi) karena pesanannya dibuat sebelum modal disimpan per transaksi.`);
  if (r.mitraRowsExcluded > 0) lines.push(`${r.mitraRowsExcluded} baris produk mitra tidak ikut perhitungan keuntungan.`);
  return lines;
}
