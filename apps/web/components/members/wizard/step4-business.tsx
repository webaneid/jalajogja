"use client"

import * as React from "react"
import {
  CheckIcon,
  ChevronsUpDownIcon,
  ImageIcon,
  PlusIcon,
  XIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { MediaPicker, type MediaItem } from "@/components/media/media-picker"

// Pure, client-safe — JANGAN import dari lib/image-processor.ts (bawa `sharp`, Node-only,
// merusak bundle client). Sama persis logika getVariantUrl() untuk swap suffix "_th".
function thumbUrl(url: string | null | undefined): string {
  if (!url) return ""
  if (url.endsWith(".svg") || url.startsWith("data:")) return url
  return url.replace(/_(ori|lg|md|th|sq|sql|pf)\.webp$/, "_th.webp")
}

// Fallback kalau variant thumbnail belum sempat generate (record lama) — pakai ukuran original.
function originalUrl(url: string): string {
  return url.replace(/_(ori|lg|md|th|sq|sql|pf)\.webp$/, "_ori.webp")
}
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { WilayahSelect, type WilayahValue } from "@/components/ui/wilayah-select"
import { SocialMediaInput, type SocialMediaValue } from "@/components/ui/social-media-input"
import { PhoneInput } from "@/components/ui/phone-input"
import { TagMultiSelect } from "@/components/ui/tag-multi-select"
import {
  LEGALITY_COMBOBOX_OPTIONS, POSITION_COMBOBOX_OPTIONS,
  EMPLOYEES_COMBOBOX_OPTIONS, BRANCHES_COMBOBOX_OPTIONS, REVENUE_COMBOBOX_OPTIONS,
} from "@/lib/business-form-options"
import {
  resolveCategoryOptions, resolveSectorOptions, resolveBusinessFieldSuggestions,
  resolveBusinessFieldSuggestionsStrict,
  resolveFieldLabel, EMPTY_TAXONOMY_OVERRIDES, type TaxonomyOverrides,
} from "@/lib/taxonomy-overrides"
import { ECOSYSTEM_TAG_SUGGESTIONS } from "@/lib/ecosystem-tags"
import {
  saveMemberBusinessesAction,
  type BusinessEntryData,
} from "@/app/(dashboard)/app/[tenant]/members/actions"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Step4Props {
  memberId: string
  slug: string
  onSuccess: () => void
  defaultEntries?: BusinessEntry[]
  // Label Kategori/Sektor/Bidang Usaha custom tenant — opsional, default = label kanonik
  // (docs/arsitektur-ekosistem.md § 10). Caller yang belum sempat di-update tetap kompatibel.
  taxonomyOverrides?: TaxonomyOverrides
  // Label custom nama modul "Usaha" (2026-08-07, /ekosistem/pengaturan) — opsional, default
  // "Usaha" (label kanonik).
  moduleLabel?: string
}

export interface BusinessEntry {
  id: string
  // Identitas
  name: string
  brand: string
  description: string
  // Klasifikasi
  category: string
  sector: string
  businessFields: string[]
  offeredTags: string[]
  neededTags: string[]
  legality: string
  position: string
  // Skala
  employees: string
  branches: string
  revenue: string
  // Alamat — kosong = Indonesia, terisi = nama negara luar negeri
  addressCountry: string
  provinceId: number | null
  regencyId: number | null
  districtId: number | null
  villageId: number | null
  addressDetail: string
  postalCode: string
  // Kontak
  phone: string
  whatsapp: string
  email: string
  // Sosial media
  instagram: string
  facebook: string
  linkedin: string
  twitter: string
  youtube: string
  tiktok: string
  website: string
  // Foto — URL langsung dari media library tenant (bukan FK)
  coverUrl: string
  logoUrl: string
}

// ─── Konstanta enum (mirror dari schema) ──────────────────────────────────────

// Kategori/Sektor/Legalitas/Posisi/Karyawan/Cabang/Omzet: diimpor dari lib/business-sectors.ts
// + lib/business-form-options.ts — jangan re-declare literal enum di sini.

// ─── Helper ───────────────────────────────────────────────────────────────────

function newEntry(): BusinessEntry {
  return {
    id: crypto.randomUUID(),
    name: "", brand: "", description: "",
    category: "", sector: "", businessFields: [], offeredTags: [], neededTags: [], legality: "", position: "",
    employees: "", branches: "", revenue: "",
    addressCountry: "",
    provinceId: null, regencyId: null, districtId: null, villageId: null,
    addressDetail: "", postalCode: "",
    phone: "", whatsapp: "", email: "",
    instagram: "", facebook: "", linkedin: "",
    twitter: "", youtube: "", tiktok: "", website: "",
    coverUrl: "", logoUrl: "",
  }
}

// ─── Sub-komponen: Photo Picker Field (reuse MediaPicker tenant-scoped) ──────

function PhotoPickerField({
  slug,
  label,
  value,
  onChange,
  shape = "square",
  disabled = false,
}: {
  slug: string
  label: string
  value: string
  onChange: (url: string) => void
  shape?: "square" | "wide"
  disabled?: boolean
}) {
  const [pickerOpen, setPickerOpen] = React.useState(false)
  const boxCls = shape === "square" ? "h-16 w-16" : "h-16 w-28"

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">
        {label} <span className="font-normal text-muted-foreground">(opsional)</span>
      </span>
      <div className="flex items-center gap-3">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shape === "wide" ? thumbUrl(value) : value}
            alt={label}
            className={cn("shrink-0 rounded-md border border-border object-cover", boxCls)}
            onError={(e) => {
              const fallback = originalUrl(value)
              if (e.currentTarget.src !== fallback) {
                e.currentTarget.onerror = null
                e.currentTarget.src = fallback
              }
            }}
          />
        ) : (
          <div className={cn(
            "flex shrink-0 items-center justify-center rounded-md border border-dashed border-muted-foreground/40 text-muted-foreground",
            boxCls
          )}>
            <ImageIcon className="size-5" />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => setPickerOpen(true)}
          >
            {value ? "Ganti Foto" : "Pilih Foto"}
          </Button>
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              disabled={disabled}
              className="text-left text-xs text-muted-foreground transition-colors hover:text-destructive disabled:pointer-events-none disabled:opacity-50"
            >
              Hapus
            </button>
          )}
        </div>
      </div>
      <MediaPicker
        slug={slug}
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(media: MediaItem) => { onChange(media.url); setPickerOpen(false) }}
        module="akun"
        accept={["image/"]}
      />
    </div>
  )
}

const inputCls =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"

// ─── Sub-komponen: Simple Combobox ───────────────────────────────────────────

function SimpleCombobox({
  label,
  placeholder,
  items,
  value,
  onSelect,
  disabled = false,
  required = false,
  optional = false,
  clearable = false,
}: {
  label: string
  placeholder: string
  items: { value: string; label: string }[]
  value: string
  onSelect: (value: string) => void
  disabled?: boolean
  required?: boolean
  optional?: boolean
  clearable?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const selected = items.find((i) => i.value === value)

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
        {optional && <span className="ml-1 font-normal text-muted-foreground">(opsional)</span>}
      </span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            disabled={disabled}
            className={cn("w-full justify-between font-normal", !selected && "text-muted-foreground")}
          >
            {selected?.label ?? placeholder}
            <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder={`Cari ${label.toLowerCase()}...`} />
            <CommandList>
              <CommandEmpty>Tidak ditemukan.</CommandEmpty>
              <CommandGroup>
                {clearable && (
                  <CommandItem
                    value="__clear__"
                    onSelect={() => { onSelect(""); setOpen(false) }}
                  >
                    <CheckIcon className={cn("mr-2 size-4", !value ? "opacity-100" : "opacity-0")} />
                    <span className="text-muted-foreground">Tidak dipilih</span>
                  </CommandItem>
                )}
                {items.map((item) => (
                  <CommandItem
                    key={item.value}
                    value={item.label}
                    onSelect={() => { onSelect(item.value); setOpen(false) }}
                  >
                    <CheckIcon className={cn("mr-2 size-4", value === item.value ? "opacity-100" : "opacity-0")} />
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}

// ─── Sub-komponen: satu BusinessCard ─────────────────────────────────────────

function BusinessCard({
  entry,
  index,
  canRemove,
  disabled,
  tenantSlug,
  taxonomyOverrides,
  moduleLabel,
  onChange,
  onWilayahChange,
  onRemove,
}: {
  entry: BusinessEntry
  index: number
  canRemove: boolean
  disabled: boolean
  tenantSlug: string
  taxonomyOverrides: TaxonomyOverrides
  moduleLabel: string
  onChange: <K extends keyof BusinessEntry>(field: K, value: BusinessEntry[K]) => void
  onWilayahChange: (val: WilayahValue) => void
  onRemove: () => void
}) {
  const [sameAsPhone, setSameAsPhone] = React.useState(false)
  // Mode alamat — derived dari entry.addressCountry, lokal untuk toggle UI
  const [addressMode, setAddressMode] = React.useState<"indonesia" | "overseas">(
    entry.addressCountry ? "overseas" : "indonesia"
  )

  function handlePhoneChange(val: string) {
    onChange("phone", val)
    if (sameAsPhone) onChange("whatsapp", val)
  }

  function handleSameAsPhone(checked: boolean) {
    setSameAsPhone(checked)
    if (checked) onChange("whatsapp", entry.phone)
  }

  function handleAddressModeChange(mode: "indonesia" | "overseas") {
    setAddressMode(mode)
    if (mode === "indonesia") {
      // Bersihkan negara saat kembali ke Indonesia
      onChange("addressCountry", "")
    } else {
      // Bersihkan wilayah Indonesia saat beralih ke luar negeri
      onChange("provinceId", null)
      onChange("regencyId",  null)
      onChange("districtId", null)
      onChange("villageId",  null)
    }
  }

  return (
    <div className="rounded-lg border bg-card p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{moduleLabel} #{index + 1}</span>
        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove || disabled}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-30"
        >
          <XIcon className="size-3.5" />
          Hapus
        </button>
      </div>

      {/* ── Foto ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <PhotoPickerField
          slug={tenantSlug}
          label="Logo Usaha *"
          value={entry.logoUrl}
          onChange={(url) => onChange("logoUrl", url)}
          disabled={disabled}
        />
        <PhotoPickerField
          slug={tenantSlug}
          label="Foto Sampul Usaha *"
          value={entry.coverUrl}
          onChange={(url) => onChange("coverUrl", url)}
          shape="wide"
          disabled={disabled}
        />
      </div>

      {/* ── Section 1: Identitas ── */}
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Identitas Usaha</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Nama Usaha<span className="text-destructive ml-0.5">*</span></span>
            <input
              type="text"
              value={entry.name}
              onChange={(e) => onChange("name", e.target.value)}
              placeholder="Nama legal usaha"
              disabled={disabled}
              className={inputCls}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">
              Merek / Brand <span className="font-normal text-muted-foreground">(opsional)</span>
            </span>
            <input
              type="text"
              value={entry.brand}
              onChange={(e) => onChange("brand", e.target.value)}
              placeholder="Nama merek jika berbeda"
              disabled={disabled}
              className={inputCls}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">
            Deskripsi<span className="text-destructive ml-0.5">*</span>
          </span>
          <textarea
            value={entry.description}
            onChange={(e) => onChange("description", e.target.value)}
            placeholder="Produk atau layanan yang ditawarkan..."
            rows={2}
            disabled={disabled}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
          />
        </div>
      </div>

      {/* ── Section 2: Klasifikasi ── */}
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Klasifikasi</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SimpleCombobox
            label={resolveFieldLabel("category", taxonomyOverrides)} required
            placeholder={`Pilih ${resolveFieldLabel("category", taxonomyOverrides).toLowerCase()}`}
            items={resolveCategoryOptions(taxonomyOverrides, entry.category)}
            value={entry.category}
            onSelect={(v) => onChange("category", v)}
            disabled={disabled}
          />
          <SimpleCombobox
            label={resolveFieldLabel("sector", taxonomyOverrides)} required
            placeholder={`Pilih ${resolveFieldLabel("sector", taxonomyOverrides).toLowerCase()}`}
            items={resolveSectorOptions(taxonomyOverrides, entry.sector)}
            value={entry.sector}
            onSelect={(v) => onChange("sector", v)}
            disabled={disabled}
          />
          <SimpleCombobox
            label="Legalitas" required
            placeholder="Pilih legalitas"
            items={LEGALITY_COMBOBOX_OPTIONS}
            value={entry.legality}
            onSelect={(v) => onChange("legality", v)}
            disabled={disabled}
          />
          <SimpleCombobox
            label="Posisi / Jabatan" required
            placeholder="Pilih posisi"
            items={POSITION_COMBOBOX_OPTIONS}
            value={entry.position}
            onSelect={(v) => onChange("position", v)}
            disabled={disabled}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">
            {resolveFieldLabel("businessFields", taxonomyOverrides)}<span className="text-destructive ml-0.5">*</span>
          </span>
          <TagMultiSelect
            options={resolveBusinessFieldSuggestionsStrict(entry.sector, taxonomyOverrides)}
            searchOptions={resolveBusinessFieldSuggestions(entry.sector, taxonomyOverrides)}
            value={entry.businessFields}
            onChange={(businessFields) => onChange("businessFields", businessFields)}
            disabled={disabled}
            placeholder="Ketik atau pilih bidang usaha, mis. Kaligrafi..."
          />
          <p className="text-xs text-muted-foreground">
            Boleh pilih lebih dari satu — daftar mengikuti sektor di atas, ketik untuk mencari
            bidang usaha dari sektor lain.
          </p>
        </div>
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">
              Menawarkan <span className="font-normal text-muted-foreground">(opsional)</span>
            </span>
            <TagMultiSelect
              options={ECOSYSTEM_TAG_SUGGESTIONS}
              value={entry.offeredTags}
              onChange={(offeredTags) => onChange("offeredTags", offeredTags)}
              disabled={disabled}
              placeholder="Apa yang bisa ditawarkan/disuplai?"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">
              Membutuhkan <span className="font-normal text-muted-foreground">(opsional)</span>
            </span>
            <TagMultiSelect
              options={ECOSYSTEM_TAG_SUGGESTIONS}
              value={entry.neededTags}
              onChange={(neededTags) => onChange("neededTags", neededTags)}
              disabled={disabled}
              placeholder="Apa yang sedang dicari/dibutuhkan?"
            />
          </div>
        </div>
      </div>

      {/* ── Section 3: Skala Usaha ── */}
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Skala Usaha</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SimpleCombobox
            label="Jumlah Karyawan" required
            placeholder="Pilih range"
            items={EMPLOYEES_COMBOBOX_OPTIONS}
            value={entry.employees}
            onSelect={(v) => onChange("employees", v)}
            disabled={disabled}
          />
          <SimpleCombobox
            label="Jumlah Cabang" required
            placeholder="Pilih range"
            items={BRANCHES_COMBOBOX_OPTIONS}
            value={entry.branches}
            onSelect={(v) => onChange("branches", v)}
            disabled={disabled}
          />
          <SimpleCombobox
            label="Omzet / Tahun" required
            placeholder="Pilih range"
            items={REVENUE_COMBOBOX_OPTIONS}
            value={entry.revenue}
            onSelect={(v) => onChange("revenue", v)}
            disabled={disabled}
          />
        </div>
      </div>

      {/* ── Section 4: Alamat Usaha ── */}
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Alamat Usaha</p>

        {/* Toggle: Indonesia / Luar Negeri */}
        <div className="flex gap-1 rounded-lg border border-input bg-muted p-1 w-fit">
          <button
            type="button"
            onClick={() => handleAddressModeChange("indonesia")}
            disabled={disabled}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              addressMode === "indonesia"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Indonesia
          </button>
          <button
            type="button"
            onClick={() => handleAddressModeChange("overseas")}
            disabled={disabled}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              addressMode === "overseas"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Luar Negeri
          </button>
        </div>

        {addressMode === "indonesia" ? (
          <WilayahSelect onChange={onWilayahChange} disabled={disabled} tenantSlug={tenantSlug} />
        ) : (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">
              Negara<span className="text-destructive ml-0.5">*</span>
            </span>
            <input
              type="text"
              value={entry.addressCountry}
              onChange={(e) => onChange("addressCountry", e.target.value)}
              placeholder="Contoh: Malaysia, Arab Saudi, Jepang"
              disabled={disabled}
              className={inputCls}
            />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">
            Detail Alamat <span className="font-normal text-muted-foreground">(opsional)</span>
          </span>
          <textarea
            value={entry.addressDetail}
            onChange={(e) => onChange("addressDetail", e.target.value)}
            placeholder="Nama jalan, nomor, RT/RW, gedung, lantai..."
            rows={2}
            disabled={disabled}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
          />
        </div>
        <div className="max-w-[160px]">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">
              Kode Pos <span className="font-normal text-muted-foreground">(opsional)</span>
            </span>
            <input
              type="text"
              value={entry.postalCode}
              onChange={(e) => onChange("postalCode", e.target.value)}
              placeholder="Contoh: 55283"
              maxLength={10}
              inputMode="numeric"
              disabled={disabled}
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {/* ── Section 5: Kontak Usaha ── */}
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Kontak Usaha</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Telepon */}
          <div>
            <PhoneInput
              label="Telepon"
              value={entry.phone}
              onChange={handlePhoneChange}
              optional
              disabled={disabled}
            />
          </div>
          {/* WhatsApp + checkbox */}
          <div className="flex flex-col gap-1.5">
            <PhoneInput
              label="WhatsApp *"
              value={sameAsPhone ? entry.phone : entry.whatsapp}
              onChange={(v) => { if (!sameAsPhone) onChange("whatsapp", v) }}
              disabled={disabled || sameAsPhone}
            />
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground select-none">
              <input
                type="checkbox"
                checked={sameAsPhone}
                onChange={(e) => handleSameAsPhone(e.target.checked)}
                disabled={disabled}
                className="rounded border-input"
              />
              Sama dengan nomor telepon di atas
            </label>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">
            Email <span className="font-normal text-muted-foreground">(opsional)</span>
          </span>
          <input
            type="email"
            value={entry.email}
            onChange={(e) => onChange("email", e.target.value)}
            placeholder="usaha@email.com"
            inputMode="email"
            disabled={disabled}
            className={inputCls}
          />
        </div>
      </div>

      {/* ── Section 6: Sosial Media ── */}
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sosial Media</p>
        <SocialMediaInput
          value={{ instagram: entry.instagram, facebook: entry.facebook, linkedin: entry.linkedin, twitter: entry.twitter, youtube: entry.youtube, tiktok: entry.tiktok, website: entry.website }}
          onChange={(v: SocialMediaValue) => {
            onChange("instagram", v.instagram); onChange("facebook",  v.facebook)
            onChange("linkedin",  v.linkedin);  onChange("twitter",   v.twitter)
            onChange("youtube",   v.youtube);   onChange("tiktok",    v.tiktok)
            onChange("website",   v.website)
          }}
          disabled={disabled}
        />
      </div>
    </div>
  )
}

// ─── Step 4: Data Usaha ───────────────────────────────────────────────────────

export function Step4Business({
  memberId, slug, onSuccess, defaultEntries,
  taxonomyOverrides = EMPTY_TAXONOMY_OVERRIDES,
  moduleLabel = "Usaha",
}: Step4Props) {
  const [entries, setEntries] = React.useState<BusinessEntry[]>(
    defaultEntries && defaultEntries.length > 0 ? defaultEntries : [newEntry()]
  )
  const [loading,    setLoading]    = React.useState(false)
  const [error,      setError]      = React.useState<string | null>(null)
  // ID entry yang sedang ditambah — null = tampilkan semua entry
  const [focusedId,  setFocusedId]  = React.useState<string | null>(
    defaultEntries && defaultEntries.length > 0 ? null : (entries[0]?.id ?? null)
  )

  function addEntry() {
    const entry = newEntry()
    setEntries((prev) => [...prev, entry])
    setFocusedId(entry.id)
  }

  function backToAll() {
    // Hapus entry yang masih kosong (belum diisi nama) sebelum kembali ke list
    setEntries((prev) => prev.filter((e) => e.id !== focusedId || e.name.trim() !== ""))
    setFocusedId(null)
  }

  function removeEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id))
    if (focusedId === id) setFocusedId(null)
  }

  function updateEntry<K extends keyof BusinessEntry>(
    id: string,
    field: K,
    value: BusinessEntry[K]
  ) {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e))
    )
  }

  function updateEntryWilayah(id: string, wilayah: WilayahValue) {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              provinceId: wilayah.provinceId ?? null,
              regencyId:  wilayah.regencyId  ?? null,
              districtId: wilayah.districtId ?? null,
              villageId:  wilayah.villageId  ?? null,
            }
          : e
      )
    )
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    // Validasi 11 field wajib untuk setiap entry usaha yang diisi
    for (let i = 0; i < entries.length; i++) {
      const item = entries[i];
      const prefix = entries.length > 1 ? `${moduleLabel} ke-${i + 1}: ` : "";

      if (!item.name.trim())                                          { setError(`${prefix}Nama usaha wajib diisi.`);                        return; }
      if (!item.category)                                             { setError(`${prefix}Kategori wajib dipilih.`);                         return; }
      if (!item.sector)                                               { setError(`${prefix}Sektor wajib dipilih.`);                           return; }
      if (!item.logoUrl)                                              { setError(`${prefix}Logo usaha wajib diunggah.`);                       return; }
      if (!item.coverUrl)                                             { setError(`${prefix}Foto sampul usaha wajib diunggah.`);               return; }
      if (!item.description?.trim())                                  { setError(`${prefix}Deskripsi usaha wajib diisi.`);                    return; }
      if (!item.legality)                                             { setError(`${prefix}Legalitas usaha wajib dipilih.`);                   return; }
      if (!item.position)                                             { setError(`${prefix}Posisi dan jabatan wajib dipilih.`);               return; }
      if (!item.businessFields || item.businessFields.length === 0)   { setError(`${prefix}Bidang usaha (minimal 1 tag) wajib dipilih.`);    return; }
      if (!item.employees)                                            { setError(`${prefix}Jumlah karyawan wajib dipilih.`);                   return; }
      if (!item.branches)                                             { setError(`${prefix}Jumlah cabang wajib dipilih.`);                    return; }
      if (!item.revenue)                                              { setError(`${prefix}Omzet usaha wajib dipilih.`);                       return; }
      if (item.addressCountry?.trim()) {
        // Overseas
      } else {
        if (!item.provinceId || !item.regencyId || !item.districtId) {
          setError(`${prefix}Alamat usaha wajib diisi minimal sampai tingkat Kecamatan.`); return;
        }
      }
      if (!item.whatsapp?.trim())                                     { setError(`${prefix}Nomor WhatsApp usaha wajib diisi.`);               return; }
    }

    setLoading(true)

    const payload: BusinessEntryData[] = entries.map((e) => ({
      name:        e.name,
      brand:       e.brand       || undefined,
      description: e.description || undefined,
      category:    e.category,
      sector:      e.sector,
      businessFields: e.businessFields.length > 0 ? e.businessFields : undefined,
      offeredTags: e.offeredTags.length > 0 ? e.offeredTags : undefined,
      neededTags:  e.neededTags.length  > 0 ? e.neededTags  : undefined,
      legality:    e.legality    || undefined,
      position:    e.position    || undefined,
      employees:   e.employees   || undefined,
      branches:    e.branches    || undefined,
      revenue:     e.revenue     || undefined,
      addressCountry:    e.addressCountry || undefined,
      addressProvinceId: e.provinceId ?? undefined,
      addressRegencyId:  e.regencyId  ?? undefined,
      addressDistrictId: e.districtId ?? undefined,
      addressVillageId:  e.villageId  ?? undefined,
      addressDetail:    e.addressDetail || undefined,
      addressPostalCode: e.postalCode   || undefined,
      phone:    e.phone    || undefined,
      whatsapp: e.whatsapp || undefined,
      email:    e.email    || undefined,
      instagram: e.instagram || undefined,
      facebook:  e.facebook  || undefined,
      linkedin:  e.linkedin  || undefined,
      twitter:   e.twitter   || undefined,
      youtube:   e.youtube   || undefined,
      tiktok:    e.tiktok    || undefined,
      website:   e.website   || undefined,
      coverUrl:  e.coverUrl  || undefined,
      logoUrl:   e.logoUrl   || undefined,
    }))

    const result = await saveMemberBusinessesAction(slug, memberId, payload)

    if (result.success) {
      onSuccess()
    } else {
      setError(result.error ?? "Gagal menyimpan.")
      setLoading(false)
    }
  }

  const visibleEntries = focusedId
    ? entries.filter((e) => e.id === focusedId)
    : entries

  return (
    <form
      id="wizard-step-4-form"
      onSubmit={handleSubmit}
      className="space-y-4"
    >
      {/* Navigasi kembali saat sedang fokus pada satu entry (ada usaha lain) */}
      {focusedId && entries.length > 1 && (
        <button
          type="button"
          onClick={backToAll}
          disabled={loading}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          ← Lihat semua {moduleLabel.toLowerCase()} ({entries.length})
        </button>
      )}

      {visibleEntries.map((entry) => (
        <BusinessCard
          key={entry.id}
          entry={entry}
          index={entries.indexOf(entry)}
          canRemove={entries.length > 1}
          disabled={loading}
          tenantSlug={slug}
          taxonomyOverrides={taxonomyOverrides}
          moduleLabel={moduleLabel}
          onChange={(field, value) => updateEntry(entry.id, field, value)}
          onWilayahChange={(val) => updateEntryWilayah(entry.id, val)}
          onRemove={() => removeEntry(entry.id)}
        />
      ))}

      {/* Tombol tambah — hanya tampil saat melihat semua entry */}
      {!focusedId && (
        <button
          type="button"
          onClick={addEntry}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-muted-foreground/40 py-3 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:pointer-events-none disabled:opacity-50"
        >
          <PlusIcon className="size-4" />
          Tambah Data {moduleLabel}
        </button>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <button type="submit" className="hidden" aria-hidden="true" />
    </form>
  )
}
