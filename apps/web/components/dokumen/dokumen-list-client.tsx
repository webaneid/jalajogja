"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { deleteDocumentAction } from "@/app/(dashboard)/[tenant]/dokumen/actions";
import {
  Plus, Search, FileText, FileDown, Eye, Pencil, Trash2,
  ChevronsUpDown, Check, Globe, Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type CategoryOption = { id: string; name: string; parentId: string | null };

type DocumentRow = {
  id:              string;
  title:           string;
  description:     string | null;
  visibility:      "internal" | "public";
  categoryId:      string | null;
  categoryName:    string | null;
  currentFileName: string | null;
  currentMimeType: string | null;
  currentFileSize: number | null;
  versionNumber:   number | null;
  updatedAt:       Date;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(new Date(d));
}

function mimeLabel(mime: string | null) {
  if (!mime) return "—";
  if (mime.includes("pdf")) return "PDF";
  if (mime.includes("word") || mime.includes("openxmlformats")) return "DOCX";
  return mime.split("/")[1]?.toUpperCase() ?? "—";
}

// ─── CreateDocumentButton ─────────────────────────────────────────────────────

export function CreateDocumentButton({ slug }: { slug: string }) {
  return (
    <Link href={`/${slug}/dokumen/new`}>
      <Button size="sm">
        <Plus className="h-4 w-4 mr-1" />
        Tambah Dokumen
      </Button>
    </Link>
  );
}

// ─── DokumenListClient ────────────────────────────────────────────────────────

export function DokumenListClient({
  slug,
  documents,
  categories,
}: {
  slug:       string;
  documents:  DocumentRow[];
  categories: CategoryOption[];
}) {
  const router = useRouter();
  const [search,     setSearch]     = useState("");
  const [catFilter,  setCatFilter]  = useState<string | null>(null);
  const [visFilter,  setVisFilter]  = useState<"" | "internal" | "public">("");
  const [catOpen,    setCatOpen]    = useState(false);
  const [isPending,  startTransition] = useTransition();

  const filtered = documents.filter((d) => {
    const matchSearch = d.title.toLowerCase().includes(search.toLowerCase());
    const matchCat    = catFilter ? d.categoryId === catFilter : true;
    const matchVis    = visFilter ? d.visibility === visFilter : true;
    return matchSearch && matchCat && matchVis;
  });

  function handleDelete(docId: string, title: string) {
    if (!confirm(`Hapus dokumen "${title}"? Semua versi akan ikut terhapus.`)) return;
    startTransition(async () => {
      await deleteDocumentAction(slug, docId);
      router.refresh();
    });
  }

  const selectedCatName = catFilter
    ? categories.find((c) => c.id === catFilter)?.name ?? "Kategori"
    : "Semua Kategori";

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari judul dokumen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>

        {/* Filter kategori */}
        <Popover open={catOpen} onOpenChange={setCatOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              {selectedCatName}
              <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-0">
            <Command>
              <CommandInput placeholder="Cari kategori..." />
              <CommandList>
                <CommandEmpty>Tidak ditemukan</CommandEmpty>
                <CommandGroup>
                  <CommandItem value="__all__" onSelect={() => { setCatFilter(null); setCatOpen(false); }}>
                    <Check className={cn("mr-2 h-4 w-4", catFilter === null ? "opacity-100" : "opacity-0")} />
                    Semua Kategori
                  </CommandItem>
                  {categories.map((c) => (
                    <CommandItem
                      key={c.id}
                      value={c.name}
                      onSelect={() => { setCatFilter(c.id); setCatOpen(false); }}
                    >
                      <Check className={cn("mr-2 h-4 w-4", catFilter === c.id ? "opacity-100" : "opacity-0")} />
                      {c.parentId && <span className="mr-1 text-muted-foreground">↳</span>}
                      {c.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Filter visibilitas */}
        <div className="flex gap-1">
          {(["", "internal", "public"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVisFilter(v)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
                visFilter === v
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {v === "" ? "Semua" : v === "internal" ? "Internal" : "Publik"}
            </button>
          ))}
        </div>

        <CreateDocumentButton slug={slug} />
      </div>

      {/* Tabel */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
          {documents.length === 0 ? "Belum ada dokumen. Tambahkan dokumen pertama." : "Tidak ada dokumen yang sesuai filter."}
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Judul</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Kategori</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">Format</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">Ukuran</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Diperbarui</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((doc) => (
                <tr key={doc.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="font-medium truncate max-w-xs">{doc.title}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {doc.visibility === "public" ? (
                            <Badge variant="outline" className="text-xs gap-1 py-0">
                              <Globe className="h-2.5 w-2.5" /> Publik
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs gap-1 py-0">
                              <Lock className="h-2.5 w-2.5" /> Internal
                            </Badge>
                          )}
                          {doc.versionNumber && doc.versionNumber > 1 && (
                            <span className="text-xs text-muted-foreground">v{doc.versionNumber}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {doc.categoryName ?? <span className="italic">—</span>}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                      {mimeLabel(doc.currentMimeType)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">
                    {formatBytes(doc.currentFileSize)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell">
                    {formatDate(doc.updatedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/${slug}/dokumen/${doc.id}`}>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                      {doc.currentMimeType?.includes("pdf") && (
                        <a
                          href={`/api/documents/${doc.id}/file?slug=${slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <FileDown className="h-3.5 w-3.5" />
                          </Button>
                        </a>
                      )}
                      <Link href={`/${slug}/dokumen/${doc.id}/edit`}>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(doc.id, doc.title)}
                        disabled={isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
