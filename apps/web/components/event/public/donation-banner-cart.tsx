"use client";

import { useState, useTransition } from "react";
import { addToCartAction } from "@/app/(public)/[tenant]/cart/actions";
import { Heart, X, ChevronDown } from "lucide-react";

type CampaignBanner = {
  campaignId:    string;
  campaignTitle: string;
  amounts:       number[];
};

type Props = {
  tenantSlug: string;
  campaigns:  CampaignBanner[];
};

function formatRp(n: number) { return `Rp ${n.toLocaleString("id-ID")}`; }

export function DonationBannerCart({ tenantSlug, campaigns }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [selected,  setSelected]  = useState(0);                // index campaign aktif
  const [nominal,   setNominal]   = useState<number | null>(null);
  const [custom,    setCustom]    = useState("");
  const [added,     setAdded]     = useState(false);
  const [pending,   startTransition] = useTransition();

  if (dismissed || campaigns.length === 0) return null;

  const campaign = campaigns[selected];
  const finalNominal = custom
    ? (parseInt(custom.replace(/\D/g, ""), 10) || 0)
    : (nominal ?? 0);

  function handleAdd() {
    if (finalNominal <= 0) return;
    startTransition(async () => {
      const res = await addToCartAction(tenantSlug, {
        itemType:  "donation",
        itemId:    campaign.campaignId,
        name:      campaign.campaignTitle,
        unitPrice: finalNominal,
      });
      if (res.success) setAdded(true);
    });
  }

  return (
    <div className="relative rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
        aria-label="Tutup"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-2 pr-6">
        <Heart className="h-4 w-4 text-primary shrink-0" />
        <p className="text-sm font-semibold">Ingin ikut berdonasi?</p>
      </div>

      {/* Pilih campaign jika lebih dari satu */}
      {campaigns.length > 1 && (
        <div className="relative">
          <select
            value={selected}
            onChange={e => { setSelected(Number(e.target.value)); setNominal(null); setCustom(""); }}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm pr-8 appearance-none focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {campaigns.map((c, i) => (
              <option key={c.campaignId} value={i}>{c.campaignTitle}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>
      )}

      {/* Kampanye tunggal: label saja */}
      {campaigns.length === 1 && (
        <p className="text-sm text-muted-foreground">{campaign.campaignTitle}</p>
      )}

      {/* Nominal chips */}
      {campaign.amounts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {campaign.amounts.map(n => (
            <button
              key={n}
              type="button"
              onClick={() => { setNominal(n); setCustom(""); }}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                nominal === n && !custom
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:border-primary/50 bg-background"
              }`}
            >
              {formatRp(n)}
            </button>
          ))}
        </div>
      )}

      {/* Custom nominal */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rp</span>
        <input
          type="text"
          inputMode="numeric"
          value={custom}
          onChange={e => { setCustom(e.target.value.replace(/\D/g, "")); setNominal(null); }}
          placeholder="Nominal lain..."
          className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <button
        type="button"
        onClick={handleAdd}
        disabled={pending || finalNominal <= 0 || added}
        className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
      >
        <Heart className="h-3.5 w-3.5" />
        {added ? "Ditambahkan ke keranjang!" : pending ? "Menambahkan..." : `Donasi${finalNominal > 0 ? ` ${formatRp(finalNominal)}` : ""}`}
      </button>
    </div>
  );
}
