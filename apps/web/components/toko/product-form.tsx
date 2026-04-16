"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
import {
  createProductAction,
  updateProductAction,
  toggleProductStatusAction,
  deleteProductAction,
  type ProductData,
  type ProductImage,
  slugify,
} from "@/app/(dashboard)/[tenant]/toko/actions";
import type { SeoValues } from "@/components/seo/seo-panel";
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
  productId: string | null; // null = create mode
  initialData: {
    name:        string;
    productSlug: string;
    sku:         string;
    description: string;
    price:       number;
    stock:       number;
    images:      ProductImage[];
    categoryId:  string | null;
    status:      "draft" | "active" | "archived";
    seo:         SeoValues;
  };
  categories: Category[];
};

// ─── StatusBadge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
    active:   { label: "Aktif",       variant: "default"   },
    draft:    { label: "Draft",       variant: "secondary" },
    archived: { label: "Diarsipkan",  variant: "outline"   },
  };
  const { label, variant } = map[status] ?? { label: status, variant: "outline" };
  return <Badge variant={variant}>{label}</Badge>;
}

// ─── ProductImages — grid dengan MediaPicker + tombol naik/turun ──────────────

function ProductImages({
  slug,
  images,
  onChange,
}: {
  slug:     string;
  images:   ProductImage[];
  onChange: (imgs: ProductImage[]) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  function handleSelect(media: MediaItem) {
    // Cek duplikasi
    if (images.some((img) => img.id === media.id)) return;
    const newImg: ProductImage = {
      id:    media.id,
      url:   media.url,
      alt:   media.altText ?? media.originalName,
      order: images.length,
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
                src={img.url}
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

      <MediaPicker
        slug={slug}
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleSelect}
        module="shop"
        accept={["image/"]}
      />
    </div>
  );
}

// ─── ProductForm (komponen utama) ─────────────────────────────────────────────

export function ProductForm({
  slug,
  productId,
  initialData,
  categories,
}: ProductFormProps) {
  const router = useRouter();

  // Form state
  const [name,        setName]        = useState(initialData.name);
  const [productSlug, setProductSlug] = useState(initialData.productSlug);
  const [sku,         setSku]         = useState(initialData.sku);
  const [description, setDescription] = useState(initialData.description);
  const [price,       setPrice]       = useState(String(initialData.price));
  const [stock,       setStock]       = useState(String(initialData.stock));
  const [images,      setImages]      = useState<ProductImage[]>(initialData.images);
  const [categoryId,  setCategoryId]  = useState(initialData.categoryId ?? "none");
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

  function handleSave() {
    setError("");
    setSaveMsg("");

    const priceNum = parseFloat(price) || 0;
    const stockNum = parseInt(stock) || 0;

    const data: ProductData = {
      name:        name.trim(),
      slug:        productSlug.trim(),
      sku:         sku.trim() || null,
      description: description || null,
      price:       priceNum,
      stock:       stockNum,
      images:      images.map((img, i) => ({ ...img, order: i })),
      categoryId:  categoryId === "none" ? null : categoryId,
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
          router.push(`/${slug}/toko/produk/${res.data.productId}/edit`);
        } else {
          setError(res.error);
        }
      } else {
        const res = await updateProductAction(slug, productId, data);
        if (res.success) {
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
        setStatus(res.data.newStatus as "draft" | "active" | "archived");
      } else {
        setError(res.error);
      }
    });
  }

  function handleDelete() {
    if (!productId) return;
    if (!confirm("Hapus produk ini? Tindakan tidak bisa dibatalkan.")) return;
    startDelete(async () => {
      const res = await deleteProductAction(slug, productId);
      if (res.success) {
        router.push(`/${slug}/toko/produk`);
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
  }[status] ?? { label: "Ubah Status", icon: Save, variant: "outline" as const };
  const ToggleIcon = toggleBtn.icon;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-6 py-3">
        <button
          type="button"
          onClick={() => router.push(`/${slug}/toko/produk`)}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Produk
        </button>
        <StatusBadge status={status} />
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Main area ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
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
              content={description}
              onChange={setDescription}
              placeholder="Tulis deskripsi produk di sini..."
            />
          </div>

          <Separator />

          {/* SEO Panel */}
          <SeoPanel
            slug={slug}
            contentType="product"
            values={seo}
            onChange={setSeo}
            title={name}
            content={description}
          />
        </div>

        {/* ── Sidebar ── */}
        <div className="w-72 shrink-0 border-l border-border bg-muted/10 overflow-y-auto flex flex-col">
          <div className="flex-1 space-y-5 p-4">

            {/* Harga & Stok */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Harga & Stok</p>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Harga (Rp)</label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Stok</label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Gambar produk */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Gambar Produk</p>
              <ProductImages slug={slug} images={images} onChange={setImages} />
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

            {/* Status */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Status</p>
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Aktif</SelectItem>
                  <SelectItem value="archived">Diarsipkan</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Sticky footer — tombol simpan */}
          <div className="sticky bottom-0 border-t border-border bg-background p-4 space-y-2">
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

            {productId && (
              <>
                <Button
                  variant={toggleBtn.variant}
                  className="w-full"
                  onClick={handleToggleStatus}
                  disabled={isToggling}
                >
                  <ToggleIcon className="h-4 w-4 mr-2" />
                  {isToggling ? "Memproses..." : toggleBtn.label}
                </Button>

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
