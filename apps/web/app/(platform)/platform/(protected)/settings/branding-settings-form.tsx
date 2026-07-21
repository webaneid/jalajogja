"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePlatformBrandingAction } from "../actions";

type Props = {
  initialOrgName: string;
  initialLogoUrl: string | null;
};

// Form branding default IKPM — fallback untuk MemberCard `/akun` saat cabang resmi
// member belum onboard jadi tenant. Lihat docs/arsitektur-akun.md § Resolusi Branding
// Kartu Anggota. Upload logo langsung ke /api/platform/settings/upload-logo (path fixed,
// bukan bagian modul media tenant — tidak pakai MediaPicker).
export function BrandingSettingsForm({ initialOrgName, initialLogoUrl }: Props) {
  const [orgName, setOrgName] = useState(initialOrgName);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/platform/settings/upload-logo", { method: "POST", body: form });
      const data = await res.json() as { url?: string; error?: string };
      if (res.ok && data.url) {
        setLogoUrl(data.url);
        toast.success("Logo berhasil diupload — klik Simpan untuk menerapkan.");
      } else {
        toast.error(data.error ?? "Gagal upload logo.");
      }
    } catch {
      toast.error("Gagal upload logo.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleSave() {
    startTransition(async () => {
      const form = new FormData();
      form.append("defaultOrgName", orgName);
      form.append("defaultLogoUrl", logoUrl ?? "");
      const res = await updatePlatformBrandingAction(form);
      if ("error" in res) {
        toast.error(res.error);
      } else {
        toast.success("Branding default IKPM disimpan.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Branding Default IKPM</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Logo + nama fallback yang tampil di kartu anggota (<code className="bg-muted px-1 py-0.5 rounded text-xs">/akun</code>)
          untuk anggota yang cabang resminya belum onboard jadi tenant.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Logo</Label>
        {logoUrl ? (
          <div className="flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt="Logo default IKPM" className="max-h-16 rounded border object-contain bg-muted p-1" />
            <div className="flex flex-col gap-1.5">
              <Button type="button" variant="outline" size="sm" disabled={uploading}
                onClick={() => fileInputRef.current?.click()}>
                {uploading ? "Mengupload..." : "Ganti"}
              </Button>
              <button type="button" onClick={() => setLogoUrl(null)}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors text-left">
                Hapus
              </button>
            </div>
          </div>
        ) : (
          <Button type="button" variant="outline" size="sm" disabled={uploading}
            onClick={() => fileInputRef.current?.click()}>
            {uploading ? "Mengupload..." : "Pilih Logo"}
          </Button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { void handleFileChange(e); }}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="defaultOrgName">Nama Organisasi</Label>
        <Input
          id="defaultOrgName"
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          placeholder="IKPM Gontor"
        />
      </div>

      <Button type="button" size="sm" disabled={pending || uploading} onClick={handleSave}>
        {pending ? "Menyimpan..." : "Simpan"}
      </Button>
    </div>
  );
}
