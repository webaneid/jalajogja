"use client";

import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import {
  UploadCloud, Grid, List, Trash2, X, Search,
  Filter, FileText, Film, Image as ImageIcon, File, Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import { MediaEditModal } from "./media-edit-modal";
import type { MediaItem } from "./media-picker";

function resolveDisplayUrl(item: MediaItem): string {
  return item.variants?.thumbnail ?? item.variants?.large ?? item.url;
}

// Re-export agar page.tsx bisa import dari satu tempat
export type { MediaItem };

const MODULE_LABELS: Record<string, string> = {
  general: "Umum",
  website: "Website",
  members: "Anggota",
  letters: "Surat",
  shop: "Toko",
};

const MODULE_OPTIONS = ["general", "website", "members", "letters", "shop"] as const;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function MediaIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/")) return <ImageIcon className="h-5 w-5 text-blue-500" />;
  if (mimeType.startsWith("video/")) return <Film className="h-5 w-5 text-purple-500" />;
  if (mimeType === "application/pdf") return <FileText className="h-5 w-5 text-red-500" />;
  return <File className="h-5 w-5 text-gray-500" />;
}

export function MediaShell({
  slug,
  media: initialMedia,
  initialModule,
}: {
  slug: string;
  media: MediaItem[];
  initialModule?: string;
}) {
  const [media, setMedia] = useState<MediaItem[]>(initialMedia);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState(initialModule ?? "");
  const [uploadModule, setUploadModule] = useState<typeof MODULE_OPTIONS[number]>("general");
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [editingItem, setEditingItem] = useState<MediaItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = media.filter((m) => {
    const matchSearch =
      search === "" || m.originalName.toLowerCase().includes(search.toLowerCase());
    const matchModule = moduleFilter === "" || m.module === moduleFilter;
    return matchSearch && matchModule;
  });

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      setUploading(true);
      let successCount = 0;
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch(
          `/api/media/upload?tenant=${slug}&module=${uploadModule}`,
          { method: "POST", body: formData },
        );
        if (res.ok) {
          const data = await res.json();
          setMedia((prev) => [
            {
              id:           data.id,
              filename:     data.filename,
              originalName: data.originalName,
              mimeType:     data.mimeType,
              size:         data.size,
              path:         data.path,
              altText:      null,
              title:        null,
              caption:      null,
              description:  null,
              module:       uploadModule,
              isUsed:       false,
              createdAt:    new Date().toISOString(),
              url:          data.url,
              variants:     data.variants ?? null,
            },
            ...prev,
          ]);
          successCount++;
        } else {
          const err = await res.json();
          toast.error(`Gagal upload ${file.name}: ${err.error}`);
        }
      }
      setUploading(false);
      if (successCount > 0) toast.success(`${successCount} file berhasil diupload`);
    },
    [slug, uploadModule],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
    },
    [uploadFiles],
  );

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    setDeleting(true);
    let successCount = 0;
    for (const id of selected) {
      const res = await fetch(`/api/media/delete?tenant=${slug}&id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setMedia((prev) => prev.filter((m) => m.id !== id));
        successCount++;
      }
    }
    setSelected(new Set());
    setDeleting(false);
    if (successCount > 0) toast.success(`${successCount} file dihapus`);
  };

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Update item di local state setelah metadata disimpan
  const handleMetaSave = (updated: MediaItem) =>
    setMedia((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-card px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold">Media Library</h1>
          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={deleteSelected}
                disabled={deleting}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Hapus ({selected.size})
              </Button>
            )}
            <select
              value={uploadModule}
              onChange={(e) =>
                setUploadModule(e.target.value as typeof MODULE_OPTIONS[number])
              }
              className="text-sm border rounded-md px-2 py-1 bg-background"
            >
              {MODULE_OPTIONS.map((m) => (
                <option key={m} value={m}>{MODULE_LABELS[m]}</option>
              ))}
            </select>
            <Button
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <UploadCloud className="h-4 w-4 mr-1" />
              {uploading ? "Mengupload..." : "Upload"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              accept="image/*,application/pdf,video/mp4"
              onChange={(e) => e.target.files && uploadFiles(e.target.files)}
            />
          </div>
        </div>

        {/* Filter bar */}
        <div className="mt-3 flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari file..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="text-sm border rounded-md px-2 py-1 bg-background"
            >
              <option value="">Semua modul</option>
              {MODULE_OPTIONS.map((m) => (
                <option key={m} value={m}>{MODULE_LABELS[m]}</option>
              ))}
            </select>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded ${viewMode === "grid" ? "bg-muted" : "hover:bg-muted/50"}`}
            >
              <Grid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded ${viewMode === "list" ? "bg-muted" : "hover:bg-muted/50"}`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Konten — drop zone + grid/list */}
      <div
        className={`flex-1 overflow-y-auto p-6 relative
          ${isDragging ? "bg-primary/5 ring-2 ring-inset ring-primary" : ""}`}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
      >
        {isDragging && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="bg-background/90 border-2 border-dashed border-primary rounded-xl px-12 py-8 text-center">
              <UploadCloud className="h-10 w-10 mx-auto mb-2 text-primary" />
              <p className="font-semibold text-primary">Lepas untuk upload</p>
            </div>
          </div>
        )}

        {filtered.length === 0 ? (
          <EmptyState uploading={uploading} onUpload={() => fileInputRef.current?.click()} />
        ) : viewMode === "grid" ? (
          <GridView
            items={filtered}
            selected={selected}
            onToggle={toggleSelect}
            onEdit={setEditingItem}
          />
        ) : (
          <ListView
            items={filtered}
            selected={selected}
            onToggle={toggleSelect}
            onEdit={setEditingItem}
          />
        )}
      </div>

      {/* MediaEditModal */}
      {editingItem && (
        <MediaEditModal
          key={editingItem.id}
          media={editingItem}
          slug={slug}
          open={!!editingItem}
          onClose={() => setEditingItem(null)}
          onSave={handleMetaSave}
        />
      )}
    </div>
  );
}

function EmptyState({ uploading, onUpload }: { uploading: boolean; onUpload: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <UploadCloud className="h-12 w-12 text-muted-foreground mb-3" />
      <p className="font-medium text-muted-foreground">Belum ada file</p>
      <p className="text-sm text-muted-foreground mt-1">Drag & drop atau klik tombol Upload</p>
      <Button variant="outline" className="mt-4" onClick={onUpload} disabled={uploading}>
        Pilih File
      </Button>
    </div>
  );
}

function GridView({
  items, selected, onToggle, onEdit,
}: {
  items: MediaItem[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onEdit: (item: MediaItem) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {items.map((item) => (
        <div
          key={item.id}
          onClick={() => onToggle(item.id)}
          className={`group relative rounded-lg border cursor-pointer overflow-hidden transition-all
            ${selected.has(item.id)
              ? "ring-2 ring-primary border-primary"
              : "border-border hover:border-primary/50"}`}
        >
          <div className="aspect-square bg-muted flex items-center justify-center">
            {item.mimeType.startsWith("image/") ? (
              <Image
                src={resolveDisplayUrl(item)}
                alt={item.altText ?? item.originalName}
                width={200}
                height={200}
                className="w-full h-full object-cover"
              />
            ) : (
              <MediaIcon mimeType={item.mimeType} />
            )}
          </div>

          {selected.has(item.id) && (
            <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-primary rounded-full
                            flex items-center justify-center">
              <X className="h-3 w-3 text-primary-foreground" />
            </div>
          )}

          {/* Tombol edit — kiri atas, muncul saat hover */}
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(item); }}
            className="absolute top-1.5 left-1.5 w-6 h-6 bg-black/60 rounded flex items-center
                       justify-center opacity-0 group-hover:opacity-100 transition-opacity
                       hover:bg-black/80"
            title="Edit metadata"
          >
            <Pencil className="h-3 w-3 text-white" />
          </button>

          <div className="p-1.5">
            <p className="text-xs truncate text-muted-foreground">{item.originalName}</p>
            <p className="text-xs text-muted-foreground/60">{formatSize(item.size)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ListView({
  items, selected, onToggle, onEdit,
}: {
  items: MediaItem[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onEdit: (item: MediaItem) => void;
}) {
  return (
    <div className="divide-y border rounded-lg overflow-hidden bg-card">
      {items.map((item) => (
        <div
          key={item.id}
          onClick={() => onToggle(item.id)}
          className={`group flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors
            ${selected.has(item.id) ? "bg-primary/5" : "hover:bg-muted/50"}`}
        >
          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center
                          shrink-0 overflow-hidden">
            {item.mimeType.startsWith("image/") ? (
              <Image
                src={resolveDisplayUrl(item)}
                alt={item.altText ?? item.originalName}
                width={40}
                height={40}
                className="w-full h-full object-cover"
              />
            ) : (
              <MediaIcon mimeType={item.mimeType} />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{item.originalName}</p>
            <p className="text-xs text-muted-foreground truncate">{item.path}</p>
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
            <span className="hidden sm:block">{MODULE_LABELS[item.module] ?? item.module}</span>
            <span>{formatSize(item.size)}</span>
            <span className="hidden md:block">
              {new Date(item.createdAt).toLocaleDateString("id-ID")}
            </span>
          </div>

          {/* Tombol edit — muncul saat hover */}
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(item); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded
                       hover:bg-muted shrink-0"
            title="Edit metadata"
          >
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
          </button>

          <div className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center
            ${selected.has(item.id) ? "bg-primary border-primary" : "border-border"}`}>
            {selected.has(item.id) && <X className="h-2.5 w-2.5 text-primary-foreground" />}
          </div>
        </div>
      ))}
    </div>
  );
}
