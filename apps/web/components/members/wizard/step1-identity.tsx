"use client"

import * as React from "react"
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react"
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
import { createMemberAction, updateMemberAction } from "@/app/(dashboard)/[tenant]/members/actions"
import type { RefProfession } from "@jalajogja/db"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Step1DefaultValues {
  name?: string
  nik?: string
  stambukNumber?: string
  gender?: "male" | "female"
  birthDate?: string
  birthRegencyId?: number
  birthProvinceId?: number
  birthPlaceText?: string
  birthType?: "id" | "ln"
  graduationYear?: number
  professionId?: number
  status?: "active" | "inactive" | "alumni"
  joinedAt?: string
}

interface Step1Props {
  slug: string
  professions: RefProfession[]
  onSuccess: (memberId: string) => void
  /** Jika ada memberId → mode edit (pakai updateMemberAction) */
  memberId?: string
  defaultValues?: Step1DefaultValues
}

interface SimpleItem {
  value: string
  label: string
}

// ─── Input teks dengan label ──────────────────────────────────────────────────

function TextInput({
  label,
  optional,
  ...props
}: React.ComponentProps<"input"> & {
  label: string
  optional?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">
        {label}
        {props.required && <span className="text-destructive ml-0.5">*</span>}
        {optional && (
          <span className="text-muted-foreground font-normal ml-1">(opsional)</span>
        )}
      </label>
      <input
        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        {...props}
      />
    </div>
  )
}

// ─── Combobox generik (untuk data statis / kecil) ─────────────────────────────

function SimpleCombobox({
  label,
  placeholder,
  items,
  value,
  onSelect,
  disabled = false,
  required = false,
  optional = false,
}: {
  label: string
  placeholder: string
  items: SimpleItem[]
  value: string | undefined
  onSelect: (value: string) => void
  disabled?: boolean
  required?: boolean
  optional?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const selected = items.find((i) => i.value === value)

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
        {optional && (
          <span className="text-muted-foreground font-normal ml-1">(opsional)</span>
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
                {items.map((item) => (
                  <CommandItem
                    key={item.value}
                    value={item.label}
                    onSelect={() => {
                      onSelect(item.value)
                      setOpen(false)
                    }}
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

// ─── Combobox profesi (grouped by category) ───────────────────────────────────

function ProfessionCombobox({
  professions,
  value,
  onSelect,
}: {
  professions: RefProfession[]
  value: number | undefined
  onSelect: (id: number | undefined) => void
}) {
  const [open, setOpen] = React.useState(false)
  const selected = professions.find((p) => p.id === value)

  // Group by category — pertahankan urutan kemunculan pertama tiap category
  const grouped = professions.reduce<Record<string, RefProfession[]>>(
    (acc, p) => {
      if (!acc[p.category]) acc[p.category] = []
      acc[p.category].push(p)
      return acc
    },
    {}
  )

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">
        Profesi{" "}
        <span className="text-muted-foreground font-normal">(opsional)</span>
      </span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between font-normal",
              !selected && "text-muted-foreground"
            )}
          >
            {selected?.name ?? "Pilih profesi"}
            <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
        >
          <Command>
            <CommandInput placeholder="Cari profesi..." />
            <CommandList>
              <CommandEmpty>Profesi tidak ditemukan.</CommandEmpty>
              {/* Opsi clear */}
              <CommandGroup>
                <CommandItem
                  value="__clear__"
                  onSelect={() => {
                    onSelect(undefined)
                    setOpen(false)
                  }}
                >
                  <CheckIcon
                    className={cn(
                      "mr-2 size-4",
                      !value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="text-muted-foreground">Tidak dipilih</span>
                </CommandItem>
              </CommandGroup>
              {/* Grouped entries */}
              {Object.entries(grouped).map(([category, items]) => (
                <CommandGroup key={category} heading={category}>
                  {items.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={p.name}
                      onSelect={() => {
                        onSelect(p.id)
                        setOpen(false)
                      }}
                    >
                      <CheckIcon
                        className={cn(
                          "mr-2 size-4",
                          value === p.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {p.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}

// ─── Data statis ──────────────────────────────────────────────────────────────

const GENDER_ITEMS: SimpleItem[] = [
  { value: "male", label: "Laki-laki" },
  { value: "female", label: "Perempuan" },
]

const STATUS_ITEMS: SimpleItem[] = [
  { value: "active", label: "Aktif" },
  { value: "inactive", label: "Tidak Aktif" },
  { value: "alumni", label: "Alumni" },
]

const TODAY = new Date().toISOString().split("T")[0]
const CURRENT_YEAR = new Date().getFullYear()

// ─── Step 1: Identitas ────────────────────────────────────────────────────────

export function Step1Identity({ slug, professions, onSuccess, memberId: editMemberId, defaultValues }: Step1Props) {
  // Combobox state — diinit dari defaultValues jika mode edit
  const [gender, setGender] = React.useState<string | undefined>(defaultValues?.gender)
  const [status, setStatus] = React.useState<string>(defaultValues?.status ?? "active")
  const [professionId, setProfessionId] = React.useState<number | undefined>(defaultValues?.professionId)

  // Tempat lahir
  const [birthType, setBirthType] = React.useState<"id" | "ln">(defaultValues?.birthType ?? "id")
  const [birthProvinceId, setBirthProvinceId] = React.useState<number | undefined>(defaultValues?.birthProvinceId)
  const [birthRegencyId, setBirthRegencyId] = React.useState<number | undefined>(defaultValues?.birthRegencyId)
  const [provinces, setProvinces] = React.useState<{ id: number; name: string }[]>([])
  const [regencies, setRegencies] = React.useState<{ id: number; name: string; type: string }[]>([])
  const [loadingProvinces, setLoadingProvinces] = React.useState(false)
  const [loadingRegencies, setLoadingRegencies] = React.useState(false)

  // Form state
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Ambil provinsi saat mode Indonesia (termasuk saat pertama mount di edit mode)
  React.useEffect(() => {
    if (birthType !== "id" || provinces.length > 0) return
    setLoadingProvinces(true)
    fetch("/api/ref/provinces")
      .then((r) => r.json())
      .then(setProvinces)
      .finally(() => setLoadingProvinces(false))
  }, [birthType, provinces.length])

  // Ambil kabupaten/kota saat provinsi berubah (atau pre-load untuk edit mode)
  React.useEffect(() => {
    if (!birthProvinceId) {
      setRegencies([])
      return
    }
    setLoadingRegencies(true)
    fetch(`/api/ref/regencies?province_id=${birthProvinceId}`)
      .then((r) => r.json())
      .then(setRegencies)
      .finally(() => setLoadingRegencies(false))
  }, [birthProvinceId])

  function handleBirthTypeChange(type: "id" | "ln") {
    setBirthType(type)
    setBirthProvinceId(undefined)
    setBirthRegencyId(undefined)
    setRegencies([])
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const fd = new FormData(e.currentTarget)

    const data = {
      name: (fd.get("name") as string).trim(),
      nik: (fd.get("nik") as string)?.trim() || undefined,
      stambukNumber: (fd.get("stambukNumber") as string)?.trim() || undefined,
      gender: (gender as "male" | "female") || undefined,
      birthDate: (fd.get("birthDate") as string) || undefined,
      birthRegencyId: birthType === "id" ? birthRegencyId : undefined,
      birthPlaceText:
        birthType === "ln"
          ? (fd.get("birthPlaceText") as string)?.trim() || undefined
          : undefined,
      graduationYear: fd.get("graduationYear")
        ? Number(fd.get("graduationYear"))
        : undefined,
      professionId,
      status: (status as "active" | "inactive" | "alumni") || "active",
      joinedAt: (fd.get("joinedAt") as string) || undefined,
    }

    // Mode edit: pakai updateMemberAction; mode create: pakai createMemberAction
    const result = editMemberId
      ? await updateMemberAction(slug, editMemberId, data)
      : await createMemberAction(slug, data)

    if (result.success) {
      onSuccess(result.memberId)
    } else {
      setError(result.error)
      setLoading(false)
    }
  }

  // Items untuk province/regency combobox
  const provinceItems: SimpleItem[] = provinces.map((p) => ({
    value: String(p.id),
    label: p.name,
  }))
  const regencyItems: SimpleItem[] = regencies.map((r) => ({
    value: String(r.id),
    label: r.name,
  }))

  return (
    <form
      id="wizard-step-1-form"
      onSubmit={handleSubmit}
      className="space-y-5"
    >
      {/* ── Nama Lengkap ── */}
      <TextInput
        label="Nama Lengkap"
        name="name"
        required
        placeholder="Masukkan nama lengkap"
        autoComplete="off"
        defaultValue={defaultValues?.name}
        disabled={loading}
      />

      {/* ── NIK + Nomor Stambuk ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput
          label="NIK"
          name="nik"
          optional
          placeholder="16 digit NIK"
          maxLength={16}
          inputMode="numeric"
          pattern="[0-9]{0,16}"
          defaultValue={defaultValues?.nik}
          disabled={loading}
        />
        <TextInput
          label="Nomor Stambuk Gontor"
          name="stambukNumber"
          optional
          placeholder="Nomor stambuk santri"
          defaultValue={defaultValues?.stambukNumber}
          disabled={loading}
        />
      </div>

      {/* ── Jenis Kelamin + Tanggal Lahir ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SimpleCombobox
          label="Jenis Kelamin"
          required
          placeholder="Pilih jenis kelamin"
          items={GENDER_ITEMS}
          value={gender}
          onSelect={setGender}
          disabled={loading}
        />
        <TextInput
          label="Tanggal Lahir"
          name="birthDate"
          optional
          type="date"
          max={TODAY}
          defaultValue={defaultValues?.birthDate}
          disabled={loading}
        />
      </div>

      {/* ── Tempat Lahir ── */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">
          Tempat Lahir{" "}
          <span className="text-muted-foreground font-normal">(opsional)</span>
        </span>

        {/* Toggle Indonesia / Luar Negeri */}
        <div className="flex overflow-hidden rounded-md border w-fit">
          <button
            type="button"
            onClick={() => handleBirthTypeChange("id")}
            disabled={loading}
            className={cn(
              "px-4 py-1.5 text-sm font-medium transition-colors",
              birthType === "id"
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-muted"
            )}
          >
            Indonesia
          </button>
          <button
            type="button"
            onClick={() => handleBirthTypeChange("ln")}
            disabled={loading}
            className={cn(
              "px-4 py-1.5 text-sm font-medium transition-colors",
              birthType === "ln"
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-muted"
            )}
          >
            Luar Negeri
          </button>
        </div>

        {/* Konten berdasarkan toggle */}
        {birthType === "id" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SimpleCombobox
              label="Provinsi"
              placeholder={loadingProvinces ? "Memuat..." : "Pilih provinsi"}
              items={provinceItems}
              value={birthProvinceId !== undefined ? String(birthProvinceId) : undefined}
              onSelect={(v) => {
                setBirthProvinceId(Number(v))
                setBirthRegencyId(undefined)
                setRegencies([])
              }}
              disabled={loadingProvinces || loading}
            />
            <SimpleCombobox
              label="Kabupaten / Kota"
              placeholder={loadingRegencies ? "Memuat..." : "Pilih kabupaten/kota"}
              items={regencyItems}
              value={birthRegencyId !== undefined ? String(birthRegencyId) : undefined}
              onSelect={(v) => setBirthRegencyId(Number(v))}
              disabled={!birthProvinceId || loadingRegencies || loading}
            />
          </div>
        ) : (
          <TextInput
            label="Kota / Negara"
            name="birthPlaceText"
            placeholder="Contoh: Kuala Lumpur, Malaysia"
            defaultValue={defaultValues?.birthPlaceText}
            disabled={loading}
          />
        )}
      </div>

      {/* ── Tahun Lulus + Profesi ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput
          label="Tahun Lulus Gontor"
          name="graduationYear"
          optional
          type="number"
          min={1950}
          max={CURRENT_YEAR}
          placeholder={`1950 – ${CURRENT_YEAR}`}
          defaultValue={defaultValues?.graduationYear}
          disabled={loading}
        />
        <ProfessionCombobox
          professions={professions}
          value={professionId}
          onSelect={setProfessionId}
        />
      </div>

      {/* ── Status Keanggotaan + Tanggal Bergabung ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SimpleCombobox
          label="Status Keanggotaan"
          required
          placeholder="Pilih status"
          items={STATUS_ITEMS}
          value={status}
          onSelect={setStatus}
          disabled={loading}
        />
        <TextInput
          label="Tanggal Bergabung"
          name="joinedAt"
          optional
          type="date"
          defaultValue={TODAY}
          max={TODAY}
          disabled={loading}
        />
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Hidden submit — di-trigger oleh tombol "Lanjut →" di WizardNav via form="wizard-step-1-form" */}
      <button type="submit" className="hidden" aria-hidden="true" />
    </form>
  )
}
