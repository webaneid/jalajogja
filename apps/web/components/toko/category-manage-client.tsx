"use client";

import { useState, useTransition } from "react";
import { Plus, X, Check } from "lucide-react";
import { createProductCategoryAction } from "@/app/(dashboard)/[tenant]/toko/actions";

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

type Category = {
  id:           string;
  name:         string;
  slug:         string;
  productCount: number;
};

type Props = {
  slug:               string;
  initialCategories:  Category[];
};

export function CategoryManageClient({ slug, initialCategories }: Props) {
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [showForm,   setShowForm]   = useState(false);
  const [name,       setName]       = useState("");
  const [error,      setError]      = useState("");
  const [pending, startTransition]  = useTransition();

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Nama kategori wajib diisi."); return; }
    setError("");

    startTransition(async () => {
      const trimmedName = name.trim();
      const res = await createProductCategoryAction(slug, {
        name: trimmedName,
        slug: toSlug(trimmedName),
      });

      if (res.success) {
        setCategories((prev) => [
          ...prev,
          {
            id:           res.data.categoryId,
            name:         trimmedName,
            slug:         toSlug(trimmedName),
            productCount: 0,
          },
        ]);
        setName("");
        setShowForm(false);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Tombol tambah */}
      {!showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Tambah Kategori
        </button>
      )}

      {/* Form tambah */}
      {showForm && (
        <form
          onSubmit={handleAdd}
          className="rounded-lg border border-border bg-muted/10 p-4 space-y-3"
        >
          <p className="text-sm font-medium">Kategori Baru</p>

          <div>
            <label className="text-xs text-muted-foreground">Nama <span className="text-destructive">*</span></label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="mis. Pakaian, Aksesoris"
              className="w-full mt-0.5 rounded border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

{error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              <Check className="h-3.5 w-3.5" />
              {pending ? "Menyimpan..." : "Simpan"}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setName(""); setError(""); }}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted/40"
            >
              <X className="h-3.5 w-3.5" />
              Batal
            </button>
          </div>
        </form>
      )}

      {/* Daftar kategori */}
      {categories.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          Belum ada kategori
        </div>
      ) : (
        <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
          {categories.map((cat) => (
            <div key={cat.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/20">
              <div>
                <p className="text-sm font-medium">{cat.name}</p>
                <p className="text-xs text-muted-foreground font-mono">{cat.slug}</p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0 ml-4">
                {cat.productCount} produk
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
