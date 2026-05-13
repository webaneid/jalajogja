"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X, Loader2 }          from "lucide-react";

type Regency = {
  id:           number;
  name:         string;
  type:         string;         // "Kabupaten" | "Kota"
  provinceName: string;
};

type Props = {
  label?:       string;
  optional?:    boolean;
  value:        number | null;   // regency id yang dipilih
  displayName?: string | null;   // nama yang ditampilkan (untuk initial load)
  onChange:     (id: number | null, name: string | null) => void;
  placeholder?: string;
  required?:    boolean;
};

export function RegencyCombobox({
  label = "Kabupaten / Kota Tempat Lahir",
  optional,
  value,
  displayName,
  onChange,
  placeholder = "Ketik nama kabupaten / kota...",
  required,
}: Props) {
  const [query,    setQuery]    = useState(displayName ?? "");
  const [results,  setResults]  = useState<Regency[]>([]);
  const [open,     setOpen]     = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [selected, setSelected] = useState<Regency | null>(() =>
    value && displayName
      ? { id: value, name: displayName, type: "", provinceName: "" }
      : null
  );

  const timer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Sync saat data dari server tiba setelah mount (async load)
  useEffect(() => {
    if (value && displayName && !selected) {
      setSelected({ id: value, name: displayName, type: "", provinceName: "" });
      setQuery(displayName);
    }
    if (!value && !displayName) {
      setSelected(null);
      setQuery("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, displayName]);

  // Debounced search
  useEffect(() => {
    if (selected) return;            // sudah dipilih, skip search
    if (timer.current) clearTimeout(timer.current);

    if (query.length < 2) { setResults([]); setOpen(false); return; }

    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res  = await fetch(`/api/ref/regencies?search=${encodeURIComponent(query)}`);
        const data = await res.json() as Regency[];
        setResults(data);
        setOpen(data.length > 0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query, selected]);

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleSelect(reg: Regency) {
    setSelected(reg);
    setQuery(reg.name);
    setOpen(false);
    setResults([]);
    onChange(reg.id, reg.name);
  }

  function handleClear() {
    setSelected(null);
    setQuery("");
    setResults([]);
    setOpen(false);
    onChange(null, null);
  }

  function handleInputChange(val: string) {
    setSelected(null);   // reset pilihan saat user ketik ulang
    setQuery(val);
    onChange(null, null);
  }

  return (
    <div className="flex flex-col gap-1.5" ref={wrapRef}>
      {label && (
        <label className="text-sm font-medium">
          {label}
          {optional && <span className="text-muted-foreground font-normal ml-1">(opsional)</span>}
          {required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />

        <input
          type="text"
          value={query}
          onChange={e => handleInputChange(e.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          placeholder={placeholder}
          autoComplete="off"
          className="flex h-9 w-full rounded-md border border-input bg-background pl-8 pr-8 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />

        {/* Loading / clear */}
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
          {loading
            ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            : selected
              ? <button type="button" onClick={handleClear} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              : null
          }
        </div>

        {/* Dropdown */}
        {open && results.length > 0 && (
          <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md overflow-hidden">
            <ul className="max-h-52 overflow-y-auto py-1">
              {results.map(reg => (
                <li key={reg.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); handleSelect(reg); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 transition-colors flex items-baseline gap-2"
                  >
                    <span className="font-medium">{reg.name}</span>
                    <span className="text-xs text-muted-foreground truncate">{reg.provinceName}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Tidak ditemukan */}
        {open && !loading && query.length >= 2 && results.length === 0 && (
          <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md px-3 py-3 text-sm text-muted-foreground">
            Tidak ditemukan. Coba nama lain.
          </div>
        )}
      </div>

      {/* Info jika sudah dipilih */}
      {selected && (
        <p className="text-xs text-muted-foreground">
          Provinsi: {selected.provinceName}
        </p>
      )}
    </div>
  );
}
