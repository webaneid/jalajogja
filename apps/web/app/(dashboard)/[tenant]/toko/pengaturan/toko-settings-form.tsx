"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { saveTokoSettingsAction } from "./actions";
import type { TokoSettings } from "@/lib/toko-settings";

type Props = {
  slug:            string;
  initialSettings: TokoSettings;
};

export function TokoSettingsForm({ slug, initialSettings }: Props) {
  const [settings, setSettings] = useState<TokoSettings>(initialSettings);
  const [saving,   setSaving]   = useState(false);
  const [message,  setMessage]  = useState<{ type: "success" | "error"; text: string } | null>(null);

  const set = <K extends keyof TokoSettings>(k: K, v: TokoSettings[K]) =>
    setSettings((s) => ({ ...s, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const result = await saveTokoSettingsAction(slug, settings);
    setSaving(false);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: "Pengaturan berhasil disimpan." });
      setTimeout(() => setMessage(null), 3000);
    }
  }

  // Preview kalkulasi harga mitra
  const examplePrice   = 100000;
  const komisiNominal  = Math.round(examplePrice * (settings.minKomisiMitra / 100));
  const memberPriceMax = examplePrice - komisiNominal;

  return (
    <form onSubmit={handleSubmit} className="space-y-8">

      {/* ── Sistem Mitra ───────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="pb-2 border-b border-border">
          <h2 className="text-sm font-semibold">Sistem Mitra</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Izinkan anggota IKPM berjualan produk di toko ini.
          </p>
        </div>

        {/* Toggle aktifkan mitra */}
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="mitra-enabled" className="text-sm">Aktifkan Sistem Mitra</Label>
            <p className="text-xs text-muted-foreground">
              Anggota IKPM dapat mendaftar sebagai mitra dan menjual produk.
            </p>
          </div>
          <Switch
            id="mitra-enabled"
            checked={settings.mitraEnabled}
            onCheckedChange={(v: boolean) => set("mitraEnabled", v)}
          />
        </div>

        {settings.mitraEnabled && (
          <div className="space-y-4 pl-4 border-l-2 border-primary/20">

            {/* Batas produk */}
            <div className="space-y-1.5">
              <Label htmlFor="mitra-max" className="text-sm">
                Batas Produk per Mitra
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  id="mitra-max"
                  type="number"
                  min={0}
                  max={999}
                  value={settings.mitraMaxProducts}
                  onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set("mitraMaxProducts", Number(e.target.value))}
                  className="w-28 h-8 text-sm"
                />
                <span className="text-xs text-muted-foreground">
                  produk {settings.mitraMaxProducts === 0 ? "(tidak terbatas)" : "maksimal"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Isi 0 untuk tidak membatasi jumlah produk mitra.
              </p>
            </div>

            {/* Komisi minimum */}
            <div className="space-y-1.5">
              <Label htmlFor="min-komisi" className="text-sm">
                Komisi Minimum IKPM
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  id="min-komisi"
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={settings.minKomisiMitra}
                  onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set("minKomisiMitra", Number(e.target.value))}
                  className="w-28 h-8 text-sm"
                />
                <span className="text-xs text-muted-foreground">% per transaksi</span>
              </div>

              {/* Preview kalkulasi */}
              <div className="mt-2 rounded-lg bg-muted/50 border border-border p-3 text-xs space-y-1">
                <p className="font-medium text-muted-foreground">Contoh kalkulasi:</p>
                <p>Harga produk mitra: <span className="font-medium">Rp {examplePrice.toLocaleString("id-ID")}</span></p>
                <p>Komisi IKPM ({settings.minKomisiMitra}%): <span className="font-medium text-primary">Rp {komisiNominal.toLocaleString("id-ID")}</span></p>
                <p>Harga IKPM maks (otomatis): <span className="font-medium">Rp {memberPriceMax.toLocaleString("id-ID")}</span></p>
                <p className="text-muted-foreground pt-1">
                  Mitra boleh set harga IKPM lebih rendah, tapi tidak boleh lebih tinggi dari nilai ini.
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── Info Toko ─────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="pb-2 border-b border-border">
          <h2 className="text-sm font-semibold">Informasi Toko</h2>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="toko-desc" className="text-sm">Deskripsi Toko</Label>
          <textarea
            id="toko-desc"
            rows={3}
            value={settings.tokoDescription}
            onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set("tokoDescription", e.target.value)}
            placeholder="Deskripsi singkat toko IKPM..."
            className="w-full rounded-md border border-input bg-background px-3 py-2
                       text-sm placeholder:text-muted-foreground focus-visible:outline-none
                       focus-visible:ring-2 focus-visible:ring-ring resize-none"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="toko-wa" className="text-sm">Nomor WhatsApp Toko</Label>
          <Input
            id="toko-wa"
            type="tel"
            value={settings.tokoWhatsapp}
            onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set("tokoWhatsapp", e.target.value)}
            placeholder="+628xxxxxxxxxx"
            className="max-w-xs h-8 text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Ditampilkan di halaman toko publik sebagai kontak bantuan.
          </p>
        </div>
      </section>

      {/* ── Simpan ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 pt-2">
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
