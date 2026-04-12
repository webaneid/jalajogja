"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { UploadCloud, Search, CheckCircle2, Loader2, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MediaEditModal } from "./media-edit-modal";

// ── Types ──────────────────────────────────────────────────────────────────────

export type MediaItem = {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  altText: string | null;
  title: string | null;
  caption: string | null;
  description: string | null;
  module: string;
  isUsed: boolean;
  createdAt: string;
  url: string;
};

export interface MediaPickerProps {
  slug: string;
  open: boolean;
  onClose: () => void;
  onSelect: (media: MediaItem) => void;
  module?: string;      // pre-filter modul (opsional)
  accept?: string[];    // filter mime type, misal ["image/"] (opsional)
  multiple?: boolean;   // default false
}

// ── Constants ──────────────────────────────────────────────────────────────────

const MODULE_LABELS: Record<string, string> = {
  general: "Umum",
  website: "Website",
  members: "Anggota",
  letters: "Surat",
  shop: "Toko",
};
const MODULE_OPTIONS = ["general", "website", "members", "letters", "shop"] as const;

// ── MediaPicker ────────────────────────────────────────────────────────────────

export function MediaPicker({
  slug,
  open,
  onClose,
  onSelect,
  module: defaultModule,
  accept,
  multiple = false,
}: MediaPickerProps) {
  const [activeTab, setActiveTab] = useState<"library" | "upload">("library");
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState(defaultModule ?? "");
  const [uploadModule, setUploadModule] = useState(defaultModule ?? "general");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingItem, setEditingItem] = useState<MediaItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch media list setiap kali dialog dibuka
  useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    setSearch("");
    setActiveTab("library");
    fetchMedia();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function fetchMedia() {
    setLoading(true);
    const res = await fetch(`/api/media/list?tenant=${slug}`);
    if (res.ok) setMedia(await res.json());
    setLoading(false);
  }

  // Filter client-side: search + modul + accept MIME
  const filtered = media.filter((m) => {
    const matchSearch =
      search === "" || m.originalName.toLowerCase().includes(search.toLowerCase());
    const matchModule = moduleFilter === "" || m.module === moduleFilter;
    const matchAccept =
      !accept ||
      accept.some((a) => m.mimeType.startsWith(a.replace("/*", "").replace("*", "")));
    return matchSearch && matchModule && matchAccept;
  });

  function toggleSelect(id: string) {
    setSelected((prev) => {
      if (multiple) {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }
      return prev.has(id) ? new Set() : new Set([id]);
    });
  }

  function handleConfirm() {
    const items = media.filter((m) => selected.has(m.id));
    if (!items.length) return;
    items.forEach((item) => onSelect(item));
    onClose();
  }

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      setUploading(true);
      const newIds: string[] = [];

      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(
          `/api/media/upload?tenant=${slug}&module=${uploadModule}`,
          { method: "POST", body: form },
        );
        if (res.ok) {
          const data = await res.json();
          setMedia((prev) => [
            {
              id: data.id,
              filename: data.filename,
              originalName: data.originalName,
              mimeType: data.mimeType,
              size: data.size,
              path: data.path,
              altText: null,
              title: null,
              caption: null,
              description: null,
              module: uploadModule,
              isUsed: false,
              createdAt: new Date().toISOString(),
              url: data.url,
            },
            ...prev,
          ]);
          newIds.push(data.id);
        } else {
          const err = await res.json();
          toast.error(`Gagal upload ${file.name}: ${err.error}`);
        }
      }

      setUploading(false);
      if (newIds.length > 0) {
        toast.success(`${newIds.length} file berhasil diupload`);
        // Auto-select file baru + pindah ke tab Library
        setSelected(new Set(multiple ? newIds : [newIds[0]]));
        setActiveTab("library");
      }
    },
    [slug, uploadModule, multiple],
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
    <>
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl p-0 gap-0" showCloseButton={false}>
        <DialogHeader className="px-6 pt-5 pb-0">
          <DialogTitle>Pilih Media</DialogTitle>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "library" | "upload")}
          className="flex flex-col"
        >
          <div className="px-6 pt-3">
            <TabsList>
              <TabsTrigger value="library">Library</TabsTrigger>
              <TabsTrigger value="upload">Upload Baru</TabsTrigger>
            </TabsList>
          </div>

          {/* ── Tab Library ── */}
          <TabsContent value="library" className="m-0">
            {/* Filter bar */}
            <div className="flex items-center gap-3 px-6 py-3 border-b">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari file..."
                  value={search}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setSearch(e.target.value)
                  }
                  className="pl-8 h-8"
                />
              </div>
              <select
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
                className="text-sm border rounded-md px-2 py-1 bg-background h-8"
              >
                <option value="">Semua modul</option>
                {MODULE_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {MODULE_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>

            {/* Grid thumbnail */}
            <div className="h-[400px] overflow-y-auto p-4">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2">
                  <p className="text-sm text-muted-foreground">Tidak ada file</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab("upload")}
                  >
                    Upload File
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
                  {filtered.map((item) => (
                    <MediaThumb
                      key={item.id}
                      item={item}
                      isSelected={selected.has(item.id)}
                      onClick={() => toggleSelect(item.id)}
                      onEdit={setEditingItem}
                    />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── Tab Upload Baru ── */}
          <TabsContent value="upload" className="m-0">
            <div className="h-[464px] flex flex-col gap-3 p-6">
              {/* Selector modul upload */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Upload ke modul:</span>
                <select
                  value={uploadModule}
                  onChange={(e) => setUploadModule(e.target.value)}
                  className="text-sm border rounded-md px-2 py-1 bg-background"
                >
                  {MODULE_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {MODULE_LABELS[m]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Drop zone */}
              <div
                className={`flex-1 border-2 border-dashed rounded-xl flex flex-col items-center
                  justify-center gap-3 cursor-pointer transition-colors
                  ${
                    isDragging
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50 hover:bg-muted/30"
                  }`}
                onDrop={handleDrop}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
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
                      <p className="font-medium">Drag & drop file ke sini</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        atau klik untuk pilih file
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Gambar, PDF, Video · Maks 10 MB per file
                    </p>
                  </>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                accept="image/*,application/pdf,video/mp4"
                onChange={(e) => e.target.files && uploadFiles(e.target.files)}
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={handleConfirm} disabled={selected.size === 0}>
            Pilih{selected.size > 0 ? ` (${selected.size})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* MediaEditModal — di luar Dialog agar tidak terjebak di z-index stack */}
    {editingItem && (
      <MediaEditModal
        key={editingItem.id}
        media={editingItem}
        slug={slug}
        open={!!editingItem}
        onClose={() => setEditingItem(null)}
        onSave={(updated) =>
          setMedia((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
        }
      />
    )}
    </>
  );
}

// ── MediaThumb ─────────────────────────────────────────────────────────────────

function MediaThumb({
  item,
  isSelected,
  onClick,
  onEdit,
}: {
  item: MediaItem;
  isSelected: boolean;
  onClick: () => void;
  onEdit: (item: MediaItem) => void;
}) {
  return (
    <div
      onClick={onClick}
      title={item.originalName}
      className={`group relative aspect-square rounded-md border cursor-pointer overflow-hidden transition-all
        ${
          isSelected
            ? "ring-2 ring-primary border-primary"
            : "border-border hover:border-primary/50"
        }`}
    >
      {item.mimeType.startsWith("image/") ? (
        <Image
          src={item.url}
          alt={item.altText ?? item.originalName}
          fill
          sizes="120px"
          className="object-cover"
        />
      ) : (
        <div className="w-full h-full bg-muted flex items-center justify-center p-1">
          <span className="text-xs text-muted-foreground text-center leading-tight break-all line-clamp-3">
            {item.originalName}
          </span>
        </div>
      )}

      {/* Overlay centang saat selected */}
      {isSelected && (
        <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
          <CheckCircle2 className="h-6 w-6 text-primary drop-shadow-md" />
        </div>
      )}

      {/* Tombol edit pensil — kiri atas, muncul saat hover */}
      <button
        onClick={(e) => { e.stopPropagation(); onEdit(item); }}
        className="absolute top-1 left-1 w-5 h-5 bg-black/60 rounded flex items-center
                   justify-center opacity-0 group-hover:opacity-100 transition-opacity
                   hover:bg-black/80"
        title="Edit metadata"
      >
        <Pencil className="h-2.5 w-2.5 text-white" />
      </button>

      {/* Nama file saat hover */}
      <div
        className="absolute bottom-0 inset-x-0 bg-black/60 px-1 py-0.5
                    opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
      >
        <p className="text-xs text-white truncate">{item.originalName}</p>
      </div>
    </div>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useMediaPicker() {
  const [open, setOpen] = useState(false);
  return {
    open,
    openPicker: () => setOpen(true),
    closePicker: () => setOpen(false),
  };
}
