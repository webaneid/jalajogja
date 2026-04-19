"use client"

import * as React from "react"
import { CheckIcon, ChevronsUpDownIcon, PlusIcon, XIcon } from "lucide-react"
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
import {
  saveMemberEducationsAction,
  type EducationEntryData,
} from "@/app/(dashboard)/[tenant]/members/actions"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Step3Props {
  memberId: string
  slug: string
  onSuccess: () => void
  defaultEntries?: EducationEntry[]
}

export interface EducationEntry {
  id: string
  level: string
  institutionName: string
  major: string
  startYear: string
  endYear: string
  isGontor: boolean
  gontorCampus: string
}

// ─── Konstanta (mirror dari schema — tidak perlu import) ──────────────────────

const EDUCATION_LEVELS = [
  "TK", "SD", "SMP", "SMA", "D3", "S1", "S2", "S3", "Non-Formal",
] as const

const GONTOR_CAMPUSES = [
  "Gontor 1 (Putra)", "Gontor 2 (Putra)", "Gontor 3 (Putra)",
  "Gontor 4 (Putra)", "Gontor 5 (Putra)", "Gontor 6 (Putra)",
  "Gontor 7 (Putra)", "Gontor 8 (Putra)",
  "Gontor Putri 1",   "Gontor Putri 2",   "Gontor Putri 3",
  "Gontor Putri 4",   "Gontor Putri 5",   "Gontor Putri 6",
] as const

// Level yang memiliki jurusan
const LEVELS_WITH_MAJOR = new Set(["D3", "S1", "S2", "S3"])

const LEVEL_ITEMS = EDUCATION_LEVELS.map((l) => ({ value: l, label: l }))
const CAMPUS_ITEMS = GONTOR_CAMPUSES.map((c) => ({ value: c, label: c }))

const CURRENT_YEAR = new Date().getFullYear()

// ─── Helper: buat entry kosong baru ──────────────────────────────────────────

function newEntry(): EducationEntry {
  return {
    id: crypto.randomUUID(),
    level: "",
    institutionName: "",
    major: "",
    startYear: "",
    endYear: "",
    isGontor: false,
    gontorCampus: "",
  }
}

// ─── Sub-komponen: Combobox generik ──────────────────────────────────────────

function SimpleCombobox({
  label,
  placeholder,
  items,
  value,
  onSelect,
  disabled = false,
  required = false,
}: {
  label: string
  placeholder: string
  items: { value: string; label: string }[]
  value: string
  onSelect: (value: string) => void
  disabled?: boolean
  required?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const selected = items.find((i) => i.value === value)

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
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

// ─── Sub-komponen: text input ─────────────────────────────────────────────────

function Field({
  label,
  required,
  optional,
  children,
}: {
  label: string
  required?: boolean
  optional?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
        {optional && (
          <span className="ml-1 font-normal text-muted-foreground">(opsional)</span>
        )}
      </span>
      {children}
    </div>
  )
}

const inputCls =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"

// ─── Sub-komponen: satu entry card ───────────────────────────────────────────

function EducationCard({
  entry,
  index,
  canRemove,
  disabled,
  onChange,
  onRemove,
}: {
  entry: EducationEntry
  index: number
  canRemove: boolean
  disabled: boolean
  onChange: <K extends keyof EducationEntry>(field: K, value: EducationEntry[K]) => void
  onRemove: () => void
}) {
  const showMajor = LEVELS_WITH_MAJOR.has(entry.level)

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      {/* Header card */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">
          Pendidikan #{index + 1}
        </span>
        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove || disabled}
          title={canRemove ? "Hapus entry ini" : "Tidak bisa hapus entry terakhir"}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-30"
        >
          <XIcon className="size-3.5" />
          Hapus
        </button>
      </div>

      {/* Baris 1: Level + Nama Institusi */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SimpleCombobox
          label="Level Pendidikan"
          required
          placeholder="Pilih level"
          items={LEVEL_ITEMS}
          value={entry.level}
          onSelect={(v) => {
            onChange("level", v)
            if (!LEVELS_WITH_MAJOR.has(v)) onChange("major", "")
          }}
          disabled={disabled}
        />
        <Field label="Nama Institusi" required>
          <input
            type="text"
            value={entry.institutionName}
            onChange={(e) => onChange("institutionName", e.target.value)}
            placeholder="Contoh: SMA Negeri 1 Ponorogo"
            disabled={disabled}
            className={inputCls}
          />
        </Field>
      </div>

      {/* Jurusan — hanya untuk D3/S1/S2/S3 */}
      {showMajor && (
        <Field label="Jurusan" optional>
          <input
            type="text"
            value={entry.major}
            onChange={(e) => onChange("major", e.target.value)}
            placeholder="Contoh: Teknik Informatika"
            disabled={disabled}
            className={inputCls}
          />
        </Field>
      )}

      {/* Baris 2: Tahun Masuk + Tahun Selesai */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Tahun Masuk" optional>
          <input
            type="number"
            value={entry.startYear}
            onChange={(e) => onChange("startYear", e.target.value)}
            placeholder={String(CURRENT_YEAR)}
            min={1950}
            max={CURRENT_YEAR}
            disabled={disabled}
            className={inputCls}
          />
        </Field>
        <Field label="Tahun Selesai" optional>
          <input
            type="number"
            value={entry.endYear}
            onChange={(e) => onChange("endYear", e.target.value)}
            placeholder="Kosongkan jika masih aktif"
            min={1950}
            max={CURRENT_YEAR + 10}
            disabled={disabled}
            className={inputCls}
          />
        </Field>
      </div>

      {/* Toggle Gontor */}
      <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium select-none">
        <input
          type="checkbox"
          checked={entry.isGontor}
          onChange={(e) => {
            onChange("isGontor", e.target.checked)
            if (!e.target.checked) onChange("gontorCampus", "")
          }}
          disabled={disabled}
          className="h-4 w-4 rounded border-input"
        />
        Alumni / Santri PM Gontor
      </label>

      {/* Kampus Gontor — conditional */}
      {entry.isGontor && (
        <SimpleCombobox
          label="Kampus Gontor"
          placeholder="Pilih kampus"
          items={CAMPUS_ITEMS}
          value={entry.gontorCampus}
          onSelect={(v) => onChange("gontorCampus", v)}
          disabled={disabled}
        />
      )}
    </div>
  )
}

// ─── Step 3: Riwayat Pendidikan ───────────────────────────────────────────────

export function Step3Education({ memberId, slug, onSuccess, defaultEntries }: Step3Props) {
  const [entries, setEntries] = React.useState<EducationEntry[]>(
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

  function updateEntry<K extends keyof EducationEntry>(
    id: string,
    field: K,
    value: EducationEntry[K]
  ) {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e))
    )
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const payload: EducationEntryData[] = entries
      .filter((e) => e.institutionName.trim())
      .map((e) => ({
        level: e.level,
        institutionName: e.institutionName,
        major: e.major || undefined,
        startYear: e.startYear ? Number(e.startYear) : undefined,
        endYear: e.endYear ? Number(e.endYear) : undefined,
        isGontor: e.isGontor,
        gontorCampus: e.isGontor && e.gontorCampus ? e.gontorCampus : undefined,
      }))

    const result = await saveMemberEducationsAction(slug, memberId, payload)

    if (result.success) {
      onSuccess()
    } else {
      setError(result.error ?? "Gagal menyimpan.")
      setLoading(false)
    }
  }

  return (
    <form
      id="wizard-step-3-form"
      onSubmit={handleSubmit}
      className="space-y-4"
    >
      {entries.map((entry, index) => (
        <EducationCard
          key={entry.id}
          entry={entry}
          index={index}
          canRemove={entries.length > 1}
          disabled={loading}
          onChange={(field, value) => updateEntry(entry.id, field, value)}
          onRemove={() => removeEntry(entry.id)}
        />
      ))}

      <button
        type="button"
        onClick={addEntry}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-muted-foreground/40 py-3 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:pointer-events-none disabled:opacity-50"
      >
        <PlusIcon className="size-4" />
        Tambah Riwayat Pendidikan
      </button>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <button type="submit" className="hidden" aria-hidden="true" />
    </form>
  )
}
