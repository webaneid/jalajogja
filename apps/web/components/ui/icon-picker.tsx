"use client";

import * as React from "react";
import { ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ICON_CATALOG, ICON_CATEGORIES, resolveIcon, DEFAULT_ICON_NAME } from "@/lib/icon-catalog";

// Picker searchable dari katalog kurasi lucide-react (lib/icon-catalog.ts) — dipakai admin untuk
// pilih icon per item repeater (section Keunggulan/Layanan, dll ke depan). Grid per kategori,
// bukan list vertikal — lebih cepat di-scan visual daripada baca nama icon satu-satu.

type Props = {
  value?:     string;
  onChange:   (name: string) => void;
  className?: string;
};

export function IconPicker({ value, onChange, className }: Props) {
  const [open, setOpen] = React.useState(false);
  const SelectedIcon = resolveIcon(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className="flex items-center gap-2 min-w-0">
            <SelectedIcon className="h-4 w-4 shrink-0" />
            <span className="text-xs text-muted-foreground truncate">{value || DEFAULT_ICON_NAME}</span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput placeholder="Cari icon... (mis. uang, aman, cepat)" className="h-9" />
          <CommandList className="max-h-72">
            <CommandEmpty>Tidak ditemukan.</CommandEmpty>
            {ICON_CATEGORIES.map((cat) => {
              const entries = ICON_CATALOG.filter((e) => e.category === cat);
              if (entries.length === 0) return null;
              return (
                <CommandGroup
                  key={cat}
                  heading={cat}
                  className="[&_[cmdk-group-items]]:grid [&_[cmdk-group-items]]:grid-cols-7 [&_[cmdk-group-items]]:gap-1"
                >
                  {entries.map(({ name, Icon, keywords }) => (
                    <CommandItem
                      key={name}
                      value={`${name} ${keywords}`}
                      onSelect={() => { onChange(name); setOpen(false); }}
                      title={name}
                      className={cn(
                        "!flex h-9 w-9 items-center justify-center rounded-md p-0",
                        value === name && "bg-accent text-accent-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
