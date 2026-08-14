"use client";

import { Fragment, useState, useTransition } from "react";
import { FileText, Download, Loader2 } from "lucide-react";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import {
  getLaporanNeracaSaldoAction,
  getLaporanLabaRugiAction,
  getLaporanArusKasAction,
  getLaporanArusKasBulananAction,
  getLaporanBukuBesarAction,
  type NeracaSaldoRow,
  type LabaRugiData,
  type ArusKasData,
  type ArusKasBulananData,
  type BukuBesarRow,
} from "@/app/(dashboard)/app/[tenant]/finance/actions";

type AccountOption = {
  id:   string;
  code: string;
  name: string;
  type: string;
};

type Props = {
  slug:     string;
  accounts: AccountOption[];
};

const REPORT_TYPES = [
  { value: "neraca",           label: "Neraca Saldo",       desc: "Saldo semua akun per periode" },
  { value: "laba_rugi",        label: "Laporan Laba Rugi",  desc: "Pendapatan vs beban" },
  { value: "arus_kas",         label: "Laporan Arus Kas",   desc: "Ringkasan aliran kas masuk & keluar" },
  { value: "arus_kas_bulanan", label: "Arus Kas Bulanan",   desc: "Pemasukan & pengeluaran per bulan" },
  { value: "buku_besar",       label: "Buku Besar",         desc: "Riwayat transaksi per akun" },
] as const;

type ReportType = typeof REPORT_TYPES[number]["value"];
type ReportData =
  | { type: "neraca";           data: NeracaSaldoRow[] }
  | { type: "laba_rugi";        data: LabaRugiData }
  | { type: "arus_kas";         data: ArusKasData }
  | { type: "arus_kas_bulanan"; data: ArusKasBulananData }
  | { type: "buku_besar";       data: BukuBesarRow[] };

function formatRp(n: number) {
  return "Rp " + new Intl.NumberFormat("id-ID", { minimumFractionDigits: 0 }).format(n);
}

function formatDate(s: string) {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

const TYPE_LABELS: Record<string, string> = {
  asset:     "Aset",
  liability: "Kewajiban",
  equity:    "Ekuitas",
  income:    "Pendapatan",
  expense:   "Beban",
};

// ─── Tabel Neraca Saldo ───────────────────────────────────────────────────────

function NeracaTable({ rows }: { rows: NeracaSaldoRow[] }) {
  const totalDebit  = rows.reduce((s, r) => s + r.totalDebit,  0);
  const totalCredit = rows.reduce((s, r) => s + r.totalCredit, 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="px-3 py-2 text-left font-medium">Kode</th>
            <th className="px-3 py-2 text-left font-medium">Nama Akun</th>
            <th className="px-3 py-2 text-left font-medium">Tipe</th>
            <th className="px-3 py-2 text-right font-medium">Debit</th>
            <th className="px-3 py-2 text-right font-medium">Kredit</th>
            <th className="px-3 py-2 text-right font-medium">Saldo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.code} className="border-b border-border hover:bg-muted/20">
              <td className="px-3 py-2 font-mono text-xs">{r.code}</td>
              <td className="px-3 py-2">{r.name}</td>
              <td className="px-3 py-2 text-muted-foreground text-xs">{TYPE_LABELS[r.type] ?? r.type}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.totalDebit  > 0 ? formatRp(r.totalDebit)  : "—"}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.totalCredit > 0 ? formatRp(r.totalCredit) : "—"}</td>
              <td className={`px-3 py-2 text-right tabular-nums font-medium ${r.balance > 0 ? "text-blue-600" : r.balance < 0 ? "text-red-600" : "text-muted-foreground"}`}>
                {r.balance !== 0 ? formatRp(Math.abs(r.balance)) + (r.balance < 0 ? " (K)" : " (D)") : "—"}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border font-semibold bg-muted/30">
            <td colSpan={3} className="px-3 py-2">TOTAL</td>
            <td className="px-3 py-2 text-right tabular-nums">{formatRp(totalDebit)}</td>
            <td className="px-3 py-2 text-right tabular-nums">{formatRp(totalCredit)}</td>
            <td className="px-3 py-2 text-right tabular-nums">{formatRp(Math.abs(totalDebit - totalCredit))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── Tabel Laba Rugi ──────────────────────────────────────────────────────────

function LabaRugiTable({ data }: { data: LabaRugiData }) {
  const incomeRows  = data.rows.filter(r => r.type === "income");
  const expenseRows = data.rows.filter(r => r.type === "expense");

  return (
    <div className="overflow-x-auto space-y-4">
      {/* Pendapatan */}
      <div>
        <h3 className="font-medium text-sm px-3 py-2 bg-green-50 border border-border rounded-t-md">Pendapatan</h3>
        <table className="w-full text-sm border border-t-0 border-border rounded-b-md overflow-hidden">
          <tbody>
            {incomeRows.length === 0 ? (
              <tr><td colSpan={3} className="px-3 py-4 text-center text-muted-foreground text-xs">Tidak ada pendapatan dalam periode ini</td></tr>
            ) : incomeRows.map((r) => (
              <tr key={r.code} className="border-b border-border hover:bg-muted/20">
                <td className="px-3 py-2 font-mono text-xs w-20">{r.code}</td>
                <td className="px-3 py-2">{r.name}</td>
                <td className="px-3 py-2 text-right tabular-nums text-green-700 font-medium">{formatRp(r.amount)}</td>
              </tr>
            ))}
            <tr className="font-semibold bg-green-50 border-t border-border">
              <td colSpan={2} className="px-3 py-2">Total Pendapatan</td>
              <td className="px-3 py-2 text-right text-green-700 tabular-nums">{formatRp(data.totalIncome)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Beban */}
      <div>
        <h3 className="font-medium text-sm px-3 py-2 bg-red-50 border border-border rounded-t-md">Beban</h3>
        <table className="w-full text-sm border border-t-0 border-border rounded-b-md overflow-hidden">
          <tbody>
            {expenseRows.length === 0 ? (
              <tr><td colSpan={3} className="px-3 py-4 text-center text-muted-foreground text-xs">Tidak ada beban dalam periode ini</td></tr>
            ) : expenseRows.map((r) => (
              <tr key={r.code} className="border-b border-border hover:bg-muted/20">
                <td className="px-3 py-2 font-mono text-xs w-20">{r.code}</td>
                <td className="px-3 py-2">{r.name}</td>
                <td className="px-3 py-2 text-right tabular-nums text-red-700 font-medium">{formatRp(r.amount)}</td>
              </tr>
            ))}
            <tr className="font-semibold bg-red-50 border-t border-border">
              <td colSpan={2} className="px-3 py-2">Total Beban</td>
              <td className="px-3 py-2 text-right text-red-700 tabular-nums">{formatRp(data.totalExpense)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Net */}
      <div className={`rounded-md border-2 p-4 flex justify-between items-center ${data.netProfit >= 0 ? "border-green-400 bg-green-50" : "border-red-400 bg-red-50"}`}>
        <span className="font-semibold">{data.netProfit >= 0 ? "Surplus (Laba)" : "Defisit (Rugi)"}</span>
        <span className={`text-xl font-bold tabular-nums ${data.netProfit >= 0 ? "text-green-700" : "text-red-700"}`}>
          {formatRp(Math.abs(data.netProfit))}
        </span>
      </div>
    </div>
  );
}

// ─── Tabel Arus Kas ───────────────────────────────────────────────────────────

function ArusKasTable({ data }: { data: ArusKasData }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Pemasukan */}
        <div>
          <h3 className="font-medium text-sm px-3 py-2 bg-green-50 border border-border rounded-t-md">Arus Kas Masuk</h3>
          <table className="w-full text-sm border border-t-0 border-border rounded-b-md overflow-hidden">
            <tbody>
              {data.pemasukan.length === 0 ? (
                <tr><td colSpan={2} className="px-3 py-4 text-center text-muted-foreground text-xs">Tidak ada pemasukan</td></tr>
              ) : data.pemasukan.map((r, i) => (
                <tr key={i} className="border-b border-border hover:bg-muted/20">
                  <td className="px-3 py-2">{r.label}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-green-700 font-medium">{formatRp(r.amount)}</td>
                </tr>
              ))}
              <tr className="font-semibold bg-green-50 border-t border-border">
                <td className="px-3 py-2">Total Masuk</td>
                <td className="px-3 py-2 text-right text-green-700 tabular-nums">{formatRp(data.totalPemasukan)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Pengeluaran */}
        <div>
          <h3 className="font-medium text-sm px-3 py-2 bg-red-50 border border-border rounded-t-md">Arus Kas Keluar</h3>
          <table className="w-full text-sm border border-t-0 border-border rounded-b-md overflow-hidden">
            <tbody>
              {data.pengeluaran.length === 0 ? (
                <tr><td colSpan={2} className="px-3 py-4 text-center text-muted-foreground text-xs">Tidak ada pengeluaran</td></tr>
              ) : data.pengeluaran.map((r, i) => (
                <tr key={i} className="border-b border-border hover:bg-muted/20">
                  <td className="px-3 py-2">{r.label}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-red-700 font-medium">{formatRp(r.amount)}</td>
                </tr>
              ))}
              <tr className="font-semibold bg-red-50 border-t border-border">
                <td className="px-3 py-2">Total Keluar</td>
                <td className="px-3 py-2 text-right text-red-700 tabular-nums">{formatRp(data.totalPengeluaran)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Saldo */}
      <div className={`rounded-md border-2 p-4 flex justify-between items-center ${data.saldo >= 0 ? "border-green-400 bg-green-50" : "border-red-400 bg-red-50"}`}>
        <span className="font-semibold">Saldo Kas Bersih</span>
        <span className={`text-xl font-bold tabular-nums ${data.saldo >= 0 ? "text-green-700" : "text-red-700"}`}>
          {formatRp(data.saldo)}
        </span>
      </div>
    </div>
  );
}

// ─── Tabel Arus Kas Bulanan ─────────────────────────────────────────────────────

function ArusKasBulananTable({ data }: { data: ArusKasBulananData }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="px-3 py-2 text-left font-medium">Bulan</th>
            <th className="px-3 py-2 text-right font-medium">Pemasukan</th>
            <th className="px-3 py-2 text-right font-medium">Pengeluaran</th>
            <th className="px-3 py-2 text-right font-medium">Saldo Bulan Ini</th>
            <th className="px-3 py-2 text-right font-medium">Saldo Kumulatif</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.length === 0 ? (
            <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground text-xs">Tidak ada transaksi dalam periode ini</td></tr>
          ) : data.rows.map((r) => (
            <Fragment key={r.monthKey}>
              <tr
                className="border-b border-border hover:bg-muted/20 cursor-pointer"
                onClick={() => toggle(r.monthKey)}
              >
                <td className="px-3 py-2 font-medium">{r.monthLabel}</td>
                <td className="px-3 py-2 text-right tabular-nums text-green-700">{formatRp(r.totalPemasukan)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-red-700">{formatRp(r.totalPengeluaran)}</td>
                <td className={`px-3 py-2 text-right tabular-nums font-medium ${r.saldo >= 0 ? "text-blue-600" : "text-red-600"}`}>
                  {formatRp(r.saldo)}
                </td>
                <td className={`px-3 py-2 text-right tabular-nums font-medium ${r.saldoKumulatif >= 0 ? "text-blue-600" : "text-red-600"}`}>
                  {formatRp(r.saldoKumulatif)}
                </td>
              </tr>
              {expanded.has(r.monthKey) && (
                <tr className="border-b border-border bg-muted/10">
                  <td colSpan={5} className="px-3 py-3">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1.5">Rincian Pemasukan</p>
                        {r.pemasukan.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Tidak ada pemasukan</p>
                        ) : r.pemasukan.map((p, i) => (
                          <div key={i} className="flex justify-between text-xs py-0.5">
                            <span>{p.label}</span>
                            <span className="tabular-nums text-green-700">{formatRp(p.amount)}</span>
                          </div>
                        ))}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1.5">Rincian Pengeluaran</p>
                        {r.pengeluaran.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Tidak ada pengeluaran</p>
                        ) : r.pengeluaran.map((p, i) => (
                          <div key={i} className="flex justify-between text-xs py-0.5">
                            <span>{p.label}</span>
                            <span className="tabular-nums text-red-700">{formatRp(p.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border font-semibold bg-muted/30">
            <td className="px-3 py-2">TOTAL</td>
            <td className="px-3 py-2 text-right tabular-nums text-green-700">{formatRp(data.grandTotalPemasukan)}</td>
            <td className="px-3 py-2 text-right tabular-nums text-red-700">{formatRp(data.grandTotalPengeluaran)}</td>
            <td className={`px-3 py-2 text-right tabular-nums ${data.grandSaldo >= 0 ? "text-blue-600" : "text-red-600"}`}>
              {formatRp(data.grandSaldo)}
            </td>
            <td className="px-3 py-2"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── Tabel Buku Besar ─────────────────────────────────────────────────────────

function BukuBesarTable({ rows }: { rows: BukuBesarRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="px-3 py-2 text-left font-medium">Tanggal</th>
            <th className="px-3 py-2 text-left font-medium">No. Ref</th>
            <th className="px-3 py-2 text-left font-medium">Keterangan</th>
            <th className="px-3 py-2 text-right font-medium">Debit</th>
            <th className="px-3 py-2 text-right font-medium">Kredit</th>
            <th className="px-3 py-2 text-right font-medium">Saldo</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground text-xs">Tidak ada transaksi dalam periode ini</td></tr>
          ) : rows.map((r, i) => (
            <tr key={i} className="border-b border-border hover:bg-muted/20">
              <td className="px-3 py-2 whitespace-nowrap">{formatDate(r.date)}</td>
              <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{r.referenceNumber}</td>
              <td className="px-3 py-2">
                <span>{r.description}</span>
                {r.note && <span className="block text-xs text-muted-foreground">{r.note}</span>}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{r.debit  > 0 ? formatRp(r.debit)  : "—"}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.credit > 0 ? formatRp(r.credit) : "—"}</td>
              <td className={`px-3 py-2 text-right tabular-nums font-medium ${r.balance >= 0 ? "text-blue-600" : "text-red-600"}`}>
                {formatRp(Math.abs(r.balance))}{r.balance < 0 ? " (K)" : " (D)"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportCsv(reportType: ReportType, result: ReportData) {
  let lines: string[] = [];

  if (reportType === "neraca" && result.type === "neraca") {
    lines = [
      "Kode,Nama Akun,Tipe,Debit,Kredit,Saldo",
      ...result.data.map(r =>
        `"${r.code}","${r.name}","${r.type}",${r.totalDebit},${r.totalCredit},${r.balance}`
      ),
    ];
  } else if (reportType === "laba_rugi" && result.type === "laba_rugi") {
    lines = [
      "Kode,Nama Akun,Tipe,Jumlah",
      ...result.data.rows.map(r => `"${r.code}","${r.name}","${r.type}",${r.amount}`),
      `,,Total Pendapatan,${result.data.totalIncome}`,
      `,,Total Beban,${result.data.totalExpense}`,
      `,,Laba/Rugi Bersih,${result.data.netProfit}`,
    ];
  } else if (reportType === "arus_kas" && result.type === "arus_kas") {
    lines = [
      "Kategori,Keterangan,Jumlah",
      ...result.data.pemasukan.map(r => `"Pemasukan","${r.label}",${r.amount}`),
      `"Pemasukan","Total",${result.data.totalPemasukan}`,
      ...result.data.pengeluaran.map(r => `"Pengeluaran","${r.label}",${r.amount}`),
      `"Pengeluaran","Total",${result.data.totalPengeluaran}`,
      `"Saldo",,${result.data.saldo}`,
    ];
  } else if (reportType === "buku_besar" && result.type === "buku_besar") {
    lines = [
      "Tanggal,No Referensi,Keterangan,Keterangan Entri,Debit,Kredit,Saldo",
      ...result.data.map(r =>
        `"${r.date}","${r.referenceNumber}","${r.description}","${r.note ?? ""}",${r.debit},${r.credit},${r.balance}`
      ),
    ];
  }

  if (lines.length === 0) return;

  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `laporan-${reportType}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function LaporanClient({ slug, accounts }: Props) {
  const [reportType, setReportType] = useState<ReportType>("neraca");
  const [startDate,  setStartDate]  = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [endDate,    setEndDate]    = useState(() => new Date().toISOString().slice(0, 10));
  const [accountId,  setAccountId]  = useState("");

  const [result,  setResult]  = useState<ReportData | null>(null);
  const [error,   setError]   = useState("");
  const [pending, startTransition] = useTransition();

  const accountOptions: ComboboxOption[] = accounts.map((acc) => ({
    value: acc.id,
    label: `${acc.code} · ${acc.name}`,
  }));

  function handleGenerate() {
    setError("");
    setResult(null);
    startTransition(async () => {
      if (reportType === "neraca") {
        const res = await getLaporanNeracaSaldoAction(slug, startDate, endDate);
        if (res.success) setResult({ type: "neraca",    data: res.data });
        else setError(res.error);
      } else if (reportType === "laba_rugi") {
        const res = await getLaporanLabaRugiAction(slug, startDate, endDate);
        if (res.success) setResult({ type: "laba_rugi", data: res.data });
        else setError(res.error);
      } else if (reportType === "arus_kas") {
        const res = await getLaporanArusKasAction(slug, startDate, endDate);
        if (res.success) setResult({ type: "arus_kas",  data: res.data });
        else setError(res.error);
      } else if (reportType === "arus_kas_bulanan") {
        const res = await getLaporanArusKasBulananAction(slug, startDate, endDate);
        if (res.success) setResult({ type: "arus_kas_bulanan", data: res.data });
        else setError(res.error);
      } else if (reportType === "buku_besar") {
        const res = await getLaporanBukuBesarAction(slug, accountId, startDate, endDate);
        if (res.success) setResult({ type: "buku_besar", data: res.data });
        else setError(res.error);
      }
    });
  }

  const selectedLabel = REPORT_TYPES.find(r => r.value === reportType)?.label ?? "";

  return (
    <div className="space-y-6">
      {/* Pilih jenis laporan */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {REPORT_TYPES.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => { setReportType(r.value); setResult(null); setError(""); }}
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

      {/* Filter */}
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Dari Tanggal</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setResult(null); }}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Sampai Tanggal</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setResult(null); }}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {reportType === "buku_besar" && (
          <div className="min-w-[220px]">
            <label className="block text-xs text-muted-foreground mb-1">Akun</label>
            <Combobox
              options={accountOptions}
              value={accountId}
              onValueChange={(val) => { setAccountId(val); setResult(null); }}
              placeholder="Pilih akun..."
              searchPlaceholder="Cari kode atau nama..."
            />
          </div>
        )}

        <button
          type="button"
          onClick={handleGenerate}
          disabled={pending || (reportType === "buku_besar" && !accountId)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          {pending ? "Memuat..." : "Generate Laporan"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Hasil laporan */}
      {result && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
            <div>
              <p className="font-medium text-sm">{selectedLabel}</p>
              <p className="text-xs text-muted-foreground">{startDate} s/d {endDate}</p>
            </div>
            {reportType === "arus_kas_bulanan" ? (
              <a
                href={`/api/finance/laporan/arus-kas-bulanan/export?tenant=${slug}&start=${startDate}&end=${endDate}`}
                className="inline-flex items-center gap-1.5 rounded border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted/40"
              >
                <Download className="h-3.5 w-3.5" />
                Export Excel
              </a>
            ) : (
              <button
                type="button"
                onClick={() => exportCsv(reportType, result)}
                className="inline-flex items-center gap-1.5 rounded border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted/40"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </button>
            )}
          </div>

          <div className="p-4">
            {result.type === "neraca"           && <NeracaTable         rows={result.data} />}
            {result.type === "laba_rugi"        && <LabaRugiTable       data={result.data} />}
            {result.type === "arus_kas"         && <ArusKasTable        data={result.data} />}
            {result.type === "arus_kas_bulanan" && <ArusKasBulananTable data={result.data} />}
            {result.type === "buku_besar"       && <BukuBesarTable      rows={result.data} />}
          </div>
        </div>
      )}

      {/* Placeholder jika belum generate */}
      {!result && !pending && !error && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">Pilih jenis laporan, atur periode, lalu klik <strong>Generate Laporan</strong></p>
        </div>
      )}
    </div>
  );
}
