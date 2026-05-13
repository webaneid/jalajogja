"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { UploadCloud, CheckCircle2, Loader2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// ── Types ───────────────────────────────────────────────────────────────────────

export type MemberMediaItem = {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  url: string;
  variants?: Record<string, string> | null;
  createdAt: string;
};

function resolveThumb(item: MemberMediaItem): string {
  return item.variants?.square ?? item.variants?.large ?? item.url;
}

export interface MemberMediaPickerProps {
  slug: string;
  open: boolean;
  onClose: () => void;
  onSelect: (item: MemberMediaItem) => void;
}

// ── MemberMediaPicker ────────────────────────────────────────────────────────────

export function MemberMediaPicker({ slug, open, onClose, onSelect }: MemberMediaPickerProps) {
  const [activeTab, setActiveTab] = useState<"library" | "upload">("library");
  const [media, setMedia]         = useState<MemberMediaItem[]>([]);
  const [loading, setLoading]     = useState(false);
  const [selected, setSelected]   = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef              = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setSelected(null);
    setActiveTab("library");
    fetchMedia();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function fetchMedia() {
    setLoading(true);
    const res = await fetch(`/api/akun/media?tenant=${slug}`);
    if (res.ok) {
      const data = await res.json();
      setMedia(data.data ?? []);
    }
    setLoading(false);
  }

  function handleConfirm() {
    const item = media.find((m) => m.id === selected);
    if (!item) return;
    onSelect(item);
    onClose();
  }

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      setUploading(true);
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(`/api/akun/media/upload?tenant=${slug}`, {
          method: "POST",
          body: form,
        });
        if (res.ok) {
          const data = await res.json();
          const newItem: MemberMediaItem = {
            id:           data.id,
            filename:     data.filename ?? file.name,
            originalName: file.name,
            mimeType:     file.type,
            url:          data.url,
            variants:     data.variants ?? null,
            createdAt:    new Date().toISOString(),
          };
          setMedia((prev) => [newItem, ...prev]);
          setSelected(data.id);
          setActiveTab("library");
        } else {
          const err = await res.json().catch(() => ({ error: "Upload gagal" }));
          toast.error(`Gagal upload ${file.name}: ${err.error}`);
        }
      }
      setUploading(false);
    },
    [slug],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
    },
    [uploadFiles],
  );

  return (
    <Dialog open={open} onOpenChange={(o: boolean) => !o && onClose()}>
      <DialogContent className="max-w-2xl p-0 gap-0" showCloseButton={false}>
        <DialogHeader className="px-6 pt-5 pb-0">
          <DialogTitle>Pilih Foto</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v: string) => setActiveTab(v as "library" | "upload")} className="flex flex-col">
          <div className="px-6 pt-3">
            <TabsList>
              <TabsTrigger value="library">Foto Saya</TabsTrigger>
              <TabsTrigger value="upload">Upload Baru</TabsTrigger>
            </TabsList>
          </div>

          {/* ── Tab Library ── */}
          <TabsContent value="library" className="m-0">
            <div className="h-[380px] overflow-y-auto p-4">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : media.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2">
                  <p className="text-sm text-muted-foreground">Belum ada foto yang diupload</p>
                  <Button variant="outline" size="sm" onClick={() => setActiveTab("upload")}>
                    Upload Foto
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {media.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setSelected(item.id === selected ? null : item.id)}
                      title={item.originalName}
                      className={`relative aspect-square rounded-lg border cursor-pointer overflow-hidden transition-all
                        ${item.id === selected
                          ? "ring-2 ring-primary border-primary"
                          : "border-border hover:border-primary/50"}`}
                    >
                      {item.mimeType.startsWith("image/") ? (
                        <Image
                          src={resolveThumb(item)}
                          alt={item.originalName}
                          fill
                          sizes="140px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <span className="text-xs text-muted-foreground text-center px-1 break-all line-clamp-3">
                            {item.originalName}
                          </span>
                        </div>
                      )}
                      {item.id === selected && (
                        <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                          <CheckCircle2 className="h-7 w-7 text-primary drop-shadow-md" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── Tab Upload ── */}
          <TabsContent value="upload" className="m-0">
            <div className="h-[380px] flex flex-col p-6">
              <div
                className={`flex-1 border-2 border-dashed rounded-xl flex flex-col items-center
                  justify-center gap-3 cursor-pointer transition-colors
                  ${isDragging
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-muted/30"}`}
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Mengupload...</p>
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-10 w-10 text-muted-foreground" />
                    <div className="text-center">
                      <p className="font-medium">Drag & drop foto ke sini</p>
                      <p className="text-sm text-muted-foreground mt-1">atau klik untuk pilih file</p>
                    </div>
                    <p className="text-xs text-muted-foreground">JPG, PNG, WebP · Maks 10 MB</p>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple={false}
                className="hidden"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={(e) => e.target.files && uploadFiles(e.target.files)}
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="px-6 py-4 border-t border-border">
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={handleConfirm} disabled={!selected}>
            Pilih Foto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Hook ────────────────────────────────────────────────────────────────────────

export function useMemberMediaPicker() {
  const [open, setOpen] = useState(false);
  return {
    open,
    openPicker:  () => setOpen(true),
    closePicker: () => setOpen(false),
  };
}

// ── CoverImageField ─────────────────────────────────────────────────────────────
// Komponen siap pakai: preview + tombol pilih/hapus foto

export function CoverImageField({
  slug,
  value,
  onChange,
  label = "Foto",
  preferVariant,
}: {
  slug:           string;
  value:          string | null | undefined;
  onChange:       (url: string | null) => void;
  label?:         string;
  preferVariant?: string;
}) {
  const { open, openPicker, closePicker } = useMemberMediaPicker();

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      {value ? (
        <div className="relative w-40 h-32 rounded-lg overflow-hidden border border-border group">
          <Image src={value} alt={label} fill sizes="160px" className="object-cover" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute top-1 right-1 w-6 h-6 bg-black/60 rounded-full flex items-center
                       justify-center opacity-0 group-hover:opacity-100 transition-opacity
                       hover:bg-black/80"
            title="Hapus foto"
          >
            <X className="h-3.5 w-3.5 text-white" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={openPicker}
          className="w-40 h-32 border-2 border-dashed border-border rounded-lg flex flex-col
                     items-center justify-center gap-2 text-muted-foreground hover:border-primary/50
                     hover:text-primary transition-colors cursor-pointer"
        >
          <UploadCloud className="h-7 w-7" />
          <span className="text-xs">Pilih Foto</span>
        </button>
      )}
      {value && (
        <Button type="button" variant="outline" size="sm" onClick={openPicker}>
          Ganti Foto
        </Button>
      )}

      <MemberMediaPicker
        slug={slug}
        open={open}
        onClose={closePicker}
        onSelect={(item) => {
          const url = (preferVariant ? item.variants?.[preferVariant] : null)
            ?? item.variants?.large
            ?? item.url;
          onChange(url);
          closePicker();
        }}
      />
    </div>
  );
}
