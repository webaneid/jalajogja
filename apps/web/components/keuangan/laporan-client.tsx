"use client";

import { useState } from "react";
import { FileText } from "lucide-react";

type AccountOption = {
  id: string;
  code: string;
  name: string;
  type: string;
};

type Props = {
  slug: string;
  accounts: AccountOption[];
};

const REPORT_TYPES = [
  { value: "neraca",    label: "Neraca Saldo",         desc: "Saldo semua akun per periode tertentu" },
  { value: "laba_rugi", label: "Laporan Laba Rugi",    desc: "Pendapatan vs beban dalam periode" },
  { value: "arus_kas",  label: "Laporan Arus Kas",     desc: "Ringkasan pemasukan dan pengeluaran kas" },
  { value: "buku_besar",label: "Buku Besar",           desc: "Riwayat transaksi per akun" },
] as const;

export function LaporanClient({ slug, accounts }: Props) {
  const [reportType, setReportType] = useState<string>("neraca");
  const [startDate,  setStartDate]  = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [accountId, setAccountId] = useState("");

  const isBukuBesar = reportType === "buku_besar";

  const params = new URLSearchParams({
    type:  reportType,
    start: startDate,
    end:   endDate,
    ...(isBukuBesar && accountId ? { accountId } : {}),
  });

  return (
    <div className="space-y-6">
      {/* Pilih jenis laporan */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {REPORT_TYPES.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => setReportType(r.value)}
            className={`rounded-lg border p-3 text-left transition-colors ${
              reportType === r.value
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-border bg-card hover:bg-muted/30"
            }`}
          >
            <p className="text-sm font-medium">{r.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{r.desc}</p>
          </button>
        ))}
      </div>

      {/* Filter periode */}
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Dari Tanggal</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Sampai Tanggal</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        {isBukuBesar && (
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Akun</label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring min-w-[200px]"
            >
              <option value="">— Pilih akun —</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.code} · {acc.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Catatan: laporan masih placeholder */}
      <div className="rounded-lg border border-border bg-muted/20 p-8 text-center">
        <FileText className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">Pratinjau Laporan</p>
        <p className="text-xs text-muted-foreground mt-1">
          Filter: {REPORT_TYPES.find((r) => r.value === reportType)?.label} ·{" "}
          {startDate} s/d {endDate}
        </p>
        <p className="text-xs text-muted-foreground mt-3 italic">
          Laporan akan ditampilkan di sini setelah ada data transaksi.
        </p>
      </div>

      {/* Tombol export (placeholder) */}
      <div className="flex gap-3">
        <button
          type="button"
          disabled
          className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-muted-foreground cursor-not-allowed opacity-60"
        >
          Export PDF
        </button>
        <button
          type="button"
          disabled
          className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-muted-foreground cursor-not-allowed opacity-60"
        >
          Export Excel
        </button>
        <p className="text-xs text-muted-foreground self-center italic">Export tersedia setelah ada data</p>
      </div>
    </div>
  );
}
