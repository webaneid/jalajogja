"use client";

// Logo Kurir untuk label pengiriman. Logo dipilih dari Media Library (bukan upload langsung) → URL tersimpan di settings toko
// ("courier_logos"). Dipakai buildLabelData (disematkan ke PDF label). Kurir tanpa logo tampil sebagai badge teks tebal.
import { useState, useTransition } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { MediaPicker, type MediaItem } from "@/components/media/media-picker";
import { saveCourierLogosAction } from "./actions";

export function CourierLogosForm({ slug, couriers, initialLogos, canEdit }: {
  slug: string; couriers: { code: string; label: string }[]; initialLogos: Record<string, string>; canEdit: boolean;
}) {
  const [logos, setLogos] = useState<Record<string, string>>(initialLogos);
  const [pickFor, setPickFor] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const save = () => {
    setError(""); setSaved(false);
    start(async () => {
      const res = await saveCourierLogosAction(slug, logos);
      if (res.error) setError(res.error); else setSaved(true);
    });
  };

  return (
    <div className="space-y-4 max-w-lg">
      <div>
        <h2 className="text-sm font-semibold">Logo Kurir</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Tampil di label pengiriman (PDF) di samping logo toko. Pilih gambar dari Media Library — disarankan logo horizontal
          berlatar putih/transparan. Kurir tanpa logo tampil sebagai nama tebal.
        </p>
      </div>

      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        {couriers.map((c) => {
          const url = logos[c.code];
          return (
            <li key={c.code} className="flex items-center gap-3 px-3 py-2.5">
              <span className="flex h-10 w-24 shrink-0 items-center justify-center rounded border border-border bg-white p-1">
                {url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={url} alt={c.label} className="max-h-full max-w-full object-contain" />
                  : <span className="text-[10px] font-bold uppercase text-muted-foreground">{c.code}</span>}
              </span>
              <span className="min-w-0 flex-1 text-sm font-medium">{c.label}</span>
              {canEdit && (
                <span className="flex items-center gap-1">
                  <button type="button" onClick={() => setPickFor(c.code)}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">
                    <ImagePlus className="h-3.5 w-3.5" /> {url ? "Ganti" : "Pilih logo"}
                  </button>
                  {url && (
                    <button type="button" aria-label={`Hapus logo ${c.label}`} onClick={() => setLogos((l) => { const n = { ...l }; delete n[c.code]; return n; })}
                      className="rounded-md p-1.5 text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {saved && <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">Logo kurir tersimpan.</p>}
      {canEdit ? (
        <button type="button" onClick={save} disabled={pending}
          className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {pending ? "Menyimpan…" : "Simpan Logo Kurir"}
        </button>
      ) : <p className="text-xs text-muted-foreground">Hanya pengguna dengan akses penuh modul Toko yang bisa mengubah logo kurir.</p>}

      <MediaPicker slug={slug} open={pickFor !== null} accept={["image/"]} onClose={() => setPickFor(null)}
        onSelect={(m: MediaItem) => { if (pickFor) { setLogos((l) => ({ ...l, [pickFor]: m.variants?.large ?? m.url })); setSaved(false); } setPickFor(null); }} />
    </div>
  );
}
