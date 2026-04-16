"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { TiptapEditor } from "@/components/editor/tiptap-editor";
import { SeoPanel } from "@/components/seo/seo-panel";
import { MediaPicker, type MediaItem } from "@/components/media/media-picker";
import {
  updatePostAction,
  createPostAction,
  createCategoryAction,
  createTagAction,
} from "@/app/(dashboard)/[tenant]/website/actions";
import type { PostFormData } from "@/app/(dashboard)/[tenant]/website/actions";
import type { SeoValues } from "@/components/seo/seo-panel";
import type { ContentStatus } from "@jalajogja/db";
import { generateSlug } from "@/lib/seo";
import {
  Globe, Save, Eye, EyeOff, ImagePlus, X, RefreshCw, Archive,
  ChevronsUpDown, Check, Plus,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type Category = { id: string; name: string; slug: string };
type Tag      = { id: string; name: string; slug: string };

export type PostFormProps = {
  slug: string;
  postId: string | null; // null = create mode (belum tersimpan di DB)
  initialData: {
    title:       string;
    postSlug:    string;
    excerpt:     string;
    content:     string | null;
    status:      ContentStatus;
    categoryId:  string | null;
    tagIds:      string[];
    coverId:     string | null;
    seo: SeoValues;
  };
  categories: Category[];
  tags:       Tag[];
};

// ── StatusBadge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ContentStatus }) {
  const map: Record<ContentStatus, { label: string; variant: "default" | "secondary" | "outline" }> = {
    published: { label: "Terbit",   variant: "default" },
    draft:     { label: "Draft",    variant: "secondary" },
    archived:  { label: "Arsip",    variant: "outline" },
  };
  const { label, variant } = map[status] ?? { label: status, variant: "outline" };
  return <Badge variant={variant}>{label}</Badge>;
}

function SidebarLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
      {children}
    </p>
  );
}

// ── CategoryCombobox ──────────────────────────────────────────────────────────

function CategoryCombobox({
  slug,
  allCategories,
  value,
  onChange,
}: {
  slug: string;
  allCategories: Category[];
  value: string;        // "" = tanpa kategori
  onChange: (id: string) => void;
}) {
  const [open, setOpen]           = useState(false);
  const [localCats, setLocalCats] = useState<Category[]>(allCategories);
  const [adding, setAdding]       = useState(false);
  const [newName, setNewName]     = useState("");
  const [createError, setCreateError] = useState("");
  const [isCreating, startCreate] = useTransition();

  const selected = localCats.find((c) => c.id === value);

  function closeAdding() {
    setAdding(false);
    setNewName("");
    setCreateError("");
  }

  function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    setCreateError("");
    startCreate(async () => {
      const res = await createCategoryAction(slug, { name });
      if (!res.success) { setCreateError(res.error); return; }
      const newCat: Category = {
        id:   res.data.categoryId,
        name,
        slug: generateSlug(name),
      };
      setLocalCats((prev) => [...prev, newCat]);
      onChange(res.data.categoryId);
      closeAdding();
      setOpen(false);
    });
  }

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) closeAdding();
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-8 text-sm font-normal"
        >
          {selected
            ? selected.name
            : <span className="text-muted-foreground">Pilih kategori...</span>
          }
          <ChevronsUpDown className="ml-auto h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <CommandInput placeholder="Cari kategori..." className="h-8 text-sm" />
          <CommandList>
            <CommandEmpty className="py-3 text-xs text-center">
              Tidak ditemukan.
            </CommandEmpty>
            <CommandGroup>
              {/* Opsi "tanpa kategori" */}
              <CommandItem
                value="__none__"
                onSelect={() => { onChange(""); setOpen(false); }}
              >
                <span className="text-muted-foreground italic text-xs">Tanpa kategori</span>
                {!value && <Check className="ml-auto h-3.5 w-3.5" />}
              </CommandItem>

              {localCats.map((cat) => (
                <CommandItem
                  key={cat.id}
                  value={cat.name}
                  onSelect={() => {
                    onChange(value === cat.id ? "" : cat.id);
                    setOpen(false);
                  }}
                >
                  {cat.name}
                  {cat.id === value && <Check className="ml-auto h-3.5 w-3.5" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>

          {/* Inline form tambah kategori */}
          <div className="border-t p-1">
            {adding ? (
              <div className="space-y-1.5 p-1">
                <Input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); handleCreate(); }
                    if (e.key === "Escape") closeAdding();
                  }}
                  placeholder="Nama kategori baru..."
                  className="h-7 text-xs"
                  disabled={isCreating}
                />
                {createError && (
                  <p className="text-xs text-destructive px-1">{createError}</p>
                )}
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    className="h-6 text-xs flex-1"
                    onClick={handleCreate}
                    disabled={isCreating || !newName.trim()}
                  >
                    {isCreating ? "Membuat..." : "Buat"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs"
                    onClick={closeAdding}
                    disabled={isCreating}
                  >
                    Batal
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="flex w-full items-center gap-1.5 rounded-sm px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Tambah kategori baru
              </button>
            )}
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ── TagInput ──────────────────────────────────────────────────────────────────
// Autocomplete + comma-separated creation.
// Ketik nama tag → pilih dari dropdown, atau ketik lalu tekan koma/Enter untuk buat baru.

function TagInput({
  slug,
  allTags,
  selectedTagIds,
  onChange,
}: {
  slug: string;
  allTags: Tag[];
  selectedTagIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [inputValue, setInputValue]   = useState("");
  const [open, setOpen]               = useState(false);
  const [localTags, setLocalTags]     = useState<Tag[]>(allTags);
  const [isCreating, startCreate]     = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedTags = selectedTagIds
    .map((id) => localTags.find((t) => t.id === id))
    .filter((t): t is Tag => !!t);

  const searchTerm  = inputValue.trim();
  const available   = localTags.filter((t) => !selectedTagIds.includes(t.id));
  const filtered    = searchTerm
    ? available.filter((t) => t.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : available;
  const exactMatch  = localTags.find((t) => t.name.toLowerCase() === searchTerm.toLowerCase());
  const canCreate   = searchTerm.length > 0 && !exactMatch;
  const showDropdown = open && (filtered.length > 0 || canCreate);

  function selectExisting(tag: Tag) {
    if (!selectedTagIds.includes(tag.id)) {
      onChange([...selectedTagIds, tag.id]);
    }
    setInputValue("");
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function removeTag(id: string) {
    onChange(selectedTagIds.filter((tid) => tid !== id));
  }

  function processInput(raw: string) {
    const name = raw.replace(/,+$/, "").trim();
    if (!name) { setInputValue(""); return; }

    // Cek apakah tag sudah ada (case-insensitive)
    const existing = localTags.find(
      (t) => t.name.toLowerCase() === name.toLowerCase()
    );
    if (existing) {
      selectExisting(existing);
      return;
    }

    // Buat tag baru via server action
    startCreate(async () => {
      const res = await createTagAction(slug, { name });
      if (!res.success) return; // error diam-diam; bisa tambah toast nanti
      const newTag: Tag = { id: res.data.tagId, name, slug: generateSlug(name) };
      setLocalTags((prev) => [...prev, newTag]);
      onChange([...selectedTagIds, newTag.id]);
      setInputValue("");
      setTimeout(() => inputRef.current?.focus(), 0);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === ",") {
      e.preventDefault();
      processInput(inputValue);
    } else if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault();
      processInput(inputValue);
    } else if (e.key === "Backspace" && !inputValue && selectedTagIds.length > 0) {
      // Hapus tag terakhir dengan backspace
      onChange(selectedTagIds.slice(0, -1));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="space-y-2">
      {/* Pills tag yang sudah dipilih */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-0.5 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs text-primary"
            >
              {tag.name}
              <button
                type="button"
                onClick={() => removeTag(tag.id)}
                className="ml-0.5 hover:opacity-70 transition-opacity"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input dengan dropdown autocomplete */}
      <Popover open={showDropdown} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setOpen(true);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder={
              selectedTagIds.length === 0
                ? "Ketik tag, pisah koma..."
                : "Tambah tag..."
            }
            className="h-8 text-sm"
            disabled={isCreating}
          />
        </PopoverAnchor>

        <PopoverContent
          className="w-52 p-0"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <Command>
            <CommandList>
              {/* Tag yang sudah ada */}
              {filtered.length > 0 && (
                <CommandGroup>
                  {filtered.slice(0, 8).map((tag) => (
                    <CommandItem
                      key={tag.id}
                      value={tag.name}
                      onSelect={() => selectExisting(tag)}
                    >
                      {tag.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {/* Opsi buat tag baru */}
              {canCreate && (
                <>
                  {filtered.length > 0 && <CommandSeparator />}
                  <CommandGroup>
                    <CommandItem onSelect={() => processInput(inputValue)}>
                      <Plus className="h-3.5 w-3.5" />
                      Buat &ldquo;{searchTerm}&rdquo;
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <p className="text-xs text-muted-foreground">
        Pisah koma atau tekan Enter untuk tambah/buat tag baru
      </p>
    </div>
  );
}

// ── PostForm ──────────────────────────────────────────────────────────────────

export function PostForm({
  slug,
  postId,
  initialData,
  categories,
  tags,
}: PostFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Form state
  const [title, setTitle]           = useState(initialData.title);
  const [postSlug, setPostSlug]     = useState(initialData.postSlug);
  const [excerpt, setExcerpt]       = useState(initialData.excerpt);
  const [content, setContent]       = useState<string | null>(initialData.content);
  const [categoryId, setCategoryId] = useState<string>(initialData.categoryId ?? "");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(initialData.tagIds);
  const [status, setStatus]         = useState<ContentStatus>(initialData.status);
  const [seoValues, setSeoValues]   = useState<SeoValues>(initialData.seo);

  // Featured image
  const [coverId, setCoverId]       = useState<string | null>(initialData.coverId);
  const [coverUrl, setCoverUrl]     = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Slug auto-generate
  const [slugEdited, setSlugEdited] = useState(false);

  function handleTitleChange(val: string) {
    setTitle(val);
    if (!slugEdited) setPostSlug(generateSlug(val));
  }

  function handleSlugChange(val: string) {
    setSlugEdited(true);
    setPostSlug(val);
  }

  function handleCoverSelect(media: MediaItem) {
    setCoverId(media.id);
    setCoverUrl(media.url);
    setPickerOpen(false);
  }

  function handleCoverRemove() {
    setCoverId(null);
    setCoverUrl(null);
  }

  function buildPayload(overrideStatus?: ContentStatus): PostFormData {
    return {
      title,
      slug:       postSlug,
      excerpt,
      content,
      coverId:    coverId ?? null,
      categoryId: categoryId || null,
      tagIds:     selectedTagIds,
      status:     overrideStatus ?? status,
      metaTitle:      seoValues.metaTitle,
      metaDesc:       seoValues.metaDesc,
      ogTitle:        seoValues.ogTitle,
      ogDescription:  seoValues.ogDescription,
      ogImageId:      seoValues.ogImageId,
      twitterCard:    seoValues.twitterCard as "summary" | "summary_large_image" | undefined,
      focusKeyword:   seoValues.focusKeyword,
      canonicalUrl:   seoValues.canonicalUrl,
      robots:         seoValues.robots as "index,follow" | "noindex" | "noindex,nofollow" | undefined,
      schemaType:     seoValues.schemaType as "Article" | "NewsArticle" | "BlogPosting" | undefined,
      structuredData: seoValues.structuredData,
    };
  }

  function handleSave() {
    startTransition(async () => {
      if (postId === null) {
        // Create mode — record belum ada di DB
        const res = await createPostAction(slug, buildPayload());
        if (!res.success) { alert(res.error); return; }
        router.push(`/${slug}/website/posts/${res.data.postId}/edit`);
      } else {
        const res = await updatePostAction(slug, postId, buildPayload());
        if (!res.success) { alert(res.error); return; }
        router.refresh();
      }
    });
  }

  function handleChangeStatus(target: ContentStatus) {
    startTransition(async () => {
      if (postId === null) {
        const res = await createPostAction(slug, buildPayload(target));
        if (!res.success) { alert(res.error); return; }
        router.push(`/${slug}/website/posts/${res.data.postId}/edit`);
      } else {
        const res = await updatePostAction(slug, postId, buildPayload(target));
        if (!res.success) { alert(res.error); return; }
        setStatus(target);
        router.refresh();
      }
    });
  }

  const saveLabel =
    isPending               ? "Menyimpan..." :
    status === "draft"      ? "Simpan Draft" :
    status === "published"  ? "Simpan Perubahan" :
    "Arsipkan";

  const saveIcon =
    status === "archived" ? <Archive className="h-4 w-4" /> : <Save className="h-4 w-4" />;

  const actionConfig: { label: string; target: ContentStatus; variant: "default" | "outline" } =
    status === "published"
      ? { label: "Jadikan Draft", target: "draft",     variant: "outline" }
      : { label: "Publikasikan",  target: "published", variant: "default" };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-background sticky top-0 z-10">
        <button
          onClick={() => router.push(`/${slug}/website/posts`)}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Posts
        </button>
        <StatusBadge status={status} />
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Konten utama ──────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          <Input
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Judul post..."
            className="text-2xl font-bold border-0 border-b rounded-none px-0 focus-visible:ring-0 h-auto py-2"
          />

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Globe className="h-3.5 w-3.5 shrink-0" />
            <span className="shrink-0">/{slug}/</span>
            <Input
              value={postSlug}
              onChange={(e) => handleSlugChange(e.target.value)}
              className="h-7 text-sm font-mono border-0 border-b rounded-none px-0 focus-visible:ring-0"
              placeholder="slug-url"
            />
          </div>

          <Textarea
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            placeholder="Ringkasan singkat (opsional)..."
            className="resize-none text-sm min-h-[60px]"
            rows={2}
          />

          <TiptapEditor
            slug={slug}
            content={content}
            onChange={(json) => setContent(json)}
            placeholder="Mulai menulis artikel..."
          />

          <SeoPanel
            slug={slug}
            values={seoValues}
            onChange={setSeoValues}
            contentType="post"
            title={title}
          />
        </div>

        {/* ── Sidebar kanan ──────────────────────────────────────────── */}
        <div className="w-72 shrink-0 border-l border-border overflow-y-auto flex flex-col">
          <div className="flex-1 p-4 space-y-5">

            {/* Status */}
            <div className="space-y-2">
              <SidebarLabel>Status</SidebarLabel>
              <Select
                value={status}
                onValueChange={(val) => setStatus(val as ContentStatus)}
              >
                <SelectTrigger className="w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Terbit</SelectItem>
                  <SelectItem value="archived">Arsip</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Featured Image */}
            <div className="space-y-2">
              <SidebarLabel>Featured Image</SidebarLabel>
              {coverId && coverUrl ? (
                <div className="space-y-2">
                  <div className="relative w-full aspect-video rounded-md overflow-hidden border border-border bg-muted">
                    <Image
                      src={coverUrl}
                      alt="Featured image"
                      fill
                      className="object-cover"
                      sizes="288px"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1.5 text-xs"
                      onClick={() => setPickerOpen(true)}
                    >
                      <RefreshCw className="h-3 w-3" />
                      Ganti
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs text-destructive hover:text-destructive"
                      onClick={handleCoverRemove}
                    >
                      <X className="h-3 w-3" />
                      Hapus
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className={[
                    "w-full aspect-video rounded-md border-2 border-dashed border-border",
                    "flex flex-col items-center justify-center gap-2",
                    "text-muted-foreground hover:text-foreground hover:border-foreground/30",
                    "transition-colors cursor-pointer",
                  ].join(" ")}
                >
                  <ImagePlus className="h-6 w-6" />
                  <span className="text-xs">Pilih Gambar Featured</span>
                </button>
              )}
            </div>

            <Separator />

            {/* Kategori */}
            <div className="space-y-2">
              <SidebarLabel>Kategori</SidebarLabel>
              <CategoryCombobox
                slug={slug}
                allCategories={categories}
                value={categoryId}
                onChange={setCategoryId}
              />
            </div>

            <Separator />

            {/* Tags */}
            <div className="space-y-2">
              <SidebarLabel>Tag</SidebarLabel>
              <TagInput
                slug={slug}
                allTags={tags}
                selectedTagIds={selectedTagIds}
                onChange={setSelectedTagIds}
              />
            </div>

          </div>

          {/* Tombol aksi — sticky bottom */}
          <div className="p-4 border-t border-border space-y-2 bg-background">
            <Button
              className="w-full gap-1.5"
              onClick={handleSave}
              disabled={isPending}
              variant="outline"
            >
              {saveIcon}
              {saveLabel}
            </Button>
            <Button
              className="w-full gap-1.5"
              onClick={() => handleChangeStatus(actionConfig.target)}
              disabled={isPending}
              variant={actionConfig.variant}
            >
              {actionConfig.target === "published"
                ? <><Globe className="h-4 w-4" /> {actionConfig.label}</>
                : <><EyeOff className="h-4 w-4" /> {actionConfig.label}</>
              }
            </Button>
          </div>
        </div>
      </div>

      {/* MediaPicker */}
      <MediaPicker
        slug={slug}
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleCoverSelect}
        module="website"
        accept={["image/"]}
      />
    </div>
  );
}
