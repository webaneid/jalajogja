"use client";

// ProofUploadField — upload bukti transfer / tanda terima untuk pencatatan pemasukan
// manual admin. Label & placeholder dinamis dari caller (beda teks utk cash vs transfer/qris),
// tapi mekanismenya sama: upload ke /api/finance/payment-proof, hasil URL dikirim ke onUploaded.

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";

type Props = {
  slug:        string;
  label:       string;
  hint:        string;
  onUploaded:  (url: string | null) => void;
};

export function ProofUploadField({ slug, label, hint, onUploaded }: Props) {
  const [preview, setPreview]   = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError]       = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    onUploaded(null);
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res  = await fetch(`/api/finance/payment-proof?tenant=${encodeURIComponent(slug)}`, {
        method: "POST", body: fd,
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Gagal upload file.");
        setPreview(null);
      } else {
        onUploaded(data.url);
      }
    } catch {
      setError("Gagal upload file.");
      setPreview(null);
    }
    setUploading(false);
  }

  function clear() {
    setPreview(null);
    setError("");
    onUploaded(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div>
      <label className="block text-sm font-medium mb-1">
        {label} <span className="text-muted-foreground text-xs">(opsional)</span>
      </label>

      {!preview ? (
        <label className="flex flex-col items-center gap-2 rounded-md border-2 border-dashed border-border px-4 py-6 text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground cursor-pointer transition-colors">
          <ImagePlus size={22} />
          <span>Klik untuk pilih foto</span>
          <span className="text-xs">{hint}</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
      ) : (
        <div className="relative rounded-md overflow-hidden border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt={label} className="w-full max-h-56 object-contain bg-muted/20" />
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70">
              <Loader2 size={26} className="animate-spin text-primary" />
            </div>
          )}
          {!uploading && (
            <button
              type="button"
              onClick={clear}
              className="absolute top-2 right-2 rounded-full bg-background/80 p-1 text-muted-foreground hover:text-destructive border border-border"
              title="Hapus foto"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
