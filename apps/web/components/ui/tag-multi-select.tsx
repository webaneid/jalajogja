"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Command, CommandGroup, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";

// ─── TagMultiSelect ────────────────────────────────────────────────────────────
// Multi-select generik dengan autocomplete + rekomendasi + creatable — pilih dari daftar
// kurasi ATAU ketik nilai custom (koma/Enter untuk tambah). Value murni string[] polos,
// TIDAK ada konsep "ID"/entity DB — beda dari TagInput (post-form.tsx) yang DB-backed dan
// panggil server action untuk buat tag baru. Cocok untuk field kurasi+custom seperti
// "Bidang Usaha" (JSONB array), atau kebutuhan multi-select serupa lainnya di seluruh app.

type Props = {
  options:     string[];   // daftar rekomendasi/suggestion
  value:       string[];   // tag yang sudah dipilih
  onChange:    (value: string[]) => void;
  placeholder?: string;
  disabled?:   boolean;
};

export function TagMultiSelect({ options, value, onChange, placeholder, disabled }: Props) {
  const [inputValue, setInputValue] = React.useState("");
  const [open, setOpen]             = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const blurTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchTerm   = inputValue.trim();
  const available     = options.filter((o) => !value.includes(o));
  const filtered       = searchTerm
    ? available.filter((o) => o.toLowerCase().includes(searchTerm.toLowerCase()))
    : available;
  const exactMatch    = options.some((o) => o.toLowerCase() === searchTerm.toLowerCase())
    || value.some((v) => v.toLowerCase() === searchTerm.toLowerCase());
  const canCreate     = searchTerm.length > 0 && !exactMatch;
  const showDropdown  = open && !disabled && (filtered.length > 0 || canCreate);

  function addTag(tag: string) {
    const trimmed = tag.trim();
    if (!trimmed) return;
    if (!value.some((v) => v.toLowerCase() === trimmed.toLowerCase())) {
      onChange([...value, trimmed]);
    }
    setInputValue("");
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function removeTag(tag: string) {
    onChange(value.filter((v) => v !== tag));
  }

  function processInput(raw: string) {
    const name = raw.replace(/,+$/, "").trim();
    if (!name) { setInputValue(""); return; }
    addTag(name);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === ",") {
      e.preventDefault();
      processInput(inputValue);
    } else if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault();
      processInput(inputValue);
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      onChange(value.slice(0, -1));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-0.5 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs text-primary"
            >
              {tag}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="ml-0.5 hover:opacity-70 transition-opacity"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      <Popover open={showDropdown} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => { setInputValue(e.target.value); setOpen(true); }}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
              setOpen(true);
            }}
            onBlur={() => {
              blurTimeoutRef.current = setTimeout(() => setOpen(false), 150);
            }}
            placeholder={placeholder ?? (value.length === 0 ? "Ketik atau pilih, pisah koma..." : "Tambah...")}
            className="h-9 text-sm"
            disabled={disabled}
          />
        </PopoverAnchor>

        <PopoverContent
          className="w-72 p-0"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <Command>
            <CommandList>
              {filtered.length > 0 && (
                <CommandGroup>
                  {filtered.slice(0, 8).map((opt) => (
                    <CommandItem
                      key={opt}
                      value={opt}
                      onMouseDown={(e) => e.preventDefault()}
                      onSelect={() => addTag(opt)}
                    >
                      {opt}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {canCreate && (
                <CommandGroup>
                  <CommandItem
                    value={`__create__${searchTerm}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onSelect={() => addTag(searchTerm)}
                  >
                    Tambah &ldquo;{searchTerm}&rdquo;
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
