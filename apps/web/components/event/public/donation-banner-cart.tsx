"use client";

import { useState, useTransition } from "react";
import { addToCartAction } from "@/app/(public)/[tenant]/cart/actions";
import { Heart, ShoppingBag, X, ChevronDown, Check, ArrowRight } from "lucide-react";

type CampaignBanner = {
  campaignId:    string;
  campaignTitle: string;
  amounts:       number[];
};

type ProductBanner = {
  productId:    string;
  productTitle: string;
  productSlug:  string;
  productType:  "simple" | "variable";
  coverUrl:     string | null;
  unitPrice:    number; // hanya valid dipakai untuk produk simple (add langsung)
};

type Props = {
  tenantSlug:     string;
  campaigns:      CampaignBanner[];
  linkedProduct?: ProductBanner | null;
};

function formatRp(n: number) { return `Rp ${n.toLocaleString("id-ID")}`; }

export function DonationBannerCart({ tenantSlug, campaigns, linkedProduct }: Props) {
  const [dismissed,     setDismissed]     = useState(false);
  const [selected,      setSelected]      = useState(0);
  const [nominal,       setNominal]       = useState<number | null>(null);
  const [custom,        setCustom]        = useState("");
  const [donationAdded, setDonationAdded] = useState(false);
  const [productAdded,  setProductAdded]  = useState(false);
  const [donPending,    startDonTransition]  = useTransition();
  const [prodPending,   startProdTransition] = useTransition();

  const hasCampaigns = campaigns.length > 0;
  const hasProduct   = !!linkedProduct;

  if (dismissed || (!hasCampaigns && !hasProduct)) return null;

  const campaign    = hasCampaigns ? campaigns[selected] : null;
  const finalNominal = custom
    ? (parseInt(custom.replace(/\D/g, ""), 10) || 0)
    : (nominal ?? 0);

  function handleAddDonation() {
    if (!campaign || finalNominal <= 0) return;
    startDonTransition(async () => {
      const res = await addToCartAction(tenantSlug, {
        itemType:  "donation",
        itemId:    campaign.campaignId,
        name:      campaign.campaignTitle,
        unitPrice: finalNominal,
      });
      if (res.success) setDonationAdded(true);
    });
  }

  function handleAddProduct() {
    // Hanya untuk produk simple — produk variable WAJIB lewat halaman detail (pilih variasi
    // dulu), lihat cabang render di bawah.
    if (!linkedProduct || linkedProduct.productType !== "simple") return;
    startProdTransition(async () => {
      const res = await addToCartAction(tenantSlug, {
        itemType:  "product",
        itemId:    linkedProduct.productId,
        name:      linkedProduct.productTitle,
        unitPrice: linkedProduct.unitPrice,
        quantity:  1,
      });
      if (res.success) setProductAdded(true);
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

      {/* Bagian Donasi */}
      {hasCampaigns && campaign && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 pr-6">
            <Heart className="h-4 w-4 text-primary shrink-0" />
            <p className="text-sm font-semibold">Ingin ikut berdonasi?</p>
          </div>

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

          {campaigns.length === 1 && (
            <p className="text-sm text-muted-foreground">{campaign.campaignTitle}</p>
          )}

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
            onClick={handleAddDonation}
            disabled={donPending || finalNominal <= 0 || donationAdded}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {donationAdded
              ? <><Check className="h-3.5 w-3.5" /> Ditambahkan ke keranjang!</>
              : donPending
                ? "Menambahkan..."
                : <><Heart className="h-3.5 w-3.5" /> {`Donasi${finalNominal > 0 ? ` ${formatRp(finalNominal)}` : ""}`}</>
            }
          </button>
        </div>
      )}

      {/* Separator jika ada keduanya */}
      {hasCampaigns && hasProduct && (
        <div className="border-t border-border/60 pt-3" />
      )}

      {/* Bagian Produk */}
      {hasProduct && linkedProduct && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-primary shrink-0" />
            <p className="text-sm font-semibold">Mungkin Anda Tertarik</p>
          </div>
          <div className="flex items-center gap-3">
            {linkedProduct.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={linkedProduct.coverUrl}
                alt={linkedProduct.productTitle}
                className="h-14 w-14 shrink-0 rounded-lg border border-border object-cover bg-background"
              />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
                <ShoppingBag className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <p className="text-sm text-muted-foreground">{linkedProduct.productTitle}</p>
          </div>

          {linkedProduct.productType === "variable" ? (
            // Produk punya variasi (ukuran/warna/dll) — tidak bisa ditambah langsung dari sini
            // (tidak ada picker variasi di banner ini), arahkan ke halaman produk supaya user
            // pilih variasi lewat alur yang sudah benar (harga + berat pengiriman per varian).
            <a
              href={`/${tenantSlug}/produk/${linkedProduct.productSlug}`}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10 transition-colors"
            >
              Lihat & Pilih Variasi <ArrowRight className="h-3.5 w-3.5" />
            </a>
          ) : (
            <button
              type="button"
              onClick={handleAddProduct}
              disabled={prodPending || productAdded}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10 disabled:opacity-60 transition-colors"
            >
              {productAdded
                ? <><Check className="h-3.5 w-3.5" /> Ditambahkan ke keranjang!</>
                : prodPending
                  ? "Menambahkan..."
                  : <><ShoppingBag className="h-3.5 w-3.5" /> Tambah ke Keranjang</>
              }
            </button>
          )}
        </div>
      )}
    </div>
  );
}
