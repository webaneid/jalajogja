"use client"

import * as React from "react"
import { CheckIcon, ChevronsUpDownIcon, PlusIcon, XIcon, SearchIcon } from "lucide-react"
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
  saveMemberPesantrenAction,
  type EducationEntryData,
  type MemberPesantrenEntryData,
} from "@/app/(dashboard)/[tenant]/members/actions"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Step3Props {
  memberId: string
  slug: string
  onSuccess: () => void
  defaultEntries?: EducationEntry[]
  defaultPesantrenEntries?: PesantrenEntry[]
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
  pesantrenId: string
  pesantrenName: string // display only, tidak dikirim ke server
}

export interface PesantrenEntry {
  id: string // local key saja
  pesantrenId: string
  pesantrenName: string // display only
  peran: string
  posisi: string
  tahunMulai: string
  tahunSelesai: string
  catatan: string
}

// ─── Konstanta ────────────────────────────────────────────────────────────────

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

const PERAN_ITEMS = [
  { value: "alumni",   label: "Alumni / Santri" },
  { value: "pengasuh", label: "Pengasuh" },
  { value: "pendiri",  label: "Pendiri" },
  { value: "pengajar", label: "Pengajar / Ustadz" },
  { value: "pengurus", label: "Pengurus" },
  { value: "lainnya",  label: "Lainnya" },
] as const

const LEVELS_WITH_MAJOR = new Set(["D3", "S1", "S2", "S3"])
const LEVEL_ITEMS = EDUCATION_LEVELS.map((l) => ({ value: l, label: l }))
const CAMPUS_ITEMS = GONTOR_CAMPUSES.map((c) => ({ value: c, label: c }))
const CURRENT_YEAR = new Date().getFullYear()

// ─── Helper: buat entry kosong ────────────────────────────────────────────────

function newEducationEntry(): EducationEntry {
  return {
    id: crypto.randomUUID(),
    level: "", institutionName: "", major: "",
    startYear: "", endYear: "",
    isGontor: false, gontorCampus: "",
    pesantrenId: "", pesantrenName: "",
  }
}

function newPesantrenEntry(): PesantrenEntry {
  return {
    id: crypto.randomUUID(),
    pesantrenId: "", pesantrenName: "",
    peran: "alumni", posisi: "",
    tahunMulai: "", tahunSelesai: "", catatan: "",
  }
}

// ─── Sub-komponen: Combobox generik ──────────────────────────────────────────

function SimpleCombobox({
  label, placeholder, items, value, onSelect, disabled = false, required = false,
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
            type="button" variant="outline" role="combobox"
            aria-expanded={open} disabled={disabled}
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
                {items.map((item) => (
                  <CommandItem
                    key={item.value} value={item.label}
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

// ─── Sub-komponen: Pesantren Combobox (async search) ─────────────────────────

type PesantrenOption = { id: string; name: string; popularName: string | null; sistem: string | null }

function PesantrenCombobox({
  label = "Pesantren di Direktori",
  placeholder = "Cari pesantren...",
  value, valueName, onSelect, disabled = false,
}: {
  label?: string
  placeholder?: string
  value: string
  valueName: string
  onSelect: (id: string, name: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [options, setOptions] = React.useState<PesantrenOption[]>([])
  const [fetching, setFetching] = React.useState(false)

  // Fetch saat open atau search berubah (debounced)
  React.useEffect(() => {
    if (!open) return
    const timer = setTimeout(async () => {
      setFetching(true)
      try {
        const res = await fetch(`/api/ref/pesantren?search=${encodeURIComponent(search)}&limit=20`)
        if (res.ok) {
          const json = await res.json()
          setOptions(json.data ?? [])
        }
      } finally {
        setFetching(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [open, search])

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button" variant="outline" role="combobox"
            aria-expanded={open} disabled={disabled}
            className={cn("w-full justify-between font-normal", !value && "text-muted-foreground")}
          >
            {valueName || placeholder}
            <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <div className="flex items-center border-b px-3">
            <SearchIcon className="mr-2 size-4 shrink-0 opacity-50" />
            <input
              className="flex h-9 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
              placeholder="Ketik nama pesantren..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="max-h-48 overflow-y-auto py-1">
            {fetching && (
              <div className="px-4 py-2 text-sm text-muted-foreground">Mencari...</div>
            )}
            {!fetching && options.length === 0 && (
              <div className="px-4 py-2 text-sm text-muted-foreground">
                {search.length < 2 ? "Ketik minimal 2 huruf untuk cari" : "Tidak ditemukan"}
              </div>
            )}
            {options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => { onSelect(opt.id, opt.popularName ?? opt.name); setOpen(false) }}
                className={cn(
                  "flex w-full items-start gap-2 px-4 py-2 text-left text-sm hover:bg-accent",
                  value === opt.id && "bg-accent"
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{opt.name}</div>
                  {opt.popularName && opt.popularName !== opt.name && (
                    <div className="text-xs text-muted-foreground truncate">{opt.popularName}</div>
                  )}
                </div>
                {opt.sistem && (
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs capitalize">
                    {opt.sistem.replace("_", " ")}
                  </span>
                )}
              </button>
            ))}
            {value && (
              <button
                type="button"
                onClick={() => { onSelect("", ""); setOpen(false) }}
                className="flex w-full items-center px-4 py-2 text-sm text-destructive hover:bg-destructive/10"
              >
                <XIcon className="mr-2 size-3.5" /> Hapus pilihan
              </button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

// ─── Sub-komponen: Field wrapper ──────────────────────────────────────────────

function Field({ label, required, optional, children }: {
  label: string; required?: boolean; optional?: boolean; children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
        {optional && <span className="ml-1 font-normal text-muted-foreground">(opsional)</span>}
      </span>
      {children}
    </div>
  )
}

const inputCls =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"

// ─── Sub-komponen: Education card ─────────────────────────────────────────────

function EducationCard({ entry, index, canRemove, disabled, onChange, onRemove }: {
  entry: EducationEntry; index: number; canRemove: boolean; disabled: boolean
  onChange: <K extends keyof EducationEntry>(field: K, value: EducationEntry[K]) => void
  onRemove: () => void
}) {
  const showMajor = LEVELS_WITH_MAJOR.has(entry.level)

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">Pendidikan #{index + 1}</span>
        <button
          type="button" onClick={onRemove} disabled={!canRemove || disabled}
          title={canRemove ? "Hapus entry ini" : "Tidak bisa hapus entry terakhir"}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-30"
        >
          <XIcon className="size-3.5" /> Hapus
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SimpleCombobox
          label="Level Pendidikan" required placeholder="Pilih level"
          items={LEVEL_ITEMS} value={entry.level}
          onSelect={(v) => { onChange("level", v); if (!LEVELS_WITH_MAJOR.has(v)) onChange("major", "") }}
          disabled={disabled}
        />
        <Field label="Nama Institusi" required>
          <input
            type="text" value={entry.institutionName}
            onChange={(e) => onChange("institutionName", e.target.value)}
            placeholder="Contoh: SMA Negeri 1 Ponorogo"
            disabled={disabled} className={inputCls}
          />
        </Field>
      </div>

      {showMajor && (
        <Field label="Jurusan" optional>
          <input
            type="text" value={entry.major}
            onChange={(e) => onChange("major", e.target.value)}
            placeholder="Contoh: Teknik Informatika"
            disabled={disabled} className={inputCls}
          />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field label="Tahun Masuk" optional>
          <input
            type="number" value={entry.startYear}
            onChange={(e) => onChange("startYear", e.target.value)}
            placeholder={String(CURRENT_YEAR)} min={1950} max={CURRENT_YEAR}
            disabled={disabled} className={inputCls}
          />
        </Field>
        <Field label="Tahun Selesai" optional>
          <input
            type="number" value={entry.endYear}
            onChange={(e) => onChange("endYear", e.target.value)}
            placeholder="Kosongkan jika masih aktif" min={1950} max={CURRENT_YEAR + 10}
            disabled={disabled} className={inputCls}
          />
        </Field>
      </div>

      {/* Link ke pesantren di direktori (opsional) */}
      <PesantrenCombobox
        label="Link ke Pesantren (opsional)"
        placeholder="Cari pesantren di direktori..."
        value={entry.pesantrenId}
        valueName={entry.pesantrenName}
        onSelect={(id, name) => { onChange("pesantrenId", id); onChange("pesantrenName", name) }}
        disabled={disabled}
      />

      {/* Toggle Gontor */}
      <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium select-none">
        <input
          type="checkbox" checked={entry.isGontor}
          onChange={(e) => { onChange("isGontor", e.target.checked); if (!e.target.checked) onChange("gontorCampus", "") }}
          disabled={disabled} className="h-4 w-4 rounded border-input"
        />
        Alumni / Santri PM Gontor
      </label>

      {entry.isGontor && (
        <SimpleCombobox
          label="Kampus Gontor" placeholder="Pilih kampus"
          items={CAMPUS_ITEMS} value={entry.gontorCampus}
          onSelect={(v) => onChange("gontorCampus", v)}
          disabled={disabled}
        />
      )}
    </div>
  )
}

// ─── Sub-komponen: Pesantren involvement card ─────────────────────────────────

function PesantrenCard({ entry, index, canRemove, disabled, onChange, onRemove }: {
  entry: PesantrenEntry; index: number; canRemove: boolean; disabled: boolean
  onChange: <K extends keyof PesantrenEntry>(field: K, value: PesantrenEntry[K]) => void
  onRemove: () => void
}) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">Pesantren #{index + 1}</span>
        <button
          type="button" onClick={onRemove} disabled={!canRemove || disabled}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-30"
        >
          <XIcon className="size-3.5" /> Hapus
        </button>
      </div>

      <PesantrenCombobox
        label="Pesantren" placeholder="Cari pesantren di direktori..."
        value={entry.pesantrenId} valueName={entry.pesantrenName}
        onSelect={(id, name) => { onChange("pesantrenId", id); onChange("pesantrenName", name) }}
        disabled={disabled}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SimpleCombobox
          label="Peran" required placeholder="Pilih peran"
          items={PERAN_ITEMS as unknown as { value: string; label: string }[]}
          value={entry.peran}
          onSelect={(v) => onChange("peran", v)}
          disabled={disabled}
        />
        <Field label="Posisi / Jabatan" optional>
          <input
            type="text" value={entry.posisi}
            onChange={(e) => onChange("posisi", e.target.value)}
            placeholder="Cth: Musyrif, Direktur KMI"
            disabled={disabled} className={inputCls}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Tahun Mulai" optional>
          <input
            type="number" value={entry.tahunMulai}
            onChange={(e) => onChange("tahunMulai", e.target.value)}
            placeholder={String(CURRENT_YEAR)} min={1950} max={CURRENT_YEAR}
            disabled={disabled} className={inputCls}
          />
        </Field>
        <Field label="Tahun Selesai" optional>
          <input
            type="number" value={entry.tahunSelesai}
            onChange={(e) => onChange("tahunSelesai", e.target.value)}
            placeholder="Kosongkan jika masih aktif" min={1950} max={CURRENT_YEAR + 10}
            disabled={disabled} className={inputCls}
          />
        </Field>
      </div>

      <Field label="Catatan" optional>
        <input
          type="text" value={entry.catatan}
          onChange={(e) => onChange("catatan", e.target.value)}
          placeholder="Keterangan tambahan (opsional)"
          disabled={disabled} className={inputCls}
        />
      </Field>
    </div>
  )
}

// ─── Step 3: Riwayat Pendidikan + Keterlibatan Pesantren ─────────────────────

export function Step3Education({ memberId, slug, onSuccess, defaultEntries, defaultPesantrenEntries }: Step3Props) {
  const [entries, setEntries] = React.useState<EducationEntry[]>(
    defaultEntries && defaultEntries.length > 0 ? defaultEntries : [newEducationEntry()]
  )
  const [pesantrenEntries, setPesantrenEntries] = React.useState<PesantrenEntry[]>(
    defaultPesantrenEntries ?? []
  )
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  function addEntry() { setEntries((prev) => [...prev, newEducationEntry()]) }
  function removeEntry(id: string) { setEntries((prev) => prev.filter((e) => e.id !== id)) }
  function updateEntry<K extends keyof EducationEntry>(id: string, field: K, value: EducationEntry[K]) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)))
  }

  function addPesantrenEntry() { setPesantrenEntries((prev) => [...prev, newPesantrenEntry()]) }
  function removePesantrenEntry(id: string) { setPesantrenEntries((prev) => prev.filter((e) => e.id !== id)) }
  function updatePesantrenEntry<K extends keyof PesantrenEntry>(id: string, field: K, value: PesantrenEntry[K]) {
    setPesantrenEntries((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // Pendidikan
    const educationPayload: EducationEntryData[] = entries
      .filter((e) => e.institutionName.trim())
      .map((e) => ({
        level: e.level,
        institutionName: e.institutionName,
        major: e.major || undefined,
        startYear: e.startYear ? Number(e.startYear) : undefined,
        endYear: e.endYear ? Number(e.endYear) : undefined,
        isGontor: e.isGontor,
        gontorCampus: e.isGontor && e.gontorCampus ? e.gontorCampus : undefined,
        pesantrenId: e.pesantrenId || undefined,
      }))

    // Keterlibatan pesantren
    const pesantrenPayload: MemberPesantrenEntryData[] = pesantrenEntries
      .filter((e) => e.pesantrenId.trim())
      .map((e) => ({
        pesantrenId: e.pesantrenId,
        peran: e.peran as MemberPesantrenEntryData["peran"],
        posisi: e.posisi || undefined,
        tahunMulai: e.tahunMulai ? Number(e.tahunMulai) : undefined,
        tahunSelesai: e.tahunSelesai ? Number(e.tahunSelesai) : undefined,
        catatan: e.catatan || undefined,
      }))

    const [eduResult, pesResult] = await Promise.all([
      saveMemberEducationsAction(slug, memberId, educationPayload),
      saveMemberPesantrenAction(slug, memberId, pesantrenPayload),
    ])

    if (!eduResult.success) {
      setError(eduResult.error ?? "Gagal menyimpan pendidikan.")
      setLoading(false)
      return
    }
    if (!pesResult.success) {
      setError(pesResult.error ?? "Gagal menyimpan keterlibatan pesantren.")
      setLoading(false)
      return
    }

    onSuccess()
  }

  return (
    <form id="wizard-step-3-form" onSubmit={handleSubmit} className="space-y-6">

      {/* ── Bagian 1: Riwayat Pendidikan ── */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold">Riwayat Pendidikan</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tambahkan riwayat sekolah / kuliah. Link ke pesantren opsional.
          </p>
        </div>

        {entries.map((entry, index) => (
          <EducationCard
            key={entry.id} entry={entry} index={index}
            canRemove={entries.length > 1} disabled={loading}
            onChange={(field, value) => updateEntry(entry.id, field, value)}
            onRemove={() => removeEntry(entry.id)}
          />
        ))}

        <button
          type="button" onClick={addEntry} disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-muted-foreground/40 py-3 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:pointer-events-none disabled:opacity-50"
        >
          <PlusIcon className="size-4" /> Tambah Riwayat Pendidikan
        </button>
      </div>

      {/* ── Divider ── */}
      <div className="border-t" />

      {/* ── Bagian 2: Keterlibatan di Pesantren ── */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold">Keterlibatan di Pesantren</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Catat peran di pesantren alumni Gontor — sebagai alumni, pengasuh, pengajar, dll.
          </p>
        </div>

        {pesantrenEntries.length === 0 && (
          <p className="text-sm text-muted-foreground italic">Belum ada data. Klik tombol di bawah untuk menambahkan.</p>
        )}

        {pesantrenEntries.map((entry, index) => (
          <PesantrenCard
            key={entry.id} entry={entry} index={index}
            canRemove={true} disabled={loading}
            onChange={(field, value) => updatePesantrenEntry(entry.id, field, value)}
            onRemove={() => removePesantrenEntry(entry.id)}
          />
        ))}

        <button
          type="button" onClick={addPesantrenEntry} disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-muted-foreground/40 py-3 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:pointer-events-none disabled:opacity-50"
        >
          <PlusIcon className="size-4" /> Tambah Keterlibatan Pesantren
        </button>
      </div>

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
