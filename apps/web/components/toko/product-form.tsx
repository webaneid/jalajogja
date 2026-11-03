"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Combobox } from "@/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TiptapEditor } from "@/components/editor/tiptap-editor";
import { SeoPanel } from "@/components/seo/seo-panel";
import { MediaPicker, type MediaItem } from "@/components/media/media-picker";
import { MemberMediaPicker, type MemberMediaItem } from "@/components/media/member-media-picker";
import { computeBaseCost } from "@/lib/producer-products";
import { buildVariationCombos } from "@/lib/variation-combos";
import { FreeShippingPicker, type FreeShippingMode, type FreeShippingRegion } from "@/components/toko/free-shipping-picker";
import {
  createProductAction,
  updateProductAction,
  toggleProductStatusAction,
  deleteProductAction,
  saveVariationsAction,
  generateVariationsAction,
  type ProductData,
  type ProductImage,
} from "@/app/(dashboard)/app/[tenant]/toko/actions";

// Lokal — tidak import dari "use server" file agar tidak jadi server action proxy
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}
import type { SeoValues } from "@/components/seo/seo-panel";
import { AttributeGroupEditor } from "./attribute-group-editor";
import { VariationTable, type VariationLocal } from "./variation-table";
import type { AttributeGroup } from "@jalajogja/db";
import {
  ChevronLeft,
  ImagePlus,
  X,
  ArrowUp,
  ArrowDown,
  Trash2,
  Globe,
  Archive,
  EyeOff,
  Save,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = { id: string; name: string; slug: string };

export type ProductFormProps = {
  slug:      string;
  tenantName: string;   // untuk label checkbox "Khusus Anggota {nama tenant}"
  productId: string | null; // null = create mode
  initialData: {
    name:            string;
    productSlug:     string;
    sku:             string;
    description:     string;
    price:           number;
    publicPrice:     number | null;
    memberPrice:     number | null;
    memberPriceTenantOnly: boolean;
    stock:           number;
    weightGram:      number | null;
    originId:        string | null;
    freeShippingMode:      "none" | "all" | "regions";
    freeShippingProvinces: FreeShippingRegion[];
    freeShippingCities:    FreeShippingRegion[];
    pickupLocationName: string | null;
    pickupAddress:      string | null;
    pickupMapsUrl:      string | null;
    images:          ProductImage[];
    categoryId:      string | null;
    producerId:      string | null;   // null = internal (tenant sendiri)
    status:          "draft" | "active" | "archived" | "frozen";
    productType:     "simple" | "variable";
    attributeGroups: AttributeGroup[];
    variations:      VariationLocal[];
    seo:             SeoValues;
  };
  categories: Category[];
  // Produsen (ADMIN-ONLY, docs/arsitektur-produsen.md): daftar produsen aktif (id + nama saja — tanpa
  // nomor/alamat). `null` = field disembunyikan (produk mitra tidak memakai produsen).
  producerOptions: { value: string; label: string }[] | null;
  // Asal kirim yang tersedia (shipping_origins, semua pemilik) — dipilih per produk; difilter ke pemilik produk di form.
  // producerId null = milik toko/internal. Doc: docs/arsitektur-alamat.md § 20.
  originOptions?: { id: string; producerId: string | null; label: string; place: string; isDefault: boolean }[];
  // MODE PRODUSEN (docs/arsitektur-produk-produsen.md § 15, K31): tampilan SAMA, tetapi field terlarang disembunyikan, foto dari
  // Media Library ANGGOTA, harga dasar read-only. Ini HANYA tampilan — jalur simpan (onSave/onDelete) adalah Server Action produsen
  // yang menegakkan semuanya di server (producerId dari sesi, harga dasar dihitung server, gudang/variasi diverifikasi).
  producer?: {
    sharePercent: number;
    listHref:     string;   // daftar produk produsen
    detailHref:   string;   // awalan halaman produk: `${detailHref}/${id}`
    onSave:       (input: unknown) => Promise<{ success: true; productId?: string } | { success: false; error: string }>;
    onDelete?:    () => Promise<{ success: true } | { success: false; error: string }>;
  };
};

// ─── StatusBadge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
    active:   { label: "Aktif",       variant: "default"   },
    draft:    { label: "Draft",       variant: "secondary" },
    archived: { label: "Diarsipkan",  variant: "outline"   },
    frozen:   { label: "Dibekukan",   variant: "destructive" },
  };
  const { label, variant } = map[status] ?? { label: status, variant: "outline" };
  return <Badge variant={variant}>{label}</Badge>;
}

// ─── ProductImages — grid dengan MediaPicker + tombol naik/turun ──────────────

function ProductImages({
  slug,
  images,
  onChange,
  member = false,
}: {
  slug:     string;
  images:   ProductImage[];
  onChange: (imgs: ProductImage[]) => void;
  member?:  boolean;   // true = Media Library ANGGOTA (mode produsen)
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  function handleSelect(media: MediaItem | MemberMediaItem) {
    if (images.some((img) => img.id === media.id)) return;
    const newImg: ProductImage = {
      id:       media.id,
      url:      media.url,
      variants: media.variants ?? null,
      alt:      member ? "" : (("altText" in media ? media.altText : null) ?? media.originalName),   // produsen: alt diisi nama produk saat simpan
      order:    images.length,
    };
    onChange([...images, newImg]);
  }

  function remove(id: string) {
    const next = images
      .filter((img) => img.id !== id)
      .map((img, i) => ({ ...img, order: i }));
    onChange(next);
  }

  function move(index: number, dir: "up" | "down") {
    const next = [...images];
    const swap = dir === "up" ? index - 1 : index + 1;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    onChange(next.map((img, i) => ({ ...img, order: i })));
  }

  return (
    <div className="space-y-2">
      {/* Grid gambar */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {images.map((img, idx) => (
            <div key={img.id} className="group relative rounded-md border border-border overflow-hidden aspect-square bg-muted/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.variants?.square ?? img.url}
                alt={img.alt}
                className="w-full h-full object-cover"
              />

              {/* Overlay aksi */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-1">
                {/* Reorder */}
                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => move(idx, "up")}
                    disabled={idx === 0}
                    className="w-6 h-6 rounded bg-white/80 text-foreground flex items-center justify-center disabled:opacity-30 hover:bg-white"
                    title="Pindah ke kiri"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(idx, "down")}
                    disabled={idx === images.length - 1}
                    className="w-6 h-6 rounded bg-white/80 text-foreground flex items-center justify-center disabled:opacity-30 hover:bg-white"
                    title="Pindah ke kanan"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                </div>

                {/* Hapus */}
                <button
                  type="button"
                  onClick={() => remove(img.id)}
                  className="w-6 h-6 rounded bg-red-500 text-white flex items-center justify-center hover:bg-red-600 self-end"
                  title="Hapus gambar"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>

              {/* Urutan badge */}
              <span className="absolute top-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white leading-none">
                {idx + 1}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Tombol tambah */}
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="w-full flex items-center justify-center gap-2 rounded-md border-2 border-dashed border-border py-3 text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
      >
        <ImagePlus className="h-4 w-4" />
        Tambah Gambar
      </button>

      <p className="text-xs text-muted-foreground">
        Gambar pertama ditampilkan sebagai thumbnail utama.
        Hover gambar untuk mengubah urutan atau menghapus.
      </p>

      {member ? (
        <MemberMediaPicker slug={slug} open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={handleSelect} />
      ) : (
        <MediaPicker
          slug={slug}
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelect={handleSelect}
          module="shop"
          accept={["image/"]}
        />
      )}
    </div>
  );
}

// ─── ProductForm (komponen utama) ─────────────────────────────────────────────

export function ProductForm({
  slug,
  tenantName,
  productId,
  initialData,
  categories,
  producerOptions,
  originOptions = [],
  producer,
}: ProductFormProps) {
  const router = useRouter();
  const isProducer = !!producer;

  // Form state
  const [name,        setName]        = useState(initialData.name);
  const [productSlug, setProductSlug] = useState(initialData.productSlug);
  const [sku,         setSku]         = useState(initialData.sku);
  const [description, setDescription] = useState(initialData.description);
  const [price,           setPrice]           = useState(String(initialData.price));
  const [publicPrice,     setPublicPrice]     = useState(initialData.publicPrice != null ? String(initialData.publicPrice) : "");
  const [memberPrice,     setMemberPrice]     = useState(initialData.memberPrice != null ? String(initialData.memberPrice) : "");
  const [memberPriceTenantOnly, setMemberPriceTenantOnly] = useState(initialData.memberPriceTenantOnly);
  const [stock,           setStock]           = useState(String(initialData.stock));
  const [weightGram,      setWeightGram]      = useState(initialData.weightGram != null ? String(initialData.weightGram) : "");
  const [originId, setOriginId] = useState<string>(initialData.originId ?? "");
  const [freeShippingMode,      setFreeShippingMode]      = useState<FreeShippingMode>(initialData.freeShippingMode);
  const [freeShippingProvinces, setFreeShippingProvinces] = useState<FreeShippingRegion[]>(initialData.freeShippingProvinces);
  const [freeShippingCities,    setFreeShippingCities]    = useState<FreeShippingRegion[]>(initialData.freeShippingCities);
  const [pickupLocationName, setPickupLocationName] = useState(initialData.pickupLocationName ?? "");
  const [pickupAddress,      setPickupAddress]      = useState(initialData.pickupAddress ?? "");
  const [pickupMapsUrl,      setPickupMapsUrl]      = useState(initialData.pickupMapsUrl ?? "");
  const [productType,     setProductType]     = useState<"simple" | "variable">(initialData.productType);
  const [attributeGroups, setAttributeGroups] = useState<AttributeGroup[]>(initialData.attributeGroups);
  const [variations,      setVariations]      = useState<VariationLocal[]>(initialData.variations);
  const [images,      setImages]      = useState<ProductImage[]>(initialData.images);
  const [categoryId,  setCategoryId]  = useState(initialData.categoryId ?? "none");
  // "internal" = tanpa produsen khusus (tenant sendiri) → disimpan sebagai producerId null
  const [producerId,  setProducerId]  = useState(initialData.producerId ?? "internal");
  const [status,      setStatus]      = useState(initialData.status);
  const [seo,         setSeo]         = useState<SeoValues>(initialData.seo);

  const [error,    setError]    = useState("");
  const [saveMsg,  setSaveMsg]  = useState("");
  const [isPending, startTransition] = useTransition();
  const [isToggling, startToggle]    = useTransition();
  const [isDeleting, startDelete]    = useTransition();

  // Auto-generate slug dari nama — menggunakan slugEdited flag
  const [slugEdited, setSlugEdited] = useState(false);

  function handleNameChange(val: string) {
    setName(val);
    if (!slugEdited) setProductSlug(slugify(val));
  }

  function handleSlugChange(val: string) {
    setSlugEdited(true);
    setProductSlug(val);
  }

  // Total stok produk bervariasi = jumlah stok variasi AKTIF (stok utama diabaikan).
  const variationStockTotal = variations
    .filter((v) => v.isActive)
    .reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0);

  function handleSave() {
    setError("");
    setSaveMsg("");

    const priceNum      = parseFloat(price) || 0;
    const publicNum     = parseFloat(publicPrice) || 0;
    const memberNum     = parseFloat(memberPrice) || 0;
    const stockNum      = parseInt(stock) || 0;

    // ── MODE PRODUSEN: payload sempit ke Server Action produsen (harga dasar TIDAK dikirim — dihitung server) ──
    if (producer) {
      if (!name.trim()) { setError("Nama produk wajib diisi."); return; }
      if (!productSlug.trim()) { setError("Slug wajib diisi."); return; }
      if (freeShippingMode === "regions" && freeShippingProvinces.length + freeShippingCities.length === 0) { setError("Gratis ongkir daerah tertentu: pilih minimal 1 provinsi atau kabupaten/kota."); return; }
      if (publicNum <= 0) { setError("Harga jual wajib diisi."); return; }
      if (memberNum > publicNum) { setError("Harga Anggota tidak boleh lebih tinggi dari Harga Jual."); return; }
      if (!(parseInt(weightGram) > 0)) { setError("Berat (gram) wajib diisi."); return; }
      if (images.length === 0) { setError("Minimal 1 foto produk."); return; }
      const mineOrigins = originOptions.filter((o) => o.producerId === initialData.producerId);
      if (mineOrigins.length > 1 && !mineOrigins.some((o) => o.id === originId)) { setError("Pilih gudang pengiriman produk ini."); return; }
      if (productType === "variable" && variations.length === 0) { setError("Produk bervariasi butuh minimal satu variasi. Isi atribut lalu klik Generate Variasi."); return; }
      const toImg = (i: ProductImage) => ({ mediaId: i.id, alt: i.alt || name.trim() });
      const payload = {
        name: name.trim(), slug: productSlug.trim(), sku: sku.trim() || null,
        freeShipping: { mode: freeShippingMode, provinces: freeShippingProvinces, cities: freeShippingCities },
        seo: { metaTitle: seo.metaTitle, metaDesc: seo.metaDesc, focusKeyword: seo.focusKeyword, ogTitle: seo.ogTitle, ogDescription: seo.ogDescription, twitterCard: seo.twitterCard },
        description: description || "", categoryId: categoryId === "none" ? null : categoryId,
        images: images.map(toImg), publicPrice, memberPrice: memberPrice.trim() === "" ? null : memberPrice,
        stock, weightGram, status: status === "frozen" ? "draft" : status,   // status beku tidak dikirim berubah: server mempertahankan
        originId: mineOrigins.some((o) => o.id === originId) ? originId : null,
        productType, attributeGroups: productType === "variable" ? attributeGroups : [],
        variations: productType === "variable" ? variations.map((v) => ({
          id: v.id ?? null, sku: v.sku.trim() || null,
          publicPrice: v.publicPrice.trim() === "" ? null : v.publicPrice, memberPrice: v.memberPrice.trim() === "" ? null : v.memberPrice,
          stock: v.stock, weightGram: v.weightGram.trim() === "" ? null : v.weightGram,
          images: v.images.map(toImg), attributeCombo: v.attributeCombo, isActive: v.isActive,
        })) : [],
      };
      startTransition(async () => {
        const res = await producer.onSave(payload);
        if (!res.success) { setError(res.error); return; }
        if (productId === null && res.productId) { router.push(`${producer.detailHref}/${res.productId}`); router.refresh(); return; }
        setSaveMsg("Tersimpan");
        setTimeout(() => setSaveMsg(""), 2000);
        router.refresh();
      });
      return;
    }

    // Model harga baru: Harga Dasar (modal) + Harga Publik (harga jual) wajib. Server memvalidasi
    // ulang — ini hanya supaya admin tahu sebelum request dikirim.
    if (priceNum <= 0)  { setError("Harga Dasar wajib diisi."); return; }
    if (publicNum <= 0) { setError("Harga Publik wajib diisi."); return; }
    if (memberNum > publicNum) { setError("Harga Anggota tidak boleh lebih tinggi dari Harga Publik."); return; }
    const weightGramNum = weightGram ? (parseInt(weightGram) || null) : null;

    const data: ProductData = {
      name:            name.trim(),
      slug:            productSlug.trim(),
      sku:             sku.trim() || null,
      description:     description || null,
      price:           priceNum,
      publicPrice:     publicPrice ? (parseFloat(publicPrice) || null) : null,
      memberPrice:     memberPrice ? (parseFloat(memberPrice) || null) : null,
      memberPriceTenantOnly,
      stock:           stockNum,
      weightGram:      weightGramNum,
      // Hanya asal milik pemilik produk SAAT INI (mengganti produsen membuang pilihan asal produsen lama)
      originId:        originOptions.some((o) => o.id === originId && o.producerId === (producerId === "internal" ? null : producerId)) ? originId : null,
      freeShippingMode,
      freeShippingProvinces: freeShippingMode === "regions" ? freeShippingProvinces : [],
      freeShippingCities:    freeShippingMode === "regions" ? freeShippingCities    : [],
      pickupLocationName: pickupLocationName.trim() || null,
      pickupAddress:      pickupAddress.trim() || null,
      pickupMapsUrl:      pickupMapsUrl.trim() || null,
      productType,
      attributeGroups: productType === "variable" ? attributeGroups : [],
      images:      images.map((img, i) => ({ ...img, order: i })),
      categoryId:  categoryId === "none" ? null : categoryId,
      // undefined (tidak dikirim) kalau field disembunyikan — produk mitra tidak diubah produsennya
      ...(producerOptions ? { producerId: producerId === "internal" ? null : producerId } : {}),
      status,
      metaTitle:     seo.metaTitle     || null,
      metaDesc:      seo.metaDesc      || null,
      ogTitle:       seo.ogTitle       || null,
      ogDescription: seo.ogDescription || null,
      ogImageId:     seo.ogImageId     || null,
      twitterCard:   (seo.twitterCard  || "summary_large_image") as "summary" | "summary_large_image",
      focusKeyword:  seo.focusKeyword  || null,
      canonicalUrl:  seo.canonicalUrl  || null,
      robots:        (seo.robots       || "index,follow") as "index,follow" | "noindex" | "noindex,nofollow",
    };

    startTransition(async () => {
      if (productId === null) {
        // Create mode — record belum ada
        const res = await createProductAction(slug, data);
        if (res.success) {
          router.push(`/app/${slug}/toko/produk/${res.data.productId}/edit`);
        } else {
          setError(res.error);
        }
      } else {
        const res = await updateProductAction(slug, productId, data);
        if (res.success) {
          // Simpan variasi jika variable product
          if (productType === "variable") {
            await saveVariationsAction(slug, productId, variations);
          }
          setSaveMsg("Tersimpan");
          setTimeout(() => setSaveMsg(""), 2000);
        } else {
          setError(res.error);
        }
      }
    });
  }

  function handleToggleStatus() {
    if (!productId) return;
    startToggle(async () => {
      const res = await toggleProductStatusAction(slug, productId);
      if (res.success) {
        setStatus(res.data.newStatus as "draft" | "active" | "archived" | "frozen");
      } else {
        setError(res.error);
      }
    });
  }

  function handleDelete() {
    if (!productId) return;
    if (!confirm("Hapus produk ini? Tindakan tidak bisa dibatalkan.")) return;
    if (producer) {
      startDelete(async () => {
        const res = await producer.onDelete?.();
        if (!res || !res.success) { setError(res ? res.error : "Hapus tidak tersedia."); return; }
        router.push(producer.listHref);
        router.refresh();
      });
      return;
    }
    startDelete(async () => {
      const res = await deleteProductAction(slug, productId);
      if (res.success) {
        router.push(`/app/${slug}/toko/produk`);
      } else {
        setError(res.error);
      }
    });
  }

  // Label tombol berdasarkan status
  const saveLabel  = status === "draft" ? "Simpan Draft" : "Simpan Perubahan";
  const toggleBtn  = {
    draft:    { label: "Aktifkan",     icon: Globe,    variant: "default" as const },
    active:   { label: "Arsipkan",     icon: Archive,  variant: "outline" as const },
    archived: { label: "Aktifkan",     icon: Globe,    variant: "default" as const },
    frozen:   { label: "Buka Pembekuan", icon: Globe,  variant: "default" as const },
  }[status] ?? { label: "Ubah Status", icon: Save, variant: "outline" as const };
  const ToggleIcon = toggleBtn.icon;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      {/* shrink-0 (bukan sticky): body di bawah sudah scroll sendiri. `sticky top-0` di dalam <main> berpadding
          (portal produsen) menempel di batas padding → header turun 1,5rem dan menimpa isi form. */}
      <div className="shrink-0 flex items-center justify-between border-b border-border bg-background px-6 py-3">
        <button
          type="button"
          onClick={() => router.push(producer ? producer.listHref : `/app/${slug}/toko/produk`)}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Produk
        </button>
        <StatusBadge status={status} />
      </div>

      {/* Body — mobile: satu kolom natural scroll (sidebar di bawah main). Desktop: dua panel
          independen scroll seperti semula. Pola sama dengan event-form.tsx/campaign-form.tsx. */}
      <div className="flex flex-col md:flex-row flex-1 overflow-y-auto md:overflow-hidden">
        {/* ── Main area ── */}
        <div className="flex-1 md:overflow-y-auto p-4 md:p-6 space-y-5">
          {/* Nama */}
          <div>
            <Input
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Nama produk"
              className="text-xl font-semibold border-none shadow-none px-0 text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-0 h-auto py-0"
            />
          </div>

          {/* Slug */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground shrink-0">Slug:</span>
            <Input
              value={productSlug}
              onChange={(e) => handleSlugChange(slugify(e.target.value))}
              className="font-mono text-xs border-none shadow-none px-0 h-auto py-0 focus-visible:ring-0 text-muted-foreground"
            />
          </div>

          {/* SKU */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">SKU (opsional)</label>
              <Input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="mis. PRD-001"
              />
            </div>
          </div>

          <Separator />

          {/* Deskripsi — Tiptap */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Deskripsi Produk</p>
            <TiptapEditor
              slug={slug}
              basic={isProducer}
              content={description}
              onChange={setDescription}
              placeholder="Tulis deskripsi produk di sini..."
            />
          </div>

          <Separator />

          {/* SEO Panel — produsen: versi terbatas (tanpa OG Image/Canonical/Robots/Schema) */}
          <SeoPanel
            slug={slug}
            contentType="product"
            values={seo}
            onChange={setSeo}
            title={name}
            content={description}
            restricted={isProducer}
          />
        </div>

        {/* ── Sidebar ── */}
        {/* Konten scroll SENDIRI (flex-1 overflow-y-auto), footer bar TIDAK sticky — flex
            sibling biasa di bawahnya. Sebelumnya overflow-y-auto ada di wrapper LUAR + footer
            sticky bottom-0 sebagai sibling — begitu Atribut Produk punya >1 grup (konten jadi
            tinggi), footer "melayang" menutupi tombol Generate Variasi/baris variasi saat
            discroll. Pola ini (scroll dibatasi ke area konten, footer flex biasa) menghilangkan
            kelas overlap ini total, bukan cuma ditambal padding.
            Mobile: seluruh sidebar (termasuk trik scroll-internal ini) TIDAK dipakai — flex-1 +
            overflow-y-auto cuma aktif dari md ke atas (`md:flex-1 md:overflow-y-auto`), supaya di
            mobile kontennya mengalir natural sebagai bagian dari satu kolom yang di-scroll body,
            bukan area scroll independen bersarang di dalam kolom yang juga discroll (UX buruk di
            layar sentuh). */}
        <div className="w-full md:w-72 md:shrink-0 border-t md:border-t-0 md:border-l border-border bg-muted/10 flex flex-col md:overflow-hidden">
          <div className="md:flex-1 md:overflow-y-auto space-y-5 p-4">

            {/* Harga & Stok */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Harga & Stok</p>

              {/* Card Harga — 3 tier dalam 1 card */}
              <div className="rounded-xl border border-border bg-card divide-y divide-border">

                {/* Harga Dasar (modal) — tiap harga berbentuk KOLOM: label + keterangan di atas, isian selebar kartu di bawah (K40) */}
                <div className="space-y-1.5 px-3 py-3">
                  <div>
                    <p className="text-sm font-semibold leading-tight">Harga Dasar {!producer && <span className="text-destructive">*</span>}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                      {producer ? `Otomatis dari bagi hasil (${producer.sharePercent}% untuk tenant) — tidak bisa diubah` : "Modal / harga dari produsen — tidak tampil ke pembeli"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Rp</span>
                    {producer ? (
                      <Input readOnly disabled value={Number(publicPrice) > 0 ? computeBaseCost(Number(publicPrice), producer.sharePercent).toLocaleString("id-ID") : "—"} className="h-9 w-full text-sm" />
                    ) : (
                      <Input
                        type="number" min="0" step="1"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="0"
                        className="h-9 w-full text-sm"
                      />
                    )}
                  </div>
                </div>

                {/* Harga Publik */}
                <div className="space-y-1.5 px-3 py-3">
                  <div>
                    <p className="text-sm font-semibold leading-tight">{producer ? "Harga Jual" : "Harga Publik"} <span className="text-destructive">*</span></p>
                    <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">Harga jual untuk semua orang (login maupun tidak)</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Rp</span>
                    <Input
                      type="number" min="0" step="1"
                      value={publicPrice}
                      onChange={(e) => setPublicPrice(e.target.value)}
                      placeholder="0"
                      className="h-9 w-full text-sm"
                    />
                  </div>
                </div>

                {/* Harga Anggota */}
                <div className="space-y-2 px-3 py-3">
                  <div className="space-y-1.5">
                    <div>
                      <p className="text-sm font-semibold leading-tight">Harga Anggota</p>
                      <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">Opsional — kosong = anggota membayar Harga Publik</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Rp</span>
                      <Input
                        type="number" min="0" step="1"
                        value={memberPrice}
                        onChange={(e) => setMemberPrice(e.target.value)}
                        placeholder="—"
                        className="h-9 w-full text-sm"
                      />
                    </div>
                  </div>
                  {!isProducer && <label className="flex items-start gap-2 text-[11px] text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={memberPriceTenantOnly}
                      onChange={(e) => setMemberPriceTenantOnly(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>
                      Khusus Anggota {tenantName}
                      <span className="block text-[10px]">
                        {memberPriceTenantOnly
                          ? `Harga Anggota hanya untuk anggota ${tenantName}.`
                          : "Tidak dicentang: berlaku untuk semua anggota IKPM terdaftar."}
                      </span>
                    </span>
                  </label>}
                  {Number(publicPrice) > 0 && Number(memberPrice) > Number(publicPrice) && (
                    <p className="text-[11px] text-destructive">Harga Anggota tidak boleh lebih tinggi dari Harga Publik.</p>
                  )}
                </div>
                {!isProducer && Number(price) > 0 && Number(publicPrice) > 0 && Number(publicPrice) < Number(price) && (
                  <p className="px-3 py-2 text-[11px] text-amber-600">
                    Harga Publik di bawah Harga Dasar (modal) — produk dijual rugi. Pastikan ini disengaja.
                  </p>
                )}
              </div>

              {/* Card Stok & Berat */}
              <div className="rounded-xl border border-border bg-card divide-y divide-border">
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium leading-none">Stok</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {productType === "variable" ? "Total semua variasi aktif — dihitung otomatis" : "Jumlah tersedia"}
                    </p>
                  </div>
                  {productType === "variable" ? (
                    // Produk bervariasi: stok utama DIABAIKAN, stok = jumlah stok variasi (docs/arsitektur-stok.md)
                    <span className="h-7 w-28 px-2 shrink-0 inline-flex items-center justify-end text-xs font-semibold">
                      {variationStockTotal}
                    </span>
                  ) : (
                    <Input
                      type="number" min="0" step="1"
                      value={stock}
                      onChange={(e) => setStock(e.target.value)}
                      placeholder="0"
                      className="h-7 text-xs w-28 px-2 shrink-0"
                    />
                  )}
                </div>
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium leading-none">Berat (gram)</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Untuk ongkir</p>
                  </div>
                  <Input
                    type="number" min="0" step="1"
                    value={weightGram}
                    onChange={(e) => setWeightGram(e.target.value)}
                    placeholder="500"
                    className="h-7 text-xs w-28 px-2 shrink-0"
                  />
                </div>
              </div>

              {/* Asal Pengiriman — pilih salah satu asal kirim milik pemilik produk (toko, atau produsen yang dipilih);
                  kosong = ikut asal utama pemilik. KHUSUS produk tenant (mitra atur kota asal sendiri di profil mitra).
                  Kelola daftar asal di Toko → Asal Kirim (admin) atau Portal Produsen → Profil. */}
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
                <p className="text-xs font-medium leading-none">Asal Pengiriman</p>
                {(() => {
                  const ownerId = producerId === "internal" ? null : producerId;
                  const mine = originOptions.filter((o) => o.producerId === ownerId);
                  const main = mine.find((o) => o.isDefault);
                  return (
                    <>
                      <p className="text-[10px] text-muted-foreground">
                        {isProducer && mine.length > 1
                          ? <>Pilih gudang tempat produk ini dikirim <span className="text-destructive">*</span>. Kelola gudang di menu Profil.</>
                          : <>Opsional — kosongkan untuk memakai asal utama{main ? ` (${main.label} — ${main.place})` : ownerId ? " produsen; bila produsen belum punya asal, memakai asal utama toko" : " toko"}.</>}
                      </p>
                      <Combobox
                        options={[...(isProducer && mine.length > 1 ? [] : [{ value: "", label: "Ikuti asal utama" }]), ...mine.map((o) => ({ value: o.id, label: `${o.label} — ${o.place}` }))]}
                        value={mine.some((o) => o.id === originId) ? originId : ""}
                        onValueChange={setOriginId}
                        placeholder={isProducer && mine.length > 1 ? "Pilih gudang" : "Ikuti asal utama"}
                        searchPlaceholder="Cari asal kirim..."
                        emptyText="Belum ada asal kirim."
                      />
                    </>
                  );
                })()}
              </div>

              {/* Gratis Ongkir — diskon proporsional-berat saat checkout, bukan hard Rp0. Produk mitra dikecualikan di checkout.
                  Admin & produsen (K39): ditanggung pemilik produk; produsen tidak membebani tenant. */}
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
                <p className="text-xs font-medium leading-none">Gratis Ongkir</p>
                <p className="text-[10px] text-muted-foreground">
                  {isProducer || producerId !== "internal"
                    ? "Ongkir produk ini ditanggung PRODUSEN (Anda), bukan tenant — semua daerah, atau daerah tertentu saja."
                    : "Ongkir produk ini ditanggung toko — semua daerah, atau daerah tertentu saja."}
                </p>
                {/* Produk milik produsen dikelola produsen sendiri — admin hanya melihat (docs/arsitektur-pencairan-produsen.md D14) */}
                {!isProducer && producerId !== "internal" ? (
                  <p className="rounded-lg bg-muted/50 p-2 text-[11px] text-muted-foreground">
                    {freeShippingMode === "none" ? "Tidak ada gratis ongkir." : freeShippingMode === "all" ? "Gratis ongkir ke seluruh Indonesia."
                      : `Gratis ongkir ke ${freeShippingProvinces.length} provinsi dan ${freeShippingCities.length} kabupaten/kota.`}
                    {" "}Diatur oleh produsen — tidak bisa diubah dari sini.
                  </p>
                ) : (
                  <FreeShippingPicker
                  mode={freeShippingMode}
                  provinces={freeShippingProvinces}
                  cities={freeShippingCities}
                  onChange={({ mode, provinces, cities }) => {
                    setFreeShippingMode(mode);
                    setFreeShippingProvinces(provinces);
                    setFreeShippingCities(cities);
                  }}
                />
                )}
              </div>

              {/* Lokasi Ambil Sendiri — override opsional dari default toko, KHUSUS produk
                  tenant sendiri (bukan mitra — mitra atur lokasi sendiri di profil mitra).
                  Kosongkan untuk pakai lokasi default toko. docs/arsitektur-billing.md § 14.5. */}
              {!isProducer && <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
                <p className="text-xs font-medium leading-none">Lokasi Ambil Sendiri</p>
                <p className="text-[10px] text-muted-foreground">
                  Opsional — kosongkan untuk pakai lokasi ambil sendiri default toko.
                </p>
                <Input
                  value={pickupLocationName}
                  onChange={(e) => setPickupLocationName(e.target.value)}
                  placeholder="Nama lokasi (mis. Gudang Sleman)"
                  className="h-8 text-xs"
                />
                <textarea
                  value={pickupAddress}
                  onChange={(e) => setPickupAddress(e.target.value)}
                  placeholder="Alamat lengkap"
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                />
                <Input
                  value={pickupMapsUrl}
                  onChange={(e) => setPickupMapsUrl(e.target.value)}
                  placeholder="Link Google Maps (opsional)"
                  className="h-8 text-xs"
                />
              </div>}
            </div>

            <Separator />

            {/* Tipe Produk — toggle simple/variable */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Tipe Produk</p>
              <div className="flex gap-2">
                {(["simple", "variable"] as const).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setProductType(type)}
                    className={`px-4 py-1.5 rounded-full border text-sm font-medium transition-colors ${
                      productType === type
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-primary"
                    }`}
                  >
                    {type === "simple" ? "Produk Simple" : "Produk Variasi"}
                  </button>
                ))}
              </div>
              {productType === "variable" && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  Stok produk = jumlah stok semua variasi aktif (stok utama tidak dipakai; variasi yang
                  stoknya kosong dianggap 0). Harga &amp; berat di atas dipakai sebagai bawaan untuk
                  variasi yang tidak diisi sendiri.
                </p>
              )}
            </div>

            {/* Atribut & Variasi — hanya untuk variable product */}
            {productType === "variable" && (
              <>
                <Separator />
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Atribut Produk</p>
                  <AttributeGroupEditor groups={attributeGroups} onChange={setAttributeGroups} />
                  {attributeGroups.length > 0 && attributeGroups.every(g => g.values.length > 0) && (productId || isProducer) && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (isProducer) { setVariations(buildVariationCombos(attributeGroups, variations)); return; }
                        const result = await generateVariationsAction(slug, productId!, attributeGroups, variations);
                        if (result.variations) setVariations(result.variations);
                      }}
                      className="text-xs text-primary hover:underline"
                    >
                      ⚡ Generate Variasi dari Atribut
                    </button>
                  )}
                </div>

                <Separator />
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Variasi ({variations.length})
                  </p>
                  <VariationTable
                    slug={slug}
                    variations={variations}
                    attributeGroups={attributeGroups}
                    onChange={setVariations}
                    productPrice={price}
                    productPublicPrice={publicPrice}
                    productMemberPrice={memberPrice}
                    productWeightGram={weightGram}
                    productSku={sku}
                    producer={producer ? { sharePercent: producer.sharePercent } : undefined}
                  />
                </div>
              </>
            )}

            <Separator />

            {/* Gambar produk — SELALU tampil, terlepas tipe produk. Ini kolom `images`
                top-level yang dipakai sebagai cover di arsip/kartu toko untuk KEDUA tipe
                produk (extractCover() di /produk/page.tsx baca products.images langsung,
                bukan gambar variasi) — sebelumnya disembunyikan untuk "variable" sehingga
                produk variasi baru tidak pernah punya cara mengisi cover-nya sama sekali. */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Gambar Produk {productType === "variable" && <span className="normal-case font-normal">(Sampul Utama)</span>}
              </p>
              <ProductImages slug={slug} images={images} onChange={setImages} member={isProducer} />
              {productType === "variable" && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  Ditampilkan sebagai foto sampul di arsip/kartu toko. Foto per varian (mis. per
                  warna) diatur terpisah di tabel Variasi di bawah.
                </p>
              )}
            </div>

            <Separator />

            {/* Kategori */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Kategori</p>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Tanpa kategori —</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Produsen — ADMIN-ONLY (docs/arsitektur-produsen.md). Tidak pernah tampil di halaman publik. */}
            {producerOptions && (
              <>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Produsen</p>
                  <Combobox
                    options={[{ value: "internal", label: `Internal — ${tenantName}` }, ...producerOptions]}
                    value={producerId}
                    onValueChange={(v) => setProducerId(v || "internal")}
                    placeholder="Pilih produsen"
                    searchPlaceholder="Cari produsen…"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Hanya terlihat admin. Kelola daftar di menu Toko → Produsen.
                  </p>
                </div>
                <Separator />
              </>
            )}

            {/* Status */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Status</p>
              {isProducer && status === "frozen" ? (
                // K30: dibekukan pengurus — produsen tidak bisa mengubah status, isi produk tetap boleh diperbaiki.
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  Produk ini dibekukan pengurus sehingga tidak tampil di toko. Anda tetap bisa memperbaiki isinya; hubungi pengurus untuk membukanya.
                </p>
              ) : (
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Aktif</SelectItem>
                  <SelectItem value="archived">Diarsipkan</SelectItem>
                  {!isProducer && (producerId !== "internal" || status === "frozen") && <SelectItem value="frozen">Dibekukan (oleh pengurus)</SelectItem>}
                </SelectContent>
              </Select>
              )}
            </div>
          </div>

          {/* Footer — tombol simpan. Flex sibling biasa (bukan sticky), selalu di bawah tanpa
              pernah menutupi konten yang discroll di atasnya — lihat komentar di wrapper sidebar. */}
          <div className="shrink-0 border-t border-border bg-background p-4 space-y-2">
            {error    && <p className="text-xs text-destructive">{error}</p>}
            {saveMsg  && <p className="text-xs text-green-600">{saveMsg}</p>}

            <Button
              className="w-full"
              onClick={handleSave}
              disabled={isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              {isPending ? "Menyimpan..." : saveLabel}
            </Button>

            {productId && (!isProducer || producer?.onDelete) && (
              <>
                {!isProducer && (
                  <Button
                    variant={toggleBtn.variant}
                    className="w-full"
                    onClick={handleToggleStatus}
                    disabled={isToggling}
                  >
                    <ToggleIcon className="h-4 w-4 mr-2" />
                    {isToggling ? "Memproses..." : toggleBtn.label}
                  </Button>
                )}

                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="w-full text-xs text-destructive hover:underline py-1 disabled:opacity-60"
                >
                  {isDeleting ? "Menghapus..." : "Hapus Produk"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
