"use client";

// Picker "Gratis Ongkir per Produk" — 3 mode: none/all/regions. Dipakai di product-form.tsx.
// Provinsi & kabupaten/kota diambil dari endpoint list bersih RajaOngkir (BUKAN search
// kelurahan yang dipakai kota asal/tujuan checkout) — /api/ongkir/provinces +
// /api/ongkir/cities-by-province. Lihat docs/arsitektur-addon-ongkir.md §
// "RENCANA — Gratis Ongkir per Produk" untuk desain lengkap (kenapa matching by name, dll).

import { useState, useEffect } from "react";
import { X } from "lucide-react";

export type FreeShippingMode   = "none" | "all" | "regions";
export type FreeShippingRegion = { id: number; name: string };

type Props = {
  mode:      FreeShippingMode;
  provinces: FreeShippingRegion[];
  cities:    FreeShippingRegion[];
  onChange: (next: { mode: FreeShippingMode; provinces: FreeShippingRegion[]; cities: FreeShippingRegion[] }) => void;
};

const MODE_OPTIONS: { value: FreeShippingMode; label: string }[] = [
  { value: "none",    label: "Tidak" },
  { value: "all",     label: "Semua Daerah" },
  { value: "regions", label: "Daerah Tertentu" },
];

export function FreeShippingPicker({ mode, provinces, cities, onChange }: Props) {
  const [allProvinces,   setAllProvinces]   = useState<FreeShippingRegion[]>([]);
  const [provincesLoaded, setProvincesLoaded] = useState(false);
  const [provinceFilter, setProvinceFilter] = useState("");

  const [browseProvinceId, setBrowseProvinceId] = useState<number | "">("");
  const [browseCities,     setBrowseCities]     = useState<FreeShippingRegion[]>([]);
  const [browseLoading,    setBrowseLoading]    = useState(false);

  // Fetch daftar provinsi sekali, hanya saat mode "regions" pertama kali dipakai — bukan di
  // mount, supaya tidak boros request kalau admin tidak pernah pakai fitur ini.
  useEffect(() => {
    if (mode !== "regions" || provincesLoaded) return;
    (async () => {
      try {
        const res  = await fetch("/api/ongkir/provinces");
        const data = await res.json() as { provinces?: FreeShippingRegion[] };
        setAllProvinces(data.provinces ?? []);
      } catch {
        setAllProvinces([]);
      } finally {
        setProvincesLoaded(true);
      }
    })();
  }, [mode, provincesLoaded]);

  // Fetch kota provinsi yang sedang di-browse.
  useEffect(() => {
    if (!browseProvinceId) { setBrowseCities([]); return; }
    setBrowseLoading(true);
    (async () => {
      try {
        const res  = await fetch(`/api/ongkir/cities-by-province?provinceId=${browseProvinceId}`);
        const data = await res.json() as { cities?: FreeShippingRegion[] };
        setBrowseCities(data.cities ?? []);
      } catch {
        setBrowseCities([]);
      } finally {
        setBrowseLoading(false);
      }
    })();
  }, [browseProvinceId]);

  function setMode(m: FreeShippingMode) {
    onChange({ mode: m, provinces, cities });
  }

  function toggleProvince(p: FreeShippingRegion) {
    const exists = provinces.some((x) => x.id === p.id);
    const next   = exists ? provinces.filter((x) => x.id !== p.id) : [...provinces, p];
    onChange({ mode, provinces: next, cities });
  }

  function toggleCity(c: FreeShippingRegion) {
    const exists = cities.some((x) => x.id === c.id);
    const next   = exists ? cities.filter((x) => x.id !== c.id) : [...cities, c];
    onChange({ mode, provinces, cities: next });
  }

  function removeCity(id: number) {
    onChange({ mode, provinces, cities: cities.filter((c) => c.id !== id) });
  }

  const filteredProvinces = allProvinces.filter((p) =>
    p.name.toLowerCase().includes(provinceFilter.trim().toLowerCase()),
  );

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        {MODE_OPTIONS.map((opt) => (
          <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer text-sm">
            <input
              type="radio"
              name="freeShippingMode"
              checked={mode === opt.value}
              onChange={() => setMode(opt.value)}
              className="accent-primary"
            />
            {opt.label}
          </label>
        ))}
      </div>

      {mode === "regions" && (
        <div className="space-y-4 rounded-md border border-border p-3">
          {/* Provinsi */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium">Provinsi</p>
            <input
              type="text"
              value={provinceFilter}
              onChange={(e) => setProvinceFilter(e.target.value)}
              placeholder="Cari provinsi..."
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
            {!provincesLoaded ? (
              <p className="text-xs text-muted-foreground">Memuat daftar provinsi...</p>
            ) : (
              <div className="max-h-36 overflow-y-auto grid grid-cols-2 gap-1 pt-1">
                {filteredProvinces.map((p) => (
                  <label key={p.id} className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={provinces.some((x) => x.id === p.id)}
                      onChange={() => toggleProvince(p)}
                      className="accent-primary"
                    />
                    {p.name}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Kabupaten/Kota — opsional, tambahan di atas provinsi */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium">Kabupaten/Kota (opsional)</p>
            <select
              value={browseProvinceId}
              onChange={(e) => setBrowseProvinceId(e.target.value ? Number(e.target.value) : "")}
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Pilih provinsi untuk cari kabupaten/kota...</option>
              {allProvinces.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {browseLoading && <p className="text-xs text-muted-foreground">Memuat...</p>}
            {!browseLoading && browseCities.length > 0 && (
              <div className="max-h-36 overflow-y-auto grid grid-cols-2 gap-1 pt-1">
                {browseCities.map((c) => (
                  <label key={c.id} className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cities.some((x) => x.id === c.id)}
                      onChange={() => toggleCity(c)}
                      className="accent-primary"
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            )}
            {cities.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {cities.map((c) => (
                  <span key={c.id} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px]">
                    {c.name}
                    <button type="button" onClick={() => removeCity(c.id)} className="hover:text-destructive">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {provinces.length === 0 && cities.length === 0 && (
            <p className="text-xs text-amber-600">Pilih minimal 1 provinsi atau kabupaten/kota.</p>
          )}
        </div>
      )}
    </div>
  );
}
