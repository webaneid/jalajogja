"use client";

// Halaman membaca + menandatangani Syarat & Ketentuan Produsen. Gaya mengikuti halaman TTD modul Surat
// (components/letters/signing-page-client.tsx): header status → isi → penandatangan → tombol TTD → hash + tautan verifikasi.
// Doc: docs/arsitektur-portal-produsen.md § 28.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, PenLine, Shield } from "lucide-react";
import { signProducerTermAction } from "@/app/(producer)/app/[tenant]/portal-produsen/syarat/actions";

type Signed = { signedAt: string; hash: string; verifyUrl: string; qrDataUrl: string };

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("id-ID", { dateStyle: "full", timeStyle: "short" });

export function ProducerTermSign({ slug, termId, version, title, publishedAt, html, producerName, signed }: {
  slug: string; termId: string; version: number; title: string; publishedAt: string; html: string; producerName: string; signed: Signed | null;
}) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const sign = () => {
    setError("");
    start(async () => {
      const res = await signProducerTermAction(slug, { termId, agreed });
      if (!res.success) { setError(res.error); return; }
      // Muat ulang: layout menghitung ulang status kunci, halaman ini menampilkan bukti (hash + QR)
      router.refresh();
    });
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
      <div className={`border-b px-6 py-4 ${signed ? "border-green-100 bg-green-50" : "border-border bg-muted/5"}`}>
        <div className="flex items-center gap-3">
          {signed ? <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" /> : <Shield className="h-5 w-5 shrink-0 text-primary" />}
          <div>
            <p className={`text-sm font-semibold ${signed ? "text-green-700" : "text-foreground"}`}>
              {signed ? "Syarat & Ketentuan Sudah Ditandatangani" : "Persetujuan Syarat & Ketentuan Produsen"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">Versi {version} · berlaku sejak {fmt(publishedAt)}</p>
          </div>
        </div>
      </div>

      <div className="space-y-5 px-6 py-5">
        {!signed && (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Untuk memakai Portal Produsen, baca syarat &amp; ketentuan di bawah, lalu tanda tangani secara digital.
          </p>
        )}

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
          <div
            className="prose prose-sm max-w-none rounded-lg border border-border px-4 py-4 [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Penandatangan</p>
          <div className="rounded-lg border border-border px-3 py-2.5 text-sm">
            <p className="font-medium">{producerName}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Produsen</p>
          </div>
        </div>

        {!signed ? (
          <div className="space-y-3">
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-border" />
              <span>Saya telah membaca dan menyetujui seluruh syarat &amp; ketentuan di atas.</span>
            </label>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button
              type="button" disabled={pending || !agreed} onClick={sign}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              <PenLine className="h-4 w-4" />
              {pending ? "Memproses..." : "Tanda Tangan Sekarang"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-center text-sm font-medium text-green-700">Ditandatangani {fmt(signed.signedAt)}</p>
            <div className="flex items-start gap-4 rounded-lg border border-border bg-muted/5 px-4 py-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={signed.qrDataUrl} alt="QR verifikasi" width={96} height={96} className="shrink-0 rounded border border-border" />
              <div className="min-w-0 space-y-1.5">
                <p className="text-xs text-muted-foreground">URL Verifikasi</p>
                <a href={signed.verifyUrl} target="_blank" rel="noopener noreferrer" className="break-all font-mono text-xs text-primary hover:underline">
                  {signed.verifyUrl}
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
