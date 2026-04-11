"use client"

import * as React from "react"
import {
  CheckIcon,
  ChevronsUpDownIcon,
  Globe,
  PlusIcon,
  XIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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
import {
  saveMemberBusinessesAction,
  type BusinessEntryData,
} from "@/app/(dashboard)/[tenant]/members/actions"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Step4Props {
  memberId: string
  slug: string
  onSuccess: () => void
  defaultEntries?: BusinessEntry[]
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
}

// ─── Konstanta enum (mirror dari schema) ──────────────────────────────────────

const CATEGORY_ITEMS = [
  "Jasa", "Produsen", "Distributor", "Trading", "Profesional",
].map((v) => ({ value: v, label: v }))

const SECTOR_ITEMS = [
  "Teknologi", "Jasa Profesional", "Kreatif", "Manufaktur",
  "Kesehatan & Pendidikan", "Konsumsi & Ritel", "Sumber Daya Alam",
].map((v) => ({ value: v, label: v }))

const LEGALITY_ITEMS = [
  "PT Perseorangan", "PT", "CV", "Yayasan",
  "Perkumpulan", "Koperasi", "Belum Memiliki Legalitas",
].map((v) => ({ value: v, label: v }))

const POSITION_ITEMS = [
  "Komisaris", "Direktur", "Pengelola", "Manajer",
].map((v) => ({ value: v, label: v }))

const EMPLOYEES_ITEMS = [
  "1-4", "5-10", "11-20", "Lebih dari 20",
].map((v) => ({ value: v, label: v }))

const BRANCHES_ITEMS = [
  "Tidak Ada", "1-3", "Diatas 3",
].map((v) => ({ value: v, label: v }))

const REVENUE_ITEMS = [
  "Dibawah 500jt", "500jt-1M", "1M-2M", "Diatas 2M",
].map((v) => ({ value: v, label: v }))

// Platform sosial media (sama persis dengan step2)
const SOCIAL_PLATFORMS = [
  { key: "instagram", label: "Instagram", placeholder: "username (tanpa @)",   hint: "Contoh: instagram.com/wasugi",         icon: null,  inputType: "text" },
  { key: "facebook",  label: "Facebook",  placeholder: "URL atau nama profil", hint: 'Contoh: facebook.com/wasugi atau "Wasugi"', icon: null, inputType: "text" },
  { key: "linkedin",  label: "LinkedIn",  placeholder: "URL profil lengkap",   hint: "Contoh: linkedin.com/in/wasugi",      icon: null,  inputType: "url"  },
  { key: "twitter",   label: "Twitter/X", placeholder: "username (tanpa @)",   hint: "Contoh: @wasugi",                    icon: null,  inputType: "text" },
  { key: "youtube",   label: "YouTube",   placeholder: "URL channel",          hint: "Contoh: youtube.com/@wasugi",         icon: null,  inputType: "url"  },
  { key: "tiktok",    label: "TikTok",    placeholder: "username (tanpa @)",   hint: "Contoh: @wasugi",                    icon: null,  inputType: "text" },
  { key: "website",   label: "Website",   placeholder: "https://...",          hint: "Contoh: https://wasugi.com",          icon: Globe, inputType: "url"  },
] as const

type SocialKey = (typeof SOCIAL_PLATFORMS)[number]["key"]

// ─── Helper ───────────────────────────────────────────────────────────────────

function newEntry(): BusinessEntry {
  return {
    id: crypto.randomUUID(),
    name: "", brand: "", description: "",
    category: "", sector: "", legality: "", position: "",
    employees: "", branches: "", revenue: "",
    addressCountry: "",
    provinceId: null, regencyId: null, districtId: null, villageId: null,
    addressDetail: "", postalCode: "",
    phone: "", whatsapp: "", email: "",
    instagram: "", facebook: "", linkedin: "",
    twitter: "", youtube: "", tiktok: "", website: "",
  }
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
  onChange,
  onWilayahChange,
  onRemove,
}: {
  entry: BusinessEntry
  index: number
  canRemove: boolean
  disabled: boolean
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
        <span className="text-sm font-semibold">Usaha #{index + 1}</span>
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
            Deskripsi <span className="font-normal text-muted-foreground">(opsional)</span>
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
            label="Kategori" required
            placeholder="Pilih kategori"
            items={CATEGORY_ITEMS}
            value={entry.category}
            onSelect={(v) => onChange("category", v)}
            disabled={disabled}
          />
          <SimpleCombobox
            label="Sektor" required
            placeholder="Pilih sektor"
            items={SECTOR_ITEMS}
            value={entry.sector}
            onSelect={(v) => onChange("sector", v)}
            disabled={disabled}
          />
          <SimpleCombobox
            label="Legalitas" optional clearable
            placeholder="Pilih legalitas"
            items={LEGALITY_ITEMS}
            value={entry.legality}
            onSelect={(v) => onChange("legality", v)}
            disabled={disabled}
          />
          <SimpleCombobox
            label="Posisi / Jabatan" optional clearable
            placeholder="Pilih posisi"
            items={POSITION_ITEMS}
            value={entry.position}
            onSelect={(v) => onChange("position", v)}
            disabled={disabled}
          />
        </div>
      </div>

      {/* ── Section 3: Skala Usaha ── */}
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Skala Usaha</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SimpleCombobox
            label="Jumlah Karyawan" optional clearable
            placeholder="Pilih range"
            items={EMPLOYEES_ITEMS}
            value={entry.employees}
            onSelect={(v) => onChange("employees", v)}
            disabled={disabled}
          />
          <SimpleCombobox
            label="Jumlah Cabang" optional clearable
            placeholder="Pilih range"
            items={BRANCHES_ITEMS}
            value={entry.branches}
            onSelect={(v) => onChange("branches", v)}
            disabled={disabled}
          />
          <SimpleCombobox
            label="Omzet / Tahun" optional clearable
            placeholder="Pilih range"
            items={REVENUE_ITEMS}
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
          <WilayahSelect onChange={onWilayahChange} disabled={disabled} />
        ) : (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">
              Negara <span className="font-normal text-muted-foreground">(opsional)</span>
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
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">
              Telepon <span className="font-normal text-muted-foreground">(opsional)</span>
            </span>
            <input
              type="tel"
              value={entry.phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="6285210626455"
              inputMode="numeric"
              disabled={disabled}
              className={inputCls}
            />
          </div>
          {/* WhatsApp + checkbox */}
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">
              WhatsApp <span className="font-normal text-muted-foreground">(opsional)</span>
            </span>
            <input
              type="tel"
              value={sameAsPhone ? entry.phone : entry.whatsapp}
              onChange={(e) => { if (!sameAsPhone) onChange("whatsapp", e.target.value) }}
              placeholder="6285210626455"
              inputMode="numeric"
              disabled={disabled || sameAsPhone}
              className={inputCls}
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {SOCIAL_PLATFORMS.map(({ key, label, placeholder, hint, icon: Icon, inputType }) => (
            <div key={key} className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                {Icon && <Icon className="size-3.5 text-muted-foreground" />}
                {label}
                <span className="font-normal text-muted-foreground">(opsional)</span>
              </label>
              <input
                type={inputType}
                value={entry[key as SocialKey]}
                onChange={(e) => onChange(key as SocialKey, e.target.value)}
                placeholder={placeholder}
                disabled={disabled}
                className={inputCls}
              />
              <p className="text-xs text-muted-foreground">{hint}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Step 4: Data Usaha ───────────────────────────────────────────────────────

export function Step4Business({ memberId, slug, onSuccess, defaultEntries }: Step4Props) {
  const [entries, setEntries] = React.useState<BusinessEntry[]>(
    defaultEntries && defaultEntries.length > 0 ? defaultEntries : [newEntry()]
  )
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  function addEntry() {
    setEntries((prev) => [...prev, newEntry()])
  }

  function removeEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id))
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
    setLoading(true)

    const payload: BusinessEntryData[] = entries
      .filter((e) => e.name.trim() && e.category && e.sector)
      .map((e) => ({
        name:        e.name,
        brand:       e.brand       || undefined,
        description: e.description || undefined,
        category:    e.category,
        sector:      e.sector,
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
      }))

    const result = await saveMemberBusinessesAction(slug, memberId, payload)

    if (result.success) {
      onSuccess()
    } else {
      setError(result.error ?? "Gagal menyimpan.")
      setLoading(false)
    }
  }

  return (
    <form
      id="wizard-step-4-form"
      onSubmit={handleSubmit}
      className="space-y-4"
    >
      {entries.map((entry, index) => (
        <BusinessCard
          key={entry.id}
          entry={entry}
          index={index}
          canRemove={entries.length > 1}
          disabled={loading}
          onChange={(field, value) => updateEntry(entry.id, field, value)}
          onWilayahChange={(val) => updateEntryWilayah(entry.id, val)}
          onRemove={() => removeEntry(entry.id)}
        />
      ))}

      {/* Tombol tambah */}
      <button
        type="button"
        onClick={addEntry}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-muted-foreground/40 py-3 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:pointer-events-none disabled:opacity-50"
      >
        <PlusIcon className="size-4" />
        Tambah Data Usaha
      </button>

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
