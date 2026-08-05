"use client";

import { useState } from "react";
import { Label }    from "@/components/ui/label";
import { Input }    from "@/components/ui/input";
import { Button }   from "@/components/ui/button";
import { Switch }   from "@/components/ui/switch";
import { updateMitraShippingSettingsAction, type MitraShippingSettings } from "./actions";

type Props = {
  slug:            string;
  initialSettings: MitraShippingSettings;
};

export function MitraSettingsForm({ slug, initialSettings }: Props) {
  const [settings, setSettings] = useState<MitraShippingSettings>(initialSettings);
  const [saving,   setSaving]   = useState(false);
  const [message,  setMessage]  = useState<{ type: "success" | "error"; text: string } | null>(null);

  const set = <K extends keyof MitraShippingSettings>(k: K, v: MitraShippingSettings[K]) =>
    setSettings((s) => ({ ...s, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const result = await updateMitraShippingSettingsAction(slug, settings);
    setSaving(false);
    if ("error" in result) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: "Pengaturan berhasil disimpan." });
      setTimeout(() => setMessage(null), 3000);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="mitra-cod-enabled" className="text-sm">Aktifkan Bayar di Tempat (COD)</Label>
            <p className="text-xs text-muted-foreground">
              Pembeli produk Anda bisa memilih bayar tunai saat barang diterima kurir.
            </p>
          </div>
          <Switch
            id="mitra-cod-enabled"
            checked={settings.codEnabled}
            onCheckedChange={(v: boolean) => set("codEnabled", v)}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="mitra-pickup-enabled" className="text-sm">Aktifkan Ambil Sendiri</Label>
            <p className="text-xs text-muted-foreground">
              Pembeli ambil barang langsung ke lokasi Anda — tetap wajib bayar dulu via
              transfer/QRIS.
            </p>
          </div>
          <Switch
            id="mitra-pickup-enabled"
            checked={settings.pickupEnabled}
            onCheckedChange={(v: boolean) => set("pickupEnabled", v)}
          />
        </div>

        {settings.pickupEnabled && (
          <div className="space-y-4 pl-4 border-l-2 border-primary/20">
            <div className="space-y-1.5">
              <Label htmlFor="mitra-pickup-name" className="text-sm">Nama Lokasi</Label>
              <Input
                id="mitra-pickup-name"
                value={settings.pickupLocationName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => set("pickupLocationName", e.target.value)}
                placeholder="Toko Saya, Jl. Contoh"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mitra-pickup-address" className="text-sm">Alamat Lengkap</Label>
              <textarea
                id="mitra-pickup-address"
                rows={2}
                value={settings.pickupAddress}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => set("pickupAddress", e.target.value)}
                placeholder="Jl. Contoh No. 1, Yogyakarta"
                className="w-full rounded-md border border-input bg-background px-3 py-2
                           text-sm placeholder:text-muted-foreground focus-visible:outline-none
                           focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mitra-pickup-maps" className="text-sm">Link Google Maps</Label>
              <Input
                id="mitra-pickup-maps"
                type="url"
                value={settings.pickupMapsUrl}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => set("pickupMapsUrl", e.target.value)}
                placeholder="https://maps.app.goo.gl/..."
                className="h-9 text-sm"
              />
            </div>
          </div>
        )}
      </section>

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={saving}>
          {saving ? "Menyimpan..." : "Simpan Pengaturan"}
        </Button>
        {message && (
          <p className={`text-sm ${message.type === "success" ? "text-green-600" : "text-destructive"}`}>
            {message.text}
          </p>
        )}
      </div>
    </form>
  );
}
