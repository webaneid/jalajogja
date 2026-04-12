"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { Plus, Pencil, Check, X, Trash2 } from "lucide-react";
import {
  createTagAction,
  updateTagAction,
  deleteTagAction,
} from "@/app/(dashboard)/[tenant]/website/actions";
import { generateSlug } from "@/lib/seo";
import type { TagItem } from "./category-manager";

// ── AddForm ───────────────────────────────────────────────────────────────────

function AddForm({ slug }: { slug: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Nama wajib diisi."); return; }
    setError("");
    startTransition(async () => {
      const res = await createTagAction(slug, { name: name.trim() });
      if (!res.success) { setError(res.error); return; }
      setName("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-start flex-wrap">
      <div className="flex-1 min-w-48">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nama tag baru..."
          className="h-9"
          disabled={isPending}
        />
        {error && <p className="text-xs text-destructive mt-1">{error}</p>}
      </div>
      <Button type="submit" size="sm" className="h-9 gap-1.5" disabled={isPending}>
        <Plus className="h-4 w-4" />
        {isPending ? "Menambah..." : "Tambah"}
      </Button>
    </form>
  );
}

// ── EditRow ───────────────────────────────────────────────────────────────────

function EditRow({
  tag,
  slug,
  onDone,
}: {
  tag: TagItem;
  slug: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName]       = useState(tag.name);
  const [tagSlug, setTagSlug] = useState(tag.slug);
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError]     = useState("");

  function handleNameChange(val: string) {
    setName(val);
    if (!slugEdited) setTagSlug(generateSlug(val));
  }

  function handleSave() {
    if (!name.trim()) { setError("Nama wajib diisi."); return; }
    setError("");
    startTransition(async () => {
      const res = await updateTagAction(slug, tag.id, {
        name: name.trim(),
        slug: tagSlug,
      });
      if (!res.success) { setError(res.error); return; }
      router.refresh();
      onDone();
    });
  }

  return (
    <tr className="border-b border-border bg-muted/20">
      <td className="px-4 py-2" colSpan={2}>
        <div className="space-y-1">
          <Input
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Nama tag"
            className="h-8 text-sm"
            disabled={isPending}
          />
          <Input
            value={tagSlug}
            onChange={(e) => { setSlugEdited(true); setTagSlug(e.target.value); }}
            placeholder="slug"
            className="h-7 text-xs font-mono"
            disabled={isPending}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
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

// ── TagTable ──────────────────────────────────────────────────────────────────

export function TagTable({
  slug,
  tags,
}: {
  slug: string;
  tags: TagItem[];
}) {
  const router = useRouter();
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [deleteError, setDeleteError] = useState("");

  function handleDelete() {
    if (!deletingId) return;
    setDeleteError("");
    startTransition(async () => {
      const res = await deleteTagAction(slug, deletingId);
      if (!res.success) {
        setDeleteError(res.error);
        return;
      }
      setDeletingId(null);
      router.refresh();
    });
  }

  const deletingTag = tags.find((t) => t.id === deletingId);

  return (
    <div className="space-y-4">
      <AddForm slug={slug} />

      {tags.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Belum ada tag. Tambahkan tag pertama di atas.
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left font-medium">Nama</th>
                <th className="px-4 py-3 text-left font-medium w-20">Posts</th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody>
              {tags.map((tag) => {
                if (editingId === tag.id) {
                  return (
                    <EditRow
                      key={tag.id}
                      tag={tag}
                      slug={slug}
                      onDone={() => setEditingId(null)}
                    />
                  );
                }

                return (
                  <tr
                    key={tag.id}
                    className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium">{tag.name}</span>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">
                        {tag.slug}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {tag.postCount}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setEditingId(tag.id)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => { setDeleteError(""); setDeletingId(tag.id); }}
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
            <AlertDialogTitle>Hapus tag?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deletingTag?.name}&rdquo; akan dihapus permanen.
              {deletingTag && deletingTag.postCount > 0 && (
                <span className="block mt-1 text-amber-600 font-medium">
                  {deletingTag.postCount} post menggunakan tag ini — relasi akan ikut terhapus.
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
