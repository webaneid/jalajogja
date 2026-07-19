"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Globe, ChevronDown, X } from "lucide-react";
import type { PublicLinkType, PublicLink } from "@/lib/public-url-registry";
import { iconForType, iconForStaticLabel } from "@/components/ui/public-link-icon";
import { cn } from "@/lib/utils";

// Ikon per tipe/grup/label — lihat components/ui/public-link-icon.tsx (satu-satunya sumber
// kebenaran, dipakai bersama oleh BottomNav mobile juga).
function LinkIcon({ type, group, className }: { type: PublicLinkType; group: string; className?: string }) {
  const cls = cn("h-3.5 w-3.5 shrink-0 text-muted-foreground", className);
  const Icon = iconForType(type, group);
  return <Icon className={cls} />;
}

function StaticIcon({ label, className }: { label: string; className?: string }) {
  const cls = cn("h-3.5 w-3.5 shrink-0 text-muted-foreground", className);
  const Icon = iconForStaticLabel(label);
  return <Icon className={cls} />;
}

// ─────────────────────────────────────────────────────────────────────────────

type Props = {
  slug:         string;
  value?:       string;       // URL yang dipilih
  onChange:     (url: string) => void;
  placeholder?: string;
  className?:   string;
  disabled?:    boolean;
};

export function PublicLinkPicker({
  slug,
  value = "",
  onChange,
  placeholder = "Pilih halaman atau ketik URL...",
  className,
  disabled,
}: Props) {
  const [open,    setOpen]   = useState(false);
  const [query,   setQuery]  = useState("");
  const [links,   setLinks]  = useState<PublicLink[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch saat query berubah (debounce 300ms)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchLinks = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ slug });
      if (q) params.set("q", q);
      const res  = await fetch(`/api/ref/public-links?${params}`, { cache: "no-store" });
      const data = await res.json() as { links: PublicLink[] };
      setLinks(data.links ?? []);
    } catch {
      setLinks([]);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  // Fetch statis saat popover pertama terbuka
  useEffect(() => {
    if (open && links.length === 0 && !query) {
      fetchLinks("");
    }
  }, [open, links.length, query, fetchLinks]);

  // Debounce fetch saat query berubah
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => fetchLinks(query), 300);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query, fetchLinks]);

  // Kelompokkan hasil per group
  const grouped = links.reduce<Record<string, PublicLink[]>>((acc, link) => {
    if (!acc[link.group]) acc[link.group] = [];
    acc[link.group].push(link);
    return acc;
  }, {});

  function handleSelect(url: string) {
    onChange(url);
    setOpen(false);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
  }

  // Label untuk tampilan trigger: cari nama yang cocok dari hasil statis
  const displayUrl = value || "";

  return (
    <div className={cn("relative", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "flex items-center w-full gap-2 rounded-md border border-input bg-background",
              "px-3 py-2 text-sm ring-offset-background text-left",
              "hover:bg-accent/50 transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className={cn("flex-1 truncate", !displayUrl && "text-muted-foreground")}>
              {displayUrl || placeholder}
            </span>
            {displayUrl && (
              <span
                role="button"
                tabIndex={0}
                onClick={handleClear}
                onKeyDown={(e) => e.key === "Enter" && handleClear(e as unknown as React.MouseEvent)}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>

        <PopoverContent
          className="w-[420px] p-0"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Cari halaman, postingan, produk..."
              value={query}
              onValueChange={setQuery}
            />
            <CommandList className="max-h-72">
              {loading && (
                <div className="py-4 text-center text-xs text-muted-foreground">Mencari...</div>
              )}

              {!loading && links.length === 0 && (
                <CommandEmpty>
                  Tidak ada halaman yang cocok.
                </CommandEmpty>
              )}

              {!loading && Object.entries(grouped).map(([group, items]) => (
                <CommandGroup key={group} heading={group}>
                  {items.map((link) => (
                    <CommandItem
                      key={link.url}
                      value={link.url}
                      onSelect={() => handleSelect(link.url)}
                      className="gap-2"
                    >
                      {link.type === "static" ? (
                        <StaticIcon label={link.label} />
                      ) : (
                        <LinkIcon type={link.type} group={link.group} />
                      )}
                      <span className="flex-1 truncate">{link.label}</span>
                      <span className="text-xs text-muted-foreground truncate max-w-[140px]">
                        {link.url}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>

            {/* URL manual */}
            <div className="border-t border-border p-2">
              <div className="flex items-center gap-2">
                <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <Input
                  placeholder="Atau ketik URL manual..."
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  className="h-7 text-xs border-none shadow-none focus-visible:ring-0 px-0"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      setOpen(false);
                    }
                  }}
                />
                {value && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-2 shrink-0"
                    onClick={() => setOpen(false)}
                  >
                    OK
                  </Button>
                )}
              </div>
            </div>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
