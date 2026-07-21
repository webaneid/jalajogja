"use client";

import { useState, useTransition } from "react";
import { Pencil, RotateCcw, ImagePlus, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { MediaPicker, type MediaItem } from "@/components/media/media-picker";
import {
  saveSeoPageOverrideAction,
  resetSeoPageOverrideAction,
} from "@/app/(dashboard)/app/[tenant]/settings/actions";
import type { SeoPageKey } from "@/lib/seo-page-keys";

// ─── Types ────────────────────────────────────────────────────────────────────

type OverrideRow = {
  metaTitle:     string | null;
  metaDesc:      string | null;
  ogTitle:       string | null;
  ogDescription: string | null;
  ogImageId:     string | null;
  ogImageUrl:    string | null;
  robots:        string | null;
};

type Entry = {
  key:      SeoPageKey;
  label:    string;
  group:    string;
  path:     string;
  override: OverrideRow | null;
};

type Props = {
  slug:    string;
  entries: Entry[];
};

const ROBOTS_OPTIONS = [
  { value: "index,follow",     label: "index, follow (default)" },
  { value: "noindex",          label: "noindex" },
  { value: "noindex,nofollow", label: "noindex, nofollow" },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export function SeoOverridesManageClient({ slug, entries: initialEntries }: Props) {
  const [entries, setEntries]   = useState(initialEntries);
  const [editingKey, setEditingKey] = useState<SeoPageKey | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const groups = [...new Set(entries.map(e => e.group))];
  const editingEntry = entries.find(e => e.key === editingKey) ?? null;

  function handleEdit(key: SeoPageKey) {
    setEditingKey(key);
    setDialogOpen(true);
  }

  function handleSaved(key: SeoPageKey, override: OverrideRow | null) {
    setEntries(prev => prev.map(e => (e.key === key ? { ...e, override } : e)));
    setDialogOpen(false);
  }

  return (
    <div className="space-y-6">
      {groups.map(group => (
        <section key={group} className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {group}
          </h3>
          <div className="rounded-lg border border-border divide-y divide-border">
            {entries.filter(e => e.group === group).map(entry => {
              const isCustomized = !!entry.override && Object.values(entry.override).some(v => v);
              return (
                <div key={entry.key} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{entry.label}</span>
                      {isCustomized ? (
                        <span className="text-xs text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded">
                          Dikustomisasi
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Pakai default</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {entry.override?.metaTitle || entry.path}
                    </p>
                  </div>
                  <a
                    href={entry.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                    title="Buka halaman"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <button
                    onClick={() => handleEdit(entry.key)}
                    className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                    title="Edit SEO"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {editingEntry && (
        <SeoOverrideDialog
          key={editingEntry.key}
          slug={slug}
          entry={editingEntry}
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

// ─── Dialog ───────────────────────────────────────────────────────────────────

function SeoOverrideDialog({
  slug,
  entry,
  open,
  onClose,
  onSaved,
}: {
  slug:    string;
  entry:   Entry;
  open:    boolean;
  onClose: () => void;
  onSaved: (key: SeoPageKey, override: OverrideRow | null) => void;
}) {
  const o = entry.override;

  const [metaTitle,     setMetaTitle]     = useState(o?.metaTitle ?? "");
  const [metaDesc,      setMetaDesc]      = useState(o?.metaDesc ?? "");
  const [ogTitle,       setOgTitle]       = useState(o?.ogTitle ?? "");
  const [ogDescription, setOgDescription] = useState(o?.ogDescription ?? "");
  const [ogImageId,     setOgImageId]     = useState<string | null>(o?.ogImageId ?? null);
  const [ogImageUrl,    setOgImageUrl]    = useState<string | null>(o?.ogImageUrl ?? null);
  const [robots,        setRobots]        = useState(o?.robots ?? "index,follow");
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [error,     setError]     = useState("");
  const [isPending, startTransition] = useTransition();

  const hasOverride = !!o && Object.values(o).some(v => v);

  function handleSave() {
    setError("");
    startTransition(async () => {
      const res = await saveSeoPageOverrideAction(slug, entry.key, {
        metaTitle, metaDesc, ogTitle, ogDescription, ogImageId,
        robots: robots as "index,follow" | "noindex" | "noindex,nofollow",
      });
      if (res.error) { setError(res.error); return; }
      onSaved(entry.key, {
        metaTitle:     metaTitle.trim()     || null,
        metaDesc:      metaDesc.trim()      || null,
        ogTitle:       ogTitle.trim()       || null,
        ogDescription: ogDescription.trim() || null,
        ogImageId, ogImageUrl,
        robots,
      });
    });
  }

  function handleReset() {
    setError("");
    startTransition(async () => {
      const res = await resetSeoPageOverrideAction(slug, entry.key);
      if (res.error) { setError(res.error); return; }
      onSaved(entry.key, null);
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>SEO — {entry.label}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Judul Halaman</Label>
            <Input
              value={metaTitle}
              onChange={(e) => setMetaTitle(e.target.value)}
              placeholder="Kosongkan untuk pakai judul bawaan"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Deskripsi</Label>
            <Textarea
              value={metaDesc}
              onChange={(e) => setMetaDesc(e.target.value)}
              placeholder="Deskripsi singkat untuk hasil pencarian"
              rows={2}
              className="resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Judul Open Graph <span className="text-muted-foreground">(opsional)</span></Label>
            <Input
              value={ogTitle}
              onChange={(e) => setOgTitle(e.target.value)}
              placeholder="Kosongkan untuk pakai Judul Halaman"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Deskripsi Open Graph <span className="text-muted-foreground">(opsional)</span></Label>
            <Textarea
              value={ogDescription}
              onChange={(e) => setOgDescription(e.target.value)}
              placeholder="Kosongkan untuk pakai Deskripsi"
              rows={2}
              className="resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Gambar Bagikan (OG Image)</Label>
            {ogImageUrl ? (
              <div className="space-y-2">
                <div className="relative rounded-md overflow-hidden border border-border aspect-[1.91/1] max-w-[280px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={ogImageUrl} alt="OG Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => { setOgImageId(null); setOgImageUrl(null); }}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60
                               flex items-center justify-center hover:bg-black/80 transition-colors"
                    title="Hapus gambar"
                  >
                    <X className="h-3.5 w-3.5 text-white" />
                  </button>
                </div>
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs px-2 text-muted-foreground"
                  onClick={() => setMediaPickerOpen(true)}>
                  Ganti gambar
                </Button>
              </div>
            ) : (
              <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => setMediaPickerOpen(true)}>
                <ImagePlus className="h-4 w-4" />
                Pilih Gambar
              </Button>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Robots</Label>
            <Combobox
              options={ROBOTS_OPTIONS}
              value={robots}
              onValueChange={(v) => setRobots(v as typeof robots)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          {hasOverride ? (
            <Button variant="ghost" onClick={handleReset} disabled={isPending} className="gap-1.5 text-muted-foreground">
              <RotateCcw className="h-3.5 w-3.5" />
              Reset ke Default
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={isPending}>Batal</Button>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </DialogFooter>

        <MediaPicker
          slug={slug}
          open={mediaPickerOpen}
          onClose={() => setMediaPickerOpen(false)}
          onSelect={(item: MediaItem) => {
            setOgImageId(item.id);
            setOgImageUrl(item.variants?.large ?? item.url);
          }}
          module="website"
          accept={["image/"]}
        />
      </DialogContent>
    </Dialog>
  );
}
