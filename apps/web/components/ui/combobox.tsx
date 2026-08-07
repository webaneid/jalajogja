"use client";

import * as React from "react";
import { ChevronsUpDown, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// ─── Combobox generik (data statis / kecil, filter client-side) ───────────────
// Untuk data besar (>100 items) pakai WilayahSelect yang lazy-fetch

export type ComboboxOption = {
  value: string;
  label: string;
};

type Props = {
  options: ComboboxOption[];
  /**
   * Daftar LEBIH LUAS, dipakai HANYA saat user sedang mengetik pencarian (query tidak kosong) —
   * opsional, default `undefined` = perilaku lama (selalu pakai `options` apa pun kondisinya).
   * Kasus pakai: dropdown yang idle-nya sengaja dibatasi (mis. Bidang Usaha hanya milik sektor
   * terpilih), tapi tetap bisa MENEMUKAN item di luar batasan itu begitu diketik. Tidak
   * dipakai bersamaan `onSearchChange` (mode server-side, filter sudah ditentukan caller).
   */
  searchOptions?: ComboboxOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  /** Jika diberikan, filter dilakukan server-side dan built-in filter dimatikan */
  onSearchChange?: (q: string) => void;
  /** Tampilkan tombol × untuk reset langsung ke "" tanpa buka dropdown (dipakai filter) */
  clearable?: boolean;
};

export function Combobox({
  options,
  searchOptions,
  value,
  onValueChange,
  placeholder = "Pilih...",
  searchPlaceholder = "Cari...",
  emptyText = "Tidak ada pilihan.",
  disabled = false,
  className,
  onSearchChange,
  clearable = false,
}: Props) {
  const [open, setOpen]   = React.useState(false);
  const [query, setQuery] = React.useState("");
  // Label tombol tetap benar meski value sekarang datang dari searchOptions (item di luar
  // daftar idle, mis. hasil pencarian yang sudah tersimpan sebelumnya) — cegah tombol tampak
  // "kosong" untuk pilihan yang sah. Pola sama resolveSectorOptions()'s `currentValue` fallback.
  const selected = options.find((o) => o.value === value)
    ?? searchOptions?.find((o) => o.value === value);
  const sourceOptions = query.trim() && searchOptions ? searchOptions : options;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between overflow-hidden font-normal",
            !selected && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">{selected?.label ?? placeholder}</span>
          {clearable && value ? (
            <span
              role="button"
              aria-label="Reset"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onValueChange(""); }}
              className="ml-2 shrink-0 opacity-60 hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </span>
          ) : (
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <Command shouldFilter={!onSearchChange}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={query}
            onValueChange={(v) => { setQuery(v); onSearchChange?.(v); }}
          />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {sourceOptions.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.label}
                  onSelect={() => {
                    onValueChange(opt.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === opt.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
