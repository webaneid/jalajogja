"use client";

// Combobox pencarian kota RajaOngkir (debounced, realtime ke /api/ongkir/cities) — dipakai di
// 3 tempat: settings/addons/rajaongkir/config-form.tsx (kota asal default toko),
// akun/mitra/apply/page.tsx (kota asal mitra), product-form.tsx (override per-produk). Sengaja
// diekstrak jadi satu komponen (2026-09-15) — sebelumnya diimplementasikan inline identik 2×,
// pola sama yang sudah pernah bikin masalah di kode-unik/voucher (docs/arsitektur-voucher.md
// § 16-18). Lihat docs/arsitektur-addon-ongkir.md § "RENCANA — Kota Asal Pengiriman per Produk
// Tenant" untuk konteks.
//
// Controlled — tidak tahu apa-apa soal produk/mitra/tenant, cuma cari+pilih kota.

import { useState, useEffect, useRef } from "react";

export type RajaOngkirCity = {
  id:              number;
  label:           string;
  cityName:        string;
  districtName:    string;
  subdistrictName: string;
  provinceName:    string;
  zipCode:         string;
};

type Props = {
  /** ID kota terpilih saat ini (dari state parent) — null kalau belum pilih. */
  value: number | null;
  /** Label kota terpilih saat ini — dipakai sebagai teks awal di kotak pencarian. */
  valueLabel: string;
  /** Dipanggil dengan City lengkap saat user memilih, atau null saat input diketik ulang (belum ada pilihan baru). */
  onChange: (city: RajaOngkirCity | null) => void;
  placeholder?: string;
  /** Teks kecil di bawah, opsional — beda per konteks pemakaian. */
  helperText?: string;
};

export function RajaOngkirCityPicker({ value, valueLabel, onChange, placeholder, helperText }: Props) {
  const [citySearch,  setCitySearch]  = useState(valueLabel);
  const [cityResults, setCityResults] = useState<RajaOngkirCity[]>([]);
  const [cityOpen,    setCityOpen]    = useState(false);
  // Cegah fetch saat mount kalau sudah ada nilai awal (dari DB) — fetch hanya dipicu user mengetik.
  const userTypedRef = useRef(false);

  useEffect(() => {
    if (!userTypedRef.current) return;
    if (citySearch.length < 2) { setCityResults([]); return; }
    const timer = setTimeout(async () => {
      const res  = await fetch(`/api/ongkir/cities?q=${encodeURIComponent(citySearch)}&limit=15`);
      const data = await res.json() as { cities: RajaOngkirCity[] };
      const cities = data.cities ?? [];
      setCityResults(cities);
      if (cities.length > 0) setCityOpen(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [citySearch]);

  return (
    <div className="space-y-1">
      <div className="relative">
        <input
          type="text"
          value={citySearch}
          onChange={(e) => {
            userTypedRef.current = true;
            setCitySearch(e.target.value);
            onChange(null);
          }}
          onFocus={() => cityResults.length > 0 && setCityOpen(true)}
          onBlur={() => setTimeout(() => setCityOpen(false), 200)}
          placeholder={placeholder ?? "Ketik nama kota (min. 2 karakter)..."}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        {cityOpen && cityResults.length > 0 && (
          <ul className="absolute z-20 top-full mt-1 w-full rounded-md border border-border bg-background shadow-lg max-h-48 overflow-y-auto">
            {cityResults.map((city) => (
              <li
                key={city.id}
                onMouseDown={() => {
                  onChange(city);
                  setCitySearch(city.label);
                  setCityOpen(false);
                }}
                className="px-3 py-2 text-sm cursor-pointer hover:bg-muted"
              >
                {city.label}
              </li>
            ))}
          </ul>
        )}
      </div>
      {value && <p className="text-xs text-green-600">✓ {valueLabel} (ID: {value})</p>}
      {helperText && <p className="text-xs text-muted-foreground">{helperText}</p>}
    </div>
  );
}
