"use client"

import * as React from "react"
import { CheckIcon, ChevronsUpDownIcon, LoaderIcon } from "lucide-react"
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

// ─── Tipe data wilayah ───────────────────────────────────────────────────────

interface Province {
  id: number
  name: string
}

interface Regency {
  id: number
  name: string
  type: string
}

interface District {
  id: number
  name: string
}

interface Village {
  id: number
  name: string
  type: string
}

// ─── Nilai terpilih dari komponen ────────────────────────────────────────────

export interface WilayahValue {
  provinceId?: number
  regencyId?: number
  districtId?: number
  villageId?: number
}

// ─── Props komponen utama ────────────────────────────────────────────────────

interface WilayahSelectProps {
  /** Nilai awal untuk mode edit */
  defaultValue?: WilayahValue
  /** Dipanggil setiap nilai berubah */
  onChange?: (value: WilayahValue) => void
  /** Nama prefix untuk hidden inputs — misal "address" → address_province_id, dst. */
  namePrefix?: string
  /** Nonaktifkan seluruh komponen */
  disabled?: boolean
  /** Wajib pilih sampai level ini. "province" | "regency" | "district" | "village" */
  requiredLevel?: "province" | "regency" | "district" | "village"
  /** Label custom per level */
  labels?: {
    province?: string
    regency?: string
    district?: string
    village?: string
  }
  className?: string
}

// ─── Combobox generik ────────────────────────────────────────────────────────

interface ComboboxProps<T extends { id: number; name: string }> {
  label: string
  placeholder: string
  emptyText: string
  items: T[]
  value: number | undefined
  onSelect: (id: number) => void
  disabled?: boolean
  loading?: boolean
  renderItem?: (item: T) => React.ReactNode
}

function Combobox<T extends { id: number; name: string }>({
  label,
  placeholder,
  emptyText,
  items,
  value,
  onSelect,
  disabled = false,
  loading = false,
  renderItem,
}: ComboboxProps<T>) {
  const [open, setOpen] = React.useState(false)
  const selected = items.find((item) => item.id === value)

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled || loading}
            className={cn(
              "w-full justify-between font-normal",
              !selected && "text-muted-foreground"
            )}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <LoaderIcon className="size-3.5 animate-spin" />
                Memuat...
              </span>
            ) : (
              selected?.name ?? placeholder
            )}
            <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder={`Cari ${label.toLowerCase()}...`} />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {items.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={item.name}
                    onSelect={() => {
                      onSelect(item.id)
                      setOpen(false)
                    }}
                  >
                    <CheckIcon
                      className={cn(
                        "mr-2 size-4",
                        value === item.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {renderItem ? renderItem(item) : item.name}
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

// ─── Komponen utama WilayahSelect ────────────────────────────────────────────

export function WilayahSelect({
  defaultValue,
  onChange,
  namePrefix,
  disabled = false,
  labels = {},
  className,
}: WilayahSelectProps) {
  // State nilai terpilih
  const [provinceId, setProvinceId] = React.useState<number | undefined>(
    defaultValue?.provinceId
  )
  const [regencyId, setRegencyId] = React.useState<number | undefined>(
    defaultValue?.regencyId
  )
  const [districtId, setDistrictId] = React.useState<number | undefined>(
    defaultValue?.districtId
  )
  const [villageId, setVillageId] = React.useState<number | undefined>(
    defaultValue?.villageId
  )

  // State data list
  const [provinces, setProvinces] = React.useState<Province[]>([])
  const [regencies, setRegencies] = React.useState<Regency[]>([])
  const [districts, setDistricts] = React.useState<District[]>([])
  const [villages, setVillages] = React.useState<Village[]>([])

  // State loading
  const [loadingProvinces, setLoadingProvinces] = React.useState(true)
  const [loadingRegencies, setLoadingRegencies] = React.useState(false)
  const [loadingDistricts, setLoadingDistricts] = React.useState(false)
  const [loadingVillages, setLoadingVillages] = React.useState(false)

  // Ambil semua provinsi saat mount (data kecil, sekali fetch)
  React.useEffect(() => {
    fetch("/api/ref/provinces")
      .then((r) => r.json())
      .then((data) => setProvinces(data))
      .finally(() => setLoadingProvinces(false))
  }, [])

  // Ambil kabupaten saat provinsi berubah
  React.useEffect(() => {
    if (!provinceId) {
      setRegencies([])
      return
    }
    setLoadingRegencies(true)
    fetch(`/api/ref/regencies?province_id=${provinceId}`)
      .then((r) => r.json())
      .then((data) => setRegencies(data))
      .finally(() => setLoadingRegencies(false))
  }, [provinceId])

  // Ambil kecamatan saat kabupaten berubah
  React.useEffect(() => {
    if (!regencyId) {
      setDistricts([])
      return
    }
    setLoadingDistricts(true)
    fetch(`/api/ref/districts?regency_id=${regencyId}`)
      .then((r) => r.json())
      .then((data) => setDistricts(data))
      .finally(() => setLoadingDistricts(false))
  }, [regencyId])

  // Ambil desa/kelurahan saat kecamatan berubah
  React.useEffect(() => {
    if (!districtId) {
      setVillages([])
      return
    }
    setLoadingVillages(true)
    fetch(`/api/ref/villages?district_id=${districtId}`)
      .then((r) => r.json())
      .then((data) => setVillages(data))
      .finally(() => setLoadingVillages(false))
  }, [districtId])

  // Notify parent setiap nilai berubah
  const notify = React.useCallback(
    (pId?: number, rId?: number, dId?: number, vId?: number) => {
      onChange?.({
        provinceId: pId,
        regencyId: rId,
        districtId: dId,
        villageId: vId,
      })
    },
    [onChange]
  )

  // Handler pilih provinsi — reset semua level di bawahnya
  function handleProvinceSelect(id: number) {
    setProvinceId(id)
    setRegencyId(undefined)
    setDistrictId(undefined)
    setVillageId(undefined)
    setRegencies([])
    setDistricts([])
    setVillages([])
    notify(id, undefined, undefined, undefined)
  }

  function handleRegencySelect(id: number) {
    setRegencyId(id)
    setDistrictId(undefined)
    setVillageId(undefined)
    setDistricts([])
    setVillages([])
    notify(provinceId, id, undefined, undefined)
  }

  function handleDistrictSelect(id: number) {
    setDistrictId(id)
    setVillageId(undefined)
    setVillages([])
    notify(provinceId, regencyId, id, undefined)
  }

  function handleVillageSelect(id: number) {
    setVillageId(id)
    notify(provinceId, regencyId, districtId, id)
  }

  return (
    <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2", className)}>
      {/* Hidden inputs untuk form submission */}
      {namePrefix && (
        <>
          <input type="hidden" name={`${namePrefix}_province_id`} value={provinceId ?? ""} />
          <input type="hidden" name={`${namePrefix}_regency_id`} value={regencyId ?? ""} />
          <input type="hidden" name={`${namePrefix}_district_id`} value={districtId ?? ""} />
          <input type="hidden" name={`${namePrefix}_village_id`} value={villageId ?? ""} />
        </>
      )}

      {/* Provinsi */}
      <Combobox
        label={labels.province ?? "Provinsi"}
        placeholder="Pilih provinsi"
        emptyText="Provinsi tidak ditemukan"
        items={provinces}
        value={provinceId}
        onSelect={handleProvinceSelect}
        disabled={disabled}
        loading={loadingProvinces}
      />

      {/* Kabupaten/Kota */}
      <Combobox
        label={labels.regency ?? "Kabupaten / Kota"}
        placeholder="Pilih kabupaten/kota"
        emptyText="Kabupaten/kota tidak ditemukan"
        items={regencies}
        value={regencyId}
        onSelect={handleRegencySelect}
        disabled={disabled || !provinceId}
        loading={loadingRegencies}
        renderItem={(item) => (
          <span>
            <span className="text-xs text-muted-foreground mr-1.5">
              {(item as Regency).type === "kabupaten" ? "Kab." : "Kota"}
            </span>
            {item.name}
          </span>
        )}
      />

      {/* Kecamatan */}
      <Combobox
        label={labels.district ?? "Kecamatan"}
        placeholder="Pilih kecamatan"
        emptyText="Kecamatan tidak ditemukan"
        items={districts}
        value={districtId}
        onSelect={handleDistrictSelect}
        disabled={disabled || !regencyId}
        loading={loadingDistricts}
      />

      {/* Desa / Kelurahan */}
      <Combobox
        label={labels.village ?? "Desa / Kelurahan"}
        placeholder="Pilih desa/kelurahan"
        emptyText="Desa/kelurahan tidak ditemukan"
        items={villages}
        value={villageId}
        onSelect={handleVillageSelect}
        disabled={disabled || !districtId}
        loading={loadingVillages}
        renderItem={(item) => (
          <span>
            <span className="text-xs text-muted-foreground mr-1.5">
              {(item as Village).type === "kelurahan" ? "Kel." : "Desa"}
            </span>
            {item.name}
          </span>
        )}
      />
    </div>
  )
}
