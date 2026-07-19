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
import { HERO_SECTION_DESIGNS, HERO_SECTION_DESIGN_IDS, FUNFACT_CATALOG, FUNFACT_IDS, FUNFACT_STYLE_IDS, FUNFACT_STYLE_LABELS } from "@/lib/hero-section-designs";
import { CAMPAIGNS_SECTION_DESIGNS, CAMPAIGNS_SECTION_DESIGN_IDS } from "@/lib/campaigns-section-designs";
import { EVENTS_SECTION_DESIGNS, EVENTS_SECTION_DESIGN_IDS } from "@/lib/events-section-designs";
import { PRODUCTS_SECTION_DESIGNS, PRODUCTS_SECTION_DESIGN_IDS } from "@/lib/products-section-designs";
import {
  MODULE_CATALOG, MODULE_IDS, MODULE_SECTION_DESIGN_IDS, MODULE_SECTION_DESIGNS, MODULES_NO_AUTO_PHOTO,
  normalizeModuleItems, type ModuleId, type ModuleSectionDesignId,
} from "@/lib/module-strip-designs";
import { MediaPicker } from "@/components/media/media-picker";
import type { MediaItem } from "@/components/media/media-picker";
import { GalleryPicker } from "@/components/gallery/gallery-picker";
import type { GalleryItem } from "@/lib/gallery";
import { PublicLinkPicker } from "@/components/ui/public-link-picker";

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
    eyebrow?: string; title?: string; subtitle?: string;
    ctaLabel?: string; ctaUrl?: string;
    ctaSecondaryLabel?: string; ctaSecondaryUrl?: string;
    imageUrl?: string; showModuleStrip?: boolean; funfactItems?: string[];
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
    const url = media.variants?.profile ?? media.variants?.large ?? media.url;
    u("imageUrl", url);
    setPickerOpen(false);
  }

  return (
    <div className="space-y-3">
      <Field label="Label Kecil (eyebrow)">
        <Input value={d.eyebrow ?? ""} onChange={(e) => u("eyebrow", e.target.value)} placeholder="Organisasi · 2026" />
      </Field>
      <Field label="Judul Besar">
        <Input value={d.title ?? ""} onChange={(e) => u("title", e.target.value)} placeholder="Judul utama" />
      </Field>
      <Field label="Deskripsi">
        <Textarea value={d.subtitle ?? ""} onChange={(e) => u("subtitle", e.target.value)} placeholder="Paragraf deskripsi singkat..." rows={3} />
      </Field>
      <Field label="Tombol Utama">
        <div className="grid grid-cols-2 gap-2">
          <Input value={d.ctaLabel ?? ""} onChange={(e) => u("ctaLabel", e.target.value)} placeholder="Teks tombol" />
          <PublicLinkPicker slug={tenantSlug ?? ""} value={d.ctaUrl ?? ""} onChange={(url) => u("ctaUrl", url)} placeholder="Pilih halaman atau URL..." />
        </div>
      </Field>
      <Field label="Tombol Kedua (opsional)">
        <div className="grid grid-cols-2 gap-2">
          <Input value={d.ctaSecondaryLabel ?? ""} onChange={(e) => u("ctaSecondaryLabel", e.target.value)} placeholder="Teks tombol" />
          <PublicLinkPicker slug={tenantSlug ?? ""} value={d.ctaSecondaryUrl ?? ""} onChange={(url) => u("ctaSecondaryUrl", url)} placeholder="Pilih halaman atau URL..." />
        </div>
      </Field>
      <Field label="Gambar (dari Media Library)">
        {d.imageUrl ? (
          <div className="relative group">
            <img src={d.imageUrl} alt="" className="w-full aspect-[3/4] object-cover rounded-lg border border-border" />
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
  const d = data as { title?: string; count?: number; categoryId?: string | null; tagId?: string | null; columns?: ColConfig[] };
  const u = (k: string, v: unknown) => onChange({ ...data, [k]: v });
  const activeVariant = variant ?? "1";
  const isHero   = POSTS_SECTION_DESIGNS[activeVariant as keyof typeof POSTS_SECTION_DESIGNS]?.type === "hero";
  const isTrio   = activeVariant === "4";

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
      <Field label="Jumlah Postingan">
        <Select value={String(d.count ?? 6)} onValueChange={(v) => u("count", Number(v))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {[3, 4, 6, 8, 9, 11, 12].map((n) => (
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
  const d = data as { title?: string; count?: number; upcomingOnly?: boolean };
  const u = (k: string, v: unknown) => onChange({ ...data, [k]: v });
  const activeVariant = variant ?? "1";
  return (
    <div className="space-y-3">
      <Field label="Judul Section">
        <Input value={d.title ?? ""} onChange={(e) => u("title", e.target.value)} placeholder="Event Mendatang" />
      </Field>
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
  const d = data as { title?: string; count?: number; campaignType?: string | null };
  const u = (k: string, v: unknown) => onChange({ ...data, [k]: v });
  const activeVariant = variant ?? "1";
  return (
    <div className="space-y-3">
      <Field label="Judul Section">
        <Input value={d.title ?? ""} onChange={(e) => u("title", e.target.value)} placeholder="Donasi & Infaq" />
      </Field>
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

function GalleryEditor({ data, onChange, tenantSlug }: EditorProps) {
  const d = data as { title?: string; items?: GalleryItem[] };
  const items: GalleryItem[] = d.items ?? [];
  const u = (k: string, v: unknown) => onChange({ ...data, [k]: v });

  return (
    <div className="space-y-3">
      <Field label="Judul Section">
        <Input value={d.title ?? ""} onChange={(e) => u("title", e.target.value)} placeholder="Galeri Foto" />
      </Field>
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
    </div>
  );
}

// ── About Text ────────────────────────────────────────────────────────────────

function AboutTextEditor({ data, onChange, tenantSlug }: EditorProps) {
  const d = data as { title?: string; body?: string; imageUrl?: string; imagePosition?: string };
  const u = (k: string, v: unknown) => onChange({ ...data, [k]: v });
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="space-y-3">
      <Field label="Judul">
        <Input value={d.title ?? ""} onChange={(e) => u("title", e.target.value)} placeholder="Tentang Kami" />
      </Field>
      <Field label="Isi Teks">
        <Textarea value={d.body ?? ""} onChange={(e) => u("body", e.target.value)} placeholder="Deskripsi organisasi..." rows={5} />
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
      <Field label="Posisi Gambar">
        <Select value={d.imagePosition ?? "right"} onValueChange={(v) => u("imagePosition", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="left">Kiri</SelectItem>
            <SelectItem value="right">Kanan</SelectItem>
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}

// ── Features ──────────────────────────────────────────────────────────────────

type FeatureItem = { icon: string; title: string; desc: string };

function FeaturesEditor({ data, onChange }: EditorProps) {
  const d = data as { title?: string; items?: FeatureItem[] };
  const items: FeatureItem[] = d.items ?? [];
  const u = (k: string, v: unknown) => onChange({ ...data, [k]: v });
  const updateItems = (arr: FeatureItem[]) => u("items", arr);

  return (
    <div className="space-y-3">
      <Field label="Judul Section">
        <Input value={d.title ?? ""} onChange={(e) => u("title", e.target.value)} placeholder="Keunggulan Kami" />
      </Field>
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Item (maks 6)</Label>
        {items.map((item, i) => (
          <div key={i} className="border rounded-lg p-2 space-y-1.5">
            <div className="flex items-center gap-2">
              <Input
                value={item.icon}
                onChange={(e) => { const n=[...items]; n[i]={...item,icon:e.target.value}; updateItems(n); }}
                placeholder="Emoji ikon, mis. ⭐"
                className="w-20 h-7 text-xs text-center"
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
            onClick={() => updateItems([...items, { icon: "⭐", title: "", desc: "" }])}>
            <PlusIcon className="h-3.5 w-3.5" /> Tambah Item
          </Button>
        )}
      </div>
    </div>
  );
}

// ── CTA ───────────────────────────────────────────────────────────────────────

function CtaEditor({ data, onChange, tenantSlug }: EditorProps) {
  const d = data as { title?: string; subtitle?: string; ctaLabel?: string; ctaUrl?: string };
  const u = (k: string, v: unknown) => onChange({ ...data, [k]: v });
  return (
    <div className="space-y-3">
      <Field label="Judul (gunakan *teks* untuk bagian miring)">
        <Textarea value={d.title ?? ""} onChange={(e) => u("title", e.target.value)} placeholder="Bergabunglah bersama *komunitas* kami" rows={3} />
      </Field>
      <Field label="Deskripsi">
        <Textarea value={d.subtitle ?? ""} onChange={(e) => u("subtitle", e.target.value)} placeholder="Kalimat pendukung..." rows={2} />
      </Field>
      <Field label="Tombol">
        <div className="grid grid-cols-2 gap-2">
          <Input value={d.ctaLabel ?? ""} onChange={(e) => u("ctaLabel", e.target.value)} placeholder="Teks tombol" />
          <PublicLinkPicker slug={tenantSlug ?? ""} value={d.ctaUrl ?? ""} onChange={(url) => u("ctaUrl", url)} placeholder="Pilih halaman atau URL..." />
        </div>
      </Field>
      <p className="text-[11px] text-muted-foreground">Background otomatis menggunakan warna sekunder tenant.</p>
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
  const d = data as { items?: StatItem[] };
  const items: StatItem[] = d.items ?? [];
  const updateItems = (arr: StatItem[]) => onChange({ ...data, items: arr });

  return (
    <div className="space-y-2">
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
  const d = data as { title?: string; count?: number; categoryId?: string | null };
  const u = (k: string, v: unknown) => onChange({ ...data, [k]: v });
  const activeVariant = variant ?? "1";
  return (
    <div className="space-y-3">
      <Field label="Judul Section">
        <Input value={d.title ?? ""} onChange={(e) => u("title", e.target.value)}
          placeholder="Produk Terbaru" className="h-8 text-sm" />
      </Field>
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
  const d = data as { title?: string; items?: unknown };
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

// ── Editor Map ────────────────────────────────────────────────────────────────

const EDITOR_MAP: Record<SectionType, React.FC<EditorProps>> = {
  hero:         HeroEditor,
  posts:        PostsEditor,
  products:     ProductsEditor,
  events:       EventsEditor,
  campaigns:    CampaignsEditor,
  gallery:      GalleryEditor,
  about_text:   AboutTextEditor,
  features:     FeaturesEditor,
  cta:          CtaEditor,
  contact_info: ContactInfoEditor,
  stats:        StatsEditor,
  divider:      DividerEditor,
  modules:      ModulesEditor,
};

// ── Public Export ─────────────────────────────────────────────────────────────

export function SectionEditor({ type, data, onChange, variant, onVariantChange, tenantSlug }: { type: SectionType } & EditorProps) {
  const Editor = EDITOR_MAP[type];
  return <Editor data={data} onChange={onChange} variant={variant} onVariantChange={onVariantChange} tenantSlug={tenantSlug} />;
}
