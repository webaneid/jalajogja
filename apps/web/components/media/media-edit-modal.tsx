"use client";

import { useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MediaItem } from "./media-picker";

interface MediaEditModalProps {
  media: MediaItem;
  slug: string;
  open: boolean;
  onClose: () => void;
  onSave: (updated: MediaItem) => void;
}

export function MediaEditModal({
  media,
  slug,
  open,
  onClose,
  onSave,
}: MediaEditModalProps) {
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState({
    altText:     media.altText     ?? "",
    title:       media.title       ?? "",
    caption:     media.caption     ?? "",
    description: media.description ?? "",
  });

  const set =
    (k: keyof typeof fields) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setFields((prev) => ({ ...prev, [k]: e.target.value }));

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/media/${media.id}/metadata`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant: slug, ...fields }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Gagal menyimpan metadata");
        return;
      }

      const updated: MediaItem = await res.json();
      toast.success("Metadata disimpan");
      onSave(updated);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const isImage = media.mimeType.startsWith("image/");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl gap-0 p-0" showCloseButton={false}>
        <DialogHeader className="px-6 pt-5 pb-4 border-b">
          <DialogTitle>Edit Metadata</DialogTitle>
        </DialogHeader>

        <div className="flex overflow-hidden">
          {/* Preview kiri — hanya untuk gambar */}
          {isImage && (
            <div className="w-48 shrink-0 bg-muted flex items-center justify-center border-r p-3">
              <div className="relative w-full aspect-square rounded overflow-hidden">
                <Image
                  src={media.url}
                  alt={media.altText ?? media.originalName}
                  fill
                  sizes="192px"
                  className="object-contain"
                />
              </div>
            </div>
          )}

          {/* Form kanan */}
          <div className="flex-1 p-6 space-y-4 overflow-y-auto max-h-[480px]">
            {/* Nama file (read-only, referensi) */}
            <p className="text-xs text-muted-foreground truncate">
              {media.originalName} · {(media.size / 1024).toFixed(1)} KB
            </p>

            {/* Alt Text */}
            <div className="space-y-1.5">
              <Label htmlFor="altText">
                Alt Text
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  (aksesibilitas)
                </span>
              </Label>
              <Input
                id="altText"
                value={fields.altText}
                onChange={set("altText")}
                placeholder="Foto wisuda santri 2024"
              />
              <p className="text-xs text-muted-foreground">
                Deskripsi singkat gambar untuk screen reader dan SEO.
              </p>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={fields.title}
                onChange={set("title")}
                placeholder="Wisuda Santri Angkatan 2024"
              />
              <p className="text-xs text-muted-foreground">
                Ditampilkan saat hover pada gambar.
              </p>
            </div>

            {/* Caption */}
            <div className="space-y-1.5">
              <Label htmlFor="caption">Caption</Label>
              <textarea
                id="caption"
                value={fields.caption}
                onChange={set("caption")}
                placeholder="Para santri angkatan 2024 saat prosesi wisuda di aula utama."
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2
                           text-sm placeholder:text-muted-foreground focus-visible:outline-none
                           focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Teks di bawah gambar dalam artikel.
              </p>
            </div>

            {/* Deskripsi */}
            <div className="space-y-1.5">
              <Label htmlFor="description">Deskripsi</Label>
              <textarea
                id="description"
                value={fields.description}
                onChange={set("description")}
                placeholder="Deskripsi lengkap untuk keperluan SEO..."
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2
                           text-sm placeholder:text-muted-foreground focus-visible:outline-none
                           focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Untuk SEO dan schema.org ImageObject.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
