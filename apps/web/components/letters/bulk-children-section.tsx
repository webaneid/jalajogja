"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, Send, Loader2, ExternalLink, FileDown } from "lucide-react";
import { markAllChildrenSentAction } from "@/app/(dashboard)/[tenant]/letters/actions";

type ChildLetter = {
  id:           string;
  letterNumber: string | null;
  recipient:    string;
  status:       "draft" | "sent" | "archived";
};

type Props = {
  slug:             string;
  parentId:         string;
  isAdmin:          boolean;
  initialChildren:  ChildLetter[];
};

const STATUS_LABELS: Record<string, string> = {
  draft:    "Draft",
  sent:     "Terkirim",
  archived: "Diarsipkan",
};

const STATUS_COLORS: Record<string, string> = {
  draft:    "bg-zinc-100 text-zinc-600",
  sent:     "bg-blue-100 text-blue-700",
  archived: "bg-yellow-100 text-yellow-700",
};

export function BulkChildrenSection({ slug, parentId, isAdmin, initialChildren }: Props) {
  const [children, setChildren]       = useState<ChildLetter[]>(initialChildren);
  const [error, setError]             = useState("");
  const [pending, startTransition]    = useTransition();
  const [pdfFiring, setPdfFiring]     = useState(false);
  const [pdfMessage, setPdfMessage]   = useState("");

  const draftCount = children.filter((c) => c.status === "draft").length;

  function handleGenerateAllPdf() {
    if (!confirm(`Generate PDF untuk semua ${children.length} salinan surat? Proses berjalan di background.`)) return;
    setPdfFiring(true);
    setPdfMessage(`Memulai generate ${children.length} PDF…`);

    // Fire and forget — tidak perlu tunggu selesai
    void Promise.allSettled(
      children.map((c) =>
        fetch(`/api/letters/${c.id}/generate-pdf?slug=${encodeURIComponent(slug)}`, {
          method: "POST",
        }).catch(() => null)
      )
    ).then(() => {
      setPdfFiring(false);
      setPdfMessage(`${children.length} PDF selesai di-generate. Refresh halaman untuk mengunduh.`);
    });

    // Re-enable tombol setelah 2 detik agar tidak klik ganda
    setTimeout(() => setPdfFiring(false), 2000);
  }

  function handleMarkAllSent() {
    if (!confirm(`Tandai ${draftCount} salinan menjadi "Terkirim"?`)) return;
    setError("");

    startTransition(async () => {
      const res = await markAllChildrenSentAction(slug, parentId);
      if (res.success) {
        setChildren((prev) =>
          prev.map((c) => c.status === "draft" ? { ...c, status: "sent" as const } : c)
        );
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-3">
      {/* Toolbar: Generate Semua PDF + Tandai Semua Terkirim */}
      {isAdmin && children.length > 0 && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-muted-foreground">
            {draftCount > 0
              ? `${draftCount} salinan masih berstatus Draft`
              : `Semua ${children.length} salinan sudah terkirim`
            }
          </p>
          <div className="flex items-center gap-2">
            {/* Generate Semua PDF */}
            <button
              type="button"
              onClick={handleGenerateAllPdf}
              disabled={pdfFiring}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted/40 disabled:opacity-60"
            >
              {pdfFiring
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <FileDown className="h-3.5 w-3.5" />
              }
              Generate Semua PDF
            </button>

            {/* Tandai Semua Terkirim — hanya jika masih ada draft */}
            {draftCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllSent}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {pending
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Send className="h-3.5 w-3.5" />
                }
                Tandai Semua Terkirim
              </button>
            )}
          </div>
        </div>
      )}

      {pdfMessage && (
        <p className="text-xs text-muted-foreground">{pdfMessage}</p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Daftar anak */}
      <div className="divide-y divide-border rounded-lg border border-border overflow-hidden text-sm">
        {children.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            Belum ada salinan surat.
          </div>
        ) : (
          children.map((c) => (
            <div key={c.id} className="flex items-center justify-between px-4 py-2.5 gap-4">
              {/* Icon status */}
              {c.status === "sent"
                ? <CheckCircle2 className="h-4 w-4 text-blue-500 shrink-0" />
                : <Clock className="h-4 w-4 text-zinc-400 shrink-0" />
              }

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{c.recipient}</p>
                {c.letterNumber && (
                  <p className="font-mono text-xs text-muted-foreground">{c.letterNumber}</p>
                )}
              </div>

              {/* Status badge + link */}
              <div className="flex items-center gap-2 shrink-0">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[c.status] ?? "bg-muted text-muted-foreground"}`}>
                  {STATUS_LABELS[c.status] ?? c.status}
                </span>
                <Link
                  href={`/${slug}/letters/keluar/${c.id}`}
                  title="Buka salinan ini"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
