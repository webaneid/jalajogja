"use client";

import { useState, useTransition, useEffect } from "react";
import { saveRajaOngkirConfigAction } from "./actions";

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
] as const;

type City = { cityId: number; cityName: string; type: string; postalCode: string | null };

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

  const [citySearch,   setCitySearch]   = useState(initialConfig.originCityName);
  const [cityResults,  setCityResults]  = useState<City[]>([]);
  const [selectedCity, setSelectedCity] = useState<City | null>(
    initialConfig.originCityId
      ? { cityId: initialConfig.originCityId, cityName: initialConfig.originCityName, type: "", postalCode: null }
      : null,
  );
  const [cityOpen, setCityOpen] = useState(false);

  useEffect(() => {
    if (citySearch.length < 2) { setCityResults([]); return; }
    const timer = setTimeout(async () => {
      const res  = await fetch(`/api/ongkir/cities?q=${encodeURIComponent(citySearch)}&limit=15`);
      const data = await res.json() as { cities: City[] };
      setCityResults(data.cities ?? []);
      setCityOpen(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [citySearch]);

  function toggleCourier(val: string) {
    setCouriers(prev => prev.includes(val) ? prev.filter(c => c !== val) : [...prev, val]);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    startTransition(async () => {
      const res = await saveRajaOngkirConfigAction(installationId, {
        origin_city_id:   selectedCity?.cityId ?? null,
        origin_city_name: selectedCity?.cityName ?? "",
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
        <div className="relative">
          <input
            type="text"
            value={citySearch}
            onChange={e => { setCitySearch(e.target.value); setSelectedCity(null); }}
            onFocus={() => cityResults.length > 0 && setCityOpen(true)}
            onBlur={() => setTimeout(() => setCityOpen(false), 200)}
            placeholder="Ketik nama kota (min. 2 karakter)..."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {cityOpen && cityResults.length > 0 && (
            <ul className="absolute z-20 top-full mt-1 w-full rounded-md border border-border bg-background shadow-lg max-h-48 overflow-y-auto">
              {cityResults.map(city => (
                <li
                  key={city.cityId}
                  onMouseDown={() => {
                    setSelectedCity(city);
                    setCitySearch(`${city.type} ${city.cityName}`);
                    setCityOpen(false);
                  }}
                  className="px-3 py-2 text-sm cursor-pointer hover:bg-muted"
                >
                  {city.type} {city.cityName}
                  {city.postalCode && <span className="text-muted-foreground ml-1">({city.postalCode})</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
        {selectedCity && (
          <p className="text-xs text-green-600">✓ {selectedCity.type} {selectedCity.cityName} (ID: {selectedCity.cityId})</p>
        )}
        <p className="text-xs text-muted-foreground">
          Kota asal untuk produk milik toko ini. Mitra atur kota asal sendiri di profil mitra.
        </p>
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
