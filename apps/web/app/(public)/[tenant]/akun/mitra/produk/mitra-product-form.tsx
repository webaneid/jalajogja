"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Label  } from "@/components/ui/label";
import { Input  } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GalleryPicker } from "@/components/gallery/gallery-picker";
import type { GalleryItem } from "@/lib/gallery";

type Props = {
  slug:     string;
  settings: { minKomisiMitra: number; mitraMaxProducts: number };
  product?: {
    id: string; name: string; slug: string; price: string;
    memberPrice: string | null; stock: number; weightGram: number | null;
    description: string | null; images: GalleryItem[];
  };
};

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function MitraProductForm({ slug, settings, product }: Props) {
  const router  = useRouter();
  const isEdit  = !!product;

  const [name,        setName]        = useState(product?.name        ?? "");
  const [prodSlug,    setProdSlug]    = useState(product?.slug        ?? "");
  const [price,       setPrice]       = useState(product?.price       ? Number(product.price)       : 0);
  const [memberPrice, setMemberPrice] = useState(product?.memberPrice ? Number(product.memberPrice) : null as number | null);
  const [stock,       setStock]       = useState(product?.stock       ?? 0);
  const [weightGram,  setWeightGram]  = useState(product?.weightGram  ?? null as number | null);
  const [description, setDescription] = useState(product?.description ?? "");
  const [images,      setImages]      = useState<GalleryItem[]>(product?.images ?? []);
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const komisiNominal    = price > 0 ? Math.round(price * settings.minKomisiMitra / 100) : 0;
  const memberPriceMax   = price > 0 ? price - komisiNominal : 0;
  const memberPriceValid = memberPrice == null || memberPrice <= memberPriceMax;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!memberPriceValid) { setError(`Harga IKPM tidak boleh lebih dari Rp ${memberPriceMax.toLocaleString("id-ID")}`); return; }
    setSubmitting(true);
    setError(null);

    // Convert GalleryItem[] to ProductImage[]
    const productImages = images.map((img, i) => ({
      id: img.id, url: img.url, variants: img.variants, alt: img.alt ?? "", order: i,
    }));

    if (!weightGram || weightGram <= 0) { setError("Berat produk wajib diisi (min. 1 gram)"); setSubmitting(false); return; }
    const body = { slug: prodSlug || slugify(name), name, price, memberPrice, stock, weightGram, description, images: productImages };
    const url  = isEdit
      ? `/api/mitra/products/${product!.id}?slug=${slug}`
      : `/api/mitra/products?slug=${slug}`;
    const method = isEdit ? "PATCH" : "POST";

    const res  = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json() as { error?: string };
    setSubmitting(false);
    if (data.error) { setError(data.error); return; }
    router.push(`/${slug}/akun/mitra/produk`);
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
      <a href={`/${slug}/akun/mitra/produk`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Kembali ke Produk
      </a>

      <h1 className="text-xl font-semibold">{isEdit ? "Edit Produk" : "Tambah Produk Baru"}</h1>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Foto produk */}
        <div className="space-y-1.5">
          <Label className="text-sm">Foto Produk</Label>
          <GalleryPicker slug={slug} items={images} onChange={setImages} module="shop"
            max={settings.mitraMaxProducts > 0 ? 5 : undefined} />
        </div>

        {/* Nama */}
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-sm">Nama Produk <span className="text-destructive">*</span></Label>
          <Input id="name" value={name} onChange={e => { setName(e.target.value); if (!isEdit) setProdSlug(slugify(e.target.value)); }}
            placeholder="Nama produk" required className="h-9" />
        </div>

        {/* Harga */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="price" className="text-sm">Harga Umum <span className="text-destructive">*</span></Label>
            <Input id="price" type="number" min={0} value={price}
              onChange={e => setPrice(Number(e.target.value))} placeholder="0" required className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="member-price" className="text-sm">
              Harga IKPM
              <span className="text-muted-foreground font-normal text-xs ml-1">(opsional)</span>
            </Label>
            <Input id="member-price" type="number" min={0} max={memberPriceMax || undefined}
              value={memberPrice ?? ""}
              onChange={e => setMemberPrice(e.target.value ? Number(e.target.value) : null)}
              placeholder={`Maks ${memberPriceMax.toLocaleString("id-ID")}`}
              className={`h-9 ${!memberPriceValid ? "border-destructive" : ""}`} />
          </div>
        </div>

        {/* Info komisi */}
        {price > 0 && (
          <div className="rounded-lg bg-muted/50 border border-border p-3 text-xs text-muted-foreground space-y-0.5">
            <p>Komisi IKPM ({settings.minKomisiMitra}%): <span className="font-medium text-foreground">Rp {komisiNominal.toLocaleString("id-ID")}</span></p>
            <p>Harga IKPM maksimum: <span className="font-medium text-foreground">Rp {memberPriceMax.toLocaleString("id-ID")}</span></p>
          </div>
        )}

        {/* Stok & Berat */}
        <div className="flex gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="stock" className="text-sm">Stok <span className="text-destructive">*</span></Label>
            <Input id="stock" type="number" min={0} value={stock}
              onChange={e => setStock(Number(e.target.value))} required className="h-9 w-28" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="weight" className="text-sm">
              Berat (gram) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="weight" type="number" min={1}
              value={weightGram ?? ""}
              onChange={e => setWeightGram(e.target.value ? Number(e.target.value) : null)}
              placeholder="mis. 500"
              className="h-9 w-28"
            />
            <p className="text-xs text-muted-foreground">Berat satuan produk</p>
          </div>
        </div>

        {/* Deskripsi */}
        <div className="space-y-1.5">
          <Label htmlFor="desc" className="text-sm">Deskripsi <span className="text-muted-foreground font-normal text-xs">(opsional)</span></Label>
          <textarea id="desc" rows={4} value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Deskripsi produk..." className="w-full rounded-md border border-input bg-background px-3 py-2
            text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Tambah Produk"}
        </Button>
      </form>
    </div>
  );
}
