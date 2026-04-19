"use client"

import * as React from "react"
import { CheckIcon, ChevronsUpDownIcon, PlusIcon, SearchIcon, XIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  saveMemberPesantrenAction,
  type MemberPesantrenEntryData,
} from "@/app/(dashboard)/[tenant]/members/actions"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Step5Props {
  memberId: string
  slug: string
  onSuccess: () => void
  defaultEntries?: PesantrenEntry[]
}

export interface PesantrenEntry {
  id: string          // local key saja (crypto.randomUUID)
  pesantrenId: string
  pesantrenName: string // display only
  peran: string
  posisi: string
  tahunMulai: string
  tahunSelesai: string
  catatan: string
}

// ─── Konstanta ────────────────────────────────────────────────────────────────

const PERAN_ITEMS = [
  { value: "pengasuh", label: "Pengasuh" },
  { value: "pendiri",  label: "Pendiri" },
  { value: "pengurus", label: "Pengurus" },
  { value: "pengajar", label: "Pengajar / Ustadz" },
  { value: "alumni",   label: "Alumni / Santri" },
  { value: "lainnya",  label: "Lainnya" },
]

const CURRENT_YEAR = new Date().getFullYear()

// ─── Helper ───────────────────────────────────────────────────────────────────

function newEntry(): PesantrenEntry {
  return {
    id: crypto.randomUUID(),
    pesantrenId: "", pesantrenName: "",
    peran: "pengasuh", posisi: "",
    tahunMulai: "", tahunSelesai: "", catatan: "",
  }
}

// ─── Sub-komponen: Pesantren search combobox (async) ─────────────────────────

type PesantrenOption = {
  id: string
  name: string
  popularName: string | null
  sistem: string | null
}

function PesantrenCombobox({
  value, valueName, onSelect, disabled = false,
}: {
  value: string
  valueName: string
  onSelect: (id: string, name: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [options, setOptions] = React.useState<PesantrenOption[]>([])
  const [fetching, setFetching] = React.useState(false)

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
      <span className="text-sm font-medium text-foreground">
        Pesantren<span className="text-destructive ml-0.5">*</span>
      </span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button" variant="outline" role="combobox"
            aria-expanded={open} disabled={disabled}
            className={cn("w-full justify-between font-normal", !value && "text-muted-foreground")}
          >
            {valueName || "Cari pesantren di direktori..."}
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
          <div className="max-h-52 overflow-y-auto py-1">
            {fetching && (
              <div className="px-4 py-2 text-sm text-muted-foreground">Mencari...</div>
            )}
            {!fetching && options.length === 0 && (
              <div className="px-4 py-2 text-sm text-muted-foreground">
                {search.length < 2 ? "Ketik minimal 2 huruf untuk cari" : "Tidak ditemukan di direktori"}
              </div>
            )}
            {options.map((opt) => (
              <button
                key={opt.id} type="button"
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

// ─── Sub-komponen: Combobox sederhana ────────────────────────────────────────

function SimpleCombobox({
  label, placeholder, items, value, onSelect, disabled = false, required = false,
}: {
  label: string; placeholder: string
  items: { value: string; label: string }[]
  value: string; onSelect: (v: string) => void
  disabled?: boolean; required?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const selected = items.find((i) => i.value === value)

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
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
          <div className="max-h-52 overflow-y-auto py-1">
            {items.map((item) => (
              <button
                key={item.value} type="button"
                onClick={() => { onSelect(item.value); setOpen(false) }}
                className={cn(
                  "flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-accent",
                  value === item.value && "bg-accent"
                )}
              >
                <CheckIcon className={cn("size-4", value === item.value ? "opacity-100" : "opacity-0")} />
                {item.label}
              </button>
            ))}
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

// ─── Sub-komponen: Pesantren card ─────────────────────────────────────────────

function PesantrenCard({ entry, index, disabled, onChange, onRemove }: {
  entry: PesantrenEntry; index: number; disabled: boolean
  onChange: <K extends keyof PesantrenEntry>(field: K, value: PesantrenEntry[K]) => void
  onRemove: () => void
}) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">Pesantren #{index + 1}</span>
        <button
          type="button" onClick={onRemove} disabled={disabled}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-30"
        >
          <XIcon className="size-3.5" /> Hapus
        </button>
      </div>

      {/* Pilih pesantren dari direktori */}
      <PesantrenCombobox
        value={entry.pesantrenId} valueName={entry.pesantrenName}
        onSelect={(id, name) => { onChange("pesantrenId", id); onChange("pesantrenName", name) }}
        disabled={disabled}
      />

      {/* Peran + Posisi */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SimpleCombobox
          label="Peran" required placeholder="Pilih peran"
          items={PERAN_ITEMS} value={entry.peran}
          onSelect={(v) => onChange("peran", v)}
          disabled={disabled}
        />
        <Field label="Posisi / Jabatan" optional>
          <input
            type="text" value={entry.posisi}
            onChange={(e) => onChange("posisi", e.target.value)}
            placeholder="Cth: Direktur KMI, Musyrif"
            disabled={disabled} className={inputCls}
          />
        </Field>
      </div>

      {/* Tahun mulai + selesai */}
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
          placeholder="Keterangan tambahan"
          disabled={disabled} className={inputCls}
        />
      </Field>
    </div>
  )
}

// ─── Step 5: Pesantren Milik / Kelolaan Anggota ───────────────────────────────

export function Step5Pesantren({ memberId, slug, onSuccess, defaultEntries }: Step5Props) {
  const [entries, setEntries] = React.useState<PesantrenEntry[]>(
    defaultEntries && defaultEntries.length > 0 ? defaultEntries : []
  )
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  function addEntry() { setEntries((prev) => [...prev, newEntry()]) }
  function removeEntry(id: string) { setEntries((prev) => prev.filter((e) => e.id !== id)) }
  function updateEntry<K extends keyof PesantrenEntry>(id: string, field: K, value: PesantrenEntry[K]) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const payload: MemberPesantrenEntryData[] = entries
      .filter((e) => e.pesantrenId.trim())
      .map((e) => ({
        pesantrenId: e.pesantrenId,
        peran: e.peran as MemberPesantrenEntryData["peran"],
        posisi: e.posisi || undefined,
        tahunMulai: e.tahunMulai ? Number(e.tahunMulai) : undefined,
        tahunSelesai: e.tahunSelesai ? Number(e.tahunSelesai) : undefined,
        catatan: e.catatan || undefined,
      }))

    const result = await saveMemberPesantrenAction(slug, memberId, payload)

    if (result.success) {
      onSuccess()
    } else {
      setError(result.error ?? "Gagal menyimpan.")
      setLoading(false)
    }
  }

  return (
    <form id="wizard-step-5-form" onSubmit={handleSubmit} className="space-y-4">
      <div className="mb-2">
        <p className="text-sm text-muted-foreground">
          Catat pesantren yang dimiliki, diasuh, atau dikelola oleh anggota ini.
          Pesantren harus sudah terdaftar di direktori.
        </p>
      </div>

      {entries.length === 0 && (
        <p className="text-sm text-muted-foreground italic text-center py-4">
          Belum ada data. Klik tombol di bawah untuk menambahkan.
        </p>
      )}

      {entries.map((entry, index) => (
        <PesantrenCard
          key={entry.id} entry={entry} index={index}
          disabled={loading}
          onChange={(field, value) => updateEntry(entry.id, field, value)}
          onRemove={() => removeEntry(entry.id)}
        />
      ))}

      <button
        type="button" onClick={addEntry} disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-muted-foreground/40 py-3 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:pointer-events-none disabled:opacity-50"
      >
        <PlusIcon className="size-4" /> Tambah Pesantren
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
