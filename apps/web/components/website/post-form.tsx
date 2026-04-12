"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { updatePostAction, updatePostStatusAction } from "@/app/(dashboard)/[tenant]/website/actions";
import type { PostFormData } from "@/app/(dashboard)/[tenant]/website/actions";
import type { SeoValues } from "@/components/seo/seo-panel";
import type { ContentStatus } from "@jalajogja/db";
import { generateSlug } from "@/lib/seo";
import { Globe, Save, Eye, EyeOff } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type Category = { id: string; name: string; slug: string };
type Tag      = { id: string; name: string; slug: string };

export type PostFormProps = {
  slug: string;         // tenant slug
  postId: string;
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

// ── PostForm ──────────────────────────────────────────────────────────────────

export function PostForm({
  slug,
  postId,
  initialData,
  categories,
  tags,
}: PostFormProps) {
  const router = useRouter();
  const [isSaving, startSave] = useTransition();
  const [isPublishing, startPublish] = useTransition();

  // Form state
  const [title, setTitle]         = useState(initialData.title);
  const [postSlug, setPostSlug]   = useState(initialData.postSlug);
  const [excerpt, setExcerpt]     = useState(initialData.excerpt);
  const [content, setContent]     = useState<string | null>(initialData.content);
  const [categoryId, setCategoryId] = useState<string>(initialData.categoryId ?? "");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(initialData.tagIds);
  const [status, setStatus]       = useState<ContentStatus>(initialData.status);
  const [seoValues, setSeoValues] = useState<SeoValues>(initialData.seo);

  // Auto-generate slug saat title berubah (hanya jika slug belum diedit manual)
  const [slugEdited, setSlugEdited] = useState(false);

  function handleTitleChange(val: string) {
    setTitle(val);
    if (!slugEdited) {
      setPostSlug(generateSlug(val));
    }
  }

  function handleSlugChange(val: string) {
    setSlugEdited(true);
    setPostSlug(val);
  }

  function toggleTag(tagId: string) {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  }

  function buildPayload(overrideStatus?: ContentStatus): PostFormData {
    return {
      title,
      slug: postSlug,
      excerpt,
      content,
      categoryId: categoryId || null,
      tagIds: selectedTagIds,
      status: overrideStatus ?? status,
      // SEO
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
    startSave(async () => {
      const res = await updatePostAction(slug, postId, buildPayload());
      if (!res.success) {
        alert(res.error);
        return;
      }
      // Refresh untuk mendapat data terbaru (slug mungkin berubah)
      router.refresh();
    });
  }

  function handleTogglePublish() {
    const newStatus: ContentStatus = status === "published" ? "draft" : "published";
    startPublish(async () => {
      const res = await updatePostAction(slug, postId, buildPayload(newStatus));
      if (!res.success) {
        alert(res.error);
        return;
      }
      setStatus(newStatus);
      router.refresh();
    });
  }

  const isPending = isSaving || isPublishing;

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-background sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/${slug}/website/posts`)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Posts
          </button>
          <StatusBadge status={status} />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={isPending}
            className="gap-1.5"
          >
            <Save className="h-3.5 w-3.5" />
            {isSaving ? "Menyimpan..." : "Simpan"}
          </Button>
          <Button
            size="sm"
            onClick={handleTogglePublish}
            disabled={isPending}
            variant={status === "published" ? "secondary" : "default"}
            className="gap-1.5"
          >
            {status === "published" ? (
              <><EyeOff className="h-3.5 w-3.5" /> Unpublish</>
            ) : (
              <><Globe className="h-3.5 w-3.5" /> Publish</>
            )}
          </Button>
        </div>
      </div>

      {/* Body: 2 kolom — editor + sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main — editor */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Judul */}
          <Input
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Judul post..."
            className="text-2xl font-bold border-0 border-b rounded-none px-0 focus-visible:ring-0 h-auto py-2"
          />

          {/* Slug */}
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

          {/* Excerpt */}
          <Textarea
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            placeholder="Ringkasan singkat (opsional)..."
            className="resize-none text-sm min-h-[60px]"
            rows={2}
          />

          {/* Block Editor */}
          <TiptapEditor
            slug={slug}
            content={content}
            onChange={(json) => setContent(json)}
            placeholder="Mulai menulis artikel..."
          />
        </div>

        {/* Sidebar */}
        <div className="w-72 shrink-0 border-l border-border overflow-y-auto">
          <div className="p-4 space-y-6">

            {/* Status */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Status
              </Label>
              <Select
                value={status}
                onValueChange={(val) => setStatus(val as ContentStatus)}
              >
                <SelectTrigger className="h-8 text-sm">
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

            {/* Kategori */}
            {categories.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Kategori
                </Label>
                <Select
                  value={categoryId}
                  onValueChange={(val) => setCategoryId(val)}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Pilih kategori..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Tanpa kategori</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Tags */}
            {tags.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Tag
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => {
                    const selected = selectedTagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className={[
                          "text-xs px-2 py-0.5 rounded-full border transition-colors",
                          selected
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border hover:bg-muted",
                        ].join(" ")}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <Separator />

            {/* SEO Panel */}
            <SeoPanel
              slug={slug}
              values={seoValues}
              onChange={setSeoValues}
              contentType="post"
              title={title}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
