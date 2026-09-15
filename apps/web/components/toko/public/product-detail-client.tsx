"use client";

import { useState, useEffect, useTransition } from "react";
import { ShoppingCart, Minus, Plus, Store, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductImageViewer } from "./product-image-viewer";
import { addToCartAction } from "@/app/(public)/[tenant]/cart/actions";
import { resolvePrice, formatPrice, priceLabel } from "@/lib/product-card-templates";
import type { ProductCardData, SessionType } from "@/lib/product-card-templates";
import { isFreeShippingMatch } from "@/lib/free-shipping-match";
import type { NavItem } from "@/lib/nav-menu";
import { SingleFeatureImage } from "@/components/website/public/single/single-feature-image";
import { SocialShareCard } from "@/components/website/public/single/social-share-card";
import { MobileActionSheet } from "@/components/website/public/single/mobile-action-sheet";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProductVariationData = {
  id:             string;
  sku:            string | null;
  price:          string;
  publicPrice:    string | null;
  memberPrice:    string | null;
  stock:          number;
  images:         Array<{ id: string; url: string; variants?: Record<string, string> | null; alt: string; order: number }>;
  attributeCombo: Record<string, string>;
  isActive:       boolean;
};

export type AttributeGroup = {
  name:   string;
  values: string[];
};

export type ViewerImage = {
  id:       string;
  url:      string;
  variants?: Record<string, string> | null;
  alt:      string;
};

// Hasil search /api/ongkir/cities — sama shape dipakai checkout-form.tsx.
type FsCityResult = {
  id:              number;
  label:           string;
  cityName:        string;
  provinceName:    string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findVariation(
  variations: ProductVariationData[],
  selected:   Record<string, string>,
): ProductVariationData | null {
  const keys = Object.keys(selected);
  if (keys.length === 0) return null;
  return variations.find(v =>
    keys.every(k => v.attributeCombo[k] === selected[k])
  ) ?? null;
}

function isValueAvailable(
  variations:  ProductVariationData[],
  attrName:    string,
  attrValue:   string,
  current:     Record<string, string>,
): boolean {
  return variations.some(v =>
    v.attributeCombo[attrName] === attrValue &&
    v.isActive &&
    v.stock > 0 &&
    Object.entries(current).every(([k, val]) => k === attrName || v.attributeCombo[k] === val),
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

type Props = {
  product:       ProductCardData;
  variations:    ProductVariationData[];
  attrGroups:    AttributeGroup[];
  productImages: ViewerImage[];   // gambar utama produk
  sessionType:   SessionType;
  tenantSlug:    string;
  // Shell mobile — lihat lesson CLAUDE.md "Mobile Single-Page Shell"
  backHref:      string;
  navMenu:       NavItem[];
  siteName:      string;
  pageUrl:       string;
  // Penanda "niat bayar untuk daftar forum" dari /gabung?forGabung=1 — lihat
  // docs/arsitektur-backbone-ikpm.md § "Pemisahan Donasi vs Registrasi Forum". Default false
  // untuk kunjungan biasa (bukan dari /gabung).
  forGabungRegistration?: boolean;
};

export function ProductDetailClient({
  product,
  variations,
  attrGroups,
  productImages,
  sessionType,
  tenantSlug,
  backHref,
  navMenu,
  siteName,
  pageUrl,
  forGabungRegistration = false,
}: Props) {
  const isVariable = product.productType === "variable";

  const [selected, setSelected]   = useState<Record<string, string>>({});
  const [quantity, setQuantity]   = useState(1);
  const [added, setAdded]         = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Badge "Gratis Ongkir" — mode "all" selalu tampil, mode "regions" perlu customer ketik
  // daerah tujuan dulu (search kelurahan yang sama dipakai checkout) baru dicocokkan. Lihat
  // docs/arsitektur-addon-ongkir.md § "Badge Gratis Ongkir di Halaman Produk Publik".
  const freeShippingMode      = product.freeShippingMode      ?? "none";
  const freeShippingProvinces = product.freeShippingProvinces ?? [];
  const freeShippingCities    = product.freeShippingCities    ?? [];
  const [fsDestQuery,   setFsDestQuery]   = useState("");
  const [fsDestResults, setFsDestResults] = useState<FsCityResult[]>([]);
  const [fsDestOpen,    setFsDestOpen]    = useState(false);
  const [fsMatchedName, setFsMatchedName] = useState<string | null>(null);

  useEffect(() => {
    if (freeShippingMode !== "regions" || fsMatchedName) return;
    if (fsDestQuery.trim().length < 2) { setFsDestResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/ongkir/cities?q=${encodeURIComponent(fsDestQuery)}&limit=8`);
        const data = await res.json() as { cities?: FsCityResult[] };
        setFsDestResults(data.cities ?? []);
      } catch {
        setFsDestResults([]);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [fsDestQuery, freeShippingMode, fsMatchedName]);

  function handlePickFsDestination(city: FsCityResult) {
    const matched = isFreeShippingMatch(
      { freeShippingMode, freeShippingProvinces, freeShippingCities },
      { provinceName: city.provinceName, cityName: city.cityName },
    );
    setFsDestOpen(false);
    setFsDestQuery(city.label);
    setFsMatchedName(matched ? (city.cityName || city.provinceName) : null);
  }
  // Popup sukses "Produk berhasil ditambahkan!" — muncul setelah addToCartAction sukses,
  // menggantikan feedback inline lama. collapseSignal MobileActionSheet dipakai supaya popup
  // ini (z-50) tidak tersembunyi di balik sheet (z-71) saat dibuka dari mobile.
  const [showAddedDialog, setShowAddedDialog] = useState(false);

  const activeVariation = isVariable ? findVariation(variations, selected) : null;

  // Gambar: pakai gambar variasi terpilih jika ada, fallback ke gambar produk utama
  const displayImages: ViewerImage[] =
    activeVariation && activeVariation.images.length > 0
      ? activeVariation.images
      : productImages;

  // Harga display
  const displayPrice: string = (() => {
    if (isVariable) {
      if (activeVariation) {
        const vProduct: ProductCardData = {
          ...product,
          price:       activeVariation.price,
          publicPrice: activeVariation.publicPrice,
          memberPrice: activeVariation.memberPrice,
          productType: "simple",
          priceMin:    activeVariation.price,
          priceMax:    null,
        };
        return resolvePrice(vProduct, sessionType);
      }
      return product.priceMin; // sebelum pilih variasi
    }
    return resolvePrice(product, sessionType);
  })();

  const originalPrice = isVariable
    ? (activeVariation?.price ?? null)
    : product.price;

  const hasDiscount = !isVariable && displayPrice !== originalPrice;

  // Stok — untuk simple product, `product.availableStock` (stok fisik dikurangi reservasi
  // invoice pending lain, dihitung server-side) SEBELUMNYA tidak pernah ada sama sekali di tipe
  // data ini, jadi isOutOfStock selalu hardcode false apapun stoknya. Lihat docs/arsitektur-stok.md.
  const stock = isVariable ? (activeVariation?.stock ?? 0) : (product.availableStock ?? null);
  const isOutOfStock = isVariable
    ? (activeVariation !== null && stock === 0)
    : (stock !== null && stock <= 0);

  // Tombol disabled jika variable dan belum pilih semua atribut
  const allAttrSelected = isVariable
    ? attrGroups.every(g => selected[g.name])
    : true;
  const canAdd = allAttrSelected && !isOutOfStock && !isPending;

  async function handleAddToCart() {
    setError(null);

    const itemId   = isVariable ? activeVariation?.id : product.id;
    const itemName = isVariable && activeVariation
      ? `${product.name} — ${Object.values(activeVariation.attributeCombo).join(" / ")}`
      : product.name;
    const unitPrice = parseFloat(displayPrice);

    const result = await addToCartAction(tenantSlug, {
      itemType:  "product",
      itemId,
      name:      itemName,
      unitPrice,
      quantity,
      forGabung: forGabungRegistration,
    });

    if (result.success) {
      setAdded(true);
      setTimeout(() => setAdded(false), 2500);
      setShowAddedDialog(true);
    } else {
      setError(result.error);
    }
  }

  // ── Potongan JSX yang dipakai bersama desktop & mobile ──────────────────────

  const categoryBadge = product.categoryName && (
    <span className="inline-block text-xs font-medium bg-primary/10 text-primary px-2.5 py-1 rounded-full">
      {product.categoryName}
    </span>
  );

  const mitraBadge = product.sellerType === "mitra" && product.businessName && (
    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Store className="h-4 w-4" />
      Dijual oleh <span className="font-medium text-foreground">{product.businessName}</span>
    </p>
  );

  const priceBlock = (
    <div className="space-y-1">
      {isVariable && !activeVariation ? (
        <p className="text-xl font-bold">{priceLabel(product, sessionType)}</p>
      ) : (
        <>
          <p className="text-2xl font-bold text-primary">{formatPrice(displayPrice)}</p>
          {hasDiscount && originalPrice && (
            <p className="text-sm text-muted-foreground line-through">{formatPrice(originalPrice)}</p>
          )}
          {sessionType === "member" && (activeVariation?.memberPrice ?? product.memberPrice) && (
            <span className="inline-block text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
              Harga Anggota IKPM
            </span>
          )}
        </>
      )}
    </div>
  );

  const variationPicker = isVariable && attrGroups.length > 0 && (
    <div className="space-y-4">
      {attrGroups.map(group => (
        <div key={group.name}>
          <p className="text-sm font-medium mb-2">
            {group.name}
            {selected[group.name] && (
              <span className="text-muted-foreground font-normal ml-2">: {selected[group.name]}</span>
            )}
          </p>
          <div className="flex gap-2 flex-wrap">
            {group.values.map(val => {
              const available = isValueAvailable(variations, group.name, val, selected);
              const isSelected = selected[group.name] === val;
              return (
                <button
                  key={val}
                  disabled={!available}
                  onClick={() => {
                    setSelected(prev => ({ ...prev, [group.name]: val }));
                    setQuantity(1);
                  }}
                  className={[
                    "px-3 py-1.5 rounded-lg border text-sm font-medium transition-all",
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary"
                      : available
                      ? "border-border hover:border-primary/50 hover:bg-muted"
                      : "border-border text-muted-foreground/40 line-through cursor-not-allowed",
                  ].join(" ")}
                >
                  {val}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  // Tampil untuk variasi yang sudah dipilih MAUPUN produk simple (sebelumnya cuma variasi —
  // produk simple tidak pernah tampilkan stok sama sekali). Lihat docs/arsitektur-stok.md.
  const stockInfo = (isVariable ? activeVariation !== null : true) && stock !== null && (
    <p className="text-sm text-muted-foreground">
      Stok: <span className={stock === 0 ? "text-destructive font-medium" : "text-foreground font-medium"}>
        {stock === 0 ? "Habis" : stock}
      </span>
    </p>
  );

  const freeShippingBadge = (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
      <Truck className="h-3.5 w-3.5 shrink-0" />
      {freeShippingMode === "all" ? "Gratis Ongkir Seluruh Indonesia" : `Gratis Ongkir ke ${fsMatchedName}`}
    </div>
  );

  const freeShippingInfo =
    freeShippingMode === "all" ? freeShippingBadge
    : freeShippingMode === "regions" ? (
      fsMatchedName ? freeShippingBadge : (
        <div className="relative max-w-xs">
          <input
            type="text"
            value={fsDestQuery}
            onChange={(e) => { setFsDestQuery(e.target.value); setFsDestOpen(true); }}
            onFocus={() => fsDestResults.length > 0 && setFsDestOpen(true)}
            onBlur={() => setTimeout(() => setFsDestOpen(false), 150)}
            placeholder="Cek gratis ongkir ke daerah Anda..."
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {fsDestOpen && fsDestResults.length > 0 && (
            <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-background shadow-lg max-h-48 overflow-y-auto">
              {fsDestResults.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handlePickFsDestination(c)}
                  className="block w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors"
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )
    ) : null;

  const qtyAndCta = (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {/* Quantity stepper */}
        <div className="flex items-center border border-border rounded-lg overflow-hidden shrink-0">
          <button
            className="px-3 py-2.5 hover:bg-muted transition-colors disabled:opacity-40"
            disabled={quantity <= 1 || isPending}
            onClick={() => setQuantity(q => Math.max(1, q - 1))}
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="px-4 py-2.5 text-sm font-medium min-w-[2.5rem] text-center">{quantity}</span>
          <button
            className="px-3 py-2.5 hover:bg-muted transition-colors disabled:opacity-40"
            disabled={isPending || (isVariable && stock !== null && quantity >= stock)}
            onClick={() => setQuantity(q => q + 1)}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Tombol tambah ke keranjang */}
        <Button
          className="flex-1"
          size="lg"
          disabled={!canAdd}
          onClick={() => startTransition(handleAddToCart)}
        >
          <ShoppingCart className="h-4 w-4 mr-2" />
          {isPending ? "Menambahkan..." : added ? "Ditambahkan ✓" : isOutOfStock ? "Stok Habis" : !allAttrSelected ? "Pilih Variasi" : "Beli Sekarang"}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );

  // Collapsed bar bottom sheet mobile — harga LIVE ikut activeVariation (component ini satu-
  // satunya pemilik state, jadi aman ditampilkan live, beda dari Event/Campaign yang statis).
  // Badge "Beli" solid saat collapsed, jadi outline netral begitu expanded (detail beli
  // terbuka) — supaya tombol "Tambah ke Keranjang" sungguhan di dalam sheet yang jadi fokus.
  const collapsedBar = (expanded: boolean) => (
    <>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-xs text-muted-foreground">Harga</p>
        <p className="text-sm font-semibold truncate">
          {isVariable && !activeVariation ? priceLabel(product, sessionType) : formatPrice(displayPrice)}
        </p>
      </div>
      <span className={`btn btn-sm shrink-0 pointer-events-none ${expanded ? "btn-outline-dark" : "btn-primary"}`}>
        Beli
      </span>
    </>
  );

  return (
    <>
      {/* ── Mobile shell — gallery full-bleed + overlay back/menu, bottom sheet beli ── */}
      <div className="md:hidden">
        <SingleFeatureImage backHref={backHref} navMenu={navMenu} siteName={siteName}>
          <ProductImageViewer images={displayImages} productName={product.name} />
        </SingleFeatureImage>
        <div className="px-4 pt-4 space-y-3">
          {categoryBadge}
          <h1 className="text-2xl font-bold leading-snug">{product.name}</h1>
          {mitraBadge}
          <SocialShareCard url={pageUrl} title={product.name} />
        </div>
        <MobileActionSheet collapsedBar={collapsedBar} collapseSignal={showAddedDialog}>
          <div className="space-y-5 pt-2">
            {priceBlock}
            {variationPicker}
            {stockInfo}
            {freeShippingInfo}
            {qtyAndCta}
          </div>
        </MobileActionSheet>
      </div>

      {/* ── Desktop/tablet — TIDAK DIUBAH ── */}
      <div className="hidden md:grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
        {/* Kiri — Image viewer: gambar besar + thumbnail strip */}
        <div>
          <ProductImageViewer images={displayImages} productName={product.name} />
        </div>

        {/* Kanan — Info + CTA */}
        <div className="space-y-5">
          {categoryBadge}
          <h1 className="text-2xl font-bold leading-snug">{product.name}</h1>
          {mitraBadge}
          {priceBlock}
          {variationPicker}
          {stockInfo}
          {freeShippingInfo}
          {qtyAndCta}
        </div>
      </div>

      {/* ── Popup sukses tambah keranjang ── */}
      <AlertDialog open={showAddedDialog} onOpenChange={setShowAddedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Produk berhasil ditambahkan!</AlertDialogTitle>
            <AlertDialogDescription>
              Mau tambah produk lainnya atau langsung selesaikan pesanan?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Tambah Produk Lain</AlertDialogCancel>
            <AlertDialogAction onClick={() => { window.location.href = `/${tenantSlug}/keranjang`; }}>
              Lanjut ke Pesanan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
