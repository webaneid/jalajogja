"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveTrackingSettingsAction } from "@/app/(dashboard)/app/[tenant]/settings/actions";
import type { TrackingConfig, TrackingField } from "@/lib/tracking-ids";

// Form "Integrasi & Pelacakan" — docs/arsitektur-seo.md § 3. Admin hanya menempel ID/kode,
// bukan script. Validasi akhir ada di server (lib/tracking-ids.ts).
const FIELDS: { field: TrackingField; label: string; placeholder: string; hint: string }[] = [
  {
    field: "google", label: "Google Search Console — kode verifikasi",
    placeholder: "kode dari tag meta google-site-verification",
    hint: "Di Search Console pilih verifikasi \"Tag HTML\", lalu tempel seluruh tag <meta ...> atau hanya isi content-nya.",
  },
  {
    field: "bing", label: "Bing Webmaster — kode verifikasi",
    placeholder: "kode dari tag meta msvalidate.01",
    hint: "Opsional. Tempel seluruh tag <meta ...> atau hanya isi content-nya.",
  },
  {
    field: "gtm", label: "Google Tag Manager — Container ID",
    placeholder: "GTM-XXXXXXX",
    hint: "Ada di pojok kanan atas Tag Manager.",
  },
  {
    field: "ga4", label: "Google Analytics 4 — Measurement ID",
    placeholder: "G-XXXXXXXXXX",
    hint: "Admin GA → Data Streams → pilih stream web → Measurement ID.",
  },
  {
    field: "pixel", label: "Meta (Facebook) Pixel — Pixel ID",
    placeholder: "1234567890123456",
    hint: "Angka saja. Ada di Meta Events Manager → Data Sources.",
  },
];

export function TrackingSettingsForm({ slug, defaults }: { slug: string; defaults: TrackingConfig }) {
  const router = useRouter();
  const [values, setValues]   = React.useState<TrackingConfig>(defaults);
  const [pending, setPending] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const result = await saveTrackingSettingsAction(slug, values);
      if (result.error) toast.error(result.error);
      else { toast.success("Integrasi disimpan."); router.refresh(); }
    } finally { setPending(false); }
  }

  const bothSet = values.gtm.trim() !== "" && values.ga4.trim() !== "";

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border p-4">
      {FIELDS.map(({ field, label, placeholder, hint }) => (
        <div key={field} className="space-y-1">
          <Label htmlFor={`trk-${field}`}>{label}</Label>
          <Input
            id={`trk-${field}`} value={values[field]} placeholder={placeholder}
            autoComplete="off" spellCheck={false}
            onChange={(e) => setValues((v) => ({ ...v, [field]: e.target.value }))}
          />
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      ))}

      {bothSet && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          Tag Manager dan Google Analytics 4 sama-sama diisi. Kalau GA4 sudah dipasang di dalam
          Tag Manager, kosongkan kolom GA4 di sini agar kunjungan tidak terhitung dua kali.
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Kolom yang dikosongkan berarti tidak dipasang. Kode hanya dipasang di website publik,
        tidak di dashboard admin. Perubahan bisa butuh beberapa menit untuk terlihat.
      </p>
      <Button type="submit" disabled={pending}>{pending ? "Menyimpan..." : "Simpan"}</Button>
    </form>
  );
}
