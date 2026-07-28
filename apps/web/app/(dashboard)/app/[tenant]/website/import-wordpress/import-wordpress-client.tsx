"use client";

import { useState, useTransition } from "react";
import {
  Upload, Link2, CheckCircle2, AlertTriangle, Copy, XCircle, Archive, FileText, FileStack,
} from "lucide-react";
import {
  importWxrFileAction, importRestApiAction, commitImportChunkAction, archiveImportBatchAction,
  getBatchRowsAction, type WordPressImportSummary, type BatchRowStatus,
} from "./actions";
import type { ParsedWordPressItem } from "@/lib/wordpress-import-mapping";

// Status SEBELUM commit (hasil parse) — "duplicate" sengaja TIDAK bisa diproses otomatis (tidak
// ada strategi "merge" untuk konten, beda dari member — lihat commitImportChunkAction).
const PREVIEW_STATUS_BADGE: Record<ParsedWordPressItem["status"], { label: string; className: string; icon: React.ReactNode }> = {
  ready:         { label: "Siap",         className: "bg-green-100 text-green-700", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  review_needed: { label: "Perlu Review", className: "bg-amber-100 text-amber-700", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  duplicate:     { label: "Duplikat — Dilewati", className: "bg-zinc-200 text-zinc-700", icon: <Copy className="h-3.5 w-3.5" /> },
  error:         { label: "Error",        className: "bg-red-100 text-red-700",     icon: <XCircle className="h-3.5 w-3.5" /> },
};

// Status SETELAH commit (final, per-baris) — mencakup status transisi tambahan dari commit.
const FINAL_STATUS_BADGE: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  ...PREVIEW_STATUS_BADGE,
  processing: { label: "Sedang Diproses", className: "bg-blue-100 text-blue-700", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  inserted:   { label: "Berhasil",        className: "bg-green-100 text-green-700", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  skipped:    { label: "Dilewati",        className: "bg-zinc-200 text-zinc-700", icon: <Copy className="h-3.5 w-3.5" /> },
};

const CHUNK_SIZE = 10;

type Phase = "input" | "preview" | "committing" | "report";

export function ImportWordPressClient({ slug }: { slug: string }) {
  const [phase, setPhase] = useState<Phase>("input");
  const [method, setMethod] = useState<"wxr" | "rest">("wxr");
  const [file, setFile] = useState<File | null>(null);
  const [siteUrl, setSiteUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fetchErrors, setFetchErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  const [batchId, setBatchId] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedWordPressItem[]>([]);
  const [summary, setSummary] = useState<WordPressImportSummary | null>(null);

  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  const [finalRows, setFinalRows] = useState<BatchRowStatus[]>([]);
  const [archived, setArchived] = useState(false);

  function handleParse() {
    setError(null);
    setFetchErrors([]);
    startTransition(async () => {
      if (method === "wxr") {
        if (!file) { setError("Pilih file WXR terlebih dahulu."); return; }
        const fd = new FormData();
        fd.append("file", file);
        const result = await importWxrFileAction(slug, fd);
        if (!result.success) { setError(result.error); return; }
        setBatchId(result.batchId);
        setRows(result.rows);
        setSummary(result.summary);
        setPhase("preview");
        return;
      }

      if (!siteUrl.trim()) { setError("Isi URL situs WordPress terlebih dahulu."); return; }
      const result = await importRestApiAction(slug, siteUrl.trim());
      if (!result.success) { setError(result.error); return; }
      setBatchId(result.batchId);
      setRows(result.rows);
      setSummary(result.summary);
      if (result.fetchErrors.length > 0) setFetchErrors(result.fetchErrors);
      setPhase("preview");
    });
  }

  async function runChunkedCommit(currentBatchId: string) {
    setPhase("committing");
    let done = false;
    while (!done) {
      const result = await commitImportChunkAction(slug, currentBatchId, CHUNK_SIZE);
      if (!result.success) {
        setError(result.error);
        setPhase("preview");
        return;
      }
      setProgress({ processed: result.processed, total: result.total });
      done = result.done;
    }

    const rowsResult = await getBatchRowsAction(slug, currentBatchId);
    if (rowsResult.success) setFinalRows(rowsResult.rows);
    setPhase("report");
  }

  function handleStartCommit() {
    if (!batchId) return;
    setError(null);
    void runChunkedCommit(batchId);
  }

  function handleArchive() {
    if (!batchId) return;
    startTransition(async () => {
      const result = await archiveImportBatchAction(slug, batchId);
      if (!result.success) { setError(result.error); return; }
      setArchived(true);
    });
  }

  // ── View: Report (setelah commit selesai) ──
  if (phase === "report") {
    const insertedCount = finalRows.filter((r) => r.status === "inserted").length;
    const errorCount = finalRows.filter((r) => r.status === "error").length;
    const skippedCount = finalRows.length - insertedCount - errorCount;

    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-white p-6">
          <h2 className="text-lg font-semibold text-green-700">Import Selesai</h2>
          <p className="mt-2 text-sm">
            <span className="font-medium">{insertedCount}</span> konten berhasil diimport,{" "}
            <span className="font-medium">{errorCount}</span> gagal, dan{" "}
            <span className="font-medium">{skippedCount}</span> dilewati (duplikat/error parse).
          </p>

          {archived ? (
            <p className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
              Batch ini sudah diarsipkan — semua konten hasil import ini sekarang berstatus
              &quot;Diarsipkan&quot; dan tidak tampil di publik. Anda bisa terbitkan kembali
              secara manual per-konten kalau perlu.
            </p>
          ) : (
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={handleArchive}
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                <Archive className="h-4 w-4" />
                {pending ? "Memproses…" : "Batalkan Import Ini (Arsipkan Semua)"}
              </button>
              <p className="text-xs text-muted-foreground">
                Tidak menghapus data — konten disembunyikan (status arsip), bisa diterbitkan
                lagi manual kapan saja.
              </p>
            </div>
          )}

          {error && (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
        </div>

        <div className="max-h-[60vh] overflow-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Tipe</th>
                <th className="px-3 py-2">Judul</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {finalRows.map((r) => {
                const badge = FINAL_STATUS_BADGE[r.status] ?? FINAL_STATUS_BADGE.error;
                return (
                  <tr key={r.rowNumber} className="border-t border-border align-top">
                    <td className="px-3 py-2 text-muted-foreground">{r.rowNumber}</td>
                    <td className="px-3 py-2">
                      {r.contentType === "post"
                        ? <span className="inline-flex items-center gap-1 text-xs"><FileText className="h-3.5 w-3.5" /> Post</span>
                        : <span className="inline-flex items-center gap-1 text-xs"><FileStack className="h-3.5 w-3.5" /> Halaman</span>}
                    </td>
                    <td className="px-3 py-2 font-medium">{r.title || "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
                        {badge.icon}
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 max-w-sm text-xs text-muted-foreground">
                      {r.errorMessage ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── View: Committing (progress bar) ──
  if (phase === "committing") {
    const pct = progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;
    return (
      <div className="rounded-xl border border-border bg-white p-6">
        <h2 className="text-lg font-semibold">Sedang Mengimport…</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Setiap konten memproses gambar+konversi editor — mohon tunggu, jangan tutup halaman ini.
        </p>
        <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {progress.processed} / {progress.total} baris diproses ({pct}%)
        </p>
      </div>
    );
  }

  // ── View: Preview (setelah parse) ──
  if (phase === "preview" && summary) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <SummaryBadge label="Total"        value={summary.total}        className="bg-zinc-100 text-zinc-700" />
          <SummaryBadge label="Siap"         value={summary.ready}        className="bg-green-100 text-green-700" />
          <SummaryBadge label="Perlu Review" value={summary.reviewNeeded} className="bg-amber-100 text-amber-700" />
          <SummaryBadge label="Duplikat"     value={summary.duplicate}    className="bg-zinc-200 text-zinc-700" />
        </div>

        {fetchErrors.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            {fetchErrors.map((msg, i) => <p key={i}>{msg}</p>)}
          </div>
        )}
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <div className="max-h-[55vh] overflow-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Tipe</th>
                <th className="px-3 py-2">Judul</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Catatan</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const badge = PREVIEW_STATUS_BADGE[r.status];
                return (
                  <tr key={r.rowNumber} className="border-t border-border align-top">
                    <td className="px-3 py-2 text-muted-foreground">{r.rowNumber}</td>
                    <td className="px-3 py-2">
                      {r.contentType === "post"
                        ? <span className="inline-flex items-center gap-1 text-xs"><FileText className="h-3.5 w-3.5" /> Post</span>
                        : <span className="inline-flex items-center gap-1 text-xs"><FileStack className="h-3.5 w-3.5" /> Halaman</span>}
                    </td>
                    <td className="px-3 py-2 font-medium">{r.title || "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
                        {badge.icon}
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 max-w-xs text-xs text-muted-foreground">
                      {r.notes.length > 0 ? r.notes.join("; ") : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          onClick={handleStartCommit}
          disabled={pending || summary.ready + summary.reviewNeeded === 0}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {/* "duplicate" TIDAK PERNAH ikut diimport (tidak ada strategi merge untuk konten) —
              cuma ready+reviewNeeded yang dihitung sebagai "akan diproses". */}
          Mulai Import {summary.ready + summary.reviewNeeded} Konten
        </button>
      </div>
    );
  }

  // ── View: Input (pilih metode) ──
  return (
    <div className="rounded-xl border border-border bg-white p-6">
      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setMethod("wxr")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            method === "wxr" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
          }`}
        >
          Upload File WXR
        </button>
        <button
          type="button"
          onClick={() => setMethod("rest")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            method === "rest" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
          }`}
        >
          Tarik dari URL Situs
        </button>
      </div>

      {method === "wxr" ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Export dari WordPress lama: <em>Tools → Export → All content</em>, lalu unggah file
            <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">.xml</code> hasilnya di
            sini. Metode ini membawa data SEO Yoast lengkap.
          </p>
          <input
            type="file"
            accept=".xml"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block text-sm"
          />
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Tarik langsung dari REST API situs WordPress yang masih online. Lebih cepat, tapi
            <strong> tidak membawa data SEO Yoast</strong> (REST API WordPress tidak
            menyertakannya).
          </p>
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-muted-foreground" />
            <input
              type="url"
              placeholder="https://situslama.com"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              className="flex-1 rounded-lg border border-border px-3 py-2 text-sm"
            />
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <button
        type="button"
        onClick={handleParse}
        disabled={pending || (method === "wxr" ? !file : !siteUrl.trim())}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        <Upload className="h-4 w-4" />
        {pending ? "Memproses…" : "Ambil & Preview"}
      </button>
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
