"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PhoneInput } from "@/components/ui/phone-input";
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

        <div className="max-w-xs">
          <PhoneInput
            label="Nomor WhatsApp Toko"
            optional
            value={settings.tokoWhatsapp}
            onChange={(v) => set("tokoWhatsapp", v)}
            hint="Ditampilkan di halaman toko publik sebagai kontak bantuan."
          />
        </div>
      </section>

      {/* ── Opsi Pengiriman & Pembayaran ─────────────────────────────────── */}
      <section className="space-y-4">
        <div className="pb-2 border-b border-border">
          <h2 className="text-sm font-semibold">Opsi Pengiriman & Pembayaran</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Berlaku untuk produk milik toko sendiri. Tiap mitra mengatur COD/Ambil Sendiri
            miliknya sendiri secara terpisah.
          </p>
        </div>

        {/* Toggle COD */}
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="cod-enabled" className="text-sm">Aktifkan Bayar di Tempat (COD)</Label>
            <p className="text-xs text-muted-foreground">
              Pembeli bisa memilih bayar tunai saat barang diterima kurir.
            </p>
          </div>
          <Switch
            id="cod-enabled"
            checked={settings.codEnabled}
            onCheckedChange={(v: boolean) => set("codEnabled", v)}
          />
        </div>

        {/* Toggle Ambil Sendiri */}
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="pickup-enabled" className="text-sm">Aktifkan Ambil Sendiri</Label>
            <p className="text-xs text-muted-foreground">
              Pembeli ambil barang langsung ke lokasi — tetap wajib bayar dulu via transfer/QRIS.
            </p>
          </div>
          <Switch
            id="pickup-enabled"
            checked={settings.pickupEnabled}
            onCheckedChange={(v: boolean) => set("pickupEnabled", v)}
          />
        </div>

        {settings.pickupEnabled && (
          <div className="space-y-4 pl-4 border-l-2 border-primary/20">
            <div className="space-y-1.5">
              <Label htmlFor="pickup-name" className="text-sm">Nama Lokasi</Label>
              <Input
                id="pickup-name"
                value={settings.pickupLocationName}
                onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set("pickupLocationName", e.target.value)}
                placeholder="Kantor Sekretariat IKPM Yogyakarta"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pickup-address" className="text-sm">Alamat Lengkap</Label>
              <textarea
                id="pickup-address"
                rows={2}
                value={settings.pickupAddress}
                onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set("pickupAddress", e.target.value)}
                placeholder="Jl. Contoh No. 1, Yogyakarta"
                className="w-full rounded-md border border-input bg-background px-3 py-2
                           text-sm placeholder:text-muted-foreground focus-visible:outline-none
                           focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pickup-maps" className="text-sm">Link Google Maps</Label>
              <Input
                id="pickup-maps"
                type="url"
                value={settings.pickupMapsUrl}
                onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set("pickupMapsUrl", e.target.value)}
                placeholder="https://maps.app.goo.gl/..."
                className="h-8 text-sm"
              />
            </div>
          </div>
        )}
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
