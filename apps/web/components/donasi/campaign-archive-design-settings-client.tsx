"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { saveCampaignArchiveDesignAction } from "@/app/(dashboard)/app/[tenant]/donasi/actions";
import {
  CAMPAIGN_ARCHIVE_CARD_DESIGN_IDS,
  CAMPAIGN_ARCHIVE_CARD_DESIGNS,
  type CampaignArchiveCardDesignId,
} from "@/lib/campaign-archive-card-designs";

export function CampaignArchiveDesignSettingsClient({
  slug,
  initialDesign,
}: {
  slug:          string;
  initialDesign: CampaignArchiveCardDesignId;
}) {
  const [design,  setDesign]        = useState<CampaignArchiveCardDesignId>(initialDesign);
  const [error,   setError]         = useState("");
  const [saved,   setSaved]         = useState(false);
  const [pending, startTransition]  = useTransition();

  function handleSave() {
    setError("");
    setSaved(false);
    startTransition(async () => {
      const res = await saveCampaignArchiveDesignAction(slug, design);
      if (res.success) setSaved(true);
      else setError(res.error ?? "Gagal menyimpan.");
    });
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h2 className="text-base font-semibold">Desain Kartu Arsip</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Tampilan kartu campaign di halaman arsip (<code>/campaign</code>) dan bagian
          &quot;Campaign Lainnya&quot; di halaman detail. Tidak memengaruhi section Campaign yang
          sudah disusun manual di landing page — itu tetap independen.
        </p>
        <p className="text-xs text-muted-foreground mt-1.5">
          Semua desain di sini selalu tampil Grid di desktop dan List di mobile — lebih mudah dibaca
          daripada grid sempit di layar kecil. Campaign bertipe Qurban selalu menampilkan harga &amp;
          ketersediaan hewan di bagian tengah kartu (bukan progress bar).
        </p>
      </div>

      <div className="space-y-2">
        {CAMPAIGN_ARCHIVE_CARD_DESIGN_IDS.map(id => {
          const meta   = CAMPAIGN_ARCHIVE_CARD_DESIGNS[id];
          const active = design === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => { setDesign(id); setSaved(false); }}
              className={`w-full text-left flex items-start gap-3 rounded-lg border p-3.5 transition-colors ${
                active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
              }`}
            >
              <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                active ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
              }`}>
                {active && <Check className="h-3 w-3" />}
              </span>
              <span>
                <span className="block text-sm font-medium">Desain {id} — {meta.label}</span>
                <span className="block text-xs text-muted-foreground mt-0.5">{meta.description}</span>
              </span>
            </button>
          );
        })}
        {CAMPAIGN_ARCHIVE_CARD_DESIGN_IDS.length === 1 && (
          <p className="text-xs text-muted-foreground italic">
            Belum ada desain alternatif — akan ditambah di sini nanti.
          </p>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && <p className="text-sm text-green-600">Pengaturan berhasil disimpan.</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={pending}
        className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
      >
        {pending ? "Menyimpan..." : "Simpan Pengaturan"}
      </button>
    </div>
  );
}
