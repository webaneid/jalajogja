"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2, Check, X } from "lucide-react";
import {
  createEventCategoryAction,
  updateEventCategoryAction,
  deleteEventCategoryAction,
} from "@/app/(dashboard)/app/[tenant]/event/actions";

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
  id:         string;
  name:       string;
  slug:       string;
  eventCount: number;
  metaTitle?: string | null;
  metaDesc?:  string | null;
};

type Props = {
  slug:              string;
  initialCategories: Category[];
};

export function EventCategoryManageClient({ slug, initialCategories }: Props) {
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [showForm,   setShowForm]   = useState(false);
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [name,       setName]       = useState("");
  const [editName,   setEditName]   = useState("");
  // SEO ringan (Fase 2, docs/arsitektur-seo.md § 3.2)
  const [metaTitle,     setMetaTitle]     = useState("");
  const [metaDesc,      setMetaDesc]      = useState("");
  const [editMetaTitle, setEditMetaTitle] = useState("");
  const [editMetaDesc,  setEditMetaDesc]  = useState("");
  const [error,      setError]      = useState("");
  const [editError,  setEditError]  = useState("");
  const [pending,    startTransition] = useTransition();

  // ── Create ─────────────────────────────────────────────────────────────────

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Nama kategori wajib diisi."); return; }
    setError("");

    startTransition(async () => {
      const res = await createEventCategoryAction(slug, {
        name: name.trim(), slug: toSlug(name),
        metaTitle: metaTitle.trim() || null, metaDesc: metaDesc.trim() || null,
      });
      if (res.success) {
        setCategories((prev) => [
          ...prev,
          { id: res.data.categoryId, name: name.trim(), slug: toSlug(name), eventCount: 0, metaTitle, metaDesc },
        ]);
        setName(""); setMetaTitle(""); setMetaDesc("");
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
    setEditMetaTitle(cat.metaTitle ?? "");
    setEditMetaDesc(cat.metaDesc ?? "");
    setEditError("");
  }

  function handleUpdate(e: React.FormEvent, cat: Category) {
    e.preventDefault();
    if (!editName.trim()) { setEditError("Nama wajib diisi."); return; }
    setEditError("");

    startTransition(async () => {
      const res = await updateEventCategoryAction(slug, cat.id, {
        name: editName.trim(),
        slug: toSlug(editName),
        metaTitle: editMetaTitle.trim() || null,
        metaDesc:  editMetaDesc.trim()  || null,
      });
      if (res.success) {
        setCategories((prev) =>
          prev.map((c) =>
            c.id === cat.id
              ? { ...c, name: editName.trim(), slug: toSlug(editName), metaTitle: editMetaTitle, metaDesc: editMetaDesc }
              : c
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
    if (cat.eventCount > 0) {
      alert(`Kategori "${cat.name}" masih digunakan oleh ${cat.eventCount} event.`);
      return;
    }
    if (!confirm(`Hapus kategori "${cat.name}"?`)) return;

    startTransition(async () => {
      const res = await deleteEventCategoryAction(slug, cat.id);
      if (res.success) {
        setCategories((prev) => prev.filter((c) => c.id !== cat.id));
      } else {
        alert(res.error);
      }
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* List */}
      <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
        {categories.length === 0 && (
          <p className="px-4 py-8 text-sm text-center text-muted-foreground">
            Belum ada kategori.
          </p>
        )}

        {categories.map((cat) => (
          <div key={cat.id} className="flex items-center gap-3 px-4 py-3">
            {editingId === cat.id ? (
              <form
                onSubmit={(e) => handleUpdate(e, cat)}
                className="flex-1 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 h-8 rounded-md border border-border bg-background px-3 text-sm"
                  />
                  {editError && <span className="text-xs text-destructive">{editError}</span>}
                  <button type="submit" disabled={pending} className="text-primary hover:opacity-70">
                    <Check className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={editMetaTitle}
                    onChange={(e) => setEditMetaTitle(e.target.value)}
                    placeholder="SEO — Meta Title (opsional)"
                    className="h-8 rounded-md border border-border bg-background px-3 text-xs"
                  />
                  <input
                    value={editMetaDesc}
                    onChange={(e) => setEditMetaDesc(e.target.value)}
                    placeholder="SEO — Meta Description (opsional)"
                    className="h-8 rounded-md border border-border bg-background px-3 text-xs"
                  />
                </div>
              </form>
            ) : (
              <>
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-sm">{cat.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground font-mono">{cat.slug}</span>
                </div>
                <span className="text-xs text-muted-foreground">{cat.eventCount} event</span>
                <button
                  onClick={() => startEdit(cat)}
                  className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(cat)}
                  disabled={pending}
                  className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Add form */}
      {showForm ? (
        <form onSubmit={handleAdd} className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              autoFocus
              placeholder="Nama kategori baru..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 h-9 rounded-md border border-border bg-background px-3 text-sm"
            />
            {error && <span className="text-xs text-destructive">{error}</span>}
            <button
              type="submit"
              disabled={pending}
              className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              Simpan
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setName(""); setMetaTitle(""); setMetaDesc(""); setError(""); }}
              className="h-9 px-3 rounded-md border border-border text-sm text-muted-foreground hover:text-foreground"
            >
              Batal
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={metaTitle}
              onChange={(e) => setMetaTitle(e.target.value)}
              placeholder="SEO — Meta Title (opsional)"
              className="h-8 rounded-md border border-border bg-background px-3 text-xs"
            />
            <input
              value={metaDesc}
              onChange={(e) => setMetaDesc(e.target.value)}
              placeholder="SEO — Meta Description (opsional)"
              className="h-8 rounded-md border border-border bg-background px-3 text-xs"
            />
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <Plus className="h-4 w-4" />
          Tambah Kategori
        </button>
      )}
    </div>
  );
}
