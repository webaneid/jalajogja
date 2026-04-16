"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2, Check, X } from "lucide-react";
import {
  createCampaignCategoryAction,
  updateCampaignCategoryAction,
  deleteCampaignCategoryAction,
} from "@/app/(dashboard)/[tenant]/donasi/actions";

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
  id:            string;
  name:          string;
  slug:          string;
  campaignCount: number;
};

type Props = {
  slug:               string;
  initialCategories:  Category[];
};

export function CampaignCategoryManageClient({ slug, initialCategories }: Props) {
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [showForm,   setShowForm]   = useState(false);
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [name,       setName]       = useState("");
  const [editName,   setEditName]   = useState("");
  const [error,      setError]      = useState("");
  const [editError,  setEditError]  = useState("");
  const [pending,    startTransition] = useTransition();

  // ── Create ─────────────────────────────────────────────────────────────────

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Nama kategori wajib diisi."); return; }
    setError("");

    startTransition(async () => {
      const trimmedName = name.trim();
      const res = await createCampaignCategoryAction(slug, {
        name: trimmedName,
        slug: toSlug(trimmedName),
      });

      if (res.success) {
        setCategories((prev) => [
          ...prev,
          { id: res.data.categoryId, name: trimmedName, slug: toSlug(trimmedName), campaignCount: 0 },
        ]);
        setName("");
        setShowForm(false);
      } else {
        setError(res.error);
      }
    });
  }

  // ── Edit ───────────────────────────────────────────────────────────────────

  function startEdit(cat: Category) {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditError("");
  }

  function handleUpdate(e: React.FormEvent, catId: string) {
    e.preventDefault();
    if (!editName.trim()) { setEditError("Nama wajib diisi."); return; }
    setEditError("");

    startTransition(async () => {
      const trimmedName = editName.trim();
      const res = await updateCampaignCategoryAction(slug, catId, {
        name: trimmedName,
        slug: toSlug(trimmedName),
      });

      if (res.success) {
        setCategories((prev) =>
          prev.map((c) =>
            c.id === catId ? { ...c, name: trimmedName, slug: toSlug(trimmedName) } : c
          )
        );
        setEditingId(null);
      } else {
        setEditError(res.error);
      }
    });
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  function handleDelete(cat: Category) {
    if (cat.campaignCount > 0) {
      alert(`Kategori "${cat.name}" masih digunakan oleh ${cat.campaignCount} campaign dan tidak bisa dihapus.`);
      return;
    }
    if (!confirm(`Hapus kategori "${cat.name}"?`)) return;

    startTransition(async () => {
      const res = await deleteCampaignCategoryAction(slug, cat.id);
      if (res.success) {
        setCategories((prev) => prev.filter((c) => c.id !== cat.id));
      } else {
        alert(res.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Tombol tambah */}
      {!showForm && (
        <button
          type="button"
          onClick={() => { setShowForm(true); setError(""); }}
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
            <label className="text-xs text-muted-foreground">
              Nama <span className="text-destructive">*</span>
            </label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="mis. Sosial, Kesehatan, Pendidikan"
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
          Belum ada kategori. Tambahkan kategori seperti Sosial, Kesehatan, Pendidikan, dll.
        </div>
      ) : (
        <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
          {categories.map((cat) => (
            <div key={cat.id} className="hover:bg-muted/20">
              {editingId === cat.id ? (
                <form
                  onSubmit={(e) => handleUpdate(e, cat.id)}
                  className="flex items-center gap-2 px-4 py-2"
                >
                  <input
                    autoFocus
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 rounded border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  {editError && <p className="text-xs text-destructive">{editError}</p>}
                  <button
                    type="submit"
                    disabled={pending}
                    className="p-1 rounded text-primary hover:bg-primary/10 disabled:opacity-50"
                    title="Simpan"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="p-1 rounded hover:bg-muted/40"
                    title="Batal"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </form>
              ) : (
                <div className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{cat.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{cat.slug}</p>
                  </div>
                  <div className="flex items-center gap-3 ml-4 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {cat.campaignCount} campaign
                    </span>
                    <button
                      type="button"
                      onClick={() => startEdit(cat)}
                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/40"
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(cat)}
                      disabled={pending}
                      className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-50"
                      title="Hapus"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
