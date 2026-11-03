"use client";

// Form produk untuk PRODUSEN (buat & ubah) — docs/arsitektur-produk-produsen.md § 12.
// Field terbatas (K27): nama, deskripsi, kategori, foto (Media Library ANGGOTA), harga jual, harga anggota, stok, berat.
// Harga dasar (modal) hanya TAMPILAN otomatis (K24); server menghitung sendiri. Foto dikirim sebagai id; URL di-resolve server.
import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, ImagePlus, X } from "lucide-react";
import { TiptapEditor } from "@/components/editor/tiptap-editor";
import { MemberMediaPicker, type MemberMediaItem } from "@/components/media/member-media-picker";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PRODUCER_PRODUCT_LIMITS, computeBaseCost } from "@/lib/producer-products";

export type ProducerProductFormImage = { id: string; url: string; thumb: string; alt: string };
export type ProducerProductFormInitial = {
  name: string; description: string; categoryId: string | null; images: ProducerProductFormImage[];
  publicPrice: string; memberPrice: string; stock: string; weightGram: string;
};
type SubmitResult = { success: true; productId?: string } | { success: false; error: string };

const rupiah = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n || 0);
const EMPTY: ProducerProductFormInitial = { name: "", description: "", categoryId: null, images: [], publicPrice: "", memberPrice: "", stock: "0", weightGram: "", };

export function ProducerProductForm({
  slug, categories, sharePercent, initial = EMPTY, submitLabel, onSubmit, backHref,
}: {
  slug: string;
  categories: { value: string; label: string }[];
  sharePercent: number;
  initial?: ProducerProductFormInitial;
  submitLabel: string;
  onSubmit: (input: unknown) => Promise<SubmitResult>;
  backHref: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [categoryId, setCategoryId] = useState(initial.categoryId ?? "");
  const [images, setImages] = useState(initial.images);
  const [publicPrice, setPublicPrice] = useState(initial.publicPrice);
  const [memberPrice, setMemberPrice] = useState(initial.memberPrice);
  const [stock, setStock] = useState(initial.stock);
  const [weightGram, setWeightGram] = useState(initial.weightGram);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const baseCost = useMemo(() => {
    const p = Number(publicPrice);
    return Number.isFinite(p) && p > 0 ? computeBaseCost(p, sharePercent) : null;
  }, [publicPrice, sharePercent]);
  const memberShare = useMemo(() => {
    const p = Number(memberPrice);
    return Number.isFinite(p) && p > 0 ? Math.round(p * sharePercent) / 100 : null;
  }, [memberPrice, sharePercent]);

  function addImage(item: MemberMediaItem) {
    if (images.some((i) => i.id === item.id)) return;
    if (images.length >= PRODUCER_PRODUCT_LIMITS.imagesMax) { toast.error(`Maksimal ${PRODUCER_PRODUCT_LIMITS.imagesMax} foto.`); return; }
    setImages([...images, { id: item.id, url: item.url, thumb: item.variants?.square ?? item.variants?.large ?? item.url, alt: "" }]);
  }
  function move(i: number, d: -1 | 1) {
    const j = i + d; if (j < 0 || j >= images.length) return;
    const next = [...images]; [next[i], next[j]] = [next[j], next[i]]; setImages(next);
  }

  function submit() {
    setError(null);
    start(async () => {
      const res = await onSubmit({
        name, description, categoryId: categoryId || null,
        images: images.map((i) => ({ mediaId: i.id, alt: i.alt })),
        publicPrice, memberPrice: memberPrice.trim() === "" ? null : memberPrice, stock, weightGram,
      });
      if (!res.success) { setError(res.error); return; }
      toast.success("Produk tersimpan.");
      router.push(backHref);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-lg border border-border bg-card p-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Nama produk <span className="text-destructive">*</span></label>
          <Input value={name} maxLength={PRODUCER_PRODUCT_LIMITS.nameMax} onChange={(e) => setName(e.target.value)} placeholder="Mis. Sajadah Gontor Premium" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Kategori</label>
          <Combobox options={categories} value={categoryId} onValueChange={setCategoryId} placeholder="Pilih kategori" searchPlaceholder="Cari kategori..." clearable />
        </div>
        <div>
          <p className="mb-1 text-sm font-medium">Deskripsi</p>
          <TiptapEditor slug={slug} basic content={description || null} onChange={setDescription} placeholder="Ceritakan produk Anda..." />
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Foto produk <span className="text-destructive">*</span></h2>
          <span className="text-xs text-muted-foreground">{images.length}/{PRODUCER_PRODUCT_LIMITS.imagesMax} · foto pertama = foto utama</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((img, i) => (
            <div key={img.id} className="space-y-1">
              <div className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
                <Image src={img.thumb} alt={img.alt || name || "Foto produk"} fill sizes="160px" className="object-cover" unoptimized />
                <button type="button" onClick={() => setImages(images.filter((x) => x.id !== img.id))}
                  className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-destructive shadow" aria-label="Hapus foto"><X className="h-3.5 w-3.5" /></button>
                {i === 0 && <span className="absolute bottom-1 left-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">Utama</span>}
              </div>
              <Input value={img.alt} maxLength={PRODUCER_PRODUCT_LIMITS.altMax} placeholder="Teks alternatif"
                onChange={(e) => setImages(images.map((x) => (x.id === img.id ? { ...x, alt: e.target.value } : x)))} className="h-8 text-xs" />
              <div className="flex gap-1">
                <Button type="button" variant="outline" size="icon" className="h-7 w-7" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Geser ke kiri"><ArrowLeft className="h-3 w-3" /></Button>
                <Button type="button" variant="outline" size="icon" className="h-7 w-7" disabled={i === images.length - 1} onClick={() => move(i, 1)} aria-label="Geser ke kanan"><ArrowRight className="h-3 w-3" /></Button>
              </div>
            </div>
          ))}
          {images.length < PRODUCER_PRODUCT_LIMITS.imagesMax && (
            <button type="button" onClick={() => setPickerOpen(true)}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:border-primary hover:text-primary">
              <ImagePlus className="h-5 w-5" />Pilih / unggah foto
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Foto diambil dari Media Library akun Anda — bisa dipakai ulang. Foto yang sedang dipakai produk tidak bisa dihapus dari Media Library.</p>
        <MemberMediaPicker slug={slug} open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={addImage} />
      </section>

      <section className="space-y-3 rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Harga & stok</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Harga jual (Rp) <span className="text-destructive">*</span></label>
            <Input inputMode="numeric" value={publicPrice} onChange={(e) => setPublicPrice(e.target.value.replace(/[^0-9]/g, ""))} placeholder="100000" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Harga anggota (Rp)</label>
            <Input inputMode="numeric" value={memberPrice} onChange={(e) => setMemberPrice(e.target.value.replace(/[^0-9]/g, ""))} placeholder="Kosong = sama dengan harga jual" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Harga dasar (otomatis)</label>
            <Input value={baseCost === null ? "—" : rupiah(baseCost)} readOnly disabled />
            <p className="mt-1 text-xs text-muted-foreground">Terisi otomatis dari bagi hasil yang disepakati ({sharePercent}% untuk tenant). Tidak bisa diubah.</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Stok <span className="text-destructive">*</span></label>
            <Input inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value.replace(/[^0-9]/g, ""))} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Berat (gram) <span className="text-destructive">*</span></label>
            <Input inputMode="numeric" value={weightGram} onChange={(e) => setWeightGram(e.target.value.replace(/[^0-9]/g, ""))} placeholder="500" />
            <p className="mt-1 text-xs text-muted-foreground">Dipakai menghitung ongkos kirim.</p>
          </div>
        </div>
        {memberShare !== null && (
          <p className="text-xs text-muted-foreground">Contoh pada harga anggota: bagian tenant {rupiah(memberShare)}, bagian Anda {rupiah(Number(memberPrice) - memberShare)} (persentase tetap {sharePercent}%).</p>
        )}
      </section>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" disabled={pending} onClick={() => router.push(backHref)}>Batal</Button>
        <Button type="button" disabled={pending} onClick={submit}>{pending ? "Menyimpan..." : submitLabel}</Button>
      </div>
    </div>
  );
}
