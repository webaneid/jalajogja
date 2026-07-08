"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams }     from "next/navigation";
import Image             from "next/image";
import { UploadCloud, Loader2, Trash2, ArrowLeft } from "lucide-react";
import { toast }         from "sonner";
import { compressImage } from "@/lib/client-image-compress";
import type { MemberMediaItem } from "@/components/media/member-media-picker";

export default function AkunMediaPage() {
  const { tenant: slug } = useParams<{ tenant: string }>();

  const [media, setMedia]       = useState<MemberMediaItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchMedia(); }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchMedia(page = 0) {
    setLoading(true);
    const res = await fetch(`/api/akun/media?tenant=${slug}&page=${page}`);
    if (res.ok) {
      const data = await res.json();
      setMedia(data.data ?? []);
    }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus foto ini?")) return;
    setDeleting(id);
    const res = await fetch(`/api/akun/media/${id}?tenant=${slug}`, { method: "DELETE" });
    if (res.ok) {
      setMedia((prev) => prev.filter((m) => m.id !== id));
      toast.success("Foto dihapus.");
    } else {
      toast.error("Gagal menghapus foto.");
    }
    setDeleting(null);
  }

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      setUploading(true);
      for (const file of Array.from(files)) {
        const compressed = await compressImage(file);
        if (compressed.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} terlalu besar setelah kompresi (maks 10 MB)`);
          continue;
        }
        const form = new FormData();
        form.append("file", compressed);
        const res = await fetch(`/api/akun/media/upload?tenant=${slug}`, {
          method: "POST",
          body:   form,
        });
        if (res.ok) {
          const data = await res.json();
          setMedia((prev) => [{
            id:           data.id,
            filename:     data.filename ?? file.name,
            originalName: file.name,
            mimeType:     file.type,
            url:          data.url,
            variants:     data.variants ?? null,
            createdAt:    new Date().toISOString(),
          }, ...prev]);
          toast.success(`${file.name} berhasil diupload.`);
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

  function resolveThumb(item: MemberMediaItem) {
    return item.variants?.square ?? item.variants?.large ?? item.url;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <a href="../" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="size-4" />
        </a>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Foto Saya</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Foto yang Anda upload — hanya Anda yang dapat melihatnya
          </p>
        </div>
      </div>

      {/* Upload zone */}
      <div
        className={`border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-3
          py-10 cursor-pointer transition-colors
          ${isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/20"}`}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onClick={() => fileInputRef.current?.click()}
      >
        {uploading ? (
          <>
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Mengupload...</p>
          </>
        ) : (
          <>
            <UploadCloud className="h-8 w-8 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-medium">Drag & drop foto ke sini</p>
              <p className="text-xs text-muted-foreground mt-0.5">atau klik untuk pilih file · JPG, PNG, WebP, HEIC · Maks 10 MB</p>
            </div>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept="image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif"
          onChange={(e) => e.target.files && uploadFiles(e.target.files)}
        />
      </div>

      {/* Grid foto */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : media.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          Belum ada foto. Upload foto pertama Anda di atas.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {media.map((item) => (
            <div key={item.id} className="group relative aspect-square rounded-lg border border-border overflow-hidden bg-muted">
              {item.mimeType.startsWith("image/") ? (
                <Image
                  src={resolveThumb(item)}
                  alt={item.originalName}
                  fill
                  sizes="200px"
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-xs text-muted-foreground text-center px-2 break-all line-clamp-3">
                    {item.originalName}
                  </span>
                </div>
              )}

              {/* Overlay tombol hapus */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <button
                  onClick={() => { void handleDelete(item.id); }}
                  disabled={deleting === item.id}
                  className="opacity-0 group-hover:opacity-100 transition-opacity w-8 h-8 bg-destructive rounded-full
                             flex items-center justify-center text-white hover:bg-destructive/90 disabled:opacity-50"
                  title="Hapus"
                >
                  {deleting === item.id
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Trash2 className="h-3.5 w-3.5" />}
                </button>
              </div>

              {/* Nama file di bawah */}
              <div className="absolute bottom-0 inset-x-0 bg-black/50 px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-xs text-white truncate">{item.originalName}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
