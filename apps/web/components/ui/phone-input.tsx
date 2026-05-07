"use client";

import { useState, useEffect, useRef } from "react";
import { Search, ChevronDown }          from "lucide-react";
import { cn }                           from "@/lib/utils";

// ─── Data negara ──────────────────────────────────────────────────────────────

export type Country = {
  code: string; // ISO 3166-1 alpha-2
  name: string; // nama dalam Bahasa Indonesia
  dial: string; // dial code e.g. "+62"
  flag: string; // emoji flag
};

// Diurutkan: Indonesia di atas, sisanya alfabet
export const COUNTRIES: Country[] = [
  { code: "ID", name: "Indonesia",        dial: "+62",  flag: "🇮🇩" },
  { code: "MY", name: "Malaysia",         dial: "+60",  flag: "🇲🇾" },
  { code: "SA", name: "Arab Saudi",       dial: "+966", flag: "🇸🇦" },
  { code: "EG", name: "Mesir",            dial: "+20",  flag: "🇪🇬" },
  { code: "AE", name: "Uni Emirat Arab",  dial: "+971", flag: "🇦🇪" },
  { code: "QA", name: "Qatar",            dial: "+974", flag: "🇶🇦" },
  { code: "KW", name: "Kuwait",           dial: "+965", flag: "🇰🇼" },
  { code: "OM", name: "Oman",             dial: "+968", flag: "🇴🇲" },
  { code: "BH", name: "Bahrain",          dial: "+973", flag: "🇧🇭" },
  { code: "JO", name: "Yordania",         dial: "+962", flag: "🇯🇴" },
  { code: "TR", name: "Turki",            dial: "+90",  flag: "🇹🇷" },
  { code: "SD", name: "Sudan",            dial: "+249", flag: "🇸🇩" },
  { code: "LY", name: "Libya",            dial: "+218", flag: "🇱🇾" },
  { code: "MA", name: "Maroko",           dial: "+212", flag: "🇲🇦" },
  { code: "DZ", name: "Aljazair",         dial: "+213", flag: "🇩🇿" },
  { code: "TN", name: "Tunisia",          dial: "+216", flag: "🇹🇳" },
  { code: "SG", name: "Singapura",        dial: "+65",  flag: "🇸🇬" },
  { code: "BN", name: "Brunei",           dial: "+673", flag: "🇧🇳" },
  { code: "TH", name: "Thailand",         dial: "+66",  flag: "🇹🇭" },
  { code: "PH", name: "Filipina",         dial: "+63",  flag: "🇵🇭" },
  { code: "PK", name: "Pakistan",         dial: "+92",  flag: "🇵🇰" },
  { code: "IN", name: "India",            dial: "+91",  flag: "🇮🇳" },
  { code: "BD", name: "Bangladesh",       dial: "+880", flag: "🇧🇩" },
  { code: "JP", name: "Jepang",           dial: "+81",  flag: "🇯🇵" },
  { code: "KR", name: "Korea Selatan",    dial: "+82",  flag: "🇰🇷" },
  { code: "CN", name: "Tiongkok",         dial: "+86",  flag: "🇨🇳" },
  { code: "TW", name: "Taiwan",           dial: "+886", flag: "🇹🇼" },
  { code: "HK", name: "Hong Kong",        dial: "+852", flag: "🇭🇰" },
  { code: "AU", name: "Australia",        dial: "+61",  flag: "🇦🇺" },
  { code: "NZ", name: "Selandia Baru",    dial: "+64",  flag: "🇳🇿" },
  { code: "GB", name: "Inggris",          dial: "+44",  flag: "🇬🇧" },
  { code: "DE", name: "Jerman",           dial: "+49",  flag: "🇩🇪" },
  { code: "NL", name: "Belanda",          dial: "+31",  flag: "🇳🇱" },
  { code: "FR", name: "Prancis",          dial: "+33",  flag: "🇫🇷" },
  { code: "BE", name: "Belgia",           dial: "+32",  flag: "🇧🇪" },
  { code: "IT", name: "Italia",           dial: "+39",  flag: "🇮🇹" },
  { code: "ES", name: "Spanyol",          dial: "+34",  flag: "🇪🇸" },
  { code: "CH", name: "Swiss",            dial: "+41",  flag: "🇨🇭" },
  { code: "SE", name: "Swedia",           dial: "+46",  flag: "🇸🇪" },
  { code: "NO", name: "Norwegia",         dial: "+47",  flag: "🇳🇴" },
  { code: "DK", name: "Denmark",          dial: "+45",  flag: "🇩🇰" },
  { code: "FI", name: "Finlandia",        dial: "+358", flag: "🇫🇮" },
  { code: "RU", name: "Rusia",            dial: "+7",   flag: "🇷🇺" },
  { code: "US", name: "Amerika Serikat",  dial: "+1",   flag: "🇺🇸" },
  { code: "CA", name: "Kanada",           dial: "+1",   flag: "🇨🇦" },
  { code: "BR", name: "Brasil",           dial: "+55",  flag: "🇧🇷" },
  { code: "ZA", name: "Afrika Selatan",   dial: "+27",  flag: "🇿🇦" },
  { code: "NG", name: "Nigeria",          dial: "+234", flag: "🇳🇬" },
  { code: "IQ", name: "Irak",             dial: "+964", flag: "🇮🇶" },
  { code: "IR", name: "Iran",             dial: "+98",  flag: "🇮🇷" },
  { code: "YE", name: "Yaman",            dial: "+967", flag: "🇾🇪" },
  { code: "SO", name: "Somalia",          dial: "+252", flag: "🇸🇴" },
  { code: "ET", name: "Etiopia",          dial: "+251", flag: "🇪🇹" },
  { code: "MM", name: "Myanmar",          dial: "+95",  flag: "🇲🇲" },
  { code: "VN", name: "Vietnam",          dial: "+84",  flag: "🇻🇳" },
  { code: "MV", name: "Maladewa",         dial: "+960", flag: "🇲🇻" },
  { code: "LB", name: "Lebanon",          dial: "+961", flag: "🇱🇧" },
];

const DEFAULT_COUNTRY = COUNTRIES[0]; // Indonesia

// ─── Helper: parse E.164 → { country, localNumber } ──────────────────────────

function parseE164(value: string): { country: Country; localNumber: string } {
  if (!value) return { country: DEFAULT_COUNTRY, localNumber: "" };

  // Cari dial code yang cocok (coba yang paling panjang dulu)
  const sorted = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  for (const c of sorted) {
    if (value.startsWith(c.dial)) {
      return { country: c, localNumber: value.slice(c.dial.length) };
    }
  }

  // Format lama (08xxx) → konversi ke Indonesia
  if (value.startsWith("0")) {
    return { country: DEFAULT_COUNTRY, localNumber: value.slice(1) };
  }

  return { country: DEFAULT_COUNTRY, localNumber: value };
}

// ─── PhoneInput ───────────────────────────────────────────────────────────────

type Props = {
  label:       string;
  optional?:   boolean;
  required?:   boolean;
  value:       string;         // E.164 full value, e.g. "+628xxxxxxxxx"
  onChange:    (e164: string) => void;
  disabled?:   boolean;
  placeholder?: string;
  hint?:        string;
};

export function PhoneInput({
  label,
  optional,
  required,
  value,
  onChange,
  disabled,
  placeholder = "8xxxxxxxxxx",
  hint,
}: Props) {
  const parsed               = parseE164(value);
  const [country, setCountry] = useState<Country>(parsed.country);
  const [number,  setNumber]  = useState(parsed.localNumber);
  const [open,    setOpen]    = useState(false);
  const [query,   setQuery]   = useState("");
  const wrapRef               = useRef<HTMLDivElement>(null);
  const inputRef              = useRef<HTMLInputElement>(null);

  // Sync dari luar (misal saat data dari server di-load)
  useEffect(() => {
    if (!value) { setNumber(""); return; }
    const p = parseE164(value);
    setCountry(p.country);
    setNumber(p.localNumber);
  }, [value]);

  // Tutup dropdown saat klik luar
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function emit(c: Country, n: string) {
    const normalized = n.replace(/^0+/, ""); // strip leading 0
    onChange(normalized ? `${c.dial}${normalized}` : "");
  }

  function handleCountrySelect(c: Country) {
    setCountry(c);
    setOpen(false);
    setQuery("");
    emit(c, number);
    inputRef.current?.focus();
  }

  function handleNumberChange(e: React.ChangeEvent<HTMLInputElement>) {
    const n = e.target.value.replace(/[^\d]/g, ""); // hanya digit
    setNumber(n);
    emit(country, n);
  }

  const filtered = query.trim()
    ? COUNTRIES.filter(
        c =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.dial.includes(query)
      )
    : COUNTRIES;

  return (
    <div className="flex flex-col gap-1.5" ref={wrapRef}>
      <label className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
        {optional && <span className="ml-1 font-normal text-muted-foreground">(opsional)</span>}
      </label>

      <div className="flex h-9 w-full rounded-md border border-input bg-background shadow-sm overflow-hidden focus-within:ring-1 focus-within:ring-ring">
        {/* Tombol pilih negara */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => { setOpen(o => !o); setQuery(""); }}
          className={cn(
            "flex items-center gap-1.5 px-2.5 border-r border-input text-sm whitespace-nowrap shrink-0 transition-colors",
            "hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50",
            open && "bg-muted"
          )}
        >
          <span>{country.flag}</span>
          <span className="text-muted-foreground font-mono text-xs">{country.dial}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>

        {/* Input nomor */}
        <input
          ref={inputRef}
          type="tel"
          inputMode="numeric"
          value={number}
          onChange={handleNumberChange}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 bg-transparent px-3 py-1 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 min-w-0"
        />
      </div>

      {/* Dropdown negara */}
      {open && (
        <div className="absolute z-50 mt-10 rounded-md border border-border bg-popover shadow-md w-72 overflow-hidden">
          {/* Search */}
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Cari negara atau kode..."
              autoFocus
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          {/* List */}
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">Tidak ditemukan.</li>
            ) : (
              filtered.map(c => (
                <li key={c.code}>
                  <button
                    type="button"
                    onMouseDown={e => { e.preventDefault(); handleCountrySelect(c); }}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm flex items-center gap-3 hover:bg-muted/60 transition-colors",
                      country.code === c.code && "bg-primary/5 font-medium text-primary"
                    )}
                  >
                    <span className="text-base">{c.flag}</span>
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="text-xs text-muted-foreground font-mono">{c.dial}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}

      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
