"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label  } from "@/components/ui/label";

type Business = { id: string; name: string; brand: string | null };

export default function MitraApplyPage() {
  const router = useRouter();
  const params = useParams<{ tenant: string }>();
  const slug   = params.tenant;

  const [businesses,    setBusinesses]    = useState<Business[]>([]);
  const [businessId,    setBusinessId]    = useState("");
  const [motivation,    setMotivation]    = useState("");
  const [settings,      setSettings]      = useState<{ minKomisiMitra: number; mitraMaxProducts: number } | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [submitting,    setSubmitting]    = useState(false);
  const [error,         setError]         = useState<string | null>(null);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!businessId) { setError("Pilih usaha terlebih dahulu."); return; }
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/mitra/apply", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ slug, businessId, motivation }),
    });
    const data = await res.json() as { error?: string };
    setSubmitting(false);
    if (data.error) { setError(data.error); return; }
    router.push(`/${slug}/akun/mitra`);
  }

  if (loading) return <div className="p-8 text-center text-sm text-muted-foreground">Memuat...</div>;

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
      <a href={`/${slug}/akun/mitra`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Kembali
      </a>

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
