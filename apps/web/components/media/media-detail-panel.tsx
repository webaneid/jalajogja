"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Loader2, CheckCircle2, AlertCircle, Crop as CropIcon, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MediaItem } from "./media-picker";

type SaveStatus = "idle" | "saving" | "saved" | "error";
type CropStatus = "idle" | "applying" | "done" | "error";

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
  // ── Metadata autosave ──────────────────────────────────────────────────────
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
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields]);

  const set = (k: keyof typeof fields) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      isDirty.current = true;
      setFields((prev) => ({ ...prev, [k]: e.target.value }));
    };

  // ── Crop editor ────────────────────────────────────────────────────────────
  const [cropMode, setCropMode]       = useState(false);
  const [crop, setCrop]               = useState<Crop>();
  const [cropVariant, setCropVariant] = useState<string>("all");
  const [cropStatus, setCropStatus]   = useState<CropStatus>("idle");
  const imgRef                        = useRef<HTMLImageElement>(null);

  const isImage     = media.mimeType.startsWith("image/");
  const hasOriginal = !!media.variants?.original;

  // Inisialisasi crop di tengah saat gambar dimuat
  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
    setCrop(centerCrop(makeAspectCrop({ unit: "%", width: 80 }, w / h, w, h), w, h));
  }, []);

  const applyCrop = async () => {
    if (!crop || !imgRef.current) return;
    const { naturalWidth: imgW, naturalHeight: imgH } = imgRef.current;

    // Konversi pixel crop ke persen (0–100)
    const px = crop.unit === "px" ? crop : {
      x:      crop.x      / 100 * imgW,
      y:      crop.y      / 100 * imgH,
      width:  crop.width  / 100 * imgW,
      height: crop.height / 100 * imgH,
    };

    setCropStatus("applying");
    try {
      const res = await fetch(`/api/media/${media.id}/recrop?slug=${slug}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          cropData: {
            x:       (px.x / imgW) * 100,
            y:       (px.y / imgH) * 100,
            width:   (px.width  / imgW) * 100,
            height:  (px.height / imgH) * 100,
            variant: cropVariant,
          },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Gagal");
      }
      const data = await res.json() as { variants: Record<string, string> };
      onChange({ ...media, variants: { ...media.variants, ...data.variants } });
      setCropStatus("done");
      setTimeout(() => { setCropMode(false); setCropStatus("idle"); }, 1500);
    } catch (err) {
      console.error(err);
      setCropStatus("error");
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Preview / Crop Editor */}
      {cropMode && hasOriginal ? (
        <div className="shrink-0 bg-muted p-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium">Edit Crop</p>
            <button
              type="button"
              onClick={() => { setCropMode(false); setCropStatus("idle"); }}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <ReactCrop crop={crop} onChange={setCrop} className="w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={media.variants?.original ?? media.url}
              alt="crop"
              onLoad={onImageLoad}
              className="w-full"
            />
          </ReactCrop>

          <div className="flex items-center gap-2">
            <select
              value={cropVariant}
              onChange={(e) => setCropVariant(e.target.value)}
              className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="all">Semua variant</option>
              {Object.keys(media.variants ?? {})
                .filter((k) => k !== "original")
                .map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
            <button
              type="button"
              onClick={applyCrop}
              disabled={cropStatus === "applying"}
              className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium
                         hover:bg-primary/90 disabled:opacity-60 flex items-center gap-1.5"
            >
              {cropStatus === "applying"
                ? <><Loader2 className="h-3 w-3 animate-spin" /> Memproses...</>
                : cropStatus === "done"
                ? <><CheckCircle2 className="h-3 w-3" /> Selesai</>
                : cropStatus === "error"
                ? "Gagal, coba lagi"
                : "Terapkan"}
            </button>
          </div>
          {cropStatus === "error" && (
            <p className="text-xs text-destructive">
              Gagal menerapkan crop. Pastikan file original belum dihapus (&lt;10 hari).
            </p>
          )}
        </div>
      ) : (
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
      )}

      {/* File info + tombol Edit Crop */}
      <div className="px-4 py-3 border-b border-border flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium truncate">{media.originalName}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatSize(media.size)} · {media.mimeType}
          </p>
        </div>
        {isImage && (
          <button
            type="button"
            onClick={() => hasOriginal ? setCropMode((v) => !v) : undefined}
            title={hasOriginal ? "Edit area crop" : "Original sudah dihapus (>10 hari)"}
            className={[
              "shrink-0 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px]",
              hasOriginal
                ? "border-border text-muted-foreground hover:text-foreground hover:border-primary cursor-pointer"
                : "border-border text-muted-foreground/40 cursor-not-allowed",
            ].join(" ")}
          >
            <CropIcon className="h-3 w-3" />
            {cropMode ? "Tutup" : "Crop"}
          </button>
        )}
      </div>

      {/* Form metadata */}
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
