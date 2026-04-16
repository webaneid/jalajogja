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
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TiptapEditor } from "@/components/editor/tiptap-editor";
import { MediaPicker, type MediaItem } from "@/components/media/media-picker";
import { SeoPanel } from "@/components/seo/seo-panel";
import type { SeoValues } from "@/components/seo/seo-panel";
import {
  createEventAction,
  updateEventAction,
  deleteEventAction,
  type EventData,
  type TicketInput,
} from "@/app/(dashboard)/[tenant]/event/actions";
import {
  ChevronLeft, Check, ChevronsUpDown, ImageIcon, Plus, Trash2, ChevronDown, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type CoverImage = { id: string; url: string } | null;
type CategoryOption = { id: string; name: string };

type TicketLocal = TicketInput & {
  _key:      string;    // React key lokal
  _expanded: boolean;   // UI: expand/collapse detail tiket
  _isGratis: boolean;   // UI: toggle Gratis/Berbayar — jika true price=0 dan input harga tersembunyi
};

export type EventFormProps = {
  slug:    string;
  eventId: string | null;
  categories: CategoryOption[];
  initialData: {
    slug:             string;
    title:            string;
    description:      string;
    categoryId:       string | null;
    eventType:        "offline" | "online" | "hybrid";
    status:           "draft" | "published" | "cancelled" | "completed";
    startsAt:         string | null;
    endsAt:           string | null;
    location:         string;
    locationDetail:   string;
    mapsUrl:          string;
    onlineLink:       string;
    organizerName:    string;
    maxCapacity:      number | null;
    showAttendeeList: boolean;
    showTicketCount:  boolean;
    requireApproval:  boolean;
    coverId:          string | null;
    coverUrl:         string | null;
    tickets: Array<{
      id?:          string;
      name:         string;
      description?: string;
      price:        number;
      quota?:       number | null;
      isActive:     boolean;
      saleStartsAt?: string | null;
      saleEndsAt?:   string | null;
      sortOrder:    number;
    }>;
    seo: SeoValues;
  };
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft:     { label: "Draft",       variant: "secondary"   },
  published: { label: "Dipublikasi", variant: "default"     },
  cancelled: { label: "Dibatalkan",  variant: "destructive" },
  completed: { label: "Selesai",     variant: "outline"     },
};

const EVENT_TYPES = [
  { value: "offline", label: "Offline" },
  { value: "online",  label: "Online"  },
  { value: "hybrid",  label: "Hybrid"  },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toSlug(str: string) {
  return str
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

let _keyCounter = 0;
function nextKey() { return `t-${++_keyCounter}`; }

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
        <span className={cn(
          "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-4" : "translate-x-0"
        )} />
      </button>
    </div>
  );
}

// ─── EventForm ────────────────────────────────────────────────────────────────

export function EventForm({ slug, eventId, categories, initialData }: EventFormProps) {
  const router = useRouter();

  const [title,          setTitle]          = useState(initialData.title);
  const [eventSlug,      setEventSlug]      = useState(initialData.slug);
  const [description,    setDescription]    = useState(initialData.description);
  const [categoryId,     setCategoryId]     = useState<string | null>(initialData.categoryId);
  const [eventType,      setEventType]      = useState<EventData["eventType"]>(initialData.eventType);
  const [status,         setStatus]         = useState<EventData["status"]>(initialData.status);
  const [startsAt,       setStartsAt]       = useState(initialData.startsAt  ?? "");
  const [endsAt,         setEndsAt]         = useState(initialData.endsAt    ?? "");
  const [location,       setLocation]       = useState(initialData.location);
  const [locationDetail, setLocationDetail] = useState(initialData.locationDetail);
  const [mapsUrl,        setMapsUrl]        = useState(initialData.mapsUrl);
  const [onlineLink,     setOnlineLink]     = useState(initialData.onlineLink);
  const [organizerName,  setOrganizerName]  = useState(initialData.organizerName);
  const [maxCapacity,    setMaxCapacity]    = useState(
    initialData.maxCapacity != null ? String(initialData.maxCapacity) : ""
  );
  const [showAttendeeList, setShowAttendeeList] = useState(initialData.showAttendeeList);
  const [showTicketCount,  setShowTicketCount]  = useState(initialData.showTicketCount);
  const [requireApproval,  setRequireApproval]  = useState(initialData.requireApproval);
  const [cover,    setCover]    = useState<CoverImage>(
    initialData.coverId && initialData.coverUrl
      ? { id: initialData.coverId, url: initialData.coverUrl }
      : null
  );
  const [tickets,     setTickets]     = useState<TicketLocal[]>(
    initialData.tickets.map((t) => ({
      ...t,
      id:           t.id ?? null,
      description:  t.description ?? "",
      quota:        t.quota ?? null,
      saleStartsAt: t.saleStartsAt ?? null,
      saleEndsAt:   t.saleEndsAt   ?? null,
      _key:         nextKey(),
      _expanded:    false,
      _isGratis:    (t.price ?? 0) === 0,
    }))
  );
  const [seo,         setSeo]         = useState<SeoValues>(initialData.seo);
  const [error,       setError]       = useState<string | null>(null);
  const [catOpen,     setCatOpen]     = useState(false);
  const [pickerOpen,  setPickerOpen]  = useState(false);
  const [slugEdited,  setSlugEdited]  = useState(false);

  const [isSaving,   startSaving]   = useTransition();
  const [isDeleting, startDeleting] = useTransition();

  const st = STATUS_MAP[status] ?? { label: status, variant: "outline" as const };
  const showLocation  = eventType === "offline" || eventType === "hybrid";
  const showOnlineLink = eventType === "online" || eventType === "hybrid";

  function handleTitleChange(val: string) {
    setTitle(val);
    if (!slugEdited) setEventSlug(toSlug(val));
  }

  function handleSlugChange(val: string) {
    setSlugEdited(true);
    setEventSlug(toSlug(val));
  }

  function handleCoverSelect(media: MediaItem) {
    setCover({ id: media.id, url: media.url });
    setPickerOpen(false);
  }

  // ── TicketManager helpers ──

  function addTicket() {
    const order = tickets.length;
    setTickets((prev) => [
      ...prev,
      {
        _key:         nextKey(),
        _expanded:    true,
        _isGratis:    true,
        id:           null,
        name:         "Tiket Baru",
        description:  "",
        price:        0,
        quota:        null,
        isActive:     true,
        saleStartsAt: null,
        saleEndsAt:   null,
        sortOrder:    order,
      },
    ]);
  }

  function updateTicket(key: string, patch: Partial<TicketLocal>) {
    setTickets((prev) => prev.map((t) => t._key === key ? { ...t, ...patch } : t));
  }

  function removeTicket(key: string) {
    setTickets((prev) => prev.filter((t) => t._key !== key));
  }

  function toggleTicket(key: string) {
    setTickets((prev) => prev.map((t) => t._key === key ? { ...t, _expanded: !t._expanded } : t));
  }

  // ── Build payload ──

  function buildData(): EventData {
    const cap = maxCapacity.trim() !== "" ? parseInt(maxCapacity) : null;
    return {
      slug:             eventSlug.trim() || toSlug(title),
      title:            title.trim(),
      description:      description || null,
      categoryId:       categoryId ?? null,
      eventType,
      status,
      startsAt:         startsAt  || null,
      endsAt:           endsAt    || null,
      location:         showLocation   ? location.trim()       || null : null,
      locationDetail:   showLocation   ? locationDetail.trim() || null : null,
      mapsUrl:          showLocation   ? mapsUrl.trim()        || null : null,
      onlineLink:       showOnlineLink ? onlineLink.trim()      || null : null,
      organizerName:    organizerName.trim()   || null,
      maxCapacity:      cap && !isNaN(cap)     ? cap             : null,
      showAttendeeList,
      showTicketCount,
      requireApproval,
      coverId:          cover?.id ?? null,
      tickets: tickets.map((t, i) => ({
        id:           t.id ?? undefined,
        name:         t.name.trim() || "Tiket",
        description:  t.description?.trim() || null,
        price:        isNaN(t.price) ? 0 : t.price,
        quota:        t.quota,
        isActive:     t.isActive,
        saleStartsAt: t.saleStartsAt || null,
        saleEndsAt:   t.saleEndsAt   || null,
        sortOrder:    i,
      })),
      metaTitle:     seo.metaTitle     || null,
      metaDesc:      seo.metaDesc      || null,
      ogTitle:       seo.ogTitle       || null,
      ogDescription: seo.ogDescription || null,
      ogImageId:     seo.ogImageId     ?? null,
      twitterCard:   seo.twitterCard   as "summary" | "summary_large_image" | null,
      focusKeyword:  seo.focusKeyword  || null,
      canonicalUrl:  seo.canonicalUrl  || null,
      robots:        seo.robots        as EventData["robots"],
      schemaType:    seo.schemaType    || "Event",
    };
  }

  function handleSave(targetStatus?: EventData["status"]) {
    setError(null);
    const data = buildData();
    if (targetStatus) data.status = targetStatus;

    startSaving(async () => {
      if (eventId === null) {
        const res = await createEventAction(slug, data);
        if (res.success) {
          router.push(`/${slug}/event/acara/${res.data.eventId}/edit`);
        } else {
          setError(res.error);
        }
      } else {
        const res = await updateEventAction(slug, eventId, data);
        if (res.success) {
          if (targetStatus) setStatus(targetStatus);
        } else {
          setError(res.error);
        }
      }
    });
  }

  function handleDelete() {
    if (!eventId) return;
    if (!confirm("Hapus event ini? Aksi ini tidak bisa dibatalkan.")) return;
    startDeleting(async () => {
      const res = await deleteEventAction(slug, eventId);
      if (res.success) {
        router.push(`/${slug}/event/acara`);
      } else {
        setError(res.error);
      }
    });
  }

  // Status-based button labels
  const saveLabel  = isSaving ? "Menyimpan..." :
    status === "draft" ? "Simpan Draft" :
    status === "published" ? "Simpan Perubahan" :
    "Simpan";
  const pubLabel   = status === "published" ? "Selesaikan" : "Publikasikan";
  const pubStatus: EventData["status"] = status === "published" ? "completed" : "published";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link
            href={`/${slug}/event/acara`}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Acara
          </Link>
          <Badge variant={st.variant}>{st.label}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {eventId && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={handleDelete}
              disabled={isDeleting || isSaving}
            >
              {isDeleting ? "..." : "Hapus"}
            </Button>
          )}
          {status !== "cancelled" && status !== "completed" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSave("cancelled")}
              disabled={isSaving}
            >
              Batalkan
            </Button>
          )}
          {(status === "cancelled" || status === "completed") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSave("draft")}
              disabled={isSaving}
            >
              Jadikan Draft
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSave()}
            disabled={isSaving || isDeleting}
          >
            {saveLabel}
          </Button>
          {status !== "cancelled" && status !== "completed" && (
            <Button
              size="sm"
              onClick={() => handleSave(pubStatus)}
              disabled={isSaving || isDeleting}
            >
              {pubLabel}
            </Button>
          )}
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

          {/* Judul */}
          <div className="space-y-2">
            <Label htmlFor="title">Judul Event</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Misal: Halal Bihalal IKPM 2025"
              className="text-lg font-medium h-12"
            />
          </div>

          {/* Slug */}
          <div className="space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              value={eventSlug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="halal-bihalal-ikpm-2025"
              className="font-mono text-sm"
            />
          </div>

          {/* Detail Event */}
          <div className="space-y-4 rounded-lg border border-border p-4">
            <p className="text-sm font-semibold">Detail Event</p>

            {/* Jenis event */}
            <div className="space-y-2">
              <Label>Jenis Event</Label>
              <div className="flex gap-2">
                {EVENT_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setEventType(t.value)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-sm border transition-colors",
                      eventType === t.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Waktu */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startsAt">Waktu Mulai</Label>
                <Input
                  id="startsAt"
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endsAt">Waktu Selesai</Label>
                <Input
                  id="endsAt"
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                />
              </div>
            </div>

            {/* Lokasi (offline/hybrid) */}
            {showLocation && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="location">Nama Tempat / Venue</Label>
                  <Input
                    id="location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Misal: Aula Masjid Besar, Balai Desa"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="locationDetail">Alamat Lengkap</Label>
                  <Input
                    id="locationDetail"
                    value={locationDetail}
                    onChange={(e) => setLocationDetail(e.target.value)}
                    placeholder="Jl. Kaliurang No. 10, Sleman, Yogyakarta"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mapsUrl">Link Google Maps <span className="text-muted-foreground font-normal">(opsional)</span></Label>
                  <Input
                    id="mapsUrl"
                    type="url"
                    value={mapsUrl}
                    onChange={(e) => setMapsUrl(e.target.value)}
                    placeholder="https://maps.app.goo.gl/..."
                  />
                </div>
              </>
            )}

            {/* Link online (online/hybrid) */}
            {showOnlineLink && (
              <div className="space-y-2">
                <Label htmlFor="onlineLink">Link Online (Zoom / Meet / dll)</Label>
                <Input
                  id="onlineLink"
                  type="url"
                  value={onlineLink}
                  onChange={(e) => setOnlineLink(e.target.value)}
                  placeholder="https://zoom.us/j/..."
                />
              </div>
            )}

            {/* Penyelenggara */}
            <div className="space-y-2">
              <Label htmlFor="organizerName">Penyelenggara</Label>
              <Input
                id="organizerName"
                value={organizerName}
                onChange={(e) => setOrganizerName(e.target.value)}
                placeholder="Misal: Departemen Sosial IKPM Yogyakarta"
              />
            </div>

            {/* Kapasitas */}
            <div className="space-y-2">
              <Label htmlFor="maxCapacity">Kapasitas Maksimal</Label>
              <Input
                id="maxCapacity"
                type="number"
                min={1}
                value={maxCapacity}
                onChange={(e) => setMaxCapacity(e.target.value)}
                placeholder="Kosongkan jika tidak terbatas"
              />
            </div>
          </div>

          {/* Deskripsi */}
          <div className="space-y-2">
            <Label>Deskripsi</Label>
            <TiptapEditor
              slug={slug}
              content={description}
              onChange={setDescription}
            />
          </div>

          {/* Pengaturan tampilan */}
          <div className="space-y-3 rounded-lg border border-border p-4">
            <p className="text-sm font-semibold">Pengaturan Tampilan</p>
            <ToggleRow
              label="Tampilkan daftar peserta"
              checked={showAttendeeList}
              onChange={setShowAttendeeList}
            />
            <ToggleRow
              label="Tampilkan sisa kuota tiket"
              checked={showTicketCount}
              onChange={setShowTicketCount}
            />
            <ToggleRow
              label="Pendaftaran perlu persetujuan admin"
              checked={requireApproval}
              onChange={setRequireApproval}
            />
          </div>

          {/* TicketManager */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Tiket ({tickets.length})</p>
              <button
                type="button"
                onClick={addTicket}
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <Plus className="h-4 w-4" />
                Tambah Tiket
              </button>
            </div>

            {tickets.length === 0 && (
              <div className="rounded-lg border-2 border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                Belum ada tiket. Tambahkan tiket untuk event ini.
              </div>
            )}

            <div className="space-y-2">
              {tickets.map((ticket) => (
                <div key={ticket._key} className="rounded-lg border border-border overflow-hidden">
                  {/* Ticket header */}
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors"
                    onClick={() => toggleTicket(ticket._key)}
                  >
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-sm">{ticket.name || "Tiket"}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {ticket.price === 0 ? "Gratis" : `Rp ${ticket.price.toLocaleString("id-ID")}`}
                        {ticket.quota != null ? ` · Kuota ${ticket.quota}` : " · Tidak terbatas"}
                      </span>
                    </div>
                    {!ticket.isActive && (
                      <Badge variant="outline" className="text-xs">Nonaktif</Badge>
                    )}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeTicket(ticket._key); }}
                      className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    {ticket._expanded
                      ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    }
                  </div>

                  {/* Ticket detail */}
                  {ticket._expanded && (
                    <div className="px-4 pb-4 pt-1 border-t border-border space-y-3 bg-muted/5">
                      {/* Nama tiket */}
                      <div className="space-y-1.5">
                        <Label className="text-xs">Nama Tiket</Label>
                        <Input
                          value={ticket.name}
                          onChange={(e) => updateTicket(ticket._key, { name: e.target.value })}
                          placeholder="Tiket Umum"
                          className="h-8 text-sm"
                        />
                      </div>

                      {/* Toggle Gratis / Berbayar */}
                      <div className="space-y-2">
                        <Label className="text-xs">Harga Tiket</Label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => updateTicket(ticket._key, { _isGratis: true, price: 0 })}
                            className={cn(
                              "flex-1 rounded-md border py-1.5 text-xs font-medium transition-colors",
                              ticket._isGratis
                                ? "bg-primary text-primary-foreground border-primary"
                                : "border-border text-muted-foreground hover:border-primary/50"
                            )}
                          >
                            Gratis
                          </button>
                          <button
                            type="button"
                            onClick={() => updateTicket(ticket._key, { _isGratis: false })}
                            className={cn(
                              "flex-1 rounded-md border py-1.5 text-xs font-medium transition-colors",
                              !ticket._isGratis
                                ? "bg-primary text-primary-foreground border-primary"
                                : "border-border text-muted-foreground hover:border-primary/50"
                            )}
                          >
                            Berbayar
                          </button>
                        </div>
                        {!ticket._isGratis && (
                          <div className="relative">
                            <span className="absolute left-2.5 top-2 text-xs text-muted-foreground">Rp</span>
                            <Input
                              type="number"
                              min={1}
                              value={ticket.price || ""}
                              onChange={(e) => updateTicket(ticket._key, { price: parseInt(e.target.value) || 0 })}
                              placeholder="Masukkan harga"
                              className="h-8 text-sm pl-7"
                            />
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Kuota (kosong = tidak terbatas)</Label>
                          <Input
                            type="number"
                            min={1}
                            value={ticket.quota ?? ""}
                            onChange={(e) => updateTicket(ticket._key, {
                              quota: e.target.value ? parseInt(e.target.value) : null
                            })}
                            placeholder="∞"
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Deskripsi</Label>
                          <Input
                            value={ticket.description ?? ""}
                            onChange={(e) => updateTicket(ticket._key, { description: e.target.value })}
                            placeholder="Opsional"
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Mulai Dijual</Label>
                          <Input
                            type="datetime-local"
                            value={ticket.saleStartsAt ?? ""}
                            onChange={(e) => updateTicket(ticket._key, { saleStartsAt: e.target.value || null })}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Berhenti Dijual</Label>
                          <Input
                            type="datetime-local"
                            value={ticket.saleEndsAt ?? ""}
                            onChange={(e) => updateTicket(ticket._key, { saleEndsAt: e.target.value || null })}
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>

                      <ToggleRow
                        label="Tiket aktif (tersedia untuk dibeli)"
                        checked={ticket.isActive}
                        onChange={(v) => updateTicket(ticket._key, { isActive: v })}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* SEO */}
          <SeoPanel
            slug={slug}
            contentType="event"
            title={title}
            content={description ?? ""}
            values={seo}
            onChange={setSeo}
          />
        </div>

        {/* Sidebar */}
        <aside className="w-72 shrink-0 border-l border-border overflow-y-auto p-4 space-y-5 bg-muted/10">
          {/* Kategori Event */}
          <div className="space-y-2">
            <Label>Kategori</Label>
            <Popover open={catOpen} onOpenChange={setCatOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
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

          {/* Cover Image */}
          <div className="space-y-2">
            <Label>Gambar Cover</Label>
            {cover ? (
              <div className="space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cover.url}
                  alt="Cover event"
                  className="w-full aspect-video rounded-md object-cover border border-border"
                />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setPickerOpen(true)}>
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
        </aside>
      </div>
    </div>
  );
}
