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
import { PlusIcon, Trash2 } from "lucide-react";
import type { SectionType } from "@/lib/page-templates";
import { POSTS_SECTION_DESIGNS, POSTS_SECTION_DESIGN_IDS } from "@/lib/posts-section-designs";

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

function HeroEditor({ data, onChange }: EditorProps) {
  const d = data as { title?: string; subtitle?: string; ctaLabel?: string; ctaUrl?: string; bgColor?: string; bgImageUrl?: string };
  const u = (k: string, v: unknown) => onChange({ ...data, [k]: v });
  return (
    <div className="space-y-3">
      <Field label="Judul">
        <Input value={d.title ?? ""} onChange={(e) => u("title", e.target.value)} placeholder="Judul utama hero" />
      </Field>
      <Field label="Sub-judul">
        <Input value={d.subtitle ?? ""} onChange={(e) => u("subtitle", e.target.value)} placeholder="Kalimat pendukung" />
      </Field>
      <Field label="Teks Tombol CTA">
        <Input value={d.ctaLabel ?? ""} onChange={(e) => u("ctaLabel", e.target.value)} placeholder="Pelajari Lebih" />
      </Field>
      <Field label="URL Tombol CTA">
        <Input value={d.ctaUrl ?? ""} onChange={(e) => u("ctaUrl", e.target.value)} placeholder="/tentang atau https://..." />
      </Field>
      <Field label="Warna Background (hex)">
        <div className="flex items-center gap-2">
          <input type="color" value={d.bgColor ?? "#1e40af"} onChange={(e) => u("bgColor", e.target.value)} className="w-8 h-8 rounded border cursor-pointer" />
          <Input value={d.bgColor ?? ""} onChange={(e) => u("bgColor", e.target.value)} placeholder="#1e40af" className="flex-1" />
        </div>
      </Field>
      <Field label="URL Gambar Background (opsional)">
        <Input value={d.bgImageUrl ?? ""} onChange={(e) => u("bgImageUrl", e.target.value)} placeholder="https://..." />
      </Field>
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

function EventsEditor({ data, onChange }: EditorProps) {
  const d = data as { title?: string; count?: number };
  const u = (k: string, v: unknown) => onChange({ ...data, [k]: v });
  return (
    <div className="space-y-3">
      <Field label="Judul Section">
        <Input value={d.title ?? ""} onChange={(e) => u("title", e.target.value)} placeholder="Event Mendatang" />
      </Field>
      <Field label="Jumlah Event">
        <Select value={String(d.count ?? 3)} onValueChange={(v) => u("count", Number(v))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {[2, 3, 4, 6].map((n) => (
              <SelectItem key={n} value={String(n)}>{n} event</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}

// ── Gallery ───────────────────────────────────────────────────────────────────

type GalleryImage = { url: string; alt: string };

function GalleryEditor({ data, onChange }: EditorProps) {
  const d = data as { title?: string; images?: GalleryImage[] };
  const images: GalleryImage[] = d.images ?? [];
  const u = (k: string, v: unknown) => onChange({ ...data, [k]: v });
  const updateImages = (imgs: GalleryImage[]) => u("images", imgs);

  return (
    <div className="space-y-3">
      <Field label="Judul Section">
        <Input value={d.title ?? ""} onChange={(e) => u("title", e.target.value)} placeholder="Galeri Foto" />
      </Field>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Gambar</Label>
        {images.map((img, i) => (
          <div key={i} className="flex gap-2 items-center">
            <Input
              value={img.url}
              onChange={(e) => {
                const next = [...images];
                next[i] = { ...img, url: e.target.value };
                updateImages(next);
              }}
              placeholder="URL gambar"
              className="flex-1 h-8 text-xs"
            />
            <Input
              value={img.alt}
              onChange={(e) => {
                const next = [...images];
                next[i] = { ...img, alt: e.target.value };
                updateImages(next);
              }}
              placeholder="Alt text"
              className="w-24 h-8 text-xs"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive shrink-0"
              onClick={() => updateImages(images.filter((_, j) => j !== i))}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full gap-1.5 text-xs"
          onClick={() => updateImages([...images, { url: "", alt: "" }])}
        >
          <PlusIcon className="h-3.5 w-3.5" /> Tambah Gambar
        </Button>
      </div>
    </div>
  );
}

// ── About Text ────────────────────────────────────────────────────────────────

function AboutTextEditor({ data, onChange }: EditorProps) {
  const d = data as { title?: string; body?: string; imageUrl?: string; imagePosition?: string };
  const u = (k: string, v: unknown) => onChange({ ...data, [k]: v });
  return (
    <div className="space-y-3">
      <Field label="Judul">
        <Input value={d.title ?? ""} onChange={(e) => u("title", e.target.value)} placeholder="Tentang Kami" />
      </Field>
      <Field label="Isi Teks">
        <Textarea value={d.body ?? ""} onChange={(e) => u("body", e.target.value)} placeholder="Deskripsi organisasi..." rows={5} />
      </Field>
      <Field label="URL Gambar">
        <Input value={d.imageUrl ?? ""} onChange={(e) => u("imageUrl", e.target.value)} placeholder="https://..." />
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

function CtaEditor({ data, onChange }: EditorProps) {
  const d = data as { title?: string; subtitle?: string; ctaLabel?: string; ctaUrl?: string; bgColor?: string };
  const u = (k: string, v: unknown) => onChange({ ...data, [k]: v });
  return (
    <div className="space-y-3">
      <Field label="Judul">
        <Input value={d.title ?? ""} onChange={(e) => u("title", e.target.value)} placeholder="Bergabunglah Bersama Kami" />
      </Field>
      <Field label="Sub-judul">
        <Input value={d.subtitle ?? ""} onChange={(e) => u("subtitle", e.target.value)} placeholder="Kalimat pendukung" />
      </Field>
      <Field label="Teks Tombol">
        <Input value={d.ctaLabel ?? ""} onChange={(e) => u("ctaLabel", e.target.value)} placeholder="Hubungi Kami" />
      </Field>
      <Field label="URL Tombol">
        <Input value={d.ctaUrl ?? ""} onChange={(e) => u("ctaUrl", e.target.value)} placeholder="/kontak" />
      </Field>
      <Field label="Warna Background">
        <div className="flex items-center gap-2">
          <input type="color" value={d.bgColor ?? "#1e40af"} onChange={(e) => u("bgColor", e.target.value)} className="w-8 h-8 rounded border cursor-pointer" />
          <Input value={d.bgColor ?? ""} onChange={(e) => u("bgColor", e.target.value)} placeholder="#1e40af" className="flex-1" />
        </div>
      </Field>
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

// ── Editor Map ────────────────────────────────────────────────────────────────

const EDITOR_MAP: Record<SectionType, React.FC<EditorProps>> = {
  hero:         HeroEditor,
  posts:        PostsEditor,
  events:       EventsEditor,
  gallery:      GalleryEditor,
  about_text:   AboutTextEditor,
  features:     FeaturesEditor,
  cta:          CtaEditor,
  contact_info: ContactInfoEditor,
  stats:        StatsEditor,
  divider:      DividerEditor,
};

// ── Public Export ─────────────────────────────────────────────────────────────

export function SectionEditor({ type, data, onChange, variant, onVariantChange, tenantSlug }: { type: SectionType } & EditorProps) {
  const Editor = EDITOR_MAP[type];
  return <Editor data={data} onChange={onChange} variant={variant} onVariantChange={onVariantChange} tenantSlug={tenantSlug} />;
}
