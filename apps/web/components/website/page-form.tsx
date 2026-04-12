"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TiptapEditor } from "@/components/editor/tiptap-editor";
import { SeoPanel } from "@/components/seo/seo-panel";
import { MediaPicker, type MediaItem } from "@/components/media/media-picker";
import { updatePageAction } from "@/app/(dashboard)/[tenant]/website/actions";
import type { PageFormData } from "@/app/(dashboard)/[tenant]/website/actions";
import type { SeoValues } from "@/components/seo/seo-panel";
import type { ContentStatus } from "@jalajogja/db";
import { generateSlug } from "@/lib/seo";
import { Globe, Save, Eye, EyeOff, ImagePlus, X, RefreshCw, Archive } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PageFormProps = {
  slug: string;
  pageId: string;
  initialData: {
    title:    string;
    pageSlug: string;
    content:  string | null;
    status:   ContentStatus;
    order:    number;
    coverId:  string | null;
    seo: SeoValues;
  };
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ContentStatus }) {
  const map: Record<ContentStatus, { label: string; variant: "default" | "secondary" | "outline" }> = {
    published: { label: "Terbit",  variant: "default" },
    draft:     { label: "Draft",   variant: "secondary" },
    archived:  { label: "Arsip",   variant: "outline" },
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

// ── PageForm ──────────────────────────────────────────────────────────────────

export function PageForm({ slug, pageId, initialData }: PageFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Form state
  const [title, setTitle]       = useState(initialData.title);
  const [pageSlug, setPageSlug] = useState(initialData.pageSlug);
  const [content, setContent]   = useState<string | null>(initialData.content);
  const [status, setStatus]     = useState<ContentStatus>(initialData.status);
  const [order, setOrder]       = useState(initialData.order);
  const [seoValues, setSeoValues] = useState<SeoValues>(initialData.seo);

  // Featured image
  const [coverId, setCoverId]   = useState<string | null>(initialData.coverId);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Slug auto-generate
  const [slugEdited, setSlugEdited] = useState(false);

  function handleTitleChange(val: string) {
    setTitle(val);
    if (!slugEdited) setPageSlug(generateSlug(val));
  }

  function handleSlugChange(val: string) {
    setSlugEdited(true);
    setPageSlug(val);
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

  function buildPayload(overrideStatus?: ContentStatus): PageFormData {
    return {
      title,
      slug:     pageSlug,
      content,
      coverId:  coverId ?? null,
      order,
      status:   overrideStatus ?? status,
      metaTitle:      seoValues.metaTitle,
      metaDesc:       seoValues.metaDesc,
      ogTitle:        seoValues.ogTitle,
      ogDescription:  seoValues.ogDescription,
      ogImageId:      seoValues.ogImageId,
      twitterCard:    seoValues.twitterCard as "summary" | "summary_large_image" | undefined,
      focusKeyword:   seoValues.focusKeyword,
      canonicalUrl:   seoValues.canonicalUrl,
      robots:         seoValues.robots as "index,follow" | "noindex" | "noindex,nofollow" | undefined,
      schemaType:     seoValues.schemaType as "WebPage" | "AboutPage" | "ContactPage" | "FAQPage" | undefined,
      structuredData: seoValues.structuredData,
    };
  }

  function handleSave() {
    startTransition(async () => {
      const res = await updatePageAction(slug, pageId, buildPayload());
      if (!res.success) { alert(res.error); return; }
      router.refresh();
    });
  }

  function handleChangeStatus(target: ContentStatus) {
    startTransition(async () => {
      const res = await updatePageAction(slug, pageId, buildPayload(target));
      if (!res.success) { alert(res.error); return; }
      setStatus(target);
      router.refresh();
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
      {/* Header bar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-background sticky top-0 z-10">
        <button
          onClick={() => router.push(`/${slug}/website/pages`)}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Halaman
        </button>
        <StatusBadge status={status} />
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Area konten ───────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Judul */}
          <Input
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Judul halaman..."
            className="text-2xl font-bold border-0 border-b rounded-none px-0 focus-visible:ring-0 h-auto py-2"
          />

          {/* Slug */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Globe className="h-3.5 w-3.5 shrink-0" />
            <span className="shrink-0">/{slug}/</span>
            <Input
              value={pageSlug}
              onChange={(e) => handleSlugChange(e.target.value)}
              className="h-7 text-sm font-mono border-0 border-b rounded-none px-0 focus-visible:ring-0"
              placeholder="slug-halaman"
            />
          </div>

          {/* Block Editor */}
          <TiptapEditor
            slug={slug}
            content={content}
            onChange={(json) => setContent(json)}
            placeholder="Mulai menulis konten halaman..."
          />

          {/* SEO Panel */}
          <SeoPanel
            slug={slug}
            values={seoValues}
            onChange={setSeoValues}
            contentType="page"
            title={title}
          />
        </div>

        {/* ── Sidebar ───────────────────────────────────────────────── */}
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

            {/* Urutan di navigasi */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Urutan
              </Label>
              <Input
                type="number"
                min={0}
                value={order}
                onChange={(e) => setOrder(parseInt(e.target.value, 10) || 0)}
                className="h-8 text-sm"
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                Angka lebih kecil tampil lebih awal di navigasi
              </p>
            </div>
          </div>

          {/* Tombol aksi */}
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
