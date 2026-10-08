export const dynamic = "force-dynamic";
// GET /api/products/[id]/export-buyers?tenant={slug}&all=1
// Export daftar pembeli satu produk ke Excel. Kolom: No. Invoice, Nama Pembeli, Telepon,
// Jumlah, Varian/Ukuran, Harga Satuan, Subtotal, Diskon Voucher, Cara Pengiriman, Alamat
// Checkout, Alamat User, Ongkos Kirim, Status Pembayaran, Total Dibayarkan, Kode Voucher,
// Tanggal Pesan.
//
// "Alamat Checkout" — snapshot apa adanya dari transaksi ini (shippingAddress+shippingCityName).
// "Alamat User" — alamat tersimpan di profil member (kalau invoice ini terhubung ke member DAN
// nomor HP-nya terverifikasi cocok, lihat anti-abuse di lib/product-buyers.server.ts). Dua kolom
// terpisah SENGAJA (docs/arsitektur-product.md § "Susulan — Alamat Lengkap + Kode Pos + Ongkos
// Kirim") — admin lihat dua-duanya, bukan satu nilai gabungan yang menyembunyikan sumbernya.
// "Ongkos Kirim" selalu Rp 0 untuk ambil sendiri.
//
// Satu baris = satu invoice_item (satu kali produk ini dibeli dalam satu invoice) — bukan satu
// baris per pembeli, karena satu orang bisa membeli produk yang sama >1× di invoice berbeda,
// atau membeli >1 varian sekaligus dalam satu invoice.
//
// Filter — DUA MODE (persis pola export-participants event):
//   - Default (tanpa ?all=1): HANYA invoice.status === 'paid'.
//   - `?all=1`: SEMUA status (termasuk partial/pending/cancelled) — kolom "Status Pembayaran"
//     membedakan baris mana yang mana.
//
// "Diskon Voucher" = potongan voucher pada BARIS ini (invoice_items.discountAmount, bisa beda
// per baris kalau satu invoice punya banyak item — voucher Fase 1 memotong per-item, bukan
// invoice keseluruhan). "Kode Voucher" = invoices.voucherCode (satu voucher per invoice, sama
// untuk semua baris invoice yang sama) — kosong berarti tanpa voucher, persis pola export
// peserta event.
//
// LAPORAN PRODUK (2026-10-09, docs/arsitektur-product.md § "Laporan Produk"): kolom dipisah — Subtotal
// (tagihan produk), Harga Dasar/Unit + Total Modal (rahasia bisnis, hanya hasFullAccess toko), Uang Masuk
// Produk (hanya baris Lunas), Keuntungan (Lunas saja, hanya hasFullAccess), lalu Ongkos Kirim / Kode Unik /
// Total Dibayar Client. Tiga kolom TERAKHIR itu bernilai tingkat-INVOICE (ongkir: per invoice+penjual) dan
// HANYA diisi di baris pertama tiap invoice supaya penjumlahan kolom di Excel tidak dobel. Sheet "Ringkasan"
// (hanya hasFullAccess) memuat angka total + kesimpulan, identik dengan kartu di halaman produk.
//
// Query logic (resolveProductBuyers) dan status pembayaran dijamin identik dengan tabel
// "Daftar Pembeli" di halaman /toko/produk/[id] — satu fungsi shared, lihat
// lib/product-buyers.server.ts untuk detail arsitektur (termasuk kenapa itemId bisa berupa
// id variasi, bukan id produk induk).

import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { hasReadAccess, hasFullAccess } from "@/lib/permissions";
import { displayPhone } from "@/lib/phone";
import { resolveProductBuyers } from "@/lib/product-buyers.server";
import { buildProductReport, buildProductConclusion } from "@/lib/product-report";

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: productId } = await params;
  const slug = req.nextUrl.searchParams.get("tenant") ?? req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "Parameter tenant wajib diisi." }, { status: 400 });
  const includeAll = req.nextUrl.searchParams.get("all") === "1";

  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasReadAccess(access.tenantUser, "toko")) {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  const tenantClient = createTenantDb(slug);
  const { product, rows } = await resolveProductBuyers(tenantClient, productId, { includeAll });
  if (!product) return NextResponse.json({ error: "Produk tidak ditemukan." }, { status: 404 });

  if (rows.length === 0) {
    return NextResponse.json({
      error: includeAll
        ? "Belum ada yang membeli produk ini."
        : "Belum ada pembelian produk ini yang sudah lunas.",
    }, { status: 400 });
  }

  // Modal & keuntungan = rahasia bisnis → hanya pengguna dengan akses penuh modul toko.
  const includeCost = hasFullAccess(access.tenantUser, "toko");

  const headers = [
    "No. Invoice", "Nama Pembeli", "Telepon", "Jumlah", "Varian/Ukuran", "Harga Satuan",
    "Diskon Voucher", "Subtotal",
    ...(includeCost ? ["Harga Dasar/Unit (Modal)", "Total Modal"] : []),
    "Uang Masuk Produk (Lunas)",
    ...(includeCost ? ["Keuntungan (Lunas)", "Modal Estimasi"] : []),
    "Cara Pengiriman", "Alamat Checkout", "Alamat User",
    "Ongkos Kirim (per invoice)", "Kode Unik (per invoice)", "Total Dibayar Client (per invoice)",
    "Status Pembayaran", "Kode Voucher", "Tanggal Pesan",
  ];

  // Nilai tingkat-invoice hanya di baris pertama tiap invoice (ongkir: per invoice+penjual).
  const seenShipping = new Set<string>();
  const seenInvoice  = new Set<string>();

  const dataRows = rows.map((r) => {
    const firstShip    = !seenShipping.has(r.invoiceKey);
    const firstInvoice = !seenInvoice.has(r.invoiceId);
    seenShipping.add(r.invoiceKey);
    seenInvoice.add(r.invoiceId);

    const isPaid       = r.paymentStatusLabel === "Lunas";
    const costKnown    = r.sellerType === "tenant" && r.unitCost != null;
    const totalModal   = costKnown ? (r.unitCost as number) * r.quantity : "";
    const keuntungan   = isPaid && costKnown ? r.lineTotal - (r.unitCost as number) * r.quantity : "";

    return [
      r.invoiceNumber,
      r.customerName,
      r.customerPhone ? displayPhone(r.customerPhone) : "",
      r.quantity,
      r.variantLabel || "-",
      r.unitPrice,
      r.discountAmount > 0 ? r.discountAmount : "",
      r.lineTotal,
      ...(includeCost ? [costKnown ? r.unitCost : "", totalModal] : []),
      isPaid ? r.lineTotal : "",
      ...(includeCost ? [keuntungan, costKnown && r.costIsEstimate ? "Ya" : ""] : []),
      r.shippingLabel,
      r.checkoutAddress || "-",
      r.memberAddress || "-",
      firstShip ? r.shippingCost : "",
      firstInvoice ? (r.uniqueCode > 0 ? r.uniqueCode : "") : "",
      firstInvoice ? r.totalDibayarkan : "",
      r.paymentStatusLabel,
      r.voucherCode ?? "",
      fmtDate(r.createdAt),
    ];
  });

  const wb = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
  XLSX.utils.book_append_sheet(wb, sheet, "Pembeli");

  if (includeCost) {
    const rep = buildProductReport(rows);
    const rp  = (n: number) => "Rp" + Math.round(n).toLocaleString("id-ID");
    const summary: Array<Array<string | number>> = [
      ["Laporan Produk", product.name],
      ["Dihitung dari pesanan LUNAS (produk tenant)", ""],
      [],
      ["Pendapatan Produk", rep.revenue],
      ["Modal ke Produsen", rep.cost],
      ["Keuntungan", rep.profit],
      ["Margin (%)", rep.marginPct != null ? Number(rep.marginPct.toFixed(1)) : ""],
      ["Unit Terjual", rep.paidQty],
      ["Pesanan Lunas", rep.paidOrders],
      [],
      ["Dicatat terpisah (bukan keuntungan)", ""],
      ["Ongkos Kirim (diteruskan ke kurir)", rep.shipping],
      ["Hemat Gratis Ongkir (info)", rep.freeShippingSavings],
      ["Kode Unik Transfer", rep.uniqueCode],
      ["Total Dibayar Client (produk+ongkir+kode unik, per invoice)", rep.clientPaid],
      ["Belum Lunas / Piutang (bagian produk)", rep.receivable],
      [],
      ["Kesimpulan", ""],
      ...buildProductConclusion(rep, rp).map((l) => [l]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Ringkasan");
  }
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const safeName = product.name.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
  const fileSuffix = includeAll ? "-semua" : "";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="pembeli-${safeName}${fileSuffix}.xlsx"`,
    },
  });
}
