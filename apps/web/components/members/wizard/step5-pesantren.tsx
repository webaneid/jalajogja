"use client"

import * as React from "react"
import {
  CheckIcon,
  ChevronsUpDownIcon,
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
import { SocialMediaInput, type SocialMediaValue } from "@/components/ui/social-media-input"
import { PhoneInput } from "@/components/ui/phone-input"
import { TagMultiSelect } from "@/components/ui/tag-multi-select"
import { ECOSYSTEM_TAG_SUGGESTIONS } from "@/lib/ecosystem-tags"
import {
  saveMemberOwnedPesantrenAction,
  type OwnedPesantrenEntryData,
} from "@/app/(dashboard)/app/[tenant]/members/actions"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Step5Props {
  memberId: string
  slug: string
  onSuccess: () => void
  defaultEntries?: OwnedPesantrenEntry[]
}

export interface OwnedPesantrenEntry {
  id: string
  // Identitas
  name: string
  tahunBerdiri: string
  luasArea: string
  // Pimpinan
  namaPimpinan: string
  hpPimpinan: string
  // Klasifikasi
  kurikulum: string
  jenisPondok: string
  modelPendidikan: string
  kategoriSantri: string
  // Statistik
  santriPutra: string
  santriPutri: string
  asatidz: string
  asatidzah: string
  // Ekosistem — apa yang ditawarkan/dibutuhkan
  offeredTags: string[]
  neededTags: string[]
  // Kontak
  phone: string
  whatsapp: string
  email: string
  isPhonePublic: boolean
  isWhatsappPublic: boolean
  // Alamat
  addressMode: "indonesia" | "overseas"
  addressCountry: string
  provinceId: number | null
  regencyId: number | null
  districtId: number | null
  villageId: number | null
  addressDetail: string
  postalCode: string
  // Sosmed
  instagram: string
  facebook: string
  linkedin: string
  twitter: string
  youtube: string
  tiktok: string
  website: string
}

// ─── Konstanta enum (mirror dari schema) ──────────────────────────────────────

const KURIKULUM_ITEMS = [
  "KMI Gontor", "DIKNAS", "KEMENAG", "Salafiah", "Lainnya",
].map((v) => ({ value: v, label: v }))

const JENIS_PONDOK_ITEMS = [
  "Wakaf", "Milik Keluarga",
].map((v) => ({ value: v, label: v }))

const MODEL_ITEMS = [
  "Murni KMI Gontor", "KMI dan Tahfidz", "KMI dan Kewirausahaan",
  "Pesantren Salafiah", "Pesantren Tahfidz", "Sekolah Umum",
  "DIKNAS dan Tahfidz", "KEMENAG dan Tahfidz", "Sekolah Kejuruan",
].map((v) => ({ value: v, label: v }))

const KATEGORI_SANTRI_ITEMS = [
  "Putra", "Putra dan Putri", "Putri",
].map((v) => ({ value: v, label: v }))

// ─── Helper ───────────────────────────────────────────────────────────────────

function newEntry(): OwnedPesantrenEntry {
  return {
    id: crypto.randomUUID(),
    name: "", tahunBerdiri: "", luasArea: "",
    namaPimpinan: "", hpPimpinan: "",
    kurikulum: "", jenisPondok: "", modelPendidikan: "", kategoriSantri: "",
    santriPutra: "", santriPutri: "",
    asatidz: "", asatidzah: "",
    offeredTags: [], neededTags: [],
    phone: "", whatsapp: "", email: "",
    isPhonePublic: false, isWhatsappPublic: false,
    addressMode: "indonesia",
    addressCountry: "",
    provinceId: null, regencyId: null, districtId: null, villageId: null,
    addressDetail: "", postalCode: "",
    instagram: "", facebook: "", linkedin: "",
    twitter: "", youtube: "", tiktok: "", website: "",
  }
}

function autoTotal(a: string, b: string): string {
  const na = parseInt(a, 10)
  const nb = parseInt(b, 10)
  if (isNaN(na) && isNaN(nb)) return "—"
  return String((isNaN(na) ? 0 : na) + (isNaN(nb) ? 0 : nb))
}

function num(s: string): number | null {
  const n = parseInt(s, 10)
  return isNaN(n) ? null : n
}

const inputCls =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"

// ─── Sub-komponen: Simple Combobox ───────────────────────────────────────────

function SimpleCombobox({
  label, placeholder, items, value, onSelect, disabled = false, optional = false, clearable = false,
}: {
  label: string
  placeholder: string
  items: { value: string; label: string }[]
  value: string
  onSelect: (v: string) => void
  disabled?: boolean
  optional?: boolean
  clearable?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const selected = items.find((i) => i.value === value)

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">
        {label}
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

// ─── Sub-komponen: satu PesantrenCard ────────────────────────────────────────

function PesantrenCard({
  entry,
  index,
  canRemove,
  disabled,
  tenantSlug,
  onChange,
  onWilayahChange,
  onRemove,
}: {
  entry: OwnedPesantrenEntry
  index: number
  canRemove: boolean
  disabled: boolean
  tenantSlug: string
  onChange: <K extends keyof OwnedPesantrenEntry>(field: K, value: OwnedPesantrenEntry[K]) => void
  onWilayahChange: (val: WilayahValue) => void
  onRemove: () => void
}) {
  const [sameAsPhone, setSameAsPhone] = React.useState(false)

  function handlePhoneChange(val: string) {
    onChange("phone", val)
    if (sameAsPhone) onChange("whatsapp", val)
  }

  function handleSameAsPhone(checked: boolean) {
    setSameAsPhone(checked)
    if (checked) onChange("whatsapp", entry.phone)
  }

  function handleAddressModeChange(mode: "indonesia" | "overseas") {
    onChange("addressMode", mode)
    if (mode === "indonesia") {
      onChange("addressCountry", "")
    } else {
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
        <span className="text-sm font-semibold">Pesantren #{index + 1}</span>
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
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Identitas Pesantren</p>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Nama Pesantren<span className="text-destructive ml-0.5">*</span></span>
          <input
            type="text"
            value={entry.name}
            onChange={(e) => onChange("name", e.target.value)}
            placeholder="Nama lengkap pesantren"
            disabled={disabled}
            className={inputCls}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">
              Tahun Berdiri <span className="font-normal text-muted-foreground">(opsional)</span>
            </span>
            <input
              type="number"
              value={entry.tahunBerdiri}
              onChange={(e) => onChange("tahunBerdiri", e.target.value)}
              placeholder="Cth: 1985"
              min={1900} max={new Date().getFullYear()}
              disabled={disabled}
              className={inputCls}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">
              Luas Area <span className="font-normal text-muted-foreground">(opsional)</span>
            </span>
            <input
              type="text"
              value={entry.luasArea}
              onChange={(e) => onChange("luasArea", e.target.value)}
              placeholder="Cth: 2 hektar"
              disabled={disabled}
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {/* ── Section 2: Pimpinan ── */}
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pimpinan</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">
              Nama Pimpinan <span className="font-normal text-muted-foreground">(opsional)</span>
            </span>
            <input
              type="text"
              value={entry.namaPimpinan}
              onChange={(e) => onChange("namaPimpinan", e.target.value)}
              placeholder="Nama pengasuh / mudir"
              disabled={disabled}
              className={inputCls}
            />
          </div>
          <PhoneInput
            label="HP Pimpinan"
            value={entry.hpPimpinan}
            onChange={(v) => onChange("hpPimpinan", v)}
            optional
            disabled={disabled}
          />
        </div>
      </div>

      {/* ── Section 3: Klasifikasi ── */}
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Klasifikasi</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SimpleCombobox
            label="Kurikulum" optional clearable
            placeholder="Pilih kurikulum"
            items={KURIKULUM_ITEMS}
            value={entry.kurikulum}
            onSelect={(v) => onChange("kurikulum", v)}
            disabled={disabled}
          />
          <SimpleCombobox
            label="Jenis Pondok" optional clearable
            placeholder="Pilih jenis"
            items={JENIS_PONDOK_ITEMS}
            value={entry.jenisPondok}
            onSelect={(v) => onChange("jenisPondok", v)}
            disabled={disabled}
          />
          <SimpleCombobox
            label="Model Pendidikan" optional clearable
            placeholder="Pilih model"
            items={MODEL_ITEMS}
            value={entry.modelPendidikan}
            onSelect={(v) => onChange("modelPendidikan", v)}
            disabled={disabled}
          />
          <SimpleCombobox
            label="Kategori Santri" optional clearable
            placeholder="Pilih kategori"
            items={KATEGORI_SANTRI_ITEMS}
            value={entry.kategoriSantri}
            onSelect={(v) => onChange("kategoriSantri", v)}
            disabled={disabled}
          />
        </div>
      </div>

      {/* ── Section 3b: Ekosistem — apa yang ditawarkan/dibutuhkan ── */}
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ekosistem Sinergi</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">
              Menawarkan <span className="font-normal text-muted-foreground">(opsional)</span>
            </span>
            <TagMultiSelect
              options={ECOSYSTEM_TAG_SUGGESTIONS}
              value={entry.offeredTags}
              onChange={(offeredTags) => onChange("offeredTags", offeredTags)}
              disabled={disabled}
              placeholder="Mis. Kelebihan Lahan, Aula untuk Disewa..."
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
              placeholder="Mis. Guru Bahasa Inggris, Pasokan Beras..."
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Membantu sesama anggota menemukan sinergi — mis. tenaga pengajar, pengadaan, atau
          pemanfaatan aset.
        </p>
      </div>

      {/* ── Section 4: Statistik ── */}
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Statistik</p>
        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">Santri Putra</span>
            <input
              type="number"
              value={entry.santriPutra}
              onChange={(e) => onChange("santriPutra", e.target.value)}
              placeholder="0" min={0}
              disabled={disabled}
              className={inputCls}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">Santri Putri</span>
            <input
              type="number"
              value={entry.santriPutri}
              onChange={(e) => onChange("santriPutri", e.target.value)}
              placeholder="0" min={0}
              disabled={disabled}
              className={inputCls}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">Total Santri</span>
            <div className={cn(inputCls, "bg-muted text-muted-foreground cursor-default select-none")}>
              {autoTotal(entry.santriPutra, entry.santriPutri)}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">Asatidz (L)</span>
            <input
              type="number"
              value={entry.asatidz}
              onChange={(e) => onChange("asatidz", e.target.value)}
              placeholder="0" min={0}
              disabled={disabled}
              className={inputCls}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">Asatidzah (P)</span>
            <input
              type="number"
              value={entry.asatidzah}
              onChange={(e) => onChange("asatidzah", e.target.value)}
              placeholder="0" min={0}
              disabled={disabled}
              className={inputCls}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">Total Pengajar</span>
            <div className={cn(inputCls, "bg-muted text-muted-foreground cursor-default select-none")}>
              {autoTotal(entry.asatidz, entry.asatidzah)}
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Total dihitung otomatis, tidak disimpan terpisah.</p>
      </div>

      {/* ── Section 5: Kontak Pesantren ── */}
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Kontak Pesantren</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <PhoneInput
              label="Telepon"
              value={entry.phone}
              onChange={handlePhoneChange}
              optional
              disabled={disabled}
            />
            <label className="mt-1.5 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground select-none">
              <input
                type="checkbox"
                checked={entry.isPhonePublic}
                onChange={(e) => onChange("isPhonePublic", e.target.checked)}
                disabled={disabled}
                className="rounded border-input"
              />
              Tampilkan ke publik
            </label>
          </div>
          <div className="flex flex-col gap-1.5">
            <PhoneInput
              label="WhatsApp"
              value={sameAsPhone ? entry.phone : entry.whatsapp}
              onChange={(v) => { if (!sameAsPhone) onChange("whatsapp", v) }}
              optional
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
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground select-none">
              <input
                type="checkbox"
                checked={entry.isWhatsappPublic}
                onChange={(e) => onChange("isWhatsappPublic", e.target.checked)}
                disabled={disabled}
                className="rounded border-input"
              />
              Tampilkan ke publik
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
            placeholder="pesantren@email.com"
            inputMode="email"
            disabled={disabled}
            className={inputCls}
          />
        </div>
      </div>

      {/* ── Section 6: Alamat Pesantren ── */}
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Alamat Pesantren</p>

        <div className="flex gap-1 rounded-lg border border-input bg-muted p-1 w-fit">
          <button
            type="button"
            onClick={() => handleAddressModeChange("indonesia")}
            disabled={disabled}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              entry.addressMode === "indonesia"
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
              entry.addressMode === "overseas"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Luar Negeri
          </button>
        </div>

        {entry.addressMode === "indonesia" ? (
          <WilayahSelect onChange={onWilayahChange} disabled={disabled} tenantSlug={tenantSlug} />
        ) : (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">
              Negara <span className="font-normal text-muted-foreground">(opsional)</span>
            </span>
            <input
              type="text"
              value={entry.addressCountry}
              onChange={(e) => onChange("addressCountry", e.target.value)}
              placeholder="Contoh: Malaysia, Arab Saudi"
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
            placeholder="Nama jalan, nomor, RT/RW..."
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
              placeholder="Cth: 55283"
              maxLength={10}
              inputMode="numeric"
              disabled={disabled}
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {/* ── Section 7: Sosial Media ── */}
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sosial Media</p>
        <SocialMediaInput
          value={{
            instagram: entry.instagram, facebook: entry.facebook,
            linkedin: entry.linkedin,   twitter:   entry.twitter,
            youtube:  entry.youtube,    tiktok:    entry.tiktok,
            website:  entry.website,
          }}
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

// ─── Step 5: Data Pesantren Milik / Kelolaan ──────────────────────────────────

export function Step5Pesantren({ memberId, slug, onSuccess, defaultEntries }: Step5Props) {
  const [entries, setEntries] = React.useState<OwnedPesantrenEntry[]>(
    defaultEntries && defaultEntries.length > 0 ? defaultEntries : [newEntry()]
  )
  const [loading,   setLoading]   = React.useState(false)
  const [error,     setError]     = React.useState<string | null>(null)
  const [focusedId, setFocusedId] = React.useState<string | null>(
    defaultEntries && defaultEntries.length > 0 ? null : (entries[0]?.id ?? null)
  )

  function addEntry() {
    const entry = newEntry()
    setEntries((prev) => [...prev, entry])
    setFocusedId(entry.id)
  }

  function backToAll() {
    setEntries((prev) => prev.filter((e) => e.id !== focusedId || e.name.trim() !== ""))
    setFocusedId(null)
  }

  function removeEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id))
    if (focusedId === id) setFocusedId(null)
  }

  function updateEntry<K extends keyof OwnedPesantrenEntry>(
    id: string, field: K, value: OwnedPesantrenEntry[K]
  ) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)))
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

    const payload: OwnedPesantrenEntryData[] = entries
      .filter((e) => e.name.trim())
      .map((e) => ({
        name:            e.name,
        tahunBerdiri:    num(e.tahunBerdiri),
        luasArea:        e.luasArea       || undefined,
        namaPimpinan:    e.namaPimpinan   || undefined,
        hpPimpinan:      e.hpPimpinan     || undefined,
        kurikulum:       e.kurikulum      || undefined,
        jenisPondok:     e.jenisPondok    || undefined,
        modelPendidikan: e.modelPendidikan || undefined,
        kategoriSantri:  e.kategoriSantri || undefined,
        santriPutra:     num(e.santriPutra),
        santriPutri:     num(e.santriPutri),
        asatidz:         num(e.asatidz),
        asatidzah:       num(e.asatidzah),
        offeredTags:     e.offeredTags.length > 0 ? e.offeredTags : undefined,
        neededTags:      e.neededTags.length  > 0 ? e.neededTags  : undefined,
        phone:           e.phone    || undefined,
        whatsapp:        e.whatsapp || undefined,
        email:           e.email    || undefined,
        isPhonePublic:    e.isPhonePublic,
        isWhatsappPublic: e.isWhatsappPublic,
        addressCountry:    e.addressCountry       || undefined,
        addressProvinceId: e.provinceId ?? undefined,
        addressRegencyId:  e.regencyId  ?? undefined,
        addressDistrictId: e.districtId ?? undefined,
        addressVillageId:  e.villageId  ?? undefined,
        addressDetail:     e.addressDetail  || undefined,
        addressPostalCode: e.postalCode     || undefined,
        instagram: e.instagram || undefined,
        facebook:  e.facebook  || undefined,
        linkedin:  e.linkedin  || undefined,
        twitter:   e.twitter   || undefined,
        youtube:   e.youtube   || undefined,
        tiktok:    e.tiktok    || undefined,
        website:   e.website   || undefined,
      }))

    const result = await saveMemberOwnedPesantrenAction(slug, memberId, payload)

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
    <form id="wizard-step-5-form" onSubmit={handleSubmit} className="space-y-4">
      <div className="mb-2">
        <p className="text-sm text-muted-foreground">
          Catat pesantren yang dimiliki atau dikelola oleh anggota ini.
        </p>
      </div>

      {focusedId && entries.length > 1 && (
        <button
          type="button"
          onClick={backToAll}
          disabled={loading}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          ← Lihat semua pesantren ({entries.length})
        </button>
      )}

      {visibleEntries.map((entry) => (
        <PesantrenCard
          key={entry.id}
          entry={entry}
          index={entries.indexOf(entry)}
          canRemove={entries.length > 1}
          disabled={loading}
          tenantSlug={slug}
          onChange={(field, value) => updateEntry(entry.id, field, value)}
          onWilayahChange={(val) => updateEntryWilayah(entry.id, val)}
          onRemove={() => removeEntry(entry.id)}
        />
      ))}

      {!focusedId && (
        <button
          type="button"
          onClick={addEntry}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-muted-foreground/40 py-3 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:pointer-events-none disabled:opacity-50"
        >
          <PlusIcon className="size-4" />
          Tambah Data Pesantren
        </button>
      )}

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <button type="submit" className="hidden" aria-hidden="true" />
    </form>
  )
}
