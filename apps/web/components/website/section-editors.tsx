"use client";

// Editor panel per section type — dipanggil dari LandingBuilder
// Setiap editor menerima `data` dan `onChange` — update section.data

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlusIcon, Trash2, ImageIcon, X } from "lucide-react";
import type { SectionType } from "@/lib/page-templates";
import { POSTS_SECTION_DESIGNS, POSTS_SECTION_DESIGN_IDS } from "@/lib/posts-section-designs";
import { HERO_SECTION_DESIGNS, HERO_SECTION_DESIGN_IDS, FUNFACT_CATALOG, FUNFACT_IDS, FUNFACT_STYLE_IDS, FUNFACT_STYLE_LABELS, type HeroTitleColor, type HeroYoutubePlayMode, type HeroYoutubeAspect, type HeroImageBorder } from "@/lib/hero-section-designs";
import type { PublicButtonVariant } from "@/components/website/public/ui/public-button";
import { CAMPAIGNS_SECTION_DESIGNS, CAMPAIGNS_SECTION_DESIGN_IDS } from "@/lib/campaigns-section-designs";
import { EVENTS_SECTION_DESIGNS, EVENTS_SECTION_DESIGN_IDS } from "@/lib/events-section-designs";
import { PRODUCTS_SECTION_DESIGNS, PRODUCTS_SECTION_DESIGN_IDS } from "@/lib/products-section-designs";
import {
  MODULE_CATALOG, MODULE_IDS, MODULE_SECTION_DESIGN_IDS, MODULE_SECTION_DESIGNS, MODULES_NO_AUTO_PHOTO,
  normalizeModuleItems, type ModuleId, type ModuleSectionDesignId,
} from "@/lib/module-strip-designs";
import { INSTAGRAM_SECTION_DESIGNS, INSTAGRAM_SECTION_DESIGN_IDS, type InstagramSectionData } from "@/lib/instagram-section-designs";
import { MediaPicker } from "@/components/media/media-picker";
import type { MediaItem } from "@/components/media/media-picker";
import { GalleryPicker } from "@/components/gallery/gallery-picker";
import type { GalleryItem } from "@/lib/gallery";
import { PublicLinkPicker } from "@/components/ui/public-link-picker";
import {
  CTA_TEXT_ALIGN_IDS, CTA_TEXT_ALIGN_LABELS,
  CTA_BACKGROUND_IDS, CTA_BACKGROUND_LABELS,
  CTA_WIDTH_IDS, CTA_WIDTH_LABELS,
  CTA_BUTTON_POSITION_IDS, CTA_BUTTON_POSITION_LABELS,
  type CtaSectionData,
} from "@/lib/cta-section-designs";
import {
  FEATURES_TITLE_ALIGN_IDS, FEATURES_TITLE_ALIGN_LABELS,
  FEATURES_DESC_POSITION_IDS, FEATURES_DESC_POSITION_LABELS,
  FEATURES_BACKGROUND_IDS, FEATURES_BACKGROUND_LABELS,
  FEATURES_WIDTH_IDS, FEATURES_WIDTH_LABELS,
  FEATURES_ICON_STYLE_IDS, FEATURES_ICON_STYLE_LABELS,
  FEATURES_ICON_COLOR_IDS, FEATURES_ICON_COLOR_LABELS,
  FEATURES_ICON_SHAPE_IDS, FEATURES_ICON_SHAPE_LABELS,
  FEATURES_CARD_BACKGROUND_IDS, FEATURES_CARD_BACKGROUND_LABELS,
  FEATURES_HIGHLIGHT_COLOR_IDS, FEATURES_HIGHLIGHT_COLOR_LABELS,
  type FeaturesSectionData, type FeatureItem,
} from "@/lib/features-section-designs";
import { IconPicker } from "@/components/ui/icon-picker";
import { DEFAULT_ICON_NAME } from "@/lib/icon-catalog";
import {
  ABOUT_WIDTH_IDS, ABOUT_WIDTH_LABELS,
  ABOUT_TEXT_VALIGN_IDS, ABOUT_TEXT_VALIGN_LABELS,
  ABOUT_DESC_MODE_IDS, ABOUT_DESC_MODE_LABELS,
  ABOUT_IMAGE_POSITION_IDS, ABOUT_IMAGE_POSITION_LABELS,
  ABOUT_IMAGE_RATIO_IDS, ABOUT_IMAGE_RATIO_LABELS,
  SECTION_BACKGROUND_IDS, SECTION_BACKGROUND_LABELS,
  type AboutSectionData, type AboutListItem,
} from "@/lib/about-section-designs";
import {
  GALLERY_COLUMNS_IDS, GALLERY_COLUMNS_LABELS,
  GALLERY_IMAGE_RATIO_IDS, GALLERY_IMAGE_RATIO_LABELS,
  type GallerySectionData,
} from "@/lib/gallery-section-designs";
import { SECTION_TITLE_ALIGN_IDS, SECTION_TITLE_ALIGN_LABELS } from "@/lib/section-title-align";

type EditorProps = {
  data:             Record<string, unknown>;
  onChange:         (data: Record<string, unknown>) => void;
  variant?:         string;
  onVariantChange?: (variant: string) => void;
  tenantSlug?:      string;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────────────

function HeroEditor({ data, onChange, variant, onVariantChange, tenantSlug }: EditorProps) {
  const d = data as {
    eyebrow?: string; title?: string; titleColor?: HeroTitleColor; subtitle?: string;
    ctaLabel?: string; ctaUrl?: string; ctaVariant?: PublicButtonVariant;
    ctaSecondaryLabel?: string; ctaSecondaryUrl?: string; ctaSecondaryVariant?: PublicButtonVariant;
    imageUrl?: string; imageBorder?: HeroImageBorder; youtubeUrl?: string; youtubeAutoplay?: boolean;
    youtubePlayMode?: HeroYoutubePlayMode; youtubeAspect?: HeroYoutubeAspect; showHeroCard?: boolean;
    showModuleStrip?: boolean; funfactItems?: string[];
    funfactStyle?: typeof FUNFACT_STYLE_IDS[number];
  };
  const u = (k: string, v: unknown) => onChange({ ...data, [k]: v });
  const [pickerOpen, setPickerOpen] = useState(false);
  const activeVariant = variant ?? "1";
  const funfactItems  = d.funfactItems ?? [];

  function toggleFunfact(id: string) {
    if (funfactItems.includes(id)) {
      u("funfactItems", funfactItems.filter(x => x !== id));
    } else if (funfactItems.length < 4) {
      u("funfactItems", [...funfactItems, id]);
    }
  }

  function handleMediaSelect(media: MediaItem) {
    // Utamakan media.variants?.original agar mendapatkan file WebP ukuran & rasio ASLI (tanpa autocrop 16:9/1.91:1)
    const url = media.variants?.original || media.url;
    u("imageUrl", url);
    setPickerOpen(false);
  }

  return (
    <div className="space-y-3">
      <Field label="Label Kecil (eyebrow)">
        <Input value={d.eyebrow ?? ""} onChange={(e) => u("eyebrow", e.target.value)} placeholder="Organisasi · 2026" />
      </Field>
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <Field label="Judul Besar">
            <Input value={d.title ?? ""} onChange={(e) => u("title", e.target.value)} placeholder="Judul utama" />
          </Field>
        </div>
        <Field label="Warna Judul">
          <Select value={d.titleColor ?? "default"} onValueChange={(v) => u("titleColor", v)}>
            <SelectTrigger><SelectValue placeholder="Warna" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Gelap (Default)</SelectItem>
              <SelectItem value="primary">Warna Utama</SelectItem>
              <SelectItem value="secondary">Warna Secondary</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field label="Deskripsi">
        <Textarea value={d.subtitle ?? ""} onChange={(e) => u("subtitle", e.target.value)} placeholder="Paragraf deskripsi singkat..." rows={3} />
      </Field>
      <div className="space-y-2 p-2.5 border border-border rounded-lg bg-muted/20">
        <Field label="Tombol Utama">
          <div className="grid grid-cols-2 gap-2 mb-1.5">
            <Input value={d.ctaLabel ?? ""} onChange={(e) => u("ctaLabel", e.target.value)} placeholder="Teks tombol" />
            <PublicLinkPicker slug={tenantSlug ?? ""} value={d.ctaUrl ?? ""} onChange={(url) => u("ctaUrl", url)} placeholder="Pilih halaman..." />
          </div>
        </Field>
        <Field label="Gaya Tombol Utama">
          <Select value={d.ctaVariant ?? "primary"} onValueChange={(v) => u("ctaVariant", v)}>
            <SelectTrigger><SelectValue placeholder="Pilih gaya" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="primary">Background Utama (Primary)</SelectItem>
              <SelectItem value="secondary">Background Secondary</SelectItem>
              <SelectItem value="outline-primary">Border Warna Utama</SelectItem>
              <SelectItem value="outline-dark">Border Gelap</SelectItem>
              <SelectItem value="dark">Background Gelap</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
      <div className="space-y-2 p-2.5 border border-border rounded-lg bg-muted/20">
        <Field label="Tombol Kedua (opsional)">
          <div className="grid grid-cols-2 gap-2 mb-1.5">
            <Input value={d.ctaSecondaryLabel ?? ""} onChange={(e) => u("ctaSecondaryLabel", e.target.value)} placeholder="Teks tombol" />
            <PublicLinkPicker slug={tenantSlug ?? ""} value={d.ctaSecondaryUrl ?? ""} onChange={(url) => u("ctaSecondaryUrl", url)} placeholder="Pilih halaman..." />
          </div>
        </Field>
        <Field label="Gaya Tombol Kedua">
          <Select value={d.ctaSecondaryVariant ?? "ghost"} onValueChange={(v) => u("ctaSecondaryVariant", v)}>
            <SelectTrigger><SelectValue placeholder="Pilih gaya" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ghost">Ghost (Tanpa Border)</SelectItem>
              <SelectItem value="primary">Background Utama (Primary)</SelectItem>
              <SelectItem value="secondary">Background Secondary</SelectItem>
              <SelectItem value="outline-primary">Border Warna Utama</SelectItem>
              <SelectItem value="outline-dark">Border Gelap</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field label="Gambar Thumbnail (Original Size WebP)">
        {d.imageUrl ? (
          <div className="relative group">
            <img src={d.imageUrl} alt="" className="w-full h-auto max-h-48 object-contain rounded-lg border border-border bg-black/5" />
            <button
              onClick={() => u("imageUrl", "")}
              className="absolute top-1.5 right-1.5 bg-background/90 border border-border rounded-full p-1 shadow opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => tenantSlug && setPickerOpen(true)}
            disabled={!tenantSlug}
            className="w-full h-24 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:border-primary hover:text-primary transition-colors text-xs disabled:opacity-50"
          >
            <ImageIcon className="w-5 h-5" />
            Pilih dari Media Library
          </button>
        )}
        {tenantSlug && (
          <MediaPicker
            slug={tenantSlug}
            open={pickerOpen}
            onClose={() => setPickerOpen(false)}
            onSelect={handleMediaSelect}
            module="website"
            accept={["image/"]}
          />
        )}
      </Field>
      {d.imageUrl && (
        <Field label="Gaya Bingkai Gambar">
          <Select value={d.imageBorder ?? "bordered"} onValueChange={(v) => u("imageBorder", v)}>
            <SelectTrigger><SelectValue placeholder="Pilih bingkai" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="bordered">Ber-Border & Shadow (Biasa)</SelectItem>
              <SelectItem value="none">Clean (Tanpa Border & Shadow)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      )}
      <Field label="URL Video YouTube (opsional)">
        <Input value={d.youtubeUrl ?? ""} onChange={(e) => u("youtubeUrl", e.target.value)} placeholder="https://www.youtube.com/watch?v=..." />
      </Field>
      {d.youtubeUrl && (
        <div className="space-y-2 p-2.5 rounded-lg border border-border bg-muted/30">
          <div className="grid grid-cols-2 gap-2 items-center">
            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={d.youtubeAutoplay ?? false}
                onChange={(e) => u("youtubeAutoplay", e.target.checked)}
                className="w-4 h-4 accent-primary"
              />
              Autoplay Video
            </label>
            <Field label="Modus Pemutaran">
              <Select value={d.youtubePlayMode ?? "inline"} onValueChange={(v) => u("youtubePlayMode", v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="inline">Di Tempat (Inline)</SelectItem>
                  <SelectItem value="popup">Pop-up Lightbox</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Rasio / Format Video">
            <Select value={d.youtubeAspect ?? "auto"} onValueChange={(v) => u("youtubeAspect", v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Format Rasio" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto-Detect (Shorts vs Landscape)</SelectItem>
                <SelectItem value="16:9">Landscape (16:9)</SelectItem>
                <SelectItem value="9:16">Vertikal Shorts (9:16)</SelectItem>
                <SelectItem value="1:1">Kotak (1:1)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      )}
      <div className="pt-1">
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={d.showHeroCard !== false}
            onChange={(e) => u("showHeroCard", e.target.checked)}
            className="w-4 h-4 accent-primary"
          />
          <span className="text-xs font-medium">Tampilkan Kartu Melayang (Event / Donasi / Berita)</span>
        </label>
      </div>
      {activeVariant === "2" ? (
        <Field label="Funfact">
          <label className="flex items-center gap-2.5 cursor-pointer mb-2">
            <input
              type="checkbox"
              checked={d.showModuleStrip ?? false}
              onChange={(e) => u("showModuleStrip", e.target.checked)}
              className="w-4 h-4 accent-primary"
            />
            <span className="text-xs">Tampilkan statistik (maks 4, dihitung otomatis dari data)</span>
          </label>
          {d.showModuleStrip && (
            <>
              <div className="grid grid-cols-2 gap-2">
                {FUNFACT_IDS.map((id) => {
                  const isChecked = funfactItems.includes(id);
                  const disabled  = !isChecked && funfactItems.length >= 4;
                  return (
                    <label
                      key={id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-colors ${
                        isChecked ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                      } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={disabled}
                        onChange={() => toggleFunfact(id)}
                        className="w-4 h-4 accent-primary"
                      />
                      {FUNFACT_CATALOG[id].label}
                    </label>
                  );
                })}
              </div>
              <div className="mt-3 space-y-1.5">
                <Label className="text-xs text-muted-foreground">Posisi Funfact</Label>
                <div className="grid grid-cols-1 gap-2">
                  {FUNFACT_STYLE_IDS.map((style) => {
                    const isActive = (d.funfactStyle ?? "inline") === style;
                    return (
                      <button
                        key={style}
                        type="button"
                        onClick={() => u("funfactStyle", style)}
                        className={`text-left px-3 py-2 rounded-lg border text-xs transition-colors ${
                          isActive
                            ? "border-primary bg-primary/5 text-primary font-medium"
                            : "border-border hover:border-primary/40 text-foreground"
                        }`}
                      >
                        {FUNFACT_STYLE_LABELS[style]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </Field>
      ) : (
        <Field label="Strip Modul">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={d.showModuleStrip ?? false}
              onChange={(e) => u("showModuleStrip", e.target.checked)}
              className="w-4 h-4 accent-primary"
            />
            <span className="text-xs">Tampilkan strip Donasi · Agenda · Dokumen · Data Anggota</span>
          </label>
        </Field>
      )}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Design Layout</Label>
        <div className="grid grid-cols-1 gap-2">
          {HERO_SECTION_DESIGN_IDS.map((id) => {
            const meta = HERO_SECTION_DESIGNS[id];
            const isActive = activeVariant === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onVariantChange?.(id)}
                className={`text-left px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                  isActive
                    ? "border-primary bg-primary/5 text-primary font-medium"
                    : "border-border hover:border-primary/40 text-foreground"
                }`}
              >
                <span className="font-medium">{id}. {meta.label}</span>
                <span className="block text-xs text-muted-foreground mt-0.5">{meta.description}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Posts ─────────────────────────────────────────────────────────────────────

type CategoryOption = { id: string; name: string };
type TagOption     = { id: string; name: string };
type ColConfig = { categoryId?: string | null; count?: number };

function PostsEditor({ data, onChange, variant, onVariantChange, tenantSlug }: EditorProps) {
  const d = data as {
    title?: string; eyebrow?: string; headerDesc?: string; titleAlign?: typeof SECTION_TITLE_ALIGN_IDS[number];
    count?: number; categoryId?: string | null; tagId?: string | null; columns?: ColConfig[];
  };
  const u = (k: string, v: unknown) => onChange({ ...data, [k]: v });
  const activeVariant = variant ?? "1";
  const isHero   = POSTS_SECTION_DESIGNS[activeVariant as keyof typeof POSTS_SECTION_DESIGNS]?.type === "hero";
  const isTrio   = activeVariant === "4";
  // Hero (Design 1) dan Trio Column (Design 4) tidak pakai PostsSectionTitle sebagai judul
  // section keseluruhan (Hero = h2 bespoke tanpa tombol, Trio = per-kolom h3) — sembunyikan
  // field eyebrow/deskripsi/align yang tidak akan berpengaruh untuk kedua design ini.
  const showTitleFields = !isHero && !isTrio;

  // "category" | "tag" — ditentukan dari data yang ada, default "category"
  const filterMode = d.tagId ? "tag" : "category";

  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [tags,       setTags]       = useState<TagOption[]>([]);
  useEffect(() => {
    if (!tenantSlug || isHero) return;
    fetch(`/api/ref/post-categories?slug=${tenantSlug}`)
      .then(r => r.json()).then(setCategories).catch(() => {});
    fetch(`/api/ref/post-tags?slug=${tenantSlug}`)
      .then(r => r.json()).then(setTags).catch(() => {});
  }, [tenantSlug, isHero]);

  const cols: ColConfig[] = d.columns ?? [{}, {}, {}];
  const updateCol = (i: number, patch: Partial<ColConfig>) => {
    const next = [0, 1, 2].map(j => j === i ? { ...cols[j], ...patch } : (cols[j] ?? {}));
    u("columns", next);
  };

  return (
    <div className="space-y-4">
      <Field label="Judul Section">
        <Input value={d.title ?? ""} onChange={(e) => u("title", e.target.value)} placeholder="Berita & Pengumuman" />
      </Field>
      {showTitleFields && (
        <>
          <Field label="Judul Kecil (eyebrow, opsional)">
            <Input value={d.eyebrow ?? ""} onChange={(e) => u("eyebrow", e.target.value)} placeholder="TERBARU" />
          </Field>
          <Field label="Deskripsi (opsional)">
            <Input value={d.headerDesc ?? ""} onChange={(e) => u("headerDesc", e.target.value)} placeholder="Kabar dan cerita terbaru dari kami." />
          </Field>
          <OptionRow
            label="Posisi Judul"
            ids={SECTION_TITLE_ALIGN_IDS}
            labels={SECTION_TITLE_ALIGN_LABELS}
            value={d.titleAlign ?? "left"}
            onChange={(v) => u("titleAlign", v)}
          />
        </>
      )}
      <Field label="Jumlah Postingan">
        <Select value={String(d.count ?? 6)} onValueChange={(v) => u("count", Number(v))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {[2, 3, 4, 6, 8, 9, 11, 12].map((n) => (
              <SelectItem key={n} value={String(n)}>{n} postingan</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {!isHero && !isTrio && (
        <div className="space-y-2">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => onChange({ ...data, tagId: null })}
              className={`px-3 py-1 rounded text-xs border transition-colors ${
                filterMode === "category"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              Kategori
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...data, categoryId: null })}
              className={`px-3 py-1 rounded text-xs border transition-colors ${
                filterMode === "tag"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              Tag
            </button>
          </div>
          {filterMode === "category" ? (
            <Select
              value={d.categoryId ?? "all"}
              onValueChange={(v) => u("categoryId", v === "all" ? null : v)}
            >
              <SelectTrigger><SelectValue placeholder="Semua kategori" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua kategori</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Select
              value={d.tagId ?? "all"}
              onValueChange={(v) => u("tagId", v === "all" ? null : v)}
            >
              <SelectTrigger><SelectValue placeholder="Semua tag" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua tag</SelectItem>
                {tags.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}
      {isTrio && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Kategori per Kolom</Label>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-14 shrink-0">Kolom {i + 1}</span>
              <Select
                value={cols[i]?.categoryId ?? "all"}
                onValueChange={(v) => updateCol(i, { categoryId: v === "all" ? null : v })}
              >
                <SelectTrigger className="flex-1 h-8 text-xs"><SelectValue placeholder="Semua" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua kategori</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Design Layout</Label>
        <div className="grid grid-cols-1 gap-2">
          {POSTS_SECTION_DESIGN_IDS.map((id) => {
            const meta = POSTS_SECTION_DESIGNS[id];
            const isActive = activeVariant === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onVariantChange?.(id)}
                className={`text-left px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                  isActive
                    ? "border-primary bg-primary/5 text-primary font-medium"
                    : "border-border hover:border-primary/40 text-foreground"
                }`}
              >
                <span className="font-medium">{id}. {meta.label}</span>
                <span className="block text-xs text-muted-foreground mt-0.5">{meta.description}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Events ────────────────────────────────────────────────────────────────────

function EventsEditor({ data, onChange, variant, onVariantChange }: EditorProps) {
  const d = data as {
    title?: string; eyebrow?: string; headerDesc?: string; titleAlign?: typeof SECTION_TITLE_ALIGN_IDS[number];
    count?: number; upcomingOnly?: boolean;
  };
  const u = (k: string, v: unknown) => onChange({ ...data, [k]: v });
  const activeVariant = variant ?? "1";
  return (
    <div className="space-y-3">
      <Field label="Judul Section">
        <Input value={d.title ?? ""} onChange={(e) => u("title", e.target.value)} placeholder="Event Mendatang" />
      </Field>
      <Field label="Judul Kecil (eyebrow, opsional)">
        <Input value={d.eyebrow ?? ""} onChange={(e) => u("eyebrow", e.target.value)} placeholder="AGENDA" />
      </Field>
      <Field label="Deskripsi (opsional)">
        <Input value={d.headerDesc ?? ""} onChange={(e) => u("headerDesc", e.target.value)} placeholder="Ikuti kegiatan kami berikutnya." />
      </Field>
      <OptionRow
        label="Posisi Judul"
        ids={SECTION_TITLE_ALIGN_IDS}
        labels={SECTION_TITLE_ALIGN_LABELS}
        value={d.titleAlign ?? "left"}
        onChange={(v) => u("titleAlign", v)}
      />
      <Field label="Jumlah Event">
        <Select value={String(d.count ?? 6)} onValueChange={(v) => u("count", Number(v))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {[3, 4, 6, 9].map((n) => (
              <SelectItem key={n} value={String(n)}>{n} event</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Filter Waktu">
        <Select value={d.upcomingOnly === false ? "semua" : "mendatang"} onValueChange={(v) => u("upcomingOnly", v === "mendatang")}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="mendatang">Hanya Mendatang</SelectItem>
            <SelectItem value="semua">Semua Event</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Design Layout</Label>
        <div className="grid grid-cols-1 gap-2">
          {EVENTS_SECTION_DESIGN_IDS.map((id) => {
            const meta = EVENTS_SECTION_DESIGNS[id];
            const isActive = activeVariant === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onVariantChange?.(id)}
                className={`text-left px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                  isActive
                    ? "border-primary bg-primary/5 text-primary font-medium"
                    : "border-border hover:border-primary/40 text-foreground"
                }`}
              >
                <span className="font-medium">{id}. {meta.label}</span>
                <span className="block text-xs text-muted-foreground mt-0.5">{meta.description}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Campaigns ─────────────────────────────────────────────────────────────────

function CampaignsEditor({ data, onChange, variant, onVariantChange }: EditorProps) {
  const d = data as {
    title?: string; eyebrow?: string; headerDesc?: string; titleAlign?: typeof SECTION_TITLE_ALIGN_IDS[number];
    count?: number; campaignType?: string | null;
  };
  const u = (k: string, v: unknown) => onChange({ ...data, [k]: v });
  const activeVariant = variant ?? "1";
  return (
    <div className="space-y-3">
      <Field label="Judul Section">
        <Input value={d.title ?? ""} onChange={(e) => u("title", e.target.value)} placeholder="Donasi & Infaq" />
      </Field>
      <Field label="Judul Kecil (eyebrow, opsional)">
        <Input value={d.eyebrow ?? ""} onChange={(e) => u("eyebrow", e.target.value)} placeholder="MARI BERBAGI" />
      </Field>
      <Field label="Deskripsi (opsional)">
        <Input value={d.headerDesc ?? ""} onChange={(e) => u("headerDesc", e.target.value)} placeholder="Program donasi yang sedang berjalan." />
      </Field>
      <OptionRow
        label="Posisi Judul"
        ids={SECTION_TITLE_ALIGN_IDS}
        labels={SECTION_TITLE_ALIGN_LABELS}
        value={d.titleAlign ?? "left"}
        onChange={(v) => u("titleAlign", v)}
      />
      <Field label="Jumlah Campaign">
        <Select value={String(d.count ?? 6)} onValueChange={(v) => u("count", Number(v))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {[3, 4, 6, 9].map((n) => (
              <SelectItem key={n} value={String(n)}>{n} campaign</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Filter Jenis">
        <Select value={d.campaignType ?? "semua"} onValueChange={(v) => u("campaignType", v === "semua" ? null : v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="semua">Semua Jenis</SelectItem>
            <SelectItem value="donasi">Donasi</SelectItem>
            <SelectItem value="zakat">Zakat</SelectItem>
            <SelectItem value="wakaf">Wakaf</SelectItem>
            <SelectItem value="qurban">Qurban</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Design Layout</Label>
        <div className="grid grid-cols-1 gap-2">
          {CAMPAIGNS_SECTION_DESIGN_IDS.map((id) => {
            const meta = CAMPAIGNS_SECTION_DESIGNS[id];
            const isActive = activeVariant === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onVariantChange?.(id)}
                className={`text-left px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                  isActive
                    ? "border-primary bg-primary/5 text-primary font-medium"
                    : "border-border hover:border-primary/40 text-foreground"
                }`}
              >
                <span className="font-medium">{id}. {meta.label}</span>
                <span className="block text-xs text-muted-foreground mt-0.5">{meta.description}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Gallery ───────────────────────────────────────────────────────────────────
// Sub-opsi kompak (title block/background/kolom/rasio gambar) — bukan picker "Design Layout"
// penuh, Galeri Foto tetap Design 1 tunggal. Lihat docs/arsitektur-gallery.md.

function GalleryEditor({ data, onChange, tenantSlug }: EditorProps) {
  const d = data as GallerySectionData;
  const items: GalleryItem[] = d.items ?? [];
  const u = (k: string, v: unknown) => onChange({ ...data, [k]: v });

  const background = d.background ?? "none";
  const columns    = d.columns ?? 3;
  const imageRatio = d.imageRatio ?? "square";
  const titleAlign = d.titleAlign ?? "center";

  return (
    <div className="space-y-3">
      <Field label="Judul Kecil (eyebrow, opsional)">
        <Input value={d.eyebrow ?? ""} onChange={(e) => u("eyebrow", e.target.value)} placeholder="GALERI" />
      </Field>
      <Field label="Judul Besar (opsional)">
        <Input value={d.title ?? ""} onChange={(e) => u("title", e.target.value)} placeholder="Galeri Foto" />
      </Field>
      <Field label="Deskripsi (opsional)">
        <Textarea value={d.headerDesc ?? ""} onChange={(e) => u("headerDesc", e.target.value)} placeholder="Kalimat pendukung..." rows={2} />
      </Field>
      <OptionRow
        label="Posisi Judul"
        ids={SECTION_TITLE_ALIGN_IDS}
        labels={SECTION_TITLE_ALIGN_LABELS}
        value={titleAlign}
        onChange={(v) => u("titleAlign", v)}
      />

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Gambar ({items.length})</Label>
        {tenantSlug && (
          <GalleryPicker
            slug={tenantSlug}
            items={items}
            onChange={(imgs) => u("items", imgs)}
            module="website"
          />
        )}
      </div>

      <OptionRow label="Kolom" ids={GALLERY_COLUMNS_IDS} labels={GALLERY_COLUMNS_LABELS}
        value={columns} onChange={(v) => u("columns", v)} />
      <OptionRow label="Rasio Gambar" ids={GALLERY_IMAGE_RATIO_IDS} labels={GALLERY_IMAGE_RATIO_LABELS}
        value={imageRatio} onChange={(v) => u("imageRatio", v)} />
      <OptionRow label="Background Section" ids={SECTION_BACKGROUND_IDS} labels={SECTION_BACKGROUND_LABELS}
        value={background} onChange={(v) => u("background", v)} />
    </div>
  );
}

// ── About Text ────────────────────────────────────────────────────────────────

// Sub-opsi kompak (background/lebar/align teks/mode deskripsi/posisi+rasio gambar) — bukan
// picker "Design Layout" penuh, Tentang Kami tetap Design 1 tunggal, selalu 2 kolom 50/50 (bukan
// opsi). Lihat docs/arsitektur-tentang-kami-section.md

function AboutTextEditor({ data, onChange, tenantSlug }: EditorProps) {
  const d = data as AboutSectionData;
  const u = (k: string, v: unknown) => onChange({ ...data, [k]: v });
  const [pickerOpen, setPickerOpen] = useState(false);

  const items: AboutListItem[] = d.items ?? [];
  const updateItems = (arr: AboutListItem[]) => u("items", arr);

  const background     = d.background ?? "none";
  const width           = d.width ?? "full";
  const textVAlign      = d.textVAlign ?? "center";
  const descMode        = d.descMode ?? "text";
  const listDividers    = d.listDividers ?? false;
  const iconStyle       = d.iconStyle ?? "plain";
  const iconColor       = d.iconColor ?? "primary";
  const iconShape       = d.iconShape ?? "square-radius";
  const imagePosition   = d.imagePosition ?? "right";
  const imageRatio      = d.imageRatio ?? "square";
  const imageRadius     = d.imageRadius ?? true;

  return (
    <div className="space-y-3">
      <Field label="Judul Kecil (eyebrow, opsional)">
        <Input value={d.eyebrow ?? ""} onChange={(e) => u("eyebrow", e.target.value)} placeholder="WE BUILD PLACES" />
      </Field>
      <Field label="Judul Besar (opsional)">
        <Input value={d.title ?? ""} onChange={(e) => u("title", e.target.value)} placeholder="Tentang Kami" />
      </Field>

      <OptionRow label="Mode Deskripsi" ids={ABOUT_DESC_MODE_IDS} labels={ABOUT_DESC_MODE_LABELS}
        value={descMode} onChange={(v) => u("descMode", v)} />

      {descMode === "text" ? (
        <Field label="Isi Teks">
          <Textarea value={d.body ?? ""} onChange={(e) => u("body", e.target.value)} placeholder="Deskripsi organisasi..." rows={5} />
        </Field>
      ) : (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Item List (maks 6)</Label>
          {items.map((item, i) => (
            <div key={i} className="border rounded-lg p-2 space-y-1.5">
              <div className="flex items-center gap-2">
                <IconPicker
                  value={item.icon}
                  onChange={(name) => { const n=[...items]; n[i]={...item,icon:name}; updateItems(n); }}
                  className="w-32 h-7 shrink-0 text-xs"
                />
                <Input
                  value={item.title}
                  onChange={(e) => { const n=[...items]; n[i]={...item,title:e.target.value}; updateItems(n); }}
                  placeholder="Judul"
                  className="flex-1 h-7 text-xs"
                />
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0"
                  onClick={() => updateItems(items.filter((_,j)=>j!==i))}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <Textarea value={item.desc}
                onChange={(e) => { const n=[...items]; n[i]={...item,desc:e.target.value}; updateItems(n); }}
                placeholder="Deskripsi singkat" rows={2} className="text-xs" />
            </div>
          ))}
          {items.length < 6 && (
            <Button type="button" variant="outline" size="sm" className="w-full gap-1.5 text-xs"
              onClick={() => updateItems([...items, { icon: DEFAULT_ICON_NAME, title: "", desc: "" }])}>
              <PlusIcon className="h-3.5 w-3.5" /> Tambah Item
            </Button>
          )}
          <Field label="Pemisah Antar Item">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={listDividers} onChange={(e) => u("listDividers", e.target.checked)} className="w-4 h-4 accent-primary" />
              <span className="text-xs">Tampilkan garis pemisah (border bawah)</span>
            </label>
          </Field>
          <OptionRow label="Tampilan Icon" ids={FEATURES_ICON_STYLE_IDS} labels={FEATURES_ICON_STYLE_LABELS}
            value={iconStyle} onChange={(v) => u("iconStyle", v)} />
          {iconStyle === "colored" && (
            <>
              <OptionRow label="Warna Icon" ids={FEATURES_ICON_COLOR_IDS} labels={FEATURES_ICON_COLOR_LABELS}
                value={iconColor} onChange={(v) => u("iconColor", v)} />
              <OptionRow label="Bentuk Background Icon" ids={FEATURES_ICON_SHAPE_IDS} labels={FEATURES_ICON_SHAPE_LABELS}
                value={iconShape} onChange={(v) => u("iconShape", v)} />
            </>
          )}
        </div>
      )}

      <Field label="Tombol (opsional)">
        <div className="grid grid-cols-2 gap-2">
          <Input value={d.ctaLabel ?? ""} onChange={(e) => u("ctaLabel", e.target.value)} placeholder="Teks tombol" />
          <PublicLinkPicker slug={tenantSlug ?? ""} value={d.ctaUrl ?? ""} onChange={(url) => u("ctaUrl", url)} placeholder="Pilih halaman atau URL..." />
        </div>
      </Field>

      <Field label="Gambar">
        {d.imageUrl ? (
          <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={d.imageUrl} alt="" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => u("imageUrl", "")}
              className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="w-full flex items-center justify-center gap-2 h-20 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          >
            <ImageIcon className="w-4 h-4" /> Pilih Gambar
          </button>
        )}
        {tenantSlug && (
          <MediaPicker
            slug={tenantSlug}
            open={pickerOpen}
            onClose={() => setPickerOpen(false)}
            onSelect={(media: MediaItem) => {
              const url = media.variants?.large ?? media.variants?.medium ?? media.url;
              u("imageUrl", url);
              setPickerOpen(false);
            }}
            module="website"
            accept={["image/"]}
          />
        )}
      </Field>
      <OptionRow label="Posisi Gambar" ids={ABOUT_IMAGE_POSITION_IDS} labels={ABOUT_IMAGE_POSITION_LABELS}
        value={imagePosition} onChange={(v) => u("imagePosition", v)} />
      <OptionRow label="Rasio Gambar" ids={ABOUT_IMAGE_RATIO_IDS} labels={ABOUT_IMAGE_RATIO_LABELS}
        value={imageRatio} onChange={(v) => u("imageRatio", v)} />
      <Field label="Sudut Gambar">
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input type="checkbox" checked={imageRadius} onChange={(e) => u("imageRadius", e.target.checked)} className="w-4 h-4 accent-primary" />
          <span className="text-xs">Sudut membulat (rounded)</span>
        </label>
      </Field>

      <div className="border-t border-border pt-3 space-y-3">
        <OptionRow label="Background Section" ids={SECTION_BACKGROUND_IDS} labels={SECTION_BACKGROUND_LABELS}
          value={background} onChange={(v) => u("background", v)} />
        <OptionRow label="Lebar" ids={ABOUT_WIDTH_IDS} labels={ABOUT_WIDTH_LABELS}
          value={width} onChange={(v) => u("width", v)} />
        <OptionRow label="Posisi Teks (vertikal)" ids={ABOUT_TEXT_VALIGN_IDS} labels={ABOUT_TEXT_VALIGN_LABELS}
          value={textVAlign} onChange={(v) => u("textVAlign", v)} />
      </div>
    </div>
  );
}

// ── Features ──────────────────────────────────────────────────────────────────
// Sub-opsi kompak (title block/background/lebar/gaya icon/gaya kartu) — bukan picker "Design
// Layout" penuh, Keunggulan/Layanan tetap Design 1 tunggal. Lihat docs/arsitektur-keunggulan-section.md

function FeaturesEditor({ data, onChange }: EditorProps) {
  const d = data as FeaturesSectionData;
  const items: FeatureItem[] = d.items ?? [];
  const u = (k: string, v: unknown) => onChange({ ...data, [k]: v });
  const updateItems = (arr: FeatureItem[]) => u("items", arr);

  const titleAlign     = d.titleAlign ?? "center";
  const descPosition   = d.descPosition ?? "below";
  const background     = d.background ?? "light";
  const width           = d.width ?? "full";
  const iconStyle       = d.iconStyle ?? "plain";
  const iconColor       = d.iconColor ?? "primary";
  const iconShape       = d.iconShape ?? "square-radius";
  const cardRadius      = d.cardRadius ?? true;
  const cardBackground  = d.cardBackground ?? "white";
  const highlightFirst  = d.highlightFirst ?? false;
  const highlightColor  = d.highlightColor ?? "primary";

  return (
    <div className="space-y-3">
      <Field label="Judul Kecil (eyebrow, opsional)">
        <Input value={d.eyebrow ?? ""} onChange={(e) => u("eyebrow", e.target.value)} placeholder="FUTURE PAYMENT" />
      </Field>
      <Field label="Judul Besar (opsional)">
        <Input value={d.title ?? ""} onChange={(e) => u("title", e.target.value)} placeholder="Keunggulan Kami" />
      </Field>
      <Field label="Deskripsi (opsional)">
        <Textarea value={d.headerDesc ?? ""} onChange={(e) => u("headerDesc", e.target.value)} placeholder="Kalimat pendukung..." rows={2} />
      </Field>

      <OptionRow label="Posisi Judul" ids={FEATURES_TITLE_ALIGN_IDS} labels={FEATURES_TITLE_ALIGN_LABELS}
        value={titleAlign} onChange={(v) => u("titleAlign", v)} />
      <OptionRow label="Posisi Deskripsi" ids={FEATURES_DESC_POSITION_IDS} labels={FEATURES_DESC_POSITION_LABELS}
        value={descPosition} onChange={(v) => u("descPosition", v)} />
      <OptionRow label="Background Section" ids={FEATURES_BACKGROUND_IDS} labels={FEATURES_BACKGROUND_LABELS}
        value={background} onChange={(v) => u("background", v)} />
      <OptionRow label="Lebar" ids={FEATURES_WIDTH_IDS} labels={FEATURES_WIDTH_LABELS}
        value={width} onChange={(v) => u("width", v)} />

      <div className="border-t border-border pt-3 space-y-3">
        <Label className="text-xs font-medium">Gaya Icon</Label>
        <OptionRow label="Tampilan Icon" ids={FEATURES_ICON_STYLE_IDS} labels={FEATURES_ICON_STYLE_LABELS}
          value={iconStyle} onChange={(v) => u("iconStyle", v)} />
        {iconStyle === "colored" && (
          <>
            <OptionRow label="Warna Icon" ids={FEATURES_ICON_COLOR_IDS} labels={FEATURES_ICON_COLOR_LABELS}
              value={iconColor} onChange={(v) => u("iconColor", v)} />
            <OptionRow label="Bentuk Background Icon" ids={FEATURES_ICON_SHAPE_IDS} labels={FEATURES_ICON_SHAPE_LABELS}
              value={iconShape} onChange={(v) => u("iconShape", v)} />
          </>
        )}
      </div>

      <div className="border-t border-border pt-3 space-y-3">
        <Label className="text-xs font-medium">Gaya Kartu Item</Label>
        <Field label="Sudut Kartu">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={cardRadius} onChange={(e) => u("cardRadius", e.target.checked)} className="w-4 h-4 accent-primary" />
            <span className="text-xs">Sudut membulat (rounded)</span>
          </label>
        </Field>
        <OptionRow label="Background Kartu" ids={FEATURES_CARD_BACKGROUND_IDS} labels={FEATURES_CARD_BACKGROUND_LABELS}
          value={cardBackground} onChange={(v) => u("cardBackground", v)} />
        <Field label="Highlight Item Pertama">
          <label className="flex items-center gap-2.5 cursor-pointer mb-2">
            <input type="checkbox" checked={highlightFirst} onChange={(e) => u("highlightFirst", e.target.checked)} className="w-4 h-4 accent-primary" />
            <span className="text-xs">Item pertama diberi warna khusus (menonjol dari item lain)</span>
          </label>
          {highlightFirst && (
            <OptionRow label="Warna Highlight" ids={FEATURES_HIGHLIGHT_COLOR_IDS} labels={FEATURES_HIGHLIGHT_COLOR_LABELS}
              value={highlightColor} onChange={(v) => u("highlightColor", v)} />
          )}
        </Field>
      </div>

      <div className="space-y-2 border-t border-border pt-3">
        <Label className="text-xs text-muted-foreground">Item Layanan (maks 6)</Label>
        {items.map((item, i) => (
          <div key={i} className="border rounded-lg p-2 space-y-1.5">
            <div className="flex items-center gap-2">
              <IconPicker
                value={item.icon}
                onChange={(name) => { const n=[...items]; n[i]={...item,icon:name}; updateItems(n); }}
                className="w-32 h-7 shrink-0 text-xs"
              />
              <Input
                value={item.title}
                onChange={(e) => { const n=[...items]; n[i]={...item,title:e.target.value}; updateItems(n); }}
                placeholder="Judul"
                className="flex-1 h-7 text-xs"
              />
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0"
                onClick={() => updateItems(items.filter((_,j)=>j!==i))}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            <Textarea value={item.desc}
              onChange={(e) => { const n=[...items]; n[i]={...item,desc:e.target.value}; updateItems(n); }}
              placeholder="Deskripsi singkat" rows={2} className="text-xs" />
          </div>
        ))}
        {items.length < 6 && (
          <Button type="button" variant="outline" size="sm" className="w-full gap-1.5 text-xs"
            onClick={() => updateItems([...items, { icon: DEFAULT_ICON_NAME, title: "", desc: "" }])}>
            <PlusIcon className="h-3.5 w-3.5" /> Tambah Item
          </Button>
        )}
      </div>
    </div>
  );
}

// ── CTA ───────────────────────────────────────────────────────────────────────
// Sub-opsi kompak (align/bg/lebar/posisi tombol) — bukan picker "Design Layout" penuh, karena
// CTA tetap Design 1 tunggal. Lihat docs/arsitektur-cta-section.md § 1.

function OptionRow<T extends string | number>({
  label, ids, labels, value, onChange,
}: {
  label:    string;
  ids:      readonly T[];
  labels:   Record<T, string>;
  value:    T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {ids.map((id) => {
          const isActive = value === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={`px-2.5 py-1.5 rounded-md border text-xs transition-colors ${
                isActive
                  ? "border-primary bg-primary/5 text-primary font-medium"
                  : "border-border hover:border-primary/40 text-foreground"
              }`}
            >
              {labels[id]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CtaEditor({ data, onChange, tenantSlug }: EditorProps) {
  const d = data as CtaSectionData;
  const u = (k: string, v: unknown) => onChange({ ...data, [k]: v });

  const textAlign      = d.textAlign ?? "left";
  const background     = d.background ?? "secondary";
  const width           = d.width ?? "full";
  const boxedRadius     = d.boxedRadius ?? true;
  const buttonPosition = d.buttonPosition ?? "below";

  return (
    <div className="space-y-3">
      <Field label="Judul (gunakan *teks* untuk bagian miring)">
        <Textarea value={d.title ?? ""} onChange={(e) => u("title", e.target.value)} placeholder="Bergabunglah bersama *komunitas* kami" rows={3} />
      </Field>
      <Field label="Deskripsi">
        <Textarea value={d.subtitle ?? ""} onChange={(e) => u("subtitle", e.target.value)} placeholder="Kalimat pendukung..." rows={2} />
      </Field>
      <Field label="Tombol Utama">
        <div className="grid grid-cols-2 gap-2">
          <Input value={d.ctaLabel ?? ""} onChange={(e) => u("ctaLabel", e.target.value)} placeholder="Teks tombol" />
          <PublicLinkPicker slug={tenantSlug ?? ""} value={d.ctaUrl ?? ""} onChange={(url) => u("ctaUrl", url)} placeholder="Pilih halaman atau URL..." />
        </div>
      </Field>
      <Field label="Tombol Kedua (opsional, gaya outline)">
        <div className="grid grid-cols-2 gap-2">
          <Input value={d.ctaSecondaryLabel ?? ""} onChange={(e) => u("ctaSecondaryLabel", e.target.value)} placeholder="Teks tombol" />
          <PublicLinkPicker slug={tenantSlug ?? ""} value={d.ctaSecondaryUrl ?? ""} onChange={(url) => u("ctaSecondaryUrl", url)} placeholder="Pilih halaman atau URL..." />
        </div>
      </Field>

      <OptionRow label="Posisi Teks" ids={CTA_TEXT_ALIGN_IDS} labels={CTA_TEXT_ALIGN_LABELS}
        value={textAlign} onChange={(v) => u("textAlign", v)} />
      <OptionRow label="Background" ids={CTA_BACKGROUND_IDS} labels={CTA_BACKGROUND_LABELS}
        value={background} onChange={(v) => u("background", v)} />
      <OptionRow label="Lebar" ids={CTA_WIDTH_IDS} labels={CTA_WIDTH_LABELS}
        value={width} onChange={(v) => u("width", v)} />
      {width === "boxed" && (
        <Field label="Sudut Kotak">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={boxedRadius} onChange={(e) => u("boxedRadius", e.target.checked)} className="w-4 h-4 accent-primary" />
            <span className="text-xs">Sudut membulat (rounded)</span>
          </label>
        </Field>
      )}
      <OptionRow label="Posisi Tombol" ids={CTA_BUTTON_POSITION_IDS} labels={CTA_BUTTON_POSITION_LABELS}
        value={buttonPosition} onChange={(v) => u("buttonPosition", v)} />

      <p className="text-[11px] text-muted-foreground">
        Tombol utama otomatis kontras dengan background yang dipilih.
      </p>
    </div>
  );
}

// ── Contact Info ──────────────────────────────────────────────────────────────

function ContactInfoEditor() {
  return (
    <p className="text-sm text-muted-foreground italic py-4">
      Info kontak diambil otomatis dari <strong>Pengaturan → Kontak</strong>. Tidak ada data yang perlu diisi di sini.
    </p>
  );
}

// ── Stats ─────────────────────────────────────────────────────────────────────

type StatItem = { number: string; label: string };

function StatsEditor({ data, onChange }: EditorProps) {
  const d = data as { eyebrow?: string; title?: string; headerDesc?: string; titleAlign?: typeof SECTION_TITLE_ALIGN_IDS[number]; items?: StatItem[] };
  const items: StatItem[] = d.items ?? [];
  const u = (k: string, v: unknown) => onChange({ ...data, [k]: v });
  const updateItems = (arr: StatItem[]) => onChange({ ...data, items: arr });

  return (
    <div className="space-y-3">
      <Field label="Judul Kecil (eyebrow, opsional)">
        <Input value={d.eyebrow ?? ""} onChange={(e) => u("eyebrow", e.target.value)} placeholder="ANGKA KAMI" />
      </Field>
      <Field label="Judul Besar (opsional)">
        <Input value={d.title ?? ""} onChange={(e) => u("title", e.target.value)} placeholder="Statistik" />
      </Field>
      <Field label="Deskripsi (opsional)">
        <Input value={d.headerDesc ?? ""} onChange={(e) => u("headerDesc", e.target.value)} placeholder="Sedikit cerita di balik angka." />
      </Field>
      <OptionRow
        label="Posisi Judul"
        ids={SECTION_TITLE_ALIGN_IDS}
        labels={SECTION_TITLE_ALIGN_LABELS}
        value={d.titleAlign ?? "center"}
        onChange={(v) => u("titleAlign", v)}
      />
      <Label className="text-xs text-muted-foreground">Statistik (maks 4)</Label>
      {items.map((item, i) => (
        <div key={i} className="flex gap-2 items-center">
          <Input value={item.number}
            onChange={(e) => { const n=[...items]; n[i]={...item,number:e.target.value}; updateItems(n); }}
            placeholder="1.200+" className="w-24 h-8 text-xs" />
          <Input value={item.label}
            onChange={(e) => { const n=[...items]; n[i]={...item,label:e.target.value}; updateItems(n); }}
            placeholder="Anggota Aktif" className="flex-1 h-8 text-xs" />
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0"
            onClick={() => updateItems(items.filter((_,j)=>j!==i))}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      {items.length < 4 && (
        <Button type="button" variant="outline" size="sm" className="w-full gap-1.5 text-xs"
          onClick={() => updateItems([...items, { number: "", label: "" }])}>
          <PlusIcon className="h-3.5 w-3.5" /> Tambah Statistik
        </Button>
      )}
    </div>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────────

function DividerEditor({ data, onChange }: EditorProps) {
  const d = data as { height?: number; bgColor?: string };
  const u = (k: string, v: unknown) => onChange({ ...data, [k]: v });
  return (
    <div className="space-y-3">
      <Field label="Tinggi (px)">
        <Select value={String(d.height ?? 64)} onValueChange={(v) => u("height", Number(v))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {[32, 48, 64, 96, 128].map((n) => (
              <SelectItem key={n} value={String(n)}>{n}px</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Warna Background (opsional)">
        <Input value={d.bgColor ?? ""} onChange={(e) => u("bgColor", e.target.value)} placeholder="Kosongkan untuk transparan" />
      </Field>
    </div>
  );
}

// ── Products ──────────────────────────────────────────────────────────────────

function ProductsEditor({ data, onChange, variant, onVariantChange }: EditorProps) {
  const d = data as {
    title?: string; eyebrow?: string; headerDesc?: string; titleAlign?: typeof SECTION_TITLE_ALIGN_IDS[number];
    count?: number; categoryId?: string | null;
  };
  const u = (k: string, v: unknown) => onChange({ ...data, [k]: v });
  const activeVariant = variant ?? "1";
  return (
    <div className="space-y-3">
      <Field label="Judul Section">
        <Input value={d.title ?? ""} onChange={(e) => u("title", e.target.value)}
          placeholder="Produk Terbaru" className="h-8 text-sm" />
      </Field>
      <Field label="Judul Kecil (eyebrow, opsional)">
        <Input value={d.eyebrow ?? ""} onChange={(e) => u("eyebrow", e.target.value)} placeholder="KOLEKSI" />
      </Field>
      <Field label="Deskripsi (opsional)">
        <Input value={d.headerDesc ?? ""} onChange={(e) => u("headerDesc", e.target.value)} placeholder="Produk pilihan dari toko kami." />
      </Field>
      <OptionRow
        label="Posisi Judul"
        ids={SECTION_TITLE_ALIGN_IDS}
        labels={SECTION_TITLE_ALIGN_LABELS}
        value={d.titleAlign ?? "left"}
        onChange={(v) => u("titleAlign", v)}
      />
      <Field label="Jumlah Produk">
        <select value={d.count ?? 8} onChange={(e) => u("count", Number(e.target.value))}
          className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm">
          {[4, 8, 12, 16].map(n => <option key={n} value={n}>{n} produk</option>)}
        </select>
      </Field>
      <p className="text-xs text-muted-foreground">Filter kategori dapat dikonfigurasi setelah section disimpan.</p>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Design Layout</Label>
        <div className="grid grid-cols-1 gap-2">
          {PRODUCTS_SECTION_DESIGN_IDS.map((id) => {
            const meta = PRODUCTS_SECTION_DESIGNS[id];
            const isActive = activeVariant === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onVariantChange?.(id)}
                className={`text-left px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                  isActive
                    ? "border-primary bg-primary/5 text-primary font-medium"
                    : "border-border hover:border-primary/40 text-foreground"
                }`}
              >
                <span className="font-medium">{id}. {meta.label}</span>
                <span className="block text-xs text-muted-foreground mt-0.5">{meta.description}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Modules (Strip Modul) ──────────────────────────────────────────────────────

function ModulesEditor({ data, onChange, variant, onVariantChange, tenantSlug }: EditorProps) {
  const d = data as { title?: string; eyebrow?: string; headerDesc?: string; titleAlign?: typeof SECTION_TITLE_ALIGN_IDS[number]; items?: unknown };
  const u = (k: string, v: unknown) => onChange({ ...data, [k]: v });
  const selected      = normalizeModuleItems(d.items);
  const activeVariant = (variant ?? "1") as ModuleSectionDesignId;
  const [pickerForId, setPickerForId] = useState<ModuleId | null>(null);

  function isChecked(id: ModuleId) {
    return selected.some(item => item.id === id);
  }

  function toggle(id: ModuleId) {
    u("items", isChecked(id) ? selected.filter(item => item.id !== id) : [...selected, { id }]);
  }

  function setItemImage(id: ModuleId, imageUrl: string) {
    u("items", selected.map(item => item.id === id ? { ...item, imageUrl } : item));
  }

  function handleMediaSelect(id: ModuleId, media: MediaItem) {
    setItemImage(id, media.variants?.large ?? media.url);
    setPickerForId(null);
  }

  return (
    <div className="space-y-3">
      <Field label="Judul Section (opsional)">
        <Input value={d.title ?? ""} onChange={(e) => u("title", e.target.value)} placeholder="Jelajahi Layanan Kami" />
      </Field>
      <Field label="Judul Kecil (eyebrow, opsional)">
        <Input value={d.eyebrow ?? ""} onChange={(e) => u("eyebrow", e.target.value)} placeholder="EKOSISTEM" />
      </Field>
      <Field label="Deskripsi (opsional)">
        <Input value={d.headerDesc ?? ""} onChange={(e) => u("headerDesc", e.target.value)} placeholder="Layanan yang bisa kamu manfaatkan." />
      </Field>
      <OptionRow
        label="Posisi Judul"
        ids={SECTION_TITLE_ALIGN_IDS}
        labels={SECTION_TITLE_ALIGN_LABELS}
        value={d.titleAlign ?? "left"}
        onChange={(v) => u("titleAlign", v)}
      />
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Pilih Modul yang Ditampilkan</Label>
        <div className="grid grid-cols-2 gap-2">
          {MODULE_IDS.map((id) => {
            const mod     = MODULE_CATALOG[id];
            const checked = isChecked(id);
            return (
              <label
                key={id}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-colors ${
                  checked ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(id)}
                  className="w-4 h-4 accent-primary"
                />
                {mod.label}
              </label>
            );
          })}
        </div>
      </div>

      {activeVariant === "2" && selected.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Foto per Modul (opsional)</Label>
          <div className="space-y-1.5">
            {selected.filter(item => item.id in MODULE_CATALOG).map((item) => {
              const mod        = MODULE_CATALOG[item.id as ModuleId];
              const noAutoPhoto = MODULES_NO_AUTO_PHOTO.includes(item.id as ModuleId);
              return (
                <div key={item.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-xs">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-muted shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{mod.label}</p>
                    <p className="text-muted-foreground truncate">
                      {item.imageUrl
                        ? "Foto custom"
                        : noAutoPhoto
                          ? "Tanpa foto — otomatis gradasi+ikon"
                          : "Otomatis dari item terbaru"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => tenantSlug && setPickerForId(item.id as ModuleId)}
                    disabled={!tenantSlug}
                    className="shrink-0 px-2 py-1 rounded-md border border-border hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
                  >
                    Upload Foto
                  </button>
                  {item.imageUrl && (
                    <button
                      type="button"
                      onClick={() => u("items", selected.map(x => x.id === item.id ? { id: x.id } : x))}
                      className="shrink-0 px-1.5 py-1 rounded-md border border-border hover:border-destructive hover:text-destructive transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {tenantSlug && (
            <MediaPicker
              slug={tenantSlug}
              open={pickerForId !== null}
              onClose={() => setPickerForId(null)}
              onSelect={(media) => pickerForId && handleMediaSelect(pickerForId, media)}
              module="website"
              accept={["image/"]}
            />
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Design Layout</Label>
        <div className="grid grid-cols-1 gap-2">
          {MODULE_SECTION_DESIGN_IDS.map((id) => {
            const meta = MODULE_SECTION_DESIGNS[id];
            const isActive = activeVariant === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onVariantChange?.(id)}
                className={`text-left px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                  isActive
                    ? "border-primary bg-primary/5 text-primary font-medium"
                    : "border-border hover:border-primary/40 text-foreground"
                }`}
              >
                <span className="font-medium">{id}. {meta.label}</span>
                <span className="block text-xs text-muted-foreground mt-0.5">{meta.description}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Instagram Editor ─────────────────────────────────────────────────────────

type InstagramConnectionStatus =
  | { state: "loading" }
  | { state: "connected"; username: string }
  | { state: "disconnected" }
  | { state: "error" };

function InstagramEditor({ data, onChange, tenantSlug }: EditorProps) {
  const d = data as InstagramSectionData;
  const u = (k: string, v: unknown) => onChange({ ...data, [k]: v });
  const [status, setStatus] = useState<InstagramConnectionStatus>({ state: "loading" });

  useEffect(() => {
    if (!tenantSlug) return;
    let cancelled = false;
    fetch(`/api/instagram/oauth/status?slug=${tenantSlug}`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then((data: { connected: boolean; username?: string }) => {
        if (cancelled) return;
        setStatus(data.connected ? { state: "connected", username: data.username ?? "" } : { state: "disconnected" });
      })
      .catch(() => { if (!cancelled) setStatus({ state: "error" }); });
    return () => { cancelled = true; };
  }, [tenantSlug]);

  const handleDisconnect = async () => {
    if (!tenantSlug) return;
    if (!confirm("Putuskan koneksi Instagram? Feed otomatis di section ini akan berhenti tampil sampai dihubungkan lagi.")) return;
    await fetch(`/api/instagram/oauth/disconnect?slug=${tenantSlug}`, { method: "POST" });
    setStatus({ state: "disconnected" });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Mode Tampilan Header">
          <Select value={d.mode ?? "repost"} onValueChange={(v) => u("mode", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="repost">Reposted dari (Default)</SelectItem>
              <SelectItem value="post">Post dari</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Jumlah Post Tampil">
          <Select value={String(d.count ?? 8)} onValueChange={(v) => u("count", Number(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {[4, 8, 12, 16].map((n) => (
                <SelectItem key={n} value={String(n)}>{n} postingan</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Nama Akun (Linimasa)">
          <Input
            value={d.accountName ?? ""}
            onChange={(e) => u("accountName", e.target.value)}
            placeholder="Forcreator"
          />
        </Field>
        <Field label="URL Akun Instagram">
          <Input
            value={d.accountUrl ?? ""}
            onChange={(e) => u("accountUrl", e.target.value)}
            placeholder="https://instagram.com/forcreator"
          />
        </Field>
      </div>

      <Field label="Border Top Dekoratif">
        <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium">
          <input
            type="checkbox"
            checked={d.showBorderTop ?? false}
            onChange={(e) => u("showBorderTop", e.target.checked)}
            className="w-4 h-4 accent-primary"
          />
          Tampilkan Garis Pembatas Atas (Border Top)
        </label>
      </Field>

      <Field label="URL Postingan Resmi Instagram (1 URL per baris, opsional)">
        <Textarea
          rows={3}
          value={(d.postUrls ?? []).join("\n")}
          onChange={(e) => {
            const urls = e.target.value.split("\n").map(s => s.trim()).filter(Boolean);
            u("postUrls", urls);
          }}
          placeholder="https://www.instagram.com/p/C-xyz123/&#10;https://www.instagram.com/p/D-abc987/"
          className="font-mono text-xs"
        />
        <p className="text-[11px] text-muted-foreground">
          Tempelkan link postingan Instagram publik. Sistem akan menyematkan (embed) postingan resmi tersebut secara otomatis.
        </p>
      </Field>

      {/* Koneksi Instagram — feed otomatis, TIDAK ada upload foto manual */}
      <Field label="Koneksi Akun Instagram">
        {status.state === "loading" && (
          <p className="text-xs text-muted-foreground">Memuat status koneksi...</p>
        )}

        {status.state === "connected" && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5">
            <p className="text-xs text-green-800">
              ✓ Terhubung sebagai <span className="font-semibold">@{status.username}</span> — foto diambil otomatis dari feed Instagram.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={handleDisconnect} className="shrink-0 text-xs">
              Putuskan
            </Button>
          </div>
        )}

        {status.state === "disconnected" && (
          <div className="space-y-2 rounded-lg border border-dashed border-border px-3 py-3">
            <p className="text-xs text-muted-foreground">
              Belum terhubung ke Instagram — section ini tidak akan menampilkan apa pun di halaman publik
              sampai akun dihubungkan (kecuali diisi URL postingan manual di bawah).
            </p>
            {tenantSlug && (
              <a
                href={`/api/instagram/oauth/authorize?slug=${tenantSlug}`}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
              >
                Hubungkan Instagram
              </a>
            )}
          </div>
        )}

        {status.state === "error" && (
          <p className="text-xs text-destructive">Gagal memuat status koneksi. Coba tutup dan buka lagi editor ini.</p>
        )}
      </Field>
    </div>
  );
}

// ── Editor Map ────────────────────────────────────────────────────────────────

const EDITOR_MAP: Record<SectionType, React.FC<EditorProps>> = {
  hero:           HeroEditor,
  posts:          PostsEditor,
  products:       ProductsEditor,
  events:         EventsEditor,
  campaigns:      CampaignsEditor,
  gallery:        GalleryEditor,
  about_text:     AboutTextEditor,
  features:       FeaturesEditor,
  cta:            CtaEditor,
  contact_info:   ContactInfoEditor,
  stats:          StatsEditor,
  divider:        DividerEditor,
  modules:        ModulesEditor,
  instagram_post: InstagramEditor,
};

// ── Public Export ─────────────────────────────────────────────────────────────

export function SectionEditor({ type, data, onChange, variant, onVariantChange, tenantSlug }: { type: SectionType } & EditorProps) {
  const Editor = EDITOR_MAP[type];
  return <Editor data={data} onChange={onChange} variant={variant} onVariantChange={onVariantChange} tenantSlug={tenantSlug} />;
}
