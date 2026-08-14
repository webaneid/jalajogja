export const dynamic = "force-dynamic";
// GET /api/finance/laporan/arus-kas-bulanan/export?tenant={slug}&start=&end=
// Export Laporan Arus Kas Bulanan ke .xlsx sungguhan (bukan CSV) — 2 sheet: ringkasan per
// bulan + detail per kategori. Reuse getLaporanArusKasBulananAction (finance/actions.ts),
// tidak query ulang — cukup panggil action yang sama lalu format hasilnya jadi workbook.
// Pola export .xlsx disalin dari app/api/events/[id]/export-participants/route.ts. Angka
// ditulis mentah (bukan string "Rp ...") supaya tetap bisa dijumlah/diformat di Excel.

import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getTenantAccess } from "@/lib/tenant";
import { hasReadAccess } from "@/lib/permissions";
import { getLaporanArusKasBulananAction } from "@/app/(dashboard)/app/[tenant]/finance/actions";

export async function GET(req: NextRequest) {
  const slug  = req.nextUrl.searchParams.get("tenant") ?? req.nextUrl.searchParams.get("slug");
  const start = req.nextUrl.searchParams.get("start");
  const end   = req.nextUrl.searchParams.get("end");
  if (!slug) return NextResponse.json({ error: "Parameter tenant wajib diisi." }, { status: 400 });
  if (!start || !end) return NextResponse.json({ error: "Parameter start dan end wajib diisi." }, { status: 400 });

  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasReadAccess(access.tenantUser, "keuangan")) {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  const result = await getLaporanArusKasBulananAction(slug, start, end);
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
  const { rows, grandTotalPemasukan, grandTotalPengeluaran, grandSaldo } = result.data;

  // ── Sheet 1: Ringkasan Bulanan ──────────────────────────────────────────────
  const ringkasanHeaders = ["Bulan", "Total Pemasukan", "Total Pengeluaran", "Saldo Bulan Ini", "Saldo Kumulatif"];
  const ringkasanRows: (string | number)[][] = rows.map((r) => [
    r.monthLabel, r.totalPemasukan, r.totalPengeluaran, r.saldo, r.saldoKumulatif,
  ]);
  ringkasanRows.push(["TOTAL", grandTotalPemasukan, grandTotalPengeluaran, grandSaldo, ""]);

  // ── Sheet 2: Detail per Kategori (audit trail penuh per sumber/tujuan) ──────
  const detailHeaders = ["Bulan", "Tipe", "Kategori", "Jumlah"];
  const detailRows: (string | number)[][] = [];
  for (const r of rows) {
    for (const p of r.pemasukan)   detailRows.push([r.monthLabel, "Pemasukan",   p.label, p.amount]);
    for (const p of r.pengeluaran) detailRows.push([r.monthLabel, "Pengeluaran", p.label, p.amount]);
  }

  const wb = XLSX.utils.book_new();
  const sheet1 = XLSX.utils.aoa_to_sheet([ringkasanHeaders, ...ringkasanRows]);
  XLSX.utils.book_append_sheet(wb, sheet1, "Ringkasan Bulanan");
  const sheet2 = XLSX.utils.aoa_to_sheet([detailHeaders, ...detailRows]);
  XLSX.utils.book_append_sheet(wb, sheet2, "Detail per Kategori");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="arus-kas-bulanan-${start}-${end}.xlsx"`,
    },
  });
}
