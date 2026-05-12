"use client";

import { useState, useTransition } from "react";
import { addToCartAction } from "@/app/(public)/[tenant]/cart/actions";
import { Heart, X } from "lucide-react";

type Props = {
  tenantSlug:    string;
  campaignId:    string;
  campaignTitle: string;
  amounts:       number[];          // dari settings.donation_config.recommended_amounts
  onClose:       () => void;
};

function formatRp(n: number) { return `Rp ${n.toLocaleString("id-ID")}`; }

export function DonationPromptModal({ tenantSlug, campaignId, campaignTitle, amounts, onClose }: Props) {
  const [selected, setSelected]   = useState<number | null>(amounts[0] ?? null);
  const [custom,   setCustom]     = useState("");
  const [added,    setAdded]      = useState(false);
  const [pending,  startTransition] = useTransition();

  const nominal = custom ? (parseInt(custom.replace(/\D/g, ""), 10) || 0) : (selected ?? 0);

  function handleDonate() {
    if (nominal <= 0) return;
    startTransition(async () => {
      const res = await addToCartAction(tenantSlug, {
        itemType:  "donation",
        itemId:    campaignId,
        name:      campaignTitle,
        unitPrice: nominal,
      });
      if (res.success) {
        setAdded(true);
        setTimeout(() => {
          window.location.href = `/${tenantSlug}/keranjang`;
        }, 1000);
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="relative w-full max-w-sm bg-background rounded-2xl shadow-xl p-6 space-y-5">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="text-center space-y-2">
          <div className="text-3xl">💚</div>
          <h3 className="font-bold text-lg">Pendaftaran Berhasil!</h3>
          <p className="text-sm text-muted-foreground">
            Ingin ikut berdonasi untuk mendukung <span className="font-medium text-foreground">{campaignTitle}</span>?
          </p>
        </div>

        {/* Nominal chips */}
        {amounts.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {amounts.map(n => (
              <button key={n} type="button"
                onClick={() => { setSelected(n); setCustom(""); }}
                className={`py-2 rounded-lg border text-sm font-medium transition-colors ${
                  selected === n && !custom
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:border-primary/50"
                }`}
              >
                {formatRp(n)}
              </button>
            ))}
          </div>
        )}

        {/* Custom nominal */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rp</span>
          <input
            type="text" inputMode="numeric"
            value={custom}
            onChange={e => { setCustom(e.target.value.replace(/\D/g, "")); setSelected(null); }}
            placeholder="Nominal lain..."
            className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => startTransition(handleDonate)}
            disabled={pending || nominal <= 0 || added}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            <Heart className="h-4 w-4" />
            {added ? "Mengarahkan..." : pending ? "Menambahkan..." : `Donasi ${nominal > 0 ? formatRp(nominal) : ""}`}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
          >
            Tidak
          </button>
        </div>
      </div>
    </div>
  );
}
