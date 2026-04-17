"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MediaPicker, type MediaItem } from "@/components/media/media-picker";
import {
  createDocumentAction,
  updateDocumentAction,
  type DocumentData,
} from "@/app/(dashboard)/[tenant]/dokumen/actions";
import {
  ChevronLeft, ChevronsUpDown, Check, FileText, X, Globe, Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type CategoryOption = { id: string; name: string; parentId: string | null };

export type DokumenFormProps = {
  slug:      string;
  documentId: string | null;
  categories: CategoryOption[];
  initialData: {
    title:        string;
    description:  string;
    categoryId:   string | null;
    visibility:   "internal" | "public";
    tags:         string[];
    // File versi aktif (hanya untuk edit)
    currentFileName?: string | null;
    currentMimeType?: string | null;
  };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function TagInput({
  tags,
  onChange,
}: {
  tags:     string[];
  onChange: (tags: string[]) => void;
}) {
  const [input, setInput] = useState("");

  function addTag(raw: string) {
    const trimmed = raw.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "," || e.key === "Enter") {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && !input) {
      onChange(tags.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5 rounded-md border border-input bg-background p-2 min-h-9">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground text-xs px-2 py-0.5 rounded-md"
        >
          {tag}
          <button type="button" onClick={() => onChange(tags.filter((t) => t !== tag))}>
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => input.trim() && addTag(input)}
        placeholder={tags.length === 0 ? "Ketik tag lalu tekan Enter atau koma..." : ""}
        className="flex-1 min-w-20 text-xs bg-transparent outline-none"
      />
    </div>
  );
}

// ─── DokumenForm ──────────────────────────────────────────────────────────────

export function DokumenForm({ slug, documentId, categories, initialData }: DokumenFormProps) {
  const router = useRouter();

  const [title,       setTitle]       = useState(initialData.title);
  const [description, setDescription] = useState(initialData.description);
  const [categoryId,  setCategoryId]  = useState<string | null>(initialData.categoryId);
  const [visibility,  setVisibility]  = useState<"internal" | "public">(initialData.visibility);
  const [tags,        setTags]        = useState<string[]>(initialData.tags);

  // File (hanya untuk create, atau upload versi baru di halaman detail)
  const [selectedFile, setSelectedFile] = useState<MediaItem | null>(null);
  const [versionNotes, setVersionNotes] = useState("");
  const [pickerOpen,   setPickerOpen]   = useState(false);

  const [catOpen, setCatOpen] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isEdit = documentId !== null;

  function handleFileSelect(media: MediaItem) {
    setSelectedFile(media);
    setPickerOpen(false);
  }

  function handleSave() {
    setError(null);
    if (!title.trim()) { setError("Judul wajib diisi."); return; }
    if (!isEdit && !selectedFile) { setError("File wajib diunggah."); return; }

    startTransition(async () => {
      if (isEdit) {
        const res = await updateDocumentAction(slug, documentId, {
          title, description: description || null, categoryId, visibility, tags,
        });
        if (!res.success) { setError(res.error); return; }
        router.push(`/${slug}/dokumen/${documentId}`);
      } else {
        const data: DocumentData = {
          title,
          description:  description || null,
          categoryId,
          visibility,
          tags,
          fileId:       selectedFile!.id,
          fileName:     selectedFile!.originalName ?? selectedFile!.filename,
          fileSize:     selectedFile!.size ?? null,
          mimeType:     selectedFile!.mimeType ?? null,
          versionNotes: versionNotes || null,
        };
        const res = await createDocumentAction(slug, data);
        if (!res.success) { setError(res.error); return; }
        router.push(`/${slug}/dokumen/${res.data.documentId}`);
      }
    });
  }

  const selectedCatName = categoryId
    ? categories.find((c) => c.id === categoryId)?.name
    : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background sticky top-0 z-10">
        <Link
          href={isEdit ? `/${slug}/dokumen/${documentId}` : `/${slug}/dokumen/semua`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          {isEdit ? "Detail" : "Dokumen"}
        </Link>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isPending}
          >
            {isPending ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Simpan Dokumen"}
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Judul */}
          <div className="space-y-1.5">
            <Label htmlFor="title">Judul Dokumen <span className="text-destructive">*</span></Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Misal: SOP Pengelolaan Keuangan 2025"
              className="text-base h-11"
            />
          </div>

          {/* Deskripsi */}
          <div className="space-y-1.5">
            <Label htmlFor="description">Deskripsi <span className="text-muted-foreground font-normal">(opsional)</span></Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ringkasan singkat isi dokumen..."
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>

          {/* Upload file — hanya saat create */}
          {!isEdit && (
            <div className="space-y-2">
              <Label>
                File Dokumen <span className="text-destructive">*</span>
                <span className="ml-1 text-muted-foreground font-normal text-xs">(PDF, DOCX, DOC)</span>
              </Label>

              {selectedFile ? (
                <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-3">
                  <FileText className="h-8 w-8 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {selectedFile.originalName ?? selectedFile.filename}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedFile.mimeType ?? "—"}
                      {selectedFile.size && ` · ${(selectedFile.size / 1024).toFixed(1)} KB`}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
                    Ganti
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedFile(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="w-full rounded-lg border-2 border-dashed border-border p-6 flex flex-col items-center gap-2 hover:border-primary/50 transition-colors text-muted-foreground"
                >
                  <FileText className="h-8 w-8 opacity-40" />
                  <span className="text-sm">Klik untuk pilih file dari Media Library</span>
                </button>
              )}

              <div className="space-y-1">
                <Label htmlFor="versionNotes" className="text-xs text-muted-foreground">
                  Catatan versi <span className="font-normal">(opsional)</span>
                </Label>
                <Input
                  id="versionNotes"
                  value={versionNotes}
                  onChange={(e) => setVersionNotes(e.target.value)}
                  placeholder="Misal: Revisi struktur BAB III"
                  className="h-8 text-sm"
                />
              </div>
            </div>
          )}

          {/* Edit — tampilkan info file aktif saja */}
          {isEdit && initialData.currentFileName && (
            <div className="rounded-lg border border-border bg-muted/20 p-3 flex items-center gap-3">
              <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{initialData.currentFileName}</p>
                <p className="text-xs text-muted-foreground">
                  Untuk upload versi baru, gunakan tombol di halaman detail dokumen.
                </p>
              </div>
            </div>
          )}

          <MediaPicker
            slug={slug}
            open={pickerOpen}
            onClose={() => setPickerOpen(false)}
            onSelect={handleFileSelect}
            accept={["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]}
          />
        </div>

        {/* Sidebar */}
        <aside className="w-64 shrink-0 border-l border-border overflow-y-auto p-4 space-y-5 bg-muted/10">
          {/* Visibilitas */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Visibilitas</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setVisibility("internal")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 rounded-md border py-2 text-xs font-medium transition-colors",
                  visibility === "internal"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:border-primary/50"
                )}
              >
                <Lock className="h-3.5 w-3.5" /> Internal
              </button>
              <button
                type="button"
                onClick={() => setVisibility("public")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 rounded-md border py-2 text-xs font-medium transition-colors",
                  visibility === "public"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:border-primary/50"
                )}
              >
                <Globe className="h-3.5 w-3.5" /> Publik
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {visibility === "internal"
                ? "Hanya user yang login ke tenant ini yang bisa mengakses."
                : "Siapapun bisa mengakses via URL publik tanpa login."}
            </p>
          </div>

          <Separator />

          {/* Kategori */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Kategori</Label>
            <Popover open={catOpen} onOpenChange={setCatOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal text-sm">
                  {selectedCatName ?? <span className="text-muted-foreground">Tanpa kategori</span>}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[220px] p-0">
                <Command>
                  <CommandInput placeholder="Cari kategori..." />
                  <CommandList>
                    <CommandEmpty>Tidak ditemukan</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="__none__"
                        onSelect={() => { setCategoryId(null); setCatOpen(false); }}
                      >
                        <Check className={cn("mr-2 h-4 w-4", categoryId === null ? "opacity-100" : "opacity-0")} />
                        <span className="text-muted-foreground">Tanpa kategori</span>
                      </CommandItem>
                      {categories.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={c.name}
                          onSelect={() => { setCategoryId(c.id); setCatOpen(false); }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", categoryId === c.id ? "opacity-100" : "opacity-0")} />
                          {c.parentId && <span className="mr-1 text-muted-foreground text-xs">↳</span>}
                          {c.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <Separator />

          {/* Tags */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Tags <span className="text-muted-foreground font-normal">(opsional)</span>
            </Label>
            <TagInput tags={tags} onChange={setTags} />
            <p className="text-xs text-muted-foreground">Tekan Enter atau koma untuk menambah tag.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
