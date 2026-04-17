"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { restoreVersionAction, uploadNewVersionAction } from "@/app/(dashboard)/[tenant]/dokumen/actions";
import { MediaPicker, type MediaItem } from "@/components/media/media-picker";
import { FileDown, RotateCcw, Upload, CheckCircle2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type VersionRow = {
  id:            string;
  versionNumber: number;
  fileName:      string;
  fileSize:      number | null;
  mimeType:      string | null;
  notes:         string | null;
  uploaderName:  string | null;
  createdAt:     Date;
  isCurrent:     boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(d));
}

// ─── DokumenVersionHistory ────────────────────────────────────────────────────

export function DokumenVersionHistory({
  slug,
  documentId,
  versions,
}: {
  slug:       string;
  documentId: string;
  versions:   VersionRow[];
}) {
  const router = useRouter();
  const [pickerOpen,  setPickerOpen]  = useState(false);
  const [versionNotes, setVersionNotes] = useState("");
  const [isPending,   startTransition] = useTransition();
  const [restoringId, setRestoringId] = useState<string | null>(null);

  function handleRestore(versionId: string) {
    if (!confirm("Jadikan versi ini sebagai versi aktif?")) return;
    setRestoringId(versionId);
    startTransition(async () => {
      await restoreVersionAction(slug, documentId, versionId);
      setRestoringId(null);
      router.refresh();
    });
  }

  function handleFileSelect(media: MediaItem) {
    setPickerOpen(false);
    startTransition(async () => {
      await uploadNewVersionAction(slug, documentId, {
        fileId:   media.id,
        fileName: media.originalName ?? media.filename,
        fileSize: media.size ?? null,
        mimeType: media.mimeType ?? null,
        notes:    versionNotes.trim() || null,
      });
      setVersionNotes("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Riwayat Versi ({versions.length})</p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={versionNotes}
            onChange={(e) => setVersionNotes(e.target.value)}
            placeholder="Catatan versi baru (opsional)"
            className="text-xs border border-border rounded-md px-2.5 py-1.5 w-48 focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPickerOpen(true)}
            disabled={isPending}
          >
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Upload Versi Baru
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        {versions.map((v) => (
          <div
            key={v.id}
            className={`flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 ${
              v.isCurrent ? "bg-primary/5" : "hover:bg-muted/20"
            } transition-colors`}
          >
            <div className="shrink-0">
              {v.isCurrent ? (
                <CheckCircle2 className="h-4 w-4 text-primary" />
              ) : (
                <div className="h-4 w-4 rounded-full border-2 border-border" />
              )}
            </div>

            <div className="flex-1 min-w-0 space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">v{v.versionNumber}</span>
                {v.isCurrent && <Badge variant="default" className="text-xs py-0">Aktif</Badge>}
                <span className="text-xs text-muted-foreground truncate">{v.fileName}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{formatDate(v.createdAt)}</span>
                <span>{formatBytes(v.fileSize)}</span>
                {v.uploaderName && <span>oleh {v.uploaderName}</span>}
                {v.notes && <span className="italic">"{v.notes}"</span>}
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <a
                href={`/api/documents/${documentId}/file?slug=${slug}&version=${v.id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <FileDown className="h-3.5 w-3.5" />
                </Button>
              </a>
              {!v.isCurrent && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={() => handleRestore(v.id)}
                  disabled={isPending && restoringId === v.id}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <MediaPicker
        slug={slug}
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleFileSelect}
        accept={["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]}
      />
    </div>
  );
}
