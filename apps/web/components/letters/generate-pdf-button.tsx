"use client";

import { useState } from "react";
import { FileDown, Loader2, ExternalLink } from "lucide-react";

type Props = {
  slug:     string;
  letterId: string;
  existingPdfUrl?: string | null;
};

export function GeneratePdfButton({ slug, letterId, existingPdfUrl }: Props) {
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [pdfUrl, setPdfUrl]       = useState(existingPdfUrl ?? null);

  async function handleGenerate() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/letters/${letterId}/generate-pdf?slug=${encodeURIComponent(slug)}`, {
        method: "POST",
      });
      const data = await res.json() as { success?: boolean; pdfUrl?: string; error?: string };

      if (!res.ok || !data.success) {
        setError(data.error ?? "Gagal generate PDF");
        return;
      }

      setPdfUrl(data.pdfUrl ?? null);

      // Auto-download
      if (data.pdfUrl) {
        const link = document.createElement("a");
        link.href   = data.pdfUrl;
        link.target = "_blank";
        link.rel    = "noopener noreferrer";
        link.click();
      }
    } catch {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted/40 disabled:opacity-60"
        title="Generate & unduh PDF surat"
      >
        {loading
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <FileDown className="h-3.5 w-3.5" />
        }
        {loading ? "Membuat PDF…" : "Unduh PDF"}
      </button>

      {pdfUrl && !loading && (
        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          title="Buka PDF terakhir"
        >
          <ExternalLink className="h-3 w-3" />
          Buka PDF
        </a>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
