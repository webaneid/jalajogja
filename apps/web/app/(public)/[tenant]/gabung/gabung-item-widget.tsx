"use client";

// Widget rekomendasi donasi/produk inline untuk /gabung — meniru visual/interaksi
// DonationBannerCart (components/event/public/donation-banner-cart.tsx) TAPI dibangun berdiri
// sendiri (bukan di-import/diperluas) supaya /keranjang tidak ikut tersentuh. Lihat
// docs/arsitektur-gabung-forum.md § "Redesain /gabung" § 4 poin 3 untuk alasan duplikasi.
//
// Dipakai untuk mode wajib (required=true, item HARUS ada di cart sebelum tombol checkout
// aktif) MAUPUN mode opsional (required=false, cuma ajakan dukungan sukarela) — satu komponen,
// prop `required` cuma mengubah copy header.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart, ShoppingBag, Check } from "lucide-react";
import { addToCartAction } from "@/app/(public)/[tenant]/cart/actions";
import { ProductVariationPopup } from "./product-variation-popup";
import type { ProductVariationData, AttributeGroup, ViewerImage } from "@/components/toko/public/product-detail-client";

function formatRp(n: number) { return `Rp ${n.toLocaleString("id-ID")}`; }

type ProductInfo = {
  productId:   string;
  name:        string;
  coverUrl:    string | null;
  productType: "simple" | "variable";
  unitPrice:   number;
  alreadyInCart: boolean;
  variationData?: {
    variations: ProductVariationData[];
    attrGroups: AttributeGroup[];
    images:     ViewerImage[];
  };
};

type CampaignInfo = {
  campaignId: string;
  title:      string;
  coverUrl:   string | null;
  amounts:    number[];
  alreadyInCart: boolean;
};

type Props = {
  tenantSlug: string;
  required:   boolean;
  product?:  ProductInfo | null;
  campaign?: CampaignInfo | null;
};

export function GabungItemWidget({ tenantSlug, required, product, campaign }: Props) {
  const router = useRouter();
  const [selectedNominal, setSelectedNominal] = useState<number | null>(null);
  const [customNominal,   setCustomNominal]   = useState("");
  const [donationAdded,   setDonationAdded]   = useState(false);
  const [productAdded,    setProductAdded]    = useState(false);
  const [popupOpen,       setPopupOpen]       = useState(false);
  const [donPending,  startDonTransition]  = useTransition();
  const [prodPending, startProdTransition] = useTransition();

  if (!product && !campaign) return null;

  const finalNominal = customNominal
    ? (parseInt(customNominal.replace(/\D/g, ""), 10) || 0)
    : (selectedNominal ?? 0);

  function handleAddDonation() {
    if (!campaign || finalNominal <= 0) return;
    startDonTransition(async () => {
      const res = await addToCartAction(tenantSlug, {
        itemType:  "donation",
        itemId:    campaign.campaignId,
        name:      campaign.title,
        unitPrice: finalNominal,
        forGabung: true,
      });
      if (res.success) {
        setDonationAdded(true);
        router.refresh();
      }
    });
  }

  function handleAddSimpleProduct() {
    if (!product || product.productType !== "simple") return;
    startProdTransition(async () => {
      const res = await addToCartAction(tenantSlug, {
        itemType:  "product",
        itemId:    product.productId,
        name:      product.name,
        unitPrice: product.unitPrice,
        quantity:  1,
        forGabung: true,
      });
      if (res.success) {
        setProductAdded(true);
        router.refresh();
      }
    });
  }

  function handleProductAddedFromPopup() {
    setPopupOpen(false);
    setProductAdded(true);
    router.refresh();
  }

  const campaignDone = campaign?.alreadyInCart || donationAdded;
  const productDone  = product?.alreadyInCart  || productAdded;

  return (
    <div className="relative rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {required ? "Syarat Bergabung" : `Ingin mendukung? (opsional)`}
      </p>

      {/* Bagian Donasi */}
      {campaign && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-primary shrink-0" />
            <p className="text-sm font-medium">{campaign.title}</p>
          </div>

          {campaignDone ? (
            <div className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              <Check className="h-3.5 w-3.5" /> Sudah ditambahkan ke keranjang
            </div>
          ) : (
            <>
              {campaign.amounts.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {campaign.amounts.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => { setSelectedNominal(n); setCustomNominal(""); }}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                        selectedNominal === n && !customNominal
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
                  value={customNominal}
                  onChange={(e) => { setCustomNominal(e.target.value.replace(/\D/g, "")); setSelectedNominal(null); }}
                  placeholder="Nominal lain..."
                  className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <button
                type="button"
                onClick={handleAddDonation}
                disabled={donPending || finalNominal <= 0}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
              >
                {donPending ? "Menambahkan..." : <><Heart className="h-3.5 w-3.5" /> {`Donasi${finalNominal > 0 ? ` ${formatRp(finalNominal)}` : ""}`}</>}
              </button>
            </>
          )}
        </div>
      )}

      {campaign && product && <div className="border-t border-border/60 pt-3" />}

      {/* Bagian Produk */}
      {product && (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            {product.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.coverUrl}
                alt={product.name}
                className="h-14 w-14 shrink-0 rounded-lg border border-border object-cover bg-background"
              />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
                <ShoppingBag className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <p className="text-sm font-medium">{product.name}</p>
          </div>

          {productDone ? (
            <div className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              <Check className="h-3.5 w-3.5" /> Sudah ditambahkan ke keranjang
            </div>
          ) : product.productType === "variable" ? (
            <button
              type="button"
              onClick={() => setPopupOpen(true)}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10 transition-colors"
            >
              <ShoppingBag className="h-3.5 w-3.5" /> Pilih Variasi
            </button>
          ) : (
            <button
              type="button"
              onClick={handleAddSimpleProduct}
              disabled={prodPending}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10 disabled:opacity-60 transition-colors"
            >
              {prodPending ? "Menambahkan..." : <><ShoppingBag className="h-3.5 w-3.5" /> Tambah ke Keranjang</>}
            </button>
          )}
        </div>
      )}

      {product?.productType === "variable" && product.variationData && (
        <ProductVariationPopup
          open={popupOpen}
          onOpenChange={setPopupOpen}
          tenantSlug={tenantSlug}
          productId={product.productId}
          productName={product.name}
          variations={product.variationData.variations}
          attrGroups={product.variationData.attrGroups}
          images={product.variationData.images}
          onAdded={handleProductAddedFromPopup}
        />
      )}
    </div>
  );
}
