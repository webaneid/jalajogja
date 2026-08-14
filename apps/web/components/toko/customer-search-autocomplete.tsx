"use client";

import { useEffect, useRef, useState } from "react";
import { Search, User, UserCircle } from "lucide-react";
import type { CustomerSearchResult } from "@/app/api/ref/customer-search/route";

export type SelectedCustomer = CustomerSearchResult;

type Props = {
  slug:        string;
  value:       string;
  onChange:    (name: string) => void;
  onSelect:    (customer: SelectedCustomer | null) => void;
  placeholder?: string;
  className?:  string;
};

// Autocomplete gabungan: cari nama pelanggan dari Anggota (public.members, scoped ke tenant
// ini) MAUPUN Akun Publik (public.profiles) sekaligus. Dipakai di form buat pesanan manual
// toko (/toko/pesanan/new) — mengisi otomatis telepon+email begitu dipilih dari dropdown.
// Pola debounce/click-outside/onMouseDown identik MemberNameAutocomplete
// (components/keuangan/member-name-autocomplete.tsx).
export function CustomerSearchAutocomplete({ slug, value, onChange, onSelect, placeholder, className }: Props) {
  const [results, setResults] = useState<CustomerSearchResult[]>([]);
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/ref/customer-search?slug=${slug}&q=${encodeURIComponent(q)}`);
        if (!res.ok) return;
        const data = (await res.json()) as { items: CustomerSearchResult[] };
        setResults(data.items ?? []);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [value, slug]);

  function handleInputChange(v: string) {
    onChange(v);
    onSelect(null);
  }

  function handlePick(item: CustomerSearchResult) {
    onChange(item.name);
    onSelect(item);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder ?? "Cari nama anggota atau akun publik..."}
          className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {open && (loading || results.length > 0) && (
        <div className="absolute z-30 top-full mt-1 w-full rounded-md border border-border bg-background shadow-lg max-h-64 overflow-y-auto">
          {loading && (
            <div className="px-3 py-2 text-xs text-muted-foreground">Mencari...</div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">Tidak ditemukan. Ketik nama pelanggan secara manual.</div>
          )}
          {results.map((item) => (
            <button
              key={`${item.type}-${item.id}`}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handlePick(item); }}
              className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
            >
              {item.type === "member" ? (
                <User className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              ) : (
                <UserCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{item.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {item.type === "member" ? "Anggota" : "Akun Publik"}
                  {item.memberNumber ? ` · ${item.memberNumber}` : ""}
                  {item.phone ? ` · ${item.phone}` : ""}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
