"use client";

import { useState, useTransition } from "react";
import { saveRajaOngkirConfigAction } from "./actions";
import { RajaOngkirCityPicker, type RajaOngkirCity } from "@/components/ui/rajaongkir-city-picker";

// Daftar lengkap 16 kurir yang divalidasi RajaOngkir untuk API key platform kita (dicek
// langsung via error 422 endpoint /calculate/domestic-cost saat kirim kode tidak valid — bukan
// dari dokumentasi RajaOngkir yang tidak konsisten soal daftar lengkap per tier akun). Lihat
// lesson CLAUDE.md § "Kurir RajaOngkir — Daftar Checkbox Tidak Lengkap".
const COURIER_OPTIONS = [
  { value: "jne",      label: "JNE" },
  { value: "tiki",     label: "TIKI" },
  { value: "pos",      label: "POS Indonesia" },
  { value: "sicepat",  label: "SiCepat" },
  { value: "anteraja", label: "AnterAja" },
  { value: "jnt",      label: "J&T Express" },
  { value: "ninja",    label: "Ninja Xpress" },
  { value: "lion",     label: "Lion Parcel" },
  { value: "rpx",      label: "RPX" },
  { value: "sap",      label: "SAP Express" },
  { value: "ide",      label: "ID Express" },
  { value: "ncs",      label: "NCS Express" },
  { value: "rex",      label: "REX (Royal Express Indonesia)" },
  { value: "sentral",  label: "Sentral Cargo" },
  { value: "star",     label: "Star Cargo" },
  { value: "wahana",   label: "Wahana" },
] as const;

type Props = {
  slug:           string;
  installationId: string;
  initialConfig: {
    originCityId:   number | null;
    originCityName: string;
    couriers:       string[];
  };
};

export function RajaOngkirConfigForm({ slug, installationId, initialConfig }: Props) {
  const [pending, startTransition] = useTransition();
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState("");

  const [couriers, setCouriers] = useState<string[]>(initialConfig.couriers);

  const [originCityId,   setOriginCityId]   = useState<number | null>(initialConfig.originCityId);
  const [originCityName, setOriginCityName] = useState(initialConfig.originCityName);

  function handleCityChange(city: RajaOngkirCity | null) {
    setOriginCityId(city?.id ?? null);
    setOriginCityName(city?.label ?? "");
  }

  function toggleCourier(val: string) {
    setCouriers(prev => prev.includes(val) ? prev.filter(c => c !== val) : [...prev, val]);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    startTransition(async () => {
      const res = await saveRajaOngkirConfigAction(installationId, {
        origin_city_id:   originCityId,
        origin_city_name: originCityName,
        couriers,
      });
      if ("error" in res) {
        setError(res.error);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {/* Kota asal */}
      <div className="space-y-1">
        <label className="block text-sm font-medium">Kota Asal Pengiriman</label>
        <RajaOngkirCityPicker
          value={originCityId}
          valueLabel={originCityName}
          onChange={handleCityChange}
          helperText="Kota asal default untuk produk milik toko ini (bisa di-override per-produk di form produk). Mitra atur kota asal sendiri di profil mitra."
        />
      </div>

      {/* Kurir */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">Kurir yang Ditawarkan</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {COURIER_OPTIONS.map(opt => (
            <label key={opt.value} className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={couriers.includes(opt.value)}
                onChange={() => toggleCourier(opt.value)}
                className="accent-primary"
              />
              {opt.label}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Kurir yang ditawarkan ke customer saat checkout.</p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
        >
          {pending ? "Menyimpan..." : "Simpan"}
        </button>
        {saved && <span className="text-sm text-green-600">✓ Tersimpan</span>}
      </div>
    </form>
  );
}
