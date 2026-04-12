"use client";

import { useState } from "react";
import {
  ChevronDown,
  Monitor,
  Smartphone,
  Check,
  ChevronsUpDown,
  ImagePlus,
  X,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
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
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { TITLE_MAX_LENGTH, DESC_MAX_LENGTH, SCHEMA_ORG_TYPES } from "@/lib/seo-defaults";
import { SnippetPreview } from "./snippet-preview";
import { SocialPreview } from "./social-preview";
import { SeoScore } from "./seo-score";
import { MediaPicker, type MediaItem } from "@/components/media/media-picker";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SeoValues = {
  metaTitle: string;
  metaDesc: string;
  focusKeyword: string;
  ogTitle: string;
  ogDescription: string;
  ogImageId: string | null;
  ogImageUrl: string | null;
  twitterCard: "summary" | "summary_large_image";
  canonicalUrl: string;
  robots: "index,follow" | "noindex" | "noindex,nofollow";
  schemaType: string;
  structuredData: string;
};

export interface SeoPanelProps {
  slug: string;
  contentType: "post" | "page" | "product";
  /** Judul konten aktual (dari parent form) — dipakai sebagai fallback */
  title: string;
  /** Konten HTML/teks — dipakai oleh SEO analyzer untuk cek keyword */
  content?: string;
  values: SeoValues;
  onChange: (values: SeoValues) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ROBOTS_OPTIONS: { value: SeoValues["robots"]; label: string }[] = [
  { value: "index,follow",     label: "index, follow (default)" },
  { value: "noindex",          label: "noindex" },
  { value: "noindex,nofollow", label: "noindex, nofollow" },
];

// ── CharCounter ───────────────────────────────────────────────────────────────

function CharCounter({ current, max }: { current: number; max: number }) {
  return (
    <span
      className={cn(
        "text-xs tabular-nums",
        current > max ? "text-destructive font-medium" : "text-muted-foreground",
      )}
    >
      {current}/{max}
    </span>
  );
}

// ── SimpleCombobox ────────────────────────────────────────────────────────────

function SimpleCombobox<T extends string>({
  value,
  options,
  placeholder = "Pilih...",
  disabled,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  placeholder?: string;
  disabled?: boolean;
  onChange: (val: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          {selected?.label ?? placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Cari..." className="h-9" />
          <CommandList>
            <CommandEmpty>Tidak ditemukan.</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.value}
                  onSelect={() => { onChange(opt.value); setOpen(false); }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === opt.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ── SeoPanel ──────────────────────────────────────────────────────────────────

export function SeoPanel({
  slug,
  contentType,
  title,
  content,
  values,
  onChange,
}: SeoPanelProps) {
  const [isOpen,         setIsOpen]         = useState(false);
  const [snippetMode,    setSnippetMode]     = useState<"desktop" | "mobile">("desktop");
  const [socialPlatform, setSocialPlatform]  = useState<"facebook" | "twitter">("facebook");
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);

  const set = <K extends keyof SeoValues>(key: K, val: SeoValues[K]) =>
    onChange({ ...values, [key]: val });

  const schemaOptions = (SCHEMA_ORG_TYPES[contentType] as readonly string[]).map((v) => ({
    value: v,
    label: v,
  }));

  const snippetTitle = values.metaTitle || title;
  const snippetUrl   = `${slug}.jalajogja.com`;
  const ogTitle      = values.ogTitle      || values.metaTitle || title;
  const ogDesc       = values.ogDescription || values.metaDesc;

  const isConfigured = !!(values.metaTitle || values.metaDesc || values.focusKeyword);

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* ── Accordion Header ── */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left
                   hover:bg-muted/40 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">SEO &amp; Meta</span>
          {isConfigured ? (
            <span className="text-xs text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded">
              Dikonfigurasi
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              Opsional — gunakan default jika kosong
            </span>
          )}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {/* ── Panel Content ── */}
      {isOpen && (
        <div className="border-t border-border">
          <Tabs defaultValue="seo" className="w-full">
            <div className="px-4 pt-3">
              <TabsList>
                <TabsTrigger value="seo">SEO Dasar</TabsTrigger>
                <TabsTrigger value="og">Open Graph</TabsTrigger>
                <TabsTrigger value="advanced">Advanced</TabsTrigger>
              </TabsList>
            </div>

            {/* ────────────── TAB 1: SEO Dasar ────────────── */}
            <TabsContent value="seo" className="px-4 pb-5 pt-4 space-y-5 m-0">

              {/* Focus Keyword */}
              <div className="space-y-1.5">
                <Label htmlFor="seo-focus-keyword">Focus Keyword</Label>
                <Input
                  id="seo-focus-keyword"
                  value={values.focusKeyword}
                  onChange={(e) => set("focusKeyword", e.target.value)}
                  placeholder="contoh: anggota IKPM Yogyakarta"
                />
                <p className="text-xs text-muted-foreground">
                  Kata kunci utama yang ingin dioptimasi untuk halaman ini.
                </p>
              </div>

              {/* Google Snippet Preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Pratinjau Google</Label>
                  <div className="flex items-center gap-0.5 border rounded-md p-0.5">
                    <button
                      type="button"
                      onClick={() => setSnippetMode("desktop")}
                      title="Desktop"
                      className={cn(
                        "p-1 rounded transition-colors",
                        snippetMode === "desktop" ? "bg-muted" : "hover:bg-muted/50",
                      )}
                    >
                      <Monitor className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSnippetMode("mobile")}
                      title="Mobile"
                      className={cn(
                        "p-1 rounded transition-colors",
                        snippetMode === "mobile" ? "bg-muted" : "hover:bg-muted/50",
                      )}
                    >
                      <Smartphone className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <SnippetPreview
                  title={snippetTitle}
                  description={values.metaDesc}
                  url={snippetUrl}
                  mode={snippetMode}
                />
              </div>

              {/* Meta Title */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="seo-meta-title">Meta Title</Label>
                  <CharCounter current={values.metaTitle.length} max={TITLE_MAX_LENGTH} />
                </div>
                <Input
                  id="seo-meta-title"
                  value={values.metaTitle}
                  onChange={(e) => set("metaTitle", e.target.value)}
                  placeholder={title || "Judul halaman (auto jika kosong)"}
                />
                {title && values.metaTitle && values.metaTitle !== title && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs px-2 text-muted-foreground"
                    onClick={() => set("metaTitle", title)}
                  >
                    Gunakan judul konten
                  </Button>
                )}
              </div>

              {/* Meta Description */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="seo-meta-desc">Meta Description</Label>
                  <CharCounter current={values.metaDesc.length} max={DESC_MAX_LENGTH} />
                </div>
                <Textarea
                  id="seo-meta-desc"
                  value={values.metaDesc}
                  onChange={(e) => set("metaDesc", e.target.value)}
                  placeholder="Deskripsi singkat untuk hasil pencarian (auto jika kosong)"
                  rows={3}
                  className="resize-none"
                />
              </div>

              {/* SEO Score */}
              <SeoScore
                keyword={values.focusKeyword}
                metaTitle={values.metaTitle}
                metaDesc={values.metaDesc}
                content={content}
              />
            </TabsContent>

            {/* ────────────── TAB 2: Open Graph ────────────── */}
            <TabsContent value="og" className="px-4 pb-5 pt-4 space-y-5 m-0">

              {/* OG Title */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="seo-og-title">OG Title</Label>
                  <CharCounter current={values.ogTitle.length} max={TITLE_MAX_LENGTH} />
                </div>
                <Input
                  id="seo-og-title"
                  value={values.ogTitle}
                  onChange={(e) => set("ogTitle", e.target.value)}
                  placeholder={values.metaTitle || title || "Gunakan Meta Title"}
                />
              </div>

              {/* OG Description */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="seo-og-desc">OG Description</Label>
                  <CharCounter current={values.ogDescription.length} max={DESC_MAX_LENGTH} />
                </div>
                <Textarea
                  id="seo-og-desc"
                  value={values.ogDescription}
                  onChange={(e) => set("ogDescription", e.target.value)}
                  placeholder={values.metaDesc || "Gunakan Meta Description"}
                  rows={3}
                  className="resize-none"
                />
              </div>

              {/* OG Image */}
              <div className="space-y-1.5">
                <Label>OG Image</Label>
                {values.ogImageUrl ? (
                  <div className="space-y-2">
                    <div className="relative rounded-md overflow-hidden border border-border aspect-[1.91/1] max-w-[320px]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={values.ogImageUrl}
                        alt="OG Preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => onChange({ ...values, ogImageId: null, ogImageUrl: null })}
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60
                                   flex items-center justify-center hover:bg-black/80 transition-colors"
                        title="Hapus gambar"
                      >
                        <X className="h-3.5 w-3.5 text-white" />
                      </button>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2 text-muted-foreground"
                      onClick={() => setMediaPickerOpen(true)}
                    >
                      Ganti gambar
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setMediaPickerOpen(true)}
                    className="gap-2"
                  >
                    <ImagePlus className="h-4 w-4" />
                    Pilih Gambar OG
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">
                  Ukuran ideal: 1200 × 630 px. Tampil saat link dibagikan di sosial media.
                </p>
              </div>

              {/* Social Preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Pratinjau Sosial Media</Label>
                  <div className="flex items-center gap-0.5 border rounded-md p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setSocialPlatform("facebook")}
                      className={cn(
                        "px-2 py-0.5 rounded transition-colors",
                        socialPlatform === "facebook" ? "bg-muted font-medium" : "hover:bg-muted/50",
                      )}
                    >
                      Facebook
                    </button>
                    <button
                      type="button"
                      onClick={() => setSocialPlatform("twitter")}
                      className={cn(
                        "px-2 py-0.5 rounded transition-colors",
                        socialPlatform === "twitter" ? "bg-muted font-medium" : "hover:bg-muted/50",
                      )}
                    >
                      X / Twitter
                    </button>
                  </div>
                </div>
                <SocialPreview
                  title={ogTitle}
                  description={ogDesc}
                  imageUrl={values.ogImageUrl}
                  domain={`${slug}.jalajogja.com`}
                  platform={socialPlatform}
                />
              </div>

              {/* MediaPicker — di luar Dialog agar z-index tidak bentrok */}
              <MediaPicker
                slug={slug}
                open={mediaPickerOpen}
                onClose={() => setMediaPickerOpen(false)}
                onSelect={(item: MediaItem) => {
                  onChange({ ...values, ogImageId: item.id, ogImageUrl: item.url });
                }}
                module="website"
                accept={["image/"]}
              />
            </TabsContent>

            {/* ────────────── TAB 3: Advanced ────────────── */}
            <TabsContent value="advanced" className="px-4 pb-5 pt-4 space-y-5 m-0">

              {/* Canonical URL */}
              <div className="space-y-1.5">
                <Label htmlFor="seo-canonical">Canonical URL</Label>
                <Input
                  id="seo-canonical"
                  value={values.canonicalUrl}
                  onChange={(e) => set("canonicalUrl", e.target.value)}
                  placeholder="https://..."
                  type="url"
                />
                <p className="text-xs text-muted-foreground">
                  Kosongkan untuk canonical otomatis dari URL halaman.
                </p>
              </div>

              {/* Robots */}
              <div className="space-y-1.5">
                <Label>Robots</Label>
                <SimpleCombobox
                  value={values.robots}
                  options={ROBOTS_OPTIONS}
                  onChange={(v) => set("robots", v)}
                />
              </div>

              {/* Schema Type */}
              <div className="space-y-1.5">
                <Label>Schema Type</Label>
                {contentType === "product" ? (
                  <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted/50 px-3 text-sm text-muted-foreground cursor-not-allowed">
                    Product (tetap)
                  </div>
                ) : (
                  <SimpleCombobox
                    value={values.schemaType}
                    options={schemaOptions as { value: string; label: string }[]}
                    onChange={(v) => set("schemaType", v)}
                  />
                )}
              </div>

              {/* Custom JSON-LD */}
              <div className="space-y-1.5">
                <Label htmlFor="seo-json-ld">Custom JSON-LD</Label>
                <Textarea
                  id="seo-json-ld"
                  value={values.structuredData}
                  onChange={(e) => set("structuredData", e.target.value)}
                  placeholder={`{\n  "@context": "https://schema.org",\n  "@type": "Article"\n}`}
                  rows={6}
                  className="font-mono text-xs resize-y"
                  spellCheck={false}
                />
                <p className="text-xs text-muted-foreground">
                  Override JSON-LD otomatis. Kosongkan untuk menggunakan generator bawaan.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
