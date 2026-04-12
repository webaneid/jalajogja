"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import {
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
} from "@/app/(dashboard)/[tenant]/website/actions";
import { generateSlug } from "@/lib/seo";
import type { CategoryItem } from "./category-manager";

// ── AddForm ───────────────────────────────────────────────────────────────────

function AddForm({
  slug,
  parents,
}: {
  slug: string;
  parents: CategoryItem[];   // hanya root categories sebagai pilihan parent
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName]       = useState("");
  const [parentId, setParentId] = useState("none");
  const [error, setError]     = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Nama wajib diisi."); return; }
    setError("");
    startTransition(async () => {
      const res = await createCategoryAction(slug, {
        name: name.trim(),
        parentId: parentId === "none" ? null : parentId,
      });
      if (!res.success) { setError(res.error); return; }
      setName("");
      setParentId("none");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-start flex-wrap">
      <div className="flex-1 min-w-48">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nama kategori baru..."
          className="h-9"
          disabled={isPending}
        />
        {error && <p className="text-xs text-destructive mt-1">{error}</p>}
      </div>

      <Select value={parentId} onValueChange={setParentId} disabled={isPending}>
        <SelectTrigger className="h-9 w-48">
          <SelectValue placeholder="Parent (opsional)" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Tanpa parent</SelectItem>
          {parents.map((cat) => (
            <SelectItem key={cat.id} value={cat.id}>
              {cat.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button type="submit" size="sm" className="h-9 gap-1.5" disabled={isPending}>
        <Plus className="h-4 w-4" />
        {isPending ? "Menambah..." : "Tambah"}
      </Button>
    </form>
  );
}

// ── EditRow ───────────────────────────────────────────────────────────────────

function EditRow({
  cat,
  slug,
  parents,
  onDone,
}: {
  cat: CategoryItem;
  slug: string;
  parents: CategoryItem[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName]       = useState(cat.name);
  const [catSlug, setCatSlug] = useState(cat.slug);
  const [parentId, setParentId] = useState(cat.parentId ?? "none");
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError]     = useState("");

  function handleNameChange(val: string) {
    setName(val);
    if (!slugEdited) setCatSlug(generateSlug(val));
  }

  function handleSave() {
    if (!name.trim()) { setError("Nama wajib diisi."); return; }
    setError("");
    startTransition(async () => {
      const res = await updateCategoryAction(slug, cat.id, {
        name: name.trim(),
        slug: catSlug,
        parentId: parentId === "none" ? null : parentId,
      });
      if (!res.success) { setError(res.error); return; }
      router.refresh();
      onDone();
    });
  }

  return (
    <tr className="border-b border-border bg-muted/20">
      <td className="px-4 py-2" colSpan={3}>
        <div className="flex gap-2 items-start flex-wrap">
          <div className="space-y-1 flex-1 min-w-40">
            <Input
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Nama kategori"
              className="h-8 text-sm"
              disabled={isPending}
            />
            <Input
              value={catSlug}
              onChange={(e) => { setSlugEdited(true); setCatSlug(e.target.value); }}
              placeholder="slug"
              className="h-7 text-xs font-mono"
              disabled={isPending}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <Select value={parentId} onValueChange={setParentId} disabled={isPending}>
            <SelectTrigger className="h-8 text-sm w-40">
              <SelectValue placeholder="Tanpa parent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Tanpa parent</SelectItem>
              {parents
                .filter((p) => p.id !== cat.id)   // tidak bisa jadi parent dirinya sendiri
                .map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </td>
      <td className="px-4 py-2 text-right">
        <div className="flex gap-1 justify-end">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleSave} disabled={isPending}>
            <Check className="h-4 w-4 text-primary" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDone} disabled={isPending}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ── CategoryTable ─────────────────────────────────────────────────────────────

export function CategoryTable({
  slug,
  categories,
}: {
  slug: string;
  categories: CategoryItem[];
}) {
  const router = useRouter();
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [deleteError, setDeleteError] = useState("");

  // Hanya root categories boleh jadi parent
  const rootCategories = categories.filter((c) => c.parentId === null);

  // Urutkan: root dulu, lalu children di bawah parent-nya
  const sorted: CategoryItem[] = [];
  for (const root of rootCategories) {
    sorted.push(root);
    const children = categories.filter((c) => c.parentId === root.id);
    sorted.push(...children);
  }

  function handleDelete() {
    if (!deletingId) return;
    setDeleteError("");
    startTransition(async () => {
      const res = await deleteCategoryAction(slug, deletingId);
      if (!res.success) {
        setDeleteError(res.error);
        return;
      }
      setDeletingId(null);
      router.refresh();
    });
  }

  const deletingCat = categories.find((c) => c.id === deletingId);

  return (
    <div className="space-y-4">
      <AddForm slug={slug} parents={rootCategories} />

      {categories.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Belum ada kategori. Tambahkan kategori pertama di atas.
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left font-medium">Nama</th>
                <th className="px-4 py-3 text-left font-medium w-36 hidden sm:table-cell">Parent</th>
                <th className="px-4 py-3 text-left font-medium w-20">Posts</th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((cat) => {
                const isChild = cat.parentId !== null;
                const parentName = isChild
                  ? categories.find((c) => c.id === cat.parentId)?.name
                  : null;

                if (editingId === cat.id) {
                  return (
                    <EditRow
                      key={cat.id}
                      cat={cat}
                      slug={slug}
                      parents={rootCategories}
                      onDone={() => setEditingId(null)}
                    />
                  );
                }

                return (
                  <tr
                    key={cat.id}
                    className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className={isChild ? "pl-5 text-muted-foreground" : "font-medium"}>
                        {isChild && <span className="mr-1 text-muted-foreground/50">└</span>}
                        {cat.name}
                      </span>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5 pl-0">
                        {isChild && <span className="pl-5" />}{cat.slug}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs hidden sm:table-cell">
                      {parentName ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {cat.postCount}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setEditingId(cat.id)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => { setDeleteError(""); setDeletingId(cat.id); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingId} onOpenChange={(o) => { if (!o) { setDeletingId(null); setDeleteError(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus kategori?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deletingCat?.name}&rdquo; akan dihapus permanen.
              {deletingCat && deletingCat.postCount > 0 && (
                <span className="block mt-1 text-destructive font-medium">
                  {deletingCat.postCount} post menggunakan kategori ini.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p className="text-sm text-destructive px-1">{deleteError}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
