"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  createDocumentCategoryAction,
  updateDocumentCategoryAction,
  deleteDocumentCategoryAction,
} from "@/app/(dashboard)/[tenant]/dokumen/actions";
import { Plus, Pencil, Trash2, Check, ChevronsUpDown, FolderOpen, Folder } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type CategoryRow = {
  id:       string;
  name:     string;
  slug:     string;
  parentId: string | null;
  sortOrder: number;
  docCount: number;
};

// ─── DokumenCategoryClient ────────────────────────────────────────────────────

export function DokumenCategoryClient({
  slug,
  categories,
}: {
  slug:       string;
  categories: CategoryRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Form tambah/edit
  const [editId,     setEditId]     = useState<string | null>(null);
  const [formName,   setFormName]   = useState("");
  const [formParent, setFormParent] = useState<string | null>(null);
  const [parentOpen, setParentOpen] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const roots    = categories.filter((c) => c.parentId === null);
  const children = (parentId: string) => categories.filter((c) => c.parentId === parentId);

  function startEdit(cat: CategoryRow) {
    setEditId(cat.id);
    setFormName(cat.name);
    setFormParent(cat.parentId);
    setError(null);
  }

  function cancelEdit() {
    setEditId(null);
    setFormName("");
    setFormParent(null);
    setError(null);
  }

  function handleSubmit() {
    setError(null);
    if (!formName.trim()) { setError("Nama wajib diisi."); return; }

    startTransition(async () => {
      const res = editId
        ? await updateDocumentCategoryAction(slug, editId, { name: formName, parentId: formParent })
        : await createDocumentCategoryAction(slug, { name: formName, parentId: formParent });

      if (!res.success) { setError(res.error); return; }
      cancelEdit();
      router.refresh();
    });
  }

  function handleDelete(cat: CategoryRow) {
    if (!confirm(`Hapus kategori "${cat.name}"?`)) return;
    startTransition(async () => {
      const res = await deleteDocumentCategoryAction(slug, cat.id);
      if (!res.success) { setError(res.error); return; }
      router.refresh();
    });
  }

  const parentLabel = formParent
    ? (categories.find((c) => c.id === formParent)?.name ?? "Pilih induk")
    : <span className="text-muted-foreground">Tanpa induk (kategori utama)</span>;

  // Render satu baris kategori
  function CategoryItem({ cat, depth = 0 }: { cat: CategoryRow; depth?: number }) {
    const isEditing = editId === cat.id;
    const subs      = children(cat.id);

    return (
      <>
        <div
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 border-b border-border last:border-0 hover:bg-muted/20 transition-colors",
            depth > 0 && "bg-muted/10"
          )}
          style={{ paddingLeft: `${16 + depth * 20}px` }}
        >
          {subs.length > 0
            ? <FolderOpen className="h-4 w-4 text-amber-500 shrink-0" />
            : <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
          }
          <span className="flex-1 text-sm font-medium">{cat.name}</span>
          <span className="text-xs text-muted-foreground">{cat.docCount} dok</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(cat)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => handleDelete(cat)}
            disabled={isPending}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        {isEditing && (
          <div className="px-4 py-3 bg-muted/20 border-b border-border space-y-2">
            <EditForm />
          </div>
        )}

        {subs.map((sub) => (
          <CategoryItem key={sub.id} cat={sub} depth={depth + 1} />
        ))}
      </>
    );
  }

  function EditForm() {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Nama Kategori</Label>
            <Input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Nama kategori"
              className="h-8 text-sm"
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Induk (opsional)</Label>
            <Popover open={parentOpen} onOpenChange={setParentOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full h-8 text-sm justify-between font-normal">
                  <span className="truncate">{parentLabel}</span>
                  <ChevronsUpDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-0">
                <Command>
                  <CommandInput placeholder="Cari kategori..." />
                  <CommandList>
                    <CommandEmpty>Tidak ditemukan</CommandEmpty>
                    <CommandGroup>
                      <CommandItem value="__none__" onSelect={() => { setFormParent(null); setParentOpen(false); }}>
                        <Check className={cn("mr-2 h-4 w-4", formParent === null ? "opacity-100" : "opacity-0")} />
                        Tanpa induk
                      </CommandItem>
                      {categories
                        .filter((c) => c.id !== editId && c.parentId === null)
                        .map((c) => (
                          <CommandItem
                            key={c.id}
                            value={c.name}
                            onSelect={() => { setFormParent(c.id); setParentOpen(false); }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", formParent === c.id ? "opacity-100" : "opacity-0")} />
                            {c.name}
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSubmit} disabled={isPending}>
            {editId ? "Simpan" : "Tambah"}
          </Button>
          <Button size="sm" variant="outline" onClick={cancelEdit}>
            Batal
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Form tambah baru */}
      {editId === null && (
        <div className="rounded-lg border border-border p-4 space-y-3 bg-muted/10">
          <p className="text-sm font-medium">Tambah Kategori Baru</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Nama Kategori</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Misal: SOP Sekretaris"
                className="h-8 text-sm"
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Induk (opsional)</Label>
              <Popover open={parentOpen} onOpenChange={setParentOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full h-8 text-sm justify-between font-normal">
                    <span className="truncate">{parentLabel}</span>
                    <ChevronsUpDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-0">
                  <Command>
                    <CommandInput placeholder="Cari kategori..." />
                    <CommandList>
                      <CommandEmpty>Tidak ditemukan</CommandEmpty>
                      <CommandGroup>
                        <CommandItem value="__none__" onSelect={() => { setFormParent(null); setParentOpen(false); }}>
                          <Check className={cn("mr-2 h-4 w-4", formParent === null ? "opacity-100" : "opacity-0")} />
                          Tanpa induk
                        </CommandItem>
                        {categories.filter((c) => c.parentId === null).map((c) => (
                          <CommandItem
                            key={c.id}
                            value={c.name}
                            onSelect={() => { setFormParent(c.id); setParentOpen(false); }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", formParent === c.id ? "opacity-100" : "opacity-0")} />
                            {c.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button size="sm" onClick={handleSubmit} disabled={isPending || !formName.trim()}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Tambah Kategori
          </Button>
        </div>
      )}

      {/* Daftar kategori */}
      {categories.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          Belum ada kategori. Tambahkan kategori pertama di atas.
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          {roots.map((cat) => (
            <CategoryItem key={cat.id} cat={cat} />
          ))}
        </div>
      )}
    </div>
  );
}
