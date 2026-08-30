export const dynamic = "force-dynamic";
// GET /api/products/[id]/export-buyers?tenant={slug}&all=1
// Export daftar pembeli satu produk ke Excel. Kolom: No. Invoice, Nama Pembeli, Telepon,
// Jumlah, Varian/Ukuran, Harga Satuan, Subtotal, Diskon Voucher, Cara Pengiriman,
// Status Pembayaran, Total Dibayarkan, Kode Voucher, Tanggal Pesan.
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
// Query logic (resolveProductBuyers) dan status pembayaran dijamin identik dengan tabel
// "Daftar Pembeli" di halaman /toko/produk/[id] — satu fungsi shared, lihat
// lib/product-buyers.server.ts untuk detail arsitektur (termasuk kenapa itemId bisa berupa
// id variasi, bukan id produk induk).

import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { hasReadAccess } from "@/lib/permissions";
import { displayPhone } from "@/lib/phone";
import { resolveProductBuyers } from "@/lib/product-buyers.server";

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

  const headers = [
    "No. Invoice", "Nama Pembeli", "Telepon", "Jumlah", "Varian/Ukuran", "Harga Satuan",
    "Subtotal", "Diskon Voucher", "Cara Pengiriman", "Status Pembayaran", "Total Dibayarkan",
    "Kode Voucher", "Tanggal Pesan",
  ];

  const dataRows = rows.map((r) => [
    r.invoiceNumber,
    r.customerName,
    r.customerPhone ? displayPhone(r.customerPhone) : "",
    r.quantity,
    r.variantLabel || "-",
    r.unitPrice,
    r.lineTotal,
    r.discountAmount > 0 ? r.discountAmount : "",
    r.shippingLabel,
    r.paymentStatusLabel,
    r.totalDibayarkan,
    r.voucherCode ?? "",
    fmtDate(r.createdAt),
  ]);

  const wb = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
  XLSX.utils.book_append_sheet(wb, sheet, "Pembeli");
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
