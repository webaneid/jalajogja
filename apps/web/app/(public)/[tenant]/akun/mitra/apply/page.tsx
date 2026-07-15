"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label  } from "@/components/ui/label";
import { useBaseUrl } from "@/lib/use-base-url";

type Business = { id: string; name: string; brand: string | null };
type City     = {
  id:             number;
  label:          string;
  cityName:       string;
  districtName:   string;
  subdistrictName: string;
  provinceName:   string;
  zipCode:        string;
};

export default function MitraApplyPage() {
  const router = useRouter();
  const params = useParams<{ tenant: string }>();
  const slug   = params.tenant;

  const baseUrl = useBaseUrl(slug);

  const [businesses,    setBusinesses]    = useState<Business[]>([]);
  const [businessId,    setBusinessId]    = useState("");
  const [motivation,    setMotivation]    = useState("");
  const [settings,      setSettings]      = useState<{ minKomisiMitra: number; mitraMaxProducts: number } | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [submitting,    setSubmitting]    = useState(false);
  const [error,         setError]         = useState<string | null>(null);

  // Kota asal pengiriman
  const [citySearch,   setCitySearch]   = useState("");
  const [cityResults,  setCityResults]  = useState<City[]>([]);
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [cityOpen,     setCityOpen]     = useState(false);

  useEffect(() => {
    fetch(`/api/mitra/status?slug=${slug}`)
      .then(r => r.json())
      .then((data: { businesses: Business[]; settings: { minKomisiMitra: number; mitraMaxProducts: number } }) => {
        setBusinesses(data.businesses ?? []);
        setSettings(data.settings);
        if (data.businesses?.length > 0) setBusinessId(data.businesses[0].id);
        setLoading(false);
      });
  }, [slug]);

  useEffect(() => {
    if (citySearch.length < 2) { setCityResults([]); return; }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/ongkir/cities?q=${encodeURIComponent(citySearch)}&limit=15`);
      const data = await res.json() as { cities: City[] };
      const cities = data.cities ?? [];
      setCityResults(cities);
      if (cities.length > 0) setCityOpen(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [citySearch]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!businessId) { setError("Pilih usaha terlebih dahulu."); return; }
    if (!selectedCity) { setError("Pilih kota asal pengiriman terlebih dahulu."); return; }
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/mitra/apply", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        slug, businessId, motivation,
        rajaongkirCityId:   selectedCity.id,
        rajaongkirCityName: selectedCity.label,
      }),
    });
    const data = await res.json() as { error?: string };
    setSubmitting(false);
    if (data.error) { setError(data.error); return; }
    router.push(`${baseUrl}/akun/mitra`);
  }

  if (loading) return <div className="p-8 text-center text-sm text-muted-foreground">Memuat...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Handshake className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-semibold">Daftar Menjadi Mitra</h1>
      </div>

      {settings && (
        <div className="rounded-lg bg-muted/50 border border-border p-4 text-xs text-muted-foreground space-y-1">
          <p>• Komisi IKPM: <span className="font-medium text-foreground">{settings.minKomisiMitra}%</span> dari setiap penjualan</p>
          {settings.mitraMaxProducts > 0 && <p>• Batas produk: <span className="font-medium text-foreground">{settings.mitraMaxProducts} produk</span></p>}
          <p>• Pembayaran masuk ke rekening IKPM, dicairkan secara periodik</p>
          <p>• Pengajuan diproses admin dalam 1–3 hari kerja</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <Label className="text-sm">Pilih Usaha yang Didaftarkan</Label>
          {businesses.length === 0 ? (
            <p className="text-sm text-destructive">Anda belum memiliki data usaha aktif.</p>
          ) : (
            <div className="space-y-2">
              {businesses.map(b => (
                <label key={b.id} className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                  businessId === b.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                }`}>
                  <input
                    type="radio"
                    name="business"
                    value={b.id}
                    checked={businessId === b.id}
                    onChange={() => setBusinessId(b.id)}
                    className="accent-primary"
                  />
                  <div>
                    <p className="text-sm font-medium">{b.brand ?? b.name}</p>
                    {b.brand && b.name !== b.brand && <p className="text-xs text-muted-foreground">{b.name}</p>}
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Kota asal pengiriman */}
        <div className="space-y-1.5">
          <Label className="text-sm">
            Kota Asal Pengiriman <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <input
              type="text"
              value={citySearch}
              onChange={e => { setCitySearch(e.target.value); setSelectedCity(null); }}
              onBlur={() => setTimeout(() => setCityOpen(false), 200)}
              placeholder="Ketik nama kota (min. 2 karakter)..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
            {cityOpen && cityResults.length > 0 && (
              <ul className="absolute z-20 top-full mt-1 w-full rounded-md border border-border bg-background shadow-lg max-h-48 overflow-y-auto">
                {cityResults.map(city => (
                  <li
                    key={city.id}
                    onMouseDown={() => {
                      setSelectedCity(city);
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
          {selectedCity && (
            <p className="text-xs text-green-600">✓ {selectedCity.label} dipilih</p>
          )}
          <p className="text-xs text-muted-foreground">Kota gudang/rumah tempat produk dikirim.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="motivation" className="text-sm">
            Motivasi / Deskripsi Singkat <span className="text-muted-foreground font-normal">(opsional)</span>
          </Label>
          <textarea
            id="motivation"
            rows={3}
            value={motivation}
            onChange={e => setMotivation(e.target.value)}
            placeholder="Ceritakan produk yang ingin Anda jual dan alasan bergabung sebagai mitra..."
            className="w-full rounded-md border border-input bg-background px-3 py-2
                       text-sm placeholder:text-muted-foreground focus-visible:outline-none
                       focus-visible:ring-2 focus-visible:ring-ring resize-none"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" disabled={submitting || businesses.length === 0} className="w-full">
          {submitting ? "Mengirim..." : "Kirim Pengajuan Mitra"}
        </Button>
      </form>
    </div>
  );
}
