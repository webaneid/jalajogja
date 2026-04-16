"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TiptapEditor } from "@/components/editor/tiptap-editor";
import { MediaPicker, type MediaItem } from "@/components/media/media-picker";
import {
  createCampaignAction,
  updateCampaignAction,
  toggleCampaignStatusAction,
  deleteCampaignAction,
  type CampaignData,
} from "@/app/(dashboard)/[tenant]/donasi/actions";
import {
  ChevronLeft,
  Check,
  ChevronsUpDown,
  Trash2,
  ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type CoverImage = { id: string; url: string } | null;

type CategoryOption = { id: string; name: string };

export type CampaignFormProps = {
  slug:       string;
  campaignId: string | null; // null = create mode
  categories: CategoryOption[];
  initialData: {
    slug:          string;
    title:         string;
    description:   string;
    categoryId:    string | null;
    campaignType:  "donasi" | "zakat" | "wakaf" | "qurban";
    targetAmount:  number | null;
    coverId:       string | null;
    coverUrl:      string | null;
    status:        "draft" | "active" | "closed" | "archived";
    startsAt:      string | null;
    endsAt:        string | null;
    showDonorList: boolean;
    showAmount:    boolean;
  };
};

// ─── Constants ────────────────────────────────────────────────────────────────

const CAMPAIGN_TYPES = [
  { value: "donasi", label: "Donasi Umum"  },
  { value: "zakat",  label: "Zakat"        },
  { value: "wakaf",  label: "Wakaf"        },
  { value: "qurban", label: "Qurban"       },
] as const;

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft:    { label: "Draft",    variant: "secondary" },
  active:   { label: "Aktif",   variant: "default"   },
  closed:   { label: "Ditutup", variant: "outline"   },
  archived: { label: "Arsip",   variant: "outline"   },
};

const NEXT_STATUS_LABEL: Record<string, string> = {
  draft:    "Aktifkan",
  active:   "Tutup",
  closed:   "Arsipkan",
  archived: "Jadikan Draft",
};

// ─── Slugify (lokal, bukan dari server action) ────────────────────────────────

function toSlug(str: string) {
  return str
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// ─── ToggleRow ────────────────────────────────────────────────────────────────

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
          checked ? "bg-primary" : "bg-input"
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-4" : "translate-x-0"
          )}
        />
      </button>
    </div>
  );
}

// ─── CampaignForm ─────────────────────────────────────────────────────────────

export function CampaignForm({ slug, campaignId, categories, initialData }: CampaignFormProps) {
  const router = useRouter();

  const [title,         setTitle]         = useState(initialData.title);
  const [campaignSlug,  setSlug]          = useState(initialData.slug);
  const [description,   setDescription]   = useState(initialData.description);
  const [categoryId,    setCategoryId]    = useState<string | null>(initialData.categoryId);
  const [campaignType,  setCampaignType]  = useState<CampaignData["campaignType"]>(initialData.campaignType);
  const [targetAmount,  setTargetAmount]  = useState(initialData.targetAmount != null ? String(initialData.targetAmount) : "");
  const [startsAt,      setStartsAt]      = useState(initialData.startsAt ?? "");
  const [endsAt,        setEndsAt]        = useState(initialData.endsAt   ?? "");
  const [showDonorList, setShowDonorList] = useState(initialData.showDonorList);
  const [showAmount,    setShowAmount]    = useState(initialData.showAmount);
  const [cover,         setCover]         = useState<CoverImage>(
    initialData.coverId && initialData.coverUrl
      ? { id: initialData.coverId, url: initialData.coverUrl }
      : null
  );
  const [status,      setStatus]      = useState(initialData.status);
  const [error,       setError]       = useState<string | null>(null);
  const [typeOpen,    setTypeOpen]    = useState(false);
  const [catOpen,     setCatOpen]     = useState(false);
  const [pickerOpen,  setPickerOpen]  = useState(false);
  const [slugEdited,  setSlugEdited]  = useState(false);

  const [isSaving,   startSaving]   = useTransition();
  const [isToggling, startToggling] = useTransition();
  const [isDeleting, startDeleting] = useTransition();

  const st = STATUS_MAP[status] ?? { label: status, variant: "outline" as const };

  function handleTitleChange(val: string) {
    setTitle(val);
    if (!slugEdited) setSlug(toSlug(val));
  }

  function handleSlugChange(val: string) {
    setSlugEdited(true);
    setSlug(toSlug(val));
  }

  function handleCoverSelect(media: MediaItem) {
    setCover({ id: media.id, url: media.url });
    setPickerOpen(false);
  }

  function buildData(): CampaignData {
    const target = targetAmount.trim() !== "" ? parseFloat(targetAmount) : null;
    return {
      slug:          campaignSlug.trim() || toSlug(title),
      title:         title.trim(),
      description:   description || null,
      categoryId:    categoryId ?? null,
      campaignType,
      targetAmount:  target && !isNaN(target) ? target : null,
      coverId:       cover?.id ?? null,
      status,
      startsAt:      startsAt ? new Date(startsAt) : null,
      endsAt:        endsAt   ? new Date(endsAt)   : null,
      showDonorList,
      showAmount,
    };
  }

  function handleSave() {
    setError(null);
    startSaving(async () => {
      if (campaignId === null) {
        const res = await createCampaignAction(slug, buildData());
        if (res.success) {
          router.push(`/${slug}/donasi/campaign/${res.data.campaignId}/edit`);
        } else {
          setError(res.error);
        }
      } else {
        const res = await updateCampaignAction(slug, campaignId, buildData());
        if (!res.success) setError(res.error);
      }
    });
  }

  function handleToggleStatus() {
    if (!campaignId) return;
    startToggling(async () => {
      const res = await toggleCampaignStatusAction(slug, campaignId);
      if (res.success) setStatus(res.data.newStatus as typeof status);
    });
  }

  function handleDelete() {
    if (!campaignId) return;
    if (!confirm("Hapus campaign ini? Aksi ini tidak bisa dibatalkan.")) return;
    startDeleting(async () => {
      const res = await deleteCampaignAction(slug, campaignId);
      if (res.success) {
        router.push(`/${slug}/donasi/campaign`);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link
            href={`/${slug}/donasi/campaign`}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Campaign
          </Link>
          <Badge variant={st.variant}>{st.label}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {campaignId && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleStatus}
              disabled={isToggling || isSaving}
            >
              {isToggling ? "..." : NEXT_STATUS_LABEL[status] ?? "Ubah Status"}
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving || isToggling}
          >
            {isSaving ? "Menyimpan..." : campaignId ? "Simpan" : "Buat Campaign"}
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="title">Judul Campaign</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Misal: Donasi Renovasi Masjid 2025"
              className="text-lg font-medium h-12"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              value={campaignSlug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="donasi-renovasi-masjid-2025"
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label>Deskripsi</Label>
            <TiptapEditor
              slug={slug}
              content={description}
              onChange={setDescription}
            />
          </div>
        </div>

        {/* Sidebar */}
        <aside className="w-72 shrink-0 border-l border-border overflow-y-auto p-4 space-y-5 bg-muted/10">
            {/* Kategori Campaign — Combobox */}
          <div className="space-y-2">
            <Label>Kategori</Label>
            <Popover open={catOpen} onOpenChange={setCatOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal"
                >
                  {categoryId
                    ? (categories.find((c) => c.id === categoryId)?.name ?? "Pilih kategori")
                    : <span className="text-muted-foreground">Pilih kategori</span>
                  }
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

          {/* Jenis Campaign — Combobox */}
          <div className="space-y-2">
            <Label>Jenis</Label>
            <Popover open={typeOpen} onOpenChange={setTypeOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal"
                >
                  {CAMPAIGN_TYPES.find((t) => t.value === campaignType)?.label ?? "Pilih jenis"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[220px] p-0">
                <Command>
                  <CommandInput placeholder="Cari jenis..." />
                  <CommandList>
                    <CommandEmpty>Tidak ditemukan</CommandEmpty>
                    <CommandGroup>
                      {CAMPAIGN_TYPES.map((t) => (
                        <CommandItem
                          key={t.value}
                          value={t.value}
                          onSelect={() => {
                            setCampaignType(t.value);
                            setTypeOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              campaignType === t.value ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {t.label}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <Separator />

          {/* Gambar Cover — MediaPicker */}
          <div className="space-y-2">
            <Label>Gambar Cover</Label>
            {cover ? (
              <div className="space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cover.url}
                  alt="Cover campaign"
                  className="w-full aspect-video rounded-md object-cover border border-border"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setPickerOpen(true)}
                  >
                    Ganti
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-destructive hover:text-destructive"
                    onClick={() => setCover(null)}
                  >
                    Hapus
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="w-full aspect-video rounded-md border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 hover:border-primary/50 transition-colors"
              >
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Pilih gambar cover</span>
              </button>
            )}
            <MediaPicker
              slug={slug}
              open={pickerOpen}
              onClose={() => setPickerOpen(false)}
              onSelect={handleCoverSelect}
              accept={["image/"]}
            />
          </div>

          <Separator />

          {/* Target & Periode */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="targetAmount">Target Nominal (opsional)</Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-sm text-muted-foreground">Rp</span>
                <Input
                  id="targetAmount"
                  type="number"
                  min={0}
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  placeholder="0"
                  className="pl-9"
                />
              </div>
              <p className="text-xs text-muted-foreground">Kosongkan jika tanpa target</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="startsAt">Tanggal Mulai</Label>
              <Input
                id="startsAt"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endsAt">Tanggal Berakhir</Label>
              <Input
                id="endsAt"
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Kosongkan jika tanpa deadline</p>
            </div>
          </div>

          <Separator />

          {/* Tampilan Publik */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Tampilan Publik
            </p>
            <ToggleRow
              label="Tampilkan daftar donatur"
              checked={showDonorList}
              onChange={setShowDonorList}
            />
            <ToggleRow
              label="Tampilkan jumlah terkumpul"
              checked={showAmount}
              onChange={setShowAmount}
            />
          </div>

          {campaignId && (
            <>
              <Separator />
              <Button
                variant="outline"
                size="sm"
                className="w-full text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                {isDeleting ? "Menghapus..." : "Hapus Campaign"}
              </Button>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
