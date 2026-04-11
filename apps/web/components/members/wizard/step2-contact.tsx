"use client"

import * as React from "react"
import { CheckIcon, ChevronsUpDownIcon, Globe } from "lucide-react"
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
  upsertMemberContactAction,
  type Step2ContactData,
} from "@/app/(dashboard)/[tenant]/members/actions"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Step2DefaultValues {
  phone?: string
  whatsapp?: string
  email?: string
  domicileStatus?: "permanent" | "temporary"
  // Alamat: mode luar negeri jika addressCountry terisi
  addressCountry?: string
  addressProvinceId?: number
  addressRegencyId?: number
  addressDistrictId?: number
  addressVillageId?: number
  addressDetail?: string
  addressPostalCode?: string
  instagram?: string
  facebook?: string
  linkedin?: string
  twitter?: string
  youtube?: string
  tiktok?: string
  website?: string
}

interface Step2Props {
  memberId: string
  slug: string
  tenantName: string
  tenantId: string
  onSuccess: () => void
  defaultValues?: Step2DefaultValues
}

// ─── Sub-komponen: section heading ────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <fieldset className="space-y-4">
      <legend className="w-full border-b pb-1.5 text-sm font-semibold text-foreground">
        {title}
      </legend>
      {children}
    </fieldset>
  )
}

// ─── Sub-komponen: input teks dengan label ────────────────────────────────────

function TextInput({
  label,
  optional = false,
  hint,
  ...props
}: React.ComponentProps<"input"> & {
  label: string
  optional?: boolean
  hint?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">
        {label}
        {optional && (
          <span className="ml-1 font-normal text-muted-foreground">(opsional)</span>
        )}
      </label>
      <input
        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        {...props}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

// ─── Sub-komponen: simple combobox ────────────────────────────────────────────

function SimpleCombobox({
  label,
  placeholder,
  items,
  value,
  onSelect,
  disabled = false,
  optional = false,
  clearable = false,
}: {
  label: string
  placeholder: string
  items: { value: string; label: string }[]
  value: string | undefined
  onSelect: (value: string | undefined) => void
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
        {optional && (
          <span className="ml-1 font-normal text-muted-foreground">(opsional)</span>
        )}
      </span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "w-full justify-between font-normal",
              !selected && "text-muted-foreground"
            )}
          >
            {selected?.label ?? placeholder}
            <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
        >
          <Command>
            <CommandInput placeholder={`Cari ${label.toLowerCase()}...`} />
            <CommandList>
              <CommandEmpty>Tidak ditemukan.</CommandEmpty>
              <CommandGroup>
                {clearable && (
                  <CommandItem
                    value="__clear__"
                    onSelect={() => { onSelect(undefined); setOpen(false) }}
                  >
                    <CheckIcon
                      className={cn("mr-2 size-4", !value ? "opacity-100" : "opacity-0")}
                    />
                    <span className="text-muted-foreground">Tidak dipilih</span>
                  </CommandItem>
                )}
                {items.map((item) => (
                  <CommandItem
                    key={item.value}
                    value={item.label}
                    onSelect={() => { onSelect(item.value); setOpen(false) }}
                  >
                    <CheckIcon
                      className={cn(
                        "mr-2 size-4",
                        value === item.value ? "opacity-100" : "opacity-0"
                      )}
                    />
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

// ─── Data statis ──────────────────────────────────────────────────────────────

const DOMICILE_STATUS_ITEMS = [
  { value: "permanent", label: "Permanen" },
  { value: "temporary", label: "Sementara / Perantau" },
]

// Platform sosial media: label, placeholder, hint, dan icon opsional
const SOCIAL_PLATFORMS = [
  {
    key: "instagram",
    label: "Instagram",
    placeholder: "username (tanpa @)",
    hint: "Contoh: instagram.com/wasugi",
    icon: null,
    inputType: "text",
  },
  {
    key: "facebook",
    label: "Facebook",
    placeholder: "URL atau nama profil",
    hint: 'Contoh: facebook.com/wasugi atau "Wasugi"',
    icon: null,
    inputType: "text",
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    placeholder: "URL profil lengkap",
    hint: "Contoh: linkedin.com/in/wasugi",
    icon: null,
    inputType: "url",
  },
  {
    key: "twitter",
    label: "Twitter / X",
    placeholder: "username (tanpa @)",
    hint: "Contoh: @wasugi",
    icon: null,
    inputType: "text",
  },
  {
    key: "youtube",
    label: "YouTube",
    placeholder: "URL channel",
    hint: "Contoh: youtube.com/@wasugi",
    icon: null,
    inputType: "url",
  },
  {
    key: "tiktok",
    label: "TikTok",
    placeholder: "username (tanpa @)",
    hint: "Contoh: @wasugi",
    icon: null,
    inputType: "text",
  },
  {
    key: "website",
    label: "Website",
    placeholder: "https://...",
    hint: "Contoh: https://wasugi.com",
    icon: Globe,
    inputType: "url",
  },
] as const

type SocialKey = (typeof SOCIAL_PLATFORMS)[number]["key"]

// ─── Step 2: Kontak & Alamat ──────────────────────────────────────────────────

export function Step2Contact({ memberId, slug, tenantName, tenantId, onSuccess, defaultValues }: Step2Props) {
  // Kontak — controlled untuk sinkronisasi WhatsApp
  const [phone, setPhone] = React.useState(defaultValues?.phone ?? "")
  const [whatsapp, setWhatsapp] = React.useState(defaultValues?.whatsapp ?? "")
  const [sameAsPhone, setSameAsPhone] = React.useState(false)

  // Domisili
  const [domicileStatus, setDomicileStatus] = React.useState<string | undefined>(defaultValues?.domicileStatus)

  // Alamat — mode: indonesia vs overseas
  const [addressMode, setAddressMode] = React.useState<"indonesia" | "overseas">(
    defaultValues?.addressCountry ? "overseas" : "indonesia"
  )
  const [addressCountry, setAddressCountry] = React.useState(defaultValues?.addressCountry ?? "")
  const [wilayah, setWilayah] = React.useState<WilayahValue>({
    provinceId: defaultValues?.addressProvinceId,
    regencyId: defaultValues?.addressRegencyId,
    districtId: defaultValues?.addressDistrictId,
    villageId: defaultValues?.addressVillageId,
  })

  // Sosial media state
  const [social, setSocial] = React.useState<Record<SocialKey, string>>({
    instagram: defaultValues?.instagram ?? "",
    facebook: defaultValues?.facebook ?? "",
    linkedin: defaultValues?.linkedin ?? "",
    twitter: defaultValues?.twitter ?? "",
    youtube: defaultValues?.youtube ?? "",
    tiktok: defaultValues?.tiktok ?? "",
    website: defaultValues?.website ?? "",
  })

  // Form state
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Sinkronisasi WhatsApp ← Telepon saat checkbox aktif
  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setPhone(val)
    if (sameAsPhone) setWhatsapp(val)
  }

  function handleSameAsPhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    const checked = e.target.checked
    setSameAsPhone(checked)
    if (checked) setWhatsapp(phone)
  }

  function handleSocialChange(key: SocialKey, value: string) {
    setSocial((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const fd = new FormData(e.currentTarget)
    const str = (key: string) => (fd.get(key) as string)?.trim() || undefined

    const data: Step2ContactData = {
      // Kontak — baca dari state (controlled)
      phone:    phone.trim() || undefined,
      whatsapp: (sameAsPhone ? phone : whatsapp).trim() || undefined,
      email:    str("email"),
      // Domisili — tenant ID dari props (otomatis dari slug)
      domicileStatus:   (domicileStatus as "permanent" | "temporary") || undefined,
      domicileTenantId: tenantId,
      // Alamat — bedakan Indonesia vs luar negeri
      addressCountry:    addressMode === "overseas" ? (addressCountry.trim() || undefined) : undefined,
      addressProvinceId: addressMode === "indonesia" ? wilayah.provinceId : undefined,
      addressRegencyId:  addressMode === "indonesia" ? wilayah.regencyId  : undefined,
      addressDistrictId: addressMode === "indonesia" ? wilayah.districtId : undefined,
      addressVillageId:  addressMode === "indonesia" ? wilayah.villageId  : undefined,
      addressDetail:    str("addressDetail"),
      addressPostalCode: str("addressPostalCode"),
      // Sosial media
      instagram: social.instagram || undefined,
      facebook:  social.facebook  || undefined,
      linkedin:  social.linkedin  || undefined,
      twitter:   social.twitter   || undefined,
      youtube:   social.youtube   || undefined,
      tiktok:    social.tiktok    || undefined,
      website:   social.website   || undefined,
    }

    const result = await upsertMemberContactAction(slug, memberId, data)

    if (result.success) {
      onSuccess()
    } else {
      setError(result.error ?? "Gagal menyimpan.")
      setLoading(false)
    }
  }

  return (
    <form
      id="wizard-step-2-form"
      onSubmit={handleSubmit}
      className="space-y-8"
    >
      {/* ── KONTAK ── */}
      <Section title="Kontak">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Telepon */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">
              Telepon{" "}
              <span className="font-normal text-muted-foreground">(opsional)</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={handlePhoneChange}
              placeholder="6285210626455"
              inputMode="numeric"
              disabled={loading}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {/* WhatsApp */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">
              WhatsApp{" "}
              <span className="font-normal text-muted-foreground">(opsional)</span>
            </label>
            <input
              type="tel"
              value={whatsapp}
              onChange={(e) => { if (!sameAsPhone) setWhatsapp(e.target.value) }}
              placeholder="6285210626455"
              inputMode="numeric"
              disabled={loading || sameAsPhone}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
            {/* Checkbox sinkronisasi */}
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground select-none">
              <input
                type="checkbox"
                checked={sameAsPhone}
                onChange={handleSameAsPhoneChange}
                disabled={loading}
                className="rounded border-input"
              />
              Sama dengan nomor telepon di atas
            </label>
          </div>
        </div>

        <TextInput
          label="Email"
          name="email"
          optional
          type="email"
          placeholder="contoh@email.com"
          inputMode="email"
          defaultValue={defaultValues?.email}
          disabled={loading}
        />
      </Section>

      {/* ── DOMISILI ── */}
      <Section title="Domisili">
        <p className="text-xs text-muted-foreground -mt-2">
          Cabang tempat anggota berdomisili saat ini — dipakai untuk pemetaan sebaran alumni.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SimpleCombobox
            label="Status Domisili"
            placeholder="Pilih status"
            items={DOMICILE_STATUS_ITEMS}
            value={domicileStatus}
            onSelect={setDomicileStatus}
            optional
            clearable
            disabled={loading}
          />

          {/* Cabang domisili — otomatis dari tenant saat ini, read-only */}
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">Cabang Domisili</span>
            <div className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm text-foreground">
              {tenantName}
            </div>
            <p className="text-xs text-muted-foreground">
              Otomatis diisi dari cabang yang sedang dikelola.
            </p>
          </div>
        </div>
      </Section>

      {/* ── ALAMAT ── */}
      <Section title="Alamat Rumah">
        {/* Toggle: Indonesia / Luar Negeri */}
        <div className="flex gap-1 rounded-lg border border-input bg-muted p-1 w-fit">
          <button
            type="button"
            onClick={() => setAddressMode("indonesia")}
            disabled={loading}
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
            onClick={() => setAddressMode("overseas")}
            disabled={loading}
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
          <WilayahSelect
            onChange={setWilayah}
            defaultValue={wilayah}
            disabled={loading}
          />
        ) : (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">
              Negara
              <span className="ml-1 font-normal text-muted-foreground">(opsional)</span>
            </label>
            <input
              type="text"
              value={addressCountry}
              onChange={(e) => setAddressCountry(e.target.value)}
              placeholder="Contoh: Malaysia, Arab Saudi, Jepang"
              disabled={loading}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        )}

        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">
              Detail Alamat{" "}
              <span className="font-normal text-muted-foreground">(opsional)</span>
            </label>
            <textarea
              name="addressDetail"
              placeholder="Nama jalan, nomor rumah, RT/RW, nama gedung, lantai, dll."
              rows={3}
              defaultValue={defaultValues?.addressDetail}
              disabled={loading}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
            />
          </div>
          <div className="max-w-[180px]">
            <TextInput
              label="Kode Pos"
              name="addressPostalCode"
              optional
              placeholder="Contoh: 55283"
              maxLength={10}
              inputMode="numeric"
              defaultValue={defaultValues?.addressPostalCode}
              disabled={loading}
            />
          </div>
        </div>
      </Section>

      {/* ── SOSIAL MEDIA ── */}
      <Section title="Sosial Media">
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
                value={social[key]}
                onChange={(e) => handleSocialChange(key, e.target.value)}
                placeholder={placeholder}
                disabled={loading}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
              <p className="text-xs text-muted-foreground">{hint}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Error ── */}
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <button type="submit" className="hidden" aria-hidden="true" />
    </form>
  )
}
