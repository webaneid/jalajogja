"use client";

import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Command, CommandGroup, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";

// ─── ProfessionTypeCombobox ────────────────────────────────────────────────────
// Combobox creatable single-value: pilih dari daftar kurasi (per kategori profesi)
// atau ketik jenis profesi custom yang belum ada di daftar.
// Fully controlled dari `value` — tidak ada local state terpisah yang bisa stale
// saat parent reset value (mis. ganti antar entry di pola three-view).

export function ProfessionTypeCombobox({
  options,
  value,
  onChange,
  placeholder = "Pilih atau ketik jenis profesi...",
  disabled = false,
}: {
  options:      string[];
  value:        string;
  onChange:     (value: string) => void;
  placeholder?: string;
  disabled?:    boolean;
}) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const searchTerm = value.trim();
  const filtered = searchTerm
    ? options.filter((o) => o.toLowerCase().includes(searchTerm.toLowerCase()))
    : options;
  const exactMatch = options.find((o) => o.toLowerCase() === searchTerm.toLowerCase());
  const canCreate  = searchTerm.length > 0 && !exactMatch;
  const showDropdown = open && (filtered.length > 0 || canCreate);

  function select(v: string) {
    onChange(v);
    setOpen(false);
    setTimeout(() => inputRef.current?.blur(), 0);
  }

  return (
    <Popover open={showDropdown} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && searchTerm) {
              e.preventDefault();
              select(searchTerm);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
        />
      </PopoverAnchor>

      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <Command>
          <CommandList>
            {filtered.length > 0 && (
              <CommandGroup>
                {filtered.map((opt) => (
                  <CommandItem key={opt} value={opt} onSelect={() => select(opt)}>
                    {opt}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {canCreate && (
              <>
                {filtered.length > 0 && <CommandSeparator />}
                <CommandGroup>
                  <CommandItem onSelect={() => select(searchTerm)}>
                    <Plus className="h-3.5 w-3.5" />
                    Gunakan &ldquo;{searchTerm}&rdquo;
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
