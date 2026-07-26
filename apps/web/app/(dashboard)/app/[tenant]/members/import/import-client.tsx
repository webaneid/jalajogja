"use client";

import { useState, useTransition } from "react";
import { Download, Upload, CheckCircle2, AlertTriangle, XCircle, Users } from "lucide-react";
import { Combobox } from "@/components/ui/combobox";
import {
  parseImportFileAction, commitImportAction, type RowOverride, type ImportSummary,
} from "./actions";
import { BUSINESS_CATEGORY_ENUM, BUSINESS_SECTOR_ENUM, type ImportRowPreview } from "@/lib/import-anggota-mapping";

const CATEGORY_OPTIONS = BUSINESS_CATEGORY_ENUM.map((v) => ({ value: v, label: v }));
const SECTOR_OPTIONS   = BUSINESS_SECTOR_ENUM.map((v) => ({ value: v, label: v }));

// "duplicate" TIDAK LAGI berarti "akan di-skip" (2026-07-25, § 16) — member yang cocok data
// existing sekarang SELALU dilengkapi field kosongnya (baik yang sudah jadi anggota tenant
// ini maupun belum), bukan dibuang. Label+warna disesuaikan supaya tidak menyiratkan "dibuang".
const STATUS_BADGE: Record<ImportRowPreview["status"], { label: string; className: string; icon: React.ReactNode }> = {
  ready:          { label: "Siap",              className: "bg-green-100 text-green-700", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  review_needed:  { label: "Perlu Review",       className: "bg-amber-100 text-amber-700", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  duplicate:      { label: "Sudah Ada — Dilengkapi", className: "bg-blue-100 text-blue-700", icon: <Users className="h-3.5 w-3.5" /> },
  error:          { label: "Error",              className: "bg-red-100 text-red-700",     icon: <XCircle className="h-3.5 w-3.5" /> },
};

export function ImportClient({ slug }: { slug: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [rows, setRows] = useState<ImportRowPreview[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [overrides, setOverrides] = useState<Record<number, RowOverride>>({});
  const [report, setReport] = useState<{ inserted: number; merged: number; skipped: number } | null>(null);
  const [pending, startTransition] = useTransition();

  function handleUpload() {
    if (!file) return;
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("file", file);
      const result = await parseImportFileAction(slug, fd);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setBatchId(result.batchId);
      setRows(result.rows);
      setSummary(result.summary);
    });
  }

  function setOverride(rowNumber: number, patch: RowOverride) {
    setOverrides((prev) => ({ ...prev, [rowNumber]: { ...prev[rowNumber], ...patch } }));
  }

  function handleCommit() {
    if (!batchId) return;
    startTransition(async () => {
      const result = await commitImportAction(slug, batchId, overrides);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setReport({ inserted: result.inserted, merged: result.merged, skipped: result.skipped });
    });
  }

  // ── Tampilan 3: laporan setelah commit ──
  if (report) {
    return (
      <div className="rounded-xl border border-border bg-white p-6">
        <h2 className="text-lg font-semibold text-green-700">Import Selesai</h2>
        <p className="mt-2 text-sm">
          <span className="font-medium">{report.inserted}</span> anggota baru diimport,{" "}
          <span className="font-medium">{report.merged}</span> anggota yang sudah ada dilengkapi
          datanya (termasuk ditautkan ke tenant ini kalau belum jadi anggota), dan{" "}
          <span className="font-medium">{report.skipped}</span> baris dilewati (error/di-skip manual).
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Anggota yang diimport berstatus <em>pending</em> — mereka perlu login sendiri dan
          melengkapi profil sebelum keanggotaan forum aktif penuh.
        </p>
      </div>
    );
  }

  // ── Tampilan 2: preview + commit ──
  if (batchId && summary) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <SummaryBadge label="Total" value={summary.total} className="bg-zinc-100 text-zinc-700" />
          <SummaryBadge label="Siap" value={summary.ready} className="bg-green-100 text-green-700" />
          <SummaryBadge label="Perlu Review" value={summary.reviewNeeded} className="bg-amber-100 text-amber-700" />
          <SummaryBadge label="Sudah Ada — Dilengkapi" value={summary.duplicate} className="bg-blue-100 text-blue-700" />
          <SummaryBadge label="Error" value={summary.error} className="bg-red-100 text-red-700" />
        </div>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <div className="max-h-[60vh] overflow-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Nama</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Catatan</th>
                <th className="px-3 py-2">Kategori</th>
                <th className="px-3 py-2">Sector</th>
                <th className="px-3 py-2">Skip</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const badge = STATUS_BADGE[r.status];
                const override = overrides[r.rowNumber];
                // Hanya "error" (nama kosong, tidak bisa diproses sama sekali) yang dikunci
                // total — "duplicate" sekarang tetap diproses (dilengkapi datanya), jadi
                // checkbox skip manual tetap ditampilkan kalau admin ingin melewatinya sendiri.
                const disabled = r.status === "error";
                return (
                  <tr key={r.rowNumber} className="border-t border-border align-top">
                    <td className="px-3 py-2 text-muted-foreground">{r.rowNumber}</td>
                    <td className="px-3 py-2 font-medium">{r.member.fullName || "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
                        {badge.icon}
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 max-w-xs text-xs text-muted-foreground">
                      {r.notes.length > 0 ? r.notes.join("; ") : "—"}
                    </td>
                    <td className="px-3 py-2 w-40">
                      {r.business && !disabled ? (
                        <Combobox
                          options={CATEGORY_OPTIONS}
                          value={override?.category ?? r.business.category ?? ""}
                          onValueChange={(v) => setOverride(r.rowNumber, { category: v })}
                          placeholder="— kosong —"
                          className="h-8 text-xs"
                        />
                      ) : r.business ? (r.business.category ?? "—") : "—"}
                    </td>
                    <td className="px-3 py-2 w-48">
                      {r.business && !disabled ? (
                        <Combobox
                          options={SECTOR_OPTIONS}
                          value={override?.sector ?? r.business.sector ?? ""}
                          onValueChange={(v) => setOverride(r.rowNumber, { sector: v })}
                          placeholder="— kosong —"
                          className="h-8 text-xs"
                        />
                      ) : r.business ? (r.business.sector ?? "—") : "—"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {!disabled && (
                        <input
                          type="checkbox"
                          checked={!!override?.skip}
                          onChange={(e) => setOverride(r.rowNumber, { skip: e.target.checked })}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          onClick={handleCommit}
          disabled={pending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {/* "duplicate" TETAP diproses (dilengkapi), cuma "error" yang benar-benar tidak
              bisa diapa-apakan — jadi hanya error yang dikurangi dari hitungan tombol. */}
          {pending ? "Memproses…" : `Proses ${summary.total - summary.error} Baris`}
        </button>
      </div>
    );
  }

  // ── Tampilan 1: upload ──
  return (
    <div className="rounded-xl border border-border bg-white p-6">
      <a
        href={`/api/members/import/template?slug=${slug}`}
        className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
      >
        <Download className="h-4 w-4" />
        Unduh Template Excel
      </a>

      <div className="mt-6 space-y-3">
        <input
          type="file"
          accept=".xlsx"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block text-sm"
        />
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        <button
          type="button"
          onClick={handleUpload}
          disabled={!file || pending}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <Upload className="h-4 w-4" />
          {pending ? "Memproses…" : "Upload & Preview"}
        </button>
      </div>
    </div>
  );
}

function SummaryBadge({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className={`rounded-lg px-3 py-2 text-sm ${className}`}>
      <span className="font-semibold">{value}</span> {label}
    </div>
  );
}
