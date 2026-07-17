"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { saveProductArchiveDesignAction } from "./actions";
import {
  PRODUCT_ARCHIVE_CARD_DESIGN_IDS,
  PRODUCT_ARCHIVE_CARD_DESIGNS,
  type ProductArchiveCardDesignId,
} from "@/lib/product-archive-card-designs";

export function ProductArchiveDesignForm({
  slug,
  initialDesign,
}: {
  slug:          string;
  initialDesign: ProductArchiveCardDesignId;
}) {
  const [design,  setDesign]        = useState<ProductArchiveCardDesignId>(initialDesign);
  const [error,   setError]         = useState("");
  const [saved,   setSaved]         = useState(false);
  const [pending, startTransition]  = useTransition();

  function handleSave() {
    setError("");
    setSaved(false);
    startTransition(async () => {
      const res = await saveProductArchiveDesignAction(slug, design);
      if (res.error) setError(res.error);
      else setSaved(true);
    });
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h2 className="text-sm font-semibold">Desain Kartu Arsip</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Tampilan kartu produk di halaman arsip (<code>/produk</code>), arsip kategori, dan bagian
          &quot;Produk Lainnya&quot; di halaman detail.
        </p>
        <p className="text-xs text-muted-foreground mt-1.5">
          Semua desain di sini selalu tampil Grid di desktop dan List di mobile — lebih mudah
          dibaca daripada grid sempit di layar kecil.
        </p>
      </div>

      <div className="space-y-2">
        {PRODUCT_ARCHIVE_CARD_DESIGN_IDS.map(id => {
          const meta   = PRODUCT_ARCHIVE_CARD_DESIGNS[id];
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
        {PRODUCT_ARCHIVE_CARD_DESIGN_IDS.length === 1 && (
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
