"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MediaItem } from "./media-picker";

type SaveStatus = "idle" | "saving" | "saved" | "error";

type Props = {
  media:            MediaItem;
  slug:             string;
  onChange:         (updated: MediaItem) => void;
  showDescription?: boolean;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaDetailPanel({
  media,
  slug,
  onChange,
  showDescription = false,
}: Props) {
  const [fields, setFields] = useState({
    altText:     media.altText     ?? "",
    title:       media.title       ?? "",
    caption:     media.caption     ?? "",
    description: media.description ?? "",
  });
  const [status, setStatus]   = useState<SaveStatus>("idle");
  const isDirty               = useRef(false);
  const timerRef              = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef         = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Autosave debounce — hanya jalan setelah user input pertama
  useEffect(() => {
    if (!isDirty.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setStatus("saving");
      try {
        const res = await fetch(`/api/media/${media.id}/metadata`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ tenant: slug, ...fields }),
        });
        if (!res.ok) throw new Error("save failed");
        const updated: MediaItem = await res.json();
        onChange(updated);
        setStatus("saved");
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        savedTimerRef.current = setTimeout(() => setStatus("idle"), 2000);
      } catch {
        setStatus("error");
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields]);

  const set =
    (k: keyof typeof fields) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      isDirty.current = true;
      setFields((prev) => ({ ...prev, [k]: e.target.value }));
    };

  const isImage = media.mimeType.startsWith("image/");

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Preview */}
      <div className="shrink-0 bg-muted flex items-center justify-center" style={{ aspectRatio: "16/9" }}>
        {isImage ? (
          <div className="relative w-full h-full">
            <Image
              src={media.variants?.thumbnail ?? media.url}
              alt={media.altText ?? media.originalName}
              fill
              sizes="320px"
              className="object-contain"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 p-4 text-center">
            <span className="text-3xl">📄</span>
            <p className="text-xs text-muted-foreground break-all">{media.originalName}</p>
          </div>
        )}
      </div>

      {/* File info */}
      <div className="px-4 py-3 border-b border-border">
        <p className="text-xs font-medium truncate">{media.originalName}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatSize(media.size)} · {media.mimeType}
        </p>
      </div>

      {/* Form */}
      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        <div className="space-y-1.5">
          <Label htmlFor={`alt-${media.id}`} className="text-xs">
            Alt Text{" "}
            <span className="text-muted-foreground font-normal">(SEO & aksesibilitas)</span>
          </Label>
          <Input
            id={`alt-${media.id}`}
            value={fields.altText}
            onChange={set("altText")}
            placeholder="Foto wisuda santri angkatan 2024"
            className="h-8 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`title-${media.id}`} className="text-xs">Title</Label>
          <Input
            id={`title-${media.id}`}
            value={fields.title}
            onChange={set("title")}
            placeholder="Wisuda Santri 2024"
            className="h-8 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`caption-${media.id}`} className="text-xs">Caption</Label>
          <textarea
            id={`caption-${media.id}`}
            value={fields.caption}
            onChange={set("caption")}
            placeholder="Para santri saat prosesi wisuda..."
            rows={2}
            className="w-full rounded-md border border-input bg-background px-3 py-2
                       text-sm placeholder:text-muted-foreground focus-visible:outline-none
                       focus-visible:ring-2 focus-visible:ring-ring resize-none"
          />
        </div>

        {showDescription && (
          <div className="space-y-1.5">
            <Label htmlFor={`desc-${media.id}`} className="text-xs">
              Deskripsi{" "}
              <span className="text-muted-foreground font-normal">(schema.org)</span>
            </Label>
            <textarea
              id={`desc-${media.id}`}
              value={fields.description}
              onChange={set("description")}
              placeholder="Deskripsi lengkap untuk structured data..."
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2
                         text-sm placeholder:text-muted-foreground focus-visible:outline-none
                         focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>
        )}
      </div>

      {/* Autosave indicator */}
      <div className="px-4 pb-3 h-7 flex items-center justify-end shrink-0">
        {status === "saving" && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Menyimpan...
          </span>
        )}
        {status === "saved" && (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <CheckCircle2 className="h-3 w-3" /> Tersimpan
          </span>
        )}
        {status === "error" && (
          <span className="flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="h-3 w-3" /> Gagal simpan
          </span>
        )}
      </div>
    </div>
  );
}
